// composer/platform-key.mjs — the constellation's PINNED PLATFORM KEY: the one canonical Anecdote identity
// whose signatures every consumer verifies against (composer/install verifyInstall, composer/bottle-attest).
// It is the public fingerprint (key:sha256:… — composer/sign generateIdentity's `.fingerprint`) of the
// platform identity that signs every bottle's install and domain attestation — self-issued at inception,
// present since inception.
//
// SINGLE SOURCE OF TRUTH. This is the ONE place the platform key is named. It is NOT a per-node key — unlike a
// Tell's own keys/tell.fpr or keys/boundary.fpr, which each sovereign node generates and legitimately diverges
// on. There is one canonical Anecdote, so there is one value here, and every consumer derives from it rather
// than committing its own copy. A downstream that cannot import this module (the tell floor, another repo)
// VENDORS it byte-identically under the mirror discipline — one definition, mirrored, never re-invented.
//
// NULL until set at inception. With no key, verifyInstall enforces no signer (a caller may still pass one
// explicitly) and the tell floor's storage adapter stays inert — the safe default. Set this once to the
// Anecdote platform identity's public fingerprint and the whole constellation pins it.
export const PLATFORM_KEY = null;

export default PLATFORM_KEY;
