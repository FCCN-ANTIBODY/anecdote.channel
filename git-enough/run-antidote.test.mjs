// The "it feels real" proof (actions-enough): a REAL antidote workflow runs END TO END on the device —
// the held tree, the interpreter, an unchanged bin firing its main(), and a git-enough pack to push down —
// with NO repo secret, because the ledger key is HELD, not seated from ${{ secrets }}. Needs the sibling
// antidote checkout + esbuild; SKIPS cleanly otherwise. Run: node git-enough/run-antidote.test.mjs
import { existsSync, readFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { virtualFs } from "./node-compat.mjs";
import { parseWorkflowSteps, planSteps, runWorkflow } from "./workflow.mjs";
import { makeResolver } from "./composite.mjs";
import { makeRunNode } from "./run-node-live.mjs";
import { buildRepo } from "./publish-cli.mjs";
import { packRepo } from "./pack.mjs";

const ROOT = fileURLToPath(new URL("../../antidote/", import.meta.url));
if (!existsSync(join(ROOT, ".github/workflows/heartbeat.yml"))) { console.log("SKIP run-antidote.test.mjs — sibling antidote checkout not present"); process.exit(0); }

let bundleAction, attest;
try {
  ({ bundleAction } = await import("../scripts/bundle-action.mjs"));   // esbuild via reducer/'s devDeps
  attest = await import(join(ROOT, "bin/attest.mjs"));                 // for a fixed key + verify
} catch (e) { console.log("SKIP run-antidote.test.mjs — esbuild not installed (npm i in reducer/). " + (e?.message || e)); process.exit(0); }

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// The ledger key the device HOLDS (on GitHub this is seated from a secret; here it is just in the tree).
const kd = mkdtempSync(join(tmpdir(), "antidote-key-"));
mkdirSync(join(kd, "keys"), { recursive: true });
await attest.loadOrCreateSigner(join(kd, "keys/ledger-signer.pk8"), { create: true });
const KEY = readFileSync(join(kd, "keys/ledger-signer.pk8"));

// The held tree: just the ledger key. attest-heartbeat reads index/ (empty -> 0 buckets), ledger/ (default),
// and re-signs heartbeat.json + keys/ledger.fpr against the held key.
const fs = virtualFs({ "keys/ledger-signer.pk8": KEY });
const ctx = { fs, env: {} };

const wf = parseWorkflowSteps(readFileSync(join(ROOT, ".github/workflows/heartbeat.yml"), "utf8"));
ok(/heartbeat/i.test(wf.name), "loaded the real antidote workflow: " + wf.name);

const R = makeResolver((p) => readFileSync(join(ROOT, p), "utf8"));   // actions + bin SOURCE from the checkout
const runNode = makeRunNode(bundleAction, ROOT);                       // bundle the real bin source, run on the tree
const author = { name: "Origin", email: "origin@device", epoch: 1700000000, tz: "+0000" };
const push = async (ctx) => {
  const files = Object.entries(ctx.fs.snapshot()).map(([path, bytes]) => ({ path, content: bytes }));
  const { r } = await buildRepo({ files, root: true, author, message: "heartbeat: re-attest, checked as of now" });
  return { pack: await packRepo(r), files: files.length };
};

const { log, pushed } = await runWorkflow(planSteps(wf.steps), {
  runNode, push, openAction: R.openAction, resolveBin: R.resolveBin, ctx,
  inputs: { publish: "true" },   // the device wants to publish; ledger-key is unset ('') -> the seat step skips
});

console.log("\n  --- the device ran the workflow ---");
for (const l of log) console.log("   " + (l.script ? `${l.kind} ${l.script}` : l.kind).padEnd(34) + l.outcome);
console.log("");

ok(/held/.test(log[0].outcome), "checkout: held — no clone, the device already holds the tree");
ok(log.some((l) => /opened composite/.test(l.outcome)), "the heartbeat composite action was opened + recursed");
ok(log.some((l) => /skipped/.test(l.outcome) && /if:/.test(l.outcome)), "the seat-the-secret step SKIPPED — the key is held, not seated (no secret needed)");
ok(log.some((l) => /attest-heartbeat\.mjs/.test(l.script || "") && /ran/.test(l.outcome)), "bin/attest-heartbeat resolved to node and RAN on the held tree");
ok(fs.existsSync("heartbeat.json"), "the workflow wrote heartbeat.json into the tree");
const hb = JSON.parse(fs.readFileSync("heartbeat.json", "utf8"));
ok((await attest.verifyAttested(hb)).ok, "the heartbeat verifies — signed by the HELD ledger key, on-device");
ok(fs.existsSync("keys/ledger.fpr"), "the public fingerprint rides beside the key, as on GitHub");
ok(pushed && pushed.pack && pushed.pack.length > 0, "the workflow ended in a REAL git-enough pack, ready to push DOWN: " + (pushed && pushed.pack.length) + " bytes");

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("a real antidote workflow ran on the device and produced a pushable, signed result — no secret, the key was held");
