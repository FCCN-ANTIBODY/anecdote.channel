// composer/chacha20poly1305.mjs — ChaCha20-Poly1305 AEAD (RFC 8439), pure JS. WebCrypto has no ChaCha20
// (only AES-GCM), and age's file format is ChaCha20-Poly1305 through and through — the recipient stanza
// and every payload chunk — so this is the one primitive the age battery (age-seal.mjs) cannot borrow
// from the platform. Deliberately plain: Poly1305 uses BigInt (mod 2^130-5) for auditability over speed;
// our payloads are pile-sized, not streams. Verified against the RFC 8439 §2.8.2 test vector AND, in
// age-seal, against the real `age` binary end-to-end. Node + browser (no imports).

const rotl = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;

// ---- ChaCha20 (RFC 8439 §2.3) ----------------------------------------------------------------------
function quarter(s, a, b, c, d) {
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 16);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 12);
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 8);
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 7);
}

const CONST = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]; // "expand 32-byte k"
const rd32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

// One 64-byte keystream block for (key, 32-bit counter, 12-byte nonce).
function block(key, counter, nonce) {
  const s = new Uint32Array(16);
  s[0] = CONST[0]; s[1] = CONST[1]; s[2] = CONST[2]; s[3] = CONST[3];
  for (let i = 0; i < 8; i++) s[4 + i] = rd32(key, i * 4);
  s[12] = counter >>> 0;
  s[13] = rd32(nonce, 0); s[14] = rd32(nonce, 4); s[15] = rd32(nonce, 8);
  const w = s.slice();
  for (let i = 0; i < 10; i++) {
    quarter(w, 0, 4, 8, 12); quarter(w, 1, 5, 9, 13); quarter(w, 2, 6, 10, 14); quarter(w, 3, 7, 11, 15);
    quarter(w, 0, 5, 10, 15); quarter(w, 1, 6, 11, 12); quarter(w, 2, 7, 8, 13); quarter(w, 3, 4, 9, 14);
  }
  const out = new Uint8Array(64);
  for (let i = 0; i < 16; i++) {
    const v = (w[i] + s[i]) >>> 0;
    out[i * 4] = v & 0xff; out[i * 4 + 1] = (v >>> 8) & 0xff; out[i * 4 + 2] = (v >>> 16) & 0xff; out[i * 4 + 3] = (v >>> 24) & 0xff;
  }
  return out;
}

// XOR data with the ChaCha20 keystream starting at `counter` (RFC 8439 §2.4).
function chacha20(key, counter, nonce, data) {
  const out = new Uint8Array(data.length);
  for (let off = 0; off < data.length; off += 64) {
    const ks = block(key, counter + (off >>> 6), nonce);
    const n = Math.min(64, data.length - off);
    for (let i = 0; i < n; i++) out[off + i] = data[off + i] ^ ks[i];
  }
  return out;
}

// ---- Poly1305 (RFC 8439 §2.5), BigInt for clarity --------------------------------------------------
const P = (1n << 130n) - 5n;
function poly1305(msg, key) {
  let r = 0n, s = 0n;
  for (let i = 0; i < 16; i++) r |= BigInt(key[i]) << (8n * BigInt(i));
  for (let i = 0; i < 16; i++) s |= BigInt(key[16 + i]) << (8n * BigInt(i));
  r &= 0x0ffffffc0ffffffc0ffffffc0fffffffn;                    // clamp
  let acc = 0n;
  for (let off = 0; off < msg.length; off += 16) {
    const n = Math.min(16, msg.length - off);
    let blk = 0n;
    for (let i = 0; i < n; i++) blk |= BigInt(msg[off + i]) << (8n * BigInt(i));
    blk |= 1n << (8n * BigInt(n));                             // the high bit past the block bytes
    acc = ((acc + blk) * r) % P;
  }
  acc = (acc + s) & ((1n << 128n) - 1n);
  const tag = new Uint8Array(16);
  for (let i = 0; i < 16; i++) tag[i] = Number((acc >> (8n * BigInt(i))) & 0xffn);
  return tag;
}

const pad16 = (n) => (n % 16 === 0 ? 0 : 16 - (n % 16));
function le64(n) { const b = new Uint8Array(8); let x = BigInt(n); for (let i = 0; i < 8; i++) { b[i] = Number(x & 0xffn); x >>= 8n; } return b; }

function concat(parts) {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// the Poly1305 input for the AEAD: aad ‖ pad ‖ ct ‖ pad ‖ len(aad) ‖ len(ct)  (RFC 8439 §2.8)
function macData(aad, ct) {
  return concat([aad, new Uint8Array(pad16(aad.length)), ct, new Uint8Array(pad16(ct.length)), le64(aad.length), le64(ct.length)]);
}

const ct_eq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };

// ---- AEAD (RFC 8439 §2.8) — seal → ct‖tag ; open → plaintext | null --------------------------------
export function seal(key, nonce, plaintext, aad = new Uint8Array(0)) {
  const otk = block(key, 0, nonce).subarray(0, 32);           // one-time Poly1305 key from counter-0 block
  const ct = chacha20(key, 1, nonce, plaintext);
  const tag = poly1305(macData(aad, ct), otk);
  return concat([ct, tag]);
}

export function open(key, nonce, sealed, aad = new Uint8Array(0)) {
  if (sealed.length < 16) return null;
  const ct = sealed.subarray(0, sealed.length - 16);
  const tag = sealed.subarray(sealed.length - 16);
  const otk = block(key, 0, nonce).subarray(0, 32);
  if (!ct_eq(poly1305(macData(aad, ct), otk), tag)) return null;
  return chacha20(key, 1, nonce, ct);
}

export { chacha20, poly1305, block };
