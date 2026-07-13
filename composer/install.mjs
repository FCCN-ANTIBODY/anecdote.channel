// composer/install.mjs — the storage-engine INSTALL manifest: a signed, verifiable set of client code blobs
// an engine hands a consumer over the probe (the common `install` grammar every storage engine speaks). The
// consumer verifies every blob against the pinned platform key, mounts them, and imports the single named
// entry. "Load a blob and run it" stops being a hole because the bytes are checked or they don't run — the
// boot gate (composer/bottle-attest), applied to LOADED code. The blobs' internal wiring is their own concern;
// the manifest names exactly ONE entry so the consumer never has to guess where to start. Pure; reuses
// composer/sign.mjs. The browser mount + Blob-URL import() is the follow-on layer.
import { attest, verifyAttestation } from "./sign.mjs";
import { defaultHash } from "./anecdote.mjs";

export const INSTALL = "anecdote.install/v1";
export const BLOB = "anecdote.blob/v1";

const enc = new TextEncoder();
const b64 = (u8) => (typeof Buffer !== "undefined" ? Buffer.from(u8).toString("base64") : btoa(String.fromCharCode(...u8)));
const unb64 = (s) => (typeof Buffer !== "undefined" ? new Uint8Array(Buffer.from(s, "base64")) : Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

// Mint a signed install manifest: for each file, sign a { name, hash } attestation with the platform
// identity; name one entry (which must be among the files). files: { name: string | Uint8Array }.
export async function mintInstall(files, entry, identity, opts = {}) {
  if (!files || typeof files !== "object" || !Object.prototype.hasOwnProperty.call(files, entry)) {
    throw new Error("install: entry must be one of the files");
  }
  const blobs = [];
  for (const [name, content] of Object.entries(files)) {
    const bytes = typeof content === "string" ? enc.encode(content) : content;
    const hash = await defaultHash(bytes);
    const attestation = await attest({ schema: BLOB, name, hash }, identity, opts);
    blobs.push({ name, bytes: b64(bytes), attestation });
  }
  return { schema: INSTALL, entry, blobs };
}

// Verify an install manifest against the pinned platform key. Every blob's attestation must be valid, signed
// by the pin, name-match, and hash-match its actual bytes; the entry must be present. Returns { ok, reason }
// or { ok:true, entry, files: { name: Uint8Array } } — the verified bytes, ready to mount. Omit platformKey to
// check self-consistency only (no pin); pass it to require the known-good platform signer.
export async function verifyInstall(manifest, { platformKey = null, opts = {} } = {}) {
  if (!manifest || manifest.schema !== INSTALL || !Array.isArray(manifest.blobs)) return { ok: false, reason: "not an install manifest" };
  const files = {};
  for (const blob of manifest.blobs) {
    const att = blob && blob.attestation;
    if (!att || att.schema !== BLOB) return { ok: false, reason: "blob not attested: " + (blob && blob.name) };
    const v = await verifyAttestation(att, opts);
    if (!v.ok) return { ok: false, reason: "bad blob signature: " + blob.name };
    if (platformKey && v.by !== platformKey) return { ok: false, reason: "blob not signed by the platform key: " + blob.name };
    if (att.name !== blob.name) return { ok: false, reason: "blob name mismatch: " + blob.name };
    let bytes;
    try { bytes = unb64(blob.bytes); } catch { return { ok: false, reason: "blob bytes not base64: " + blob.name }; }
    if ((await defaultHash(bytes)) !== att.hash) return { ok: false, reason: "blob bytes do not match the signed hash: " + blob.name };
    files[blob.name] = bytes;
  }
  if (!Object.prototype.hasOwnProperty.call(files, manifest.entry)) return { ok: false, reason: "entry not among the verified blobs: " + manifest.entry };
  return { ok: true, entry: manifest.entry, files };
}
