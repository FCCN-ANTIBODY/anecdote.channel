// composer/ssh-sig.mjs — the SSHSIG battery (the mapped `ssh-keygen -Y sign/-Y verify`, `-lf`, `-y` gap).
// The constellation's bins sign QR/drop/delivery provenance with `ssh-keygen -Y sign` over an Ed25519 key
// and check it with `-Y verify`; the `signer` fields are SSH SHA256 fingerprints. On-device the signer is
// the device's own Ed25519 key (WebCrypto, the same primitive composer/sign.mjs uses) — so this needs no
// OpenSSH private-key file: it produces an armored SSHSIG the real `ssh-keygen -Y verify` accepts, verifies
// any SSHSIG (incl. ones `ssh-keygen -Y sign` made), and renders the ssh-ed25519 public blob + SHA256
// fingerprint. Ed25519 sign/verify + SHA-256/512 come from WebCrypto; only the SSH wire framing is here.
// Verified against the real `ssh-keygen` both directions in the test. Node + browser.

const enc = new TextEncoder();
const MAGIC = enc.encode("SSHSIG");
const KEYTYPE = "ssh-ed25519";
const DEFAULT_HASH = "sha512";                                 // ssh-keygen -Y sign's default

const subtleOf = (opts = {}) => opts.subtle || (globalThis.crypto && globalThis.crypto.subtle) || (() => { throw new Error("ssh-sig: no WebCrypto"); })();

// ---- SSH wire framing: a "string" is a uint32 big-endian length prefix + bytes -----------------------
function sshString(bytes) {
  const b = typeof bytes === "string" ? enc.encode(bytes) : bytes;
  const out = new Uint8Array(4 + b.length);
  new DataView(out.buffer).setUint32(0, b.length, false);
  out.set(b, 4);
  return out;
}
function concat(parts) { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; }

// a cursor reader over SSH strings
function reader(buf) {
  let i = 0;
  return {
    str() { const len = new DataView(buf.buffer, buf.byteOffset).getUint32(i, false); i += 4; const s = buf.subarray(i, i + len); i += len; return s; },
    u32() { const v = new DataView(buf.buffer, buf.byteOffset).getUint32(i, false); i += 4; return v; },
    magic(n) { const s = buf.subarray(i, i + n); i += n; return s; },
    rest() { return buf.subarray(i); },
  };
}

const b64 = (bytes) => { let s = ""; for (const x of bytes) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (str) => { const s = str.replace(/\s/g, ""); const bin = atob(s); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };

// ---- public key blob + fingerprint ------------------------------------------------------------------
// The ssh-ed25519 public blob: string "ssh-ed25519" ‖ string pubkey(32).
export function publicBlob(rawPub) {
  if (!(rawPub instanceof Uint8Array) || rawPub.length !== 32) throw new Error("ssh-sig: ed25519 public key wants 32 bytes");
  return concat([sshString(KEYTYPE), sshString(rawPub)]);
}
// "ssh-ed25519 AAAA… [comment]" — the authorized_keys / *.pub one-liner.
export function publicKeyLine(rawPub, comment = "") {
  return `${KEYTYPE} ${b64(publicBlob(rawPub))}${comment ? " " + comment : ""}`;
}
// The SHA256 fingerprint ssh-keygen -lf prints: "SHA256:" + base64(sha256(blob)) with padding stripped.
export async function fingerprint(rawPubOrBlob, opts = {}) {
  const subtle = subtleOf(opts);
  const blob = rawPubOrBlob.length === 32 ? publicBlob(rawPubOrBlob) : rawPubOrBlob;
  const h = new Uint8Array(await subtle.digest("SHA-256", blob));
  return "SHA256:" + b64(h).replace(/=+$/, "");
}

// pull the raw 32-byte pubkey out of an ssh-ed25519 blob (or a "ssh-ed25519 AAAA…" line)
export function rawFromPublic(blobOrLine) {
  const blob = typeof blobOrLine === "string" ? unb64(blobOrLine.trim().split(/\s+/)[1]) : blobOrLine;
  const r = reader(blob);
  const type = new TextDecoder().decode(r.str());
  if (type !== KEYTYPE) throw new Error("ssh-sig: not an ssh-ed25519 key (" + type + ")");
  return r.str();
}

// ---- WebCrypto Ed25519 identity (the on-device signer) ----------------------------------------------
export async function generateIdentity(opts = {}) {
  const subtle = subtleOf(opts);
  const pair = await subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  const rawPub = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, rawPub, fingerprint: await fingerprint(rawPub, opts) };
}

// ---- the SSHSIG signed-data preimage (what the Ed25519 signature covers) -----------------------------
async function signedData(subtle, namespace, hashAlg, message) {
  const H = new Uint8Array(await subtle.digest(hashAlg === "sha256" ? "SHA-256" : "SHA-512", typeof message === "string" ? enc.encode(message) : message));
  return concat([MAGIC, sshString(namespace), sshString(new Uint8Array(0)), sshString(hashAlg), sshString(H)]);
}

// ---- sign: produce an armored SSHSIG (ssh-keygen -Y sign) --------------------------------------------
export async function sign(message, { namespace, privateKey, rawPub, hash = DEFAULT_HASH }, opts = {}) {
  const subtle = subtleOf(opts);
  if (!namespace) throw new Error("ssh-sig: sign needs a namespace (-n)");
  const preimage = await signedData(subtle, namespace, hash, message);
  const sig = new Uint8Array(await subtle.sign("Ed25519", privateKey, preimage));
  const sigBlob = concat([sshString(KEYTYPE), sshString(sig)]);
  const blob = concat([
    MAGIC,
    new Uint8Array([0, 0, 0, 1]),                              // uint32 version = 1
    sshString(publicBlob(rawPub)),
    sshString(namespace),
    sshString(new Uint8Array(0)),                             // reserved
    sshString(hash),
    sshString(sigBlob),
  ]);
  return armor(blob);
}

// ---- verify: check any armored SSHSIG (incl. ssh-keygen -Y sign output) ------------------------------
// Returns { ok, by: SHA256 fingerprint, rawPub, namespace }. `expect.namespace` enforces the domain, and
// `expect.rawPub` pins the signer (verify-from-anyone; the pin is the trust decision, as elsewhere).
export async function verify(message, armored, expect = {}, opts = {}) {
  const subtle = subtleOf(opts);
  const blob = dearmor(armored);
  const r = reader(blob);
  if (new TextDecoder().decode(r.magic(6)) !== "SSHSIG") return { ok: false, reason: "not an SSHSIG" };
  if (r.u32() !== 1) return { ok: false, reason: "unsupported SSHSIG version" };
  const pubBlob = r.str();
  const namespace = new TextDecoder().decode(r.str());
  r.str();                                                     // reserved
  const hash = new TextDecoder().decode(r.str());
  const sigField = r.str();
  const sr = reader(sigField);
  if (new TextDecoder().decode(sr.str()) !== KEYTYPE) return { ok: false, reason: "not an ed25519 signature" };
  const sig = sr.str();
  const rawPub = rawFromPublic(pubBlob);

  if (expect.namespace && expect.namespace !== namespace) return { ok: false, reason: "namespace mismatch", namespace };
  const preimage = await signedData(subtle, namespace, hash, message);
  const key = await subtle.importKey("raw", rawPub, "Ed25519", false, ["verify"]);
  const good = await subtle.verify("Ed25519", key, sig, preimage);
  if (!good) return { ok: false, reason: "bad signature" };
  const by = await fingerprint(rawPub, opts);
  if (expect.rawPub && !eq(expect.rawPub, rawPub)) return { ok: false, reason: "not the pinned signer", by };
  return { ok: true, by, rawPub, namespace };
}

const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---- PEM armor (-----BEGIN SSH SIGNATURE----- … 70-col base64 … -----END-----) -----------------------
function armor(blob) {
  const body = b64(blob).replace(/(.{70})/g, "$1\n").replace(/\n$/, "");
  return `-----BEGIN SSH SIGNATURE-----\n${body}\n-----END SSH SIGNATURE-----\n`;
}
function dearmor(text) {
  const m = /-----BEGIN SSH SIGNATURE-----\n([\s\S]*?)\n-----END SSH SIGNATURE-----/.exec(text);
  if (!m) throw new Error("ssh-sig: not an armored SSH signature");
  return unb64(m[1]);
}
