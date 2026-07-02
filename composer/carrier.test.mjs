// Unit: the camera-fluent brain — frame grammar + the accumulator that learns the shape early, tolerates
// out-of-order frames, flags a foreign tile, and completes into verified transfers. Decoder/pixel-free.
// Run: node composer/carrier.test.mjs
import { generateIdentity } from "./sign.mjs";
import { packTransfer, packLayout } from "./transfer.mjs";
import { frameTransfer, frameLayout, parseFrame, carrierSession } from "./carrier.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const shuffle = (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [x[i], x[j]] = [x[j], x[i]]; } return x; };

const me = await generateIdentity();
const stranger = await generateIdentity();

// 1. parseFrame recognizes ours and rejects noise.
{
  const t = await packTransfer("poll", "hi", me);
  const [frame] = await frameTransfer(t, 100000);
  const f = parseFrame(frame);
  ok(f && f.type === "block" && f.block.t.startsWith("sha256:"), "a block frame parses (magic-prefixed)");
  ok(parseFrame("https://evil.example/qr") === null, "a foreign/non-carrier decode is rejected");
  ok(parseFrame("AC1|b|-|x|notanint|2|zzz") === null, "a malformed block frame is rejected");
}

// 2. single transfer, chunked, fed OUT OF ORDER → completes → verifies.
{
  const t = await packTransfer("data-pile", "z".repeat(1500), me);
  const frames = await frameTransfer(t, 200);   // many bricks
  ok(frames.length > 1, "a big payload makes many bricks");
  const s = carrierSession({ friends: [me.fingerprint] });
  let snap;
  for (const fr of shuffle(frames)) snap = await s.feed(fr);
  ok(snap.complete, "out-of-order bricks still complete");
  const r = await s.result();
  ok(r.ok && r.transfers[0].verify.ok && r.transfers[0].verify.trusted, "the reassembled transfer verifies + is trusted");
}

// 3. THE SHAPE ARRIVES EARLY: the layout tile alone reveals the expected count before any member completes.
{
  const A = await packTransfer("poll", "A".repeat(400), me);
  const B = await packTransfer("data-pile", "B".repeat(400), me);
  const layout = await packLayout([A, B], me, { shape: { grid: "1x2" } });
  const { frame: layoutFrame, layoutShort } = await frameLayout(layout);

  const s = carrierSession({ friends: [me.fingerprint] });
  const snap0 = await s.feed(layoutFrame);   // ONLY the layout tile so far
  ok(snap0.haveLayout && snap0.expected.count === 2 && !snap0.complete,
     "the layout tile alone yields the expected shape (count=2) BEFORE any member decodes");

  // now stream the members' bricks, shuffled
  const aFrames = await frameTransfer(A, 150, { layoutShort });
  const bFrames = await frameTransfer(B, 150, { layoutShort });
  let snap;
  for (const fr of shuffle([...aFrames, ...bFrames])) snap = await s.feed(fr);
  ok(snap.complete, "the set completes once every attested member is in");
  const r = await s.result();
  ok(r.ok && r.layout.complete && r.layout.trusted, "verified: the layout is complete, no interlopers, trusted signer");
  ok(r.transfers.length === 2 && r.transfers.every((t) => t.verify.ok), "both members verify");
}

// 4. an INTRUDER tile on the side is flagged the moment the shape is known — not by the eye.
{
  const A = await packTransfer("poll", "A".repeat(300), me);
  const B = await packTransfer("data-pile", "B".repeat(300), me);
  const layout = await packLayout([A, B], me, {});
  const { frame: layoutFrame, layoutShort } = await frameLayout(layout);
  const D = await packTransfer("anecdote", "INTRUDER".repeat(50), stranger);   // not in the set

  const s = carrierSession({ friends: [me.fingerprint] });
  await s.feed(layoutFrame);
  const aFrames = await frameTransfer(A, 120, { layoutShort });
  const bFrames = await frameTransfer(B, 120, { layoutShort });
  const dFrames = await frameTransfer(D, 120, { layoutShort });   // the stranger's bricks, same grouping key
  let snap;
  for (const fr of shuffle([...aFrames, ...bFrames, ...dFrames])) snap = await s.feed(fr);
  ok(snap.foreign.some((x) => /interloper/.test(x.reason)), "the intruder tile is flagged foreign (not an attested member)");
  ok(snap.complete, "the set still completes on its attested members despite the interloper");
  const r = await s.result();
  ok(r.layout.complete && r.transfers.length === 2, "verified result contains only the attested set");
}

// 5. a partial scan never completes (a brick short) — never handed on as whole.
{
  const A = await packTransfer("poll", "A".repeat(600), me);
  const frames = await frameTransfer(A, 100);
  const s = carrierSession({ friends: [me.fingerprint] });
  let snap; for (const fr of frames.slice(0, frames.length - 1)) snap = await s.feed(fr);
  ok(!snap.complete && (await s.result()).ok === false, "a missing brick → never complete, result not ok");
}

// 6. a foreign layout tile (stranger-signed) verifies as SOMEONE's but is not trusted.
{
  const A = await packTransfer("poll", "A", me);
  const forged = await packLayout([A], stranger, {});
  const { frame } = await frameLayout(forged);
  const s = carrierSession({ friends: [me.fingerprint] });
  const snap = await s.feed(frame);
  ok(snap.haveLayout, "a validly-signed layout tile is accepted structurally");
  const aFrames = await frameTransfer(A, 100000, { layoutShort: snap.layoutShort });
  for (const fr of aFrames) await s.feed(fr);
  const r = await s.result();
  ok(r.ok && r.layout.ok && !r.layout.trusted, "a face-copied set verifies as someone's but is NOT a trusted signer");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall carrier tests passed");
