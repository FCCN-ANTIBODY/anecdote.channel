// scripts/workflow-gaps.mjs — what would actions-enough refuse to run, and why.
//
//   node scripts/workflow-gaps.mjs [repo-path ...]        (default: this repo)
//
// Runs `git-enough`'s OWN classifier over every `.github/workflows/*.yml` it is pointed at, so the
// answer is the interpreter's rather than a reader's opinion. `docs/actions-enough.md` asks for
// exactly this under *Shell steps with no capability yet* — "enumerate the handful… and decide
// per-case" — and it kept not happening because by hand it is tedious and stale the next day.
//
// A STEP IS NOT ONE THING, WHICH IS THE FINDING THIS EXISTS TO SHOW.
//
// The interpreter classifies a STEP, and `run: |` holds a BLOCK. A block that runs `git submodule
// update`, tests a path with `[ -f ]`, and appends to `$GITHUB_OUTPUT` is three different problems
// wearing one `run-shell`. Reporting the first thing that matched would make the gap look like a
// list of small decisions when it is mostly a handful of steps that each need several answers — so
// every bucket a step touches is reported, and the steps touching more than one are counted
// separately. Those are the expensive ones.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseWorkflowSteps, planSteps } from "../git-enough/workflow.mjs";

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push(resolve(fileURLToPath(import.meta.url), "..", ".."));

const BUCKETS = [
  ["hosted-only", /(^|[\s;&|(])(sudo|apt-get|apt|brew|pip3?|gem|npm|yarn|pnpm)\b/m,
   "a package manager or a root install. There is no device answer and there should not be one — " +
   "these are the argument for a hybrid, not for a bigger shim."],
  ["routes", /(^|[\s;&|(])(git|jekyll|bundle)\s/m,
   "already has an -enough sibling: git plumbing to git-enough, a site build to jekyll-enough."],
  ["program", /(^|[\s;&|(])(bash |sh |\.\/|bin\/|scripts\/|test\/)/m,
   "invokes a program in the repository. Resolvable when that program is an `exec node X.mjs` " +
   "shim — composite.mjs already does this — and a named gap when it is bash or ruby."],
  ["shell", /(^|[\s;&|(])(if|then|else|fi|for|while|do|done|case|esac|set|test|echo|printf|read|exit)\b|\[\[?\s|^\s*[A-Za-z_][A-Za-z0-9_]*=/m,
   "control flow, `test`, `echo`, assignment, redirection. THIS is the sh-enough shape, and it is " +
   "the only bucket a shell interpreter would actually close."],
];

// Not a bucket: a cross-cutting property. `$GITHUB_OUTPUT` and friends are files the HOSTED RUNNER
// creates and reads back between steps. A shell interpreter would run these lines happily and the
// value would go nowhere — worse than refusing. The runner owns this contract however much shell
// it learns, so it is counted apart from the shape question.
const RUNNER_CONTRACT = /\$\{?GITHUB_(OUTPUT|ENV|STATE|STEP_SUMMARY|PATH)\b/;

const kinds = new Map();
const shell = [];
let files = 0, steps = 0;

for (const root of roots) {
  const dir = join(root, ".github", "workflows");
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    files++;
    let parsed;
    try { parsed = parseWorkflowSteps(readFileSync(join(dir, f), "utf8")); }
    catch { console.error(`  ! could not parse ${basename(root)}/${f}`); continue; }
    for (const p of planSteps(parsed.steps)) {
      steps++;
      kinds.set(p.kind, (kinds.get(p.kind) || 0) + 1);
      if (p.kind !== "run-shell") continue;
      const cmd = p.cmd || "";
      shell.push({
        where: `${basename(root)}/${f}`,
        name: p.step.name || "",
        lines: cmd.split("\n").filter((s) => s.trim() && !s.trim().startsWith("#")).length,
        touches: BUCKETS.filter(([, re]) => re.test(cmd)).map(([n]) => n),
        contract: RUNNER_CONTRACT.test(cmd),
      });
    }
  }
}

if (files === 0) { console.error("no workflow files found under any given path"); process.exit(2); }

const label = (s) => `${s.where.padEnd(36)} ${(s.name || "(unnamed)").slice(0, 40).padEnd(41)} ${s.lines}L`;
const pct = (n) => `${String(n).padStart(4)}  ${String(Math.round((n / steps) * 100)).padStart(2)}%`;

console.log(`${files} workflow file(s), ${steps} step(s), across ${roots.length} repo(s)\n`);
console.log("what the interpreter makes of them:");
for (const [k, n] of [...kinds].sort((a, b) => b[1] - a[1])) console.log(`  ${pct(n)}  ${k}`);

console.log(`\n${shell.length} run-shell step(s). Each is counted in EVERY bucket it touches:\n`);
for (const [name, , why] of BUCKETS) {
  const items = shell.filter((s) => s.touches.includes(name));
  console.log(`  ${name} — ${items.length} step(s)`);
  console.log(`    ${why.replace(/(.{84}) /g, "$1\n    ")}`);
  for (const s of items) console.log(`      ${label(s)}  [${s.touches.join(" ")}]`);
  console.log("");
}

const mixed = shell.filter((s) => s.touches.length > 1);
const pure = shell.filter((s) => s.touches.length === 1);
const none = shell.filter((s) => s.touches.length === 0);
console.log(`${pure.length} step(s) need one answer, ${mixed.length} need several, ${none.length} matched nothing.`);
if (none.length) for (const s of none) console.log(`  unmatched: ${label(s)}`);
console.log("A step needing several is not several small decisions — it is one step that cannot run");
console.log("until the last of them is answered, which is what makes the mixed ones the expensive ones.");

const contract = shell.filter((s) => s.contract);
console.log(`\n${contract.length} step(s) write a hosted-runner file ($GITHUB_OUTPUT and friends):`);
for (const s of contract) console.log(`  ${label(s)}`);
