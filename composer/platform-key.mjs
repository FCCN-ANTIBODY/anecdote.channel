// composer/platform-key.mjs — the constellation's PLATFORM KEY SLOT: the one canonical Anecdote identity
// whose signatures every consumer verifies against (composer/install verifyInstall, composer/bottle-attest).
// It is the public fingerprint (key:sha256:… — composer/sign generateIdentity's `.fingerprint`) of the
// platform identity that signs every bottle's install and domain attestation — self-issued at inception.
//
// ENVIRONMENT-SOURCED, NEVER COMMITTED (docs/decisions.md D1). The repo ships an empty slot; the value comes
// from the operator's ENVIRONMENT — the on-device offline origin, mirrored into a Secret when a job runs under
// Actions (or the offline Actions emulation, docs/actions-enough.md). A JS runtime reads it from
// `process.env.ANECDOTE_PLATFORM_KEY`; a static site (the Floor) has no runtime env, so it is stamped in at
// BUILD from the same variable (bin/floor-build). Nothing operator-specific is committed here — so a fork
// inherits a clean slot, and the repo is inert until its one operator (the device) fills it.
//
// SINGLE SOURCE OF TRUTH. This is the ONE place the platform key is named; verifyInstall defaults to it, and a
// downstream that cannot import it (the Floor, another repo) VENDORS this module byte-identically under the
// mirror discipline (docs/decisions.md D5) — one definition, mirrored, never re-invented or per-node.
//
// NULL until the environment provides it → verifyInstall enforces no signer (a caller may still pass one) and
// the Floor's storage adapter stays inert. The safe default.
const fromEnv = (typeof process !== "undefined" && process.env && process.env.ANECDOTE_PLATFORM_KEY) || null;

export const PLATFORM_KEY = fromEnv;

export default PLATFORM_KEY;
