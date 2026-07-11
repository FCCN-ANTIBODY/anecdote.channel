// jekyll-enough/liquid.mjs — LIQUID-ENOUGH: a deliberately dumb template language (docs/actions-enough.md,
// the "jekyll" gap in the interpreter). NOT a Liquid mirror — a bounded subset grown in two measured
// steps: (1) what the CIVIC sites (atlas / tell / civic-node) use, so the offline origin can render their
// static shells on-device; (2) the JOURNAL engine's measured surface (capture, include params + dynamic
// names, unless/continue, where_exp, bracket lookup, the date/slug filter tail), so the same library can
// back a runtime viewer of journal source. Site-SPECIFIC filters (the journal's antibody_* family) are NOT
// here and never will be: `opts.filters` is the extension seam — a personality registers its own arcana.
//
// Supported, and no more:
//   {{ a.b.c | filter: arg, arg }}         output an expression through a filter chain
//   {{ a[b].c }} / {{ a["k"] }} / {{ a[0] }}   bracket lookup (a variable, quoted key, or index)
//   {% if EXPR %}…{% elsif %}…{% else %}…{% endif %}   truthiness + == / != / < / > , and / or
//   {% unless EXPR %}…{% else %}…{% endunless %}
//   {% for x in COLL %}…{% else %}…{% endfor %}        (forloop.*, {% continue %}, {% break %})
//   {% assign name = EXPR %}               bind a variable (template-scoped: survives loop bodies)
//   {% capture name %}…{% endcapture %}    render a fragment now, bind it to a name for reuse
//   {% include NAME k=v … %} / {% include {{ EXPR }} k=v … %} / {% include_relative PATH %}
//                                          pull a partial in; params land on `include.*`
//   {%- -%} / {{- -}}                      whitespace trim on either side
// Filters: relative_url, absolute_url, default, where, where_exp, jsonify, size, upcase, downcase,
//   first, last, join, split, append, replace, map, uniq, sort, reverse, plus, divided_by, ceil,
//   strip_html, number_of_words, slugify, date, date_to_xmlschema.
// Values: 'str' / "str" / number / true / false / nil / empty, and variable paths (dots + brackets).
//
// Failure posture (the enough-client rule): strict by default — an unknown tag/filter or a missing
// loader THROWS, which is what a build wants. Pass `opts.lenient` and the same conditions DOWNGRADE:
// the node renders as an HTML comment and is pushed onto `opts.gaps` (when given) — a named gap,
// never a silent skip and never a hard stop. A viewer of someone else's source wants that.
//
// Named divergences from real Liquid/Jekyll (deliberate): dates format in UTC (Jekyll uses the site
// timezone); an include's assigns do not leak back into the caller; uniq compares primitives only.

// ---- tokenize --------------------------------------------------------------------------------------
// Split into text / {{ output }} / {% tag %}, capturing the `-` trim markers so we can strip whitespace.
function tokenize(src) {
  const toks = [];
  const re = /\{\{-?|\{%-?/g;
  let i = 0, m;
  while ((m = re.exec(src))) {
    if (m.index > i) toks.push({ t: "text", v: src.slice(i, m.index) });
    const isTag = m[0][1] === "%";
    const ltrim = m[0].endsWith("-");
    const close = isTag ? /-?%\}/g : /-?\}\}/g;
    close.lastIndex = re.lastIndex;
    const c = close.exec(src);
    if (!c) throw new Error("liquid-enough: unclosed " + (isTag ? "{%" : "{{"));
    const rtrim = c[0].startsWith("-");
    const body = src.slice(re.lastIndex, c.index).trim();
    toks.push({ t: isTag ? "tag" : "out", v: body, ltrim, rtrim });
    i = re.lastIndex = close.lastIndex;
  }
  if (i < src.length) toks.push({ t: "text", v: src.slice(i) });
  // apply trims: an ltrim strips trailing ws of the previous text; an rtrim strips leading ws of the next.
  for (let k = 0; k < toks.length; k++) {
    const tk = toks[k];
    if ((tk.t === "tag" || tk.t === "out") && tk.ltrim && toks[k - 1]?.t === "text")
      toks[k - 1].v = toks[k - 1].v.replace(/\s+$/, "");
    if ((tk.t === "tag" || tk.t === "out") && tk.rtrim && toks[k + 1]?.t === "text")
      toks[k + 1].v = toks[k + 1].v.replace(/^\s+/, "");
  }
  return toks;
}

// ---- parse -----------------------------------------------------------------------------------------
// A flat token list → a node tree. Block tags (if/unless/for/capture) open a frame; their end tags close
// it. `opts.lenient` turns an unknown tag into a {gap} node instead of a throw.
function parse(toks, opts = {}) {
  let pos = 0;
  function block(stops) {
    const nodes = [];
    while (pos < toks.length) {
      const tk = toks[pos];
      if (tk.t === "text") { nodes.push({ n: "text", v: tk.v }); pos++; continue; }
      if (tk.t === "out") { nodes.push({ n: "out", v: tk.v }); pos++; continue; }
      const head = tk.v.split(/\s+/)[0];
      if (stops.includes(head)) return nodes;          // leave the terminator for the caller
      pos++;
      if (head === "if") {
        const branches = [{ cond: tk.v.slice(2).trim(), body: block(["elsif", "else", "endif"]) }];
        while (toks[pos] && ["elsif", "else"].includes(toks[pos].v.split(/\s+/)[0])) {
          const b = toks[pos]; pos++;
          const isElse = b.v.split(/\s+/)[0] === "else";
          branches.push({ cond: isElse ? null : b.v.slice(5).trim(), body: block(["elsif", "else", "endif"]) });
        }
        expect("endif");
        nodes.push({ n: "if", branches });
      } else if (head === "unless") {
        const body = block(["else", "endunless"]);
        let els = null;
        if (toks[pos] && toks[pos].v.split(/\s+/)[0] === "else") { pos++; els = block(["endunless"]); }
        expect("endunless");
        nodes.push({ n: "unless", cond: tk.v.slice(6).trim(), body, els });
      } else if (head === "for") {
        const mm = /^for\s+(\w+)\s+in\s+(.+)$/.exec(tk.v);
        if (!mm) throw new Error("liquid-enough: bad for: " + tk.v);
        const body = block(["else", "endfor"]);
        let empty = null;
        if (toks[pos] && toks[pos].v.split(/\s+/)[0] === "else") { pos++; empty = block(["endfor"]); }
        expect("endfor");
        nodes.push({ n: "for", name: mm[1], expr: mm[2].trim(), body, empty });
      } else if (head === "assign") {
        const mm = /^assign\s+(\w+)\s*=\s*(.+)$/s.exec(tk.v);
        if (!mm) throw new Error("liquid-enough: bad assign: " + tk.v);
        nodes.push({ n: "assign", name: mm[1], expr: mm[2].trim() });
      } else if (head === "capture") {
        const mm = /^capture\s+(\w+)$/.exec(tk.v);
        if (!mm) throw new Error("liquid-enough: bad capture: " + tk.v);
        const body = block(["endcapture"]); expect("endcapture");
        nodes.push({ n: "capture", name: mm[1], body });
      } else if (head === "include" || head === "include_relative") {
        nodes.push({ n: head, ...parseIncludeArg(tk.v.slice(head.length)) });
      } else if (head === "continue" || head === "break") {
        nodes.push({ n: head });
      } else if (head === "comment") {                 // tolerate & drop a bare {% comment %}…{% endcomment %}
        block(["endcomment"]); expect("endcomment");
      } else if (opts.lenient) {
        nodes.push({ n: "gap", what: "tag {% " + head + " %}" });
      } else {
        throw new Error("liquid-enough: unsupported tag {% " + head + " %}");
      }
    }
    if (stops.length) throw new Error("liquid-enough: missing {% " + stops.join("/") + " %}");
    return nodes;
  }
  function expect(tag) {
    if (!toks[pos] || toks[pos].v.split(/\s+/)[0] !== tag) throw new Error("liquid-enough: expected {% " + tag + " %}");
    pos++;
  }
  return block([]);
}

// {% include NAME k=v k="lit" %} — NAME is a bare path, or {{ EXPR }} resolved at render (the journal's
// contact pattern). Params may span lines (the journal's iframe.html includes do).
function parseIncludeArg(raw) {
  let rest = raw.trim(), dyn = null, name = null;
  if (rest.startsWith("{{")) {
    const e = rest.indexOf("}}");
    if (e < 0) throw new Error("liquid-enough: unclosed {{ in include name");
    dyn = rest.slice(2, e).trim(); rest = rest.slice(e + 2);
  } else {
    const m = /^\S+/.exec(rest);
    name = m ? m[0] : ""; rest = rest.slice(rest.indexOf(name) + name.length);
  }
  const params = [];
  const re = /([\w-]+)=("[^"]*"|'[^']*'|\S+)/g;
  let m2; while ((m2 = re.exec(rest))) params.push([m2[1], m2[2]]);
  return { dyn, name, params };
}

// ---- evaluate --------------------------------------------------------------------------------------
const truthy = (v) => !(v === undefined || v === null || v === false);

// a variable path is dotted segments and bracket accesses: site.data.git[kind]["k"].first
function segments(path) {
  const segs = []; let i = 0, buf = "";
  while (i < path.length) {
    const c = path[i];
    if (c === ".") { if (buf) { segs.push(buf); buf = ""; } i++; }
    else if (c === "[") {
      if (buf) { segs.push(buf); buf = ""; }
      let depth = 1, j = i + 1, q = null;
      while (j < path.length && depth) {
        const d = path[j];
        if (q) { if (d === q) q = null; }
        else if (d === '"' || d === "'") q = d;
        else if (d === "[") depth++;
        else if (d === "]") depth--;
        j++;
      }
      segs.push({ bracket: path.slice(i + 1, j - 1).trim() }); i = j;
    } else { buf += c; i++; }
  }
  if (buf) segs.push(buf);
  return segs;
}

function lookup(path, ctx) {
  if (path === "nil" || path === "null" || path === "empty" || path === "blank") return null;
  if (path === "true") return true;
  if (path === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
  const q = path[0];
  if ((q === '"' || q === "'") && path.endsWith(q)) return path.slice(1, -1);
  let cur = ctx;
  for (const seg of segments(path)) {
    if (cur == null) return null;
    if (typeof seg === "object") {                    // [EXPR] — a literal or a variable, resolved here
      const key = lookup(seg.bracket, ctx);
      cur = key == null ? null : cur[key];
      continue;
    }
    // Liquid pseudo-properties: .size / .first / .last on arrays & strings (and .size on hashes).
    if (!(seg in Object(cur))) {
      if (Array.isArray(cur) || typeof cur === "string") {
        if (seg === "size") { cur = cur.length; continue; }
        if (seg === "first") { cur = cur[0]; continue; }
        if (seg === "last") { cur = cur[cur.length - 1]; continue; }
      } else if (typeof cur === "object" && seg === "size") { cur = Object.keys(cur).length; continue; }
    }
    cur = cur[seg];
  }
  return cur === undefined ? null : cur;
}

// split on a delimiter that is not inside quotes
function splitTop(str, delim) {
  const out = []; let buf = "", q = null;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (q) { buf += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; buf += c; continue; }
    if (str.startsWith(delim, i)) {
      out.push(buf); buf = ""; i += delim.length - 1; continue;
    }
    buf += c;
  }
  out.push(buf);
  return out;
}

// ---- dates (UTC, deterministic — Jekyll's site-timezone rendering is a named divergence) -------------
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = (n, w = 2, c = "0") => String(n).padStart(w, c);

function toDate(v) {
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === "number") return new Date(v * 1000);                       // unix seconds, Liquid-style
  if (typeof v === "string" && /^\d{10,13}$/.test(v.trim())) {
    const n = Number(v.trim()); return new Date(v.trim().length > 10 ? n : n * 1000);
  }
  const d = new Date(String(v));
  return isNaN(d) ? null : d;
}

// ISO 8601 week date (the journal's %G-W%V): shift to the nearest Thursday; that Thursday's year is the
// ISO year, and the week counts Mondays from the week containing that year's Jan 4.
function isoWeekParts(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7));
  const isoYear = t.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const week1Mon = new Date(jan4); week1Mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  return { isoYear, week: 1 + Math.floor((t - week1Mon) / (7 * 86400000)) };
}

// The strftime subset the sites use (%G / %V / %B / %-d measured in the journal) + the common basics.
// An unknown directive passes through verbatim — visible in output, never a crash.
function strftime(d, fmt) {
  return String(fmt).replace(/%(-?)([A-Za-z%])/g, (whole, dash, ch) => {
    switch (ch) {
      case "Y": return String(d.getUTCFullYear());
      case "y": return pad(d.getUTCFullYear() % 100);
      case "G": return String(isoWeekParts(d).isoYear);
      case "V": return pad(isoWeekParts(d).week);
      case "m": return dash ? String(d.getUTCMonth() + 1) : pad(d.getUTCMonth() + 1);
      case "d": return dash ? String(d.getUTCDate()) : pad(d.getUTCDate());
      case "e": return pad(d.getUTCDate(), 2, " ");
      case "B": return MONTHS[d.getUTCMonth()];
      case "b": case "h": return MONTHS[d.getUTCMonth()].slice(0, 3);
      case "A": return DAYS[d.getUTCDay()];
      case "a": return DAYS[d.getUTCDay()].slice(0, 3);
      case "H": return dash ? String(d.getUTCHours()) : pad(d.getUTCHours());
      case "M": return pad(d.getUTCMinutes());
      case "S": return pad(d.getUTCSeconds());
      case "j": return pad(Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000), 3);
      case "s": return String(Math.floor(d.getTime() / 1000));
      case "%": return "%";
      default:  return whole;
    }
  });
}

const FILTERS = {
  relative_url: (v, _a, ctx) => joinUrl(ctx.site?.baseurl || "", v),
  absolute_url: (v, _a, ctx) => joinUrl(ctx.site?.url || "", joinUrl(ctx.site?.baseurl || "", v)),
  default: (v, [d]) => (v === undefined || v === null || v === false || v === "") ? d : v,
  where: (v, [k, val]) => Array.isArray(v) ? v.filter((o) => o && o[k] == val) : [],
  // where_exp: the expression stays a string ("p.author == author") and runs through evalCond with the
  // named variable bound over the caller's scope — the same tiny grammar, no new evaluator.
  where_exp: (v, [name, expr], ctx) => Array.isArray(v)
    ? v.filter((item) => { const s = Object.create(ctx); s[name] = item; return evalCond(String(expr), s); })
    : [],
  jsonify: (v) => JSON.stringify(v),
  size: (v) => (v == null ? 0 : (v.length ?? Object.keys(v).length ?? 0)),
  upcase: (v) => String(v ?? "").toUpperCase(),
  downcase: (v) => String(v ?? "").toLowerCase(),
  first: (v) => Array.isArray(v) ? v[0] : (v == null ? null : String(v)[0]),
  last: (v) => Array.isArray(v) ? v[v.length - 1] : null,
  join: (v, [sep]) => Array.isArray(v) ? v.join(sep ?? " ") : v,
  split: (v, [sep]) => v == null ? [] : String(v).split(sep ?? " "),
  append: (v, [s]) => String(v ?? "") + String(s ?? ""),
  replace: (v, [a, b]) => String(v ?? "").split(String(a)).join(String(b ?? "")),
  map: (v, [k]) => Array.isArray(v) ? v.map((o) => (o == null || o[k] === undefined) ? null : o[k]) : [],
  uniq: (v) => { if (!Array.isArray(v)) return v; const out = []; for (const x of v) if (!out.includes(x)) out.push(x); return out; },
  sort: (v, [k]) => Array.isArray(v)
    ? [...v].sort((a, b) => { const x = k == null ? a : a?.[k], y = k == null ? b : b?.[k]; return x == y ? 0 : (x < y ? -1 : 1); })
    : v,
  reverse: (v) => Array.isArray(v) ? [...v].reverse() : v,
  plus: (v, [n]) => Number(v) + Number(n),
  // Ruby semantics: integer ÷ integer floors (the journal's reading-time line depends on it).
  divided_by: (v, [n]) => { const a = Number(v), b = Number(n); return (Number.isInteger(a) && Number.isInteger(b) && b !== 0) ? Math.floor(a / b) : a / b; },
  ceil: (v) => Math.ceil(Number(v)),
  strip_html: (v) => String(v ?? "")
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "").replace(/<style[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, ""),
  number_of_words: (v) => { const s = String(v ?? "").trim(); return s ? s.split(/\s+/).length : 0; },
  slugify: (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
  date: (v, [fmt]) => { const d = toDate(v); return d ? strftime(d, fmt ?? "%Y-%m-%d") : v; },
  date_to_xmlschema: (v) => {
    const d = toDate(v); if (!d) return v;
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`;
  },
};

function joinUrl(base, path) {
  const b = String(base || "").replace(/\/$/, "");
  const p = String(path == null ? "" : path);
  return b + (p.startsWith("/") ? p : "/" + p);
}

// value expression: a base operand piped through filters — {{ base | f: a, b | g }}
// `opts.filters` is the personality seam: a site-specific filter (journal's antibody_*) resolves there
// first; the library set stays generic. Unknown filter: throw, or (lenient) gap + pass the value through.
function evalValue(expr, ctx, opts = {}) {
  const parts = splitTop(expr, "|").map((s) => s.trim());
  let v = lookup(parts[0], ctx);
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const ci = seg.indexOf(":");
    const name = (ci < 0 ? seg : seg.slice(0, ci)).trim();
    const args = ci < 0 ? [] : splitTop(seg.slice(ci + 1), ",").map((a) => lookup(a.trim(), ctx));
    const f = (opts.filters && opts.filters[name]) || FILTERS[name];
    if (!f) {
      if (opts.lenient) { opts.gaps?.push("filter " + name); continue; }
      throw new Error("liquid-enough: unknown filter " + name);
    }
    v = f(v, args, ctx, opts);
  }
  return v;
}

// condition: truthiness, == / != / < / > / <= / >= , chained with and / or (or lowest precedence).
function evalCond(expr, ctx) {
  const ors = splitTop(expr, " or ");
  if (ors.length > 1) return ors.some((o) => evalCond(o.trim(), ctx));
  const ands = splitTop(expr, " and ");
  if (ands.length > 1) return ands.every((a) => evalCond(a.trim(), ctx));
  const cmp = /^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/.exec(expr);
  if (cmp) {
    const a = lookup(cmp[1].trim(), ctx), b = lookup(cmp[3].trim(), ctx);
    switch (cmp[2]) {
      case "==": return a == b;
      case "!=": return a != b;
      case ">":  return Number(a) >  Number(b);
      case "<":  return Number(a) <  Number(b);
      case ">=": return Number(a) >= Number(b);
      case "<=": return Number(a) <= Number(b);
    }
  }
  return truthy(lookup(expr.trim(), ctx));
}

// ---- render ----------------------------------------------------------------------------------------
// st carries render state that must NOT reset per recursion: `root` is the template scope every assign and
// capture writes to (so an assign inside a for-loop body survives the loop — real Liquid semantics; the
// loop scope is only for the loop variable), and `flow` carries a continue/break signal upward while each
// level keeps the output it already produced.
function renderNodes(nodes, ctx, opts, st) {
  let out = "";
  for (const nd of nodes) {
    if (st.flow.sig) break;
    if (nd.n === "text") out += nd.v;
    else if (nd.n === "out") { const v = evalValue(nd.v, ctx, opts); out += v == null ? "" : String(v); }
    else if (nd.n === "assign") st.root[nd.name] = evalValue(nd.expr, ctx, opts);
    else if (nd.n === "capture") st.root[nd.name] = renderNodes(nd.body, ctx, opts, st);
    else if (nd.n === "if") {
      for (const br of nd.branches) {
        if (br.cond === null || evalCond(br.cond, ctx)) { out += renderNodes(br.body, ctx, opts, st); break; }
      }
    } else if (nd.n === "unless") {
      out += renderNodes(evalCond(nd.cond, ctx) ? (nd.els || []) : nd.body, ctx, opts, st);
    } else if (nd.n === "continue" || nd.n === "break") {
      st.flow.sig = nd.n;                          // bubbles up; the nearest for-loop consumes it
    } else if (nd.n === "for") {
      const coll = evalValue(nd.expr, ctx, opts);
      const arr = Array.isArray(coll) ? coll : (coll && typeof coll === "object" ? Object.values(coll) : []);
      if (!arr.length && nd.empty) { out += renderNodes(nd.empty, ctx, opts, st); continue; }
      for (let idx = 0; idx < arr.length; idx++) {
        const scope = Object.create(ctx);          // child scope: loop var + forloop, parent visible
        scope[nd.name] = arr[idx];
        scope.forloop = { index: idx + 1, index0: idx, first: idx === 0, last: idx === arr.length - 1, length: arr.length };
        out += renderNodes(nd.body, scope, opts, st);
        if (st.flow.sig === "continue") st.flow.sig = null;
        else if (st.flow.sig === "break") { st.flow.sig = null; break; }
      }
    } else if (nd.n === "include" || nd.n === "include_relative") {
      const loader = nd.n === "include" ? opts.include : opts.includeRelative;
      if (!loader) {
        if (opts.lenient) { opts.gaps?.push("no loader for {% " + nd.n + " %}"); out += "<!-- liquid-enough gap: " + nd.n + " -->"; continue; }
        throw new Error("liquid-enough: {% " + nd.n + " %} used but no loader given");
      }
      const name = nd.dyn != null ? String(evalValue(nd.dyn, ctx, opts) ?? "").trim() : nd.name;
      // params evaluate in the CALLER's scope and land on a fresh `include` object — Jekyll's rule: each
      // include tag gets its own include.*, an inner include never sees an outer one's params.
      const c2 = Object.create(ctx);
      c2.include = {};
      for (const [k, vexpr] of nd.params) c2.include[k] = lookup(vexpr, ctx);
      out += loader(name, c2);
    } else if (nd.n === "gap") {
      opts.gaps?.push(nd.what);
      out += "<!-- liquid-enough gap: " + nd.what + " -->";
    }
  }
  return out;
}

// ---- public ----------------------------------------------------------------------------------------
export function parseTemplate(src, opts = {}) { return parse(tokenize(src), opts); }

// Render a template string against a context. `opts.include` / `opts.includeRelative` resolve partials;
// each is called with (name, ctx) and must return already-rendered HTML (recurse through render() yourself).
// `opts.filters` adds/overrides filters (the personality seam); `opts.lenient` downgrades unknown
// tags/filters and missing loaders to named gaps (collected on `opts.gaps` when it is an array).
export function render(src, ctx = {}, opts = {}) {
  const root = Object.create(ctx);                 // the template scope: assigns/captures land here,
  return renderNodes(parseTemplate(src, opts), root, opts, { root, flow: { sig: null } }); // the caller's ctx stays clean
}

export { FILTERS, evalValue, evalCond };
