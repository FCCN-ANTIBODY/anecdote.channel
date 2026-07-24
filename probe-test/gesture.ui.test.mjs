// probe-test/gesture.ui.test.mjs — THE GESTURE GATE, DRIVEN. The docs and unit tests defer the browser
// half of the consent surface to "probe-test/drive-gesture.mjs (Chromium virtual authenticator)" — a
// harness that was never committed. This is that drive, landed: composer/gesture.mjs run in a real
// headless Chromium against a CDP virtual platform authenticator, proving the whole "you are the
// second factor" claim end to end:
//
//   1. ENROLL — a real passkey ceremony (navigator.credentials.create) on the anecdote origin;
//   2. THE GATE — gatedAttest signs only after a live user-VERIFIED assertion whose challenge is the
//      hash of the exact artifact; verifyGated accepts, uv flag and signer fingerprint checked;
//   3. THE SMUDGE — an ungated artifact (plain attest, no gesture) is rejected by a gesture-requiring
//      verifier: an intruder who skips the ceremony leaves a visible mark, never a passable fake;
//   4. NO REPLAY — a gesture lifted from artifact A onto artifact B fails (challenge binds the bytes);
//   5. THE REFUSAL — the same authenticator with user-verification WITHHELD (setUserVerified false)
//      refuses the ceremony, and NOTHING gets signed — the failure IS the gate.
//
// Run: node probe-test/gesture.ui.test.mjs   (skips cleanly when no Chromium is available)
import { findChromium, withPage } from "./harness.mjs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const chromium = findChromium();
if (!chromium) {
  console.log("skip: no chromium in this environment (set CHROMIUM=/path/to/chromium to run)");
  process.exit(0);
}

// The fixture exposes STEPS the test invokes one at a time, so the authenticator's state can be
// flipped over CDP between them. Real modules, real origin, real ceremonies.
const FIXTURE = `<!doctype html><meta charset="utf-8"><title>the gesture gate</title>
<script type="module">
import { enrollGesture, gatedAttest, verifyGated } from "/composer/gesture.mjs";
import { attest, generateIdentity } from "/composer/sign.mjs";
const S = { cred: null, identity: null, artifact: null };
const catching = (fn) => (...a) => fn(...a).catch((e) => ({ threw: String(e && e.message || e) }));
window.steps = {
  enroll: catching(async () => {
    S.identity = await generateIdentity();
    S.cred = await enrollGesture({ rpId: "anecdote.channel", userName: "operator" });
    return { credId: !!S.cred.credId, alg: S.cred.alg, origin: S.cred.origin };
  }),
  gated: catching(async () => {
    const { signed } = await gatedAttest({ schema: "anecdote.note/v1", text: "seal the north-meadow round" }, S.identity, S.cred);
    S.artifact = signed;
    const v = await verifyGated(signed, { spki: S.cred.spki, alg: S.cred.alg, rpId: S.cred.rpId, origin: S.cred.origin });
    return { ok: v.ok, by: v.by, fingerprint: S.identity.fingerprint, hasGesture: !!signed.gesture, errors: v.errors };
  }),
  ungated: catching(async () => {
    const bare = await attest({ schema: "anecdote.note/v1", text: "an intruder skipped the ceremony" }, S.identity);
    const v = await verifyGated(bare, { spki: S.cred.spki, alg: S.cred.alg, rpId: S.cred.rpId, origin: S.cred.origin });
    return { ok: v.ok, errors: v.errors };
  }),
  replay: catching(async () => {
    const forged = await attest({ schema: "anecdote.note/v1", text: "a DIFFERENT act wearing a stolen gesture", gesture: S.artifact.gesture }, S.identity);
    const v = await verifyGated(forged, { spki: S.cred.spki, alg: S.cred.alg, rpId: S.cred.rpId, origin: S.cred.origin });
    return { ok: v.ok, errors: v.errors };
  }),
  refused: catching(async () => {
    const r = await gatedAttest({ schema: "anecdote.note/v1", text: "should never be signed" }, S.identity, S.cred);
    return { signed: !!r.signed };
  }),
};
window.ready = true;
</script>`;

const ran = await withPage({
  chromium, tls: true,
  origins: { "anecdote.channel": { root, tree: { "gesture-ui.html": FIXTURE } } },
}, async (page, { server }) => {
  const authenticator = await page.webauthn();
  await page.goto("https://anecdote.channel/gesture-ui.html");
  await page.waitFor("window.ready === true");

  // 1 — enroll.
  const enrolled = await page.eval("window.steps.enroll()");
  ok(!enrolled.threw && enrolled.credId === true, "a real passkey enrolled on the anecdote origin"
     + (enrolled.threw ? " — threw: " + enrolled.threw : ""));
  ok(enrolled.alg === -7 || enrolled.alg === -8, "…with a verifiable algorithm (ES256/EdDSA): " + enrolled.alg);

  // 2 — the gate: sign only after the verified gesture; the proof rides inside the signature.
  const gated = await page.eval("window.steps.gated()");
  ok(!gated.threw && gated.ok === true && gated.hasGesture === true,
     "gatedAttest signed after a live user-VERIFIED ceremony, and verifyGated accepts"
     + (gated.threw ? " — threw: " + gated.threw : " (errors: " + JSON.stringify(gated.errors) + ")"));
  ok(gated.by === gated.fingerprint, "the artifact is signed by the device identity, gesture folded inside");

  // 3 — the smudge: an ungated artifact cannot pass a gesture-requiring verifier.
  const ungated = await page.eval("window.steps.ungated()");
  ok(ungated.ok === false && ungated.errors.some((e) => /ungated/.test(e)),
     "skipping the ceremony leaves the smudge: " + JSON.stringify(ungated.errors));

  // 4 — no replay: the challenge is the artifact's own bytes.
  const replay = await page.eval("window.steps.replay()");
  ok(replay.ok === false && replay.errors.some((e) => /challenge mismatch/.test(e)),
     "a stolen gesture on different bytes fails the challenge binding: " + JSON.stringify(replay.errors));

  // 5 — the refusal: withhold user verification and the ceremony itself refuses; nothing signs.
  await authenticator.setUserVerified(false);
  const refused = await page.eval("window.steps.refused()");
  ok(!!refused.threw && refused.signed !== true,
     "with verification withheld the gate REFUSES and nothing is signed: " + refused.threw);

  ok(server.foreign.length === 0, "no request escaped to any host the test did not stand up"
     + (server.foreign.length ? " — leaked: " + JSON.stringify(server.foreign) : ""));
});

if (!ran) { console.log("skip: could not bind 443 for the tls transport (root/CAP_NET_BIND_SERVICE, or sysctl net.ipv4.ip_unprivileged_port_start=443)"); process.exit(0); }
if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall gesture-gate UI tests passed (the second factor is real: enroll, gate, smudge, no-replay, refusal)");
