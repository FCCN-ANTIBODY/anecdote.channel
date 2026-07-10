// git-enough/composite.mjs — resolve composite actions + bin shims for the interpreter (actions-enough
// phase 2c). A composite action (`runs: { using: composite, steps: [...] }`) is opened to its inner steps,
// which run through the SAME step map (workflow.mjs). A `run:` that invokes a repo `bin/X` is resolved:
// if the bin is an `exec node X.mjs` SHIM it becomes a node step; if it is a bash/ruby program (bin/match's
// matchmaker, a run.sh) it stays a NAMED GAP — the honest boundary of what runs on the device today.
//
// Backed by an injected readFile(path) -> string (the held tree in production; a real checkout in tests),
// so this file does no I/O of its own and stays testable.

import { parseWorkflowSteps } from "./workflow.mjs";

export function makeResolver(readFile) {
  const read = (p) => { try { const v = readFile(p); return v == null ? null : String(v); } catch { return null; } };

  return {
    // uses: ./path/to/action  ->  its composite steps (or null: an unreadable / non-composite action).
    async openAction(actionPath) {
      const dir = String(actionPath || "").replace(/^\.\//, "").replace(/\/+$/, "");
      const yaml = read(dir + "/action.yml") || read(dir + "/action.yaml");
      if (!yaml) return null;
      const { steps } = parseWorkflowSteps(yaml);
      return steps.length ? steps : null;
    },

    // a run string -> the repo-relative X.mjs if it invokes a `bin/X` that is an `exec node X.mjs` shim;
    // null for a bash/ruby program or a run with no bin reference (the caller then names the gap).
    async resolveBin(runStr) {
      const m = String(runStr || "").match(/(?:^|[\s"'/])bin\/([\w.-]+)/);   // bin/X, incl. inside $GITHUB_ACTION_PATH/../../../bin/X
      if (!m) return null;
      const shim = read("bin/" + m[1]);
      if (!shim) return null;
      const nm = shim.match(/exec\s+node\s+[^\n]*?\/([\w.-]+\.mjs)/);        // the shim's node target
      return nm ? "bin/" + nm[1] : null;                                     // a bash/ruby bin -> null -> a named gap
    },
  };
}
