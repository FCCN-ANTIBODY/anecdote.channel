// Weights for the real instrument — pin + verify all-MiniLM-L6-v2 from the in-repo model.
//
// The CONSTITUTION (§ Mobile LLM) and civic-node OPEN-QUESTIONS §O want "one uniform, verifiable
// instrument everyone runs identically" — cold-load, pinned hash. The model SOURCE is committed
// in this repo at models/Xenova/all-MiniLM-L6-v2/ (the quantized ONNX + tokenizer/config), so it
// arrives with every clone — no third-party fetch at runtime. This module pins those bytes by
// SHA-256 into a generated lock (model.lock.json) and verifies against it; the canonical
// reducerVersion is the lock's own hash digest, so a label can't be confused with other weights.
//
// Pure Node (node: builtins only) — no top-level @xenova import, so embedders.mjs can pull this
// in from Node without breaking the browser composer.
//
// CLI:
//   node reducer/weights.mjs version          print the canonical reducerVersion (from the lock)
//   node reducer/weights.mjs verify           re-hash the in-repo model against the lock
//   node reducer/weights.mjs record [dir]     hash models/ -> WRITE model.lock.json (keeps thresholds)
//   node reducer/weights.mjs fetch            optional: pull a published Release (thin clients)

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

export const MODEL = "Xenova/all-MiniLM-L6-v2";
const HERE = dirname(fileURLToPath(import.meta.url));
const LOCK_PATH = join(HERE, "model.lock.json");

// The files transformers.js needs for quantized feature-extraction. `path` is the layout under
// the model dir; `asset` is the (flat) name used only by the optional Release fetch.
export const FILES = [
  { path: "config.json",               asset: "config.json" },
  { path: "tokenizer.json",            asset: "tokenizer.json" },
  { path: "tokenizer_config.json",     asset: "tokenizer_config.json" },
  { path: "special_tokens_map.json",   asset: "special_tokens_map.json" },
  { path: "vocab.txt",                 asset: "vocab.txt" },
  { path: "onnx/model_quantized.onnx", asset: "model_quantized.onnx" },
];

// Optional Release for thin clients that clone without the ~23MB blob. null = the in-repo model
// is the source of truth (the normal case); set baseUrl once a Release is published.
export const RELEASE = { tag: null, baseUrl: null };

// ---- lock (the generated config: pins + thresholds) --------------------------------------
let _lock, _lockRead = false;
export function loadLock() {
  if (_lockRead) return _lock;
  _lockRead = true; _lock = null;
  try {
    if (existsSync(LOCK_PATH)) { const o = JSON.parse(readFileSync(LOCK_PATH, "utf8")); _lock = o && Object.keys(o).length ? o : null; }
  } catch { _lock = null; }
  return _lock;
}
async function writeLock(patch) {
  let cur = {};
  try { if (existsSync(LOCK_PATH)) cur = JSON.parse(readFileSync(LOCK_PATH, "utf8")) || {}; } catch { cur = {}; }
  const next = { ...cur, ...patch };
  await writeFile(LOCK_PATH, JSON.stringify(next, null, 2) + "\n");
  _lockRead = false;                          // invalidate cache
  return next;
}

// ---- paths -------------------------------------------------------------------------------
export function modelRoot() {
  return process.env.REDUCER_MODEL_ROOT || join(HERE, "..", "models");
}
export function modelDir(root = modelRoot()) {
  return join(root, ...MODEL.split("/"));
}

// ---- pin state ---------------------------------------------------------------------------
export function isPinned() {
  const l = loadLock();
  return Boolean(l && Array.isArray(l.files) && l.files.length === FILES.length &&
    FILES.every((f) => { const e = l.files.find((x) => x.path === f.path); return e && /^[0-9a-f]{64}$/.test(e.sha256 || ""); }));
}

function digestVersion(files) {
  const h = createHash("sha256");
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) h.update(f.path + ":" + f.sha256 + "\n");
  return `${MODEL}@q8-${h.digest("hex").slice(0, 12)}`;
}

// The canonical reducerVersion — taken from the lock (computed by `record`), or an UNPINNED
// marker that is intentionally never equal to a real one.
export function canonicalVersion() {
  const l = loadLock();
  return l && l.reducerVersion ? l.reducerVersion : `${MODEL}@q8-UNPINNED`;
}

// Calibrated thresholds from the lock, with provisional fallbacks so a fresh checkout still runs.
export function thresholds() {
  const l = loadLock();
  const has = l && typeof l.assignT === "number" && typeof l.mergeT === "number";
  return { assignT: has ? l.assignT : 0.45, mergeT: has ? l.mergeT : 0.55, pinned: Boolean(has) };
}

async function sha256(p) { return createHash("sha256").update(await readFile(p)).digest("hex"); }

// Re-hash the in-repo model against the lock. { ok, reason?, missing[], mismatch[] }.
export async function verify(root = modelRoot()) {
  const l = loadLock();
  if (!isPinned()) return { ok: false, reason: "model.lock.json absent/empty — run `node reducer/weights.mjs record`", missing: [], mismatch: [] };
  const dir = modelDir(root), missing = [], mismatch = [];
  for (const f of FILES) {
    const e = l.files.find((x) => x.path === f.path);
    const p = join(dir, ...f.path.split("/"));
    if (!existsSync(p)) { missing.push(f.path); continue; }
    if ((await sha256(p)) !== e.sha256) mismatch.push(f.path);
  }
  return { ok: missing.length === 0 && mismatch.length === 0, missing, mismatch };
}
export async function present(root = modelRoot()) { return (await verify(root)).ok; }

// Persist calibrated thresholds without disturbing the pins (one writer, so record/calibrate
// compose in any order). Idempotent: unchanged values don't rewrite the lock, so CI stays a
// no-op when nothing changed.
export async function setThresholds(assignT, mergeT) {
  const cur = loadLock();
  if (cur && cur.assignT === assignT && cur.mergeT === mergeT) return cur;
  return writeLock({ assignT, mergeT });
}

// Hash the in-repo model and WRITE the lock (pins + version), preserving any thresholds already
// recorded. Default dir is the committed models/ path so CI can call it with no argument.
export async function record(dir = modelDir()) {
  const files = [];
  for (const f of FILES) {
    const p = join(dir, ...f.path.split("/"));
    if (!existsSync(p)) throw new Error(`missing ${f.path} under ${dir} — commit the model under models/ first`);
    files.push({ path: f.path, sha256: await sha256(p), bytes: (await stat(p)).size });
  }
  const reducerVersion = digestVersion(files);
  // Keep generatedAt stable when the pins are unchanged, so re-running record is byte-idempotent
  // (the CI auto-commit diff-guard depends on this).
  const cur = loadLock();
  const unchanged = cur && cur.reducerVersion === reducerVersion && JSON.stringify(cur.files) === JSON.stringify(files);
  const generatedAt = unchanged ? cur.generatedAt : new Date().toISOString();
  await writeLock({ model: MODEL, reducerVersion, files, generatedAt });
  console.log(`wrote ${LOCK_PATH}\n  version: ${reducerVersion}`);
  files.forEach((f) => console.log(`  ${f.sha256.slice(0, 12)}…  ${(f.bytes / 1e6).toFixed(2)} MB  ${f.path}`));
}

function curl(url, dest) {
  const r = spawnSync("curl", ["-fSL", "--retry", "3", "-o", dest, url], { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) throw new Error(`download failed (${url}) — curl exit ${r.status}`);
}

// Optional: pull a published Release into models/ for a thin clone, verifying against the lock.
export async function fetchWeights(root = modelRoot()) {
  if (!RELEASE.baseUrl) throw new Error("in-repo models/ is the source of truth; `fetch` is only for thin clients once a Release is published (set RELEASE.baseUrl).");
  if (!isPinned()) throw new Error("cannot fetch: model.lock.json is UNPINNED — run `record` first");
  const l = loadLock(), dir = modelDir(root);
  for (const f of FILES) {
    const e = l.files.find((x) => x.path === f.path);
    const p = join(dir, ...f.path.split("/"));
    await mkdir(dirname(p), { recursive: true });
    console.log(`fetch ${f.asset} -> ${f.path}`);
    curl(`${RELEASE.baseUrl}/${f.asset}`, p);
    if ((await sha256(p)) !== e.sha256) throw new Error(`hash mismatch for ${f.path}`);
  }
  console.log(`ok — verified ${FILES.length} files for ${canonicalVersion()}`);
}

// ---- generative namer (v1) — additive; never reads or writes the embedder fields above ------
// The namer model (default Xenova/flan-t5-small, a seq2seq with separate encoder + decoder ONNX)
// is DEFERRED: it isn't committed yet. These helpers pin/verify it into an optional `namer` block
// in the same lock when it lands, and otherwise report "unpinned" cleanly so everything skips.
export const NAMER_MODEL = "Xenova/flan-t5-small";
export const NAMER_FILES = [               // provisional T5 file set; confirmed when vendored
  { path: "config.json" },
  { path: "generation_config.json" },
  { path: "tokenizer.json" },
  { path: "tokenizer_config.json" },
  { path: "special_tokens_map.json" },
  { path: "spiece.model" },
  { path: "onnx/encoder_model_quantized.onnx" },
  { path: "onnx/decoder_model_merged_quantized.onnx" },
];

export function namerRoot() { return modelRoot(); }                       // same models/ root
export function namerDir(root = namerRoot()) { return join(root, ...NAMER_MODEL.split("/")); }

export function namerIsPinned() {
  const n = loadLock()?.namer;
  return Boolean(n && Array.isArray(n.files) && n.files.length === NAMER_FILES.length &&
    NAMER_FILES.every((f) => { const e = n.files.find((x) => x.path === f.path); return e && /^[0-9a-f]{64}$/.test(e.sha256 || ""); }));
}

export function namerVersion() {
  const n = loadLock()?.namer;
  return n && n.version ? n.version : `${NAMER_MODEL}@q8-UNPINNED`;
}

export async function namerVerify(root = namerRoot()) {
  const n = loadLock()?.namer;
  if (!namerIsPinned()) return { ok: false, reason: "namer not pinned (model deferred) — run `record-namer` once vendored", missing: [], mismatch: [] };
  const dir = namerDir(root), missing = [], mismatch = [];
  for (const f of NAMER_FILES) {
    const e = n.files.find((x) => x.path === f.path);
    const p = join(dir, ...f.path.split("/"));
    if (!existsSync(p)) { missing.push(f.path); continue; }
    if ((await sha256(p)) !== e.sha256) mismatch.push(f.path);
  }
  return { ok: missing.length === 0 && mismatch.length === 0, missing, mismatch };
}
export async function namerPresent(root = namerRoot()) { return (await namerVerify(root)).ok; }

// Pin the in-repo namer into the `namer` block (idempotent). No-ops with a message when the model
// isn't committed, so CI never fails on the deferred model.
export async function recordNamer(dir = namerDir()) {
  const have = NAMER_FILES.every((f) => existsSync(join(dir, ...f.path.split("/"))));
  if (!have) { console.log(`namer model not present under ${dir} — skipping record-namer (deferred).`); return; }
  const files = [];
  for (const f of NAMER_FILES) {
    const p = join(dir, ...f.path.split("/"));
    files.push({ path: f.path, sha256: await sha256(p), bytes: (await stat(p)).size });
  }
  const h = createHash("sha256");
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) h.update(f.path + ":" + f.sha256 + "\n");
  const version = `${NAMER_MODEL}@q8-${h.digest("hex").slice(0, 12)}`;
  const cur = loadLock()?.namer;
  const unchanged = cur && cur.version === version && JSON.stringify(cur.files) === JSON.stringify(files);
  const generatedAt = unchanged ? cur.generatedAt : new Date().toISOString();
  await writeLock({ namer: { id: NAMER_MODEL, version, files, generatedAt } });
  console.log(`wrote namer pin\n  version: ${version}`);
  files.forEach((f) => console.log(`  ${f.sha256.slice(0, 12)}…  ${(f.bytes / 1e6).toFixed(2)} MB  ${f.path}`));
}

// ---- vendored browser runtime (Tier-0) — additive; the lib+wasm half of the instrument --------
// The committed /runtime/ holds the bundled transformers.js + the onnx wasm runtime it loads. These
// are pinned into a `runtime` block so a consumer verifies the ENTIRE cold-loaded stack (lib +
// runtime + weights), not just the model — "one uniform, verifiable instrument" (§O). Built by
// scripts/build-runtime.mjs.
export const RUNTIME_FILES = [
  { path: "transformers.bundle.mjs" },
  { path: "ort-wasm-simd-threaded.asyncify.mjs" },
  { path: "ort-wasm-simd-threaded.asyncify.wasm" },
];
export function runtimeDir() { return join(HERE, "..", "runtime"); }

export function runtimeIsPinned() {
  const r = loadLock()?.runtime;
  return Boolean(r && Array.isArray(r.files) && r.files.length === RUNTIME_FILES.length &&
    RUNTIME_FILES.every((f) => { const e = r.files.find((x) => x.path === f.path); return e && /^[0-9a-f]{64}$/.test(e.sha256 || ""); }));
}
export function runtimeVersion() {
  const r = loadLock()?.runtime;
  return r && r.version ? r.version : "runtime@UNPINNED";
}
export async function runtimeVerify(dir = runtimeDir()) {
  const r = loadLock()?.runtime;
  if (!runtimeIsPinned()) return { ok: false, reason: "runtime not pinned — run `record-runtime`", missing: [], mismatch: [] };
  const missing = [], mismatch = [];
  for (const f of RUNTIME_FILES) {
    const e = r.files.find((x) => x.path === f.path);
    const p = join(dir, ...f.path.split("/"));
    if (!existsSync(p)) { missing.push(f.path); continue; }
    if ((await sha256(p)) !== e.sha256) mismatch.push(f.path);
  }
  return { ok: missing.length === 0 && mismatch.length === 0, missing, mismatch };
}
export async function runtimePresent(dir = runtimeDir()) { return (await runtimeVerify(dir)).ok; }

// Pin the vendored runtime into the `runtime` block (idempotent).
export async function recordRuntime(dir = runtimeDir()) {
  const have = RUNTIME_FILES.every((f) => existsSync(join(dir, ...f.path.split("/"))));
  if (!have) { console.log(`runtime not present under ${dir} — run \`node scripts/build-runtime.mjs\` first.`); return; }
  const files = [];
  for (const f of RUNTIME_FILES) {
    const p = join(dir, ...f.path.split("/"));
    files.push({ path: f.path, sha256: await sha256(p), bytes: (await stat(p)).size });
  }
  const h = createHash("sha256");
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) h.update(f.path + ":" + f.sha256 + "\n");
  const version = `runtime@${h.digest("hex").slice(0, 12)}`;
  const cur = loadLock()?.runtime;
  const unchanged = cur && cur.version === version && JSON.stringify(cur.files) === JSON.stringify(files);
  const generatedAt = unchanged ? cur.generatedAt : new Date().toISOString();
  await writeLock({ runtime: { version, files, generatedAt } });
  console.log(`wrote runtime pin\n  version: ${version}`);
  files.forEach((f) => console.log(`  ${f.sha256.slice(0, 12)}…  ${(f.bytes / 1e6).toFixed(2)} MB  ${f.path}`));
}

// The whole-instrument id: a digest over the weights + runtime versions (the verifiable stack).
export function instrumentVersion() {
  const h = createHash("sha256");
  h.update(canonicalVersion() + "\n" + runtimeVersion() + "\n");
  return `instrument@${h.digest("hex").slice(0, 12)}`;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, arg] = process.argv.slice(2);
  const run = {
    version: () => console.log(canonicalVersion()),
    "version-instrument": () => console.log(instrumentVersion()),
    "version-runtime": () => console.log(runtimeVersion()),
    "record-runtime": async () => { await recordRuntime(arg || undefined); },
    "verify-runtime": async () => {
      const v = await runtimeVerify();
      console.log(v.ok ? `ok — ${runtimeVersion()} present and verified`
        : `not ok: ${v.reason || ""}${v.missing.length ? " missing: " + v.missing.join(", ") : ""}${v.mismatch.length ? " mismatch: " + v.mismatch.join(", ") : ""}`);
      process.exit(v.ok ? 0 : 1);
    },
    verify: async () => {
      const v = await verify();
      console.log(v.ok ? `ok — ${canonicalVersion()} present and verified`
        : `not ok: ${v.reason || ""}${v.missing.length ? " missing: " + v.missing.join(", ") : ""}${v.mismatch.length ? " mismatch: " + v.mismatch.join(", ") : ""}`);
      process.exit(v.ok ? 0 : 1);
    },
    record: async () => { await record(arg || undefined); },
    fetch: async () => { await fetchWeights(); },
    "version-namer": () => console.log(namerVersion()),
    "record-namer": async () => { await recordNamer(arg || undefined); },
    "verify-namer": async () => {
      if (!namerIsPinned()) { console.log(`namer UNPINNED (deferred) — ${namerVersion()}`); process.exit(0); }
      const v = await namerVerify();
      console.log(v.ok ? `ok — ${namerVersion()} present and verified`
        : `not ok:${v.missing.length ? " missing: " + v.missing.join(", ") : ""}${v.mismatch.length ? " mismatch: " + v.mismatch.join(", ") : ""}`);
      process.exit(v.ok ? 0 : 1);
    },
  };
  const fn = run[cmd];
  if (!fn) { console.error("usage: node reducer/weights.mjs <version|verify|record [dir]|fetch|version-instrument|version-runtime|record-runtime|verify-runtime|version-namer|record-namer [dir]|verify-namer>"); process.exit(2); }
  Promise.resolve(fn()).catch((e) => { console.error(String(e.message || e)); process.exit(1); });
}
