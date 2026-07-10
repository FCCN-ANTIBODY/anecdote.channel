// Unit: the jekyll-enough BUILD (build.mjs) - wire yaml + liquid + markdown into a _site tree. Driven by
// an in-memory atlas-shaped tree assembled from fixtures copied verbatim from the real site. This is the
// capstone: if the offline origin can produce this _site tree, git-enough pushes it down. Run:
// node jekyll-enough/build.test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildSite } from "./build.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (n) => readFileSync(join(HERE, "fixtures", n), "utf8");

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// Assemble the source tree the way the atlas repo is laid out (front matter + fixture bodies).
const tree = {
  "_config.yml": fixture("_config.yml"),
  "_layouts/default.html": fixture("default.html"),
  "_data/tells.yml": fixture("tells.yml"),
  "_data/piles.yml": fixture("piles.yml"),
  "_data/needs.yml": fixture("needs.yml"),
  "index.md": "---\nlayout: default\ntitle: null\n---\n" + fixture("index.body.md"),
  "tells.md": "---\nlayout: default\ntitle: Tells\npermalink: /tells/\n---\n" + fixture("tells.body.md"),
  "needs.md": "---\nlayout: default\ntitle: What's hanging\npermalink: /needs/\n---\n" + fixture("needs.body.md"),
  "assets/atlas.css": "body{color:#111}\n",
  "README.md": "# Readme\n\nnot a site page.\n",
};

const site = buildSite(tree);

// 1. index.md (no permalink) -> _site/index.html, wrapped in the layout, body rendered.
{
  const html = site["_site/index.html"];
  ok(!!html, "index.md builds to _site/index.html");
  ok(html.startsWith("<!DOCTYPE html>"), "the page is wrapped in the default layout (doctype from the layout)");
  ok(html.includes("<title>Atlas</title>"), "title collapses to the site title (page.title is null)");
  ok(html.includes("<h1>Atlas</h1>"), "the markdown body's heading rendered inside the layout");
  ok(html.includes('href="/assets/atlas.css"'), "layout's relative_url link resolved");
  ok(html.includes('<div id="atlas">'), "the page's raw HTML block survived into the built page");
  ok(!html.includes("{{") && !html.includes("{%"), "no un-rendered template syntax remains");
}

// 2. tells.md -> pretty permalink _site/tells/index.html, with the data-driven Tell listing.
{
  const html = site["_site/tells/index.html"];
  ok(!!html, "tells.md (permalink: /tells/) builds to _site/tells/index.html");
  ok(html.includes("<title>Tells · Atlas</title>"), "page.title present -> 'Tells · Atlas'");
  ok(html.includes("Tell (reference hub)"), "the real _data/tells.yml drove the listing (the reference Tell)");
  ok(html.includes("<h1>Tells</h1>"), "the markdown h1 rendered");
}

// 3. needs.md -> _site/needs/index.html.
{
  ok(!!site["_site/needs/index.html"], "needs.md (permalink: /needs/) builds to _site/needs/index.html");
  ok(site["_site/needs/index.html"].includes("What"), "needs page rendered");
}

// 4. assets copied verbatim; excluded files dropped; no stray outputs.
{
  ok(site["_site/assets/atlas.css"] === "body{color:#111}\n", "a static asset is copied verbatim");
  ok(!("_site/README.md" in site), "README.md is dropped (it is in _config exclude)");
  ok(!Object.keys(site).some((k) => k.startsWith("_site/_layouts") || k.startsWith("_site/_data")), "special dirs are not emitted into _site");
}

// 5. includes + a nested layout chain, on a tiny synthetic tree.
{
  const t = {
    "_config.yml": "title: T\n",
    "_layouts/base.html": "<html>{{ content }}</html>",
    "_layouts/inner.html": "---\nlayout: base\n---\n<main>{{ content }}</main>",
    "_includes/bit.html": "<b>{{ site.title }}</b>",
    "page.html": "---\nlayout: inner\n---\nhi {% include bit.html %}",
  };
  const s = buildSite(t);
  ok(s["_site/page.html"] === "<html><main>hi <b>T</b></main></html>",
    "include resolved + layout chain wrapped inner-then-base (page -> inner -> base)");
}

// 6. no front matter fence => static file (Jekyll semantics): .html AND .md are copied verbatim.
{
  const s = buildSite({ "raw.html": "<p>{{ literal }}</p>", "notes/x.md": "# raw\n\n{{ nope }}\n" });
  ok(s["_site/raw.html"] === "<p>{{ literal }}</p>", "a front-matter-less .html is copied verbatim (not templated)");
  ok(s["_site/notes/x.md"] === "# raw\n\n{{ nope }}\n", "a front-matter-less .md is copied verbatim (NOT markdown-converted)");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall jekyll-enough build tests passed");
