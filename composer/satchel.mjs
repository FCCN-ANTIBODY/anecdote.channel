// composer/satchel.mjs — WHAT YOU CARRY FOR OTHERS: the ballot mesh's per-person hold
// (docs/ballot-mesh.md). When two people meet — keys signing, the labeler rolling, met-records
// landing (met.mjs, gesture.mjs) — they also exchange their carried ballots. Offered EVERYTHING,
// a carrier keeps by their own declared shape:
//
//   * PINS — the labels you chose to be a conduit for (reducer vocabulary; your slang is your
//     business and your filter). Pinned ballots are your active carry: kept without cap.
//   * THE PASSIVE BUFFER — everything else keeps only "the last N per label" (default 100), a
//     solicitable stash that goes stale and MUST be prunable. Bland traffic never forces itself
//     into your pocket; it just waits to be useful.
//   * THE SCREEN — an optional predicate seam where the offline label-reducer stands in for a
//     constitution check (route.mjs's posture): after mesh passing nobody knows whose constitution
//     checked what, so the carrier's own reducer may quietly drop what is in-category but carries
//     what they won't. Sync predicate, caller-supplied; v1 has no opinion about its inside.
//
// Every candidate is VERIFIED before it is kept (verify-from-anyone; trust stays the friend-list's
// question), deduped by content id (the same ballot from many hands converges), and never mutated.
// Pure functions over plain arrays — persistence, transport (transfer.mjs / carrier.mjs), and
// gesture-gating all compose at the caller. `arrived()` marks the hold-for-turn-in partition:
// a ballot inside the constituency it was trying to reach should be TURNED IN, not re-broadcast.

import { verifyBallot, ballotId, isBallot } from "./ballot.mjs";
import { quells } from "./quell.mjs";

export const DEFAULT_CAP = 100;

const ts = (e) => Date.parse(e.ballot.ts) || 0;

// Verify + screen + dedup candidates into satchel entries. Returns { satchel, added, dropped } —
// dropped is diagnostic ({ id?, why }), never silently discarded counts.
export async function addBallots(satchel, candidates, { screen, opts } = {}) {
  const have = new Set(satchel.map((e) => e.id));
  const out = satchel.slice();
  const added = [], dropped = [];
  for (const b of candidates || []) {
    if (!isBallot(b)) { dropped.push({ why: "not a ballot" }); continue; }
    const id = await ballotId(b);
    if (have.has(id)) { dropped.push({ id, why: "already carried" }); continue; }
    const v = await verifyBallot(b, opts);
    if (!v.ok) { dropped.push({ id, why: "does not verify: " + v.errors.join("; ") }); continue; }
    if (screen && !screen(b)) { dropped.push({ id, why: "screened" }); continue; }
    const entry = { id, ballot: b, labels: b.labels || [], by: v.by };
    have.add(id);
    out.push(entry);
    added.push(entry);
  }
  return { satchel: out, added, dropped };
}

// What you bring to a meet, in two tiers — THE ECONOMY. Pinning a label means you HYPERBROADCAST
// it: `push` is the first stuff on the wire when you scan with someone, newest first, so a
// truncated session still moved what you champion. The slush is `available` — kept, solicitable,
// filling in if they ask — but you are not pushing it. (What you refuse never entered: the screen.)
export function exchangeOffer(satchel, { pins = [] } = {}) {
  const push = [], available = [];
  for (const e of satchel) (isPinned(e, pins) ? push : available).push(e);
  const newest = (a, b) => ts(b) - ts(a);
  return { push: push.sort(newest).map((e) => e.ballot), available: available.sort(newest).map((e) => e.ballot) };
}

// The pull half of the economy: a requester asks the slush by label ("anyone carrying parks?").
export function solicit(satchel, labels) {
  const want = new Set(labels || []);
  return satchel.filter((e) => e.labels.some((l) => want.has(l))).sort((a, b) => ts(b) - ts(a)).map((e) => e.ballot);
}

export function isPinned(entry, pins) {
  const p = new Set(pins || []);
  return entry.labels.some((l) => p.has(l));
}

// Enforce the carrier's shape: pinned entries ride uncapped; everything else keeps the newest
// `cap` per label (an unlabeled ballot buffers under "" — carried, but only as passive traffic)
// and drops entirely once staler than `staleAfterMs` (pass Infinity to keep forever). Prune runs
// after every take and whenever the user says so.
export function pruneSatchel(satchel, { pins = [], cap = DEFAULT_CAP, now, staleAfterMs = Infinity } = {}) {
  const keep = new Set();
  const buffers = new Map(); // label -> entries, newest first
  for (const e of satchel) {
    if (isPinned(e, pins)) { keep.add(e.id); continue; }
    if (now !== undefined && staleAfterMs !== Infinity && now - ts(e) > staleAfterMs) continue;
    for (const l of e.labels.length ? e.labels : [""]) {
      if (!buffers.has(l)) buffers.set(l, []);
      buffers.get(l).push(e);
    }
  }
  for (const list of buffers.values()) {
    list.sort((a, b) => ts(b) - ts(a));
    for (const e of list.slice(0, cap)) keep.add(e.id);
  }
  return satchel.filter((e) => keep.has(e.id));
}

// One meet, receiver side: take everything offered, keep your shape. Returns the pruned satchel
// plus the add diagnostics.
export async function takeOffered(satchel, offered, { pins, cap, now, staleAfterMs, screen, opts } = {}) {
  const r = await addBallots(satchel, offered, { screen, opts });
  return { satchel: pruneSatchel(r.satchel, { pins, cap, now, staleAfterMs }), added: r.added, dropped: r.dropped };
}

// TERMINAL quells retire what they name: one packet replaces N dead ballots in this pocket
// (the caller decides which quells are terminal — isAuthorQuell with the poll's known kid;
// HOST quells never reach here, they only close one door's routing). The quells themselves
// keep riding the same labels so the retirement spreads.
export function applyQuells(satchel, terminalQuells) {
  const dead = (e) => (terminalQuells || []).some((q) => quells(q, e.ballot));
  return { satchel: satchel.filter((e) => !dead(e)), pruned: satchel.filter(dead) };
}

// A ballot that has REACHED the constituency it was addressed to should be turned in, not
// re-broadcast (turnInSubmission -> the poll's canonical issue, or dumped into any reachable Atlas
// that routes it — the Kevin Bacon hop ends here). Partition the satchel against where you are.
export function arrived(satchel, myScopes) {
  const here = new Set(myScopes || []);
  const turnIn = [], carryOn = [];
  for (const e of satchel) (e.ballot.scope && here.has(e.ballot.scope) ? turnIn : carryOn).push(e);
  return { turnIn, carryOn };
}
