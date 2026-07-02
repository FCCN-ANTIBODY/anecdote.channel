// composer/gesture.mjs — the platform-authenticator GATE (docs/consent-surface.md). The unforgeable,
// human-present consent surface: a WebAuthn/passkey ceremony the page cannot paint and a script cannot
// synthesize. We keep the device Ed25519 identity (for Tell interop — qr-provenance.md) and GATE its use
// behind this gesture, so a swapped queen (service worker) or a compromised page can show you pixels but
// cannot sign as you without your live presence at an OS prompt. "Make them do something they don't want
// to do to proceed."
//
// Binding: the gesture's CHALLENGE is the hash of the exact object being signed, and the verified assertion
// is folded INTO the signed bytes. So a valid Ed25519 signature CONTAINS proof-of-presence for that exact
// act — an old assertion can't be replayed (different challenge), a forged one is impossible (no passkey),
// and an intruder who skips the gesture can only emit an artifact that is visibly ungated (rejected by a
// gesture-requiring verifier) — the "imperfect intrusion leaves a smudge."
//
// Offline: `get()` (using a passkey) is a fully-local browser↔authenticator ceremony; `create()` works
// offline too because we are our own relying party and store the pubkey ourselves. Lives in the Elevated
// page (WebAuthn needs a real secure-context origin — never the null-origin data:chamber).
//
// Stronger follow-on (noted, not built): derive an at-rest wrap key from the passkey (WebAuthn PRF) so the
// Ed25519 key is *cryptographically* unusable without the gesture, not just procedurally gated.

import { attest, verifyAttestation, canonicalize } from "./sign.mjs";

const te = new TextEncoder(), td = new TextDecoder();
function subtle() { const s = globalThis.crypto && globalThis.crypto.subtle; if (!s) throw new Error("gesture: no WebCrypto"); return s; }
const sha256 = async (bytes) => new Uint8Array(await subtle().digest("SHA-256", bytes));

// ---- enroll / assert (browser; need navigator.credentials) -------------------------------------------

// Create a platform passkey and record what we need to verify its future assertions ourselves (we are the
// relying party — the pubkey lives with us, no server). Returns a storable credential descriptor.
export async function enrollGesture({ rpId, rpName = "anecdote.channel", userName = "you", userId } = {}) {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { id: rpId, name: rpName },
    user: { id: userId || crypto.getRandomValues(new Uint8Array(16)), name: userName, displayName: userName },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -8 }],  // ES256, EdDSA
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
    attestation: "none", timeout: 60000,
  } });
  const r = cred.response;
  return {
    credId: b64url(new Uint8Array(cred.rawId)),
    spki: b64(new Uint8Array(r.getPublicKey())),        // DER SubjectPublicKeyInfo — import directly (no CBOR)
    alg: r.getPublicKeyAlgorithm(),                      // -7 ES256 | -8 EdDSA
    rpId, origin: location.origin,
  };
}

// Ask the authenticator to sign `challenge` with user verification. Fails (rejects) if the human isn't
// verified — that failure IS the gate. Returns the raw assertion bytes.
export async function assertGesture(challenge, { rpId, credId } = {}) {
  const cred = await navigator.credentials.get({ publicKey: {
    challenge, rpId, userVerification: "required", timeout: 60000,
    allowCredentials: credId ? [{ type: "public-key", id: unb64url(credId) }] : undefined,
  } });
  const r = cred.response;
  return {
    credId: b64url(new Uint8Array(cred.rawId)),
    authenticatorData: new Uint8Array(r.authenticatorData),
    clientDataJSON: new Uint8Array(r.clientDataJSON),
    signature: new Uint8Array(r.signature),
  };
}

// ---- verify an assertion locally (pure; runs anywhere with WebCrypto) --------------------------------

export async function verifyAssertion(a, { spki, alg = -7, challenge, rpId, origin } = {}) {
  const errors = [];
  let cd; try { cd = JSON.parse(td.decode(a.clientDataJSON)); } catch { return { ok: false, uv: false, errors: ["bad clientDataJSON"] }; }
  if (cd.type !== "webauthn.get") errors.push("wrong type");
  if (cd.challenge !== b64url(challenge)) errors.push("challenge mismatch");     // binds to the exact act
  if (origin && cd.origin !== origin) errors.push("origin mismatch");
  const rpHash = await sha256(te.encode(rpId));
  if (!eqBytes(rpHash, a.authenticatorData.slice(0, 32))) errors.push("rpIdHash mismatch");
  const flags = a.authenticatorData[32];
  if (!(flags & 0x01)) errors.push("user-presence flag unset");
  if (!(flags & 0x04)) errors.push("user-verification flag unset");             // the "make them do it" bit
  const signedData = concat(a.authenticatorData, await sha256(a.clientDataJSON));
  let ok = false;
  try {
    if (alg === -8) {
      const key = await subtle().importKey("spki", unb64(spki), { name: "Ed25519" }, false, ["verify"]);
      ok = await subtle().verify({ name: "Ed25519" }, key, a.signature, signedData);
    } else {
      const key = await subtle().importKey("spki", unb64(spki), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      ok = await subtle().verify({ name: "ECDSA", hash: "SHA-256" }, key, derToRaw(a.signature), signedData);
    }
  } catch (e) { errors.push("verify threw: " + e.message); }
  if (!ok) errors.push("assertion signature invalid");
  return { ok: ok && errors.length === 0, uv: !!(flags & 0x04), errors };
}

// ---- the gate: sign only after a verified gesture, folding the proof into the signed bytes ------------

export async function gatedAttest(obj, identity, cred, deps = {}) {
  const assert = deps.assert || assertGesture;
  const base = { ...obj }; delete base.sig; delete base.gesture;
  const challenge = await sha256(te.encode(canonicalize(base)));            // the challenge IS the artifact
  const a = await assert(challenge, { rpId: cred.rpId, credId: cred.credId });
  const v = await verifyAssertion(a, { spki: cred.spki, alg: cred.alg, challenge, rpId: cred.rpId, origin: cred.origin });
  if (!v.ok) throw new Error("gesture not verified: " + v.errors.join("; "));
  const gesture = { credId: a.credId, alg: cred.alg,
    authData: b64(a.authenticatorData), clientData: b64(a.clientDataJSON), sig: b64(a.signature) };
  const signed = await attest({ ...base, gesture }, identity);              // Ed25519 covers the gesture proof
  return { signed, gesture };
}

// Verify a gated artifact: the Ed25519 attestation holds AND its embedded gesture is a real user-verified
// assertion over this exact object. A signature without a valid, matching gesture is rejected.
export async function verifyGated(signed, { spki, alg = -7, rpId, origin } = {}) {
  const errors = [];
  const att = await verifyAttestation(signed, {});
  if (!att.ok) errors.push("attestation: " + att.errors.join("; "));
  const g = signed.gesture;
  if (!g) return { ok: false, errors: [...errors, "no gesture (ungated artifact)"] };
  const base = { ...signed }; delete base.sig; delete base.gesture;
  const challenge = await sha256(te.encode(canonicalize(base)));
  const gv = await verifyAssertion(
    { authenticatorData: unb64(g.authData), clientDataJSON: unb64(g.clientData), signature: unb64(g.sig) },
    { spki, alg: g.alg ?? alg, challenge, rpId, origin });
  if (!gv.ok) errors.push("gesture: " + gv.errors.join("; "));
  return { ok: errors.length === 0, by: att.by, errors };
}

// ---- helpers -----------------------------------------------------------------------------------------

function concat(...as) { let n = 0; for (const a of as) n += a.length; const o = new Uint8Array(n); let i = 0; for (const a of as) { o.set(a, i); i += a.length; } return o; }
function eqBytes(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; }

// DER ECDSA (SEQ{ INT r, INT s }) -> raw r||s, each left-padded to 32 bytes (WebCrypto wants P1363).
export function derToRaw(der) {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error("der: no sequence");
  let len = der[i++]; if (len & 0x80) { let n = len & 0x7f; len = 0; while (n--) len = (len << 8) | der[i++]; }
  const readInt = () => {
    if (der[i++] !== 0x02) throw new Error("der: no integer");
    let l = der[i++]; let b = der.slice(i, i + l); i += l;
    while (b.length > 32 && b[0] === 0) b = b.slice(1);
    const out = new Uint8Array(32); out.set(b, 32 - b.length); return out;
  };
  return concat(readInt(), readInt());
}

function b64(u8) { if (typeof Buffer !== "undefined") return Buffer.from(u8).toString("base64"); let s = ""; for (const x of u8) s += String.fromCharCode(x); return btoa(s); }
function unb64(s) { if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(s, "base64")); const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function b64url(u8) { return b64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64url(s) { return unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); }
