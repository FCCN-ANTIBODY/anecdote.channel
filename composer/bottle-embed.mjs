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
