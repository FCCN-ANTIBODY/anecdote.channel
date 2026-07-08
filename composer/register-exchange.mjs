// composer/register-exchange.mjs — PR-consent, REPRESENTED OFFLINE (rework slice 4, civic-node#60;
// the direction is civic-node docs/TENANCY.md → "PR-consent, represented offline"). The GitHub
// pipeline's propose-then-a-human-merges becomes an exchange of QR scans between offline origins:
// OPEN travels as a signed transfer envelope carrying a registration entry; MERGE travels back as a
// signed consent receipt binding that exact envelope. Two signed halves — id and receipt data — and
// the registry write happens wherever the registry lives, later, verifiably: a git-enough commit in
// the trove, or REPLAYED onto the GitHub mirror as the ordinary PR idiom (`registryYaml` /
// `branchFor` emit exactly that form, so the mirror stays the mirror).
//
// This re-represents the §B registration-idiom family, member by member — piles, tells, atlases,
// needs — it does not replace it: the entry shapes here ARE the `_data/*.yml` shapes, and the
// canonical PR openers (tell bin/register and its descendants) remain the mirror-side form.
//
// Trust stance is transfer.mjs's, unchanged: verify from anyone; a LOCAL friend list decides whether
// to act; the receipt is the met.mjs move — a signed acknowledgement anyone can re-verify with zero
// secrets. Gesture-gating composes at the caller (gesture.mjs), as everywhere else.

import { attest, verifyAttestation, canonicalize } from "./sign.mjs";
import { packTransfer, verifyTransfer, transferId } from "./transfer.mjs";

export const REGISTER = "anecdote.register/v1";
export const RECEIPT = "anecdote.consent-receipt/v1";
export const KIND_OPEN = "registration";
export const KIND_RECEIPT = "consent-receipt";
const td = new TextDecoder();

// The §B family: each registry's entry shape, as its `_data/*.yml` expects it. Strict on purpose —
// an unknown key is a typo'd consent, refused before anyone signs anything.
export const REGISTRIES = {
  piles:   { path: "_data/piles.yml",   required: ["id", "scope", "feed", "age_recipient"], optional: ["repo_url", "provisioner", "provisioner_spec"] },
  tells:   { path: "_data/tells.yml",   required: ["id", "name", "url", "scope", "signer"], optional: ["reports"] },
  atlases: { path: "_data/atlases.yml", required: ["id", "url", "scope", "signer"],         optional: ["name", "reports", "repo"] },
  needs:   { path: "_data/needs.yml",   required: ["id", "asker_repo", "scope", "topic"],   optional: ["terms", "need_url", "constitution"] },
};

export function validateEntry(registry, entry) {
  const errors = [];
  const spec = REGISTRIES[registry];
  if (!spec) return { ok: false, errors: [`unknown registry: ${registry}`] };
  if (!entry || typeof entry !== "object") return { ok: false, errors: ["entry must be an object"] };
  for (const k of spec.required) {
    if (typeof entry[k] !== "string" || !entry[k].length) errors.push(`missing required field: ${k}`);
  }
  const known = new Set([...spec.required, ...spec.optional]);
  for (const k of Object.keys(entry)) {
    if (!known.has(k)) errors.push(`unknown field: ${k}`);
    else if (typeof entry[k] !== "string") errors.push(`field must be a string: ${k}`);
  }
  return { ok: errors.length === 0, errors };
}

// ---- OPEN — the proposer's half ----------------------------------------------------------------------

// Propose a registration: the entry, named to its registry, signed into a transfer envelope. This is
// the offline propose-a-registration moment — nothing is registered yet; the envelope is the ask.
// `opts.at` stamps a date INSIDE the signed payload — the freshness an Atlas's registration door
// (atlas bin/admit, civic-node#85) orders words by: an unstamped proposal still lands on first
// contact there, but only a stamped one can ever supersede (never a freshness nobody stamped).
// Omitting `at` keeps the payload byte-identical to before, so existing receipts stay verifiable.
export async function openRegistration(registry, entry, identity, opts = {}) {
  const v = validateEntry(registry, entry);
  if (!v.ok) throw new Error("register-exchange: " + v.errors.join("; "));
  const { at, ...packOpts } = opts;
  if (at !== undefined && Number.isNaN(Date.parse(at)))
    throw new Error("register-exchange: `at` must be a parseable date — a stamp that does not parse is no stamp");
  return packTransfer(KIND_OPEN, canonicalize({ schema: REGISTER, registry, entry, ...(at ? { at } : {}) }), identity, packOpts);
}

// Read a scanned proposal. `ok` is verify-from-anyone (signature + payload + shape); `trusted` is the
// local friend-list decision — exactly the split that decides whether the merge needs a human pause.
export async function readRegistration(envelope, { friends = [] } = {}) {
  const t = await verifyTransfer(envelope, { friends });
  if (!t.ok || t.kind !== KIND_OPEN) {
    return { ok: false, by: t.by || null, trusted: false, registry: null, entry: null,
             errors: t.kind && t.kind !== KIND_OPEN ? [...t.errors, `kind is ${t.kind}, not ${KIND_OPEN}`] : t.errors };
  }
  let inner = null;
  try { inner = JSON.parse(td.decode(t.bytes)); } catch { return { ok: false, by: t.by, trusted: false, registry: null, entry: null, errors: ["payload is not JSON"] }; }
  if (!inner || inner.schema !== REGISTER) return { ok: false, by: t.by, trusted: false, registry: null, entry: null, errors: ["payload is not " + REGISTER] };
  const v = validateEntry(inner.registry, inner.entry);
  if (!v.ok) return { ok: false, by: t.by, trusted: false, registry: inner.registry, entry: null, errors: v.errors };
  return { ok: true, by: t.by, trusted: t.trusted, registry: inner.registry, entry: inner.entry,
           at: inner.at || null, errors: [] };
}

// ---- MERGE — the acceptor's half -----------------------------------------------------------------------

// Decide on a proposal and sign the receipt — the offline merge (or close). The receipt binds the
// EXACT envelope (its content id), the proposer, and the verdict, so the pair is re-verifiable by
// anyone with zero secrets (the met.mjs move). Refuses to receipt an envelope that doesn't verify:
// a receipt is a decision about a real ask, never about noise. `at` is injectable (deterministic
// under test; no clock is consulted here).
export async function mergeRegistration(envelope, identity, { friends = [], verdict = "merged", at = null } = {}) {
  if (verdict !== "merged" && verdict !== "declined") throw new Error("register-exchange: verdict must be merged|declined");
  const r = await readRegistration(envelope, { friends });
  if (!r.ok) throw new Error("register-exchange: refusing to receipt an invalid proposal — " + r.errors.join("; "));
  const receipt = await attest({
    schema: RECEIPT, registry: r.registry, entryId: await transferId(envelope),
    proposer: r.by, verdict, ...(at ? { at } : {}),
  }, identity);
  return { receipt, entry: r.entry, registry: r.registry, proposer: r.by, trusted: r.trusted };
}

// The receipt, wrapped for the return scan — the same envelope grammar both directions, so one
// carrier (carrier.mjs / chunk+reassemble) moves both halves.
export async function receiptEnvelope(receipt, identity, opts = {}) {
  return packTransfer(KIND_RECEIPT, canonicalize(receipt), identity, opts);
}

export async function openReceipt(envelope, { friends = [] } = {}) {
  const t = await verifyTransfer(envelope, { friends });
  if (!t.ok || t.kind !== KIND_RECEIPT) return { ok: false, receipt: null, errors: t.errors.length ? t.errors : ["not a consent-receipt envelope"] };
  try { return { ok: true, receipt: JSON.parse(td.decode(t.bytes)), errors: [] }; }
  catch { return { ok: false, receipt: null, errors: ["receipt is not JSON"] }; }
}

// ---- the pair — what "consented" means ------------------------------------------------------------------

// Verify the two halves TOGETHER: the proposal verifies, the receipt verifies, the receipt binds this
// exact envelope and this exact proposer, and the verdict is `merged`. `ok` means consent stands;
// a coherent-but-declined pair reports ok:false with the verdict visible. Trust stays per-party and
// local: `trusted.proposer` / `trusted.acceptor` against YOUR friend list.
export async function verifyConsent(envelope, receipt, { friends = [] } = {}) {
  const errors = [];
  const r = await readRegistration(envelope, { friends });
  if (!r.ok) errors.push("proposal: " + r.errors.join("; "));
  const a = await verifyAttestation(receipt, {});
  if (!a.ok) errors.push("receipt: " + a.errors.join("; "));
  if (receipt && receipt.schema !== RECEIPT) errors.push("receipt is not " + RECEIPT);
  if (r.ok && a.ok && receipt.schema === RECEIPT) {
    if (receipt.entryId !== await transferId(envelope)) errors.push("receipt binds a different envelope");
    if (receipt.proposer !== r.by) errors.push("receipt names a different proposer");
    if (receipt.registry !== r.registry) errors.push("receipt names a different registry");
  }
  const coherent = errors.length === 0;
  const verdict = coherent ? receipt.verdict : null;
  return {
    ok: coherent && verdict === "merged",
    verdict, registry: r.registry, entry: r.entry, proposer: r.by, acceptor: a.by,
    trusted: { proposer: r.trusted, acceptor: a.ok && friends.includes(a.by) },
    errors,
  };
}

// ---- replay to the mirror --------------------------------------------------------------------------------

// A verified pair replays onto the GitHub registry as the ORDINARY idiom — the same entry the family's
// PR openers emit, on the family's branch convention. The exchange changes where consent happens, not
// what the registries hold.
const FIELD_ORDER = {
  // piles may carry the provisioner attestation (data-pile CONTRACT.md → spec-or-attested):
  // a managed pile says so wherever its entry travels, the offline exchange included.
  piles: ["id", "scope", "feed", "age_recipient", "repo_url", "provisioner", "provisioner_spec"],
  tells: ["id", "name", "url", "scope", "signer", "reports"],
  atlases: ["id", "name", "url", "scope", "signer", "reports", "repo"],
  needs: ["id", "asker_repo", "scope", "topic", "terms", "need_url", "constitution"],
};

export function registryYaml(registry, entry) {
  const v = validateEntry(registry, entry);
  if (!v.ok) throw new Error("register-exchange: " + v.errors.join("; "));
  let out = "";
  for (const k of FIELD_ORDER[registry]) {
    if (!(k in entry)) continue;
    out += out ? `  ${k}: "${entry[k]}"\n` : `- ${k}: ${entry[k]}\n`;
  }
  return out;
}

export function branchFor(registry, entry) {
  const v = validateEntry(registry, entry);
  if (!v.ok) throw new Error("register-exchange: " + v.errors.join("; "));
  if (registry === "tells") return `tell/${entry.scope}/${entry.id}`;
  if (registry === "atlases") return `atlas/${entry.scope}/${entry.id}`;
  if (registry === "piles") {
    const repo = (entry.repo_url || "").replace(/^https:\/\/github\.com\//, "");
    return `handshake/${(repo.split("/")[1] || entry.id)}`;   // data-pile handshake.yml's convention
  }
  return `need/${entry.id}`;
}

export function registryPath(registry) {
  const spec = REGISTRIES[registry];
  if (!spec) throw new Error("register-exchange: unknown registry: " + registry);
  return spec.path;
}
