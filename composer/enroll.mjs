// composer/enroll.mjs — PRESENCE-GATED MEMBERSHIP: the blast-radius lever (docs/place-seal.md, "Membership
// cost"). Confidentiality against members is only as strong as membership is expensive. Today an age
// recipient is just a public key — anyone added is in, so the key is de-facto public and one rogue joiner's
// blast radius is the whole constituency. This makes joining COST A BODY IN THE SHAPE.
//
// The move, all from primitives already here:
//   1. A would-be member proves presence in the constituency — ideally WITNESSED (presence.mjs: a co-present
//      body countersigns), so it costs a second person, not a spoofable self-GPS.
//   2. They BIND their age recipient to that proof in a signed enroll request. The binding is enforced at
//      verify: the request must be signed by the SAME identity that the presence proof places in the shape —
//      so a recipient can only be enrolled by the person who actually stood there.
//   3. The atlas grants a MEMBERSHIP that DECAYS (the lease.mjs idiom: a dated, signed "still a member as of
//      `at`, window W"). Non-renewal is the revoke — to drop a member the atlas simply stops re-signing, and
//      the membership goes stale on its face. Renewal costs another fresh presence proof.
//
// The payoff is `freshRecipients`: the seal recipient list (age-seal.encrypt / place-seal.toSnapshot) is now
// exactly the currently-fresh members — presence-gated and self-expiring. No server, no new credential; the
// atlas signs with its own anecdote identity, the member with theirs, the witness with theirs.
//
// Two complementary gates, not one: this gates the RECIPIENT SET (who may hold atlas snapshots/dumps);
// place-seal's beacon gates LIVE (who may open the live frame, right now, in-place). Enrollment is the
// standing "you belong here"; the beacon is the momentary "you are here."

import { attest, verifyAttestation, canonicalize } from "./sign.mjs";
import { defaultHash } from "./anecdote.mjs";
import { parseRecipient } from "./age-mint.mjs";
import { verifyClaim, verifyWitness, CLAIM, WITNESS } from "./presence.mjs";

export const ENROLL = "anecdote.enroll-request/v1";
export const MEMBERSHIP = "anecdote.membership/v1";
export const DEFAULT_MEMBERSHIP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;   // 30 days — a policy default, override freely

// The strictest, cheapest-to-state policy: a witnessed, co-present, internally-fresh proof. "Costs a body in
// the shape." An atlas loosens this deliberately (a one-body claim for a low-stakes constituency), never by
// accident — the default is the demanding one.
export const STRICT_POLICY = { requireWitness: true, requireCopresent: true, requireFresh: true };

const te = new TextEncoder();

// ---- read a presence artifact (either a bare claim or a witnessed record) -------------------------------
// Normalizes presence.mjs's two shapes to one report: WHO it places (`claimant`), WHERE (`constituency`),
// WHEN (`at`), and the quality signals a policy reads (`witnessed`, `copresent`, `fresh`). `copresent`/`fresh`
// are null for a bare claim — it carries no second body to converge with.
async function readPresence(presence, { friends = [], windowMs } = {}) {
  if (!presence || typeof presence !== "object") return { ok: false, errors: ["no presence proof"] };
  if (presence.schema === WITNESS) {
    const v = await verifyWitness(presence, { friends, ...(windowMs ? { windowMs } : {}) });
    if (!v.ok) return { ok: false, errors: ["witness: " + v.errors.join("; ")] };
    return { ok: true, claimant: v.claimant, constituency: v.constituency, at: presence.claim?.at ?? null,
             witnessed: true, witness: v.witness, witnessTrusted: v.witnessTrusted, copresent: v.copresent, fresh: v.fresh, errors: [] };
  }
  if (presence.schema === CLAIM) {
    const v = await verifyClaim(presence);
    if (!v.ok) return { ok: false, errors: ["claim: " + v.errors.join("; ")] };
    return { ok: true, claimant: v.by, constituency: v.constituency, at: v.at,
             witnessed: false, witness: null, witnessTrusted: false, copresent: null, fresh: null, errors: [] };
  }
  return { ok: false, errors: ["presence is neither a claim nor a witness record"] };
}

// ---- the member side: bind your recipient to your proof -------------------------------------------------

// Assemble the unsigned request. `recipient` is validated as a real age recipient here so a request can never
// name an unsealable-to key. `presence` is your own claim/witness for `constituency`.
export function buildEnrollRequest({ atlas, constituency, recipient, presence } = {}) {
  if (!atlas || typeof atlas !== "string") throw new Error("enroll: a request names an atlas");
  if (!constituency || typeof constituency !== "string") throw new Error("enroll: a request names a constituency");
  parseRecipient(recipient);                             // throws on a non-recipient — fail early
  if (!presence) throw new Error("enroll: a request carries a presence proof");
  return { schema: ENROLL, atlas, constituency, recipient, presence };
}

// Build + sign in one step, as the member. The signing identity MUST be the one your presence proof places in
// the shape (enforced at verify) — you are binding THIS recipient to the body that stood there.
export async function enroll({ atlas, constituency, recipient, presence } = {}, identity) {
  return attest(buildEnrollRequest({ atlas, constituency, recipient, presence }), identity);
}

// ---- the atlas side: verify the binding, then judge it against policy ------------------------------------

// Verify a request end to end. ok means: the request is validly signed, the recipient is real, the presence
// proof verifies, the SIGNER IS THE PROVEN-PRESENT PERSON (the core binding), and the constituency lines up
// (with the atlas's own, if given). ok is NOT a policy pass — it means "true and bound"; `meetsPolicy` is the
// threshold. `presenceWindowMs` (with `now`) optionally rejects a stale proof being replayed to enroll.
export async function verifyEnrollRequest(request, { atlasConstituency = null, friends = [], now, presenceWindowMs, witnessWindowMs } = {}) {
  const errors = [];
  if (!request || request.schema !== ENROLL) return { ok: false, member: null, recipient: null, constituency: null, grade: null, errors: ["not an enroll request"] };
  const v = await verifyAttestation(request, {});
  if (!v.ok) return { ok: false, member: v.by, recipient: null, constituency: request.constituency ?? null, grade: null, errors: ["request signature: " + v.errors.join("; ")] };
  const member = v.by;

  try { parseRecipient(request.recipient); } catch (e) { errors.push("recipient: " + e.message); }

  const p = await readPresence(request.presence, { friends, windowMs: witnessWindowMs });
  if (!p.ok) return { ok: false, member, recipient: request.recipient, constituency: request.constituency ?? null, grade: null, errors: [...errors, ...p.errors] };

  // THE BINDING: the recipient is only enrolled by the body that proved presence.
  if (p.claimant !== member) errors.push(`presence proof places ${p.claimant}, not the enroller ${member}`);
  // The constituency must agree across request, proof, and (if pinned) the atlas.
  if (request.constituency !== p.constituency) errors.push(`request names ${request.constituency}, proof names ${p.constituency}`);
  if (atlasConstituency && request.constituency !== atlasConstituency) errors.push(`this atlas enrolls for ${atlasConstituency}, not ${request.constituency}`);
  // Optional replay guard: a proof older than presenceWindowMs is not fresh enough to enroll on.
  if (presenceWindowMs != null && now != null && p.at != null) {
    const age = Date.parse(now) - Date.parse(p.at);
    if (Number.isFinite(age) && age > presenceWindowMs) errors.push("presence proof is stale (older than the enroll window)");
  }

  const grade = { witnessed: p.witnessed, copresent: p.copresent, fresh: p.fresh, witnessTrusted: p.witnessTrusted };
  return { ok: errors.length === 0, member, recipient: request.recipient, constituency: request.constituency, grade, errors };
}

// The judge's enrollment-time face: does a verified request clear the bar? Pure threshold over the grade.
// Defaults to STRICT (witnessed + co-present + internally-fresh). Returns { ok, reasons }.
export function meetsPolicy(verified, policy = STRICT_POLICY) {
  if (!verified || !verified.ok) return { ok: false, reasons: ["request did not verify"] };
  const g = verified.grade || {};
  const reasons = [];
  if (policy.requireWitness && !g.witnessed) reasons.push("policy requires a witnessed proof (a second body)");
  if (policy.requireCopresent && !g.copresent) reasons.push("policy requires the witness to be co-present in the constituency");
  if (policy.requireFresh && g.witnessed && !g.fresh) reasons.push("policy requires the claim and witnessing to converge in time");
  if (policy.requireTrustedWitness && !g.witnessTrusted) reasons.push("policy requires an enrolled (trusted) witness");
  return { ok: reasons.length === 0, reasons };
}

// ---- the membership grant (lease-shaped decay) ----------------------------------------------------------

// A stable content-id for a membership tuple, so the same {atlas, constituency, recipient, member} always
// names the same membership (renewals supersede by date).
export async function membershipId({ atlas, constituency, recipient, member }) {
  return "membership:" + (await defaultHash(te.encode(canonicalize({ atlas, constituency, recipient, member }))));
}

// The atlas MINTS a membership: a self-describing, atlas-signed record that DECAYS. Verify-from-anyone (the
// tuple is legible, not an opaque subject hash), lease-shaped (`at` + `window`), revoke-by-silence (stop
// re-signing and it goes stale). `at`/`window` injectable for determinism and policy.
export async function mintMembership({ atlas, constituency, recipient, member }, atlasIdentity, { at, window = DEFAULT_MEMBERSHIP_WINDOW_MS } = {}) {
  if (!atlas || !constituency || !recipient || !member) throw new Error("enroll: a membership names atlas, constituency, recipient, member");
  parseRecipient(recipient);
  if (!(Number.isFinite(window) && window > 0)) throw new Error("enroll: membership window must be positive ms");
  const id = await membershipId({ atlas, constituency, recipient, member });
  return attest({ schema: MEMBERSHIP, id, atlas, constituency, recipient, member, at: at || new Date().toISOString(), window }, atlasIdentity);
}

// Verify a membership: shape + the atlas signature (verify-from-anyone; pass `atlasKey` to REQUIRE a pinned
// atlas) + the id binds the tuple + freshness at `now`. Window precedence: opts.window > record.window. A
// future-dated record (clock skew) counts as fresh. Returns { ok, by, atlas, constituency, recipient, member,
// fresh, ageMs, windowed, errors }.
export async function verifyMembership(record, { atlasKey = null, now, window } = {}) {
  if (!record || record.schema !== MEMBERSHIP) return { ok: false, by: null, fresh: false, ageMs: null, windowed: false, errors: ["not a membership"] };
  const v = await verifyAttestation(record, {});
  if (!v.ok) return { ok: false, by: v.by, fresh: false, ageMs: null, windowed: false, errors: ["membership signature: " + v.errors.join("; ")] };
  if (atlasKey && v.by !== atlasKey) return { ok: false, by: v.by, fresh: false, ageMs: null, windowed: false, errors: ["membership signer is not the pinned atlas key"] };
  const wantId = await membershipId(record);
  if (record.id !== wantId) return { ok: false, by: v.by, fresh: false, ageMs: null, windowed: false, errors: ["membership id does not bind its tuple"] };
  const w = window ?? record.window ?? Infinity;
  let fresh = true, ageMs = null;
  if (now != null) { ageMs = Date.parse(now) - Date.parse(record.at); fresh = ageMs <= w; }
  return { ok: true, by: v.by, atlas: record.atlas, constituency: record.constituency, recipient: record.recipient, member: record.member, fresh, ageMs, windowed: Number.isFinite(w), errors: [] };
}

// ---- the payoff: the presence-gated, self-expiring seal recipient list ----------------------------------

// From a bag of membership records, the recipients whose membership is VALID and FRESH right now — the exact
// set to hand age-seal.encrypt / place-seal.toSnapshot. Optionally pinned to an atlas key and/or filtered to
// one constituency. Deduped (a renewed member appears once). Pure over verification; the store is the caller's.
export async function freshRecipients(memberships, { atlasKey = null, now, window, constituency = null } = {}) {
  if (now == null) throw new Error("enroll: freshRecipients needs `now` to judge freshness");
  const out = new Set();
  for (const m of memberships || []) {
    const v = await verifyMembership(m, { atlasKey, now, window });
    if (!v.ok || !v.fresh) continue;
    if (constituency && v.constituency !== constituency) continue;
    out.add(v.recipient);
  }
  return [...out];
}
