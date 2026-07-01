// Tests for the probe-line Elevated session (Edge 3 phase 3): the gate + streaming + correlation +
// cancel-is-atomic-to-the-commit. Pure & deterministic. Run: node composer/probe-line.test.mjs
import { elevatedSession, request, cancel, REQUEST, FRAME, CANCELLED, ERROR } from "./probe-line.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// A live grant record shaped like consent.mjs's (the gate only reads status + signed.expiry).
const grant = (o = {}) => ({
  grant: o.grant || "grant:beat", behavior: o.behavior || "git-enough:staging-beat",
  scope: o.scope || { piles: ["history"] }, status: o.status || "live", signed: { expiry: o.expiry || null },
});

// The ops under test. `committed` is our observable "persisted artifact" store — a commit only ever
// happens AFTER passing api.tick() (the yield→check-cancel point), so a cancel can never leave a
// half-write.
function ops(committed) {
  return {
    label: async (input, api) => { for (const t of String(input).split(" ")) { await api.tick(); api.emit({ token: t }); } },
    commit: async (input, api) => { await api.tick(); committed.push(input); api.emit({ committed: input }); },
    "git-enough:staging-beat": async (input, api) => {
      for (const item of input.items) { await api.tick(); committed.push(item); api.emit({ committed: item }); }
    },
  };
}

const immediate = () => Promise.resolve();  // non-blocking tick for the run-to-completion tests

// A manual pump so a test can step the handler tick-by-tick and inject a cancel at a precise boundary.
function pump() {
  const waiters = [];
  const yield_ = () => new Promise((res) => waiters.push(res));
  const step = async () => { const w = waiters.shift(); if (w) w(); await new Promise((r) => setTimeout(r, 0)); };
  return { yield_, step, waiting: () => waiters.length };
}

// 1. Rung 0 streams frames + a final terminator, no consent needed.
{
  const frames = []; const committed = [];
  const s = elevatedSession({ ops: ops(committed), emit: (f) => frames.push(f), yield_: immediate,
                              context: () => ({ recordingOn: true, grants: [] }) });
  await s.handle(request({ id: "A", op: "label", input: "one two three" }));
  const body = frames.filter((f) => f.type === FRAME && !f.final);
  ok(body.length === 3 && body.every((f) => f.id === "A"), "label streamed 3 frames, all tagged id A");
  ok(body.map((f) => f.seq).join() === "0,1,2", "frames carry ascending seq");
  ok(frames.some((f) => f.type === FRAME && f.final), "a final terminator is emitted");
}

// 2. Rung 1 needs a confirm; unconfirmed is refused (and does NOT persist).
{
  const frames = []; const committed = [];
  const s = elevatedSession({ ops: ops(committed), emit: (f) => frames.push(f), yield_: immediate,
                              context: () => ({ recordingOn: true, grants: [] }) });
  await s.handle(request({ id: "A", op: "commit", input: "x" }));
  const e = frames.find((f) => f.type === ERROR);
  ok(e && e.needsConfirm && e.id === "A", "unconfirmed commit → error with needsConfirm");
  ok(committed.length === 0, "…and nothing was committed");

  const frames2 = []; const committed2 = [];
  const s2 = elevatedSession({ ops: ops(committed2), emit: (f) => frames2.push(f), yield_: immediate,
                               context: () => ({ recordingOn: true, grants: [] }) });
  await s2.handle(request({ id: "B", op: "commit", input: "x", confirmed: true }));
  ok(committed2[0] === "x" && frames2.some((f) => f.final), "confirmed commit runs and persists");
}

// 3. A live grant covers a Rung 1 op — no per-op confirm — and the final frame reports the grant.
{
  const frames = []; const committed = [];
  const s = elevatedSession({ ops: ops(committed), emit: (f) => frames.push(f), yield_: immediate,
                              context: () => ({ recordingOn: true, grants: [grant()] }) });
  await s.handle(request({ id: "A", op: "commit", input: "y", behavior: "git-enough:staging-beat", scope: { piles: ["history"] } }));
  ok(committed[0] === "y", "commit under a covering grant runs without a confirm");
  ok(frames.find((f) => f.final).grantId === "grant:beat", "the final frame names the grant that authorized it");
}

// 4. Rung 2 without a grant is refused; incognito refuses it even with one (persistence off).
{
  const f1 = []; const c1 = [];
  const s1 = elevatedSession({ ops: ops(c1), emit: (f) => f1.push(f), yield_: immediate,
                               context: () => ({ recordingOn: true, grants: [] }) });
  await s1.handle(request({ id: "A", op: "git-enough:staging-beat", input: { items: ["a"] }, behavior: "git-enough:staging-beat", scope: { piles: ["history"] } }));
  ok(f1.find((f) => f.type === ERROR) && /no standing grant/.test(f1.find((f) => f.type === ERROR).reason), "Rung 2 without a grant is refused");
  ok(c1.length === 0, "…nothing committed");

  const f2 = []; const c2 = [];
  const s2 = elevatedSession({ ops: ops(c2), emit: (f) => f2.push(f), yield_: immediate,
                               context: () => ({ recordingOn: false, grants: [grant()] }) });
  await s2.handle(request({ id: "A", op: "git-enough:staging-beat", input: { items: ["a"] }, behavior: "git-enough:staging-beat", scope: { piles: ["history"] } }));
  ok(/incognito/.test(f2.find((f) => f.type === ERROR).reason), "incognito refuses the persisting behavior even with a grant");
}

// 5. THE KEYSTONE: cancel is atomic to the commit. A granted staging beat, cancelled mid-stream, stops
//    at a commit boundary — the in-flight unit is abandoned, never half-written.
{
  const frames = []; const committed = [];
  const p = pump();
  const s = elevatedSession({ ops: ops(committed), emit: (f) => frames.push(f), yield_: p.yield_,
                              context: () => ({ recordingOn: true, grants: [grant()] }) });
  const done = s.handle(request({ id: "A", op: "git-enough:staging-beat",
    input: { items: ["a", "b", "c", "d"] }, behavior: "git-enough:staging-beat", scope: { piles: ["history"] } }));

  await p.step();  // tick → commit "a"
  await p.step();  // tick → commit "b"
  ok(committed.join() === "a,b", "two commits landed before the cancel");

  s.handle(cancel({ id: "A" }));  // revoke mid-stream (the cooperative, in-band path)
  await p.step();  // the next tick observes the cancel and THROWS before committing "c"
  await done;

  ok(committed.join() === "a,b", "no further commit after cancel — 'c' and 'd' were abandoned, not half-written");
  ok(frames.some((f) => f.type === CANCELLED && f.id === "A"), "a CANCELLED frame is emitted");
  ok(!frames.some((f) => f.final), "no final frame — the stream did not complete normally");
}

// 6. Correlation + housekeeping: distinct ids don't cross; duplicate id and unknown op are errors.
{
  const frames = []; const committed = [];
  const s = elevatedSession({ ops: ops(committed), emit: (f) => frames.push(f), yield_: immediate,
                              context: () => ({ recordingOn: true, grants: [] }) });
  await s.handle(request({ id: "A", op: "label", input: "aa bb" }));
  await s.handle(request({ id: "B", op: "label", input: "cc" }));
  ok(frames.filter((f) => f.type === FRAME && !f.final && f.id === "A").length === 2, "stream A has its own frames");
  ok(frames.filter((f) => f.type === FRAME && !f.final && f.id === "B").length === 1, "stream B has its own frames");

  const un = []; const s2 = elevatedSession({ ops: ops([]), emit: (f) => un.push(f), yield_: immediate,
                                              context: () => ({ recordingOn: true, grants: [] }) });
  await s2.handle(request({ id: "A", op: "nope.op", confirmed: true }));
  ok(un.find((f) => f.type === ERROR && /no such op/.test(f.reason)), "unknown op → error");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall probe-line session tests passed");
