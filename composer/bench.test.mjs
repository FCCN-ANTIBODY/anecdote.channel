// Tests for the benchmark stats core. Dependency-free, deterministic.
//   node composer/bench.test.mjs
import { percentile, stats, ms, mb } from "./bench.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// 1. percentile picks the expected rank (order-independent input).
{
  const xs = [50, 10, 30, 20, 40]; // sorted: 10,20,30,40,50
  ok(percentile(xs, 50) === 30, "p50 of 1..5 tens is 30");
  ok(percentile(xs, 100) === 50, "p100 is the max");
  ok(percentile(xs, 1) === 10, "low percentile is the min");
}

// 2. stats summarizes correctly.
{
  const s = stats([100, 100, 100, 100]);
  ok(s.n === 4 && s.min === 100 && s.max === 100 && s.median === 100 && s.mean === 100, "uniform samples summarize flat");
  ok(Math.abs(s.perSec - 10) < 1e-9, "4 samples totaling 400ms => 10/sec");
}
{
  const s = stats([10, 20, 30, 40, 50]);
  ok(s.median === 30 && s.p95 === 50 && s.min === 10 && s.max === 50, "mixed samples: median 30, p95 50");
}

// 3. edge cases don't throw.
ok(stats([]).n === 0, "empty samples => n=0, no throw");
ok(Number.isNaN(percentile([], 50)), "percentile of empty is NaN");

// 4. formatting helpers.
ok(ms(250) === "250 ms" && ms(1500) === "1.50 s", "ms() switches to seconds past 1000");
ok(mb(23_000_000) === "23.0 MB", "mb() formats megabytes");

console.log(fails ? `\n${fails} FAILED` : "\nbench: all tests passed");
process.exit(fails ? 1 : 0);
