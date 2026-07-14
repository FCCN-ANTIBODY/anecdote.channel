// composer/judgment-request.mjs — THE AUTHORIZATION ENVELOPE: proving a judgement request is legitimate.
//
// The judge (FCCN-ANTIBODY/judgement) renders a verdict for whoever invokes it, but it does not establish
// WHO may summon it or HOW a request proves it is authorized — judgement/OPEN-QUESTIONS #1, "the single
// largest deferral," whose sketch is "a request envelope the caller signs, checked against a per-parent
// allowlist before the agent is summoned." This is that envelope, and its proof currency is the work the rest
// of this arc already built: your PRESENCE and MEMBERSHIP attestations. Are-you-here + do-you-belong become
// the credential that makes is-this-permitted trustworthy.
//
// The shape:
//   - The asker LODGES a request — {constitution_a, constitution_b, subject, guidance, context} — and signs
//     the envelope with their own identity (provenance: WHO is asking). They attach PROOFS: presence claims /
//     witness records / membership records that establish their standing.
//   - `establish` verifies the envelope signature, then verifies each proof AND checks it is BOUND to the
//     asker (the proof's claimant/member is the envelope's signer) — so a request can only carry standing the
//     asker actually holds, never a proof lifted from someone else. Bound + valid proofs become FACTS.
//   - `verifyRequest` applies a POLICY over those facts: does the asker's established standing satisfy what
//     this board requires to be asked? The per-parent allowlist lives in the policy the CALLER supplies
//     (`allowlistPolicy`), never in this core — a parent authorizes the requests it pays for.
//
// This is orthogonal to judgment.mjs's predicates (which weigh a SUBJECT's metadata against the common
// constitution): the envelope gates "may you ASK at all," the predicate gates "does the answer's metadata
// satisfy the constitution." Same proof primitives, different question. The runner composes them: verify the
// envelope is authorized, then pass request → assemble for the verdict.
//
// Pure and offline-first: the asker signs with their device Ed25519 (plain attest, like enroll requests);
// gesture-gating the lodge is an available hardening, not required — the standing lives in the proofs.

import { attest, verifyAttestation } from "./sign.mjs";
import { verifyClaim, verifyWitness, CLAIM, WITNESS } from "./presence.mjs";
import { verifyMembership, MEMBERSHIP } from "./enroll.mjs";

export const REQUEST = "anecdote.judgment-request/v1";

// ---- lodge: build + sign the envelope, as the asker -----------------------------------------------------

// Assemble the unsigned envelope. The request names both constitutions (the pair whose common is judged);
// subject/guidance/context are optional; proofs is the asker's standing evidence (raw attestations).
export function buildRequest({ constitution_a, constitution_b, subject = "", guidance = "", context = null, proofs = [] } = {}) {
  if (!constitution_a || typeof constitution_a !== "string") throw new Error("judgment-request: names constitution_a");
  if (!constitution_b || typeof constitution_b !== "string") throw new Error("judgment-request: names constitution_b");
  if (!Array.isArray(proofs)) throw new Error("judgment-request: proofs is an array of attestations");
  return { schema: REQUEST, request: { constitution_a, constitution_b, subject, guidance, context }, proofs };
}

// Build + sign in one step, as the asker. The signature is the "who is asking"; the proofs are the "why they
// may." The proofs MUST be the asker's own — enforced at establish (the binding check).
export async function lodge(fields, identity) {
  return attest(buildRequest(fields), identity);
}

// ---- establish: verify the envelope + bind each proof to the asker -------------------------------------

// Read one proof into a fact, or explain why not. A proof is BOUND when its subject (the presence claimant /
// the membership member) is the envelope's signer. Unbound or unverifiable proofs never become facts.
async function readProof(proof, asker, { friends = [], now } = {}) {
  if (!proof || typeof proof !== "object") return { fact: null, reason: "not an attestation" };
  if (proof.schema === WITNESS) {
    const v = await verifyWitness(proof, { friends });
    if (!v.ok) return { fact: null, reason: "witness did not verify: " + v.errors.join("; ") };
    if (v.claimant !== asker) return { fact: null, reason: `presence places ${v.claimant}, not the asker`, unbound: true };
    return { fact: { kind: "presence", constituency: v.constituency, witnessed: true, copresent: v.copresent, fresh: v.fresh, witnessTrusted: v.witnessTrusted } };
  }
  if (proof.schema === CLAIM) {
    const v = await verifyClaim(proof);
    if (!v.ok) return { fact: null, reason: "claim did not verify: " + v.errors.join("; ") };
    if (v.by !== asker) return { fact: null, reason: `presence places ${v.by}, not the asker`, unbound: true };
    return { fact: { kind: "presence", constituency: v.constituency, witnessed: false } };
  }
  if (proof.schema === MEMBERSHIP) {
    const v = await verifyMembership(proof, { now });
    if (!v.ok) return { fact: null, reason: "membership did not verify: " + (v.errors || []).join("; ") };
    if (v.member !== asker) return { fact: null, reason: `membership belongs to ${v.member}, not the asker`, unbound: true };
    return { fact: { kind: "membership", atlas: v.atlas, constituency: v.constituency, fresh: v.fresh } };
  }
  return { fact: null, reason: "unknown proof kind" };
}

// Verify the envelope and establish the asker's standing. Returns { ok, asker, facts, unbound, invalid,
// errors }. `facts` are bound + valid; `unbound` are real proofs that name someone else (a lifted proof);
// `invalid` are proofs that didn't verify.
export async function establish(envelope, { friends = [], now } = {}) {
  if (!envelope || envelope.schema !== REQUEST) return { ok: false, asker: null, facts: [], unbound: [], invalid: [], errors: ["not a judgment request"] };
  const v = await verifyAttestation(envelope, {});
  if (!v.ok) return { ok: false, asker: v.by, facts: [], unbound: [], invalid: [], errors: ["envelope signature: " + v.errors.join("; ")] };
  const asker = v.by;
  const facts = [], unbound = [], invalid = [];
  for (const proof of envelope.proofs || []) {
    const r = await readProof(proof, asker, { friends, now });
    if (r.fact) facts.push(r.fact);
    else if (r.unbound) unbound.push({ reason: r.reason });
    else invalid.push({ reason: r.reason });
  }
  return { ok: true, asker, facts, unbound, invalid, errors: [] };
}

// ---- policy: does the established standing authorize this request? --------------------------------------

// The lowest bar: a valid signature and nothing more (any signer may ask). Explicit, so "open" is a choice.
export const REQUIRE_SIGNED = () => ({ ok: true, reasons: [] });

// A requirement over facts: the asker must have proven presence in a constituency and/or fresh membership.
// Returns a policy fn (request, facts, asker) => { ok, reasons }.
export function requires({ presence = null, membership = null, witnessed = false } = {}) {
  return (_request, facts) => {
    const reasons = [];
    if (presence) {
      const p = facts.find((f) => f.kind === "presence" && f.constituency === presence);
      if (!p) reasons.push(`must prove presence in ${presence}`);
      else if (witnessed && !p.witnessed) reasons.push(`presence in ${presence} must be witnessed (a second body)`);
    }
    if (membership) {
      const m = facts.find((f) => f.kind === "membership" && f.atlas === membership.atlas && f.constituency === membership.constituency);
      if (!m) reasons.push(`must prove membership in ${membership.atlas}/${membership.constituency}`);
      else if (!m.fresh) reasons.push(`membership in ${membership.atlas}/${membership.constituency} must be fresh`);
    }
    return { ok: reasons.length === 0, reasons };
  };
}

// The per-parent allowlist: `allowlist` maps a board key (default the request's constitution_b) to a
// requirement spec. A board with no entry is NOT on the allowlist — the request is refused, never
// open-by-omission (the parent must name what it authorizes). The plural/keying strategy stays here, in the
// caller-supplied policy, out of the core.
export function allowlistPolicy(allowlist = {}, { keyOf = (r) => r.constitution_b } = {}) {
  return (request, facts, asker) => {
    const key = keyOf(request);
    const spec = allowlist[key];
    if (!spec) return { ok: false, reasons: [`board ${key} is not on the allowlist — no authorization policy`] };
    return requires(spec)(request, facts, asker);
  };
}

// THE CHECK. Establish the asker's standing, then apply the policy. `authorized` means: valid envelope, and
// the asker's bound proofs satisfy what this board requires to be asked. Returns { ok, asker, authorized,
// facts, reasons, request, errors }. ok reflects a well-formed, verified envelope; authorized reflects the
// policy verdict on top of it.
export async function verifyRequest(envelope, { policy = REQUIRE_SIGNED, friends = [], now } = {}) {
  const e = await establish(envelope, { friends, now });
  if (!e.ok) return { ok: false, asker: e.asker, authorized: false, facts: [], reasons: e.errors, request: null, errors: e.errors };
  const p = policy(envelope.request, e.facts, e.asker);
  return { ok: true, asker: e.asker, authorized: p.ok, facts: e.facts, reasons: p.reasons || [], request: envelope.request, errors: [] };
}
