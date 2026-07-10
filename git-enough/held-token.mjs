// git-enough/held-token.mjs — THE HELD TOKEN (docs/actions-enough.md phase 3; the one imported credential).
//
// Every other credential in this system is a key the device MINTS itself (the origin key, the attestation
// keys, seal-enough). The GitHub PAT is the single credential we structurally CANNOT self-issue — only
// GitHub can vouch for GitHub — so it is imported, HELD on the device, and never written to a repo, a
// workflow secret, or any tracked file. It is the password for send-pack's HTTP Basic auth (the fine-
// grained PAT: Contents R/W), and it talks straight to the repo's git-receive-pack — no OAuth redirect
// stack, because the redirect dance needs the same network the push does and buys us nothing offline.
//
// Two device-local gates stand between a held token and a push — neither is a GitHub ACL:
//   1. a token must be HELD  (you provisioned one out-of-band and handed it to the device), and
//   2. the CROWN must be up  (foreground, single-focus — you are present, now, holding it).
// The push cannot borrow the token unless you are here. We accept a token; we never mint or persist one.

// ---- the crown: a held gesture (foreground, single-focus). A boolean you take up on purpose. -----------
export function makeCrown(initial = false) {
  let up = !!initial;
  const subs = new Set();
  const set = (v) => { if (up !== v) { up = v; for (const f of subs) f(up); } return up; };
  return {
    isUp: () => up,
    take: () => set(true),
    putDown: () => set(false),
    toggle: () => set(!up),
    onChange: (f) => { subs.add(f); return () => subs.delete(f); },
  };
}

// ---- the held store: the imported PAT, in memory only, redacted on display, never serialized. ----------
export function makeHeldToken() {
  let cred = null;                                   // { username, token } — RAM only, never persisted
  return {
    hold(token, { username = "x-access-token" } = {}) {
      if (!token || typeof token !== "string") throw new Error("held-token: need a token string to hold");
      cred = { username, token };
      return true;
    },
    release() { cred = null; },
    isHeld: () => cred !== null,
    // A safe-to-render view: the username and a redacted token. The full secret never leaves this closure
    // except through credentialFor(), which is gated.
    describe: () => cred ? { username: cred.username, token: redact(cred.token) } : null,
    // THE CHOKEPOINT. Surrender the credential to a pusher ONLY when the crown is up AND a token is held.
    // Throws a specific, honest reason otherwise — the caller pushes nothing.
    credentialFor(crown) {
      if (!crown || !crown.isUp()) throw new Error("held-token: the crown is down — a push needs you present (foreground)");
      if (!cred) throw new Error("held-token: no token held — provision a GitHub PAT and hold it first");
      return cred;
    },
  };
}

function redact(t) {
  if (t.length <= 8) return "•".repeat(Math.max(1, t.length));
  return t.slice(0, 4) + "…" + t.slice(-4);
}

// Move a token from the device's environment (never from a repo) into the held store. Opt-in convenience
// for the CLI/device context; it does not persist anything — env → RAM. Returns false if nothing was set.
export function holdFromEnv(held, name = "OFFLINE_ORIGIN_PAT", env = (typeof process !== "undefined" ? process.env : {})) {
  const token = env && env[name];
  if (!token) return false;
  held.hold(token);
  return true;
}

// ---- the guarded push: send-pack's publish(), but the credential comes ONLY through the gate. ----------
// The gate is resolved BEFORE any network work; if it throws, discover/pack/sendPack never run. `publish`
// is injectable so the whole gate is tested offline without importing the wire code.
export async function guardedPublish(repo, { url, ref = "refs/heads/main", crown, held,
  fetch = globalThis.fetch, capabilities, publish } = {}) {
  if (!held) throw new Error("guardedPublish: need a held-token store");
  const credential = held.credentialFor(crown);     // throws (no push) unless the crown is up and a token is held
  const pub = publish || (await import("./send-pack.mjs")).publish;
  return pub(repo, { url, credential, ref, fetch, capabilities });
}

// A dry read of the gate for a UI: why a push would be refused, or how it would go if allowed — WITHOUT
// exposing the token or touching the network. Mirrors credentialFor's decision exactly.
export function pushReadiness({ crown, held, url, ref = "refs/heads/main" } = {}) {
  if (!crown || !crown.isUp()) return { ready: false, reason: "the crown is down — take it up to push" };
  if (!held || !held.isHeld()) return { ready: false, reason: "no token held — provision a GitHub PAT and hold it" };
  const d = held.describe();
  return { ready: true, as: d.username, token: d.token, ref,
    target: url ? `${String(url).replace(/\.git$/, "")}.git/git-receive-pack` : null };
}
