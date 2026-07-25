// vault/probe-ops.mjs — the ENGINE half: the vault's domain ops, composed into a bottle's op surface alongside
// the common install/describe/attest grammar (git-enough/bottle.mjs shows the shape:
// `{ ...installOps({ manifest }), ...vaultOps(deps) }`). Pure and transport-free — the served page and the
// cross-origin hello are the thin browser layer on top, same as the git bottle.
//
// Reads (stat/read/verify) are Rung 0 — serving bytes the consumer's own manifest already names grants nothing.
// `promote` is Rung 1: the crown-gated staging→vault commit, present only when the bottle was provisioned with
// an intake that can promote (docs/gravel-whale.md). No promote dep → a read-only vault, exactly as a git-only
// bottle drops `install` when unprovisioned.

export function vaultOps({ store, promote } = {}) {
  if (!store || typeof store.read !== "function" || typeof store.stat !== "function")
    throw new Error("vault-op: needs a store (vault-store.mjs)");
  return {
    "vault.stat": async (_input, api) => { api.emit({ stat: store.stat() }); },
    "vault.read": async (input, api) => { api.emit({ bytes: await store.read(input.offset, input.length) }); },
    "vault.verify": async (_input, api) => { api.emit({ stat: await store.verifyAll() }); },
    ...(typeof promote === "function"
      ? { "vault.promote": async (input, api) => { api.emit({ promoted: await promote(input.receipt) }); } }
      : {}),
  };
}

export default vaultOps;
