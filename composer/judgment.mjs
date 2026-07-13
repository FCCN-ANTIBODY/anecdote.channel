// composer/judgment.mjs — THE OFFLINE JUDGE RUNNER: the gesture IS the workflow run.
//
// The judge (FCCN-ANTIBODY/judgement, a composite GitHub Action — `uses: FCCN-ANTIBODY/judgement@main`)
// renders one of three verdicts over a request — accept / reject / needs-judgment. It is a JUNCTION, not a
// gate: online it summons a pluggable LLM agent (judgement/bin/judge-agent, Claude Opus 4.8) to decide
// whether a subject, as clarified by its guidance, is permitted by BOTH constitutions; when no agent is
// available (no credentials, rate-limited, out of budget, off, or unsure) it returns `needs-judgment`, the
// honest default that ROUTES TO A HUMAN — always technically possible.
//
// This module is the OFFLINE emulation of that same seam. Offline there is no agent and no API key, so we
// ARE the no-agent branch: a cheap lattice fast-path decides the pairs that need no intelligence
// (identical / known-permitted / known-refused), and everything else is `needs-judgment` → the human. And
// offline the human is the user's own privileged GESTURE (docs/consent-surface.md, the cracked judge — "you
// are the judge of your own stuff"). "Filing a judgment to summon the judge" is the slow-motion incantation;
// the gesture is the compressed PR-open + PR-close of the online consent-gate, in a single signed act.
//
// The shape has three moves, and the order is load-bearing (derive everything BEFORE anyone resolves, so a
// human — or an agent operating the plug-in point — only RENDERS a decision, never re-derives the facts;
// and a hasty resolution stays checkable after the fact):
//   1. assemble(manifest) — PURE. Runs the fast-path verdict, verifies each metadata PREDICATE
//      (proven-not-disclosed, guard #16) into held / unseen / unmet, and files a self-contained case record.
//   2. needsHuman(case)   — a known-lattice accept/reject with nothing unseen is decisive on its own
//      (autoResolution). A `needs-judgment`, or anything the manifest could not let it SEE, holds for a human.
//   3. resolveByGesture(…) — the offline run: a gesture-signed resolution whose signature CONTAINS
//      proof-of-presence for that exact case (gesture.mjs). Online this is a PR merge instead; same record.
//
// It NEVER accepts on its own for a novel pair — doubt never resolves toward accept; it becomes
// `needs-judgment` and waits for the human (judgement/CONSTITUTION.md; guard #9). The predicate layer here
// is an offline EXTENSION over the canonical {A, B, subject, guidance} contract — the material for a signed
// authorization envelope (judgement/OPEN-QUESTIONS.md #1), not part of the core verdict.

import { attest, verifyAttestation, canonicalize } from "./sign.mjs";
import { defaultHash } from "./anecdote.mjs";
import { verifyClaim, verifyWitness, CLAIM, WITNESS } from "./presence.mjs";
import { verifyMembership } from "./enroll.mjs";
import { gatedAttest, verifyGated } from "./gesture.mjs";

export const JUDGMENT = "anecdote.judgment/v1";
export const RESOLUTION = "anecdote.judgment-resolution/v1";
export const VERDICTS = ["accept", "reject", "needs-judgment"];
const te = new TextEncoder();

// ---- the fast-path verdict — the no-agent branch of judgement/bin/judge --------------------------------
// accept: the arrival's constitution is identical to, or the known lattice says it permits, the DECLARED
// scope. reject: the lattice explicitly says incompatible (never inferred). needs-judgment: anything the
// lattice doesn't already know — offline there is no agent to weigh it, so it WAITS for the human (guard #9,
// the judge never accepts a novel pair on its own). Online, judgement's LLM agent renders the same three
// verdicts over the full {A, B, subject, guidance}; this is the cheap subset a lattice can settle with no
// agent. (Mirrors antidote/bin/judge-constitution.mjs, mapped to the canonical verdict words.)
export function judge({ answer, declared, lattice = {} } = {}) {
  if (!answer) return "reject";
  if (!declared) return "reject";
  if (answer === declared) return "accept";
  if ((lattice.refuses?.[answer] || []).includes(declared)) return "reject";
  if ((lattice.permits?.[answer] || []).includes(declared)) return "accept";
  return "needs-judgment";
}

// ---- metadata predicates — proven, not disclosed -------------------------------------------------------
// A manifest predicate: { kind, asserts, evidence }. A verifier reports one of three results, which is the
// whole "the judge might say: I'd have to SEE that" behaviour:
//   held   — the evidence verifies and satisfies the assertion.
//   unseen — no evidence, or it doesn't verify: the judge can't see it → the case HOLDS on this.
//   unmet  — evidence verifies but CONTRADICTS the assertion → the opinion leans reject.
// Default verifiers wire the presence/enroll artifacts (a bisect-witness, a membership) as real inputs; a
// caller may pass `verifiers` to add kinds. Each is async (verification is crypto) and pure.
export const DEFAULT_VERIFIERS = {
  // asserts: { constituency }; evidence: a presence CLAIM or WITNESS record.
  async presence(asserts, evidence, _opts) {
    if (!evidence || typeof evidence !== "object") return { result: "unseen", detail: "no presence evidence" };
    let by = null, constituency = null;
    if (evidence.schema === WITNESS) {
      const v = await verifyWitness(evidence, {});
      if (!v.ok) return { result: "unseen", detail: "witness did not verify: " + v.errors.join("; ") };
      by = v.claimant; constituency = v.constituency;
    } else if (evidence.schema === CLAIM) {
      const v = await verifyClaim(evidence);
      if (!v.ok) return { result: "unseen", detail: "claim did not verify: " + v.errors.join("; ") };
      by = v.by; constituency = v.constituency;
    } else return { result: "unseen", detail: "evidence is neither a claim nor a witness" };
    if (asserts?.constituency && constituency !== asserts.constituency)
      return { result: "unmet", detail: `evidence places ${constituency}, asserts ${asserts.constituency}`, by };
    return { result: "held", detail: `present in ${constituency}`, by, witnessed: evidence.schema === WITNESS };
  },
  // asserts: { atlas, constituency }; evidence: a membership record. Freshness judged at `opts.now`.
  async membership(asserts, evidence, opts) {
    const v = await verifyMembership(evidence, { now: opts?.now });
    if (!v.ok) return { result: "unseen", detail: "membership did not verify: " + (v.errors || []).join("; ") };
    if (asserts?.atlas && v.atlas !== asserts.atlas) return { result: "unmet", detail: `membership in atlas ${v.atlas}, asserts ${asserts.atlas}` };
    if (asserts?.constituency && v.constituency !== asserts.constituency) return { result: "unmet", detail: `membership in ${v.constituency}, asserts ${asserts.constituency}` };
    if (!v.fresh) return { result: "unseen", detail: "membership is stale — a fresh one must be shown", by: v.member };
    return { result: "held", detail: `member of ${v.constituency}`, by: v.member };
  },
};

// ---- assemble the case record — derive everything, resolve nothing -------------------------------------

// The stable content-id binds the DERIVED FACTS (parents, verdict, meet, each predicate's assertion+result,
// what stayed unseen) so every resolver renders on the same case. The advisory `opinion` is NOT bound — it
// can be re-computed or improved without changing which case this is.
async function caseId({ parents, verdict, meet, predicates, needsToSee }) {
  const facts = {
    parents, verdict, meet: meet || null,
    predicates: (predicates || []).map((p) => ({ kind: p.kind, asserts: p.asserts, result: p.result })),
    needsToSee,
  };
  return "judgment:" + (await defaultHash(te.encode(canonicalize(facts))));
}

// Run the pure half. `manifest` = { parents: { answer, declared }, meet?, predicates?[] }. Returns a
// self-contained case record: the verdict, every predicate resolved to held/unseen/unmet, the unseen set
// (why it would hold), and an advisory opinion that NEVER leans accept for a novel pair. Deterministic.
export async function assemble(manifest, { lattice = {}, verifiers = DEFAULT_VERIFIERS, now, at } = {}) {
  const parents = manifest?.parents || {};
  const verdict = judge({ answer: parents.answer, declared: parents.declared, lattice });

  const predicates = [];
  for (const p of manifest?.predicates || []) {
    const fn = verifiers[p.kind];
    const r = fn ? await fn(p.asserts || {}, p.evidence, { now }) : { result: "unseen", detail: `no verifier for kind '${p.kind}'` };
    predicates.push({ kind: p.kind, asserts: p.asserts || {}, result: r.result, detail: r.detail, by: r.by ?? null });
  }
  const needsToSee = predicates.filter((p) => p.result === "unseen").map((p) => ({ kind: p.kind, asserts: p.asserts, detail: p.detail }));
  const unmet = predicates.filter((p) => p.result === "unmet");

  // The advisory opinion: leans by the derived facts, never a ruling. A lattice accept with all predicates
  // held leans accept; any contradicted predicate leans reject; an unseen predicate or a needs-judgment
  // verdict means the honest lean is needs-judgment — a human must see the rest.
  const reasons = [];
  let leans;
  if (unmet.length) { leans = "reject"; unmet.forEach((p) => reasons.push(`predicate unmet: ${p.detail}`)); }
  else if (verdict === "reject") { leans = "reject"; reasons.push("the lattice refuses this pair"); }
  else if (verdict === "needs-judgment") { leans = "needs-judgment"; reasons.push("novel pair — no agent offline; a human must weigh it"); }
  else if (needsToSee.length) { leans = "needs-judgment"; needsToSee.forEach((p) => reasons.push(`must see: ${p.detail}`)); }
  else { leans = "accept"; reasons.push("known-lattice accept, every predicate held"); }

  const base = { parents, verdict, meet: manifest?.meet || null, predicates, needsToSee };
  const id = await caseId(base);
  return { schema: JUDGMENT, id, ...base, opinion: { leans, reasons }, at: at || new Date().toISOString() };
}

// A case is DECISIVE on its own only when the lattice already knew it (accept/reject) AND nothing was left
// unseen. Everything else — a needs-judgment, or a held-but-incomplete manifest — summons a human.
export function needsHuman(caseRecord) {
  if (!caseRecord) return true;
  if (caseRecord.needsToSee && caseRecord.needsToSee.length) return true;
  return caseRecord.verdict === "needs-judgment";
}

// For a decisive case, the resolution is the derived verdict itself — no gesture, like an Action that passes
// on a known-lattice hit. Returns null when a human is actually needed (call resolveByGesture instead).
export function autoResolution(caseRecord) {
  if (needsHuman(caseRecord)) return null;
  return { schema: RESOLUTION, case: caseRecord.id, decision: caseRecord.verdict, reason: "decisive: " + caseRecord.opinion.reasons.join("; "), auto: true, at: caseRecord.at };
}

// ---- resolve by gesture — the offline workflow "run" ---------------------------------------------------

// The offline run: a human renders `decision` ∈ accept | reject | needs-judgment, and the privileged gesture
// SIGNS it, folding proof-of-presence into the bytes (gesture.mjs `gatedAttest`) — so "a human really pulled
// the trigger on THIS case" is cryptographic, not a boolean a swapped queen could fake. This is the
// compressed PR-open+PR-close; online, a PR merge produces the same RESOLUTION record instead. (A human may
// also land on needs-judgment — parking it, deciding later.) `gate` is injectable (default the real gesture)
// so a headless caller can supply its own signer. Returns { signed, gesture }.
export async function resolveByGesture(caseRecord, { decision, reason = "" } = {}, identity, cred, { gate = gatedAttest, ...deps } = {}) {
  if (!caseRecord || caseRecord.schema !== JUDGMENT) throw new Error("judgment: resolve needs a case record");
  if (!VERDICTS.includes(decision)) throw new Error("judgment: decision must be accept | reject | needs-judgment");
  const obj = { schema: RESOLUTION, case: caseRecord.id, decision, reason, auto: false, at: deps.at || new Date().toISOString() };
  return gate(obj, identity, cred, deps);   // gatedAttest -> { signed, gesture }; the signature carries the presence
}

// Verify a resolution end to end: it names a case, carries a real decision, its Ed25519 attestation holds,
// and — unless it is an `auto` resolution — its embedded gesture is a genuine user-verified assertion over
// these exact bytes (verifyGated). An auto resolution needs no gesture (the lattice decided). Returns
// { ok, by, case, decision, gated, errors }.
export async function verifyResolution(resolution, { spki, alg, rpId, origin } = {}) {
  if (!resolution || resolution.schema !== RESOLUTION) return { ok: false, by: null, case: null, decision: null, gated: false, errors: ["not a resolution"] };
  if (!VERDICTS.includes(resolution.decision)) return { ok: false, by: null, case: resolution.case, decision: resolution.decision, gated: false, errors: ["bad decision"] };
  if (resolution.auto) {
    const v = await verifyAttestation(resolution, {});
    return { ok: v.ok, by: v.by, case: resolution.case, decision: resolution.decision, gated: false, errors: v.errors };
  }
  const g = await verifyGated(resolution, { spki, alg, rpId, origin });
  return { ok: g.ok, by: g.by, case: resolution.case, decision: resolution.decision, gated: true, errors: g.errors };
}
