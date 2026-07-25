// composer/bottle-attest.mjs — a bottle's API is SELF-GUARDING. It does not authenticate its callers (a
// bottle serves whoever holds its port; what RUNS is the user's operate-grant, composer/bottle-grant). It
// proves ITSELF: every adapter API carries a platform-key signature anchored to its OWN domain — "signed to
// run for that bottle or not at all." Self-issued at inception by the platform identity (the user's own
// anecdote key), present since inception (putting it there is free), and checked at serve/first-op: if the
// signature is missing or wrong for the domain it is actually running on, the API offers nothing.
//
// Domain-anchored like an origin declaration (git-enough/seize.mjs), but bound to the bottle's HOST rather
// than a repo name. Pure — reuses composer/sign.mjs attest/verifyAttestation and composer/bottle-uri.
import { attest, verifyAttestation } from "./sign.mjs";
import { parseBottleUrl } from "./bottle-uri.mjs";

export const BOTTLE_ATTEST = "anecdote.bottle/v1";

// The domain anchor: "<label>.<storage>" (the bottle host without the apex — the apex is the platform's).
// Accepts a bottle URL or already-parsed parts; throws on a non-bottle so nothing unaddressable gets signed.
export function bottleHost(target) {
  const p = typeof target === "string" ? parseBottleUrl(target) : target;
  if (!p || !p.label || !p.storage) throw new Error("bottle-attest: target is not a bottle");
  return p.label + "." + p.storage;
}

// Mint the bottle's self-attestation: the platform identity signs "this API runs for <host>, since <since>".
// Self-issued once at inception and put into the bottle. `opts.now` (ISO-8601) pins `since` for determinism.
//
// `opts.kind` — the bottle's SIGNED MACRO KIND, when the charter declares one: the coarse "what this
// origin is" a picker can trust BEFORE connecting ("data-pile", "storage-engine", …). Deliberately a free
// string, one word deep: the rich self-description (questions/leads, counts, the API surface) is the
// bottle's live descriptor over the `describe` op — a SELF-REPORT for skimming, never the trust signal.
// Kind is inside the signed bytes, so a bottle cannot quietly become code when it was chartered as data;
// subtypes stay emergent (they live in the descriptor's content, not in any enum here). Absent → an
// unkinded bottle, exactly as before; verifiers ignore unknown fields, so old attestations stay valid.
export async function mintBottleAttestation(target, identity, opts = {}) {
  const host = bottleHost(target);
  const since = opts.now || new Date().toISOString();
  const body = { schema: BOTTLE_ATTEST, bottle: host, since };
  if (opts.kind) body.kind = String(opts.kind);
  return attest(body, identity, opts);
}

// Verify a bottle's self-attestation against the domain it is ACTUALLY running on and the pinned platform
// key. ok iff: well-attested (signature valid over the exact bytes), signed by the platform key, and its
// domain anchor matches `host`. "Signed to run for that bottle or not at all" — a valid attestation for
// domain A does not validate on B. Omit platformKey to check self-consistency only (no pin); pass it to
// require the known-good platform signer.
export async function verifyBottleAttestation(signed, { host, platformKey = null, opts = {} } = {}) {
  if (!signed || signed.schema !== BOTTLE_ATTEST) return { ok: false, reason: "not a bottle attestation" };
  const v = await verifyAttestation(signed, opts);
  if (!v.ok) return { ok: false, reason: "bad signature" };
  if (platformKey && v.by !== platformKey) return { ok: false, reason: "not the platform key" };
  if (signed.bottle !== host) return { ok: false, reason: `domain anchor mismatch: signed for ${signed.bottle}, running on ${host}` };
  return { ok: true, by: v.by, host: signed.bottle, since: signed.since, kind: signed.kind || null };
}
