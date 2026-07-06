// composer/atlaspoll.mjs — THE ATLAS-FRONTED POLL: a poll an Atlas re-signs to FRONT, so its answers
// become public under a license and can be turned in / held on ANY Atlas in the lineage, not only the
// one that fronted it (docs/ballot-mesh.md "The Atlas door"; civic-node #87). Counterpart to
// composer/ballot.mjs: the ballot is what a PERSON signs; this is what an ATLAS signs to say "answer
// this here, publicly, under these terms" — and it carries exactly what a stand-in custodian needs if
// the origin vanishes.
//
// Carries, and why:
//   pile, poll     — the original poll it fronts. A ballot answered against it uses the same
//                    coordinates, so any Atlas correlates a received ballot to this by (pile,poll).
//   instigator     — the original poll author's fingerprint (QR provenance). This is the authorKid a
//                    drop door needs to recognize a TERMINAL author quell — so fronting a poll
//                    UN-DORMANTS the quell-back shrug that shipped inert in the drop door (#86 Slice 2).
//   age_recipient  — the poll OWNER's public age recipient (age1...). REQUIRED-FOR-CUSTODY: a stand-in
//                    ballot-box pile (#86 Slice 3) can only be sealed to a recipient the provisioner
//                    never holds; data-pile forbids a provisioner touching the identity, and the owner
//                    is exactly who's unreachable — so it must ride HERE. Absent it, the drop door
//                    degrades to archive-only. It is a public encryption TARGET, safe to travel:
//                    carrying it keeps "an Atlas holds no key that opens a pile" true.
//   license        — the terms the public data is under (public, not open-source; use-governed —
//                    NONPROFIT/ANTIDOTE). Rides so provenance carries terms.
//   fronts         — the fronting Atlas's id (who re-signed). Provenance, not authority.
//   stores_public  — true: answering this stores publicly (the pivot recorded on #86).
//
// Trust is transfer.mjs's ok/trusted split one tier up: `ok` = the fronting signature verifies (from
// ANYONE); `trusted` = the fronting signer is in YOUR lineage (the Atlases you accept). That is how a
// peer derives trust from a ballot addressed to the NETWORK rather than to any one Atlas. The lineage
// is the caller's; this module ships no global registry.

import { attest, verifyAttestation, canonicalize } from "./sign.mjs";
import { defaultHash } from "./anecdote.mjs";
import { buildBallot, signBallot } from "./ballot.mjs";

export const ATLASPOLL_SCHEMA = "anecdote.atlaspoll/v1";
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const AGE_RECIPIENT = /^age1[0-9a-z]+$/; // an age X25519 PUBLIC recipient — a target, never a key that opens

// Assemble the unsigned fronted poll. pile/poll/fronts required; everything else rides if present.
export function buildAtlasPoll({ pile, poll, instigator, age_recipient, license, fronts, scope, stores_public = true } = {}) {
  if (!pile || !SLUG.test(pile)) throw new Error("atlaspoll: pile slug required");
  if (!poll || !SLUG.test(poll)) throw new Error("atlaspoll: poll slug required");
  if (!fronts) throw new Error("atlaspoll: fronts (the fronting Atlas id) required");
  if (age_recipient && !AGE_RECIPIENT.test(age_recipient))
    throw new Error("atlaspoll: age_recipient must be an age1... public recipient");
  const p = { schema: ATLASPOLL_SCHEMA, pile, poll, fronts, stores_public: !!stores_public };
  if (instigator) p.instigator = instigator;
  if (age_recipient) p.age_recipient = age_recipient;
  if (license) p.license = license;
  if (scope) p.scope = scope;
  return p;
}

// Sign as the FRONTING Atlas — the re-signature that makes it a fronted poll.
export async function signAtlasPoll(fronted, identity, opts = {}) {
  if (fronted.schema !== ATLASPOLL_SCHEMA) throw new Error("atlaspoll: not an atlaspoll");
  return attest(fronted, identity, opts);
}

export function isAtlasPoll(p) {
  return !!p && p.schema === ATLASPOLL_SCHEMA && typeof p.pile === "string" && typeof p.poll === "string" &&
    typeof p.fronts === "string" && !!p.sig;
}

// ok = the fronting signature verifies (verify-from-anyone). trusted = the fronting signer is in your
// lineage — trust derived from the network rather than from a single named Atlas.
export async function verifyAtlasPoll(signed, { lineage = [], ...opts } = {}) {
  if (!isAtlasPoll(signed)) return { ok: false, by: null, trusted: false, errors: ["not an atlaspoll"] };
  const v = await verifyAttestation(signed, opts);
  return { ok: v.ok, by: v.by, trusted: v.ok && !!v.by && lineage.includes(v.by), errors: v.errors };
}

export async function atlasPollId(signed) {
  return defaultHash(new TextEncoder().encode(canonicalize(signed)));
}

// Slice-3 custody accessor: the owner recipient a stand-in pile is sealed to. null => the door
// degrades to archive-only (no stand-in pile without a recipient the provisioner may hold). Never a
// key that opens — an age RECIPIENT is a public target.
export function custodyRecipient(fronted) {
  return (isAtlasPoll(fronted) && fronted.age_recipient) || null;
}

// The poll's author fingerprint — a drop door's authorKidFor, so terminal author quells resolve.
export function instigatorOf(fronted) {
  return (isAtlasPoll(fronted) && fronted.instigator) || undefined;
}

// Convenience: build+sign a network-addressed ballot ANSWERED against a fronted poll. It is an
// ordinary anecdote.ballot/v1 (so it turns in and dedups exactly like any other) carrying the fronted
// poll's (pile, poll, scope); the Atlas correlates it back to this fronted poll by those coordinates.
export async function ballotForFronted(fronted, { answer, ts, round, tok, labels } = {}, identity, opts = {}) {
  if (!isAtlasPoll(fronted)) throw new Error("atlaspoll: not an atlaspoll");
  return signBallot(buildBallot({ pile: fronted.pile, poll: fronted.poll, scope: fronted.scope, answer, ts, round, tok, labels }), identity, opts);
}
