// Web Worker: hosts an embedder off the main thread and answers id-tagged RPCs from model-bus.mjs.
// Default backend is the pure-JS toy embedder (instant, zero network) so the bus always comes up.
// With ?real=1 it TRIES the on-device MiniLM — browser transformers.js loading the in-repo model
// and a LOCALLY-served onnx wasm runtime (no CDN) — and falls back to toy on any failure, so a
// missing wasm loader (as in a CDN-blocked environment) degrades gracefully instead of breaking.
//
// Imports only the browser-safe, synchronous helpers from embedders.mjs (toyEmbed/fewestVerbs);
// the heavy path is loaded via a servable RELATIVE URL to the transformers dist, never a bare
// specifier (which a module worker can't resolve) and never weights.mjs (which uses node: builtins).

import { toyEmbed, fewestVerbs } from "../reducer/embedders.mjs";

const REAL = new URLSearchParams(self.location.search).get("real") === "1";

let embedImpl = (text) => Array.from(toyEmbed(text));   // default backend
let backend = "toy";

async function tryMiniLm() {
  // Browser ESM build of transformers.js, served from the repo's node_modules (see scripts/serve.mjs).
  const { pipeline, env } = await import("../reducer/node_modules/@huggingface/transformers/dist/transformers.web.js");
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = new URL("../models/", import.meta.url).href;                 // -> /models/Xenova/...
  env.backends.onnx.wasm.wasmPaths = new URL("../reducer/node_modules/onnxruntime-web/dist/", import.meta.url).href;
  const extract = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    dtype: "q8",
    progress_callback: (p) => self.postMessage({ type: "progress", ...p }),
  });
  return async (text) => Array.from((await extract(text, { pooling: "mean", normalize: true })).data);
}

(async () => {
  if (REAL) {
    try { embedImpl = await tryMiniLm(); backend = "minilm"; }
    catch (e) { self.postMessage({ type: "progress", status: "fallback", message: String(e?.message || e) }); }
  }
  self.postMessage({ type: "ready", backend });
})();

self.addEventListener("message", async (ev) => {
  const { cmd, id, text } = ev.data || {};
  if (id == null) return;                       // dormant: only respond to addressed RPCs
  try {
    if (cmd === "embed") self.postMessage({ id, result: await embedImpl(text || "") });
    else if (cmd === "name") self.postMessage({ id, result: fewestVerbs(text || "") });
    else self.postMessage({ id, error: `unknown cmd: ${cmd}` });
  } catch (e) {
    self.postMessage({ id, error: String(e?.message || e) });
  }
});
