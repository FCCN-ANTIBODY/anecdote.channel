// git-enough/scheduler.mjs — what drives the staging beat's tick() on a cadence: Origin's "privileged
// budget" made concrete. The beat (staging-beat.mjs) is pure policy about WHAT/WHEN-relative-to-a-tick;
// the scheduler is the runtime that decides HOW OFTEN and HOW MUCH background committing you permit, and
// it flushes on teardown. The beat's own mayRun() gate still governs authority per commit; the scheduler
// only supplies cadence + a budget, so a revoked/incognito beat simply no-ops under it.
//
// Every timing/lifecycle primitive is injectable, so this is testable in Node; browser defaults wire real
// timers and page-lifecycle events.

// The core. Auto-starts. Returns { stop, beatOnce, stats }.
//   beat        a stagingBeat (needs .tick() and .teardownFlush())
//   period      tempo cadence, ms (default 30s)
//   minGap      budget: minimum ms between ACTUAL commits (rate limit; no-op ticks don't count)
//   maxCommits  budget: cap on commits this session (default unlimited)
//   setTimer/clearTimer  interval primitives (default globalThis.setInterval/clearInterval)
//   onTeardown  (handler) => unregister — fires handler when the session is going away (default: none;
//               pass browserTeardown in the app)
//   now         () => ms clock for budget accounting (default Date.now)
export function beatScheduler(beat, {
  period = 30_000, minGap = 0, maxCommits = Infinity,
  setTimer = globalThis.setInterval, clearTimer = globalThis.clearInterval,
  onTeardown = null, now = () => Date.now(),
} = {}) {
  let handle = null, unregister = null, stopped = false;
  let commits = 0, lastAt = -Infinity;

  async function beatOnce(reason = "tempo") {
    if (stopped) return { committed: false, reason: "stopped" };
    if (commits >= maxCommits) return { committed: false, reason: "budget:max-commits" };
    if (reason !== "teardown" && (now() - lastAt) < minGap) return { committed: false, reason: "budget:min-gap" };
    const r = reason === "teardown" ? await beat.teardownFlush() : await beat.tick();
    if (r && r.committed) { commits++; lastAt = now(); }   // only real commits spend budget
    return r;
  }

  handle = setTimer(() => { beatOnce("tempo"); }, period);
  if (onTeardown) unregister = onTeardown(() => beatOnce("teardown"));

  return {
    beatOnce,
    stop() { if (stopped) return; stopped = true; if (handle != null) clearTimer(handle); if (unregister) unregister(); },
    stats: () => ({ commits, lastAt }),
  };
}

// Browser-only: flush on the session going away. Uses pagehide + visibilitychange→hidden (the reliable
// pair; beforeunload is unreliable on mobile). Returns an unregister fn. Pass as `onTeardown`.
export function browserTeardown(handler) {
  const onHide = () => { if (document.visibilityState === "hidden") handler(); };
  const onPageHide = () => handler();
  addEventListener("visibilitychange", onHide);
  addEventListener("pagehide", onPageHide);
  return () => { removeEventListener("visibilitychange", onHide); removeEventListener("pagehide", onPageHide); };
}
