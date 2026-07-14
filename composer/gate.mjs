// composer/gate.mjs — THE ATLAS GATE: distributed, proof-of-work admission for a PUBLIC space.
//
// Atlas is mutable and evictable, so its threshold does not need the summoned LLM Judge (that is
// Antidote's tempo — a permanent record that must be right). The gate uses the cheaper organ: the
// LABEL-REDUCER, documented as "the deliberate counterpart to the Judge" — it asks *what is this*
// (amoral, no constitution of its own), and collision with the Atlas's OWN constitution (the topics
// it excludes) is the admission verdict (composer/route.mjs `verdict`). No agent, no key, deterministic.
//
// The novelty is WHO runs it. An Atlas holds a QUEUE of items seeking entry (needs / poll-ads /
// anecdotes — all one shape: "will this Atlas carry this?"). Constituents clear the queue as automatic
// PROOF-OF-WORK folded into their own submission gesture: when you post, your device's reducer resolves
// N pending items. The work is real (community benefit) but attention-free — you are not reading them,
// your reducer classifies them — which is what dodges the participation-gate death spiral ("review 5 to
// post 1 → lose interest"). Both submitting and resolving require a CONSTITUENCY + RECENCY proof (a
// witnessed presence claim / a fresh membership — presence.mjs / enroll.mjs), so only real, recent,
// in-boundary bodies roll gate work. The Atlas admits an item on a QUORUM of such attestations.
//
// The load property that makes it hold: **to flood the gate you must process everyone else's traffic.**
// Resolving is the price of submitting, and the reducer's proof-of-work is USEFUL work — the faster a
// spammer floods, the faster they clear the legit backlog they are creating. Coercion turned into
// contribution, with no opt-out. Errors are evictable (public floor, not a permanent record), so the
// gate is tuned for throughput + Sybil-cost, not perfection.
//
// This is the client-side core (pure, offline): the item, the reducer verdict, the signed resolution
// carrying its constituency+recency proof, and the quorum fold. The reducer is INJECTED (default route.intentOf)
// so this stays model-free and testable. The Atlas-side queue store + decay + the N/recency/quorum knobs
// are the operator's, noted as next steps.

import { attest, verifyAttestation, canonicalize } from "./sign.mjs";
import { defaultHash } from "./anecdote.mjs";
import { verifyClaim, verifyWitness, CLAIM, WITNESS } from "./presence.mjs";
import { verifyMembership, MEMBERSHIP } from "./enroll.mjs";
import { intentOf, verdict as routeVerdict } from "./route.mjs";

export const GATE_ITEM = "anecdote.gate-item/v1";
export const GATE_RESOLUTION = "anecdote.gate-resolution/v1";
const te = new TextEncoder();

// ---- an item seeking entry ------------------------------------------------------------------------------

// The submitter signs what they want carried: the target Atlas, the kind, and the text the reducer reads.
// (The submit-side constituency+recency proof — you must be in-boundary to post — mirrors the resolve side;
// carried as `proof` and verified the same way, left to the caller's submit flow in this first slice.)
export function buildItem({ target, kind = "anecdote", text, at } = {}) {
  if (!target || typeof target !== "string") throw new Error("gate: an item names its target Atlas");
  if (!text || typeof text !== "string") throw new Error("gate: an item carries the text the reducer reads");
  return { schema: GATE_ITEM, target, kind, text, at: at || new Date().toISOString() };
}
export async function lodgeItem(fields, identity) { return attest(buildItem(fields), identity); }

// A stable id over the entry-relevant facts (not the signature), so every resolver clears the same item.
export async function itemId(item) {
  return "gate-item:" + (await defaultHash(te.encode(canonicalize({ target: item.target, kind: item.kind, text: item.text }))));
}

// ---- the primitive verdict — the reducer at the threshold ----------------------------------------------

// What the reducer decides: reduce the item's text to its intent, collide it with the Atlas's excluded
// topics. `dest` = { kind:"atlas", excludes:[...] } (the Atlas's constitution shorthand). `reduce` is
// injected (default route.intentOf) so this is model-free under test. Deterministic — same text + same
// excludes → same verdict, which is why an audit is always possible.
export function gateVerdict(item, dest, { reduce = intentOf } = {}) {
  const intent = reduce(item.text || "");
  const v = routeVerdict(intent, { kind: "atlas", excludes: dest.excludes || [] });
  return { admit: v.eligible, topic: v.topic, reason: v.reason, label: intent.label };
}

// ---- resolve one item — the gesture-signed unit of proof-of-work ---------------------------------------

// A constituent's device runs gateVerdict and signs the result, binding their CONSTITUENCY + RECENCY proof
// (a witnessed presence claim or a fresh membership). The resolver's Ed25519 signature is "I did this work";
// the proof — itself witnessed by another body — carries "I am in this Atlas's boundary, recently," and is
// what the Atlas verifies for a quorum. (On-device, the whole batch of resolutions rides one platform
// gesture; that human-present check is device-side, so the Atlas need not hold every constituent's passkey
// — the witnessed presence proof is the Sybil-resistance it checks.) `sign` is injectable (default attest).
export async function resolveItem(item, dest, resolverIdentity, { proof, reduce = intentOf, sign = attest, at } = {}) {
  if (!item || item.schema !== GATE_ITEM) throw new Error("gate: resolve needs a gate item");
  if (!proof) throw new Error("gate: a resolution carries the resolver's constituency+recency proof");
  const v = gateVerdict(item, dest, { reduce });
  const obj = { schema: GATE_RESOLUTION, item: await itemId(item), target: item.target,
                admit: v.admit, topic: v.topic ?? null, reason: v.reason, proof, at: at || new Date().toISOString() };
  return sign(obj, resolverIdentity);
}

// ---- verify one resolution — bound, fresh, in-boundary --------------------------------------------------

// Read the resolver's proof into a standing fact, bound to the resolver (the presence claimant / membership
// member IS the resolution's signer). Returns { constituency, at } or null with a reason.
async function readProof(proof, resolver, { friends = [], now } = {}) {
  if (!proof || typeof proof !== "object") return { fact: null, reason: "no proof" };
  if (proof.schema === WITNESS) {
    const v = await verifyWitness(proof, { friends });
    if (!v.ok) return { fact: null, reason: "witness did not verify" };
    if (v.claimant !== resolver) return { fact: null, reason: "presence is not the resolver's" };
    return { fact: { constituency: v.constituency, at: proof.claim?.at ?? null, witnessed: true } };
  }
  if (proof.schema === CLAIM) {
    const v = await verifyClaim(proof);
    if (!v.ok) return { fact: null, reason: "claim did not verify" };
    if (v.by !== resolver) return { fact: null, reason: "presence is not the resolver's" };
    return { fact: { constituency: v.constituency, at: v.at, witnessed: false } };
  }
  if (proof.schema === MEMBERSHIP) {
    const v = await verifyMembership(proof, { now });
    if (!v.ok) return { fact: null, reason: "membership did not verify" };
    if (v.member !== resolver) return { fact: null, reason: "membership is not the resolver's" };
    return { fact: { constituency: v.constituency, at: proof.at ?? null, membership: true } };
  }
  return { fact: null, reason: "unknown proof kind" };
}

// Validate a resolution end to end: the gesture-signed attestation holds, its proof is BOUND to the
// resolver, the resolver is IN the Atlas's boundary (proof constituency = the Atlas's), and the proof is
// RECENT (within the Atlas's recency window). Returns { ok, resolver, admit, item, constituency, ageMs, errors }.
export async function verifyResolution(resolution, { atlasConstituency, recencyWindowMs, now, friends = [] } = {}) {
  if (!resolution || resolution.schema !== GATE_RESOLUTION) return { ok: false, resolver: null, admit: null, item: null, errors: ["not a gate resolution"] };
  const a = await verifyAttestation(resolution, {});
  if (!a.ok) return { ok: false, resolver: a.by, admit: null, item: resolution.item, errors: ["resolution signature: " + a.errors.join("; ")] };
  const resolver = a.by;
  const p = await readProof(resolution.proof, resolver, { friends, now });
  if (!p.fact) return { ok: false, resolver, admit: null, item: resolution.item, errors: ["proof: " + p.reason] };
  const errors = [];
  if (atlasConstituency && p.fact.constituency !== atlasConstituency) errors.push(`resolver is in ${p.fact.constituency}, not the Atlas's ${atlasConstituency}`);
  let ageMs = null;
  if (recencyWindowMs != null && now != null && p.fact.at != null) {
    ageMs = Date.parse(now) - Date.parse(p.fact.at);
    if (!(Number.isFinite(ageMs) && ageMs <= recencyWindowMs)) errors.push("resolver's presence is not recent enough for this Atlas");
  }
  return { ok: errors.length === 0, resolver, admit: resolution.admit === true, item: resolution.item, constituency: p.fact.constituency, ageMs, errors };
}

// ---- the fold — quorum of valid, distinct, in-boundary constituents ------------------------------------

// Admit an item on a QUORUM of valid resolutions that AGREE it may enter. Counts DISTINCT resolvers (one
// body, one vote) who each cleared the standing bar (bound + in-boundary + recent) and attested admit=true.
// A lone bad resolver, or resolvers outside the boundary / stale, never reach quorum. Because the verdict
// is deterministic, honest resolvers agree; disagreement is a signal to audit (gateVerdict recomputes it).
// Returns { admitted, forCount, againstCount, voters, invalid }.
export async function admit(item, resolutions, { quorum = 2, ...opts } = {}) {
  const id = await itemId(item);
  const forVoters = new Set(), against = new Set(), invalid = [];
  for (const r of resolutions || []) {
    if (r?.item !== id) { invalid.push({ reason: "resolution is for a different item" }); continue; }
    const v = await verifyResolution(r, opts);
    if (!v.ok) { invalid.push({ resolver: v.resolver, reason: v.errors.join("; ") }); continue; }
    (v.admit ? forVoters : against).add(v.resolver);
  }
  return { admitted: forVoters.size >= quorum, forCount: forVoters.size, againstCount: against.size, voters: [...forVoters], invalid };
}
