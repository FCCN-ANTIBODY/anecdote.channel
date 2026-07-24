// Unit: markdown-enough (markdown.mjs) - the dumb markdown pass, plus the full civic render pipeline
// (Liquid then markdown) against fixtures copied verbatim from the real atlas pages. Run:
// node jekyll-enough/markdown.test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { render as md, inline } from "./markdown.mjs";
import { render as liquid } from "./liquid.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (n) => readFileSync(join(HERE, "fixtures", n), "utf8");

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// 1. inline: code / links / bold / italic, and the civic-real case of a LINK whose text is a code span.
{
  ok(inline("**bold**") === "<strong>bold</strong>", "bold");
  ok(inline("_it_ and *it*") === "<em>it</em> and <em>it</em>", "italic, both _ and *");
  ok(inline("a `x<y` b") === "a <code>x&lt;y</code> b", "inline code is escaped and shielded");
  ok(inline("[text](/u)") === '<a href="/u">text</a>', "a plain link");
  ok(inline("[`/needs.json`](/needs.json)") === '<a href="/needs.json"><code>/needs.json</code></a>', "a link whose TEXT is a code span (the real civic case)");
  ok(inline("**a** `b` [c](/d)") === '<strong>a</strong> <code>b</code> <a href="/d">c</a>', "mixed inline, no cross-talk");
  ok(inline("under_score_word stays") === "under_score_word stays", "intra-word underscores are not italic");
}

// 2. blocks: heading, paragraph, fence, and RAW HTML passthrough (verbatim, un-escaped).
{
  ok(md("# Title") === "<h1>Title</h1>", "ATX h1");
  ok(md("### Deep") === "<h3>Deep</h3>", "ATX h3 by hash count");
  ok(md("one\ntwo") === "<p>one\ntwo</p>", "a soft-wrapped paragraph is one <p>");
  ok(md("a\n\nb") === "<p>a</p>\n<p>b</p>", "a blank line splits paragraphs");
  ok(md("```\n<x> & y\n```") === "<pre><code>&lt;x&gt; &amp; y</code></pre>", "a fenced block is escaped, not rendered");
  const raw = '<div id="s">\n  <a href="/x">y</a>\n</div>';
  ok(md(raw) === raw, "a multi-line raw HTML block passes through VERBATIM (not escaped, not wrapped)");
  ok(md('<script src="/a.js"></script>') === '<script src="/a.js"></script>', "a raw <script> line passes through");
}

// 3. mixed document: heading + paragraph + raw block interleave, blank-line separated.
{
  const out = md('# H\n\ntext with **b**\n\n<div>raw</div>\n\nmore [l](/u)');
  ok(out.includes("<h1>H</h1>"), "heading rendered");
  ok(out.includes("<p>text with <strong>b</strong></p>"), "paragraph rendered with inline");
  ok(out.includes("<div>raw</div>") && !out.includes("<p><div>"), "raw block not wrapped in <p>");
  ok(out.includes('<a href="/u">l</a>'), "trailing paragraph link");
}

// 3b. a raw-text element (script/style) runs to its CLOSING TAG - blank lines inside stay VERBATIM.
// The real case: tell.anecdote.channel's landing carries its forward logic in one inline <script>
// with blank lines between sections; wrapping its tail in <p> feeds literal HTML to the JS parser
// and kills the page (caught by the chain UI test driving the built site in Chromium).
{
  const script = '<script>\nvar a = 1;\n\nvar b = 2;\n</' + 'script>';
  const out = md('# H\n\n' + script + '\n\nafter');
  ok(out.includes(script), "a <script> with blank lines passes through verbatim, to its close tag");
  ok(!out.includes("<p>var") && !out.includes("<p><script"), "no <p> seeded inside or around the script");
  ok(out.includes("<p>after</p>"), "markdown resumes after the raw-text element closes");
  const style = '<style>\n.a { color: red; }\n\n.b { color: blue; }\n</style>';
  ok(md(style).includes(style), "a <style> with blank lines passes through verbatim too");
  const oneLine = '<script>var x = 1;</' + 'script>';
  ok(md(oneLine + '\n\ntext').includes(oneLine), "a same-line open+close raw-text element still works");
}

// 4. the FULL civic pipeline: Liquid (with data) then markdown, on the real page bodies.
{
  const site = { title: "Atlas", baseurl: "", data: {
    tells: [{ id: "t1", name: "Boulder", url: "https://t1", scope: "CO", signer: "key:a", reports: "" }],
    piles: [{ id: "p1", name: "Parks", tell: "t1", level: "county", map: "/p1.xml" }],
    needs: [{ id: "7", text: "clinic hours", scope: "CO", topic: "health", terms: "", need_url: "https://n", asker_repo: "who/repo" }],
  } };

  for (const [name, mustHave] of [
    ["index.body.md", ["<h1>Atlas</h1>", '<a href="/tells/">', '<strong>directory of Tells</strong>', '<div id="atlas">']],
    ["tells.body.md", ["<h1>Tells</h1>", '<a href="https://t1">Boulder</a>', "Parks", '<ul class="tells">']],
    ["needs.body.md", ['<h1>What', '<a href="https://n">who/repo#7</a>', '<ul class="whats-hanging">']],
  ]) {
    const html = md(liquid(fixture(name), { site, page: {} }));
    for (const frag of mustHave) ok(html.includes(frag), `${name}: renders ${JSON.stringify(frag)}`);
    ok(!html.includes("{%") && !html.includes("{{"), `${name}: no un-rendered Liquid remains`);
    ok(!html.includes("<p><div") && !html.includes("<p><ul"), `${name}: raw HTML blocks not swallowed into <p>`);
  }
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall markdown-enough tests passed");
