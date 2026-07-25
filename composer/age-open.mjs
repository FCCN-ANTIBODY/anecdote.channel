// composer/age-open.mjs — VENDORED verbatim from data-pile/bin/age-open.mjs (the source of truth; mirror discipline D5, drift-guarded by composer/pile-keeper.test.mjs).
// data-pile/bin/age-open.mjs — OPEN an age file with a held identity, on-device. A decrypt-only slice of
// the age battery (anecdote.channel/composer/age-seal.mjs + age-mint.mjs), inlined self-contained so a
// ported bin needs no `age` binary: bech32 decode, X25519 (WebCrypto), HKDF/HMAC (WebCrypto), age v1
// header parse, ChaCha20-Poly1305 STREAM. No gesture/attest surface — this only opens. Node + browser.
//   decrypt(identity, ageFileBytes) -> Uint8Array plaintext
import { open } from "./chacha20poly1305.mjs";

const enc = new TextEncoder(), dec = new TextDecoder();
const V1 = "age-encryption.org/v1";
const X25519_INFO = enc.encode("age-encryption.org/v1/X25519");
const CHUNK = 64 * 1024;

// ---- bech32 (BIP-173) decode — age keys wear this ---------------------------------------------------
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
function polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) { const b = chk >>> 25; chk = ((chk & 0x1ffffff) << 5) ^ v; for (let i = 0; i < 5; i++) if ((b >> i) & 1) chk ^= GEN[i]; }
  return chk >>> 0;
}
const hrpExpand = (hrp) => { const o = []; for (let i = 0; i < hrp.length; i++) o.push(hrp.charCodeAt(i) >> 5); o.push(0); for (let i = 0; i < hrp.length; i++) o.push(hrp.charCodeAt(i) & 31); return o; };
function bech32Decode(str) {
  const s = str.toLowerCase(); const pos = s.lastIndexOf("1");
  const hrp = s.slice(0, pos); const data = [];
  for (const c of s.slice(pos + 1)) { const d = CHARSET.indexOf(c); if (d === -1) throw new Error("age-open: bad bech32 char"); data.push(d); }
  if (polymod([...hrpExpand(hrp), ...data]) !== 1) throw new Error("age-open: bech32 checksum");
  // 5-bit -> 8-bit
  let acc = 0, bits = 0; const out = [];
  for (const v of data.slice(0, -6)) { acc = (acc << 5) | v; bits += 5; if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); } }
  return { hrp, bytes: Uint8Array.from(out) };
}
function parseIdentity(str) { const { hrp, bytes } = bech32Decode(str); if (hrp !== "age-secret-key-") throw new Error("age-open: not an identity"); return bytes; }

// ---- primitives ------------------------------------------------------------------------------------
const subtle = () => (globalThis.crypto && globalThis.crypto.subtle) || (() => { throw new Error("age-open: no WebCrypto"); })();
const PKCS8_PREFIX = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20]);
const BASEPOINT = (() => { const b = new Uint8Array(32); b[0] = 9; return b; })();
const b64 = (bytes) => { let s = ""; for (const x of bytes) s += String.fromCharCode(x); return btoa(s).replace(/=+$/, ""); };
const unb64 = (str) => { const s = str.replace(/\s/g, ""); const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
function concat(parts) { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; }
function indexOfSeq(buf, seq, from = 0) { outer: for (let i = from; i <= buf.length - seq.length; i++) { for (let j = 0; j < seq.length; j++) if (buf[i + j] !== seq[j]) continue outer; return i; } return -1; }

async function importScalar(scalar) { const p = new Uint8Array(PKCS8_PREFIX.length + 32); p.set(PKCS8_PREFIX, 0); p.set(scalar, PKCS8_PREFIX.length); return subtle().importKey("pkcs8", p, { name: "X25519" }, false, ["deriveBits"]); }
async function x25519(priv, peerPub) { const pub = await subtle().importKey("raw", peerPub, { name: "X25519" }, false, []); return new Uint8Array(await subtle().deriveBits({ name: "X25519", public: pub }, priv, 256)); }
async function hkdf(ikm, salt, info) { const k = await subtle().importKey("raw", ikm, "HKDF", false, ["deriveBits"]); return new Uint8Array(await subtle().deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, 256)); }
async function hmac(key, data) { const k = await subtle().importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return new Uint8Array(await subtle().sign("HMAC", k, data)); }
function streamNonce(counter, last) { const n = new Uint8Array(12); let c = BigInt(counter); for (let i = 10; i >= 0; i--) { n[i] = Number(c & 0xffn); c >>= 8n; } n[11] = last ? 1 : 0; return n; }

// ---- decrypt ---------------------------------------------------------------------------------------
export async function decrypt(identity, ageFile) {
  const scalar = parseIdentity(identity);
  const priv = await importScalar(scalar);
  const myPub = await x25519(priv, BASEPOINT);                      // my recipient pubkey (for the salt)

  const dashIdx = indexOfSeq(ageFile, enc.encode("\n---"));
  if (dashIdx < 0) throw new Error("age-open: not an age file");
  const macLineEnd = indexOfSeq(ageFile, enc.encode("\n"), dashIdx + 4);
  const headerForMac = ageFile.subarray(0, dashIdx + 4);
  const macField = dec.decode(ageFile.subarray(dashIdx + 5, macLineEnd)).trim();
  const payload = ageFile.subarray(macLineEnd + 1);
  const lines = dec.decode(headerForMac).split("\n");

  let fileKey = null;
  for (let i = 1; i < lines.length && !fileKey; i++) {
    const m = /^-> X25519 (\S+)$/.exec(lines[i]);
    if (!m) continue;
    const share = unb64(m[1]); const wrapped = unb64(lines[i + 1]);
    const shared = await x25519(priv, share);
    const wrapKey = await hkdf(shared, concat([share, myPub]), X25519_INFO);
    const fk = open(wrapKey, new Uint8Array(12), wrapped);
    if (fk && fk.length === 16) fileKey = fk;
  }
  if (!fileKey) throw new Error("age-open: wrong identity (no stanza opened)");

  const macKey = await hkdf(fileKey, new Uint8Array(0), enc.encode("header"));
  if (b64(await hmac(macKey, headerForMac)) !== macField) throw new Error("age-open: header MAC mismatch");

  const nonce = payload.subarray(0, 16), body = payload.subarray(16);
  const payloadKey = await hkdf(fileKey, nonce, enc.encode("payload"));
  const out = [];
  for (let pos = 0, counter = 0; ; counter++) {
    const remaining = body.length - pos; const last = remaining <= CHUNK + 16; const take = last ? remaining : CHUNK + 16;
    const pt = open(payloadKey, streamNonce(counter, last), body.subarray(pos, pos + take));
    if (pt === null) throw new Error("age-open: chunk auth failed");
    out.push(pt); pos += take; if (last) break;
  }
  return concat(out);
}
