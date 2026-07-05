// composer/quell.mjs — the QUELL: a signed "this poll is done (here)" that travels the same mesh
// as the ballots it retires (docs/ballot-mesh.md). A dated poll needs none — its signed close
// date IS a standing quell, final on its face. The quell artifact exists for everything else,
// and it is TWO different claims distinguished by who signed:
//
//   * AUTHOR quell (no `host`, signed by the poll's own kid) — the QUESTION is ended. Terminal,
//     global, final: carriers prune the poll's ballots and carry the quell onward on the same
//     labels (one packet replaces N dead ballots in every pocket it touches). The withdrawal
//     case lives here too: someone quits a Tell with open polls, takes their pile, and ends —
//     or re-homes — the question on their own signature.
//
//   * HOST quell (`host` present, signed by that Tell/Atlas) — MY door is closed. A de-listing,
//     not a death: archived per end-of-life policy, membership removed, a donated pile sealed
//     ("a box in storage now"). It binds nobody else — the same poll registered on two hosts
//     with different archive policies has one door close while the other keeps collecting.
//     And it loses to FRESHNESS: a same-host listing newer than the quell supersedes it (your
//     cache saw the host still carrying the poll after it supposedly quelled — believe the
//     newer signed word). Host quells never prune ballots; they only stop routing to one door.
//
// Verify-from-anyone as always; WHOSE quell you act on is the caller's judgment (the poll's
// known author kid, the friend list, the freshness of your own cache).

import { attest, verifyAttestation, canonicalize } from "./sign.mjs";
import { defaultHash } from "./anecdote.mjs";

export const QUELL_SCHEMA = "anecdote.quell/v1";

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function buildQuell({ pile, poll, ts, reason, host } = {}) {
  if (!pile || !SLUG.test(pile)) throw new Error("quell: pile slug required");
  if (!poll || !SLUG.test(poll)) throw new Error("quell: poll slug required");
  if (!ts) throw new Error("quell: ts required");
  const q = { schema: QUELL_SCHEMA, pile, poll, ts, reason: reason || "ended" };
  if (host) q.host = host;
  return q;
}

export async function signQuell(quell, identity, opts = {}) {
  if (quell.schema !== QUELL_SCHEMA) throw new Error("quell: not a quell");
  return attest(quell, identity, opts);
}

export function isQuell(q) {
  return !!q && q.schema === QUELL_SCHEMA && typeof q.pile === "string" && typeof q.poll === "string" &&
    !!q.ts && !!q.sig;
}

export async function verifyQuell(signed, opts = {}) {
  if (!isQuell(signed)) return { ok: false, by: null, errors: ["not a quell"] };
  const v = await verifyAttestation(signed, opts);
  return { ok: v.ok, by: v.by, errors: v.errors };
}

export async function quellId(signed) {
  return defaultHash(new TextEncoder().encode(canonicalize(signed)));
}

// Does this quell target that ballot/poll? Pure shape match — authority is the caller's call.
export function quells(quell, target) {
  return !!target && quell.pile === target.pile && quell.poll === target.poll;
}

// Terminal iff it claims the question itself (no host) AND the signature is the poll's own
// author. `authorKid` is what the caller knows the poll's signer to be (its QR provenance /
// attested poll object); without it nothing is terminal.
export function isAuthorQuell(quell, authorKid) {
  return !quell.host && !!authorKid && !!quell.sig && quell.sig.by === authorKid;
}

// Freshness arbitration for a HOST quell: a listing from the SAME host, signed/refreshed
// newer than the quell, supersedes it — the newest same-source word wins. Listings from
// other hosts are irrelevant (their doors were never bound by this quell).
export function supersededBy(quell, listing) {
  if (!quell.host || !listing || listing.host !== quell.host) return false;
  return Date.parse(listing.ts) > Date.parse(quell.ts);
}

// The client's one question: is this poll still live FOR ME? Terminal author quell → dead,
// no listing resurrects it (a stale list is just stale). Otherwise dead only if EVERY host
// I know listing it has quelled unsuperseded — any live door keeps it alive.
export function stillLive({ authorKid, quells: qs = [], listings = [] } = {}) {
  for (const q of qs) if (isAuthorQuell(q, authorKid)) return false;
  if (!listings.length) return true; // nobody lists it, nobody ended it — carry on
  return listings.some((l) => !qs.some((q) => q.host === l.host && !supersededBy(q, l)));
}
