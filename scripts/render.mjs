// scripts/render.mjs — render the Liquid in index.html against _data, using this repo's own
// jekyll-enough. Run at deploy, after the directory is gathered.
//
// WHAT THIS IS, AND WHAT IT IS NOT. jekyll-enough is a RUNTIME renderer. The thesis it serves is
// that an UNBUILT Jekyll project can be served to the public web and rendered in the browser, page
// by narrow page — and on a device holding the repository, built whole so it can be sent somewhere
// else. It is not a server-side build tool, and this script must not be mistaken for its purpose.
//
// This is a PRE-RENDER: a progressive optimisation on one page, so that something which does not
// execute JavaScript — a crawler, a reader with scripting off — receives the directory as text
// instead of a promise to fetch one. The runtime path stays authoritative and stays present.
//
// Which is why it DEGRADES RATHER THAN FAILS. A page that could not be pre-rendered is still a
// working page: the browser finishes it. Refusing to deploy would take a page that renders for
// almost everyone and serve nobody, to avoid an outcome that is merely worse for some. That is the
// same instinct as the journal's media tools, where you cannot see the image but you are always
// given the caption — the tool makes the degraded form carry real information rather than treating
// degradation as failure.
//
// Surgical on one page on purpose: this repo is served as-is (pages.yml: .nojekyll, path "."), and
// turning all of it into a build would drag the composer, the demos and the vendored runtime
// through a templater none of them asked for.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, relative } from "node:path";
import { buildSite } from "../jekyll-enough/build.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = ["index.html"];
// IN PLACE IS DESTRUCTIVE: it replaces the source with its own output. The deploy does that to a
// throwaway checkout on purpose; a person running it in a working tree would lose the template,
// which is exactly what happened once. So it is opt-in, and the default writes a preview instead.
const IN_PLACE = process.argv.includes("--in-place");

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
// Partials the pages include. They are served too, so the runtime renderer fetches these very
// bytes — one template, two renderers, no second copy to drift.
for (const name of readdirSync(ROOT)) if (name.endsWith(".liquid")) tree[name] = readFileSync(join(ROOT, name), "utf8");
for (const p of PAGES) tree[p] = readFileSync(join(ROOT, p), "utf8");

// buildSite returns the built tree directly, keyed under _site/.
const out = buildSite(tree);

let wrote = 0;
for (const p of PAGES) {
  const built = out[`_site/${p}`] ?? out[`_site/${p.replace(/\.html$/, "")}/index.html`];
  if (built == null) {
    // Nothing came back at all: leave the source in place. It is a working page that renders in
    // the browser, which is more than an aborted deploy gives anyone.
    console.log(`::warning::${p} produced nothing from the pre-render — leaving the source, the browser renders it`);
    continue;
  }
  // Liquid left over means a tag did not render. Say so — loudly, because it is a defect — but
  // ship: the runtime renderer completes the page, and a reader is better served by a page that
  // finishes in the browser than by a deploy that never happened.
  const leftover = built.match(/\{[%{][^\n]{0,80}/g);
  if (leftover) {
    console.log(`::warning::${p} still contains Liquid after pre-render — the browser will finish it`);
    for (const l of leftover.slice(0, 5)) console.log(`    ${l}`);
  }
  const dest = IN_PLACE ? p : p.replace(/\.html$/, ".rendered.html");
  writeFileSync(join(ROOT, dest), built);
  wrote++;
  console.log(`  rendered ${p} -> ${dest} (${built.length} bytes)`);
}
console.log(`render: ${wrote} page(s)`);
