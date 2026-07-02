// Unit: rateless fountain (LT) coding — reconstruct a payload from ANY sufficient subset of droplets, so
// lost/damaged frames heal by catching more. Deterministic pseudo-loss (no Math.random) keeps it non-flaky:
// the sender is rateless, so we just keep emitting droplets past the losses until the decoder solves.
// Run: node composer/fountain.test.mjs
import { ltEncode, ltDecoder } from "./fountain.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const eqBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const payload = (n) => { const u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = (i * 37 + 11) & 0xff; return u; };
// deterministic "is this frame lost?" — a stable hash of the seed vs a loss percentage
const lost = (seed, pct) => ((Math.imul(seed + 1, 2654435761) >>> 0) % 100) < pct;
const damaged = (seed, pct) => ((Math.imul(seed + 7, 40503) >>> 0) % 100) < pct;

// Drive a decoder from a rateless stream, skipping lost frames and dropping damaged ones (a real frame
// layer catches corruption by checksum and treats it as an erasure). Returns seeds consumed, or -1 if the
// cap is hit. `cap` is generous — the point is it heals, and we report the overhead.
function recover(bytes, { blockSize = 64, loss = 0, damage = 0, cap } = {}) {
  const enc = ltEncode(bytes, { blockSize });
  const dec = ltDecoder(enc.K, enc.B, enc.L);
  const limit = cap || enc.K * 8 + 40;
  let seed = 0, fed = 0;
  while (!dec.done() && seed < limit) {
    const s = seed++;
    if (loss && lost(s, loss)) continue;                 // frame never arrived
    let drop = enc.droplet(s);
    if (damage && damaged(s, damage)) continue;          // frame arrived corrupt → checksum drops it (erasure)
    dec.add(drop); fed++;
  }
  return { done: dec.done(), bytes: dec.bytes(), K: enc.K, fed, seeds: seed };
}

// 1. clean round-trip across several sizes; measure overhead (droplets fed / K).
{
  for (const n of [64, 500, 5000]) {
    const b = payload(n);
    const r = recover(b, { blockSize: 64 });
    ok(r.done && eqBytes(r.bytes, b), `clean decode of ${n}B (K=${r.K})`);
    console.log(`     overhead: ${r.fed} droplets for K=${r.K}  (${(r.fed / r.K).toFixed(2)}x)`);
  }
}

// 2. LOSS: drop ~40% of frames — rateless stream heals by emitting more.
{
  const b = payload(4000);
  const r = recover(b, { blockSize: 64, loss: 40 });
  ok(r.done && eqBytes(r.bytes, b), "heals through ~40% frame LOSS (kept emitting until solved)");
  console.log(`     with 40% loss: fed ${r.fed} good droplets over ${r.seeds} emitted, K=${r.K}`);
}

// 3. DAMAGE: ~25% of frames arrive corrupt → dropped as erasures → still heals.
{
  const b = payload(4000);
  const r = recover(b, { blockSize: 64, damage: 25 });
  ok(r.done && eqBytes(r.bytes, b), "heals through ~25% frame DAMAGE (corrupt frames dropped, filled by others)");
}

// 4. LOSS + DAMAGE together.
{
  const b = payload(6000);
  const r = recover(b, { blockSize: 96, loss: 25, damage: 20 });
  ok(r.done && eqBytes(r.bytes, b), "heals through combined 25% loss + 20% damage");
}

// 5. a droplet from a different payload (wrong K/B/L) is ignored, not corrupting.
{
  const a = ltEncode(payload(300), { blockSize: 64 });
  const other = ltEncode(payload(999), { blockSize: 32 });
  const dec = ltDecoder(a.K, a.B, a.L);
  ok(dec.add(other.droplet(0)).ignored === true, "a foreign-payload droplet is ignored (K/B/L mismatch)");
  let s = 0; while (!dec.done() && s < a.K * 8 + 40) dec.add(a.droplet(s++));
  ok(dec.done() && eqBytes(dec.bytes(), payload(300)), "still decodes cleanly after ignoring the foreign droplet");
}

// 6. K=1 edge (payload fits one block).
{
  const b = payload(40);
  const r = recover(b, { blockSize: 256 });
  ok(r.K === 1 && r.done && eqBytes(r.bytes, b), "K=1 payload decodes");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall fountain tests passed");
