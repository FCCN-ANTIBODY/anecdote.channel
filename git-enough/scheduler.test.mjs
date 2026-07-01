// Tests for the beat scheduler (the "privileged budget"). Fake timer + clock, so cadence/budget/teardown
// are deterministic. One integration case drives a real stagingBeat → repo, read back by git.
//   node git-enough/scheduler.test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { repo, looseFiles, refFiles } from "./repo.mjs";
import { stagingBeat } from "./staging-beat.mjs";
import { beatScheduler } from "./scheduler.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const dirs = [];

// A fake timer + clock we drive by hand.
function harness() {
  let fired = null, clock = 0;
  const setTimer = (fn) => { fired = fn; return 1; };
  const clearTimer = () => { fired = null; };
  return { setTimer, clearTimer, now: () => clock, tick: () => fired && fired(), advance: (ms) => { clock += ms; }, cleared: () => fired === null };
}
// A fake beat recording calls; tick "commits" unless told otherwise.
function fakeBeat() {
  const calls = [];
  let commitNext = true;
  return {
    calls,
    setCommit: (v) => { commitNext = v; },
    tick: async () => { calls.push("tick"); return { committed: commitNext }; },
    teardownFlush: async () => { calls.push("teardown"); return { committed: true }; },
  };
}

try {
  // 1. Tempo: each timer fire ticks the beat.
  {
    const h = harness(); const beat = fakeBeat();
    const sch = beatScheduler(beat, { period: 1000, setTimer: h.setTimer, clearTimer: h.clearTimer, now: h.now });
    await h.tick(); await h.tick();
    ok(beat.calls.filter((c) => c === "tick").length === 2, "each timer fire drives a tick");
    sch.stop(); ok(h.cleared(), "stop() clears the timer");
  }

  // 2. Budget — minGap: commits closer than minGap are suppressed (only real commits spend budget).
  {
    const h = harness(); const beat = fakeBeat();
    const sch = beatScheduler(beat, { period: 1, minGap: 500, setTimer: h.setTimer, clearTimer: h.clearTimer, now: h.now });
    const r1 = await sch.beatOnce();      // t=0 → commits
    const r2 = await sch.beatOnce();      // t=0 → within minGap → suppressed
    h.advance(500);
    const r3 = await sch.beatOnce();      // t=500 → allowed again
    ok(r1.committed && r3.committed && !r2.committed && r2.reason === "budget:min-gap", "minGap rate-limits actual commits");
    ok(beat.calls.filter((c) => c === "tick").length === 2, "the suppressed beat never even ticked the beat");
  }

  // 3. Budget — maxCommits caps the session.
  {
    const h = harness(); const beat = fakeBeat();
    const sch = beatScheduler(beat, { period: 1, maxCommits: 2, setTimer: h.setTimer, clearTimer: h.clearTimer, now: h.now });
    const rs = [await sch.beatOnce(), await sch.beatOnce(), await sch.beatOnce()];
    ok(rs[0].committed && rs[1].committed && !rs[2].committed && rs[2].reason === "budget:max-commits", "maxCommits caps commits per session");
    ok(sch.stats().commits === 2, "stats report the spend");
  }

  // 4. A no-op tick (zero-diff) does NOT spend budget.
  {
    const h = harness(); const beat = fakeBeat();
    const sch = beatScheduler(beat, { period: 1, minGap: 1000, setTimer: h.setTimer, clearTimer: h.clearTimer, now: h.now });
    beat.setCommit(false); await sch.beatOnce();   // ticks, no commit
    beat.setCommit(true); const r = await sch.beatOnce(); // immediately after — but no budget was spent
    ok(r.committed, "a real commit right after a no-op tick is allowed (no budget spent by the no-op)");
  }

  // 5. Teardown handler flushes; stop() unregisters it.
  {
    const h = harness(); const beat = fakeBeat();
    let teardownFn = null; let unreg = false;
    const onTeardown = (fn) => { teardownFn = fn; return () => { unreg = true; }; };
    const sch = beatScheduler(beat, { period: 1000, onTeardown, setTimer: h.setTimer, clearTimer: h.clearTimer, now: h.now });
    await teardownFn();
    ok(beat.calls.includes("teardown"), "the teardown hook calls teardownFlush");
    sch.stop(); ok(unreg, "stop() unregisters the teardown hook");
  }

  // 6. Integration: scheduler → real stagingBeat → repo, read back by git.
  {
    const r = repo();
    const author = { name: "beat", email: "b@o", epoch: 1700000000, tz: "+0000" };
    const beat = stagingBeat({ repo: r, author, mode: "tempo" });
    await beat.stage("a.txt", "1\n");
    const h = harness();
    const sch = beatScheduler(beat, { period: 1000, setTimer: h.setTimer, clearTimer: h.clearTimer, now: h.now });
    await sch.beatOnce("tempo");          // drive an (awaited) tempo commit
    sch.stop();

    const d = mkdtempSync(join(tmpdir(), "git-sched-")); dirs.push(d);
    execFileSync("git", ["init", "-q", d]);
    for (const f of await looseFiles(r)) { const p = join(d, ".git", f.path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, Buffer.from(f.bytes)); }
    for (const f of refFiles(r)) { const p = join(d, ".git", f.path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, f.text); }
    ok(execFileSync("git", ["-C", d, "cat-file", "-p", "HEAD:a.txt"]).toString() === "1\n", "the scheduler drove a real commit git reads back");
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall scheduler tests passed");
