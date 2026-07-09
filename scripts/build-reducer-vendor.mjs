// Build the vendored browser bundle of `compromise` under /runtime/ (see docs/label-reducer.md).
//
// The POS reducer (reducer/pos-schedule.mjs) needs a `compromise` nlp factory in the browser, but a
// module Worker / static page can't resolve the bare "compromise" specifier. So we BUNDLE it into one
// self-contained, servable ESM with esbuild (a build-time tool; the OUTPUT is the vendored, committed
// artifact) — the same move build-runtime.mjs makes for transformers.js. compromise is pure-JS and
// dependency-free, so the bundle is small and needs no wasm/asset sidecars.
//
// Prereq: `cd reducer && npm i` (brings compromise + esbuild). Then:
//   node scripts/build-reducer-vendor.mjs

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { statSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const reducer = join(ROOT, "reducer");
const require = createRequire(join(reducer, "package.json"));
const esbuild = require("esbuild");
const OUT = join(ROOT, "runtime");

await esbuild.build({
  stdin: { contents: `export { default } from "compromise";`, resolveDir: reducer, loader: "js" },
  bundle: true, format: "esm", platform: "browser", target: "es2022",
  outfile: join(OUT, "compromise.bundle.mjs"), legalComments: "none",
});

const mb = (p) => (statSync(p).size / 1e6).toFixed(2) + " MB";
console.log("built runtime/compromise.bundle.mjs  " + mb(join(OUT, "compromise.bundle.mjs")));
