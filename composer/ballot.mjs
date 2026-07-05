// composer/ballot.mjs — the HAND-SIGNED BALLOT: an answer that travels as a person, not a POST
// (docs/ballot-mesh.md; tell.anecdote.channel docs/sealed-credential.md → "The offline parallel").
//
// In the promiscuous sharing path an AMBASSADOR presents a poll's QR and the respondent answers on
// the spot — no network, no GitHub, and the QR's platform credential is dead weight (it only ever
// meant something to an issue platform). What the moment produces instead is this artifact: the
// answer, bound to the poll it answers, age-stamped, and attested by the respondent's device
// identity (sign.mjs; gesture-gating composes at the caller like everywhere else). The ballot is
// then HEARSAY THE CARRIER VOUCHES they witnessed being minted — it rides satchels (satchel.mjs)
// through the mesh until someone reaches the poll's Tell and turns it in.
//
// The `tok` rides along untouched: meaningless face to face, it is the admission HMAC the Tell's
// authz will want at turn-in — the ballot carries its own door key for a door it hasn't reached.
// `labels` are reducer vocabulary (the carrier-side routing language — route.mjs's posture: never
// blocked, only routed); `scope` is the constituency the ballot is trying to reach.
//
// Turn-in is the register-exchange.mjs move: the offline artifact REPLAYS onto the GitHub mirror as
// the ordinary idiom — here, a tell.submission/v1 comment on the poll's canonical issue, with the
// signed ballot attached so lateness is evidenced (its ts is inside the respondent's signature),
// not asserted. Whether a late ballot is ADMITTED stays the Tell's call (lifecycle late_until —
// viewer/poll.mjs pollState's "late" window).

import { attest, verifyAttestation, canonicalize } from "./sign.mjs";
import { defaultHash } from "./anecdote.mjs";

export const BALLOT_SCHEMA = "anecdote.ballot/v1";
export const SUBMISSION_SCHEMA = "tell.submission/v1";

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

// Assemble the unsigned ballot. pile/poll/answer/ts required; everything else rides if present.
export function buildBallot({ pile, poll, round, tok, answer, ts, labels, scope } = {}) {
  if (!pile || !SLUG.test(pile)) throw new Error("ballot: pile slug required");
  if (!poll || !SLUG.test(poll)) throw new Error("ballot: poll slug required");
  if (typeof answer !== "string" || !answer) throw new Error("ballot: an answer is required");
  if (!ts) throw new Error("ballot: ts (the age stamp) is required");
  const b = { schema: BALLOT_SCHEMA, pile, poll, answer, ts };
  if (round !== undefined && round !== null) b.round = String(round);
  if (tok) b.tok = tok;
  const l = (labels || []).map((s) => String(s).trim()).filter(Boolean);
  if (l.length) b.labels = l;
  if (scope) b.scope = scope;
  return b;
}

// Sign with the respondent's device identity. The ts lands INSIDE the signature — the age stamp is
// evidence, not an honor claim.
export async function signBallot(ballot, identity, opts = {}) {
  if (ballot.schema !== BALLOT_SCHEMA) throw new Error("ballot: not a ballot");
  return attest(ballot, identity, opts);
}

export function isBallot(b) {
  return !!b && b.schema === BALLOT_SCHEMA && typeof b.pile === "string" && typeof b.poll === "string" &&
    typeof b.answer === "string" && !!b.ts && !!b.sig;
}

// Verify from anyone (transfer.mjs's stance): shape + the embedded-key attestation. Trust — whose
// signature you act on — is the friend-list's question (accept.mjs), never this function's.
export async function verifyBallot(signed, opts = {}) {
  if (!isBallot(signed)) return { ok: false, by: null, errors: ["not a ballot"] };
  const v = await verifyAttestation(signed, opts);
  return { ok: v.ok, by: v.by, errors: v.errors };
}

// Content id for satchel dedup — over the whole signed object, so the same ballot carried by many
// hands converges to one entry.
export async function ballotId(signed) {
  return defaultHash(new TextEncoder().encode(canonicalize(signed)));
}

// Project a carried ballot into the mirror's ordinary idiom for turn-in: a tell.submission/v1 block
// (a comment on the poll's canonical issue). Key order mirrors poll-answer.mjs's contract for the
// fields the Tell's authz reads (pile/poll/round/tok/answer/ts); the signed ballot rides whole under
// `ballot` at the end — attribution and age stamp, verifiable by anyone at the door.
export function lateSubmission(signed) {
  if (!isBallot(signed)) throw new Error("ballot: not a ballot");
  const block = { schema: SUBMISSION_SCHEMA, pile: signed.pile, poll: signed.poll };
  if (signed.round !== undefined) block.round = signed.round;
  if (signed.tok) block.tok = signed.tok;
  block.answer = signed.answer;
  block.ts = signed.ts;
  block.ballot = signed;
  return block;
}
