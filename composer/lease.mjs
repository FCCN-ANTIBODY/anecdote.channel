// composer/lease.mjs — THE FRESHNESS LEASE: a positive, dated, signed "I still hold / still vouch
// this, checked as of `at`" receipt. The inverse of a quell: a quell is a signed "this is DONE"; a
// lease is a signed "this is STILL LIVE, as of now" — and its VALUE DECAYS on its own. Non-renewal is
// the revoke: to retire something you simply stop re-signing its lease, and it goes stale on its face.
// Nobody can forge a fresher date (no private key), so "cease-to-attest" is an enforceable revoke —
// the piece the public husk needs (civic-node #88).
//
// Contrast with the two revoke idioms already in the constellation:
//   - quell.mjs — a POSITIVE terminal/de-list claim ("done"); freshness there means a newer LISTING
//     revives a quelled door (supersededBy). A lease runs the opposite way: the newest dated word
//     means "still fresh," and the ABSENCE of a newer one means stale.
//   - docs/anti-signature.md — the "dent": a DESTRUCTIVE revoke made of physics. A lease is a POLICY
//     revoke made of silence. Both end circulation; a lease is the non-destructive, reversible one.
//
// Reuses the generic Ed25519 envelope wholesale (sign.mjs attest/verifyAttestation); introduces no
// new cryptography. `subject` is whatever content-id the lease vouches (a ballotId/atlasPollId/husk
// id — defaultHash(canonicalize(...)) everywhere), so a lease composes over anything already signed.

import { attest, verifyAttestation } from "./sign.mjs";

export const LEASE_SCHEMA = "anecdote.lease/v1";

// Assemble the unsigned lease. `subject` (the content-id vouched) and `at` (the checked-as-of stamp)
// are required. `window` (ms) is the issuer's stated freshness period — the verifier may override it.
export function buildLease({ subject, at, window, note } = {}) {
  if (!subject || typeof subject !== "string") throw new Error("lease: subject (a content-id) required");
  if (!at) throw new Error("lease: at (the checked-as-of stamp) required");
  if (window !== undefined && !(Number.isFinite(window) && window > 0)) throw new Error("lease: window must be a positive number of ms");
  const l = { schema: LEASE_SCHEMA, subject, at };
  if (window !== undefined) l.window = window;
  if (note) l.note = note;
  return l;
}

// Sign as the keeper — the re-signature you must repeat to keep the subject fresh.
export async function signLease(lease, identity, opts = {}) {
  if (lease.schema !== LEASE_SCHEMA) throw new Error("lease: not a lease");
  return attest(lease, identity, opts);
}

export function isLease(l) {
  return !!l && l.schema === LEASE_SCHEMA && typeof l.subject === "string" && !!l.at && !!l.sig;
}

// Verify-from-anyone: shape + the embedded-key attestation. Whose lease you ACT on is the caller's
// (a friend/lineage decision), never this function's.
export async function verifyLease(signed, opts = {}) {
  if (!isLease(signed)) return { ok: false, by: null, errors: ["not a lease"] };
  const v = await verifyAttestation(signed, opts);
  return { ok: v.ok, by: v.by, errors: v.errors };
}

// The whole point: is this lease VERIFIED and STILL FRESH at `now`? Freshness = `now - at <= window`.
// Window precedence: explicit opts.window > the lease's own `window` > Infinity (verifies-forever —
// degrades to a plain signature, and the caller is told via `windowed:false`). A future-dated lease
// (clock skew) counts as fresh. Returns { ok, by, fresh, ageMs, windowed, errors }.
export async function leaseFresh(signed, { now, window, ...opts } = {}) {
  const v = await verifyLease(signed, opts);
  if (!v.ok) return { ok: false, by: v.by, fresh: false, ageMs: null, windowed: false, errors: v.errors };
  if (!now) throw new Error("lease: leaseFresh needs `now`");
  const w = window ?? signed.window ?? Infinity;
  const ageMs = Date.parse(now) - Date.parse(signed.at);
  return { ok: true, by: v.by, fresh: ageMs <= w, ageMs, windowed: Number.isFinite(w), errors: [] };
}

// Newest same-source word wins (quell.supersededBy's doctrine, un-inverted for a positive claim):
// `a` supersedes `b` when they vouch the same subject, are signed by the same keeper, and `a` is
// newer. This is how a re-signed lease replaces the prior one in a pocket.
export function supersedes(a, b) {
  if (!a || !b || a.subject !== b.subject) return false;
  if (!a.sig || !b.sig || a.sig.by !== b.sig.by) return false;
  return Date.parse(a.at) > Date.parse(b.at);
}

// The freshest lease a keeper signed for a subject, from a bag of leases (verification is the
// caller's; this is pure date arithmetic over same-subject, same-signer leases).
export function freshest(leases = [], { subject, by } = {}) {
  let best = null;
  for (const l of leases) {
    if (!isLease(l)) continue;
    if (subject && l.subject !== subject) continue;
    if (by && (!l.sig || l.sig.by !== by)) continue;
    if (!best || Date.parse(l.at) > Date.parse(best.at)) best = l;
  }
  return best;
}
