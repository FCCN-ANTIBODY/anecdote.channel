// Unit: composer/describe-op.mjs — the self-description half of the bottle grammar: `describe` vends the
// pre-crunched, dated descriptor snapshot; a mis-wired bottle fails loudly at boot; empty is observable
// (a zero-count descriptor is a well-formed statement, not an absence). Run: node composer/describe-op.test.mjs
import { describeOps, isDescriptor, DESCRIBE } from "./describe-op.mjs";
import { elevatedSession } from "./probe-line.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const EMPTY = { schema: DESCRIBE, as_of: "2026-07-24T00:00:00Z", kind: "data-pile", questions: [], counts: { questions: 0, sealed_blocks: 0 } };
const FULL = { schema: DESCRIBE, as_of: "2026-07-25T00:00:00Z", kind: "data-pile",
               questions: [{ poll: "north-meadow", text: "What should the north meadow become?" }],
               filters: [{ type: "anecdote", lead: "any account of flooding on the east bank" }],
               counts: { questions: 1, sealed_blocks: 41 } };

// 1. shape gate: schema + as_of required, everything else emergent.
ok(isDescriptor(EMPTY) && isDescriptor(FULL), "a dated descriptor is well-formed, empty or full");
ok(!isDescriptor(null) && !isDescriptor({ schema: DESCRIBE }) && !isDescriptor({ as_of: "now" }),
   "no snapshot date or wrong schema → not a descriptor");

// 2. mis-wiring fails loudly at boot, like install-op.
{ let threw = false; try { describeOps({}); } catch { threw = true; } ok(threw, "a bottle claiming a descriptor must hold a well-formed one"); }

// 3. the op emits the whole snapshot, Rung 0, over a real session.
{
  const frames = [];
  const s = elevatedSession({ ops: describeOps({ descriptor: FULL }), emit: (f) => frames.push(f),
                              yield_: () => Promise.resolve(), context: () => ({ recordingOn: true, grants: [] }) });
  await s.handle({ type: "probe.line.request/v1", id: "d1", op: "describe" });
  const data = frames.find((f) => f.schema === DESCRIBE);
  ok(!!data && data.as_of === FULL.as_of && data.questions.length === 1, "describe emits the snapshot with no consent needed (Rung 0)");
  ok(data.filters[0].type === "anecdote", "emergent content rides untouched — the descriptor's content IS the taxonomy");
  ok(frames.some((f) => f.final === true), "…and the stream terminates");
}

// 4. empty is observable: the zero-count snapshot serves exactly like a full one.
{
  const frames = [];
  const s = elevatedSession({ ops: describeOps({ descriptor: EMPTY }), emit: (f) => frames.push(f),
                              yield_: () => Promise.resolve(), context: () => ({ recordingOn: true, grants: [] }) });
  await s.handle({ type: "probe.line.request/v1", id: "d2", op: "describe" });
  const data = frames.find((f) => f.schema === DESCRIBE);
  ok(!!data && data.counts.questions === 0 && data.counts.sealed_blocks === 0,
     "a freshly provisioned bottle says 'nothing here yet, as of <date>' — a statement, not an absence");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nok: describe-op — the bottle puts forward what it is for, as dated static bytes");
