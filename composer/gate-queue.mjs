// composer/gate-queue.mjs — the ATLAS-OPERATOR half of the gate: the pending queue, DECAY (the traffic-jam
// bound), the tunable knobs, and escalation to the summoned Judge. gate.mjs is the constituent's side (the
// reducer verdict + the signed, proof-carrying resolution + the quorum fold); this is the side the Atlas
// holds and ticks.
//
// The queue is a bag of entries — { id, item, resolutions[], firstSeen } — one per item seeking entry.
// `enqueue` admits an item to the QUEUE (not to the Atlas — just "now waiting"); `ingest` attaches incoming
// resolutions to their item, one per resolver (a resolver's newer resolution replaces their older). `tick`
// is the periodic process the Atlas runs, sorting every entry into exactly one of:
//   - admitted   — a quorum of distinct, valid, in-boundary, recent constituents agreed it may enter.
//   - expired    — it sat past the DECAY window without reaching quorum. This is the jam bound: a flood with
//                  no constituents to resolve it drains here, never admitted (an un-renewed lease, in effect).
//   - escalated  — valid resolvers DISAGREED (the reducer is deterministic, so disagreement means drift or a
//                  lie). Perception could not settle it, so it goes to the summoned Judge — the reducer-first,
//                  judge-when-it-cannot two-tier. `toJudgmentRequest` shapes the escalation for judgment.mjs.
//   - pending    — still gathering votes, still inside the decay window.
//
// The knobs are the Atlas operator's dial: `quorum` (how many bodies admit), `recencyWindowMs` (how fresh a
// resolver's presence must be — "in-jurisdiction within 4 hours" vs "within 200 days"), `decayWindowMs` (how
// long an item may wait before it drains). The client-side counterpart knob — `N`, how many pending items a
// device resolves per submission — lives in the submission flow (gate.mjs's domain), not here.
//
// Pure and deterministic given `now`. The atlas.anecdote.channel bin/workflow that PERSISTS the queue file,
// runs `tick` on a schedule, and emits admissions is the thin transport — noted next, not in this core.

import { admit, itemId, GATE_RESOLUTION } from "./gate.mjs";

export const DEFAULT_KNOBS = { quorum: 2, recencyWindowMs: 4 * 60 * 60 * 1000, decayWindowMs: 7 * 24 * 60 * 60 * 1000 };

// ---- queue maintenance (pure) --------------------------------------------------------------------------

// Add an item to the pending queue. Idempotent by item id (a re-lodge of the same target+kind+text does not
// duplicate the entry). `firstSeen` starts the decay clock; pass `at` for determinism.
export async function enqueue(queue = [], item, { at } = {}) {
  const id = await itemId(item);
  if (queue.some((e) => e.id === id)) return queue;
  return [...queue, { id, item, resolutions: [], firstSeen: at || new Date().toISOString() }];
}

// Attach incoming resolutions to their entries, one per resolver (newest wins — a resolver may only weigh a
// given item once, so the queue can't be padded by re-sending). Resolutions for items not in the queue are
// dropped. Pure; verification happens later, in `tick`.
export function ingest(queue = [], resolutions = []) {
  const byId = new Map(queue.map((e) => [e.id, { ...e, resolutions: e.resolutions.slice() }]));
  for (const r of resolutions) {
    if (!r || r.schema !== GATE_RESOLUTION) continue;
    const e = byId.get(r.item);
    if (!e) continue;                                          // no such pending item
    const by = r.sig?.by || null;
    const keep = e.resolutions.filter((x) => (x.sig?.by || null) !== by);
    keep.push(r);
    e.resolutions = keep;
  }
  return [...byId.values()];
}

// ---- the tick — the Atlas's periodic gate pass ---------------------------------------------------------

// Sort every entry into admitted / expired / escalated / pending, using gate.admit for the quorum fold.
// `escalate` is an optional operator predicate (entry, tally) => boolean for extra escalation policy;
// disagreement always escalates. Returns { pending, admitted, expired, escalated }.
export async function tick(queue = [], { now, escalate, ...knobs } = {}) {
  const k = { ...DEFAULT_KNOBS, ...knobs };
  if (now == null) throw new Error("gate-queue: tick needs `now`");
  const pending = [], admitted = [], expired = [], escalated = [];
  for (const e of queue) {
    const tally = await admit(e.item, e.resolutions, { now, ...k });
    if (tally.admitted) { admitted.push({ item: e.item, id: e.id, ...tally }); continue; }
    const disagree = tally.forCount > 0 && tally.againstCount > 0;
    if (disagree || (escalate && escalate(e, tally))) {
      escalated.push({ item: e.item, id: e.id, reason: disagree ? "resolver disagreement (drift or a lie) — the Judge settles it" : "flagged for escalation", forCount: tally.forCount, againstCount: tally.againstCount });
      continue;
    }
    const age = Date.parse(now) - Date.parse(e.firstSeen);
    if (k.decayWindowMs != null && Number.isFinite(age) && age > k.decayWindowMs) { expired.push({ item: e.item, id: e.id, ageMs: age }); continue; }
    pending.push(e);
  }
  return { pending, admitted, expired, escalated };
}

// ---- the bridge to the summoned Judge ------------------------------------------------------------------

// Shape an escalated item as a judgment request (judgment.mjs / the judgement Action). "Will this Atlas
// carry this?" is a single-constitution question, so it is the A=B case: both constitutions are the Atlas's
// own; the subject is the item's text; guidance is the item's own narrowing if it carries one.
export function toJudgmentRequest(item, atlas = {}) {
  if (!atlas.constitution) throw new Error("gate-queue: the Atlas must name its constitution to escalate");
  return {
    constitution_a: atlas.constitution,
    constitution_b: atlas.constitution,
    subject: item.text || "",
    guidance: item.guidance || "",
    context: { caller: atlas.id || "atlas", intake: "gate-escalation", item_id: item.text ? undefined : null },
  };
}
