// Unit: press/markdown-more.mjs — README blocks upgraded to HTML in front of markdown-enough.
// Run: node press/markdown-more.test.mjs
import { render, upgrade } from "./markdown-more.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

ok(render("- one\n- two **bold**\n") === "<ul><li>one</li><li>two <strong>bold</strong></li></ul>", "a bullet list");
ok(render("1. first\n2. second\n") === "<ol><li>first</li><li>second</li></ol>", "a numbered list");
ok(render("- a\n  - a1\n  - a2\n- b\n") === "<ul><li>a<ul><li>a1</li><li>a2</li></ul></li><li>b</li></ul>", "nesting by indent");
ok(render("- a long item\n  that wraps\n- b\n") === "<ul><li>a long item that wraps</li><li>b</li></ul>", "a wrapped item folds into itself");
ok(render("> quoted **words**\n> more\n") === "<blockquote><p>quoted <strong>words</strong>\nmore</p></blockquote>", "a blockquote renders its inside");
ok(render("> - in a quote\n> - a list\n").includes("<blockquote><ul><li>in a quote</li>"), "a list inside a blockquote");
{
  const t = render("| a | b |\n| --- | --- |\n| `x` | [y](y.md) |\n");
  ok(t.startsWith("<table><thead><tr><th>a</th><th>b</th></tr></thead>") && t.includes("<td><code>x</code></td><td><a href=\"y.md\">y</a></td>"), "a pipe table with inline cells");
}
ok(render("before\n\n---\n\nafter") === "<p>before</p>\n<hr>\n<p>after</p>", "a rule");
ok(render("![a diagram](d.png)") === "<p><a href=\"d.png\">a diagram (image)</a></p>", "an image becomes a link carrying its alt text");
{
  const src = "```\n- not a list\n> not a quote\n| not | a table |\n```";
  ok(upgrade(src) === src && render(src).includes("- not a list"), "fenced code is copied through untouched");
}
ok(render("# Title\n\nPlain paragraph with *emphasis*.") === "<h1>Title</h1>\n<p>Plain paragraph with <em>emphasis</em>.</p>", "everything else reaches markdown-enough as written");
ok(render("**bold start** of a paragraph\n") === "<p><strong>bold start</strong> of a paragraph</p>", "a paragraph opening with ** is not a list");
ok(render("***\n") === "<hr>", "*** is a rule, not a bullet");

if (fails) { console.error(`\n${fails} failed`); process.exit(1); }
console.log("\nmarkdown-more: all passed");
