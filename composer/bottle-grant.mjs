// composer/bottle-grant.mjs — a bottle's operation expressed as CONSENT, on the existing standing-grant
// machinery. A bottle operates its storage adapter because the USER granted it: a gesture-signed
// probe.grant/v1 by the user's own anecdote identity (composer/consent.mjs mintGrant). This is NOT
// provenance ("who authored this") — it is a marker the user can REMEMBER (it shows in the grants panel),
// ADDITIVE (granting one thing never forecloses granting more), and REVOCABLE (only the granter). "Consent
// to be in operation this way."
//
// This module is only the CONVENTION that lets a tool's probe request and the user's grant name the same
// thing: the behavior "bottle.operate" over a scope of { bottle, adapter }. Consent is per-bottle and
// per-adapter — a grant for one bottle's git adapter covers nothing else. It is deliberately adapter-wide
// (no op dimension): a per-FEATURE lease is a later refinement, not this. Pure; joins composer/bottle-uri
// to composer/authorize + composer/consent.
import { parseBottleUrl } from "./bottle-uri.mjs";

export const OPERATE = "bottle.operate";

// The bottle a scope names: "<label>.<storage>" (the host without the apex) — stable, and the same whether
// a caller passes a bottle URL or already-parsed parts. Throws on a non-bottle target so a grant can never
// name something unaddressable.
function bottleKey(target) {
  const p = typeof target === "string" ? parseBottleUrl(target) : target;
  if (!p || !p.label || !p.storage) throw new Error("bottle-grant: target is not a bottle");
  return p.label + "." + p.storage;
}

// The scope for operating one bottle's one adapter: { bottle:[key], adapter:[name] }. Adapter-wide by
// construction (no op dimension) — the minimal "this adapter may run", not a per-op lease.
export function operateScope(target, adapter) {
  if (!adapter || typeof adapter !== "string") throw new Error("bottle-grant: an adapter name is required");
  return { bottle: [bottleKey(target)], adapter: [adapter] };
}

// What a TOOL adds to its probe request (probe-line request opts) so the user's grant can cover it.
export function operateTag(target, adapter) {
  return { behavior: OPERATE, scope: operateScope(target, adapter) };
}

// The spec the USER's gesture mints — consent.mjs mintGrant(store, spec, identity): "I let <bottle>'s
// <adapter> operate." `basis` is what the user saw when they granted it (kept honest, signed into the grant).
export function operateGrantSpec(target, adapter, { basis = null, expiry = null } = {}) {
  return { behavior: OPERATE, scope: operateScope(target, adapter), basis, expiry };
}
