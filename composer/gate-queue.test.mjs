// Unit: gate-queue (gate-queue.mjs) — the Atlas-operator half of the gate. Proves: enqueue is idempotent;
// ingest attaches resolutions one-per-resolver; tick sorts entries into admitted / pending / expired
// (decay) / escalated (disagreement); and toJudgmentRequest shapes an escalation for the Judge. Real
// presence proofs + a stub reducer. Run: node composer/gate-queue.test.mjs
import { generateIdentity } from "./sign.mjs";
import { makeClaim, witnessClaim } from "./presence.mjs";
import { buildItem, resolveItem } from "./gate.mjs";
import { enqueue, ingest, tick, toJudgmentRequest, DEFAULT_KNOBS } from "./gate-queue.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const reduce = (t) => ({ label: t, tokens: String(t || "").toLowerCase().split(/\s+/).filter(Boolean) });
const reduceDrift = () => ({ label: "x", tokens: ["spam"] });   // a drifted/lying reducer: sees "spam" everywhere

const ATLAS = "atlas:boulder";
const C = "boulder.watershed";
const dest = { kind: "atlas", excludes: ["spam"] };
const now = "2026-07-14T18:00:00.000Z";
const KNOBS = { quorum: 2, recencyWindowMs: 4 * 60 * 60 * 1000, atlasConstituency: C };

const witness = await generateIdentity();
async function proof(who, { at = now, constituency = C } = {}) {
  const claim = await makeClaim({ constituency, bisect: { method: "bisect", boundary: "b-1" }, at }, who);
  return witnessClaim(claim, { bisect: { method: "bisect", boundary: "b-1", constituency }, at }, witness);
}
async function vote(item, { admitTrue = true, at = now } = {}) {
  const id = await generateIdentity();
  return resolveItem(item, dest, id, { proof: await proof(id, { at }), reduce: admitTrue ? reduce : reduceDrift, at });
}

const story = buildItem({ target: ATLAS, text: "a story about my garden", at: now });

// 1. enqueue is idempotent by item id.
{
  let q = await enqueue([], story, { at: now });
  q = await enqueue(q, story, { at: now });
  ok(q.length === 1 && q[0].resolutions.length === 0, "enqueue adds once; a re-lodge does not duplicate");
}

// 2. ingest attaches by item, one resolution per resolver (newest wins), drops unknown items.
{
  let q = await enqueue([], story, { at: now });
  const a = await vote(story), b = await vote(story);
  q = ingest(q, [a, b]);
  ok(q[0].resolutions.length === 2, "two distinct resolvers attach two resolutions");

  // same resolver, two resolutions -> kept once (newest).
  const id = await generateIdentity();
  const r1 = await resolveItem(story, dest, id, { proof: await proof(id), reduce, at: now });
  const r2 = await resolveItem(story, dest, id, { proof: await proof(id), reduce, at: now });
  let q2 = ingest(await enqueue([], story, { at: now }), [r1, r2]);
  ok(q2[0].resolutions.length === 1, "one resolver, one slot — a re-sent resolution replaces, never pads");

  // a resolution for an item not in the queue is dropped.
  const other = buildItem({ target: ATLAS, text: "unrelated", at: now });
  const q3 = ingest(await enqueue([], story, { at: now }), [await vote(other)]);
  ok(q3[0].resolutions.length === 0, "a resolution for an un-queued item is dropped");
}

// 3. tick — admitted on quorum; pending below it.
{
  const q = ingest(await enqueue([], story, { at: now }), [await vote(story)]);
  const t1 = await tick(q, { now, ...KNOBS });
  ok(t1.admitted.length === 0 && t1.pending.length === 1, "one vote stays pending (below quorum)");

  const q2 = ingest(await enqueue([], story, { at: now }), [await vote(story), await vote(story)]);
  const t2 = await tick(q2, { now, ...KNOBS });
  ok(t2.admitted.length === 1 && t2.pending.length === 0 && t2.admitted[0].forCount === 2, "a quorum of two admits and clears the entry");
}

// 4. tick — decay: an old, sub-quorum entry expires (the jam bound).
{
  const old = "2026-07-14T10:00:00.000Z";           // 8h before `now`
  const q = ingest(await enqueue([], story, { at: old }), [await vote(story)]);
  const t = await tick(q, { now, decayWindowMs: 4 * 60 * 60 * 1000, ...KNOBS });
  ok(t.expired.length === 1 && t.pending.length === 0 && t.admitted.length === 0, "an item past the decay window with no quorum expires, not admitted");
}

// 5. tick — escalate: valid resolvers disagree (the deterministic reducer can't have; drift/lie) -> the Judge.
{
  const q = ingest(await enqueue([], story, { at: now }), [await vote(story, { admitTrue: true }), await vote(story, { admitTrue: false })]);
  const t = await tick(q, { now, ...KNOBS });
  ok(t.escalated.length === 1 && t.escalated[0].forCount === 1 && t.escalated[0].againstCount === 1, "for + against among valid resolvers escalates to the Judge");
  ok(t.admitted.length === 0 && t.pending.length === 0 && t.expired.length === 0, "an escalated entry lands only in escalated");
}

// 6. tick — an operator escalate predicate can flag extra cases.
{
  const q = ingest(await enqueue([], story, { at: now }), [await vote(story)]);
  const t = await tick(q, { now, ...KNOBS, escalate: (e, tally) => tally.forCount === 1 });
  ok(t.escalated.length === 1 && t.pending.length === 0, "a custom escalate predicate routes a sub-quorum entry to the Judge");
}

// 7. toJudgmentRequest shapes an escalation as the A=B single-constitution case.
{
  const req = toJudgmentRequest(story, { id: ATLAS, constitution: "sha256:atlas-charter" });
  ok(req.constitution_a === "sha256:atlas-charter" && req.constitution_a === req.constitution_b, "escalation is A=B: both constitutions are the Atlas's own");
  ok(req.subject === "a story about my garden", "the item's text is the subject the Judge rules on");
}

// 8. DEFAULT_KNOBS are sane and present.
ok(DEFAULT_KNOBS.quorum === 2 && DEFAULT_KNOBS.recencyWindowMs > 0 && DEFAULT_KNOBS.decayWindowMs > 0, "DEFAULT_KNOBS carries quorum + recency + decay");

// 9. full cycle: enqueue -> ingest a quorum -> tick -> admitted.
{
  let q = await enqueue([], story, { at: now });
  q = ingest(q, [await vote(story), await vote(story)]);
  const t = await tick(q, { now, ...KNOBS });
  ok(t.admitted.length === 1 && t.admitted[0].item.text === "a story about my garden", "end to end: an item gathers a quorum and is admitted");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall gate-queue tests passed");
