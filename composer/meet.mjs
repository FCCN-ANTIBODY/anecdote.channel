// composer/meet.mjs — THE MEET: the combined gesture moment, as choreography
// (docs/ballot-mesh.md → "The meet wiring"). Two people scan; keys sign; the labeler rolls;
// met-records land — and the satchels trade. This module is the trade's pure logic: what each
// side declares, what crosses, what the pocket does with it, and the co-signed receipt that
// makes the moment evidence. Everything physical composes at the caller, house-style:
// gesture-gating (gesture.mjs), presence (met.mjs), envelope signing + QR framing
// (transfer.mjs / carrier.mjs — each payload here is one member of a signed layout), and
// whose word to act on (accept.mjs).
//
// The choreography, one round-trip:
//   1. GREETING — each side declares its pins (what I champion) and scopes (where I can turn
//      ballots in). Declaring pins is how solicitation happens without a second round.
//   2. OFFER — quells FIRST (tiny, and they retire the most), then ballots: my push tier
//      (my pins, newest first), plus your solicitation (your pins pulled from my slush),
//      plus anything scoped to where YOU can turn in — you are the better courier for those.
//   3. RECEIVE — verified quells prune before any ballot enters; the rest lands through the
//      pocket's own economy (takeOffered: pins, caps, staleness, the reducer screen).
//   4. RECEIPT — a transcript summary signed by me, countersigned by you: one meet, multiple
//      co-signed artifacts (this + met-records + the labeler's roll) — the commingled
//      evidence a presence threshold reads (tell docs/sealed-credential.md, offline parallel).

import { attest, verifyAttestation } from "./sign.mjs";
import { exchangeOffer, solicit, takeOffered, applyQuells } from "./satchel.mjs";
import { verifyQuell, quellId, isAuthorQuell, quells as quellNames } from "./quell.mjs";
import { ballotId } from "./ballot.mjs";

export const GREETING_SCHEMA = "anecdote.meet-greeting/v1";
export const RECEIPT_SCHEMA = "anecdote.exchange-receipt/v1";

// 1. What I declare before anything crosses. Pins: the labels I champion (solicit my peer's
// slush for me). Scopes: constituencies I can turn ballots in to (make me the courier).
export function greeting({ pins = [], scopes = [] } = {}) {
  return { schema: GREETING_SCHEMA, pins, scopes };
}

// 2. What I put on the wire, given who I'm facing. Quells ride whole (all of them — one
// packet retires N ballots in their pocket too); ballots are my push tier + their
// solicitation + their turn-in scope matches, deduped, in that order (a truncated session
// still moved what I champion).
export function meetOffer({ satchel = [], quells = [] } = {}, { pins = [], peerGreeting } = {}) {
  const theirs = peerGreeting || greeting();
  const tiers = exchangeOffer(satchel, { pins });
  const scoped = new Set(theirs.scopes || []);
  const picked = [];
  const seen = new Set();
  for (const list of [
    tiers.push,
    solicit(satchel, theirs.pins),
    satchel.filter((e) => e.ballot.scope && scoped.has(e.ballot.scope)).map((e) => e.ballot),
  ]) {
    for (const b of list) {
      const key = b.sig && b.sig.signature;
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(b);
    }
  }
  return { quells: quells.slice(), ballots: picked };
}

// 3. Apply an offer to my own hold. Quells verify first and prune before any offered ballot
// enters (a quelled ballot never lands); which quells are TERMINAL is decided by the poll
// author kids the caller knows (authorKidFor(pile, poll) -> kid | undefined). Host quells are
// kept (they steer routing) but never prune. Returns the new hold + full diagnostics.
export async function receiveMeet(
  { satchel = [], quells = [] } = {},
  offer,
  { pins, cap, now, staleAfterMs, screen, authorKidFor = () => undefined, opts } = {},
) {
  const held = new Set(await Promise.all(quells.map((q) => quellId(q))));
  const keptQuells = quells.slice();
  const terminal = [];
  for (const q of offer.quells || []) {
    const v = await verifyQuell(q, opts);
    if (!v.ok) continue;
    const id = await quellId(q);
    if (!held.has(id)) { held.add(id); keptQuells.push(q); }
    if (isAuthorQuell(q, authorKidFor(q.pile, q.poll))) terminal.push(q);
  }
  const mine = applyQuells(satchel, terminal);
  const alive = (offer.ballots || []).filter((b) => !terminal.some((q) => quellNames(q, b)));
  const took = await takeOffered(mine.satchel, alive, { pins, cap, now, staleAfterMs, screen, opts });
  return { satchel: took.satchel, quells: keptQuells, added: took.added, dropped: took.dropped, pruned: mine.pruned };
}

// 4. The receipt: my signed transcript summary (content ids only — the artifacts speak for
// themselves), naming the peer I faced; then the peer countersigns the exact signed object.
// Two signatures over one transcript = the co-signed evidence of a commingled step.
export async function exchangeReceipt({ peer, ts, sent = [], received = [] }, identity, opts = {}) {
  if (!peer || !ts) throw new Error("receipt: peer fingerprint and ts required");
  return attest({ schema: RECEIPT_SCHEMA, peer, ts, sent, received }, identity, opts);
}

export async function countersign(signedReceipt, identity, opts = {}) {
  return attest({ schema: RECEIPT_SCHEMA, receipt: signedReceipt }, identity, opts);
}

// Both signatures verify AND the countersigner is exactly the peer the receipt named — a
// receipt countersigned by anyone else is not evidence of THIS meet.
export async function verifyExchange(countersigned, opts = {}) {
  const outer = await verifyAttestation(countersigned, opts);
  const receipt = countersigned && countersigned.receipt;
  if (!outer.ok || !receipt) return { ok: false, errors: ["outer countersignature does not verify"] };
  const inner = await verifyAttestation(receipt, opts);
  if (!inner.ok) return { ok: false, errors: ["inner receipt does not verify"] };
  if (receipt.peer !== outer.by) return { ok: false, errors: ["countersigner is not the named peer"] };
  return { ok: true, author: inner.by, peer: outer.by, sent: receipt.sent, received: receipt.received, ts: receipt.ts };
}

// Convenience: the content ids a transcript summarizes (what actually crossed).
export async function transcriptIds(offer) {
  return Promise.all([
    ...(offer.quells || []).map((q) => quellId(q)),
    ...(offer.ballots || []).map((b) => ballotId(b)),
  ]);
}

// Deliberately NOT here: transport and camera. The layout a carrier frames (one member
// envelope per payload kind) and the met-record the bodies mint are the same meet seen by
// other modules — this one only trades and testifies.
