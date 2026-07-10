// git-enough/workflow.mjs — the workflow INTERPRETER (docs/actions-enough.md, phase 2). Reads a GitHub
// workflow YAML, classifies each step against the step map (the plan's table), and drives the steps to a
// git-enough push. It runs on the DEVICE against the held tree; the capabilities that actually do work
// (run a node script, push) are INJECTED, so this file stays a pure interpreter and the heavy bits
// (bundle-action.mjs, send-pack.mjs) plug in. Composite actions in engine submodules, jekyll, and raw
// shell are classified and NAMED as gaps rather than silently skipped — filled as each is needed.

// A single-line YAML scalar: drop an inline `# comment` (space-preceded, so a literal '#' in a token
// survives), then strip surrounding quotes. Block scalars (run: |) are captured raw and never pass here.
const unquote = (s) => { const t = String(s == null ? "" : s).replace(/\s+#.*$/, "").trim(); return t.replace(/^["'](.*)["']$/, "$1"); };

// A small, sufficient parser for the workflow shape our repos use: `steps:` blocks whose entries are
// `- uses:`/`- name:`/`- id:` items with `run:` (single line or `|` block) and nested `with:` maps.
// Comments and blank lines are skipped. Returns { name, steps: [{ uses?, run?, name?, id?, with? }] }.
export function parseWorkflowSteps(yaml) {
  const lines = String(yaml || "").split("\n");
  const nameM = yaml.match(/^name:\s*(.*)$/m);
  const name = nameM ? unquote(nameM[1]) : "";
  const steps = [];

  for (let i = 0; i < lines.length; i++) {
    const sm = lines[i].match(/^(\s*)steps:\s*$/);
    if (!sm) continue;
    const base = sm[1].length;
    let cur = null, block = null, blockIndent = 0, withIndent = -1;
    for (let j = i + 1; j < lines.length; j++) {
      const raw = lines[j];
      const indent = raw.length - raw.trimStart().length;
      if (block && (/^\s*$/.test(raw) || indent > blockIndent)) { cur[block] += (cur[block] ? "\n" : "") + raw.slice(blockIndent); continue; }
      block = null;
      if (/^\s*$/.test(raw) || /^\s*#/.test(raw)) continue;      // blank / comment
      if (indent <= base) break;                                  // dedent -> this steps: block is done
      const content = raw.trim();
      const dash = content.startsWith("- ");
      if (dash) { cur = {}; steps.push(cur); withIndent = -1; }
      if (!cur) continue;
      const body = dash ? content.slice(2).trim() : content;
      const kv = body.match(/^([\w-]+):\s?(.*)$/);
      if (!kv) continue;
      const key = kv[1], val = kv[2];
      if (withIndent >= 0 && indent > withIndent && key !== "with") { cur.with[key] = unquote(val); continue; }
      if (key === "with") { cur.with = {}; withIndent = indent; }
      else if (val === "|" || val === ">") { block = key; blockIndent = indent + 2; cur[key] = ""; }
      else { cur[key] = unquote(val); withIndent = -1; }
    }
  }
  return { name, steps };
}

// The step map (the plan's table), as pure classification — no execution. `kind` drives runWorkflow.
export function classifyStep(step) {
  const uses = step.uses || "", run = step.run || "";
  if (/actions\/checkout/.test(uses)) return { kind: "checkout", step };
  if (/setup-node|setup-ruby|actions\/setup-/.test(uses)) return { kind: "setup", step };
  if (/upload-pages-artifact|deploy-pages/.test(uses)) return { kind: "publish", step, path: step.with && step.with.path };
  if (uses.startsWith("./")) return { kind: "action", step, action: uses };     // composite/local action (submodule) — phase 2c
  if (uses) return { kind: "uses-other", step, uses };
  const node = run.match(/(?:^|[\s;&|])node\s+(\S+)/);
  if (node) return { kind: "run-node", step, script: node[1].replace(/["']/g, "") };
  if (/(?:^|[\s;&|/])(?:bin\/)?jekyll\b|jekyll build/.test(run)) return { kind: "jekyll", step };
  if (run) return { kind: "run-shell", step, cmd: run };
  return { kind: "unknown", step };
}
export function planSteps(steps) { return steps.map(classifyStep); }

// Drive the classified steps against the held tree, ending in a git-enough push. Capabilities are injected:
//   runNode(script, ctx) — run one `node <script>` against the ambient virtual fs (bundle-action.mjs).
//   push(ctx)            — a git-enough push of the resulting tree (send-pack.mjs); dry-run first.
// checkout/setup are no-ops (the device holds the tree and IS the runtime). action/jekyll/shell/unknown
// are recorded as NAMED GAPS, not silently run. Returns { log, pushed }.
export async function runWorkflow(planned, { runNode, push, ctx = {} } = {}) {
  const log = [];
  let wantsPublish = false;
  for (const p of planned) {
    if (p.kind === "checkout") log.push({ kind: p.kind, outcome: "held — the device already holds the tree" });
    else if (p.kind === "setup") log.push({ kind: p.kind, outcome: "runtime — we are the runtime" });
    else if (p.kind === "run-node") {
      if (!runNode) { log.push({ kind: p.kind, script: p.script, outcome: "gap — no runNode capability supplied" }); continue; }
      await runNode(p.script, ctx);
      log.push({ kind: p.kind, script: p.script, outcome: "ran on the virtual tree" });
    } else if (p.kind === "publish") { wantsPublish = true; log.push({ kind: p.kind, outcome: "queued for a git-enough push" }); }
    else log.push({ kind: p.kind, outcome: `deferred — a named gap (${p.kind}${p.action ? ": " + p.action : ""})` });
  }
  let pushed = null;
  if (wantsPublish && push) pushed = await push(ctx);
  return { log, pushed };
}
