// composer/meet-carrier.mjs — the meet's PHYSICAL LEG: meet.mjs choreography over the gravel
// (transfer.mjs envelopes, carrier.mjs frames). Two phases, matching how two people actually
// stand there:
//
//   HELLO — each side shows its greeting as one standalone signed transfer (its own frames,
//   no layout). Catching the peer's hello is what lets you compute an offer at all.
//
//   TRADE — the offer becomes a signed LAYOUT of member envelopes: one "meet-quells" member,
//   one "meet-ballots" member, both signed by the same identity that signs the layout — ONE
//   VOICE for the whole set, so an interloper tile on the side is caught by the set signing
//   itself, and a member signed by anyone else is refused even if it verifies. Loop the
//   quells member's frames first (they retire the most for the least); the fountain makes
//   every member survivable by catching more frames, in any order, with dents healed.
//
// Signing can be gesture-gated by the caller (gesture.mjs gatedAttest via opts), met-records
// mint beside this on the same scan, and what the pocket DOES with a caught trade stays
// meet.mjs's receiveMeet. This module only moves the bytes and holds the one-voice line.

import { packTransfer, packLayout } from "./transfer.mjs";
import { fountainTransfer, frameLayout } from "./carrier.mjs";
import { greeting as makeGreeting, GREETING_SCHEMA } from "./meet.mjs";

export const KIND_GREETING = "meet-greeting";
export const KIND_QUELLS = "meet-quells";
export const KIND_BALLOTS = "meet-ballots";

const td = new TextDecoder();

// ---- HELLO -------------------------------------------------------------------------------------------

export async function packGreeting(g, identity, opts = {}) {
  return packTransfer(KIND_GREETING, JSON.stringify(g || makeGreeting()), identity, opts);
}

// A caught hello (one verified transfer) back into a greeting, or null if it isn't one.
export function unpackGreeting(verifiedTransfer) {
  if (!verifiedTransfer || !verifiedTransfer.ok || verifiedTransfer.kind !== KIND_GREETING) return null;
  try {
    const g = JSON.parse(td.decode(verifiedTransfer.bytes));
    return g && g.schema === GREETING_SCHEMA ? g : null;
  } catch {
    return null;
  }
}

// ---- TRADE -------------------------------------------------------------------------------------------

// meetOffer() output -> the signed set: two member envelopes + the layout that attests them.
export async function packMeetOffer(offer, identity, opts = {}) {
  const members = [
    await packTransfer(KIND_QUELLS, JSON.stringify(offer.quells || []), identity, opts),
    await packTransfer(KIND_BALLOTS, JSON.stringify(offer.ballots || []), identity, opts),
  ];
  const layout = await packLayout(members, identity, opts);
  return { layout, members };
}

// Frames for the whole trade, ready for a QR loop: the layout tile first (any one tile names
// the set), then per-member rateless streams — quells before ballots on purpose. `frames(n)`
// pulls n droplets per member; a bad camera just asks for more.
export async function meetFrames({ layout, members }, { blockSize = 256 } = {}) {
  const tile = await frameLayout(layout);
  const streams = [];
  for (const m of members) streams.push(await fountainTransfer(m, { blockSize, layoutShort: tile.layoutShort }));
  let cursor = 0; // rateless streams must ADVANCE: each burst pulls fresh seeds
  return {
    layoutFrame: tile.frame,
    layoutShort: tile.layoutShort,
    streams, // [{ frame(seed), frames(count,start), memberId, K, B, L }] in wire order
    burst(count = 24) {
      // one pass of the loop: the tile + `count` NEW droplets per member, quells first.
      // A bad camera (or an unlucky decode) just takes another pass — that is the fountain.
      const out = [tile.frame, ...streams.flatMap((s) => s.frames(count, cursor))];
      cursor += count;
      return out;
    },
  };
}

// A completed carrierSession result() -> the offer meet.mjs can receive, holding the ONE-VOICE
// line: layout complete and truly signed, every member envelope valid, every member signed by
// the SAME identity as the layout. Anything else is not a trade, whatever it verifies as.
export function unpackMeetOffer(result) {
  if (!result || !result.ok) return { ok: false, errors: ["carrier session incomplete"] };
  const errors = [];
  const L = result.layout;
  if (!L || !L.ok || !L.complete) errors.push("layout missing, unsigned, or not the attested set");
  const voice = L && L.by;
  const byKind = new Map();
  for (const t of result.transfers || []) {
    if (!t.verify.ok) { errors.push("member does not verify: " + t.verify.errors.join("; ")); continue; }
    if (t.verify.by !== voice) { errors.push("member signed by another voice than the layout"); continue; }
    try { byKind.set(t.verify.kind, JSON.parse(td.decode(t.verify.bytes))); }
    catch { errors.push("member payload is not JSON (" + t.verify.kind + ")"); }
  }
  if (!byKind.has(KIND_QUELLS) || !byKind.has(KIND_BALLOTS)) errors.push("trade is missing a member kind");
  if (errors.length) return { ok: false, by: voice || null, errors };
  return { ok: true, by: voice, offer: { quells: byKind.get(KIND_QUELLS), ballots: byKind.get(KIND_BALLOTS) } };
}
