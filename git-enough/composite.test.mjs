// Unit: composite-action + bin-shim resolution (composite.mjs) driving the interpreter's recursion
// (actions-enough phase 2c). Proves the resolver on inline fixtures (always) and on the REAL atlas
// composite actions (skip-guarded): drop invokes bin/drop — a node shim, so it RUNS; match invokes
// bin/match — a bash+ruby+jq program, so it is a NAMED GAP. That gap boundary IS the reproducibility map.
// Run: node git-enough/composite.test.mjs
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { makeResolver } from "./composite.mjs";
import { parseWorkflowSteps, planSteps, runWorkflow } from "./workflow.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// 1. the resolver on inline fixtures — a node shim resolves; a bash bin does not.
{
  const files = {
    "bin/drop": '#!/usr/bin/env bash\nexec node "$(cd "$(dirname "$0")" && pwd)/drop.mjs" "$@"\n',
    "bin/match": '#!/usr/bin/env bash\nset -euo pipefail\nruby -ryaml -rjson -e "..."\n',    // a program, no exec node
    ".github/actions/demo/action.yml": 'name: demo\nruns:\n  using: composite\n  steps:\n    - shell: bash\n      run: "$GITHUB_ACTION_PATH/../../../bin/drop"\n',
  };
  const R = makeResolver((p) => { if (!(p in files)) throw new Error("ENOENT"); return files[p]; });
  ok((await R.resolveBin('"$GITHUB_ACTION_PATH/../../../bin/drop"')) === "bin/drop.mjs", "a bin that is `exec node X.mjs` resolves to X.mjs");
  ok((await R.resolveBin('"$GITHUB_ACTION_PATH/../../../bin/match"')) === null, "a bash/ruby bin does NOT resolve — a named gap");
  ok((await R.resolveBin("bash run.sh")) === null, "a run with no bin reference is a gap");
  const inner = await R.openAction("./.github/actions/demo");
  ok(inner && inner.length === 1 && inner[0].run.includes("bin/drop"), "a composite action opens to its inner steps");
}

// 2. recursion end to end on the inline composite: the action opens, its bin-shim step runs as node.
{
  const files = {
    "bin/drop": 'exec node "$(dirname "$0")/drop.mjs" "$@"\n',
    ".github/actions/drop/action.yml": 'name: drop\nruns:\n  using: composite\n  steps:\n    - name: set env\n      shell: bash\n      run: echo X=1 >> $GITHUB_ENV\n    - name: run the door\n      shell: bash\n      run: "$GITHUB_ACTION_PATH/../../../bin/drop"\n',
  };
  const R = makeResolver((p) => { if (!(p in files)) throw new Error("ENOENT"); return files[p]; });
  const ran = [];
  const wf = 'name: w\njobs:\n  j:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: ./.github/actions/drop\n';
  const { log } = await runWorkflow(planSteps(parseWorkflowSteps(wf).steps), {
    runNode: async (script) => ran.push(script),
    openAction: R.openAction, resolveBin: R.resolveBin,
  });
  ok(ran.includes("bin/drop.mjs"), "the composite's bin-shim step resolved to bin/drop.mjs and ran as node");
  ok(log.some((l) => /opened composite/.test(l.outcome)), "the composite was opened and recursed");
  ok(log.some((l) => /gap/.test(l.outcome) && /bash/.test(l.outcome)), "the `echo >> $GITHUB_ENV` step is a named gap, not silently run");
}

// 3. the REAL atlas composite actions (skip-guarded): drop RUNS (node shim), match is a GAP (bash program).
{
  const atlas = fileURLToPath(new URL("../../atlas.anecdote.channel/", import.meta.url));
  if (existsSync(join(atlas, ".github/actions/drop/action.yml"))) {
    const R = makeResolver((p) => readFileSync(join(atlas, p), "utf8"));

    const dropInner = await R.openAction("./.github/actions/drop");
    ok(dropInner && dropInner.length > 0, "real drop/action.yml opens to its steps");
    let dropNode = null;
    for (const s of dropInner) { const n = await R.resolveBin(s.run || ""); if (n) dropNode = n; }
    ok(dropNode === "bin/drop.mjs", "real drop action: bin/drop resolves to the node shim bin/drop.mjs");

    const matchInner = await R.openAction("./.github/actions/match");
    let matchNode = null;
    for (const s of matchInner) { const n = await R.resolveBin(s.run || ""); if (n) matchNode = n; }
    ok(matchNode === null, "real match action: bin/match is a bash+ruby+jq program — a NAMED GAP (the map: this bin needs a JS battery)");
  } else {
    console.log("  (skip: sibling atlas.anecdote.channel checkout not present)");
  }
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall composite-resolution tests passed");
