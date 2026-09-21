// press/markdown-more.mjs — the README dialect, as a PRE-PASS in front of markdown-enough.
//
// jekyll-enough/markdown.mjs is dumb on purpose ("No lists, tables, blockquotes, or images") and its own
// AGENTS.md refuses widening it. But it has one property that makes widening unnecessary: RAW HTML BLOCKS
// PASS THROUGH VERBATIM. So the blocks a README actually uses are upgraded to HTML here, before the enough
// renderer sees them, and everything else reaches it untouched. The enough renderer stays enough; the press
// — which reads other people's READMEs, a job the civic pages never had — brings its own reading glasses.
//
// It plugs in where build.mjs says a reader may be swapped: `buildSite(tree, { renderMarkdown })`.
//
// Upgraded: bullet and numbered lists (nested by indent), blockquotes, pipe tables, rules, and images —
// which become a LINK carrying their alt text, because the chamber a face is read in has no network and a
// broken image says less than the sentence its author wrote for it.

import { render as renderEnough, inline } from "../jekyll-enough/markdown.mjs";

const ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const images = (s) => s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, alt, src) => `[${alt || "image"} (image)](${src})`);

function list(lines) {
  // items: { indent, ordered, text }. Continuation lines fold into the item above them.
  const items = [];
  for (const l of lines) {
    const m = ITEM.exec(l);
    if (m) items.push({ indent: m[1].replace(/\t/g, "    ").length, ordered: /\d/.test(m[2]), text: m[3] });
    else if (items.length) items[items.length - 1].text += " " + l.trim();
  }
  let html = "";
  const open = [];                                        // stack of { indent, tag }
  for (const it of items) {
    while (open.length && it.indent < open[open.length - 1].indent) html += "</li></" + open.pop().tag + ">";
    if (!open.length || it.indent > open[open.length - 1].indent) {
      const tag = it.ordered ? "ol" : "ul";
      open.push({ indent: it.indent, tag }); html += "<" + tag + ">";
    } else html += "</li>";
    html += "<li>" + inline(images(it.text));
  }
  while (open.length) html += "</li></" + open.pop().tag + ">";
  return html;
}

function table(lines) {
  const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const head = cells(lines[0]);
  const rows = lines.slice(2).map(cells);
  return "<table><thead><tr>" + head.map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>" +
    rows.map((r) => "<tr>" + r.map((c) => "<td>" + inline(images(c)) + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
}

// Upgrade the README blocks to HTML; leave everything else exactly as written.
export function upgrade(src) {
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (/^\s*```/.test(lines[i])) {                        // fenced code: copied through whole, untouched
      out.push(lines[i++]);
      while (i < lines.length && !/^\s*```/.test(lines[i])) out.push(lines[i++]);
      if (i < lines.length) out.push(lines[i++]);
      continue;
    }
    if (lines[i].trim() === "") { out.push(""); i++; continue; }
    const block = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^\s*```/.test(lines[i])) block.push(lines[i++]);

    if (block.every((l) => /^\s{0,3}>/.test(l))) {
      const inner = block.map((l) => l.replace(/^\s{0,3}>\s?/, "")).join("\n");
      out.push("<blockquote>" + render(inner).replace(/\n\s*\n/g, "\n") + "</blockquote>");
    } else if (ITEM.test(block[0]) && !RULE.test(block[0])) {
      out.push(list(block));
    } else if (block.length >= 2 && block[0].includes("|") && TABLE_SEP.test(block[1])) {
      out.push(table(block));
    } else if (block.length === 1 && RULE.test(block[0])) {
      out.push("<hr>");
    } else {
      out.push(...block.map(images));
    }
  }
  return out.join("\n");
}

export function render(src) { return renderEnough(upgrade(src)); }
