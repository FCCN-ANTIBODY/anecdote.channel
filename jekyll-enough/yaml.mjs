// jekyll-enough/yaml.mjs - YAML-ENOUGH: a deliberately dumb YAML reader for the two YAML shapes Jekyll
// actually hands us (docs/actions-enough.md): page/site front matter + _config.yml (a mapping), and the
// _data/*.yml registries (a sequence of flat maps). NOT a YAML engine - the civic files were measured and
// use none of the hard parts: no anchors/aliases, no multi-doc, no tags. Supported: 2-space-indented
// mappings and sequences, scalars (quoted / bare / number / bool / null), SINGLE-LINE flow collections
// ([a, b] and {k: v}), a trailing "# comment" (quote-aware), and folded/literal block scalars (>, >-, |,
// |-) which _config's description uses. Everything else is out of scope by design.
//
// Flow collections were once out of scope, on a measurement that turned out to be short. The journal
// engine's `defaults:` writes its scope inline - `- scope: {path: "journal"}` - and a mounted piece writes
// `tags: [a, b]`. Read as strings those do not fail loudly: `defaults` silently stops matching and every
// cited page loses its layout, while tags quietly become one long tag. Both are the blank-page class of
// failure this renderer exists to prevent, so the reader grew to meet them. Still single-line only: a flow
// collection spanning lines is not something the civic files do.

// strip a trailing "# comment" that is not inside quotes; a line that is only a comment becomes "".
function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).replace(/\s+$/, "");
  }
  return line.replace(/\s+$/, "");
}

const indentOf = (l) => l.length - l.trimStart().length;

// Split the inside of a flow collection on its TOP-LEVEL commas, respecting quotes and nesting, so
// `{a: 1, b: [2, 3]}` and `["x, y", z]` both come apart where they should.
function splitFlow(inner) {
  const parts = [];
  let depth = 0, quote = null, cur = "";
  for (const c of inner) {
    if (quote) { cur += c; if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim() !== "") parts.push(cur);
  return parts;
}

function scalar(tok) {
  const t = tok.trim();
  if (t === "" || t === "~" || t === "null") return null;
  if (t === "[]") return [];
  if (t === "{}") return {};
  // single-line flow collections; the elements go back through scalar(), so they nest.
  if (t.startsWith("[") && t.endsWith("]")) return splitFlow(t.slice(1, -1)).map(scalar);
  if (t.startsWith("{") && t.endsWith("}")) {
    const map = {};
    for (const part of splitFlow(t.slice(1, -1))) {
      const ci = part.indexOf(":");
      if (ci < 0) continue;
      map[part.slice(0, ci).trim().replace(/^["']|["']$/g, "")] = scalar(part.slice(ci + 1));
    }
    return map;
  }
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d*\.\d+$/.test(t)) return parseFloat(t);
  const q = t[0];
  if ((q === '"' || q === "'") && t[t.length - 1] === q) return t.slice(1, -1);
  return t;
}

export function parse(src) {
  // Keep raw lines (indentation preserved); drop comment-only/blank lines EXCEPT while a block scalar is
  // collecting (handled inline below, which reads ahead over the raw array).
  const raw = String(src).replace(/\r\n?/g, "\n").split("\n");
  // pre-strip trailing comments but keep the line array aligned (blank/comment -> "")
  const lines = raw.map((l) => (l.trim().startsWith("#") ? "" : stripComment(l)));

  let i = 0;
  const nextContentIndent = (from) => {
    for (let k = from; k < lines.length; k++) if (lines[k].trim() !== "") return indentOf(lines[k]);
    return -1;
  };

  // collect a block scalar: all following lines indented deeper than `parentIndent`, dedented + joined.
  function blockScalar(marker, parentIndent) {
    const fold = marker[0] === ">";
    const chomp = marker.includes("-") ? "strip" : "clip";
    const body = [];
    let base = null;
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() === "") { body.push(""); i++; continue; }
      const ind = indentOf(l);
      if (ind <= parentIndent) break;
      if (base === null) base = ind;
      body.push(l.slice(base));
      i++;
    }
    while (body.length && body[body.length - 1] === "") body.pop();
    let text = fold ? body.join(" ").replace(/\s+/g, " ").trim() : body.join("\n");
    if (chomp === "clip" && !fold) text += "\n";
    return text;
  }

  // parse a node at exactly `indent`: a sequence (lines start with "- ") or a mapping ("key: ...").
  function node(indent) {
    // skip leading blanks
    while (i < lines.length && lines[i].trim() === "") i++;
    if (i >= lines.length) return null;
    const first = lines[i];
    return /^-(\s|$)/.test(first.trim()) ? sequence(indent) : mapping(indent);
  }

  function sequence(indent) {
    const arr = [];
    while (i < lines.length) {
      if (lines[i].trim() === "") { i++; continue; }
      if (indentOf(lines[i]) !== indent || !/^-(\s|$)/.test(lines[i].trim())) break;
      const after = lines[i].trim().replace(/^-\s*/, "");
      if (after === "") {                       // "- " then a nested block on deeper lines
        i++;
        arr.push(node(nextContentIndent(i)));
      } else if (/^[^:\s][^:]*:(\s|$)/.test(after) || /:\s/.test(after)) {
        // "- key: val" : a map item. Rewrite the dash to spaces so the mapping parser sees aligned keys.
        const keyCol = indentOf(lines[i]) + (lines[i].trim().length - after.length);
        lines[i] = " ".repeat(keyCol) + after;
        arr.push(mapping(keyCol));
      } else {                                  // "- scalar"
        arr.push(scalar(after));
        i++;
      }
    }
    return arr;
  }

  function mapping(indent) {
    const map = {};
    while (i < lines.length) {
      if (lines[i].trim() === "") { i++; continue; }
      const ind = indentOf(lines[i]);
      if (ind !== indent || /^-(\s|$)/.test(lines[i].trim())) break;
      const line = lines[i].trim();
      const ci = line.indexOf(":");
      if (ci < 0) break;
      const key = line.slice(0, ci).trim().replace(/^["']|["']$/g, "");
      let rest = line.slice(ci + 1).trim();
      i++;
      if (rest === "" ) {
        const childIndent = nextContentIndent(i);
        if (childIndent > indent) map[key] = node(childIndent);
        else map[key] = null;                   // an empty key with no children
      } else if (/^[>|][+-]?$/.test(rest)) {
        map[key] = blockScalar(rest, indent);
      } else {
        map[key] = scalar(rest);
      }
    }
    return map;
  }

  const result = node(nextContentIndent(0) < 0 ? 0 : nextContentIndent(0));
  return result === null ? {} : result;
}

// Split a page's leading front matter from its body. Returns { data, body }. No front matter -> {}, whole.
export function frontMatter(src) {
  const s = String(src).replace(/\r\n?/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(s);
  if (!m) return { data: {}, body: s };
  return { data: parse(m[1]) || {}, body: s.slice(m[0].length) };
}
