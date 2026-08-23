// scripts/render.mjs — render the Liquid in index.html against _data, using this repo's own
// jekyll-enough. Run at deploy, after the directory is gathered.
//
// WHY THIS EXISTS. The listing used to be drawn by a fetch in the browser: the page shipped
// "Please Stand By.", asked for sites.json, and built the DOM. That made the directory invisible
// to anything that does not execute JavaScript — a crawler, a reader with scripting off, a text
// browser — and it meant the first paint was always the holding page.
//
// It is also the wrong shape for this project. The sites ARE data. A Jekyll site would loop over
// them in a template; we were shipping the sources and crunching them live in every visitor's
// browser instead. jekyll-enough is the build we already have — same algorithm, no Ruby, an
// in-memory tree — so this is the tool finding its second use rather than a new dependency.
//
// Surgical on purpose: it renders index.html IN PLACE rather than emitting a _site tree, because
// anecdote.channel is served as-is (pages.yml: .nojekyll, path "."), and turning the whole repo
// into a Jekyll build would drag the composer, the demos, and the vendored runtime through a
// templater none of them asked for.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, relative } from "node:path";
import { buildSite } from "../jekyll-enough/build.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = ["index.html"];

// The tree jekyll-enough is handed: the pages to render plus _data. Nothing else — the build has
// no opinion about files it is not given, and this way it cannot touch anything else.
function readData(dir, tree, base) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) readData(full, tree, base);
    else tree[relative(base, full).split("\\").join("/")] = readFileSync(full, "utf8");
  }
}

const tree = {};
try { readData(join(ROOT, "_data"), tree, ROOT); } catch { /* no data is a valid state */ }
for (const p of PAGES) tree[p] = readFileSync(join(ROOT, p), "utf8");

// buildSite returns the built tree directly, keyed under _site/.
const out = buildSite(tree);

let wrote = 0;
for (const p of PAGES) {
  const built = out[`_site/${p}`] ?? out[`_site/${p.replace(/\.html$/, "")}/index.html`];
  if (built == null) { console.error(`render: ${p} produced nothing`); process.exit(1); }
  // A page that still carries Liquid means a tag silently did not render, and shipping it would
  // put template source in front of a reader. Fail instead.
  if (/\{%|\{\{/.test(built)) {
    console.error(`render: ${p} still contains Liquid — a tag did not render`);
    console.error(built.match(/\{[%{][^\n]{0,80}/g)?.slice(0, 5).join("\n") || "");
    process.exit(1);
  }
  writeFileSync(join(ROOT, p), built);
  wrote++;
  console.log(`  rendered ${p} (${built.length} bytes)`);
}
console.log(`render: ${wrote} page(s)`);
