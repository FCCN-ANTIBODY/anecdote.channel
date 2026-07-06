// composer/drop.mjs — the ATLAS DROP DOOR resolver: what a node does with a hand-carried ballot it
// receives (docs/ballot-mesh.md "The Atlas door"; civic-node #86, atlas.anecdote.channel CONSTITUTION
// "I accept hand-carried ballots at one signed door, and I judge none of them").
//
// This is the PURE routing half of the door — the three-rule table as one synchronous function,
// composed over quell.mjs's freshness/quell law and ballot.mjs's turn-in projection. Per received
// ballot it picks ONE of three fates and nothing else. It does NOT verify (verify-from-anyone is the
// caller's intake step, verifyBallot), it does NOT dedup (content-id convergence is the satchel's /
// archive's job, ballotId), it does NOT transmit — and, the whole stance, it never judges a ballot's
// GENUINENESS. A witness that routes, not a judge of fitness. We never block; the carrier learns the
// outcome at turn-in (the Tell's 👍/👎).
//
// The three fates:
//
//   turnIn         — the poll has a KNOWN, still-LIVE door AND the ballot has ARRIVED (its scope is
//                    one I serve): ingest/route it. Project with turnInSubmission → the Tell's
//                    tell.submission/v1 idiom; admission (the tok, the close date) stays the Tell's.
//   shrugQuellBack — the poll is DEAD here (author-quelled, or every known host door quelled
//                    unsuperseded): do not ingest. Hand the operative quell(s) BACK to the carrier,
//                    who prunes and spreads them (one packet retires N dead ballots downstream).
//   floodOnward    — anything still alive that isn't arrivable here: no known door (UNKNOWN), or a
//                    live door known but out of my scope. Keep carrying / forward one hop and keep
//                    content-addressed. NEVER dropped.
//
// "Live" is quell.stillLive over the (pile,poll)'s quells + listings; "arrived" is
// ballot.scope ∈ myScopes; "known door" is a listing for that (pile,poll). authorKidFor(pile,poll)
// supplies the poll's author fingerprint so a terminal author quell can be recognized — without it
// nothing is terminal (see quell.isAuthorQuell).

import { isBallot, turnInSubmission } from "./ballot.mjs";
import { stillLive, quells as targetsPoll } from "./quell.mjs";

// Route received ballots into the three fates. Pure and synchronous: no verify, no dedup, no I/O.
// `listings` are host listings { pile, poll, host, ts, ... }; `quells` are signed quells. Returns
// { turnIn: [ballot], shrugQuellBack: [{ ballot, quells }], floodOnward: [ballot] }.
export function resolveDrop({ ballots = [], listings = [], quells = [], myScopes = [],
                             authorKidFor = () => undefined } = {}) {
  const scopes = new Set(myScopes);
  const turnIn = [];
  const shrugQuellBack = [];
  const floodOnward = [];

  for (const ballot of ballots) {
    if (!isBallot(ballot)) continue; // not a ballot: not this door's business
    const forPoll = (x) => x.pile === ballot.pile && x.poll === ballot.poll;
    const pollQuells = quells.filter((q) => targetsPoll(q, ballot));
    const pollListings = listings.filter(forPoll);
    const authorKid = authorKidFor(ballot.pile, ballot.poll);

    if (!stillLive({ authorKid, quells: pollQuells, listings: pollListings })) {
      // dead here — hand back the quells that retire it, so the carrier prunes and spreads them.
      shrugQuellBack.push({ ballot, quells: pollQuells });
      continue;
    }
    const knownDoor = pollListings.length > 0;
    const arrived = !!ballot.scope && scopes.has(ballot.scope);
    if (knownDoor && arrived) turnIn.push(ballot);
    else floodOnward.push(ballot); // live but not arrivable here: unknown, or a door out of scope
  }

  return { turnIn, shrugQuellBack, floodOnward };
}

// Thin glue: project the turnIn set onto the Tell-readable tell.submission/v1 idiom. Admission stays
// the Tell's authz call — this only shapes the blocks (the signed ballot rides whole under `ballot`).
export function projectTurnIns(turnIn = []) {
  return turnIn.map(turnInSubmission);
}
