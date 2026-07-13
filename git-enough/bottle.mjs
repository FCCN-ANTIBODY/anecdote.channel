// git-enough/bottle.mjs — THE GIT BOTTLE: git-enough served as a signed, headless probe. No UI. A tool
// iframes the bottle (a real, signed origin on its sub-sub-domain) and talks to its probe; the bottle vends
// git-enough's ops through the probe-line's consent gate (composer/authorize.mjs fixes each op's rung, so a
// caller can never raise it). This is the Elevated-side SESSION — transport-free and Node-testable; the
// served page, the cross-origin hello, and the caller-signature check are the thin browser layer on top.
//
// The bottle holds the repo (deps.repo) and any credential/network (deps.credential/fetch); a caller names
// only the op it wants — the probe-line's "the powerful side holds the power" rule. A git bottle vends git,
// and ONLY git: compose nothing else here.
import { elevatedSession, serveProbeLine, connectProbeLine, READY, INIT } from "../composer/probe-line.mjs";
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

// BOTTLE side: announce readiness to whoever iframed us, and on the INIT hello serve git over the transferred
// port. One port; later inits are ignored. Returns { stop } (removes the listener and stops the session).
export function serveOnHello({ repo, credential, fetch, inflate, author, context, self: win = globalThis } = {}) {
  let served = null;
  const onMessage = (event) => {
    const d = event.data;
    if (!d || d.type !== INIT || !event.ports || !event.ports[0] || served) return;
    served = serveGitBottle(event.ports[0], { repo, credential, fetch, inflate, author, context });
  };
  win.addEventListener("message", onMessage);
  (win.parent || win).postMessage({ type: READY }, "*"); // the inverted hello — we don't know the parent's origin
  return { stop: () => { win.removeEventListener("message", onMessage); if (served) served.stop(); } };
}

// PARENT (client) side: iframe a bottle by URL, wait for its READY, hand it a private MessagePort, and return
// a connected probe client. Cross-origin: a bottle serves whoever holds its port, so the consent that decides
// what RUNS rides in each request (composer/bottle-grant operateTag + the user's grant). Returns
// { client, iframe, teardown }.
export function embedBottle(url, { document: doc = globalThis.document, targetWindow = globalThis, mount = null, sandbox = null } = {}) {
  const iframe = doc.createElement("iframe");
  if (sandbox) iframe.setAttribute("sandbox", sandbox);
  iframe.src = url;
  (mount || doc.body).appendChild(iframe);
  const channel = new MessageChannel();
  return new Promise((resolve) => {
    const onReady = (event) => {
      if (event.source !== iframe.contentWindow || !event.data || event.data.type !== READY) return;
      targetWindow.removeEventListener("message", onReady);
      iframe.contentWindow.postMessage({ type: INIT }, "*", [channel.port2]); // transfer the capability
      resolve({
        client: connectProbeLine(channel.port1),
        iframe,
        teardown: () => { try { channel.port1.close(); } catch {} iframe.remove(); },
      });
    };
    targetWindow.addEventListener("message", onReady);
  });
}
