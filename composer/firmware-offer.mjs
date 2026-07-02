// composer/firmware-offer.mjs — the FIRMWARE-OFFER bridge: caught shell code walks up to the SAME pin gate
// network updates face (docs/origin.md "lock the hatch on the way out", docs/offline-transfer.md,
// docs/anti-signature.md "acquire-by-doing"). firmware.mjs's verifyFiles was built with this seam — "a peer
// passes the received blob" — and this is that peer path: a holder who ADOPTED a signed shell can re-offer
// it over the gravel (the loop, a QR constellation, a file), and the catcher's pin decides exactly as it
// would for the origin: right signer, forward version, matching hashes — or refused with the reason.
//
// TWO SIGNATURES, TWO MEANINGS. The offer is a transfer (kind "firmware") signed by the COURIER — who
// handed it to you; the manifest inside is signed by the AUTHOR — whose firmware it is. The pin decides on
// the AUTHOR. A stranger may courier your own project's update perfectly well (verifies, not trusted —
// grade rides the accept flow like any catch); a friend couriering foreign-signed firmware is still
// refused. The door doesn't confer privilege; the pin does. Adoption itself happens in the SERVICE WORKER
// (sw.js re-decides with its own pin — never trust the page), not here; this module packs, verifies, and
// PRE-decides so the UI can say what would happen and why.

import { packTransfer, verifyTransfer } from "./transfer.mjs";
import { verifyManifest, pinDecision, verifyFiles } from "./firmware.mjs";

export const OFFER = "anecdote.firmware-offer/v1";
export const KIND = "firmware";

const b64 = (u8) => (typeof Buffer !== "undefined" ? Buffer.from(u8).toString("base64") : btoa(String.fromCharCode(...u8)));
const unb64 = (s) => { if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(s, "base64")); const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };

// Pack a held (author-signed) manifest + its file bytes as a courier-signed transfer. `files` =
// [{ path, bytes, type? }] and must cover every path the manifest names — a partial offer is refused
// at pack time, not discovered at adopt time.
export async function packFirmwareOffer(manifestSigned, files, courierIdentity) {
  const v = await verifyManifest(manifestSigned);
  if (!v.ok) throw new Error("firmware-offer: the manifest does not verify: " + v.errors.join("; "));
  const byPath = new Map((files || []).map((f) => [f.path, f]));
  const missing = (manifestSigned.files || []).filter((e) => !byPath.has(e.path)).map((e) => e.path);
  if (missing.length) throw new Error("firmware-offer: offer is missing manifest files: " + missing.join(", "));
  const payload = JSON.stringify({
    schema: OFFER,
    manifest: manifestSigned,
    files: (manifestSigned.files || []).map((e) => { const f = byPath.get(e.path); return { path: e.path, b64: b64(f.bytes), type: f.type || null }; }),
  });
  return packTransfer(KIND, payload, courierIdentity);
}

// Verify a caught offer: the COURIER envelope first (verify-from-anyone + trust-locally), then the shape.
// Returns { ok, courier, courierTrusted, manifest, files: [{path,bytes,type}], readFile, errors } — the
// manifest's own signature is NOT judged here; that is the pin's job (offerDecision / the SW).
export async function verifyFirmwareOffer(signed, { friends = [] } = {}) {
  const none = (errors) => ({ ok: false, courier: null, courierTrusted: false, manifest: null, files: null, readFile: null, errors });
  const v = await verifyTransfer(signed, { friends });
  if (!v.ok) return none(v.errors);
  if (v.kind !== KIND) return none([`kind is ${v.kind}, not ${KIND}`]);
  let body = null;
  try { body = JSON.parse(new TextDecoder().decode(v.bytes)); } catch { return none(["offer payload is not JSON"]); }
  if (!body || body.schema !== OFFER || !body.manifest || !Array.isArray(body.files)) return none(["not an anecdote.firmware-offer/v1 payload"]);
  let files;
  try { files = body.files.map((f) => ({ path: String(f.path), bytes: unb64(f.b64), type: f.type || null })); }
  catch { return none(["offer file bytes are not decodable"]); }
  const byPath = new Map(files.map((f) => [f.path, f.bytes]));
  return { ok: true, courier: v.by, courierTrusted: v.trusted, manifest: body.manifest, files,
           readFile: (path) => byPath.get(path) ?? null, errors: [] };
}

// The PRE-DECISION, pure: what the pin gate will say about this offer — same-signer/roll-forward on the
// AUTHOR (pinDecision) and content integrity from the OFFERED bytes (verifyFiles, the peer seam). The SW
// re-runs this against its own pin before adopting; this lets the UI say "would adopt: same-key
// roll-forward to v7" or "would refuse: signer ≠ pinned day-one key" before anything is committed.
export async function offerDecision(offer, pinnedBy = null, currentVersion = 0) {
  if (!offer || !offer.ok) return { accept: false, reason: "offer did not verify", by: null, version: null, files: null };
  const d = await pinDecision(offer.manifest, pinnedBy, currentVersion);
  if (!d.accept) return { ...d, files: null };
  const vf = await verifyFiles(offer.manifest, offer.readFile);
  if (!vf.ok) return { ...d, accept: false, reason: "file integrity: " + vf.bad.map((b) => `${b.path} (${b.reason})`).join(", "), files: vf };
  return { ...d, files: vf };
}
