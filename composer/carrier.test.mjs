// Unit: the camera-fluent brain — frame grammar + the accumulator that learns the shape early, tolerates
// out-of-order frames, flags a foreign tile, and completes into verified transfers. Decoder/pixel-free.
// Run: node composer/carrier.test.mjs
import { generateIdentity } from "./sign.mjs";
import { packTransfer, packLayout } from "./transfer.mjs";
import { frameTransfer, frameLayout, fountainTransfer, parseFrame, carrierSession } from "./carrier.mjs";

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

// ---- fountain-fed carrier: the rateless stream as a ready tool ----------------------------------------

// A deliberate DENT: flip one character inside a frame's payload field (never the separator).
const dent = (frame) => { const i = frame.length - 3; const c = frame[i] === "A" ? "B" : "A"; return frame.slice(0, i) + c + frame.slice(i + 1); };
// deterministic "is this frame lost / dented?" — stable per seed, like fountain.test.mjs
const lost = (seed, pct) => ((Math.imul(seed + 1, 2654435761) >>> 0) % 100) < pct;
const dented = (seed, pct) => ((Math.imul(seed + 7, 40503) >>> 0) % 100) < pct;

// 7. droplet frames parse; a DENTED frame announces itself as damage (ours-but-dented, not noise).
{
  const t = await packTransfer("poll", "fountain me", me);
  const ft = await fountainTransfer(t, { blockSize: 64 });
  const f = parseFrame(ft.frame(0));
  ok(f && f.type === "droplet" && !f.damaged && f.memberId === ft.memberId, "a droplet frame parses (magic-prefixed, checksummed)");
  const d = parseFrame(dent(ft.frame(0)));
  ok(d && d.type === "droplet" && d.damaged === true, "a dented droplet is recognized as OURS but DAMAGED (not foreign noise)");
  ok(parseFrame("AC1|d|-|x|notanint|64|100|0|deadbeef|zzz") === null, "a malformed droplet frame is rejected");
}

// 8. THE HEADLINE: heal through loss AND deliberate dents — the dents are counted, the transfer verifies.
{
  const t = await packTransfer("data-pile", "z".repeat(1500), me);
  const ft = await fountainTransfer(t, { blockSize: 128 });
  const s = carrierSession({ friends: [me.fingerprint] });
  let snap = null, seed = 0, fedDents = 0;
  const cap = ft.K * 10 + 60;
  while ((!snap || !snap.complete) && seed < cap) {
    const sd = seed++;
    if (lost(sd, 25)) continue;                    // frame never caught (looped past it)
    let fr = ft.frame(sd);
    if (dented(sd, 20)) { fr = dent(fr); fedDents++; }   // deliberately damaged — the crimp
    snap = await s.feed(fr);
  }
  ok(snap && snap.complete, `heals through ~25% loss + ~20% deliberate dents (K=${ft.K}, ${seed} seeds emitted)`);
  ok(snap.damaged === fedDents && fedDents > 0, `every dent was SEEN and counted (${snap.damaged}) — visible healing, not silence`);
  ok(snap.present[0].mode === "fountain", "the snapshot says this member drank from the fountain");
  const r = await s.result();
  ok(r.ok && r.transfers[0].verify.ok && r.transfers[0].verify.trusted, "the healed transfer verifies + is trusted (dents never reached the payload)");
}

// 9. duplicates are harmless; a completed member ignores the still-looping stream.
{
  const t = await packTransfer("poll", "loop forever", me);
  const ft = await fountainTransfer(t, { blockSize: 256 });
  const s = carrierSession({ friends: [me.fingerprint] });
  let snap;
  for (let pass = 0; pass < 3; pass++) for (let sd = 0; sd < ft.K + 6; sd++) snap = await s.feed(ft.frame(sd));
  ok(snap.complete && (await s.result()).ok, "three loop passes over the same seeds: duplicates harmless, still verified");
}

// 10. a MIXED set: one member arrives as bricks, the other as a fountain stream — same layout, both attested.
{
  const A = await packTransfer("poll", "A".repeat(300), me);
  const Bt = await packTransfer("data-pile", "B".repeat(900), me);
  const layoutSigned = await packLayout([A, Bt], me, {});
  const { frame: lFrame, layoutShort } = await frameLayout(layoutSigned);
  const s = carrierSession({ friends: [me.fingerprint] });
  await s.feed(lFrame);
  for (const fr of await frameTransfer(A, 120, { layoutShort })) await s.feed(fr);
  const ftB = await fountainTransfer(Bt, { blockSize: 128, layoutShort });
  let snap; let sd = 0;
  while ((!snap || !snap.complete) && sd < ftB.K * 8 + 40) snap = await s.feed(ftB.frame(sd++));
  ok(snap.complete, "a mixed set completes: bricks for one member, fountain for the other");
  const modes = Object.fromEntries(snap.present.map((p) => [p.mode, true]));
  ok(modes.blocks && modes.fountain, "the snapshot shows both modes side by side");
  const r = await s.result();
  ok(r.ok && r.layout.trusted && r.transfers.every((x) => x.verify.ok), "the whole mixed set verifies under the signed layout");
}

// 11. a foreign fountain (another payload's droplets) is flagged, not absorbed.
{
  const A = await packTransfer("poll", "mine", me);
  const X = await packTransfer("poll", "not in the set", stranger);
  const layoutSigned = await packLayout([A], me, {});
  const { frame: lFrame, layoutShort } = await frameLayout(layoutSigned);
  const s = carrierSession({ friends: [me.fingerprint] });
  await s.feed(lFrame);
  const ftX = await fountainTransfer(X, { blockSize: 64, layoutShort });
  const snap = await s.feed(ftX.frame(0));
  ok(snap.foreign.some((g) => /interloper/.test(g.reason)), "an unattested member's droplet is flagged as an interloper");
  const ftA = await fountainTransfer(A, { blockSize: 64, layoutShort });
  let s2; let sd = 0;
  while ((!s2 || !s2.complete) && sd < ftA.K * 8 + 40) s2 = await s.feed(ftA.frame(sd++));
  ok(s2.complete && (await s.result()).ok, "the attested member still completes around the interloper");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall carrier tests passed");
