// composer/qr-sign.mjs — the QR PROVENANCE signature (docs/qr-provenance.md), the last poll bit. The token
// (qr-mint.mjs) authorizes a reply into a Tell's mailbox; this SIGNATURE proves the QR's origin + integrity
// to anyone holding the signer's public key, registry-free — the "worth processing at all" gate.
//
// Key model (the one you picked): anecdote signs with its OWN device identity (composer/sign.mjs — an
// Ed25519 WebCrypto key), and the operator enrolls that key in the Tell's accepted signers. So a verified
// signer TRIGGERS, it does not transfer authority (docs/qr-provenance.md's "local friend list").
//
//   WHERE THE KEYS LIVE:
//   - anecdote's private key: a non-extractable CryptoKey in domain-scoped IndexedDB (never serialized;
//     see sign.mjs). Its public half is `identity.raw` (32 bytes). Its SSH fingerprint is the QR's `kid`.
//   - the Tell's accepted signers: keys/tell.signers (OpenSSH allowed_signers), principal `tell`, namespace
//     `tell-poll`. Enroll anecdote by appending the line allowedSignersLine() emits.
//
// We emit a byte-compatible OpenSSH SSHSIG (the same artifact `ssh-keygen -Y sign` makes), so the Tell's
// existing `bin/authz` (`ssh-keygen -Y verify`) accepts it UNCHANGED — the engine stays untouched. Ed25519
// is deterministic, so our blob equals ssh-keygen's for the same key + message.

const te = new TextEncoder();
const MAGIC = te.encode("SSHSIG");
const NS = "tell-poll";               // TL_QR_SIG_NS — must match bin/authz
const HASH = "sha512";                // ssh-keygen -Y sign's default inner hash

function subtle() {
  const s = globalThis.crypto && globalThis.crypto.subtle;
  if (!s) throw new Error("qr-sign: needs WebCrypto SubtleCrypto (runs Elevated)");
  return s;
}
function u32(n) { return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]); }
function cat(...as) { let n = 0; for (const a of as) n += a.length; const o = new Uint8Array(n); let i = 0; for (const a of as) { o.set(a, i); i += a.length; } return o; }
// SSH `string`: uint32 length-prefixed bytes (big-endian).
function sshStr(x) { const b = typeof x === "string" ? te.encode(x) : x; return cat(u32(b.length), b); }
const sha = async (alg, bytes) => new Uint8Array(await subtle().digest(alg, bytes));

// The signer's public key in SSH wire form: string "ssh-ed25519" || string <32-byte raw key>.
function pubBlob(raw) { return cat(sshStr("ssh-ed25519"), sshStr(raw)); }

// The SSH key fingerprint: "SHA256:" + unpadded-base64( sha256(pubBlob) ) — exactly `ssh-keygen -lf`.
export async function sshFingerprint(identity) {
  return "SHA256:" + b64(await sha("SHA-256", pubBlob(identity.raw))).replace(/=+$/, "");
}

// The line to append to the Tell's keys/tell.signers so it accepts this key (principal defaults to `tell`,
// the principal bin/authz verifies under). This is the ONE cross-repo enrollment step.
export function allowedSignersLine(identity, { principal = "tell" } = {}) {
  return `${principal} ssh-ed25519 ${b64(pubBlob(identity.raw))}`;
}

// The armored OpenSSH signature PEM (what `ssh-keygen -Y sign` writes; base64 wrapped at 70 cols).
function armor(blob) {
  const b = b64(blob), lines = [];
  for (let i = 0; i < b.length; i += 70) lines.push(b.slice(i, i + 70));
  return "-----BEGIN SSH SIGNATURE-----\n" + lines.join("\n") + "\n-----END SSH SIGNATURE-----\n";
}

// Sign a canonical preimage (qr-mint.mjs's qrCanon output) with the device identity. The message signed is
// the canon PLUS a trailing newline — matching bin/qr's `printf '%s\n' … | tl_qr_canon` (sort leaves the
// final newline). Returns { sig, kid, armored }: `sig` is base64 of the armored PEM (what rides in the QR,
// mirroring bin/qr's `base64 -w0`), `kid` is the SSH fingerprint.
export async function signCanon(canon, identity, { namespace = NS } = {}) {
  const message = te.encode(canon + "\n");
  const H = await sha("SHA-512", message);
  const empty = new Uint8Array(0);
  // What Ed25519 actually signs (SSHSIG "blob to sign"): MAGIC || ns || reserved || hashalg || H(message).
  const toSign = cat(MAGIC, sshStr(namespace), sshStr(empty), sshStr(HASH), sshStr(H));
  const raw = new Uint8Array(await subtle().sign({ name: "Ed25519" }, identity.privateKey, toSign));
  const sigBlob = cat(sshStr("ssh-ed25519"), sshStr(raw));
  // The full SSHSIG blob: MAGIC || version=1 || publickey || ns || reserved || hashalg || signature.
  const blob = cat(MAGIC, u32(1), sshStr(pubBlob(identity.raw)), sshStr(namespace), sshStr(empty), sshStr(HASH), sshStr(sigBlob));
  const armored = armor(blob);
  return { sig: b64(te.encode(armored)), kid: await sshFingerprint(identity), armored, namespace };
}

function b64(u8) {
  if (typeof Buffer !== "undefined") return Buffer.from(u8).toString("base64");
  let s = ""; for (const x of u8) s += String.fromCharCode(x); return btoa(s);
}
