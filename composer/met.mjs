// composer/met.mjs — the MET-RECORD: a server's footprint, left by someone else's foot
// (atlas.anecdote.channel/notes/boundary-canon.md; docs/presence.md). A Tell cannot go anywhere, but it
// can BE MET: when a body with a presence claim scans a Tell-minted, Tell-SIGNED token inside a place,
// the Tell's unforgeable material was exercised there — and this module makes that moment a verifiable
// artifact, with no new crypto: the token's SSHSIG (qr-sign.mjs) verifies with the same WebCrypto Ed25519
// everything else uses, and the body's side is a presence claim (presence.mjs) it merely binds.
//
// A met-record is publicly re-verifiable end to end: the minted QR is PUBLIC material (it hangs on a
// lamppost; its tok is per-poll, not per-person), so the record embeds the token verbatim — canon, sig,
// kid — and any third party can re-check the Tell's signature, the body's signature, and the claim inside,
// holding no secret at all. The operator's own location never matters and never appears: the bodies are
// the proof, which is the point — a missing server owner is not an authority anything rests on.
//
// Two consumers, one artifact: an ATLAS counts met-records as corroboration that a Tell's boundary claim
// is real (`met: 47`, receipts producible); a HARD-BOUNDARY Tell demands one at the door — the aggressive
// alternative: you can't join unless you can do the proof yourself. Policy lives with those consumers;
// this module only makes and verifies the artifact.

import { attest, verifyAttestation } from "./sign.mjs";
import { verifyClaim } from "./presence.mjs";
import { qrCanon } from "./qr-mint.mjs";
import { defaultHash } from "./anecdote.mjs";

export const MET = "anecdote.met/v1";

const te = new TextEncoder(), td = new TextDecoder();
const unb64 = (s) => { if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(s, "base64")); const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const b64 = (u8) => { if (typeof Buffer !== "undefined") return Buffer.from(u8).toString("base64"); let s = ""; for (const x of u8) s += String.fromCharCode(x); return btoa(s); };

// ---- SSHSIG verification (the inverse of qr-sign.mjs's signCanon — same wire format, same field order) --

function reader(u8) {
  let p = 0;
  return {
    bytes(n) { const out = u8.subarray(p, p + n); p += n; return out; },
    u32() { const b = this.bytes(4); return (b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]) >>> 0; },
    str() { return this.bytes(this.u32()); },
    done() { return p >= u8.length; },
  };
}

// Verify a base64-of-armored SSHSIG (`sig` as it rides in the QR) over `canon` (the message is canon +
// trailing newline, matching bin/qr). Returns { ok, kid, namespace, errors } — `kid` is the SSH
// fingerprint of the key that actually signed, computed from the signature blob itself.
export async function verifySshSig(sigB64, canon) {
  try {
    const armored = td.decode(unb64(sigB64));
    const body = armored.replace(/-----BEGIN SSH SIGNATURE-----|-----END SSH SIGNATURE-----|\s+/g, "");
    const blob = unb64(body);
    const r = reader(blob);
    if (td.decode(r.bytes(6)) !== "SSHSIG") return { ok: false, kid: null, errors: ["not an SSHSIG"] };
    if (r.u32() !== 1) return { ok: false, kid: null, errors: ["unsupported SSHSIG version"] };
    const pubBlob = r.str();
    const namespace = td.decode(r.str());
    r.str();                                                       // reserved
    const hashAlg = td.decode(r.str());
    if (hashAlg !== "sha512") return { ok: false, kid: null, errors: [`unsupported hash ${hashAlg}`] };
    const sigOuter = reader(r.str());
    if (td.decode(sigOuter.str()) !== "ssh-ed25519") return { ok: false, kid: null, errors: ["not ssh-ed25519"] };
    const rawSig = sigOuter.str();
    const pk = reader(pubBlob);
    if (td.decode(pk.str()) !== "ssh-ed25519") return { ok: false, kid: null, errors: ["key is not ssh-ed25519"] };
    const rawKey = pk.str();
    const kid = "SHA256:" + b64(new Uint8Array(await crypto.subtle.digest("SHA-256", pubBlob))).replace(/=+$/, "");
    const H = new Uint8Array(await crypto.subtle.digest("SHA-512", te.encode(canon + "\n")));
    const sshStr = (x) => { const b = typeof x === "string" ? te.encode(x) : x; const o = new Uint8Array(4 + b.length); new DataView(o.buffer).setUint32(0, b.length); o.set(b, 4); return o; };
    const cat = (...as) => { let n = 0; for (const a of as) n += a.length; const o = new Uint8Array(n); let i = 0; for (const a of as) { o.set(a, i); i += a.length; } return o; };
    const toSign = cat(te.encode("SSHSIG"), sshStr(namespace), sshStr(new Uint8Array(0)), sshStr(hashAlg), sshStr(H));
    const key = await crypto.subtle.importKey("raw", rawKey, { name: "Ed25519" }, false, ["verify"]);
    const ok = await crypto.subtle.verify({ name: "Ed25519" }, key, rawSig, toSign);
    return ok ? { ok: true, kid, namespace, errors: [] } : { ok: false, kid, namespace, errors: ["signature does not verify"] };
  } catch (e) { return { ok: false, kid: null, errors: ["SSHSIG parse: " + e.message] }; }
}

// ---- the token side: verify a scanned, Tell-minted QR url with no secret at all -----------------------

// Parse + verify a scanned minted URL. The tok (HMAC) is the TELL's to check; the SSHSIG is ANYONE's to
// check — this is the public anchor a met-record binds to. An unsigned QR cannot anchor a met-record:
// there is nothing unforgeable in it for a third party, so it is refused with that reason.
export async function verifyMintedToken(scannedUrl) {
  let u; try { u = new URL(scannedUrl); } catch { return { ok: false, errors: ["not a URL"] }; }
  const raw = u.search.replace(/^\?/, "");
  if (!raw) return { ok: false, errors: ["no query — not a minted token"] };
  const pairs = raw.split("&");
  const get = (k) => { const p = pairs.find((x) => x.startsWith(k + "=")); return p ? decodeURIComponent(p.slice(k.length + 1)) : null; };
  const sig = get("sig"), kid = get("kid");
  if (!sig || !kid) return { ok: false, errors: ["unsigned token — nothing unforgeable to anchor a met-record to"] };
  const canon = qrCanon(pairs);
  const v = await verifySshSig(sig, canon);
  if (!v.ok) return { ok: false, errors: v.errors };
  if (v.kid !== kid) return { ok: false, errors: [`kid mismatch: QR says ${kid}, signature is by ${v.kid}`] };
  return { ok: true, kid, canon, sig, pile: get("pile"), poll: get("poll"), round: get("round"), errors: [] };
}

// ---- the met-record ------------------------------------------------------------------------------------

// Bind a verified scan to the scanner's OWN presence claim. Verifies both halves FIRST (you don't bind
// garbage to garbage), and the claim must be the binder's own — a met-record says *I* scanned this *while
// placed*; nobody mets on someone else's feet. The token rides verbatim (it is public material), so the
// record re-verifies end to end with no secret.
export async function metRecord({ scanned, claim, at } = {}, identity) {
  const t = await verifyMintedToken(scanned);
  if (!t.ok) throw new Error("met: token: " + t.errors.join("; "));
  const c = await verifyClaim(claim);
  if (!c.ok) throw new Error("met: claim: " + c.errors.join("; "));
  if (c.by !== identity.fingerprint) throw new Error("met: the claim must be the binder's own — nobody mets on someone else's feet");
  return attest({
    schema: MET,
    token: { kid: t.kid, canon: t.canon, sig: t.sig, pile: t.pile, poll: t.poll, round: t.round,
             canonHash: await defaultHash(te.encode(t.canon)) },
    claim,                                                        // the binder's presence claim, verbatim
    at: at || new Date().toISOString(),
  }, identity);
}

// Verify a met-record end to end — three signatures, zero secrets: the binder's (outer), the Tell's (the
// token's SSHSIG, re-checked from the embedded canon), and the claim's (inner, same body as outer).
// `fresh`: the binding moment sits within `windowMs` of the claim's moment. Returns the facts the two
// consumers read: { ok, by, kid, pile, poll, constituency, boundary, method, fresh, at, errors }.
export async function verifyMet(record, { windowMs = 10 * 60 * 1000 } = {}) {
  if (!record || record.schema !== MET) return { ok: false, errors: ["not a met-record"] };
  const outer = await verifyAttestation(record, {});
  if (!outer.ok) return { ok: false, errors: ["binder signature: " + outer.errors.join("; ")] };
  const t = record.token || {};
  const sv = await verifySshSig(t.sig, t.canon);
  if (!sv.ok) return { ok: false, errors: ["token: " + sv.errors.join("; ")] };
  if (sv.kid !== t.kid) return { ok: false, errors: ["token kid mismatch"] };
  if (await defaultHash(te.encode(t.canon)) !== t.canonHash) return { ok: false, errors: ["token canon hash mismatch"] };
  const c = await verifyClaim(record.claim);
  if (!c.ok) return { ok: false, errors: ["claim: " + c.errors.join("; ")] };
  if (c.by !== outer.by) return { ok: false, errors: ["claim is not the binder's own"] };
  const dt = Math.abs(new Date(record.at) - new Date(record.claim.at));
  return {
    ok: true, errors: [],
    by: outer.by, kid: t.kid, pile: t.pile, poll: t.poll,
    constituency: c.constituency,
    boundary: record.claim.bisect?.boundary || null, method: record.claim.bisect?.method || "asserted",
    fresh: Number.isFinite(dt) && dt <= windowMs, at: record.at,
  };
}

// ---- probe-line capability ------------------------------------------------------------------------------
// Rung 1: binding is a knowing act (one scan, one confirm). Keeping the record is carrier.accept's job.
export function metOps({ identity } = {}) {
  return {
    "presence.met": async (input, api) => {
      const record = await metRecord(input || {}, identity);
      api.emit({ record, facts: await verifyMet(record) });
    },
  };
}
