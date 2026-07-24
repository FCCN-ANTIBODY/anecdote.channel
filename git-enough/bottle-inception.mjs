// git-enough/bottle-inception.mjs — the git bottle's INCEPTION SLOT: what a provisioned bottle was given at
// birth, as a committed-null module the provision step overwrites in the SERVED copy (the repo keeps the
// empty slot — docs/decisions.md D1, the same stamped-at-build pattern as the Floor's platform-key.mjs).
//
// A provisioned bottle's inception carries:
//   attestation — its domain-anchored self-attestation (composer/bottle-attest mintBottleAttestation),
//                 platform-signed at inception: "this API runs for <label>.<storage>, since <when>".
//   platformKey — the pinned platform fingerprint the boot gate verifies that attestation against.
//   manifest    — (storage engines only) the pre-minted, platform-signed install manifest
//                 (composer/install mintInstall) the bottle vends over the `install` op.
//
// NULL until provisioned → the boot gate refuses and the bottle offers nothing: an unprovisioned bottle
// does not serve, the same honest default as an unstamped Floor. Never fill this from the URL or a caller —
// inception is the bottle's OWN data, read by the pinned runtime.
export const INCEPTION = null;

export default INCEPTION;
