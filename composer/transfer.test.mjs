// Unit: offline transfer innards — the signed envelope (verify-from-anyone, trust-is-local), chunking
// (bricks in the road, whole-payload checksum), and the layout (constellation integrity — an intruder tile
// is caught by the set, not the eye). Carrier-agnostic; no QR yet. Run: node composer/transfer.test.mjs
import { generateIdentity } from "./sign.mjs";
import { packTransfer, verifyTransfer, transferId, chunk, reassemble, packLayout, verifyLayout, TRANSFER } from "./transfer.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const td = new TextDecoder();

const me = await generateIdentity();       // a trusted friend
const stranger = await generateIdentity(); // not on the friend list

// 1. pack + verify: authentic + intact; bytes round-trip.
{
  const t = await packTransfer("anecdote", "hello gravel", me);
  const v = await verifyTransfer(t, { friends: [me.fingerprint] });
  ok(v.ok && v.by === me.fingerprint && v.kind === "anecdote", "a packed transfer verifies; by = signer");
  ok(td.decode(v.bytes) === "hello gravel", "payload round-trips");
  ok(v.trusted, "signer on the friend list → trusted");
}

// 2. verify-from-anyone, trust-is-local: a stranger's transfer is authentic but not trusted.
{
  const t = await packTransfer("poll", "stranger payload", stranger);
  const v = await verifyTransfer(t, { friends: [me.fingerprint] });
  ok(v.ok && !v.trusted, "a stranger's transfer VERIFIES (from anyone) but is NOT trusted (local decision)");
}

// 3. tamper: swapped payload / mutated field both fail.
{
  const t = await packTransfer("anecdote", "original", me);
  const swapped = { ...t, bytes: Buffer.from("evil").toString("base64") };
  ok(!(await verifyTransfer(swapped)).ok, "swapped payload fails (hash mismatch / signature)");
  const relabeled = { ...t, kind: "firmware" };
  ok(!(await verifyTransfer(relabeled)).ok, "a mutated field fails the signature");
}

// 4. chunking: a small capacity lays down many bricks; reassembly rebuilds + verifies.
{
  const t = await packTransfer("data-pile", "x".repeat(2000), me);
  const blocks = await chunk(t, 300);
  ok(blocks.length > 1 && blocks.every((b) => b.n === blocks.length), "chunk lays down N bricks (platform has no opinion about N)");
  const r = await reassemble(blocks);
  ok(r.ok && r.total === blocks.length, "reassemble rebuilds the full set");
  const back = JSON.parse(td.decode(r.bytes));
  ok((await verifyTransfer(back, { friends: [me.fingerprint] })).ok, "the reassembled transfer verifies");
  ok((await transferId(back)) === r.id, "reassembled bytes hash to the payload id (whole-payload checksum)");
}

// 5. a partial scan is never whole; a foreign brick is ignored; a swapped brick is caught.
{
  const t = await packTransfer("data-pile", "y".repeat(1000), me);
  const blocks = await chunk(t, 200);
  const partial = blocks.slice(0, blocks.length - 1);
  const rp = await reassemble(partial);
  ok(!rp.ok && rp.missing.length === 1, "a partial set → ok:false with the missing index (never processed as whole)");

  const foreign = (await chunk(await packTransfer("anecdote", "other road", stranger), 200))[0];
  const rWithForeign = await reassemble([...blocks, foreign]);
  ok(rWithForeign.ok, "a stray brick from another payload is ignored (grouped by id)");

  const swapped = blocks.map((b, i) => (i === 1 ? { ...b, b: Buffer.from("tampered-brick").toString("base64") } : b));
  const rs = await reassemble(swapped);
  ok(!rs.ok && rs.corrupt, "a swapped brick fails the whole-payload checksum");
}

// 6. capacity >= size → a single brick.
{
  const t = await packTransfer("poll", "small", me);
  ok((await chunk(t, 100000)).length === 1, "a payload that fits is one brick");
}

// 7. the layout: the set attests its own shape; an intruder tile is caught, not by the eye.
{
  const A = await packTransfer("poll", "A", me);
  const B = await packTransfer("data-pile", "B", me);
  const C = await packTransfer("anecdote", "C", me);
  const layout = await packLayout([A, B, C], me, { shape: { grid: "1x3" } });

  const good = await verifyLayout(layout, [A, B, C], { friends: [me.fingerprint] });
  ok(good.ok && good.trusted && good.shapeOk && good.complete, "the exact attested set → complete, no interlopers");

  const D = await packTransfer("anecdote", "INTRUDER on the side", stranger);
  const withIntruder = await verifyLayout(layout, [A, B, C, D], { friends: [me.fingerprint] });
  ok(!withIntruder.complete && withIntruder.interlopers.length === 1, "an intruder tile is flagged — not an attested member");

  const incomplete = await verifyLayout(layout, [A, B], { friends: [me.fingerprint] });
  ok(!incomplete.complete && incomplete.missing.length === 1, "a missing tile is flagged (the shape is short)");
}

// 8. a forged layout: authentic-looking but signed by a stranger → verifies but not trusted (face-copy defeated by the friend list, not branding).
{
  const A = await packTransfer("poll", "A", me);
  const forged = await packLayout([A], stranger, {});
  const v = await verifyLayout(forged, [A], { friends: [me.fingerprint] });
  ok(v.ok && !v.trusted, "a face-copied layout verifies as SOMEONE's but is not a trusted signer");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall transfer tests passed");
