// Unit: the held token (held-token.mjs) — the one imported credential and its two device-local gates.
// The crown (foreground gesture), the held store (RAM-only, redacted), the chokepoint (crown up AND token
// held, else no push), and guardedPublish (the credential reaches the wire ONLY through the gate).
// Run: node git-enough/held-token.test.mjs
import { makeCrown, makeHeldToken, holdFromEnv, guardedPublish, pushReadiness } from "./held-token.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const PAT = "github_pat_11ABCDEFG0123456789_wXyZsecretsecretsecretsecret";

// 1. the crown: down by default, take/putDown/toggle, and it notifies.
{
  const crown = makeCrown();
  let last = null; crown.onChange((v) => (last = v));
  ok(!crown.isUp(), "the crown starts down");
  crown.take(); ok(crown.isUp() && last === true, "taking it up raises it and notifies");
  crown.toggle(); ok(!crown.isUp() && last === false, "toggle puts it down and notifies");
}

// 2. the held store: empty by default; hold sets; release clears; the full token never shows.
{
  const held = makeHeldToken();
  ok(!held.isHeld() && held.describe() === null, "no token held by default");
  held.hold(PAT);
  ok(held.isHeld(), "holding a token marks it held");
  const d = held.describe();
  ok(d && d.username === "x-access-token", "describe() names the default git user");
  ok(!d.token.includes("secret") && d.token !== PAT && /…/.test(d.token), "describe() REDACTS the token (never the raw secret)");
  held.release();
  ok(!held.isHeld() && held.describe() === null, "release clears the held token");
}

// 3. the chokepoint: the credential is surrendered ONLY when the crown is up AND a token is held.
{
  const crown = makeCrown();
  const held = makeHeldToken();
  const threw = (f) => { try { f(); return null; } catch (e) { return e.message; } };

  ok(/crown is down/.test(threw(() => held.credentialFor(crown))), "crown down, no token → refused (crown first)");
  held.hold(PAT);
  ok(/crown is down/.test(threw(() => held.credentialFor(crown))), "crown down, token held → still refused (presence required)");
  crown.take();
  const cred = held.credentialFor(crown);
  ok(cred && cred.token === PAT && cred.username === "x-access-token", "crown up + token held → the credential is surrendered");
  held.release();
  ok(/no token held/.test(threw(() => held.credentialFor(crown))), "crown up but token released → refused (both gates real)");
}

// 4. guardedPublish: the credential reaches the (injected) pusher only through the gate; refusal = no wire.
{
  const crown = makeCrown();
  const held = makeHeldToken();
  held.hold(PAT);
  let seen = null, calls = 0;
  const fakePublish = async (repo, opts) => { calls++; seen = opts; return { ok: true, ref: opts.ref }; };

  // crown down → guardedPublish throws BEFORE the pusher runs
  let threw = false;
  try { await guardedPublish({}, { url: "https://x/y", crown, held, publish: fakePublish }); } catch { threw = true; }
  ok(threw && calls === 0, "crown down → guardedPublish throws and the pusher is never called (no network)");

  // crown up → the pusher runs with the credential and forwarded url/ref
  crown.take();
  const res = await guardedPublish({ tree: "…" }, { url: "https://x/y", ref: "refs/heads/origin-held", crown, held, publish: fakePublish });
  ok(calls === 1 && res.ok, "crown up + token → the pusher runs once");
  ok(seen.credential.token === PAT && seen.ref === "refs/heads/origin-held" && seen.url === "https://x/y",
    "…and receives the held credential plus the forwarded url/ref");
}

// 5. holdFromEnv: env → RAM, no persistence; absent var → false.
{
  const held = makeHeldToken();
  ok(holdFromEnv(held, "OFFLINE_ORIGIN_PAT", { OFFLINE_ORIGIN_PAT: PAT }) === true && held.isHeld(), "holdFromEnv moves the env token into the held store");
  const empty = makeHeldToken();
  ok(holdFromEnv(empty, "OFFLINE_ORIGIN_PAT", {}) === false && !empty.isHeld(), "holdFromEnv returns false when the env var is unset");
}

// 6. pushReadiness: a dry, token-safe read of the gate for a UI — mirrors the chokepoint, leaks nothing.
{
  const crown = makeCrown();
  const held = makeHeldToken();
  ok(!pushReadiness({ crown, held }).ready && /crown is down/.test(pushReadiness({ crown, held }).reason), "readiness: crown down → not ready, says why");
  crown.take();
  ok(!pushReadiness({ crown, held }).ready && /no token/.test(pushReadiness({ crown, held }).reason), "readiness: token missing → not ready, says why");
  held.hold(PAT);
  const r = pushReadiness({ crown, held, url: "https://github.com/fccn-antibody/anecdote.channel", ref: "refs/heads/origin-held" });
  ok(r.ready && r.as === "x-access-token" && /…/.test(r.token) && !r.token.includes("secret"), "readiness: both gates up → ready, token still redacted");
  ok(r.target.endsWith(".git/git-receive-pack") && r.ref === "refs/heads/origin-held", "readiness: names the direct receive-pack target (no OAuth redirect)");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall held-token tests passed");
