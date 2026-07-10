// Unit: the workflow interpreter (workflow.mjs) — actions-enough phase 2b. Parses a workflow YAML,
// classifies each step against the step map, and drives the steps to a git-enough push with injected
// capabilities. Proves the parser + classifier on both inline YAML (every step kind) and the REAL atlas
// workflows (when the sibling checkout is present), and the executor end-to-end to a real dry-run pack.
// Run: node git-enough/workflow.test.mjs
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parseWorkflowSteps, planSteps, classifyStep, runWorkflow, crownList } from "./workflow.mjs";
import { virtualFs } from "./node-compat.mjs";
import { buildRepo } from "./publish-cli.mjs";
import { packRepo } from "./pack.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const kindsOf = (steps) => planSteps(steps).map((s) => s.kind);

// 1. the parser + step map on inline YAML — every kind, plus a with: block and an inline comment.
{
  const yaml = `name: "Demo · everything"
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: build the manifest
        run: node bin/atlas-index.mjs build
      - name: smoke
        run: test/run.sh   # node + jq preinstalled — this comment must not read as a node step
      - run: bin/jekyll build --trace
      - uses: ./.atlas-engine/.github/actions/match
        with:
          scope: colorado
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
`;
  const wf = parseWorkflowSteps(yaml);
  ok(wf.name === "Demo · everything", "workflow name parsed");
  ok(wf.steps.length === 7, "seven steps parsed: " + wf.steps.length);
  const plan = planSteps(wf.steps);
  ok(JSON.stringify(kindsOf(wf.steps)) === JSON.stringify(["checkout", "setup", "run-node", "run-shell", "jekyll", "action", "publish"]),
    "the step map classifies every kind: " + kindsOf(wf.steps).join(","));
  ok(plan[2].script === "bin/atlas-index.mjs", "the node script path is extracted: " + plan[2].script);
  ok(plan[3].kind === "run-shell", "an inline comment mentioning node does NOT become a node step");
  ok(plan[5].kind === "action" && plan[5].action === "./.atlas-engine/.github/actions/match", "a submodule composite action is named (deferred to phase 2c)");
  ok(plan[6].path === "_site", "the publish step carries its with.path");
}

// 2. the parser on the REAL atlas workflows, when present (skip-guarded, like minilm.test.mjs).
{
  const wfDir = fileURLToPath(new URL("../../atlas.anecdote.channel/.github/workflows/", import.meta.url));
  if (existsSync(join(wfDir, "test.yml"))) {
    const t = planSteps(parseWorkflowSteps(readFileSync(join(wfDir, "test.yml"), "utf8")).steps).map((s) => s.kind);
    ok(t[0] === "checkout" && t.includes("run-shell"), "real Test·core: checkout + a shell run: " + t.join(","));
    const d = planSteps(parseWorkflowSteps(readFileSync(join(wfDir, "deploy.yml"), "utf8")).steps).map((s) => s.kind);
    ok(d.includes("jekyll") && d.filter((k) => k === "publish").length >= 1, "real Publish·site: jekyll + a publish: " + d.join(","));
    const m = planSteps(parseWorkflowSteps(readFileSync(join(wfDir, "match.yml"), "utf8")).steps).map((s) => s.kind);
    ok(m.includes("action"), "real Federate·match: a composite action: " + m.join(","));
  } else {
    console.log("  (skip: sibling atlas.anecdote.channel workflows not present)");
  }
}

// 3. the executor drives the map to a git-enough push — checkout held, node ran, publish -> a real pack.
{
  const yaml = `name: "Demo · publish"
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - run: node bin/build.mjs
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
`;
  const plan = planSteps(parseWorkflowSteps(yaml).steps);
  const ctx = { fs: virtualFs({ "_data/src.json": '["a","b"]' }) };
  const author = { name: "Origin", email: "o@x", epoch: 1700000000, tz: "+0000" };

  const runNode = async (script, ctx) => {
    ok(script === "bin/build.mjs", "runNode is handed the parsed script path");
    const src = JSON.parse(ctx.fs.readFileSync("_data/src.json", "utf8"));
    ctx.fs.writeFileSync("_site/index.json", JSON.stringify({ built: src.length }) + "\n");   // the "action" writes an artifact
  };
  const push = async (ctx) => {
    const files = Object.entries(ctx.fs.snapshot()).map(([path, bytes]) => ({ path, content: bytes }));
    const { r } = await buildRepo({ files, root: true, author, message: "device push" });   // dry-run: build + pack, no network
    return { pack: await packRepo(r), files: files.length };
  };

  const { log, pushed } = await runWorkflow(plan, { runNode, push, ctx });
  ok(log[0].kind === "checkout" && /held/.test(log[0].outcome), "checkout is held, not run");
  ok(log[1].kind === "run-node" && /ran on the virtual tree/.test(log[1].outcome), "the node step ran on the virtual tree");
  ok(log[2].kind === "publish" && /queued/.test(log[2].outcome), "the publish step queued a push");
  ok(ctx.fs.existsSync("_site/index.json"), "the artifact the node step wrote is in the tree");
  ok(pushed && pushed.pack && pushed.pack.length > 0 && pushed.files >= 2, "the workflow ended in a REAL git-enough pack (dry-run): " + (pushed && pushed.pack.length) + " bytes, " + (pushed && pushed.files) + " files");
}

// 4. a gap is named, never silently skipped: no runNode -> the node step is recorded as a gap.
{
  const plan = [classifyStep({ run: "node bin/x.mjs" }), classifyStep({ uses: "./.e/.github/actions/y" })];
  const { log } = await runWorkflow(plan, {});
  ok(/gap/.test(log[0].outcome) && /named gap/.test(log[1].outcome), "missing capabilities are named gaps, not silent no-ops");
}

// 5. crownList: the crown's index — grouped by the name prefix, sorted as GitHub sorts (by name).
{
  const groups = crownList([
    { id: "a", yaml: 'name: "Publish · site"\njobs:\n  b:\n    steps:\n      - uses: actions/checkout@v4\n' },
    { id: "b", yaml: 'name: "Antidote · heartbeat"\njobs:\n  h:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: ./.github/actions/heartbeat\n' },
    { id: "c", yaml: 'name: "Antidote · intake"\njobs:\n  i:\n    steps:\n      - uses: actions/checkout@v4\n' },
  ]);
  ok(JSON.stringify(groups.map((g) => g.group)) === JSON.stringify(["Antidote", "Publish"]), "grouped by the name prefix, groups sorted: " + groups.map((g) => g.group));
  ok(groups[0].list.map((w) => w.name).join(",") === "Antidote · heartbeat,Antidote · intake", "within a group, sorted by name (GitHub's sort)");
  ok(groups[0].list[0].steps.some((s) => s.kind === "action"), "each workflow carries its classified step map");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall workflow interpreter tests passed");
