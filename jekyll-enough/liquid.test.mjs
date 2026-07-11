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

// ---- the journal's measured surface (docs/origin.md study, re-run against the engine repo) ----------

// 8. assign inside a for-loop SURVIVES the loop (template scope), and the caller's ctx stays clean.
{
  const ctx = { list: [1, 2, 3] };
  const out = render("{% assign hit = false %}{% for n in list %}{% if n == 2 %}{% assign hit = true %}{% endif %}{% endfor %}{% if hit %}FOUND{% endif %}", ctx);
  ok(out === "FOUND", "an assign inside a for-loop body is visible after the loop");
  ok(!("hit" in ctx), "assigns land on the template scope, not the caller's ctx");
}

// 9. capture: render-now, bind to a name, reuse — including the journal's nested-capture contact pattern.
{
  const out = render("{% capture greet %}hi {{ name | upcase }}{% endcapture %}[{{ greet }}][{{ greet }}]", { name: "jo" });
  ok(out === "[hi JO][hi JO]", "capture renders a fragment once and the handle is reusable");
  // _layouts/journal.html: capture contact_template -> include {{ contact_template }} subject=... mailto=...
  const tpl = "{%- capture contact_template -%}\ncontact/{{ page.author | slugify }}.md\n{%- endcapture -%}" +
              "{%- include {{ contact_template }} subject=page.title mailto=page.contact_email -%}";
  const got = [];
  const out2 = render(tpl, { page: { author: "Autumn Ryan", title: "T", contact_email: "a@x" } },
    { include: (name, c) => { got.push([name, c.include.subject, c.include.mailto]); return "OK"; } });
  ok(out2 === "OK" && got[0][0] === "contact/autumn-ryan.md", "a dynamic {% include {{ EXPR }} %} resolves the captured name");
  ok(got[0][1] === "T" && got[0][2] === "a@x", "include params evaluate in the caller's scope and land on include.*");
  const inner = render("{% include a.html x='1' %}", {},
    { include: (n, c) => n === "a.html" ? render("{% include b.html %}", c, { include: (n2, c2) => "[" + render("{{ include.x }}", c2) + "]" }) : "?" });
  ok(inner === "[]", "an inner include never sees an outer include's params (fresh include.* per tag)");
}

// 10. unless + continue (skel/index.md gates authors; _includes/piece.html continues past stubs).
{
  ok(render("{% unless page.author %}STUB{% endunless %}", { page: {} }) === "STUB", "unless: falsy renders the body");
  ok(render("{% unless page.author %}STUB{% else %}FULL{% endunless %}", { page: { author: "a" } }) === "FULL", "unless: truthy takes the else");
  const out = render("{% for n in list %}{% if n == 2 %}{% continue %}{% endif %}{{ n }}{% endfor %}", { list: [1, 2, 3] });
  ok(out === "13", "continue skips the rest of one iteration");
  const brk = render("{% for n in list %}{% if n == 2 %}{% break %}{% endif %}{{ n }}{% endfor %}", { list: [1, 2, 3] });
  ok(brk === "1", "break exits the loop");
  const part = render("{% for n in list %}<{{ n }}{% continue %}>{% endfor %}", { list: [1, 2] });
  ok(part === "<1<2", "output produced before a continue is kept");
}

// 11. where_exp — the exact shapes skel/index.md and the sitemaps use.
{
  const pages = [
    { author: "ann", index: true, noting: null },
    { author: null, index: true },
    { author: "bob", index: false },
    { author: "ann", noting: "x" },
  ];
  const ctx = { site: { pages }, author: "ann" };
  ok(render('{{ site.pages | where_exp:"p","p.author" | size }}', ctx) === "3", "where_exp: bare truthiness");
  ok(render('{{ site.pages | where_exp:"p","p.index != false" | size }}', ctx) === "3", "where_exp: != false keeps nil (Liquid: nil != false)");
  ok(render('{{ site.pages | where_exp:"p","p.author == author" | size }}', ctx) === "2", "where_exp: compares against the outer scope");
  ok(render('{{ site.pages | where_exp:"p","p.noting == null" | size }}', ctx) === "3", "where_exp: == null matches absent and explicit nil");
}

// 12. bracket lookup — the journal's site.data.git[kind][data_key] double-dynamic access.
{
  const ctx = { site: { data: { git: { blame: { k1: [7] } } } }, kind: "blame", data_key: "k1" };
  ok(render("{{ site.data.git[kind][data_key] | jsonify }}", ctx) === "[7]", "a[b][c] with variable keys");
  ok(render('{{ site.data.git["blame"].k1.first }}', ctx) === "7", "a quoted bracket key mixes with dots and pseudo-props");
  ok(render("{{ list[0] }}{{ list[1] }}", { list: ["a", "b"] }) === "ab", "numeric index brackets");
}

// 13. the filter tail, measured lines quoted from the journal.
{
  // _includes/duration.html: words | strip_html | number_of_words, then | divided_by:200 | ceil
  const content = "<h2>title</h2>\n<script>var xx = 1;</script>\n<p>one two three</p>";
  ok(render("{{ c | strip_html | number_of_words }}", { c: content }) === "4", "strip_html drops tags AND script bodies; number_of_words counts");
  ok(render("{{ n | divided_by:200 | ceil }}", { n: 450 }) === "2", "divided_by floors int/int (Ruby), ceil is then honest");
  ok(render("{{ n | divided_by: 2 }}", { n: 4.5 }) === "2.25", "divided_by stays float when either side is (a 2.0 literal reads as int in JS — named divergence)");
  ok(render("{{ page.author | slugify }}", { page: { author: "Autumn Ryan" } }) === "autumn-ryan", "slugify: the contact-include path segment");
  ok(render("{{ x | append: '.md' | replace: '.md', '.html' }}", { x: "a" }) === "a.html", "append + replace");
  ok(render("{{ s | split: ',' | join: '|' }}", { s: "a,b" }) === "a|b", "split + join round-trip");
  ok(render('{{ ps | map: "author" | uniq | sort | join }}', { ps: [{ author: "b" }, { author: "a" }, { author: "b" }] }) === "a b", "map + uniq + sort (skel/index.md author roll-up)");
  ok(render("{{ ns | reverse | first | plus: 1 }}", { ns: [1, 2, 3] }) === "4", "reverse + first + plus");
}

// 14. dates — %G-W%V is the journal's headline format; UTC, deterministic.
{
  const ctx = { page: { date: "2026-07-10" }, site: { time: "2026-07-10T12:30:00Z" } };
  ok(render("{{ page.date | date: '%G' }}", ctx) === "2026", "date %G (ISO week-year)");
  ok(render('{{ page.date | date: "%G-W%V: %B %-d" }}', ctx) === "2026-W28: July 10", "the journal's by-line format, byte-for-byte");
  ok(render("{{ d | date: '%G-W%V' }}", { d: "2027-01-01" }) === "2026-W53", "an early-January date belongs to the PRIOR ISO year");
  ok(render("{{ site.time | date_to_xmlschema }}", ctx) === "2026-07-10T12:30:00+00:00", "date_to_xmlschema (sitemap lastmod)");
  ok(render("{{ bad | date: '%Y' }}", { bad: "not a date" }) === "not a date", "an unparseable date passes through, Liquid-style");
}

// 15. the personality seam: site-specific filters register via opts.filters, never in the library.
{
  const antibody = { antibody_unscheme: (v, [mode]) => String(v ?? "").replace(/^https?:/, mode === "label" ? ":" : "") };
  const out = render("{{ u | antibody_unscheme }} {{ u | antibody_unscheme: 'label' }}", { u: "https://x.org/a" }, { filters: antibody });
  ok(out === "//x.org/a :" + "//x.org/a", "opts.filters resolves a personality's own filter");
  ok(render("{{ 'x' | upcase }}", {}, { filters: { upcase: () => "!" } }) === "!", "opts.filters may override a library filter");
}

// 16. failure posture: strict throws; lenient downgrades to a NAMED gap, never a silent skip.
{
  let threw = false;
  try { render("{% highlight ruby %}x{% endhighlight %}", {}); } catch { threw = true; }
  ok(threw, "strict: an unknown tag throws (a build wants the failure)");
  const gaps = [];
  const out = render("a {% highlight ruby %} b {{ x | rouge }} c", { x: "v" }, { lenient: true, gaps });
  ok(out.includes("<!-- liquid-enough gap: tag {% highlight %} -->"), "lenient: an unknown tag renders as a visible comment");
  ok(out.includes(" b ") && out.includes(" c"), "lenient: everything around the gap still renders");
  ok(gaps.length === 2 && gaps[1] === "filter rouge", "gaps are collected by name (the compatibility report)");
  const noLoader = render("x{% include a.html %}y", {}, { lenient: true, gaps: [] });
  ok(noLoader === "x<!-- liquid-enough gap: include -->y", "lenient: a missing include loader is a gap, not a crash");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall liquid-enough tests passed");
