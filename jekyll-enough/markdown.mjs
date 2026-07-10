// jekyll-enough/markdown.mjs - MARKDOWN-ENOUGH: a deliberately dumb markdown to HTML pass, the second half
// of rendering a civic page (Liquid runs first, this runs on the resulting body). NOT CommonMark - only
// what the civic .md pages actually use: an ATX heading, paragraphs, inline (code / links / bold / italic),
// a fenced code block, and - crucially - RAW HTML BLOCKS PASS THROUGH VERBATIM (the <ul>/<div>/<script>
// that the Liquid loops expand into). No lists, tables, blockquotes, or images: a plain-text website is a
// success (docs/actions-enough.md). Kramdown's default is block-HTML passthrough; we keep that, little else.

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SEP = "\uE000"; // private-use sentinel: cannot occur in markdown source, so shielded spans never collide

// ---- inline: code spans, then links (whose text may hold a code span), then bold, then italic. ---------
export function inline(text) {
  const holds = [];
  const stash = (html) => { holds.push(html); return SEP + (holds.length - 1) + SEP; };
  // 1. code spans first, so their contents are shielded from link/bold/italic and get escaped.
  let s = text.replace(/`([^`]+)`/g, (_, c) => stash(`<code>${esc(c)}</code>`));
  // 2. links - the text half may already contain a stashed code span.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => `<a href="${href}">${t}</a>`);
  // 3. bold before italic so ** is not eaten by the single-* rule.
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>").replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, "$1<em>$2</em>");
  return s.replace(new RegExp(SEP + "(\\d+)" + SEP, "g"), (_, i) => holds[+i]);
}

// ---- blocks: split on blank lines, but keep fenced code and multi-line raw-HTML blocks intact. ----------
export function render(src) {
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  const blank = (l) => l.trim() === "";
  while (i < lines.length) {
    if (blank(lines[i])) { i++; continue; }

    // fenced code block: ``` ... ``` (contents escaped, verbatim otherwise)
    if (/^```/.test(lines[i].trim())) {
      i++; const buf = [];
      while (i < lines.length && !/^```/.test(lines[i].trim())) buf.push(lines[i++]);
      i++; // closing fence
      out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // raw HTML block: a line that begins with '<' - pass the whole block through until a blank line.
    if (lines[i].trimStart().startsWith("<")) {
      const buf = [];
      while (i < lines.length && !blank(lines[i])) buf.push(lines[i++]);
      out.push(buf.join("\n"));
      continue;
    }

    // ATX heading: #..###### on a single line.
    const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2].trim())}</h${h[1].length}>`); i++; continue; }

    // paragraph: consecutive text lines until a blank line or the start of a special block.
    const buf = [];
    while (i < lines.length && !blank(lines[i]) && !/^```/.test(lines[i].trim())
           && !lines[i].trimStart().startsWith("<") && !/^#{1,6}\s/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    out.push(`<p>${inline(buf.join("\n"))}</p>`);
  }
  return out.join("\n");
}
