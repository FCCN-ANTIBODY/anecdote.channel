// scripts/test.mjs — run every *.test.mjs suite in the repo, dependency-free. One command locally and in
// CI: `node scripts/test.mjs`. Each suite is a standalone Node script that exits non-zero on failure
// (the house test style); this runs them as child processes and aggregates.
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dirs = ["reducer", "composer", "git-enough", "viewer", "jekyll-enough", "probe-test", "vault", "scripts"];

// A LISTED DIRECTORY THAT CONTRIBUTES NO SUITES IS A FAILURE, NOT A SKIP.
//
// This used to `continue` past a directory it could not read, which is the right call for a folder
// that is optional and the wrong one for a folder that is a SUBMODULE. `actions/checkout` does not
// fetch submodules unless asked, so the suites inside one silently vanished and the run still
// reported `N/N passed` — a green check for a build that tested less than it did yesterday, which
// is the one failure nobody investigates.
//
// THE TEST IS "NO SUITES", NOT "NO DIRECTORY", AND THAT DISTINCTION IS THE WHOLE POINT.
// An unhydrated submodule is an EMPTY DIRECTORY THAT EXISTS: git creates the mount point and puts
// nothing in it. `readdirSync` on it does not throw, it returns []. Checking for a missing
// directory therefore catches a rename and misses the actual case — measured, on the commit that
// made jekyll-enough a submodule: `git submodule deinit` then this runner, and it reported
// 113/113 passed having run none of that module's five suites.
//
// Every directory in the list above has suites today (64, 20, 10, 7, 5, 5, 5, 2). A member that
// legitimately has none does not belong in a list whose only purpose is to find them.
const barren = [];
const files = [];
for (const d of dirs) {
  let entries = [];
  try { entries = readdirSync(join(root, d)); } catch { entries = []; }
  const suites = entries.filter((f) => f.endsWith(".test.mjs"));
  if (suites.length === 0) { barren.push(d); continue; }
  for (const f of suites) files.push(`${d}/${f}`);
}
files.sort();

if (barren.length) {
  console.error(`\ntest: ${barren.length} listed director${barren.length === 1 ? "y contributes" : "ies contribute"} no suites: ${barren.join(", ")}`);
  console.error("      An unhydrated submodule looks exactly like this — the directory is there and empty:");
  console.error("        git submodule update --init --recursive");
  console.error("      In CI that is `submodules: recursive` on actions/checkout.");
  console.error("      If a directory was renamed or genuinely has no tests, update the list in this file.");
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
