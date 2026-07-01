// scripts/test.mjs — run every *.test.mjs suite in the repo, dependency-free. One command locally and in
// CI: `node scripts/test.mjs`. Each suite is a standalone Node script that exits non-zero on failure
// (the house test style); this runs them as child processes and aggregates.
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dirs = ["reducer", "composer", "git-enough"];

const files = [];
for (const d of dirs) {
  let entries = [];
  try { entries = readdirSync(join(root, d)); } catch { continue; }
  for (const f of entries) if (f.endsWith(".test.mjs")) files.push(`${d}/${f}`);
}
files.sort();

const failed = [];
for (const f of files) {
  process.stdout.write(`\n▶ ${f}\n`);
  try { execFileSync("node", [join(root, f)], { stdio: "inherit" }); }
  catch { failed.push(f); }
}

console.log(`\n${files.length - failed.length}/${files.length} suites passed`);
if (failed.length) { console.error("FAILED: " + failed.join(", ")); process.exit(1); }
