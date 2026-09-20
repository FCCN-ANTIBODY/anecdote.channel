// Unit: press/broadcast.mjs — the three ways to cut a bottle up for showing, and the floor each one sets.
// Run: node press/broadcast.test.mjs
import { planBroadcast, tuningLine, largestStill, codeFor, PROFILES, CUTS } from "./broadcast.mjs";
import { strike } from "./bench.mjs";
import { catcher } from "./catch.mjs";
import { generateIdentity } from "../composer/sign.mjs";
import { packTransfer } from "../composer/transfer.mjs";
import { parseFrame } from "../composer/carrier.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const me = await generateIdentity();
const small = (await strike({ text: "There is shade at this park.", pile: { id: "p" }, identity: me })).transfer;
const big = await packTransfer("anecdote", "x".repeat(20000), me);

// Feed a plan's screens to a catcher until it completes; return how many SCREENS it took.
async function catchIt(plan, { miss = 0, dent = 0 } = {}) {
  const c = catcher({ friends: [me.fingerprint] });
  let dents = 0;
  for (let screen = 0; screen < 4000; screen++) {
    for (const f of plan.frames(screen)) {
      if (miss && screen % miss === miss - 1) continue;                      // a screen the camera did not get
      let frame = f;
      if (dent && ++dents % dent === 0) { const i = frame.length - 3; frame = frame.slice(0, i) + (frame[i] === "A" ? "B" : "A") + frame.slice(i + 1); }
      const r = await c.feed(frame);
      if (r.caught) return { screens: screen + 1, caught: r.caught };
    }
  }
  return { screens: null, caught: null };
}

// 1. STILL — one code, one glance. No loop, no playhead.
{
  const p = await planBroadcast(small, { profile: "still" });
  ok(p.ok && p.pieces === 1 && p.perScreen === 1 && p.floorScreens === 1, "a small bottle fits one code: " + tuningLine(p));
  ok(p.frames(0).length === 1 && p.frames(9)[0] === p.frames(0)[0], "every screen is the same one code — there is nothing to loop");
  const got = await catchIt(p);
  ok(got.screens === 1 && got.caught[0].kind === "anecdote", "caught in a single screen-read");
}

// 2. …and the ceiling is REPORTED, not thrown. Where it falls is the finding.
{
  const p = await planBroadcast(big, { profile: "still" });
  ok(!p.ok && p.over > 0 && /over what one code holds/.test(p.why), "a big bottle will not fit, and says by how much: " + p.why);
  ok(p.frames(0).length === 0 && /WILL NOT FIT/.test(tuningLine(p)), "…and offers no frames rather than a broken code");
  ok(largestStill("L") > largestStill("H"), "the ceiling moves with error correction: L " + largestStill("L") + " B > H " + largestStill("H") + " B");
  ok(codeFor("x".repeat(largestStill("M")), "M") && !codeFor("x".repeat(largestStill("M") + 1), "M"), "the ceiling is exact");
}

// 3. STREAM — redundancy in TIME. Rateless: a late frame is never late.
{
  const p = await planBroadcast(big, { profile: "stream", blockSize: 128 });
  ok(p.ok && p.perScreen === 1 && p.pieces > 100 && p.floorSeconds > 0, "a big bottle streams: " + tuningLine(p));
  const far = p.frames(300000)[0];
  const parsed = parseFrame(far);
  ok(parsed && parsed.type === "droplet" && !parsed.damaged, "frame 300,000 is as valid as frame 0 — the seed space is not a list");
  const got = await catchIt(p);
  ok(got.screens >= p.floorScreens, `caught in ${got.screens} screens against a floor of ${p.floorScreens} — overhead ${(got.screens / p.floorScreens).toFixed(2)}×`);
  const lossy = await catchIt(p, { miss: 3, dent: 5 });
  ok(lossy.screens > got.screens, `a third missed and a fifth dented costs time and nothing else: ${lossy.screens} screens`);
}

// 4. COLLAGE — redundancy in SPACE. One read of the screen catches n pieces.
{
  const p = await planBroadcast(big, { profile: "collage", tiles: 9, blockSize: 128 });
  ok(p.perScreen === 9 && p.floorScreens === Math.ceil(p.pieces / 9), "nine at once divides the floor by nine: " + tuningLine(p));
  ok(new Set(p.frames(0)).size === 9, "the nine tiles are nine DIFFERENT pieces, not one piece nine times");
  const stream = await planBroadcast(big, { profile: "stream", blockSize: 128 });
  ok(p.floorScreens < stream.floorScreens, `${p.floorScreens} screens against the stream's ${stream.floorScreens}`);
  ok(p.version === stream.version, "…at the same code size per tile: the screen pays for it, not the code");
  const got = await catchIt(p);
  ok(got.screens >= p.floorScreens && got.screens < stream.floorScreens, `caught in ${got.screens} screen-reads`);
}

// 5. THE CUT is a second axis. Blocks: fewer pieces, but each one is needed exactly once.
{
  const drops = await planBroadcast(big, { profile: "collage", cut: "droplets", tiles: 4, blockSize: 256 });
  const blocks = await planBroadcast(big, { profile: "collage", cut: "blocks", tiles: 4, blockSize: 256 });
  ok(blocks.pieces === drops.pieces && blocks.floorScreens === drops.floorScreens, "the same payload cuts into the same count either way");
  ok(blocks.frames(0)[0] !== blocks.frames(999)[0] || blocks.pieces <= 4, "blocks wrap — the loop is the set coming round again");
  const seen = new Set(); for (let s = 0; s < blocks.floorScreens; s++) for (const f of blocks.frames(s)) seen.add(f);
  ok(seen.size === blocks.pieces, "one pass over the floor shows every block exactly once");
  ok((await catchIt(blocks)).screens === blocks.floorScreens, "with no loss a block cut is EXACTLY its floor — no overhead at all");
  const lossy = await catchIt(blocks, { miss: 4 });
  ok(lossy.screens > blocks.floorScreens, `but a missed screen waits for the loop: ${lossy.screens} against ${blocks.floorScreens}`);
}

// 6. blockSize is THE knob, and its cost is legible.
{
  const rows = [];
  for (const blockSize of [64, 128, 256, 512]) rows.push(await planBroadcast(big, { profile: "stream", blockSize }));
  ok(rows.every((r, i) => i === 0 || r.pieces < rows[i - 1].pieces), "bigger blocks, fewer pieces: " + rows.map((r) => r.blockSize + "B→" + r.pieces).join(" "));
  ok(rows.every((r, i) => i === 0 || r.version >= rows[i - 1].version), "…and a denser code each: " + rows.map((r) => "v" + r.version).join(" "));
}

ok(PROFILES.length === 3 && CUTS.length === 2, "three profiles, two cuts");
for (const bad of [{ profile: "zoom" }, { cut: "slices" }]) {
  let threw = false; try { await planBroadcast(small, bad); } catch { threw = true; }
  ok(threw, "refused: " + JSON.stringify(bad));
}

if (fails) { console.error(`\n${fails} failed`); process.exit(1); }
console.log("\nbroadcast: all passed");
