// composer/presence.mjs — the WITNESS primitive for presence-as-constituency (docs/presence.md). A person
// proves "I am a constituent of this place, right now" with two weak signals converging in one signed
// moment: their own bisect (on-device placement — the boundary layer, arriving next) and a WITNESS — a
// body next to them who scans their claim and countersigns what they saw. The witness's countersignature
// carries the WITNESS'S OWN placement, so a witnessed claim is two independent placements of the same
// place at the same moment. No infrastructure holds a location secret: a witness with their own proven
// location IS the in-place mint — it synthesizes to a QR you can only make in location, because the only
// ingredient is someone already there.
//
// Every witnessing is TWO proofs. The claimant walks away with a countersigned claim; the witness's own
// signature — embedding a claim they could only have scanned within camera range — is presence evidence
// for THEM. presenceEvidence() reads a single record from both sides.
//
// Witnesses grade like everything else (MINE / FRIEND / ANONYMOUS — accept.mjs); an anonymous witness is
// still a body demonstrably co-present. A single record proves little; the JUDGE (later) weighs a history
// of on-demand convergences. This module only makes the artifacts — small enough that a signed claim rides
// ONE QR tile (asserted in the test with the real encoder/decoder), pure enough to run anywhere.

import { attest, verifyAttestation } from "./sign.mjs";

export const CLAIM = "anecdote.presence/v1";
export const WITNESS = "anecdote.witness/v1";

const iso = (t) => t || new Date().toISOString();
const rand = () => { const u = new Uint8Array(12); crypto.getRandomValues(u); return [...u].map((b) => b.toString(16).padStart(2, "0")).join(""); };

// A presence claim: "my bisect places me in `constituency`, now." `bisect` records HOW the placement was
// made ({ method: "bisect", boundary: <id/hash of the boundary file> } once the boundary layer lands;
// { method: "asserted" } until then — honesty about the weaker basis is part of the artifact). The nonce
// is a fresh unlinkable handle: two claims don't link to each other unless their holder wants them to.
export async function makeClaim({ constituency, bisect, at, nonce } = {}, identity) {
  if (!constituency || typeof constituency !== "string") throw new Error("presence: a claim names a constituency");
  return attest({
    schema: CLAIM,
    constituency,
    bisect: { method: (bisect && bisect.method) || "asserted", boundary: (bisect && bisect.boundary) || null },
    at: iso(at),
    nonce: nonce || rand(),
  }, identity);
}

export async function verifyClaim(claim) {
  if (!claim || claim.schema !== CLAIM) return { ok: false, by: null, constituency: null, at: null, errors: ["not a presence claim"] };
  const v = await verifyAttestation(claim, {});
  if (!v.ok) return { ok: false, by: v.by, constituency: null, at: null, errors: v.errors };
  if (typeof claim.constituency !== "string" || !claim.constituency) return { ok: false, by: v.by, constituency: null, at: null, errors: ["claim names no constituency"] };
  return { ok: true, by: v.by, constituency: claim.constituency, at: claim.at, errors: [] };
}

// Countersign a presented claim. The witness verifies it FIRST (you don't witness garbage), then signs
// what they saw — the claim VERBATIM (byte-preserved inside the record) plus their OWN placement at that
// moment. The witness attests to the ENCOUNTER — this was physically shown to me, here, now — never to
// the claimant's virtue.
export async function witnessClaim(claim, { bisect, at } = {}, witnessIdentity) {
  const v = await verifyClaim(claim);
  if (!v.ok) throw new Error("presence: refusing to witness an invalid claim: " + v.errors.join("; "));
  return attest({
    schema: WITNESS,
    claim,                                             // verbatim — the witness signs exactly what was shown
    witnessBisect: { method: (bisect && bisect.method) || "asserted", boundary: (bisect && bisect.boundary) || null,
                     constituency: (bisect && bisect.constituency) || null },
    at: iso(at),
  }, witnessIdentity);
}

// Verify a witness record end to end: the witness's signature, then the embedded claim's. Reports the
// CONVERGENCE — `copresent`: the witness's own placement names the claim's constituency; `fresh`: the two
// moments fall inside `windowMs` (default 10 minutes). Neither failing makes the record invalid — a
// witness elsewhere/later is still a true encounter — they make it weaker, and the report says so.
export async function verifyWitness(record, { friends = [], windowMs = 10 * 60 * 1000 } = {}) {
  if (!record || record.schema !== WITNESS) return { ok: false, errors: ["not a witness record"] };
  const w = await verifyAttestation(record, {});
  if (!w.ok) return { ok: false, errors: ["witness signature: " + w.errors.join("; ")] };
  const c = await verifyClaim(record.claim);
  if (!c.ok) return { ok: false, errors: ["embedded claim: " + c.errors.join("; ")] };
  if (w.by === c.by) return { ok: false, errors: ["self-witnessed — a witness is a second body"] };
  const dt = Math.abs(new Date(record.at) - new Date(record.claim.at));
  return {
    ok: true,
    witness: w.by, witnessTrusted: friends.includes(w.by),
    claimant: c.by, constituency: c.constituency,
    copresent: record.witnessBisect?.constituency === c.constituency,
    fresh: Number.isFinite(dt) && dt <= windowMs,
    errors: [],
  };
}

// One record, two proofs — the both-directions reading. For the CLAIMANT: their placement, countersigned
// by a co-present body. For the WITNESS: their signature embeds a claim they could only have scanned
// within camera range — presence evidence of their own, in whatever place THEIR bisect named.
export async function presenceEvidence(record, opts = {}) {
  const v = await verifyWitness(record, opts);
  if (!v.ok) return { ok: false, evidence: [], errors: v.errors };
  return {
    ok: true, errors: [],
    evidence: [
      { who: v.claimant, role: "claimant", constituency: v.constituency, at: record.claim.at,
        basis: "claimed + countersigned by a co-present body", copresent: v.copresent, fresh: v.fresh },
      { who: v.witness, role: "witness", constituency: record.witnessBisect?.constituency || null, at: record.at,
        basis: "witnessed — signed a claim only scannable within camera range", copresent: v.copresent, fresh: v.fresh },
    ],
  };
}

// ---- probe-line capabilities ---------------------------------------------------------------------------
// Both Rung 1 (signing is a knowing act: one claim / one witnessing, one confirm; no persistence here —
// KEEPING a record is carrier.accept's job, with its own gate). Identity stays Elevated; the chamber sees
// only the artifacts.
export function presenceOps({ identity } = {}) {
  return {
    "presence.claim": async (input, api) => { api.emit({ claim: await makeClaim(input || {}, identity) }); },
    "presence.witness": async (input, api) => {
      const record = await witnessClaim((input || {}).claim, (input || {}).observer || {}, identity);
      api.emit({ record, evidence: (await presenceEvidence(record)).evidence });
    },
  };
}
