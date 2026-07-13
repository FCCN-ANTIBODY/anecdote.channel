// composer/install-op.mjs — the ENGINE half of the install grammar: the one op every storage engine bottle
// vends so a consumer can bootstrap it. `install` hands back the engine's PRE-MINTED, platform-signed client
// blobs (composer/install.mjs mintInstall). The consumer runs verifyInstall against its pin, then
// loadInstall (composer/install-loader) mounts + imports the entry — the glove.
//
// Pre-minted on purpose. The manifest is signed at PUBLISH time and served as static bytes, so the running
// engine holds NO platform key — nothing to leave unattended, nothing to steal. It's the same shape as the
// bottle's own domain-anchored attestation: self-issued at inception, then only ever read. That is why
// `install` is Rung 0 (read-only, no confirm): serving already-signed bytes grants nothing.
//
// This is common grammar, not git's — compose it into ANY engine bottle alongside its domain ops:
//   { ...installOps({ manifest }), ...gitOps(deps) }.  The manifest is produced offline by the engine's
// publish step (mintInstall) and pinned here as data; this module never signs.

import { INSTALL } from "./install.mjs";

// Vend one op, `install`, that emits the pre-minted manifest. `manifest` is a mintInstall output; we sanity
// -check its shape at wiring time (a mis-wired engine should fail loudly at boot, not hand a consumer junk).
export function installOps({ manifest } = {}) {
  if (!manifest || manifest.schema !== INSTALL || !manifest.entry || !Array.isArray(manifest.blobs) || !manifest.blobs.length)
    throw new Error("install-op: needs a minted install manifest ({ schema:'" + INSTALL + "', entry, blobs })");
  return {
    // Rung 0 — read-only. Hand back the whole signed manifest; the consumer verifies it against its own pin.
    "install": async (_input, api) => { api.emit(manifest); },
  };
}

export default installOps;
