// composer/consent.mjs — the revocable nonce + the local trove (CONSTITUTION §"Aggregation").
//
// This is where a constituent's POWER over their own data lives. Two ideas, one store:
//
//   1. THE NONCE. Every anecdote you send carries a per-submission `nonce` — a random, unlinkable
//      handle bound under your signature (composer/sign.mjs). It anonymizes (it is not your name and
//      links to nothing) and it is REVOCABLE: presenting a signed revocation for a nonce withdraws
//      that contribution from every dataset Anecdote offers. Removal of consent is a first-class,
//      cryptographic act, not a support ticket.
//
//   2. THE TROVE. anecdote.channel is the domain-scoped space where "all of the nonsense lives" —
//      so this is the natural home for the COMPLETE local record of everything you ever transmitted.
//      Each receipt keeps the exact signed bytes you sent (the `film` — the same bytes a QR encodes,
//      so the exact QR you saw is reproducible forever from a few hundred bytes, no pixels stored).
//      You can list it all, see each one's status, and at any age: KEEP it (let it keep being offered
//      and earning in the city's live polls) or REVOKE it (pull it). Practical fulfilment of
//      revocation across old datasets is a real challenge, deliberately out of scope here — this is
//      the constituent-side ledger and the signed instrument that demands it.
//
// Pure core in the house style: it takes a `store` ({get,set,delete}, the reducer's domain-scoped
// contract) and never reaches the network. Revocations are signed with the same primitive that signs
// anecdotes (sign.attest), so only the original signer can revoke their own contribution.

import { attest, verifyAttestation, canonicalize } from "./sign.mjs";

export const RECEIPT = "anecdote.receipt/v1";
export const REVOCATION = "anecdote.revocation/v1";
const TROVE_KEY = "anecdote:trove";

// A fresh, unlinkable handle. Random (not derived from identity), so the platform can tie a
// contribution to a revocable slot without ever linking your submissions to each other or to you.
export function mintNonce(opts = {}) {
  const rng = opts.randomBytes || ((n) => { const u = new Uint8Array(n); globalThis.crypto.getRandomValues(u); return u; });
  return "nonce:" + b64url(rng(16));
}

// The QR seed: the exact bytes a confirmed send transmits. The QR image is a deterministic render of
// these bytes, so storing the seed IS storing "the exact QR you saw" — recoverable in full, forever.
export function film(signed) { return canonicalize(signed); }

async function readTrove(store) {
  const raw = await store.get(TROVE_KEY);
  return raw ? JSON.parse(raw) : {};
}
async function writeTrove(store, trove) { await store.set(TROVE_KEY, JSON.stringify(trove)); }

// Record a sent anecdote into the trove. Requires a signed anecdote carrying its bound nonce. Idempotent
// per nonce. Returns the stored receipt.
export async function record(store, signed) {
  if (!signed || !signed.sig) throw new Error("consent: only a signed anecdote can be recorded");
  if (!signed.nonce) throw new Error("consent: signed anecdote has no nonce to track it by");
  const trove = await readTrove(store);
  const receipt = {
    schema: RECEIPT,
    nonce: signed.nonce,
    to: signed.to,
    label: signed.label,
    by: signed.sig.by,            // the pseudonymous signer this contribution is bound to
    film: film(signed),           // the exact transmitted bytes / reproducible QR
    signed,                       // the full artifact, kept whole
    status: "live",               // live = offered & earning; revoked = withdrawn
    revocation: null,
    delivery: null,               // async acceptance: { state:"pending"|"accepted"|"rejected"|"error", placement }
    placements: [],               // where it currently lives + what it has earned (fed by the platform)
  };
  trove[signed.nonce] = receipt;
  await writeTrove(store, trove);
  return receipt;
}

// Everything you've said, newest store-order. The "view what you've already said" surface.
export async function list(store) { return Object.values(await readTrove(store)); }
export async function get(store, nonce) { return (await readTrove(store))[nonce] || null; }

// Withdraw consent for one contribution. Produces a SIGNED revocation — the artifact you transmit to
// pull your data — and marks the local receipt revoked. Only the ORIGINAL signer can revoke: the
// identity's fingerprint must match the contribution's `by`. Returns the signed revocation.
export async function revoke(store, nonce, identity, opts = {}) {
  const trove = await readTrove(store);
  const receipt = trove[nonce];
  if (!receipt) throw new Error("consent: no such contribution in the trove");
  if (identity.fingerprint !== receipt.by)
    throw new Error("consent: only the original signer may revoke this contribution");
  const revocation = await attest({ schema: REVOCATION, nonce, target: receipt.signed.sig.signature }, identity, opts);
  receipt.status = "revoked";
  receipt.revocation = revocation;
  await writeTrove(store, trove);
  return revocation;
}

// Verify a revocation: it is well-signed AND its signer is the one who made the contribution it pulls.
export async function verifyRevocation(receiptOrSigned, revocation, opts = {}) {
  const errors = [];
  if (!revocation || revocation.schema !== REVOCATION) return { ok: false, errors: ["not a revocation"] };
  const boundBy = receiptOrSigned.by || (receiptOrSigned.sig && receiptOrSigned.sig.by);
  const v = await verifyAttestation(revocation, opts);
  if (!v.ok) errors.push(...v.errors);
  if (v.by && boundBy && v.by !== boundBy) errors.push("revoked by someone other than the original signer");
  return { ok: v.ok && errors.length === 0, by: v.by, errors };
}

// Hard local delete — forget a receipt entirely (distinct from revoke, which keeps the record but
// marks it withdrawn). Forgetting does NOT itself withdraw consent already given; revoke first.
export async function forget(store, nonce) {
  const trove = await readTrove(store);
  delete trove[nonce];
  await writeTrove(store, trove);
}

// Record the async delivery status of a contribution — the seam behind the promise that you will
// know if your input was not accepted. `delivery` is { state, placement, at? }; the page reads it to
// become the detail view of its own submission. Also files the placement under "where your data is."
export async function recordDelivery(store, nonce, delivery) {
  const trove = await readTrove(store);
  const receipt = trove[nonce];
  if (!receipt) throw new Error("consent: no such contribution in the trove");
  receipt.delivery = delivery;
  if (delivery && delivery.placement && delivery.placement.url && !receipt.placements.some((p) => p.url === delivery.placement.url)) {
    receipt.placements.push(delivery.placement);
  }
  await writeTrove(store, trove);
  return receipt;
}

// Merge platform-reported placements/earnings into a receipt — "where your data is now and what it
// has earned for you." The platform feeds these; the core only holds the surface. Returns the receipt.
export async function recordPlacements(store, nonce, placements) {
  const trove = await readTrove(store);
  const receipt = trove[nonce];
  if (!receipt) throw new Error("consent: no such contribution in the trove");
  receipt.placements = placements;
  await writeTrove(store, trove);
  return receipt;
}

function b64url(u8) {
  const b64 = typeof Buffer !== "undefined"
    ? Buffer.from(u8).toString("base64")
    : (() => { let s = ""; for (const x of u8) s += String.fromCharCode(x); return btoa(s); })();
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
