// git-enough/bottle.mjs — THE GIT BOTTLE: git-enough served as a signed, headless probe. No UI. A tool
// iframes the bottle (a real, signed origin on its sub-sub-domain) and talks to its probe; the bottle vends
// git-enough's ops through the probe-line's consent gate (composer/authorize.mjs fixes each op's rung, so a
// caller can never raise it). This is the Elevated-side SESSION — transport-free and Node-testable; the
// served page, the cross-origin hello, and the caller-signature check are the thin browser layer on top.
//
// The bottle holds the repo (deps.repo) and any credential/network (deps.credential/fetch); a caller names
// only the op it wants — the probe-line's "the powerful side holds the power" rule. A git bottle vends git,
// and ONLY git: compose nothing else here.
import { elevatedSession, serveProbeLine, READY, INIT } from "../composer/probe-line.mjs";
import { verifyBottleAttestation, bottleHost } from "../composer/bottle-attest.mjs";
import { gitOps } from "./probe-ops.mjs";

// The headless session — drive it with probe-line REQUEST/CANCEL messages; frames go to `emit`. Pure, so a
// test and the eventual served page share one brain. `context` is read live per request (recording toggle +
// standing grants); default is recording-on with no grants, so Rung-1 ops need a fresh confirmation.
export function gitBottleSession({ repo, credential, fetch, inflate, author, emit, context, yield_, trace } = {}) {
  return elevatedSession({
    ops: gitOps({ repo, credential, fetch, inflate, author }),
    emit,
    context,
    yield_,
    trace,
  });
}

// Browser convenience: serve the git bottle over the MessagePort the iframing tool transferred in. Thin
// wrapper over serveProbeLine — the transport, not the logic. (The cross-origin hello that hands us the port,
// and the caller-signature check the bottle forces before serving, are the follow-on browser unit.)
export function serveGitBottle(port, { repo, credential, fetch, inflate, author, context } = {}) {
  return serveProbeLine(port, { ops: gitOps({ repo, credential, fetch, inflate, author }), context });
}

// ---- the thin cross-origin transport (browser-only; verified in Chromium, like probe-line's spawnChamber).
// The usual probe-line hello has a powerful PARENT summon a powerless data: chamber. A bottle inverts it: the
// bottle is the capable CHILD (its own signed origin, iframed by URL) and the tool is the PARENT client. The
// port is still the capability; WHAT runs is gated by the user's operate-grant carried in each request. ------

// Our running domain anchor from where this code actually loaded (or null if it isn't a bottle host).
function runningHost(win) {
  try { return bottleHost("https://" + win.location.host + "/"); } catch { return null; }
}

// BOTTLE side: THE BOOT GATE, then the hello. First prove ourselves — an API is signed to run for its own
// bottle or not at all: verify our OWN domain-anchored attestation against the host we are actually on, under
// the pinned platform key. This check runs in the pinned runtime (this code), in the bottle's origin, so it
// reads the real host for itself — not a per-call credential, not a session. If the attestation is missing or
// wrong for this domain we OFFER NOTHING: no readiness is announced and no port is ever served. On success we
// announce READY and, on the INIT hello, serve git over the transferred port (one port; later inits ignored).
// Async (the verify is async). Returns { ok, stop } on success, or { ok:false, reason } when the gate refuses.
export async function serveOnHello({ repo, credential, fetch, inflate, author, context, attestation, platformKey, host, self: win = globalThis } = {}) {
  const anchor = host || runningHost(win);
  const gate = await verifyBottleAttestation(attestation, { host: anchor, platformKey });
  if (!gate.ok) return { ok: false, reason: gate.reason }; // the API crashes its own surface — offers nothing

  let served = null;
  const onMessage = (event) => {
    const d = event.data;
    if (!d || d.type !== INIT || !event.ports || !event.ports[0] || served) return;
    served = serveGitBottle(event.ports[0], { repo, credential, fetch, inflate, author, context });
  };
  win.addEventListener("message", onMessage);
  (win.parent || win).postMessage({ type: READY }, "*"); // the inverted hello — we don't know the parent's origin
  return { ok: true, stop: () => { win.removeEventListener("message", onMessage); if (served) served.stop(); } };
}

// PARENT (client) side: iframe a bottle by URL, wait for its READY, hand it a private MessagePort. This is the
// GENERIC transport (any bottle, not just git), so it now lives in composer/bottle-embed.mjs; re-exported here
// for the existing callers that reach for it alongside the git bottle.
export { embedBottle } from "../composer/bottle-embed.mjs";
