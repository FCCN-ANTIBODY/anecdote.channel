// Weights for the real instrument — fetch, hash-pin, and verify all-MiniLM-L6-v2.
//
// The CONSTITUTION (§ Mobile LLM) and civic-node OPEN-QUESTIONS §O want "one uniform,
// verifiable instrument everyone runs identically" — cold-load, pinned hash. So the model is
// NOT downloaded from a third party at runtime; it is vendored, pinned by SHA-256, and served
// from anecdote.channel's own GitHub Release. This module obtains those files into the
// already-gitignored vendor/ dir, verifies every byte against a committed manifest, and
// derives the canonical reducerVersion from the weights' own hash.
//
// Pure Node (node: builtins only) — no top-level @xenova import, so embedders.mjs can pull this
// in from Node without breaking the browser composer. Files are fetched via `curl` (which
// honors HTTPS_PROXY + the system CA) to keep this dependency-free and proxy-friendly.
//
// CLI:
//   node reducer/weights.mjs version          print the canonical reducerVersion
//   node reducer/weights.mjs verify           re-hash vendored files against the manifest
//   node reducer/weights.mjs fetch            download the pinned Release asset(s) + verify
//   node reducer/weights.mjs record <dir>     hash a local model dir -> emit a pinned manifest
//                                             (the one-time bootstrap step; HF reachable there)

import { createHash } from "node:crypto";
import { readFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

export const MODEL = "Xenova/all-MiniLM-L6-v2";

// The six files transformers.js needs for feature-extraction with the quantized ONNX. `path`
// is the layout under the model dir; `asset` is the (flat) GitHub Release asset name. `sha256`
// is filled at bootstrap by `record` — null here means UNPINNED (fetch/verify refuse).
export const WEIGHTS = {
  model: MODEL,
  // TODO(bootstrap): set once the Release exists on FCCN-ANTIBODY/anecdote.channel.
  release: null,                 // e.g. "minilm-l6-v2-q8"
  baseUrl: null,                 // e.g. "https://github.com/FCCN-ANTIBODY/anecdote.channel/releases/download/minilm-l6-v2-q8"
  files: [
    { path: "config.json",              asset: "config.json",              sha256: null },
    { path: "tokenizer.json",           asset: "tokenizer.json",           sha256: null },
    { path: "tokenizer_config.json",    asset: "tokenizer_config.json",    sha256: null },
    { path: "special_tokens_map.json",  asset: "special_tokens_map.json",  sha256: null },
    { path: "vocab.txt",                asset: "vocab.txt",                 sha256: null },
    { path: "onnx/model_quantized.onnx", asset: "model_quantized.onnx",     sha256: null },
  ],
};

// Absolute path to the local model root (transformers.js env.localModelPath). Files live under
// <root>/<model>/..., so env.localModelPath = this, and the model dir is modelDir().
export function modelRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "vendor", "models");
}
export function modelDir(root = modelRoot()) {
  return join(root, ...WEIGHTS.model.split("/"));
}

export function isPinned() {
  return Boolean(WEIGHTS.release) && WEIGHTS.files.every((f) => typeof f.sha256 === "string" && f.sha256.length === 64);
}

// The canonical reducerVersion: the model id plus a short digest OVER the per-file weight
// hashes. Different quantizations -> different vectors -> different version, so the reducer's
// snapshot guard cannot silently accept incompatible weights. Unpinned weights yield a marker
// that is intentionally never equal to a real one.
export function canonicalVersion() {
  if (!isPinned()) return `${WEIGHTS.model}@q8-UNPINNED`;
  const h = createHash("sha256");
  for (const f of WEIGHTS.files) h.update(f.path + ":" + f.sha256 + "\n");
  return `${WEIGHTS.model}@q8-${h.digest("hex").slice(0, 12)}`;
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

// Re-hash the vendored files against the manifest. Returns { ok, reason?, missing[], mismatch[] }.
export async function verify(root = modelRoot()) {
  if (!isPinned()) return { ok: false, reason: "weights manifest is UNPINNED — run `record` at bootstrap", missing: [], mismatch: [] };
  const dir = modelDir(root), missing = [], mismatch = [];
  for (const f of WEIGHTS.files) {
    const p = join(dir, ...f.path.split("/"));
    if (!existsSync(p)) { missing.push(f.path); continue; }
    if ((await sha256(p)) !== f.sha256) mismatch.push(f.path);
  }
  return { ok: missing.length === 0 && mismatch.length === 0, missing, mismatch };
}

// True when verified weights are present — used by the integration test / embedder to decide
// whether to run for real or skip.
export async function present(root = modelRoot()) {
  return (await verify(root)).ok;
}

function curl(url, dest) {
  const r = spawnSync("curl", ["-fSL", "--retry", "3", "-o", dest, url], { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) throw new Error(`download failed (${url}) — curl exit ${r.status}`);
}

// Download the pinned Release asset(s) into vendor/, then verify. Refuses (with the bootstrap
// recipe) when unpinned, and never routes around a policy denial — if the host 403s, curl fails
// and we surface it.
export async function fetchWeights(root = modelRoot()) {
  if (!isPinned()) { console.error(bootstrapHelp()); throw new Error("cannot fetch: weights are UNPINNED"); }
  const dir = modelDir(root);
  for (const f of WEIGHTS.files) {
    const p = join(dir, ...f.path.split("/"));
    await mkdir(dirname(p), { recursive: true });
    console.log(`fetch ${f.asset} -> ${f.path}`);
    curl(`${WEIGHTS.baseUrl}/${f.asset}`, p);
    const got = await sha256(p);
    if (got !== f.sha256) throw new Error(`hash mismatch for ${f.path}: got ${got.slice(0, 12)}…, want ${f.sha256.slice(0, 12)}…`);
  }
  console.log(`ok — verified ${WEIGHTS.files.length} files for ${canonicalVersion()}`);
}

// Hash a local model dir (the one-time bootstrap, where HF is reachable) and print a pinned
// manifest fragment + the canonical version to paste back into this file.
export async function record(dir) {
  const out = [];
  for (const f of WEIGHTS.files) {
    const p = join(dir, ...f.path.split("/"));
    if (!existsSync(p)) throw new Error(`missing ${f.path} under ${dir}`);
    out.push({ ...f, sha256: await sha256(p), bytes: (await stat(p)).size });
  }
  const pinned = { ...WEIGHTS, files: out.map(({ bytes, ...f }) => f) };
  console.log("// paste into WEIGHTS (set `release`/`baseUrl` to the published Release):");
  console.log(JSON.stringify(pinned, null, 2));
  console.log("\n// sizes:"); out.forEach((f) => console.log(`//   ${f.path}  ${(f.bytes / 1e6).toFixed(2)} MB`));
  // version preview uses the freshly recorded hashes
  const h = createHash("sha256");
  for (const f of out) h.update(f.path + ":" + f.sha256 + "\n");
  console.log(`\ncanonical reducerVersion -> ${WEIGHTS.model}@q8-${h.digest("hex").slice(0, 12)}`);
}

function bootstrapHelp() {
  return [
    "weights are UNPINNED. Bootstrap (one-time, where huggingface.co is reachable):",
    `  1. Download ${MODEL} (config/tokenizer files + onnx/model_quantized.onnx).`,
    "  2. node reducer/weights.mjs record <dir>   # prints the pinned manifest + version",
    "  3. Paste the manifest into reducer/weights.mjs; publish the files as a GitHub Release asset.",
    "  4. node reducer/weights.mjs fetch          # pulls + verifies from the Release",
  ].join("\n");
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, arg] = process.argv.slice(2);
  const run = {
    version: () => console.log(canonicalVersion()),
    verify: async () => {
      const v = await verify();
      console.log(v.ok ? `ok — ${canonicalVersion()} present and verified`
        : `not ok: ${v.reason || ""}${v.missing.length ? " missing: " + v.missing.join(", ") : ""}${v.mismatch.length ? " mismatch: " + v.mismatch.join(", ") : ""}`);
      process.exit(v.ok ? 0 : 1);
    },
    fetch: async () => { await fetchWeights(); },
    record: async () => { if (!arg) throw new Error("usage: record <model-dir>"); await record(arg); },
  };
  const fn = run[cmd];
  if (!fn) { console.error("usage: node reducer/weights.mjs <version|verify|fetch|record <dir>>"); process.exit(2); }
  Promise.resolve(fn()).catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
