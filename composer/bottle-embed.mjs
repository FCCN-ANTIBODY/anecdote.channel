// composer/bottle-embed.mjs — the GENERIC client-side bottle transport (browser-only). Extracted from
// git-enough/bottle.mjs so it is not filed under the git bottle: embedding a bottle by URL and handing it a
// private port is the same dance for ANY bottle (a git engine, a model, a storage adapter), and nothing about
// it is git-specific. Keeping it here lets a caller that only needs the transport — the models hub, the
// reducer's on-stall probe — import it WITHOUT dragging the git-enough client graph.
//
// Pairs with git-enough/bottle.mjs's serveOnHello (the bottle/served side). This is the PARENT/client side of
// probe-line's inverted hello: the bottle is the capable child (its own signed origin, iframed by URL) and we
// are the client. The port is the capability; WHAT runs is gated by the user's operate-grant in each request.
import { connectProbeLine, READY, INIT } from "./probe-line.mjs";

// Iframe a bottle by URL, wait for its READY, hand it a private MessagePort, and return a connected probe
// client. Cross-origin: a bottle serves whoever holds its port, so the consent that decides what RUNS rides in
// each request (composer/bottle-grant operateTag + the user's grant). Returns { client, iframe, teardown }.
//
// `allow` is the iframe's Permissions-Policy delegation (e.g. "camera" for a floor whose reader drinks a
// billboard) — it must be set BEFORE the frame loads, which is why it is an option here and not something a
// caller can add afterwards. `expectOrigin`, when given, is checked against the browser-attested
// `event.origin` of the READY: the port is a capability, and it should not be handed to a frame that
// navigated somewhere other than the bottle that was named (D11: an embed is scoped to a NAMED bottle).
export function embedBottle(url, { document: doc = globalThis.document, targetWindow = globalThis, mount = null, sandbox = null,
                                   allow = null, expectOrigin = null, title = null } = {}) {
  const iframe = doc.createElement("iframe");
  if (sandbox) iframe.setAttribute("sandbox", sandbox);
  if (allow) iframe.setAttribute("allow", allow);
  if (title) iframe.setAttribute("title", title);
  iframe.src = url;
  (mount || doc.body).appendChild(iframe);
  const channel = new MessageChannel();
  return new Promise((resolve) => {
    const onReady = (event) => {
      if (event.source !== iframe.contentWindow || !event.data || event.data.type !== READY) return;
      if (expectOrigin && event.origin !== expectOrigin) return;   // not the bottle that was named: no port
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
