// composer/judgment.mjs — THE OFFLINE JUDGE RUNNER: the gesture IS the workflow run.
//
// The judge (FCCN-ANTIBODY/judgement, a composite GitHub Action — `uses: FCCN-ANTIBODY/judgement@main`)
// renders one of three verdicts over a request — accept / reject / needs-judgment. It is a JUNCTION, not a
// gate: online it summons a pluggable LLM agent (Opus 4.8) to rule whether a subject, as clarified by its
// guidance, is permitted by BOTH constitutions; when it cannot, it returns `needs-judgment`, the honest
// default that ROUTES TO A HUMAN. This module is the OFFLINE emulation of that seam, where the human is the
// user's own privileged GESTURE (docs/consent-surface.md, the cracked judge).
//
// THE COMMON CONSTITUTION SEAM. The judge does not itself compare A against B — it needs the COMMON
// CONSTITUTION that shakes out of the two, and only an Antidote can compute that (antidote/docs/common-
// cause.md, the assay/meet). So `assemble` takes {constitution_a, constitution_b, subject, guidance} and
// resolves the common through an INJECTED seam, `resolveCommon(a, b)`, with three outcomes:
//   - known   — an Antidote you're registered to has this meet already (its lattice is the table of known
//               common constitutions); a `permits` entry IS a discovered clean meet. The FAST WIN — no async
//               wait — so the ruling can happen locally, now.
//   - none    — a definitive no shared floor (a `refuses`): the subject can't be permitted by both → reject.
//   - pending — nobody has computed it; lodged with an Antidote, which works on it (human-paced) and posts
//               the answer later. The judge TABLES it: `needs-judgment`, retry when the common lands.
// The default seam is the lattice fast-path (`defaultResolveCommon`); the PLURAL-Antidote progression and any
// batch cadence live INSIDE an injected seam a caller supplies (offline: a local table / an iframe-probe;
// online: the registered Antidotes tried in a stateful progression, first hit wins) — deliberately NOT in
// this core, because that strategy is still being shaped.
//
// TABLED vs RULE-NOW. Both are `needs-judgment` (the judge never invents a fourth verdict). A `pending`
// common is TABLED — deferrable ("I'll approve later") — UNLESS the exchange is `live`: a face-to-face
// handshake needs the receipt now, so it can't table (the human renders on the spot). A `known` common whose
// subject still needs a human is RULE-NOW: nothing external is pending, so it is not deferrable either.
//
// Derive everything BEFORE anyone resolves, so a human (or an agent operating the plug-in point) only RENDERS
// a decision, never re-derives the facts, and a hasty resolution stays checkable after the fact. The
// presence/enroll PREDICATES are the offline authorization layer (proven-not-disclosed, guard #16) — the
// material for the signed request envelope judgement/OPEN-QUESTIONS #1 wants.

import { attest, verifyAttestation, canonicalize } from "./sign.mjs";
import { defaultHash } from "./anecdote.mjs";
import { verifyClaim, verifyWitness, CLAIM, WITNESS } from "./presence.mjs";
import { verifyMembership } from "./enroll.mjs";
import { gatedAttest, verifyGated } from "./gesture.mjs";

export const JUDGMENT = "anecdote.judgment/v1";
export const RESOLUTION = "anecdote.judgment-resolution/v1";
export const VERDICTS = ["accept", "reject", "needs-judgment"];
const te = new TextEncoder();

// ---- the lattice fast-path — the "table of known common constitutions" ---------------------------------
// accept: identical to, or the known lattice says A permits B — a discovered common exists. reject: the
// lattice explicitly refuses (never inferred). needs-judgment: unknown — no common is known, so it must be
// lodged. (Mirrors antidote/bin/judge-constitution.mjs, in the canonical verdict words.)
export function judge({ answer, declared, lattice = {} } = {}) {
  if (!answer) return "reject";
  if (!declared) return "reject";
  if (answer === declared) return "accept";
  if ((lattice.refuses?.[answer] || []).includes(declared)) return "reject";
  if ((lattice.permits?.[answer] || []).includes(declared)) return "accept";
  return "needs-judgment";
}

// The default `resolveCommon`: read the meet from the lattice you hold (a registered Antidote's known common
// causes). known → the shared floor (identical: A itself; permits: the declared scope B). none → a refusal.
// pending → nothing known, lodge it. A caller supplies a richer seam (probe an Antidote, try many in order).
export function defaultResolveCommon(a, b, { lattice = {} } = {}) {
  const v = judge({ answer: a, declared: b, lattice });
  if (v === "accept") return { status: "known", common: a === b ? a : b, reason: a === b ? "identical constitutions" : "the lattice permits this pair" };
  if (v === "reject") return { status: "none", reason: (!a || !b) ? "a request must name both constitutions" : "the lattice refuses this pair" };
  return { status: "pending", reason: "no known common constitution — lodge with an antidote" };
}

// ---- metadata predicates — proven, not disclosed -------------------------------------------------------
// A predicate: { kind, asserts, evidence }. A verifier reports held / unseen / unmet — the whole "the judge
// might say: I'd have to SEE that" behaviour. Default verifiers wire the presence/enroll artifacts as real
// inputs; a caller may pass `verifiers` to add kinds. Each is async (verification is crypto) and pure.
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

// The stable content-id binds the DERIVED FACTS so every resolver renders on the same case; the advisory
// `opinion` and the runtime `deferrable` (which depends on `live`) are NOT bound.
async function caseId({ constitution_a, constitution_b, subject, guidance, common, commonStatus, verdict, predicates, needsToSee }) {
  const facts = {
    constitution_a, constitution_b, subject, guidance, common: common || null, commonStatus, verdict,
    predicates: (predicates || []).map((p) => ({ kind: p.kind, asserts: p.asserts, result: p.result })),
    needsToSee,
  };
  return "judgment:" + (await defaultHash(te.encode(canonicalize(facts))));
}

// Run the pure half. `request` = { constitution_a, constitution_b, subject?, guidance?, context?, predicates?[] }.
// opts.resolveCommon is the injected seam (default the lattice fast-path); opts.live marks a face-to-face
// exchange that cannot table. Returns a self-contained case record: the resolved common + its status, the
// verdict, whether it is TABLED (a pending common) and DEFERRABLE (tabled and not live), every predicate
// resolved, the unseen set, and an advisory opinion. Deterministic given the same evidence.
export async function assemble(request, { resolveCommon = defaultResolveCommon, lattice = {}, verifiers = DEFAULT_VERIFIERS, now, at, live = false } = {}) {
  const { constitution_a = "", constitution_b = "", subject = "", guidance = "", context = null } = request || {};
  const common = await resolveCommon(constitution_a, constitution_b, { lattice, now });

  const predicates = [];
  for (const p of request?.predicates || []) {
    const fn = verifiers[p.kind];
    const r = fn ? await fn(p.asserts || {}, p.evidence, { now }) : { result: "unseen", detail: `no verifier for kind '${p.kind}'` };
    predicates.push({ kind: p.kind, asserts: p.asserts || {}, result: r.result, detail: r.detail, by: r.by ?? null });
  }
  const needsToSee = predicates.filter((p) => p.result === "unseen").map((p) => ({ kind: p.kind, asserts: p.asserts, detail: p.detail }));
  const unmet = predicates.filter((p) => p.result === "unmet");

  // Verdict, driven by the common's status and then the local ruling. A pending common TABLES the case; a
  // definitive `none` rejects; a known common still needs a human when the authorization is unseen or a
  // subject must be ruled (offline there is no agent to rule it) — and lands accept only when nothing is left.
  const reasons = [];
  let verdict, tabled = false;
  if (common.status === "none") { verdict = "reject"; reasons.push(common.reason || "no shared common constitution"); }
  else if (common.status === "pending") { verdict = "needs-judgment"; tabled = true; reasons.push(common.reason || "common constitution pending — lodged, retry later"); }
  else {                                                 // known
    if (unmet.length) { verdict = "reject"; unmet.forEach((p) => reasons.push(`predicate unmet: ${p.detail}`)); }
    else if (needsToSee.length) { verdict = "needs-judgment"; needsToSee.forEach((p) => reasons.push(`must see: ${p.detail}`)); }
    else if (subject) { verdict = "needs-judgment"; reasons.push("common known; the subject must be ruled by the agent (online) or the human (offline)"); }
    else { verdict = "accept"; reasons.push("common known; every predicate held; no subject left to rule"); }
  }
  const deferrable = tabled && !live;                    // only a pending common, and only when not live, may table
  const leans = verdict;                                 // the opinion mirrors the derived verdict; never a ruling

  const base = { constitution_a, constitution_b, subject, guidance, context,
                 common: common.status === "known" ? (common.common ?? null) : null, commonStatus: common.status,
                 verdict, tabled, predicates, needsToSee };
  const id = await caseId(base);
  return { schema: JUDGMENT, id, ...base, deferrable, opinion: { leans, reasons }, at: at || new Date().toISOString() };
}

// A case is DECISIVE on its own only when the verdict is accept or reject; needs-judgment (tabled or rule-now)
// summons a human.
export function needsHuman(caseRecord) {
  if (!caseRecord) return true;
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
// the trigger on THIS case" is cryptographic. This is the compressed PR-open+PR-close; online a PR merge
// makes the same RESOLUTION record. Pass `defer: true` to TABLE it for later (the "I'll approve later"
// option) — allowed ONLY when the case is `deferrable` (a pending common, not a live exchange); deferring on
// a rule-now or live case throws, because the receipt is needed now. `gate` is injectable (default the real
// gesture). Returns { signed, gesture }.
export async function resolveByGesture(caseRecord, { decision, reason = "", defer = false } = {}, identity, cred, { gate = gatedAttest, ...deps } = {}) {
  if (!caseRecord || caseRecord.schema !== JUDGMENT) throw new Error("judgment: resolve needs a case record");
  let decided = decision;
  if (defer) {
    if (!caseRecord.deferrable) throw new Error("judgment: this case cannot be deferred — the receipt is needed now (live or rule-now)");
    decided = "needs-judgment";                          // deferring parks it as needs-judgment
  }
  if (!VERDICTS.includes(decided)) throw new Error("judgment: decision must be accept | reject | needs-judgment");
  const obj = { schema: RESOLUTION, case: caseRecord.id, decision: decided, reason, deferred: !!defer, auto: false, at: deps.at || new Date().toISOString() };
  return gate(obj, identity, cred, deps);   // gatedAttest -> { signed, gesture }; the signature carries the presence
}

// Verify a resolution end to end: it names a case, carries a real decision, its Ed25519 attestation holds,
// and — unless it is an `auto` resolution — its embedded gesture is a genuine user-verified assertion over
// these exact bytes (verifyGated). Returns { ok, by, case, decision, deferred, gated, errors }.
export async function verifyResolution(resolution, { spki, alg, rpId, origin } = {}) {
  if (!resolution || resolution.schema !== RESOLUTION) return { ok: false, by: null, case: null, decision: null, deferred: false, gated: false, errors: ["not a resolution"] };
  if (!VERDICTS.includes(resolution.decision)) return { ok: false, by: null, case: resolution.case, decision: resolution.decision, deferred: !!resolution.deferred, gated: false, errors: ["bad decision"] };
  if (resolution.auto) {
    const v = await verifyAttestation(resolution, {});
    return { ok: v.ok, by: v.by, case: resolution.case, decision: resolution.decision, deferred: false, gated: false, errors: v.errors };
  }
  const g = await verifyGated(resolution, { spki, alg, rpId, origin });
  return { ok: g.ok, by: g.by, case: resolution.case, decision: resolution.decision, deferred: !!resolution.deferred, gated: true, errors: g.errors };
}
