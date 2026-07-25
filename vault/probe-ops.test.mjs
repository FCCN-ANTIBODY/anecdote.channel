// Unit: vault/probe-ops.mjs — the engine op surface. Reads emit the store's frames; `promote` appears only when
// the bottle was provisioned with a promote intake (like a git-only bottle dropping `install`). A fake api
// captures emits; a fake store stands in for vault-store. Run: node vault/probe-ops.test.mjs
import { vaultOps } from "./probe-ops.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const fakeStore = {
  read: async (offset, length) => Uint8Array.from({ length }, (_, i) => offset + i),
  stat: () => ({ total: 10, members: 3, verifiedBytes: 6, complete: false }),
  verifyAll: async () => ({ total: 10, members: 3, verifiedBytes: 10, complete: true }),
};
const cap = () => { const out = []; return { api: { emit: (f) => out.push(f) }, out }; };

async function run() {
  // read-only surface, no promote dep
  {
    const ops = vaultOps({ store: fakeStore });
    ok(!("vault.promote" in ops), "no promote intake → read-only vault (no vault.promote op)");

    let c = cap(); await ops["vault.stat"]({}, c.api);
    ok(c.out[0].stat.total === 10, "vault.stat emits the store's stat");

    c = cap(); await ops["vault.read"]({ offset: 5, length: 3 }, c.api);
    ok(c.out[0].bytes.length === 3 && c.out[0].bytes[0] === 5, "vault.read emits the store's bytes for the range");

    c = cap(); await ops["vault.verify"]({}, c.api);
    ok(c.out[0].stat.complete === true, "vault.verify emits the post-verify stat");
  }
  // provisioned with a promote intake
  {
    let promotedWith = null;
    const ops = vaultOps({ store: fakeStore, promote: async (receipt) => { promotedWith = receipt; return { count: 2 }; } });
    ok("vault.promote" in ops, "a promote intake → the crown-gated vault.promote op appears");
    const c = cap(); await ops["vault.promote"]({ receipt: { id: "r1" } }, c.api);
    ok(promotedWith.id === "r1" && c.out[0].promoted.count === 2, "vault.promote runs the intake and emits the result");
  }
  // mis-wiring fails loudly at boot
  ok((() => { try { vaultOps({}); return false; } catch { return true; } })(), "a vault op surface needs a store");

  console.log(`\n${fails ? "FAILED" : "all"} vault probe-ops tests${fails ? "" : " passed"}`);
  if (fails) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
