// composer/gate-queue.mjs — the ATLAS-OPERATOR half of the gate: the pending queue, DECAY (the traffic-jam
// bound), and the tunable knobs. gate.mjs is the constituent's side (the reducer verdict + the signed,
// proof-carrying resolution + the quorum fold); this is the side the Atlas holds and ticks.
//
// NO JUDGE HERE, by design. The Atlas CONSTITUTION is "I judge none of them — that reading belongs to an
// intelligent being DOWNSTREAM, under a pile's own constitution, not to me." The gate is the deterministic,
// pinned LABEL-REDUCER (perception), not the summoned LLM (that is Antidote's tempo, the permanent record).
// So there is no escalation to a judge: because the reducer is deterministic, a minority against-vote (drift
// or a lie) never blocks an honest for-quorum, and a false for-vote cannot reach quorum without Sybil-costly
// collusion. Genuine disputes are settled by re-running the PINNED reducer or by eviction (a public floor,
// "expecting shrapnel") — never by an LLM.
//
// The queue is a bag of entries — { id, item, resolutions[], firstSeen } — one per item seeking entry.
// `enqueue` admits an item to the QUEUE (not to the Atlas — just "now waiting"); `ingest` attaches incoming
// resolutions to their item, one per resolver (a resolver's newer resolution replaces their older). `tick`
// is the periodic process the Atlas runs, sorting every entry into exactly one of:
//   - admitted   — a quorum of distinct, valid, in-boundary, recent constituents agreed it may enter. The
//                  tally carries forCount/againstCount so an operator can spot-audit an admit that drew dissent.
//   - expired    — it sat past the DECAY window without reaching quorum. This is the jam bound: a flood with
//                  no constituents to resolve it drains here, never admitted (an un-renewed lease, in effect).
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

// Sort every entry into admitted / expired / pending, using gate.admit for the quorum fold. There is no
// escalation and no judge: an honest for-quorum admits (a minority against never blocks it), everything else
// waits or decays. A dispute (an against-vote against a for-quorum) is left visible in the admitted tally for
// an operator's deterministic spot-audit or eviction — never routed to an LLM. Returns { pending, admitted,
// expired }.
export async function tick(queue = [], { now, ...knobs } = {}) {
  const k = { ...DEFAULT_KNOBS, ...knobs };
  if (now == null) throw new Error("gate-queue: tick needs `now`");
  const pending = [], admitted = [], expired = [];
  for (const e of queue) {
    const tally = await admit(e.item, e.resolutions, { now, ...k });
    if (tally.admitted) { admitted.push({ item: e.item, id: e.id, ...tally }); continue; }
    const age = Date.parse(now) - Date.parse(e.firstSeen);
    if (k.decayWindowMs != null && Number.isFinite(age) && age > k.decayWindowMs) { expired.push({ item: e.item, id: e.id, ageMs: age }); continue; }
    pending.push(e);
  }
  return { pending, admitted, expired };
}
