// Unit: gate-tick (gate-tick.mjs) — the JSON-in/JSON-out tick seam the Atlas transport calls. Proves
// runTick folds resolutions and reports admitted/expired/escalated, and that the same works over the real
// CLI (stdin JSON -> stdout JSON). Real presence proofs + signed resolutions. Run: node composer/gate-tick.test.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateIdentity } from "./sign.mjs";
import { makeClaim, witnessClaim } from "./presence.mjs";
import { buildItem, resolveItem } from "./gate.mjs";
import { enqueue } from "./gate-queue.mjs";
import { runTick } from "./gate-tick.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const here = dirname(fileURLToPath(import.meta.url));

const reduce = (t) => ({ label: t, tokens: String(t || "").toLowerCase().split(/\s+/).filter(Boolean) });
const ATLAS = "atlas:boulder", C = "boulder.watershed";
const dest = { kind: "atlas", excludes: ["spam"] };
const now = "2026-07-14T18:00:00.000Z";
const knobs = { quorum: 2, recencyWindowMs: 4 * 60 * 60 * 1000, atlasConstituency: C };

const witness = await generateIdentity();
async function proof(who, { at = now } = {}) {
  const claim = await makeClaim({ constituency: C, bisect: { method: "bisect", boundary: "b-1" }, at }, who);
  return witnessClaim(claim, { bisect: { method: "bisect", boundary: "b-1", constituency: C }, at }, witness);
}
async function vote(item) { const id = await generateIdentity(); return resolveItem(item, dest, id, { proof: await proof(id), reduce, at: now }); }

const item = buildItem({ target: ATLAS, text: "a story about my garden", at: now });
const queue = await enqueue([], item, { at: now });
const resolutions = [await vote(item), await vote(item)];

// 1. runTick folds a quorum and admits, clearing the queue.
{
  const out = await runTick({ queue, resolutions, now, knobs });
  ok(out.admitted.length === 1 && out.queue.length === 0, "runTick admits an item that reaches quorum and clears it");
  ok(out.admitted[0].item.text === "a story about my garden", "the admitted item is carried through");
}

// 2. below quorum stays pending.
{
  const out = await runTick({ queue, resolutions: [resolutions[0]], now, knobs });
  ok(out.admitted.length === 0 && out.queue.length === 1, "one resolution keeps the item pending");
}

// 3. requires `now`.
{
  let threw = false;
  try { await runTick({ queue, resolutions }); } catch { threw = true; }
  ok(threw, "runTick refuses without `now`");
}

// 4. the CLI round-trip: stdin JSON -> stdout JSON, same result.
{
  const input = JSON.stringify({ queue, resolutions, now, knobs });
  const r = spawnSync("node", [join(here, "gate-tick.mjs")], { input, encoding: "utf8", maxBuffer: 1 << 24 });
  ok(r.status === 0, "the CLI exits 0");
  let out = null; try { out = JSON.parse(r.stdout); } catch {}
  ok(out && out.admitted.length === 1 && out.queue.length === 0, "the CLI admits the quorum item over stdin/stdout");
}

// 5. the CLI rejects malformed / now-less input with a non-zero exit.
{
  const bad = spawnSync("node", [join(here, "gate-tick.mjs")], { input: "{ not json", encoding: "utf8" });
  ok(bad.status === 2, "malformed stdin JSON exits 2");
  const noNow = spawnSync("node", [join(here, "gate-tick.mjs")], { input: JSON.stringify({ queue: [] }), encoding: "utf8" });
  ok(noNow.status === 2, "missing `now` exits 2");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall gate-tick tests passed");
