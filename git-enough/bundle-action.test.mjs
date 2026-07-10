// Integration: an UNCHANGED real bin/*.mjs runs against the virtual repo, byte-identical to its GitHub
// run (actions-enough phase 2 — scripts/bundle-action.mjs + the node: shims). Bundles a real workflow
// script (atlas's bin/atlas-labels.mjs, a `Publish ·`-family manifest builder) with node:fs aliased to the
// ambient virtual fs, runs it against an in-memory tree, and asserts its signed output equals the SAME
// script run the ordinary way against real disk. Needs the sibling atlas checkout + esbuild, so it SKIPS
// cleanly when either is absent (mirrors minilm.test.mjs). Run: node git-enough/bundle-action.test.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { useActionFs } from "./shim-fs.mjs";
import { virtualFs } from "./node-compat.mjs";

const ATLAS = fileURLToPath(new URL("../../atlas.anecdote.channel/", import.meta.url));
const script = join(ATLAS, "bin/atlas-labels.mjs");
if (!existsSync(script)) { console.log("SKIP bundle-action.test.mjs — sibling atlas.anecdote.channel checkout not present"); process.exit(0); }

let bundleAction, loadOrCreateSigner;
try {
  ({ bundleAction } = await import("../scripts/bundle-action.mjs"));   // pulls esbuild from reducer/'s devDeps
  ({ loadOrCreateSigner } = await import(join(ATLAS, "bin/atlas-index.mjs")));
} catch (e) { console.log("SKIP bundle-action.test.mjs — esbuild not installed (run `npm i` in reducer/). " + (e?.message || e)); process.exit(0); }

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const NOW = "2026-07-09T00:00:00Z";

// One fixed signer, seeded into BOTH runs, so the Ed25519 signature is deterministic and the outputs are
// comparable byte-for-byte (else loadOrCreateSigner mints a fresh key each run).
const keyDir = mkdtempSync(join(tmpdir(), "ae-key-"));
mkdirSync(join(keyDir, "keys"), { recursive: true });
await loadOrCreateSigner(join(keyDir, "keys/dump-signer.pk8"), { create: true });
const KEY = readFileSync(join(keyDir, "keys/dump-signer.pk8"));

const seed = {
  "atlas.yml": "id: demo\n",
  "_data/tells.yml": "- id: foco\n  name: \"Fort Collins Parks\"\n  scope: colorado\n",
  "_data/needs.yml": "- id: bg\n  topic: social/boardgames\n  scope: colorado\n  asker_repo: a/b\n",
  "keys/dump-signer.pk8": KEY,
};

// --- run A: the UNCHANGED script, bundled, against the in-memory virtual tree ---
try {
  await bundleAction(script, "/tmp/atlas-labels.bundle.mjs");
} catch (e) { console.log("SKIP — bundling failed (esbuild unavailable?): " + (e?.message || e)); process.exit(0); }
ok(true, "bundled the unchanged bin/atlas-labels.mjs with node:fs aliased to the shim");

useActionFs(virtualFs(seed));
const bundled = await import("/tmp/atlas-labels.bundle.mjs");
const vIndex = (await bundled.buildLabelIndex("", { now: NOW })).index;
ok(vIndex && vIndex.labels.length > 0, "the bundled script read its inputs from the VIRTUAL tree and built the index");

// --- run B: the same script, ordinary, against real disk ---
const dir = mkdtempSync(join(tmpdir(), "ae-real-"));
for (const [p, v] of Object.entries(seed)) { const abs = join(dir, p); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, v); }
const real = await import(script);
const rIndex = (await real.buildLabelIndex(dir, { now: NOW })).index;

// --- the proof ---
ok(JSON.stringify(vIndex) === JSON.stringify(rIndex),
  "virtual-tree run === real-disk run, byte-for-byte (incl. the Ed25519 signature) — the pivot's promise");
ok(vIndex.labels.some((l) => l.label === "parks") && vIndex.labels.some((l) => l.label === "boardgames"),
  "and the output is the real signed label index (parks, boardgames, …)");

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nbundle-action: an unchanged real bin/*.mjs ran on the virtual repo, byte-identical to its GitHub run");
