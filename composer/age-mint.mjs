// composer/age-mint.mjs — mint an age X25519 identity IN THE BROWSER, so a pile's bootstrap never
// needs a VPS (civic-node OPEN-QUESTIONS §P: "age-keygen without a VPS"; docs/TENANCY.md). This is
// rework slice 2 (civic-node#58): the recipient keypair mints where the operator is — on the device,
// behind the platform gesture — and `age` remains an EXPORT FORMAT, not a keygen environment.
//
// A pure core like the rest: no DOM, no network, no event loop — one primitive, WebCrypto's
// SubtleCrypto (X25519 via generateKey/deriveBits, Baseline in evergreen browsers since 2025; this
// module feature-detects and throws a plain sentence where it is missing, vendoring nothing). The
// only thing implemented here is ENCODING — bech32 (BIP-173), the format age keys wear — which is a
// wire format, not cryptography; the vendorless rule stands.
//
//   mintAgeIdentity() -> { identity: "AGE-SECRET-KEY-1…", recipient: "age1…" }
//   recipientOf(identity) -> "age1…"        // age-keygen -y, in WebCrypto: derive against the basepoint
//   parseRecipient / parseIdentity          // decode + validate (checksum, hrp, length)
//   attestRecipient(recipient, identity, cred) // gesture-gated export provenance (gesture.mjs)
//
// Custody: the minted identity is a STRING because age's interop demands one — hold it Elevated
// (the trove / private keyring), show the RECIPIENT freely (display / QR / copy; it only encrypts),
// and let the secret cross to nothing: the pile's `age_recipient` and `keys/pile.age.pub` need only
// the public half, so a hosted provisioner (slice 3) never touches the private identity.

import { gatedAttest } from "./gesture.mjs";

export const RECIPIENT_HRP = "age";
export const IDENTITY_HRP = "age-secret-key-";
export const ATTEST_SCHEMA = "anecdote.age-recipient/v1";

// ---- bech32 (BIP-173) — encoding only, no crypto -------------------------------------------------

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values) {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}

function hrpExpand(hrp) {
  const out = [];
  for (const c of hrp) out.push(c.charCodeAt(0) >>> 5);
  out.push(0);
  for (const c of hrp) out.push(c.charCodeAt(0) & 31);
  return out;
}

function convertBits(data, from, to, pad) {
  let acc = 0, bits = 0;
  const out = [], maxv = (1 << to) - 1;
  for (const v of data) {
    if (v < 0 || v >>> from) throw new Error("age-mint: bech32 value out of range");
    acc = (acc << from) | v;
    bits += from;
    while (bits >= to) { bits -= to; out.push((acc >>> bits) & maxv); }
  }
  if (pad) { if (bits) out.push((acc << (to - bits)) & maxv); }
  else if (bits >= from || (acc << (to - bits)) & maxv) throw new Error("age-mint: bech32 padding invalid");
  return out;
}

export function bech32Encode(hrp, bytes) {
  const data = convertBits(bytes, 8, 5, true);
  const values = [...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const mod = polymod(values) ^ 1;
  let out = hrp + "1";
  for (const d of data) out += CHARSET[d];
  for (let i = 0; i < 6; i++) out += CHARSET[(mod >>> (5 * (5 - i))) & 31];
  return out;
}

export function bech32Decode(str) {
  const s = String(str || "");
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) throw new Error("age-mint: bech32 mixed case");
  const lc = s.toLowerCase();
  const pos = lc.lastIndexOf("1");
  if (pos < 1 || pos + 7 > lc.length || lc.length > 1023) throw new Error("age-mint: bech32 shape invalid");
  const hrp = lc.slice(0, pos);
  const data = [];
  for (const c of lc.slice(pos + 1)) {
    const d = CHARSET.indexOf(c);
    if (d === -1) throw new Error("age-mint: bech32 character invalid");
    data.push(d);
  }
  if (polymod([...hrpExpand(hrp), ...data]) !== 1) throw new Error("age-mint: bech32 checksum failed");
  return { hrp, bytes: new Uint8Array(convertBits(data.slice(0, -6), 5, 8, false)) };
}

// ---- the age formats ------------------------------------------------------------------------------

export function encodeRecipient(pub) {
  if (!(pub instanceof Uint8Array) || pub.length !== 32) throw new Error("age-mint: recipient wants 32 bytes");
  return bech32Encode(RECIPIENT_HRP, pub);
}

export function encodeIdentity(scalar) {
  if (!(scalar instanceof Uint8Array) || scalar.length !== 32) throw new Error("age-mint: identity wants 32 bytes");
  return bech32Encode(IDENTITY_HRP, scalar).toUpperCase();
}

export function parseRecipient(str) {
  const { hrp, bytes } = bech32Decode(str);
  if (hrp !== RECIPIENT_HRP) throw new Error(`age-mint: not a recipient (hrp ${hrp})`);
  if (bytes.length !== 32) throw new Error("age-mint: recipient payload not 32 bytes");
  return bytes;
}

export function parseIdentity(str) {
  const { hrp, bytes } = bech32Decode(str);
  if (hrp !== IDENTITY_HRP) throw new Error(`age-mint: not an identity (hrp ${hrp})`);
  if (bytes.length !== 32) throw new Error("age-mint: identity payload not 32 bytes");
  return bytes;
}

// ---- minting & deriving (platform WebCrypto X25519) ----------------------------------------------

const ALG = { name: "X25519" };
// PKCS#8 wrapper for a raw X25519 scalar (OID 1.3.101.110) — a fixed 16-byte DER prefix, same trick
// the constellation's Ed25519 handling uses. Needed because WebCrypto imports private OKP keys only
// as pkcs8/jwk, and the jwk form demands the public half we may be trying to derive.
const PKCS8_PREFIX = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20]);
const BASEPOINT = (() => { const b = new Uint8Array(32); b[0] = 9; return b; })();

function subtleOf(opts = {}) {
  const s = opts.subtle || (globalThis.crypto && globalThis.crypto.subtle);
  if (!s) throw new Error("age-mint: no WebCrypto SubtleCrypto available");
  return s;
}

function fromB64url(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Mint a fresh age identity on the device. Both halves come back as age-formatted strings; hold the
// identity Elevated, hand out the recipient. Throws one plain sentence where X25519 is unsupported.
export async function mintAgeIdentity(opts = {}) {
  const subtle = subtleOf(opts);
  let pair;
  try {
    pair = await subtle.generateKey(ALG, true, ["deriveBits"]);
  } catch (e) {
    throw new Error("age-mint: this browser has no WebCrypto X25519 (Baseline since 2025) — use age-keygen instead");
  }
  const jwk = await subtle.exportKey("jwk", pair.privateKey);
  const pub = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  return { identity: encodeIdentity(fromB64url(jwk.d)), recipient: encodeRecipient(pub) };
}

// age-keygen -y, in WebCrypto: the public key IS the shared secret with the curve basepoint (u=9),
// so deriveBits(identity, basepoint) re-derives the recipient with no second implementation of the
// curve. Lets a held identity re-print its recipient (and lets a test cross-check the real tool).
export async function recipientOf(identity, opts = {}) {
  const subtle = subtleOf(opts);
  const scalar = parseIdentity(identity);
  const pkcs8 = new Uint8Array(PKCS8_PREFIX.length + 32);
  pkcs8.set(PKCS8_PREFIX, 0); pkcs8.set(scalar, PKCS8_PREFIX.length);
  const priv = await subtle.importKey("pkcs8", pkcs8, ALG, false, ["deriveBits"]);
  const base = await subtle.importKey("raw", BASEPOINT, ALG, false, []);
  const pub = new Uint8Array(await subtle.deriveBits({ ...ALG, public: base }, priv, 256));
  return encodeRecipient(pub);
}

// ---- gesture-gated export provenance ---------------------------------------------------------------

// Bind a freshly minted recipient to the device identity behind the platform gesture (gesture.mjs):
// the signed artifact says "this device's owner, verified by a user-present gesture, minted this
// recipient" — the provenance a pile.yml entry (or a slice-3 provisioner) can carry without the
// private identity ever crossing. `at` is injectable so the artifact is deterministic under test.
export async function attestRecipient(recipient, identity, cred, deps = {}) {
  parseRecipient(recipient); // refuse to attest a malformed or non-recipient string
  const gate = deps.gate || gatedAttest;
  const obj = { schema: ATTEST_SCHEMA, recipient, ...(deps.at ? { at: deps.at } : {}) };
  return gate(obj, identity, cred, deps);
}
