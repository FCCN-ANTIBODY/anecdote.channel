// Web Worker: hosts an embedder off the main thread and answers id-tagged RPCs from model-bus.mjs.
// Default backend is the pure-JS toy embedder (instant, zero network) so the bus always comes up.
// With ?real=1 it TRIES the on-device MiniLM — the VENDORED, hash-pinned browser runtime under
// /runtime/ loading the in-repo model, no CDN — and falls back to toy on any failure, so it
// degrades gracefully instead of breaking.
//
// Off-thread real backend WORKS: the earlier "this.tokenizer is not a function" was a full-URL
// env.localModelPath breaking transformers' tokenizer loading — fixed by using worker-relative
// path strings below (resolved against self.location). ?real now flips to minilm in the Worker.
//
// Imports only the browser-safe, synchronous helpers from embedders.mjs (toyEmbed/fewestVerbs);
// the heavy path is the bundled runtime (a relative, servable URL), never a bare specifier (a
// module worker can't resolve those) and never weights.mjs (which uses node: builtins).

import { toyEmbed, fewestVerbs } from "../reducer/embedders.mjs";

const REAL = new URLSearchParams(self.location.search).get("real") === "1";

let embedImpl = (text) => Array.from(toyEmbed(text));   // default backend
let backend = "toy";

async function tryMiniLm() {
  // VENDORED browser runtime — committed under /runtime/, no node_modules, no CDN (see DELIVERY.md).
  const { pipeline, env } = await import("../runtime/transformers.bundle.mjs");
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  // Page/worker-RELATIVE strings, not full hrefs: a full-URL localModelPath breaks transformers'
  // tokenizer loading (tokenizer comes back non-callable). Relative resolves against the worker's
  // self.location, so it's correct here and under a project-pages subpath.
  env.localModelPath = "../models/";                  // -> <base>/models/Xenova/...
  env.backends.onnx.wasm.wasmPaths = "../runtime/";   // vendored onnx wasm + loader
  const extract = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    dtype: "q8",
    progress_callback: (p) => self.postMessage({ type: "progress", ...p }),
  });
  // Smoke-test one embed so a non-callable-tokenizer failure surfaces here and we fall back to toy.
  await extract("ready?", { pooling: "mean", normalize: true });
  return async (text) => Array.from((await extract(text, { pooling: "mean", normalize: true })).data);
}

(async () => {
  if (REAL) {
    try { embedImpl = await tryMiniLm(); backend = "minilm"; }
    catch (e) { self.postMessage({ type: "progress", status: "fallback", message: String(e?.message || e) }); }
  }
  self.postMessage({ type: "ready", backend });
})();

// Serialize RPCs: the transformers pipeline is not reentrant — concurrent embed() calls (e.g. a
// dictionary embedded with Promise.all) race on shared state ("this.tokenizer is not a function").
// A one-at-a-time queue keeps it correct; callers still await normally.
let queue = Promise.resolve();
self.addEventListener("message", (ev) => {
  const { cmd, id, text } = ev.data || {};
  if (id == null) return;                       // dormant: only respond to addressed RPCs
  queue = queue.then(async () => {
    try {
      if (cmd === "embed") self.postMessage({ id, result: await embedImpl(text || "") });
      else if (cmd === "name") self.postMessage({ id, result: fewestVerbs(text || "") });
      else self.postMessage({ id, error: `unknown cmd: ${cmd}` });
    } catch (e) {
      self.postMessage({ id, error: String(e?.message || e) });
    }
  });
});
