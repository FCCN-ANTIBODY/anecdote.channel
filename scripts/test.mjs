// scripts/test.mjs — run every *.test.mjs suite in the repo, dependency-free. One command locally and in
// CI: `node scripts/test.mjs`. Each suite is a standalone Node script that exits non-zero on failure
// (the house test style); this runs them as child processes and aggregates.
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dirs = ["reducer", "composer", "git-enough", "viewer", "jekyll-enough", "probe-test", "vault", "scripts"];

// A LISTED DIRECTORY THAT IS NOT THERE IS A FAILURE, NOT A SKIP.
//
// This used to `continue` past a missing directory, which is the right call for a folder that is
// optional and the wrong one for a folder that is a SUBMODULE. `actions/checkout` does not fetch
// submodules unless asked; an unfilled mount is an empty directory; an empty directory used to
// mean the suites inside it silently vanished and the run still reported `N/N passed`. A green
// check for a build that tested less than it did yesterday is the one failure nobody investigates.
//
// The list above is hand-maintained, so "missing" genuinely means something went wrong — either
// the mount is unhydrated or the directory was renamed and this line was not.
const missing = [];
const files = [];
for (const d of dirs) {
  let entries = [];
  try { entries = readdirSync(join(root, d)); } catch { missing.push(d); continue; }
  for (const f of entries) if (f.endsWith(".test.mjs")) files.push(`${d}/${f}`);
}
files.sort();

if (missing.length) {
  console.error(`\ntest: ${missing.length} listed director${missing.length === 1 ? "y is" : "ies are"} missing: ${missing.join(", ")}`);
  console.error("      If it is a submodule, it is not hydrated:  git submodule update --init --recursive");
  console.error("      In CI, that is `submodules: recursive` on actions/checkout.");
  console.error("      If it was renamed or removed, update the list in this file.");
  process.exit(1);
}

const failed = [];
for (const f of files) {
  process.stdout.write(`\n▶ ${f}\n`);
  try { execFileSync("node", [join(root, f)], { stdio: "inherit" }); }
  catch { failed.push(f); }
}

console.log(`\n${files.length - failed.length}/${files.length} suites passed`);
if (failed.length) { console.error("FAILED: " + failed.join(", ")); process.exit(1); }
