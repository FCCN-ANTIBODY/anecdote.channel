// composer/firmware.mjs — trust-on-first-contact FIRMWARE PINNING (docs/origin.md, "lock the hatch on the
// way out"). The offline shell (sw.js) is code a holder keeps; this is how the holder refuses a later
// server from silently swapping it. A signed MANIFEST names the shell's files by content hash + a version;
// the holder PINS the signer at first contact and thereafter accepts only same-key, forward-moving updates.
// A possessed origin can push new bytes, but a manifest it can't sign with the day-one key is refused and
// the held shell survives. New *signed* versions are welcome (the holder's roll-forward lever); silent or
// mis-signed replacement is not.
//
// The signature is Ed25519 over canonical JSON (composer/sign.mjs's attest — the same device-key primitive
// behind anecdote signatures and standing grants), so it verifies with WebCrypto inside the service worker.
// This is ALSO the machinery offline data-transfer ("gravel") reuses: verify a signed payload's bytes and
// decide trust locally, from any carrier (DNS, QR, peer) — DELIVERY.md's "verify the bytes, accept them
// from anyone," with a pin deciding *who* may change what you hold.

import { attest, verifyAttestation } from "./sign.mjs";
import { defaultHash } from "./anecdote.mjs";

export const FIRMWARE = "anecdote.firmware/v1";

// Build the unsigned manifest from the shell files. `files` = [{ path, bytes }]. Deterministic: files are
// content-hashed and sorted by path, so the same shell always builds the same manifest (stable to sign).
export async function buildManifest(files, { version = 1, created_at = 0, hash = defaultHash } = {}) {
  const entries = [];
  for (const f of files) entries.push({ path: f.path, hash: await hash(f.bytes) });
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { schema: FIRMWARE, version, created_at, files: entries };
}

// Sign a manifest with the firmware identity (Ed25519 over canonical JSON). Returns the manifest + sig.
export async function signManifest(manifest, identity, opts = {}) { return attest(manifest, identity, opts); }

// Verify a signed manifest's SIGNATURE + schema (not yet the files). Returns { ok, by, version, errors }.
// `by` is the signer fingerprint ("key:sha256:…") — the thing that gets pinned.
export async function verifyManifest(signed, opts = {}) {
  if (!signed || signed.schema !== FIRMWARE) return { ok: false, by: null, version: null, errors: ["not a firmware manifest"] };
  const v = await verifyAttestation(signed, opts);
  return { ok: v.ok, by: v.by, version: signed.version ?? null, errors: v.errors };
}

// THE TOFU DECISION. `pinnedBy` is the fingerprint recorded at first contact (null if none yet);
// `currentVersion` is the version currently held (0 if none). Returns
// { accept, firstContact, reason, by, version }.
//   - bad signature            → refuse
//   - no pin yet               → accept + firstContact (the caller pins `by`)
//   - signer ≠ pinned day-one  → REFUSE (the possession guarantee)
//   - same key, version ≤ held → refuse (rollback/replay guard)
//   - same key, version > held → accept (the roll-forward)
export async function pinDecision(signed, pinnedBy = null, currentVersion = 0, opts = {}) {
  const v = await verifyManifest(signed, opts);
  const out = { accept: false, firstContact: false, reason: "", by: v.by, version: v.version };
  if (!v.ok) { out.reason = "signature invalid: " + v.errors.join("; "); return out; }
  if (!pinnedBy) { out.accept = true; out.firstContact = true; out.reason = "first contact — pinning signer"; return out; }
  if (v.by !== pinnedBy) { out.reason = "signer ≠ pinned day-one key — refused"; return out; }
  if ((v.version ?? 0) <= (currentVersion ?? 0)) { out.reason = `not a roll-forward (v${v.version} ≤ held v${currentVersion})`; return out; }
  out.accept = true; out.reason = "same-key roll-forward"; return out;
}

// After the signature is trusted, confirm the actual files match the manifest hashes — content integrity,
// so a carrier can't swap a file's bytes under a valid signature. `fetchBytes(path) -> bytes|null` is the
// carrier seam (a SW passes cache/network; a peer passes the received blob). Returns { ok, bad:[{path,reason}] }.
export async function verifyFiles(signed, fetchBytes, { hash = defaultHash } = {}) {
  const bad = [];
  for (const e of signed.files || []) {
    const bytes = await fetchBytes(e.path);
    if (bytes == null) { bad.push({ path: e.path, reason: "missing" }); continue; }
    const got = await hash(bytes);
    if (got !== e.hash) bad.push({ path: e.path, reason: `hash ${got} ≠ ${e.hash}` });
  }
  return { ok: bad.length === 0, bad };
}
