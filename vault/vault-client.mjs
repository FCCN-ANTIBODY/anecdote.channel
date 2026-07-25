// vault/vault-client.mjs — the vault CLIENT: the "request half" the vault engine delivers over the install
// grammar (composer/install), which a consumer wears (the glove) to drive the engine's cold-storage ops over
// the probe. Mirrors git-enough/git-client.mjs: it wraps a probe-line invoke into a small seekable API and
// holds NOTHING — no bytes, no handle. The engine (holding the injected backend) does the byte work; this side
// just asks. This module is what a vault engine's `install` ships as its entry.
//
// The surface is deliberately the seekable-file surface a bottle behind a cold-store stub wants, and no more:
// `stat`/`read`/`verify` are reads (Rung 0). `promote` is the ONE Rung-1 op — the crown-gated staging→vault
// commit (docs/gravel-whale.md) — so it carries confirmed:true, exactly as git-client's persisting ops do.

const dataFrame = (res, key) => (res && res.frames ? res.frames.find((f) => f && f[key] !== undefined) || res.frames[0] || null : null);

export function makeVaultClient(invoke) {
  if (typeof invoke !== "function") throw new Error("vault-client: needs a probe invoke(op, input, opts)");
  const confirmed = (op, input) => invoke(op, input, { confirmed: true });
  return {
    // the whole picture: { total, members, workingSet, residentBytes, verifiedBytes, complete, … }
    stat: () => invoke("vault.stat", {}).then((r) => { const f = dataFrame(r, "stat"); return f ? f.stat : null; }),
    // the seek: logical bytes [offset, offset+length) → Uint8Array, pulled through the shard VFS
    read: (offset, length) => invoke("vault.read", { offset, length }).then((r) => { const f = dataFrame(r, "bytes"); return f ? f.bytes : null; }),
    // page every member once, verifying each (the intake→seal pass) → the resulting stat
    verify: () => invoke("vault.verify", {}).then((r) => { const f = dataFrame(r, "stat"); return f ? f.stat : null; }),
    // Rung 1 — the crown-gated commit of staged shards into the user's durable vault → the promote result
    promote: (receipt) => confirmed("vault.promote", { receipt }).then((r) => { const f = dataFrame(r, "promoted"); return f ? f.promoted : null; }),
  };
}

export default makeVaultClient;
