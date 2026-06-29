// Build the vendored Tier-0 browser runtime under /runtime/ (see docs/DELIVERY.md).
//
// transformers.js v4's web build bare-imports `onnxruntime-web/webgpu` (→ onnxruntime-common), a
// graph a module Worker can't resolve without an import map. So we BUNDLE it into one self-
// contained ESM with esbuild (a build-time tool; the OUTPUT is the vendored, hash-pinned artifact),
// and copy the onnx wasm runtime it loads at runtime (the asyncify single-thread build — the one
// that works without cross-origin isolation, ~24MB; the threaded/jsep variants aren't needed).
//
// Prereq: `cd reducer && npm i` (brings @huggingface/transformers + esbuild). Then:
//   node scripts/build-runtime.mjs
// Re-pin afterwards: `node reducer/weights.mjs record-runtime`.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { copyFileSync, mkdirSync, statSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const reducer = join(ROOT, "reducer");
const require = createRequire(join(reducer, "package.json"));
const esbuild = require("esbuild");
const ORT = join(reducer, "node_modules", "@huggingface", "transformers", "node_modules", "onnxruntime-web", "dist");
const OUT = join(ROOT, "runtime");
mkdirSync(OUT, { recursive: true });

await esbuild.build({
  stdin: { contents: `export { pipeline, env } from "@huggingface/transformers";`, resolveDir: reducer, loader: "js" },
  bundle: true, format: "esm", platform: "browser", target: "es2022",
  outfile: join(OUT, "transformers.bundle.mjs"), legalComments: "none",
});

const WASM = ["ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm"];
for (const f of WASM) copyFileSync(join(ORT, f), join(OUT, f));

const mb = (p) => (statSync(p).size / 1e6).toFixed(2) + " MB";
console.log("built runtime/:");
for (const f of ["transformers.bundle.mjs", ...WASM]) console.log(`  ${mb(join(OUT, f))}  ${f}`);
console.log("next: node reducer/weights.mjs record-runtime");
