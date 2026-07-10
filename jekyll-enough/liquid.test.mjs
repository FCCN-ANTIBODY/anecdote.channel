// Unit: liquid-enough (liquid.mjs) — the dumb template language, driven against fixtures copied VERBATIM
// from the real civic sites (atlas _layouts/default.html and tells.md, front matter stripped, under
// ./fixtures/). If this renders those to the HTML the sites expect, the offline origin can build their
// static shells on-device. Run: node jekyll-enough/liquid.test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { render, evalCond } from "./liquid.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (n) => readFileSync(join(HERE, "fixtures", n), "utf8");

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// 1. output + dotted paths + the relative_url / default filters.
{
  const ctx = { site: { title: "Atlas", baseurl: "" }, page: { title: "Tells" } };
  ok(render("{{ site.title }}", ctx) === "Atlas", "dotted variable output");
  ok(render("{{ '/assets/atlas.css' | relative_url }}", ctx) === "/assets/atlas.css", "relative_url with empty baseurl");
  ok(render("{{ '/x' | relative_url }}", { site: { baseurl: "/sub" } }) === "/sub/x", "relative_url honors a baseurl");
  ok(render("{{ page.missing | default: 'fallback' }}", ctx) === "fallback", "default fills a missing value");
  ok(render("{{ page.title | default: 'fallback' }}", ctx) === "Tells", "default leaves a present value alone");
  ok(render("{{ page.nope }}", ctx) === "", "a missing variable renders empty, not 'undefined'");
}

// 2. the real atlas <title> line: {% if page.title %}{{ page.title }} · {% endif %}{{ site.title }}
{
  const line = "{% if page.title %}{{ page.title }} · {% endif %}{{ site.title }}";
  ok(render(line, { page: { title: "Tells" }, site: { title: "Atlas" } }) === "Tells · Atlas", "if page.title present → prefixed");
  ok(render(line, { page: { title: null }, site: { title: "Atlas" } }) === "Atlas", "if page.title null → bare site title (nil is falsy)");
}

// 3. the REAL atlas layout renders with content injected and all links resolved.
{
  const layout = fixture("default.html");
  const html = render(layout, { site: { title: "Atlas", description: "A directory of Tells" }, page: { title: null }, content: "<p>BODY</p>" });
  ok(html.includes("<title>Atlas</title>"), "layout title collapses to just the site title when page.title is null");
  ok(html.includes('href="/assets/atlas.css"'), "layout stylesheet link resolved via relative_url");
  ok(html.includes("<main>\n    <p>BODY</p>"), "{{ content }} injected into <main>");
  ok(html.includes('href="/tells/"') && html.includes('href="/needs/"'), "nav links resolved");
}

// 4. the REAL tells.md body: for over site.data.tells, default, nested where + size guard, if/else.
{
  const body = fixture("tells.body.md");
  const site = { data: {
    tells: [
      { id: "t1", name: "Boulder", url: "https://t1", scope: "Boulder CO", signer: "key:abc", reports: "" },
      { id: "t2", name: null,       url: "https://t2", scope: "Denver CO",  signer: "key:def", reports: "key:rep" },
    ],
    piles: [
      { id: "p1", name: "Parks", tell: "t1", level: "county", map: "/p1.xml" },
    ],
  } };
  const html = render(body, { site, page: {} });
  ok(html.includes('<a href="https://t1">Boulder</a>'), "for-loop emits each Tell with its name");
  ok(html.includes('<a href="https://t2">t2</a>'), "name|default:id falls back to the id when name is null");
  ok(!/reports:/.test(html.split("t2")[0]), "t1 (reports: '') shows no reports line — the != '' guard");
  ok(html.includes("reports: <code>key:rep</code>"), "t2 (reports set) shows the reports line");
  ok(html.includes("Parks") && html.includes("/p1.xml"), "the where:'tell' filter groups pile p1 behind t1 (size>0 branch)");
  ok(html.includes("no piles grouped behind this Tell yet"), "t2 with no piles hits the {% else %} branch");
}

// 5. comparison + boolean chaining + .size pseudo-property, in isolation.
{
  ok(evalCond("a.size > 0", { a: [1, 2] }) === true, ".size on an array + numeric > comparison");
  ok(evalCond("a.size > 0", { a: [] }) === false, "empty array → size 0 → false");
  ok(evalCond("x and y", { x: 1, y: "z" }) === true, "and: both truthy");
  ok(evalCond("x and y", { x: 1, y: null }) === false, "and: one falsy (nil)");
  ok(evalCond("x or y", { x: null, y: "z" }) === true, "or: one truthy");
  ok(evalCond("n == 3", { n: 3 }) === true, "== compares equal");
}

// 6. assign (with a filtered RHS) + include loaders.
{
  const out = render("{% assign who = name | upcase %}hi {{ who }}", { name: "atlas" });
  ok(out === "hi ATLAS", "assign binds a filtered value");
  const inc = render("[{% include bit.html %}]", { v: "X" }, { include: (name, ctx) => `${name}=${ctx.v}` });
  ok(inc === "[bit.html=X]", "{% include %} calls the loader with the current scope");
  const rel = render("{% include_relative w/a.html %}", {}, { includeRelative: (p) => `rel:${p}` });
  ok(rel === "rel:w/a.html", "{% include_relative %} calls its loader with the path");
}

// 7. whitespace trim markers collapse the seams.
{
  ok(render("a\n{%- assign z = 1 -%}\nb", {}) === "ab", "{%- -%} trims whitespace on both seams");
  ok(render("x {{- 'y' -}} z", {}) === "xyz", "{{- -}} trims around an output");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall liquid-enough tests passed");
