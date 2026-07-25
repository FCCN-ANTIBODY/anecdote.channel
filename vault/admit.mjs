// vault/admit.mjs — INTAKE admissibility for a whale, the trust model of docs/gravel-whale.md in code. A whale
// forces a decision the rest of gravel never faces: you must commit resources (storage, camera time) BEFORE you
// can verify anything, because bytes stage as they stream. So this runs on declared-but-unverified data and is
// deliberately defensive. It is the third gate, in FRONT of gravel's ok/trusted split (composer/transfer.mjs):
//
//   ok        — authentic + intact? (verify from anyone)           [gravel, after reassembly]
//   trusted   — signer on your local friend-list? (should you act) [gravel, a local decision]
//   admissible— will you SPEND to even find out?                   [here, before verification]
//
// The keystone split: SHAPE is signed sender-authority (trusted only for reconstruction, only after the
// signature verifies — a lying shape can only FAIL, not corrupt). BUDGET is receiver-authority and is NEVER
// delegated to the manifest: the manifest PROPOSES a size, the crown GRANTS a budget, and admission is
// `declared ≤ granted`, then the store allocates against verified bytes (vault-store.mjs). A manifest claiming
// 900 GB cannot make you reserve 900 GB — only refuse.

// Provisional default STORAGE budgets (bytes), scaled by signer trust. These two numbers are the policy knob
// left open in gravel-whale.md ("default budgets for trusted vs. anonymous signers") — named here so they live
// in one place, not decided. Trust learned early (from the carousel'd signed layout tile) picks which applies.
export const DEFAULT_BUDGETS = {
  trusted: 8 * 1024 * 1024 * 1024,   // a friend's whale: generous default (crown may still raise/lower)
  anonymous: 256 * 1024 * 1024,      // an unknown/unverifiable signer: minimal until an explicit crown grant
};

// The storage budget for a signer, before any explicit crown grant. `trusted` is gravel's local friend-list
// answer for the layout's signer — NOT a property of the payload.
export function budgetFor({ trusted } = {}, budgets = DEFAULT_BUDGETS) {
  return trusted ? budgets.trusted : budgets.anonymous;
}

// The admissibility gate. `declaredTotal` is the manifest's proposed size (untrusted); `budget` is what the
// receiver granted (default-by-trust via budgetFor, or an explicit crown grant that overrides it). Admit iff
// declared ≤ granted. Never trusts `declaredTotal` for anything but this comparison; the store still allocates
// against verified bytes, so an under-declared size cannot smuggle extra past the budget either.
export function admit({ declaredTotal, budget } = {}) {
  if (!Number.isFinite(declaredTotal) || declaredTotal < 0)
    return { ok: false, reason: "declared size missing or invalid" };
  if (!Number.isFinite(budget) || budget < 0)
    return { ok: false, reason: "no resource budget granted" };
  if (declaredTotal > budget)
    return { ok: false, reason: `declared ${declaredTotal}B exceeds granted budget ${budget}B` };
  return { ok: true, budget, declaredTotal };
}

// DISPOSITION — where admitted bytes may go. The safety story rides the byte/execution boundary: an inert whale
// is admitted freely within budget and MARKED; nothing becomes code without a trusted signature AND the crown.
// So this note's default is admit-inert-and-marked: `mark` is stamped on the cold-store receipt, and
// `mayExecute` (the data→module door) is only ever open for a trusted signer — still gated downstream by the
// crown and the glove (composer/install.mjs). An anonymous big file has no second step.
export function disposition({ trusted } = {}) {
  return { mark: trusted ? "trusted" : "anonymous", mayExecute: !!trusted };
}

export default admit;
