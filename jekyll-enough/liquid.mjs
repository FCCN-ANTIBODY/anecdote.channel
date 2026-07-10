// jekyll-enough/liquid.mjs — LIQUID-ENOUGH: a deliberately dumb template language (docs/actions-enough.md,
// the "jekyll" gap in the interpreter). NOT a Liquid mirror — just the bounded subset the CIVIC sites
// (atlas / tell / civic-node) actually use, so the offline origin can render their static shells on-device
// and push the HTML down. The heavy blog (journal: capture/comment/dozens of includes) stays on real
// Jekyll; we do not chase it. The objective is only HTML files — a plain-text website is a success.
//
// Supported, and no more:
//   {{ a.b.c | filter: arg, arg }}         output an expression through a filter chain
//   {% if EXPR %}…{% else %}…{% endif %}   truthiness + == / != , chained with and / or
//   {% for x in COLL %}…{% endfor %}       iterate an array (forloop.index/first/last available)
//   {% assign name = EXPR %}               bind a variable (filters allowed on the RHS)
//   {% include NAME %} / {% include_relative PATH %}   pull a partial in with the current scope
//   {%- -%} / {{- -}}                      whitespace trim on either side
// Filters: relative_url, absolute_url, default, where, jsonify, size, upcase, downcase, first, last, join.
// Values: 'str' / "str" / number / true / false / nil / empty, and dotted variable paths.

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
// A flat token list → a node tree. Block tags (if/for) open a frame; endif/endfor/else close or split it.
function parse(toks) {
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
      } else if (head === "for") {
        const mm = /^for\s+(\w+)\s+in\s+(.+)$/.exec(tk.v);
        if (!mm) throw new Error("liquid-enough: bad for: " + tk.v);
        const body = block(["else", "endfor"]);
        let empty = null;
        if (toks[pos] && toks[pos].v.split(/\s+/)[0] === "else") { pos++; empty = block(["endfor"]); }
        expect("endfor");
        nodes.push({ n: "for", name: mm[1], expr: mm[2].trim(), body, empty });
      } else if (head === "assign") {
        const mm = /^assign\s+(\w+)\s*=\s*(.+)$/.exec(tk.v);
        if (!mm) throw new Error("liquid-enough: bad assign: " + tk.v);
        nodes.push({ n: "assign", name: mm[1], expr: mm[2].trim() });
      } else if (head === "include" || head === "include_relative") {
        nodes.push({ n: head, arg: tk.v.slice(head.length).trim() });
      } else if (head === "comment") {                 // tolerate & drop a bare {% comment %}…{% endcomment %}
        block(["endcomment"]); expect("endcomment");
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

// ---- evaluate --------------------------------------------------------------------------------------
const truthy = (v) => !(v === undefined || v === null || v === false);

function lookup(path, ctx) {
  if (path === "nil" || path === "null" || path === "empty" || path === "blank") return null;
  if (path === "true") return true;
  if (path === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
  const q = path[0];
  if ((q === '"' || q === "'") && path.endsWith(q)) return path.slice(1, -1);
  let cur = ctx;
  for (const seg of path.split(".")) {
    if (cur == null) return null;
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
    if (str.startsWith(delim, i) && (delim.length > 1 || true)) {
      if (delim === "|" && str[i + 1] === "|") { buf += c; continue; } // (defensive; liquid has no ||)
      out.push(buf); buf = ""; i += delim.length - 1; continue;
    }
    buf += c;
  }
  out.push(buf);
  return out;
}

const FILTERS = {
  relative_url: (v, _a, ctx) => joinUrl(ctx.site?.baseurl || "", v),
  absolute_url: (v, _a, ctx) => joinUrl(ctx.site?.url || "", joinUrl(ctx.site?.baseurl || "", v)),
  default: (v, [d]) => (v === undefined || v === null || v === false || v === "") ? d : v,
  where: (v, [k, val]) => Array.isArray(v) ? v.filter((o) => o && o[k] == val) : [],
  jsonify: (v) => JSON.stringify(v),
  size: (v) => (v == null ? 0 : (v.length ?? Object.keys(v).length ?? 0)),
  upcase: (v) => String(v ?? "").toUpperCase(),
  downcase: (v) => String(v ?? "").toLowerCase(),
  first: (v) => Array.isArray(v) ? v[0] : (v == null ? null : String(v)[0]),
  last: (v) => Array.isArray(v) ? v[v.length - 1] : null,
  join: (v, [sep]) => Array.isArray(v) ? v.join(sep ?? " ") : v,
};

function joinUrl(base, path) {
  const b = String(base || "").replace(/\/$/, "");
  const p = String(path == null ? "" : path);
  return b + (p.startsWith("/") ? p : "/" + p);
}

// value expression: a base operand piped through filters — {{ base | f: a, b | g }}
function evalValue(expr, ctx) {
  const parts = splitTop(expr, "|").map((s) => s.trim());
  let v = lookup(parts[0], ctx);
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const ci = seg.indexOf(":");
    const name = (ci < 0 ? seg : seg.slice(0, ci)).trim();
    const args = ci < 0 ? [] : splitTop(seg.slice(ci + 1), ",").map((a) => lookup(a.trim(), ctx));
    const f = FILTERS[name];
    if (!f) throw new Error("liquid-enough: unknown filter " + name);
    v = f(v, args, ctx);
  }
  return v;
}

// condition: truthiness, == / != , chained with and / or (or lowest precedence).
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
// opts.include(name, ctx) → string for {% include %}; opts.includeRelative(path, ctx) for the relative form.
function renderNodes(nodes, ctx, opts) {
  let out = "";
  for (const nd of nodes) {
    if (nd.n === "text") out += nd.v;
    else if (nd.n === "out") { const v = evalValue(nd.v, ctx); out += v == null ? "" : String(v); }
    else if (nd.n === "assign") ctx[nd.name] = evalValue(nd.expr, ctx);
    else if (nd.n === "if") {
      for (const br of nd.branches) {
        if (br.cond === null || evalCond(br.cond, ctx)) { out += renderNodes(br.body, ctx, opts); break; }
      }
    } else if (nd.n === "for") {
      const coll = evalValue(nd.expr, ctx);
      const arr = Array.isArray(coll) ? coll : (coll && typeof coll === "object" ? Object.values(coll) : []);
      if (!arr.length && nd.empty) { out += renderNodes(nd.empty, ctx, opts); continue; }
      arr.forEach((item, idx) => {
        const scope = Object.create(ctx);          // child scope: loop var + forloop, parent visible
        scope[nd.name] = item;
        scope.forloop = { index: idx + 1, index0: idx, first: idx === 0, last: idx === arr.length - 1, length: arr.length };
        out += renderNodes(nd.body, scope, opts);
      });
    } else if (nd.n === "include") {
      if (!opts.include) throw new Error("liquid-enough: {% include %} used but no include loader given");
      out += opts.include(nd.arg, ctx);
    } else if (nd.n === "include_relative") {
      if (!opts.includeRelative) throw new Error("liquid-enough: {% include_relative %} used but no loader given");
      out += opts.includeRelative(nd.arg, ctx);
    }
  }
  return out;
}

// ---- public ----------------------------------------------------------------------------------------
export function parseTemplate(src) { return parse(tokenize(src)); }

// Render a template string against a context. `opts.include` / `opts.includeRelative` resolve partials;
// each is called with (name, ctx) and must return already-rendered HTML (recurse through render() yourself).
export function render(src, ctx = {}, opts = {}) {
  return renderNodes(parseTemplate(src), ctx, opts);
}

export { FILTERS, evalValue, evalCond };
