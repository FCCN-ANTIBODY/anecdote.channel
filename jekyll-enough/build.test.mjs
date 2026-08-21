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

// 7. SWITCHABILITY: the seams are injectable plugs; a swapped one takes effect, defaults unchanged.
{
  const t = {
    "_config.yml": "title: T",
    "post.md": "---\nlayout: null\n---\n# Hi\n",
    "_data/things.json": '[{"n":1}]',
  };
  ok(buildSite(t)["_site/post.html"].includes("<h1>Hi</h1>"), "default doc-render plug: markdown-enough runs");
  const shout = buildSite(t, { renderMarkdown: (s) => "<!K>" + s.toUpperCase() });
  ok(shout["_site/post.html"] === "<!K># HI\n", "a swapped doc-render plug replaces markdown-enough (build unchanged)");
  const tpl = buildSite({ "p.html": "---\nlayout: null\n---\nX" }, { renderTemplate: () => "TPL" });
  ok(tpl["_site/p.html"] === "TPL", "a swapped template plug is the one the builder renders through");
  const jsonData = buildSite({ "d.html": "---\nlayout: null\n---\n{{ site.data.things.first.n }}", "_data/things.json": '[{"n":42}]' });
  ok(jsonData["_site/d.html"] === "42", "_data/*.json is read as JSON (the identity data plug)");
}

// 8. the Jekyll page/site model: page.url / page.path, and site.pages populated before render (nav-usable).
{
  const t = {
    "_config.yml": "permalink: pretty",
    "index.md": "---\ntitle: Home\n---\n[me]({{ page.url }}) at {{ page.path }}",
    "about.md": "---\ntitle: About\npermalink: /about/\n---\nabout",
    "nav.html": "---\nlayout: null\n---\n{% for p in site.pages %}<a href=\"{{ p.url }}\">{{ p.title }}</a>{% endfor %}",
  };
  const s = buildSite(t);
  ok(s["_site/index.html"].includes('href="/"') && s["_site/index.html"].includes("at index.md"), "page.url (/) and page.path (index.md) exposed to the page");
  const nav = s["_site/nav/index.html"];   // permalink: pretty -> nav.html builds to nav/index.html
  ok(nav.includes('href="/">Home') && nav.includes('href="/about/">About'), "site.pages iterates all pages with their url + front matter (real-Jekyll nav works)");
}

// 9. _data nests by directory (the journal's _data/git/<kind> stat files) and renders via bracket lookup.
{
  const s = buildSite({
    "_config.yml": "title: J\n",
    "_data/git/blame.json": JSON.stringify({ journalfooindex: [{ w: 3 }] }),
    "_data/tells.yml": "- id: t1\n",
    "p.html": '---\nkind: blame\nkey: journalfooindex\n---\n<script type="application/json">{{ site.data.git[page.kind][page.key] | jsonify }}</script>',
  });
  ok(s["_site/p.html"].includes('[{"w":3}]'), "_data/git/blame.json lands at site.data.git.blame and bracket lookup reaches it");
  ok(s["_site/p.html"].startsWith("<script"), "top-level _data files still load beside nested ones");
}

// 10. the template seams COMPOSE: build threads filters + lenient/gaps down to the template plug.
{
  // a personality filter registered at the build boundary reaches a page's Liquid
  const withFilter = buildSite(
    { "p.html": "---\nlayout: null\n---\n{{ 'x' | antibody_shout }}" },
    { filters: { antibody_shout: (v) => String(v).toUpperCase() + "!" } });
  ok(withFilter["_site/p.html"] === "X!", "opts.filters reaches the page's template (personality seam composes)");
  // lenient: a missing include is a named gap in the build, not a crash; the gap is collected
  const gaps = [];
  const lenient = buildSite(
    { "p.html": "---\nlayout: null\n---\na{% include nope.html %}b" },
    { lenient: true, gaps });
  ok(lenient["_site/p.html"].includes("a<!-- jekyll-enough gap: missing _includes/nope.html -->b"), "lenient: a missing include renders a visible gap, page still builds");
  ok(gaps.some((g) => g.includes("nope.html")), "the gap is collected (the compatibility report)");
  let threw = false;
  try { buildSite({ "p.html": "---\nlayout: null\n---\n{% include nope.html %}" }); } catch { threw = true; }
  ok(threw, "strict (default): a missing include throws - a build wants the failure");
}

// 11. `defaults:` - front matter a site declares once and matching pages inherit. This is the mounted-piece
// case: a cited page carries no layout of its own, precisely so it need not know who is publishing it, and
// the mounting site's defaults are what give it one. Read as absent, such a page builds as a bare fragment.
{
  const cfg = [
    "defaults:",
    '  - scope: {path: ""}',
    "    values:",
    "      preferences: journal",
    '  - scope: {path: "journal"}',
    "    values:",
    "      layout: wrap",
    "      badge: mounted",
  ].join("\n");
  const t = {
    "_config.yml": cfg,
    "_layouts/wrap.html": "<main>{{ content }}</main>",
    // a mounted piece: no layout of its own, and no idea who is publishing it
    "journal/piece/index.md": "---\ntitle: A piece\n---\nprose\n",
    // a page that overrides one inherited key and keeps the other
    "journal/own.html": "---\nlayout: null\nbadge: its own\n---\n{{ page.badge }}/{{ page.preferences }}",
    // outside the mount: inherits the site-wide default only
    "top.html": "---\nlayout: null\n---\n{{ page.preferences }}/{{ page.badge }}",
  };
  const s2 = buildSite(t);

  ok(s2["_site/journal/piece/index.html"] === "<main><p>prose</p></main>",
     "a mounted piece with no layout of its own inherits one from the site's defaults");
  ok(s2["_site/journal/own.html"] === "its own/journal",
     "the page's own front matter wins over a default, key by key");
  ok(s2["_site/top.html"] === "journal/",
     "a scope the path does not match does not apply; the site-wide one still does");
}

// 12. defaults: precedence between overlapping scopes, and scope.type.
{
  const cfg = [
    "defaults:",
    '  - scope: {path: ""}',
    "    values: {tier: site}",
    '  - scope: {path: "a"}',
    "    values: {tier: outer}",
    '  - scope: {path: "a/b"}',
    "    values: {tier: inner}",
    '  - scope: {path: "", type: "posts"}',
    "    values: {tier: never}",
  ].join("\n");
  const page = (p) => ({ [p]: "---\nlayout: null\n---\n{{ page.tier }}" });
  const t = { "_config.yml": cfg, ...page("a/b/deep.html"), ...page("a/shallow.html"), ...page("z.html") };
  const s2 = buildSite(t);
  ok(s2["_site/a/b/deep.html"] === "inner", "the most specific scope wins over the less specific ones");
  ok(s2["_site/a/shallow.html"] === "outer", "a page matches the deepest scope that contains it");
  ok(s2["_site/z.html"] === "site", "an unmatched page keeps the site-wide default");
  // built PAGES only: _config.yml is copied through to the output verbatim and carries the word.
  const built = ["_site/a/b/deep.html", "_site/a/shallow.html", "_site/z.html"].map((k) => s2[k]);
  ok(!built.some((v) => String(v).includes("never")),
     "a scope naming a collection this builder does not have never applies");
}

// 13. defaults reach site.pages too, so a template that queries the page list sees them - which is how an
// issue layout finds a piece it cited.
{
  const t = {
    "_config.yml": 'defaults:\n  - scope: {path: "journal"}\n    values: {kind: letter}',
    "journal/one.md": "---\ntitle: One\n---\nx",
    "list.html": '---\nlayout: null\n---\n{{ site.pages | where: "kind", "letter" | size }}',
  };
  ok(buildSite(t)["_site/list.html"] === "1", "an inherited key is queryable on site.pages");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall jekyll-enough build tests passed");
