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

// ---- STANDING GRANTS (probe-line Edge 3) --------------------------------------------------------
// The behavior-shaped cousin of the nonce. Where a NONCE governs one ARTIFACT you sent, a GRANT governs
// one standing BEHAVIOR that runs on your behalf over time (the git-enough staging beat, slow LM
// indexing). Same signing primitive (attest), same store, same "only the original signer may revoke,"
// same tombstone-on-revoke. So owning a running behavior is expressed with the exact machinery as owning
// a sent artifact. See docs/probe-line-consent.md (Rung 2 of the consent ladder).

export const GRANT = "probe.grant/v1";
export const GRANT_RECORD = "probe.grant.record/v1";
export const GRANT_REVOCATION = "probe.grant.revocation/v1";
const GRANTS_KEY = "anecdote:grants";

// Deterministic clock seam: pass opts.now (an ISO-8601 string) in tests; real callers get wall time.
function nowISO(opts = {}) { return opts.now || new Date().toISOString(); }

async function readGrants(store) { const raw = await store.get(GRANTS_KEY); return raw ? JSON.parse(raw) : {}; }
async function writeGrants(store, g) { await store.set(GRANTS_KEY, JSON.stringify(g)); }

// Mint a standing grant: an explicit, SIGNED authorization for one behavior over a scope — the Rung-2
// analogue of a confirmed send. `spec` = { behavior, scope?, cadence?, basis?, expiry? }. Returns the
// stored record: the attested grant kept whole (re-verifiable) plus mutable bookkeeping outside it.
export async function mintGrant(store, spec, identity, opts = {}) {
  if (!spec || !spec.behavior) throw new Error("consent: a grant needs a behavior");
  const rng = opts.randomBytes || ((n) => { const u = new Uint8Array(n); globalThis.crypto.getRandomValues(u); return u; });
  const grantObj = {
    schema: GRANT,
    grant: "grant:" + b64url(rng(16)),
    behavior: spec.behavior,
    scope: spec.scope || {},
    cadence: spec.cadence || null,
    granted_at: nowISO(opts),
    basis: spec.basis || null,     // what the user saw when they granted it (kept honest, signed in)
    expiry: spec.expiry || null,   // optional ISO-8601; null = until revoked
  };
  const signed = await attest(grantObj, identity, opts);
  const record = {
    schema: GRANT_RECORD,
    grant: signed.grant,
    behavior: signed.behavior,     // convenience copies for listing (mirrors the receipt's to/label)
    scope: signed.scope,
    by: signed.sig.by,             // the pseudonymous signer this behavior is bound to
    signed,                        // the attested grant, kept whole
    status: "live",                // live = authorized to run; revoked = withdrawn
    revocation: null,
    last_activity: null,           // updated by the runtime as the behavior acts (the panel's "last seen")
  };
  const grants = await readGrants(store);
  grants[signed.grant] = record;
  await writeGrants(store, grants);
  return record;
}

// The full ledger of behaviors you have ever authorized (live + revoked tombstones).
export async function listGrants(store) { return Object.values(await readGrants(store)); }
export async function getGrant(store, id) { return (await readGrants(store))[id] || null; }

// Pure predicates (pass opts.now for determinism). ISO-8601 UTC strings compare lexicographically.
export function grantExpired(record, opts = {}) {
  return !!(record && record.signed && record.signed.expiry && record.signed.expiry <= nowISO(opts));
}
export function grantLive(record, opts = {}) {
  return !!record && record.status === "live" && !grantExpired(record, opts);
}

// The behaviors currently authorized to run — what the "running on my behalf" panel and the phase-2
// authorize() gate read. Live = not revoked and not expired.
export async function liveGrants(store, opts = {}) {
  return (await listGrants(store)).filter((r) => grantLive(r, opts));
}

// Note that a granted behavior acted — feeds the panel's "last activity" without touching the signed
// grant (so re-verification still holds).
export async function touchGrant(store, id, opts = {}) {
  const grants = await readGrants(store);
  const record = grants[id];
  if (!record) throw new Error("consent: no such grant");
  record.last_activity = nowISO(opts);
  await writeGrants(store, grants);
  return record;
}

// Withdraw a standing grant: produce a SIGNED revocation (the instrument that proves you stopped it) and
// mark the record revoked. Only the ORIGINAL granter may revoke — the identity's fingerprint must match
// the grant's `by`. Returns the signed revocation (the runtime also sends a `cancel`/`port.close()`).
export async function revokeGrant(store, id, identity, opts = {}) {
  const grants = await readGrants(store);
  const record = grants[id];
  if (!record) throw new Error("consent: no such grant");
  if (identity.fingerprint !== record.by)
    throw new Error("consent: only the original granter may revoke this grant");
  const revocation = await attest({ schema: GRANT_REVOCATION, grant: id, target: record.signed.sig.signature }, identity, opts);
  record.status = "revoked";
  record.revocation = revocation;
  await writeGrants(store, grants);
  return revocation;
}

// Verify a grant record: its embedded grant is well-attested (content + key fingerprint). { ok, by, errors }.
export async function verifyGrant(record, opts = {}) {
  if (!record || !record.signed || record.signed.schema !== GRANT)
    return { ok: false, by: null, errors: ["not a grant"] };
  const v = await verifyAttestation(record.signed, opts);
  return { ok: v.ok, by: v.by, errors: v.errors };
}

// Verify a grant revocation: well-signed AND by the same identity that made the grant it withdraws.
export async function verifyGrantRevocation(record, revocation, opts = {}) {
  const errors = [];
  if (!revocation || revocation.schema !== GRANT_REVOCATION) return { ok: false, errors: ["not a grant revocation"] };
  const boundBy = record.by || (record.signed && record.signed.sig && record.signed.sig.by);
  const v = await verifyAttestation(revocation, opts);
  if (!v.ok) errors.push(...v.errors);
  if (v.by && boundBy && v.by !== boundBy) errors.push("grant revoked by someone other than the original granter");
  return { ok: v.ok && errors.length === 0, by: v.by, errors };
}

// Hard local delete of a grant record (distinct from revoke, which keeps the tombstone). Forgetting does
// NOT withdraw a grant already relied upon; revoke first.
export async function forgetGrant(store, id) {
  const grants = await readGrants(store);
  delete grants[id];
  await writeGrants(store, grants);
}

function b64url(u8) {
  const b64 = typeof Buffer !== "undefined"
    ? Buffer.from(u8).toString("base64")
    : (() => { let s = ""; for (const x of u8) s += String.fromCharCode(x); return btoa(s); })();
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
