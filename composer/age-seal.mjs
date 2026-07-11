// composer/age-seal.mjs — the ENCRYPT/DECRYPT half of the age battery (the mapped `age`/`age -d` gap).
// age-mint.mjs already mints the identity and derives the recipient (age-keygen); this seals and opens
// the age v1 file itself: an X25519 recipient stanza (the file key wrapped to each recipient) + a
// ChaCha20-Poly1305 STREAM payload, with an HMAC over the header. WebCrypto does the asymmetric parts it
// can (X25519 ECDH, HKDF-SHA256, HMAC-SHA256); chacha20poly1305.mjs does the AEAD it can't. Verified
// against the real `age` binary both ways in the test. Node + browser.
//
//   encrypt(recipients, plaintext) -> Uint8Array   (recipients: "age1…" or an array of them)
//   decrypt(identity, ageFile)     -> Uint8Array    (identity: "AGE-SECRET-KEY-1…")

import { parseRecipient, parseIdentity, recipientOf } from "./age-mint.mjs";
import { seal, open } from "./chacha20poly1305.mjs";

const V1 = "age-encryption.org/v1";
const X25519_INFO = new TextEncoder().encode("age-encryption.org/v1/X25519");
const CHUNK = 64 * 1024;                                        // STREAM plaintext chunk size
const enc = new TextEncoder(), dec = new TextDecoder();

// ---- small helpers ---------------------------------------------------------------------------------
const b64 = (bytes) => { let s = ""; for (const x of bytes) s += String.fromCharCode(x); return btoa(s).replace(/=+$/, ""); };
const unb64 = (str) => { const s = str.replace(/\s/g, ""); const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
function concat(parts) { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; }
function indexOfSeq(buf, seq, from = 0) {
  outer: for (let i = from; i <= buf.length - seq.length; i++) { for (let j = 0; j < seq.length; j++) if (buf[i + j] !== seq[j]) continue outer; return i; } return -1;
}
const subtleOf = (opts = {}) => opts.subtle || (globalThis.crypto && globalThis.crypto.subtle) || (() => { throw new Error("age-seal: no WebCrypto"); })();
const randomBytes = (n, opts = {}) => (opts.random ? opts.random(n) : globalThis.crypto.getRandomValues(new Uint8Array(n)));

// PKCS#8 wrapper for a raw X25519 scalar (OID 1.3.101.110) — the same DER prefix trick age-mint uses.
const PKCS8_PREFIX = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20]);

async function hkdf(subtle, ikm, salt, info, len = 32) {
  const key = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8));
}
async function hmac(subtle, key, data) {
  const k = await subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle.sign("HMAC", k, data));
}
// X25519(scalar_or_privKey, peerPub32) -> 32-byte shared secret, via WebCrypto deriveBits.
async function x25519(subtle, priv, peerPub) {
  const pub = await subtle.importKey("raw", peerPub, { name: "X25519" }, false, []);
  return new Uint8Array(await subtle.deriveBits({ name: "X25519", public: pub }, priv, 256));
}
async function importScalar(subtle, scalar) {
  const pkcs8 = new Uint8Array(PKCS8_PREFIX.length + 32); pkcs8.set(PKCS8_PREFIX, 0); pkcs8.set(scalar, PKCS8_PREFIX.length);
  return subtle.importKey("pkcs8", pkcs8, { name: "X25519" }, false, ["deriveBits"]);
}

// STREAM nonce: 11-byte big-endian counter ‖ 1-byte last-chunk flag.
function streamNonce(counter, last) {
  const n = new Uint8Array(12); let c = BigInt(counter);
  for (let i = 10; i >= 0; i--) { n[i] = Number(c & 0xffn); c >>= 8n; }
  n[11] = last ? 1 : 0; return n;
}

// ---- encrypt ---------------------------------------------------------------------------------------
export async function encrypt(recipients, plaintext, opts = {}) {
  const subtle = subtleOf(opts);
  const recips = (Array.isArray(recipients) ? recipients : [recipients]).map(parseRecipient);
  if (!recips.length) throw new Error("age-seal: need at least one recipient");
  const pt = typeof plaintext === "string" ? enc.encode(plaintext) : plaintext;
  const fileKey = randomBytes(16, opts);

  // one X25519 stanza per recipient: wrap the file key to that recipient.
  let stanzas = "";
  for (const rpub of recips) {
    const eph = await subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]);
    const share = new Uint8Array(await subtle.exportKey("raw", eph.publicKey));
    const shared = await x25519(subtle, eph.privateKey, rpub);
    const wrapKey = await hkdf(subtle, shared, concat([share, rpub]), X25519_INFO);
    const wrapped = seal(wrapKey, new Uint8Array(12), fileKey);       // nonce = 12 zero bytes
    stanzas += `-> X25519 ${b64(share)}\n${b64(wrapped)}\n`;
  }

  const headerForMac = enc.encode(`${V1}\n${stanzas}---`);
  const macKey = await hkdf(subtle, fileKey, new Uint8Array(0), enc.encode("header"));
  const mac = await hmac(subtle, macKey, headerForMac);
  const header = enc.encode(`${V1}\n${stanzas}--- ${b64(mac)}\n`);

  // payload: 16-byte nonce, then the ChaCha20-Poly1305 STREAM.
  const nonce = randomBytes(16, opts);
  const payloadKey = await hkdf(subtle, fileKey, nonce, enc.encode("payload"));
  const chunks = [];
  if (pt.length === 0) {
    chunks.push(seal(payloadKey, streamNonce(0, true), pt));
  } else {
    for (let pos = 0, counter = 0; pos < pt.length; counter++) {
      const take = Math.min(CHUNK, pt.length - pos);
      const last = pos + take === pt.length;
      chunks.push(seal(payloadKey, streamNonce(counter, last), pt.subarray(pos, pos + take)));
      pos += take;
    }
  }
  return concat([header, nonce, ...chunks]);
}

// ---- decrypt ---------------------------------------------------------------------------------------
export async function decrypt(identity, ageFile, opts = {}) {
  const subtle = subtleOf(opts);
  const scalar = parseIdentity(identity);
  const myPub = parseRecipient(await recipientOf(identity, opts));       // needed for the stanza salt
  const priv = await importScalar(subtle, scalar);

  // split header (ASCII) from the binary payload at the "--- <mac>\n" line.
  const dashIdx = indexOfSeq(ageFile, enc.encode("\n---"));
  if (dashIdx < 0) throw new Error("age-seal: not an age file (no header terminator)");
  const macLineEnd = indexOfSeq(ageFile, enc.encode("\n"), dashIdx + 4);
  if (macLineEnd < 0) throw new Error("age-seal: truncated header");
  const headerForMac = ageFile.subarray(0, dashIdx + 4);                 // through the "---"
  const macField = dec.decode(ageFile.subarray(dashIdx + 5, macLineEnd)).trim();  // after "--- "
  const payload = ageFile.subarray(macLineEnd + 1);
  const headerText = dec.decode(headerForMac);
  if (!headerText.startsWith(V1)) throw new Error("age-seal: unsupported version");

  // walk the stanzas; try each X25519 stanza until one unwraps the file key.
  const lines = headerText.split("\n");
  let fileKey = null;
  for (let i = 1; i < lines.length && !fileKey; i++) {
    const m = /^-> X25519 (\S+)$/.exec(lines[i]);
    if (!m) continue;
    const share = unb64(m[1]);
    const wrapped = unb64(lines[i + 1]);
    const shared = await x25519(subtle, priv, share);
    const wrapKey = await hkdf(subtle, shared, concat([share, myPub]), X25519_INFO);
    const fk = open(wrapKey, new Uint8Array(12), wrapped);
    if (fk && fk.length === 16) fileKey = fk;
  }
  if (!fileKey) throw new Error("age-seal: no stanza opened by this identity (wrong recipient?)");

  // authenticate the header before trusting the payload.
  const macKey = await hkdf(subtle, fileKey, new Uint8Array(0), enc.encode("header"));
  const wantMac = b64(await hmac(subtle, macKey, headerForMac));
  if (wantMac !== macField) throw new Error("age-seal: header MAC mismatch (tampered or wrong key)");

  // STREAM: 16-byte nonce, then ChaCha20-Poly1305 chunks of CHUNK+16 (last is 16..CHUNK+16).
  const nonce = payload.subarray(0, 16);
  const body = payload.subarray(16);
  const payloadKey = await hkdf(subtle, fileKey, nonce, enc.encode("payload"));
  const out = [];
  for (let pos = 0, counter = 0; ; counter++) {
    const remaining = body.length - pos;
    const last = remaining <= CHUNK + 16;
    const take = last ? remaining : CHUNK + 16;
    const pt = open(payloadKey, streamNonce(counter, last), body.subarray(pos, pos + take));
    if (pt === null) throw new Error("age-seal: payload chunk failed authentication");
    out.push(pt); pos += take;
    if (last) break;
  }
  return concat(out);
}
