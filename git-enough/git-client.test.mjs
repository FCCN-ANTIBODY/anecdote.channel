// Unit: git-enough/git-client.mjs — the delivered git client wraps a probe invoke into a small git API. It
// sends the right op, carries confirmed:true only for the persisting (Rung-1) ops, and returns the op's data
// frame. It holds no repo and no keys. Run: node git-enough/git-client.test.mjs
import { makeGitClient } from "./git-client.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// A fake probe invoke: records every call and returns a canned data frame per op.
const FRAMES = {
  "git.init": { init: true, tip: "a".repeat(40), bytes: "BYTES", refs: { "refs/heads/main": "a".repeat(40) }, head: "refs/heads/main" },
  "git.export": { bytes: "EXPORTED", refs: {}, head: "refs/heads/main" },
  "git.load": { loaded: 3, refs: ["refs/heads/main"], head: "refs/heads/main" },
  "git.commit": { commit: "c".repeat(40), ref: "refs/heads/main" },
  "git.log": { log: [{ oid: "c".repeat(40), message: "one" }] },
  "git.files": { files: [{ path: "a", size: 2 }] },
  "git.fast-forward": { ref: "refs/heads/feature", advanced: true },
};

async function run() {
  const calls = [];
  const invoke = (op, input, opts = {}) => { calls.push({ op, input, opts }); return Promise.resolve({ frames: [FRAMES[op]] }); };
  const last = () => calls[calls.length - 1];
  const g = makeGitClient(invoke);

  ok((await g.init([{ path: "pile.yml", content: "id\n" }], { message: "init\n" })).tip.length === 40, "init returns the tip frame");
  ok(last().op === "git.init" && last().input.files.length === 1 && last().opts.confirmed === true, "init sends git.init with the files, confirmed");

  ok((await g.export()).bytes === "EXPORTED", "export returns the bytes frame");
  ok(last().op === "git.export" && !last().opts.confirmed, "export (Rung 0) carries no confirmation");

  await g.load("BYTES", { "refs/heads/main": "x" }, "refs/heads/main");
  ok(last().op === "git.load" && last().input.bytes === "BYTES" && last().opts.confirmed === true, "load sends the bytes + refs + head, confirmed");

  ok((await g.commit([{ path: "a", content: "1\n" }], "one\n")).commit.length === 40, "commit returns the commit frame");
  ok(last().op === "git.commit" && last().input.message === "one\n" && last().opts.confirmed === true, "commit is confirmed");

  ok((await g.log()).log[0].message === "one", "log returns the log frame");
  ok(last().op === "git.log" && !last().opts.confirmed, "log (Rung 0) carries no confirmation");

  ok((await g.fastForward("refs/heads/feature", "d".repeat(40))).advanced === true, "fastForward returns the advanced frame");
  ok(last().op === "git.fast-forward" && last().input.to.length === 40 && last().opts.confirmed === true, "fast-forward is confirmed");

  { let threw = false; try { makeGitClient(null); } catch { threw = true; } ok(threw, "a client needs a probe invoke"); }

  console.log(fails ? `\nFAILED (${fails})` : "\nok: git-client — the request half wraps the probe, confirms only what persists, holds nothing");
  process.exit(fails ? 1 : 0);
}
run();
