// composer/place-seal.mjs — THE WIRE between the in-place secret and the age battery: a decryption keyed
// to presence-right-now. age-seal.mjs seals to X25519 recipients; presence.mjs proves you are here — but
// nothing yet made a DECRYPTION depend on being here (docs/place-seal.md). This does, and only for LIVE.
//
// The move: a payload sealed to the CURRENT EPOCH recipient opens only with that epoch's seed — a secret
// DISPLAYED in the constituency (a caught QR, the presence.md "in-place code") that ROTATES faster than it
// can usefully travel. Hold a fresh beacon → you open live. Walk away → the epoch rotates → new live
// payloads stop opening. Anything you already opened, you re-seal to your OWN recipient (toSnapshot) and
// carry anywhere, forever. That is the whole live/snapshot boundary, expressed in crypto — the grain of
// this system (decay, not a wall).
//
// No server, no new credential. The epoch seed is DERIVED from the place secret the operator already holds
// (qr-mint.mjs's TELL_QR_SECRET — "you run your own Tell"), under a "place-seal:" domain prefix so it never
// collides with the poll tokens the same secret mints. The operator seals in their own Elevated page and
// paints the beacon; the present body scans it in theirs. Nothing regional is ever asked of anyone.
//
// The honest ceiling (docs/place-seal.md, and last-turn's impossibilities): the seed is a secret that CAN
// be photographed and relayed inside its rotation window — so "live" is gated to "someone present within
// the last epoch, who may have relayed." That is a floor raised, not a wall built. The witness (presence.mjs)
// and the judge-over-history are what harden a spoofable instant into a costly-to-fake standing ability.

import { encrypt, decrypt } from "./age-seal.mjs";
import { encodeIdentity, recipientOf } from "./age-mint.mjs";
import { attest, verifyAttestation } from "./sign.mjs";

export const BEACON = "anecdote.place-beacon/v1";
export const DEFAULT_WINDOW_MS = 3 * 60 * 1000;   // 3-minute rotation — "faster than it can travel"
export const DEFAULT_GRACE = 1;                    // also honor the previous epoch (boundary-straddling)

const te = new TextEncoder();
const subtle = () => { const s = globalThis.crypto && globalThis.crypto.subtle; if (!s) throw new Error("place-seal: no WebCrypto"); return s; };

// ---- base64 (env-portable, no deps) ---------------------------------------------------------------
function b64(u8) { if (typeof Buffer !== "undefined") return Buffer.from(u8).toString("base64"); let s = ""; for (const x of u8) s += String.fromCharCode(x); return btoa(s); }
function unb64(s) { if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(s, "base64")); const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

// ---- epoch derivation (the rotating in-place secret) ----------------------------------------------

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

// HMAC-SHA256(keyStr, msgStr) -> lowercase hex (qr-mint.mjs's hmacHex, byte-for-byte: key is raw UTF-8).
async function hmacHex(keyStr, msgStr) {
  const key = await subtle().importKey("raw", te.encode(keyStr), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await subtle().sign("HMAC", key, te.encode(msgStr)));
}
// HMAC-SHA256(keyStr, msgStr) -> raw 32 bytes (the seed IS an X25519 scalar; any 32 bytes is valid, the
// curve clamps internally).
async function hmac32(keyStr, msgStr) {
  const key = await subtle().importKey("raw", te.encode(keyStr), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle().sign("HMAC", key, te.encode(msgStr)));
}

// Which epoch a moment falls in: floor(t / window). Integer, so it is stable to name and to compare.
export function epochOf(at, windowMs = DEFAULT_WINDOW_MS) {
  const t = typeof at === "number" ? at : Date.parse(at);
  if (!Number.isFinite(t)) throw new Error("place-seal: epochOf needs a valid time");
  if (!(Number.isFinite(windowMs) && windowMs > 0)) throw new Error("place-seal: window must be positive ms");
  return Math.floor(t / windowMs);
}

// The place's epoch seed — DERIVED, never stored. Two-step like qr-mint (a per-place sub-key, then the
// epoch), so one TELL_QR_SECRET keys many places and its poll tokens without any cross-use. Only the
// operator can compute this (they hold `secret`); everyone else must CATCH it in the beacon.
export async function deriveSeed(secret, place, epoch) {
  if (!secret) throw new Error("place-seal: need the place secret (you run the Tell)");
  if (!place || typeof place !== "string") throw new Error("place-seal: a beacon names a place");
  const kPlace = await hmacHex(secret, "place-seal:" + place);        // hex string, domain-separated
  return hmac32(kPlace, "epoch:" + String(epoch));                    // raw 32-byte seed
}

// A seed -> the age identity/recipient pair for that epoch. The identity is the SECRET (opens live); the
// recipient is what live payloads are sealed TO. Deterministic: same seed, same pair, on any device.
export async function epochKeys(seed, opts = {}) {
  if (!(seed instanceof Uint8Array) || seed.length !== 32) throw new Error("place-seal: seed wants 32 bytes");
  const identity = encodeIdentity(seed);
  const recipient = await recipientOf(identity, opts);
  return { identity, recipient };
}

// Operator convenience: seed + keys for a place at an epoch, from the held secret.
export async function deriveEpoch(secret, place, epoch, opts = {}) {
  const seed = await deriveSeed(secret, place, epoch);
  return { epoch, seed, ...(await epochKeys(seed, opts)) };
}

// ---- the beacon (the in-place QR) -----------------------------------------------------------------

// Mint the beacon a place PAINTS for the epoch: it CARRIES the seed (the seed is the in-place secret being
// handed to present bodies — controlled exposure, by design) and is operator-SIGNED so a catcher can trust
// it came from the place and not a decoy. `at` is injectable for deterministic artifacts under test.
export async function mintBeacon(secret, place, identity, { at, windowMs = DEFAULT_WINDOW_MS } = {}) {
  const when = at || new Date().toISOString();
  const epoch = epochOf(when, windowMs);
  const seed = await deriveSeed(secret, place, epoch);
  return attest({ schema: BEACON, place, epoch, window: windowMs, seed: b64(seed), at: when }, identity);
}

// Verify a caught beacon end to end: shape + the embedded-key signature (verify-from-anyone; pass
// `placeKey` to REQUIRE a pinned operator), then report FRESHNESS against `now`. Fresh = the beacon's epoch
// is the current one, an allowed number of epochs behind (grace, matching what sealLive covers), or one
// ahead (clock skew). Staleness never makes the beacon INVALID — it makes it unusable for opening LIVE, and
// the caller is told which. Returns { ok, by, place, epoch, seed:Uint8Array|null, fresh, current, errors }.
export async function verifyBeacon(beacon, { placeKey = null, now, windowMs, grace = DEFAULT_GRACE } = {}) {
  if (!beacon || beacon.schema !== BEACON) return { ok: false, by: null, place: null, epoch: null, seed: null, fresh: false, current: null, errors: ["not a place beacon"] };
  const v = await verifyAttestation(beacon, {});
  if (!v.ok) return { ok: false, by: v.by, place: null, epoch: null, seed: null, fresh: false, current: null, errors: ["beacon signature: " + v.errors.join("; ")] };
  if (placeKey && v.by !== placeKey) return { ok: false, by: v.by, place: null, epoch: null, seed: null, fresh: false, current: null, errors: ["beacon signer is not the pinned place key"] };
  if (typeof beacon.place !== "string" || !beacon.place) return { ok: false, by: v.by, place: null, epoch: null, seed: null, fresh: false, current: null, errors: ["beacon names no place"] };
  let seed = null;
  try { seed = unb64(beacon.seed); } catch { /* seed stays null, reported below */ }
  if (!seed || seed.length !== 32) return { ok: false, by: v.by, place: beacon.place, epoch: beacon.epoch, seed: null, fresh: false, current: null, errors: ["beacon seed is not 32 bytes"] };
  const w = windowMs ?? beacon.window ?? DEFAULT_WINDOW_MS;
  let fresh = false, current = null;
  if (now != null) {
    current = epochOf(now, w);
    const behind = current - beacon.epoch;                 // >0 past, <0 future (skew)
    fresh = behind <= grace && behind >= -1;
  }
  return { ok: true, by: v.by, place: beacon.place, epoch: beacon.epoch, seed, fresh, current, errors: [] };
}

// ---- seal / open LIVE -----------------------------------------------------------------------------

// Operator side: seal a LIVE payload to the current epoch recipient AND the previous `grace` epochs, so a
// body whose beacon straddled a rotation still opens it. Only someone holding one of those epoch seeds
// (i.e. present within the grace window) can open the result. Returns { file, epoch, epochs, recipients }.
export async function sealLive(secret, place, plaintext, { at, windowMs = DEFAULT_WINDOW_MS, grace = DEFAULT_GRACE } = {}) {
  const when = at || new Date().toISOString();
  const epoch = epochOf(when, windowMs);
  const epochs = [];
  for (let e = epoch; e >= epoch - grace; e--) epochs.push(e);
  const recipients = [];
  for (const e of epochs) recipients.push((await deriveEpoch(secret, place, e)).recipient);
  const file = await encrypt(recipients, plaintext);
  return { file, epoch, epochs, recipients };
}

// Catcher side, low level: open a live file with a raw epoch seed (however you got it). Thin over age-seal.
export async function openWithSeed(seed, file, opts = {}) {
  const { identity } = await epochKeys(seed, opts);
  return decrypt(identity, file, opts);
}

// Catcher side, the real entry: open a LIVE file using a caught beacon. Refuses unless the beacon verifies
// AND is fresh (you hold a CURRENT in-place secret) — this is the whole point, that a stale beacon opens
// nothing new. Pass { allowStale:true } only for tooling that means to bypass the freshness gate. Verifies
// provenance with `placeKey` when you pin the operator. Returns the plaintext (Uint8Array) or throws.
export async function openLive(beacon, file, { now, placeKey = null, windowMs, grace = DEFAULT_GRACE, allowStale = false } = {}) {
  const v = await verifyBeacon(beacon, { placeKey, now, windowMs, grace });
  if (!v.ok) throw new Error("place-seal: unusable beacon — " + v.errors.join("; "));
  if (!allowStale) {
    if (now == null) throw new Error("place-seal: openLive needs `now` to judge freshness (or allowStale)");
    if (!v.fresh) throw new Error("place-seal: beacon is stale — live is only open in-place, right now");
  }
  return openWithSeed(v.seed, file, {});
}

// ---- the live -> snapshot custody move ------------------------------------------------------------

// The discipline that keeps a decrypted live payload from ever resting as plaintext: on first open, RE-SEAL
// it to your OWN recipient. The result is portable (carry/share it anywhere) and openable ONLY by your
// identity — copying the bytes to someone else is useless, their stanza was never written. This is "the
// Atlas had a hand in supplying the key, but it made it for you": the hand was the live seal; the you-only
// copy is this. Snapshots do not rotate — that is exactly why they are the shareable, walk-around form.
export async function toSnapshot(plaintext, myRecipient) {
  if (!myRecipient) throw new Error("place-seal: toSnapshot needs your age recipient");
  return encrypt(myRecipient, plaintext);
}
