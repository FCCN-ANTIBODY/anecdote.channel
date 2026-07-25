// Unit: vault/vault-client.mjs — the delivered vault client wraps a probe invoke into a small seekable API.
// It sends the right op, carries confirmed:true only for the Rung-1 `promote`, and returns the op's data frame.
// It holds no bytes and no handle. Run: node vault/vault-client.test.mjs
import { makeVaultClient } from "./vault-client.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const FRAMES = {
  "vault.stat": { stat: { total: 10, members: 3, verifiedBytes: 10, residentBytes: 4, complete: true } },
  "vault.read": { bytes: Uint8Array.from([3, 4, 5, 6]) },
  "vault.verify": { stat: { total: 10, members: 3, verifiedBytes: 10, complete: true } },
  "vault.promote": { promoted: { count: 3, into: "user-vault" } },
};

async function run() {
  const calls = [];
  const invoke = (op, input, opts = {}) => { calls.push({ op, input, opts }); return Promise.resolve({ frames: [FRAMES[op]] }); };
  const last = () => calls[calls.length - 1];
  const v = makeVaultClient(invoke);

  ok((await v.stat()).total === 10, "stat returns the stat frame");
  ok(last().op === "vault.stat" && !last().opts.confirmed, "stat (Rung 0) carries no confirmation");

  const b = await v.read(2, 4);
  ok(b.length === 4 && b[0] === 3, "read returns the bytes frame");
  ok(last().op === "vault.read" && last().input.offset === 2 && last().input.length === 4 && !last().opts.confirmed, "read sends offset+length, unconfirmed (Rung 0)");

  ok((await v.verify()).complete === true, "verify returns the resulting stat");
  ok(last().op === "vault.verify" && !last().opts.confirmed, "verify (Rung 0) carries no confirmation");

  const p = await v.promote({ id: "receipt-1" });
  ok(p.count === 3, "promote returns the promoted frame");
  ok(last().op === "vault.promote" && last().input.receipt.id === "receipt-1" && last().opts.confirmed === true, "promote is the one confirmed (Rung 1) op — the crown-gated commit");

  ok((() => { try { makeVaultClient(null); return false; } catch { return true; } })(), "a client needs an invoke");

  console.log(`\n${fails ? "FAILED" : "all"} vault-client tests${fails ? "" : " passed"}`);
  if (fails) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
