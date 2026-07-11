// jekyll-enough/build.mjs - THE BUILD (docs/actions-enough.md, closing the "jekyll" gap). This is the
// Jekyll build ALGORITHM, not a fixed toolchain: front matter + _config -> the site/page model, _data/**
// -> site.data, each page rendered (template, then a doc-render for .md, then wrapped up its layout chain),
// pretty permalinks -> a _site tree. It operates on an IN-MEMORY tree (path -> content) so git-enough can
// hand it a held tree and take the built _site straight to send-pack - the offline origin runs Publish and
// deploys, no runner. The faithfulness bar is OUTPUT-EQUIVALENCE with real Jekyll for the civic subset:
// swap real Jekyll <-> jekyll-enough and the served site is the same.
//
// SWITCHABILITY: the seams are injectable plugs, defaulting to the dumb offline readers. Keep the
// orchestration, swap a reader - real kramdown on the doc-render seam, _data as JSON, a real templater -
// without touching the builder. Two more seams pass STRAIGHT THROUGH to the template plug: `filters` (a
// site's own arcana - the journal's antibody_* family - registers here, never in the library) and
// `lenient`/`gaps` (strict throws for a build; lenient downgrades an unknown tag/filter/missing include to
// a named gap, for a viewer of someone else's source). That freedom of movement is the point.
//
// Deliberately partial, matching the civic sites (measured): pages are files WITH front matter; everything
// else not excluded is copied verbatim (assets, seed JSON). No collections, no sass, no pagination, no
// plugins - atlas reflects its pile maps client-side at runtime, so the static shell is pure template+data.

import { parse as parseYamlDefault } from "./yaml.mjs";
import { render as renderTemplateDefault } from "./liquid.mjs";
import { render as renderMarkdownDefault } from "./markdown.mjs";

const SPECIAL = ["_layouts/", "_includes/", "_data/", "_plugins/", "_site/", "_sass/"];
const dirOf = (p) => { const i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); };
const isPage = (p) => /\.(md|markdown|html)$/.test(p);
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

// split a page's leading front matter fence from its body. { fmText: raw yaml | null, body }.
function splitFront(src) {
  const m = FM_RE.exec(src);
  return m ? { fmText: m[1], body: src.slice(m[0].length) } : { fmText: null, body: src };
}

// exclude test: an entry matches a path exactly, or (if it ends with "/") as a directory prefix.
function excluded(path, list) {
  for (const e of list || []) {
    if (e === path) return true;
    if (e.endsWith("/") && path.startsWith(e)) return true;
    if (!e.endsWith("/") && path.startsWith(e + "/")) return true;   // "bin" also covers "bin/x"
  }
  return false;
}

// Where a rendered page lands. Explicit permalink wins (pretty "/tells/" -> tells/index.html); otherwise
// index.* -> index.html, and with `permalink: pretty` a non-index page foo.md -> foo/index.html.
function outputPath(srcPath, pageData, prettyDefault) {
  const pl = pageData.permalink;
  if (pl) {
    const p = pl.replace(/^\//, "");
    if (p === "") return "index.html";
    if (p.endsWith("/")) return p + "index.html";
    if (/\.html?$/.test(p)) return p;
    return p + "/index.html";
  }
  const base = srcPath.replace(/\.(md|markdown|html)$/, "");
  const name = base.split("/").pop();
  if (name === "index") return base + ".html";
  return prettyDefault ? base + "/index.html" : base + ".html";
}

// The URL a built page is served at (Jekyll page.url): "/" for the root, "/tells/" for a pretty dir,
// "/foo.html" for a flat file.
function urlOf(out) {
  if (out === "index.html") return "/";
  if (out.endsWith("/index.html")) return "/" + out.slice(0, -"index.html".length);
  return "/" + out;
}

// Render one page body through the template seam (+ doc-render for .md) then wrap it up its layout chain.
// `plugs` = { renderTemplate, renderMarkdown, parseYaml }; `tpl` = the template-seam pass-through options
// { filters, lenient, gaps }. Include loaders + the pass-through options travel together so a nested
// include still sees the personality filters and the lenient posture.
function renderPage(srcPath, body, isMd, ctx, tree, plugs, tpl) {
  const { renderTemplate, renderMarkdown } = plugs;
  const tplOpts = { ...tpl };
  const load = (key, c) => {
    if (!(key in tree)) {
      if (tplOpts.lenient) { tplOpts.gaps?.push("include " + key); return "<!-- jekyll-enough gap: missing " + key + " -->"; }
      throw new Error("jekyll-enough: missing include " + key);
    }
    return renderTemplate(splitFront(tree[key]).body, c, tplOpts);
  };
  tplOpts.include = (name, c) => load("_includes/" + name.trim(), c);
  tplOpts.includeRelative = (rel, c) => load((dirOf(srcPath) ? dirOf(srcPath) + "/" : "") + rel.trim(), c);

  let out = renderTemplate(body, ctx, tplOpts);
  if (isMd) out = renderMarkdown(out);

  // wrap up the layout chain: page.layout -> _layouts/<name>.html (itself possibly having a parent layout)
  let layoutName = ctx.page.layout;
  const seen = new Set();
  while (layoutName) {
    if (seen.has(layoutName)) throw new Error("jekyll-enough: layout cycle at " + layoutName);
    seen.add(layoutName);
    const key = "_layouts/" + layoutName + ".html";
    if (!(key in tree)) throw new Error("jekyll-enough: missing layout " + key);
    const { fmText, body: lbody } = splitFront(tree[key]);
    const ldata = fmText ? plugs.parseYaml(fmText) : {};
    out = renderTemplate(lbody, { ...ctx, content: out }, tplOpts);
    layoutName = ldata.layout;
  }
  return out;
}

// Build the whole site. `tree` is { path: content } (utf8 strings). Returns { "_site/...": content }.
// opts: the injectable seams - { parseYaml, renderTemplate, renderMarkdown } (all defaulted), the template
// pass-throughs { filters, lenient, gaps }, and an optional `time` for site.time (explicit, never Date(),
// so a build is deterministic/reproducible).
export function buildSite(tree, {
  parseYaml = parseYamlDefault,
  renderTemplate = renderTemplateDefault,
  renderMarkdown = renderMarkdownDefault,
  filters, lenient, gaps, time = null,
} = {}) {
  const plugs = { parseYaml, renderTemplate, renderMarkdown };
  const tpl = { filters, lenient, gaps };
  const config = "_config.yml" in tree ? parseYaml(tree["_config.yml"]) : {};
  const site = { ...config, data: {}, pages: [], time: time ?? config.time ?? null };
  const pretty = config.permalink === "pretty";

  // _data/**.yml|json -> site.data, nesting by directory: _data/git/blame.json -> site.data.git.blame
  // (the journal's stat writers file under _data/git/; Jekyll's DataReader nests the same way). json stays
  // JSON (the identity data plug), yaml goes through the data-read seam.
  for (const path of Object.keys(tree)) {
    const m = /^_data\/(.+)\.(ya?ml|json)$/.exec(path);
    if (!m) continue;
    const segs = m[1].split("/");
    let node = site.data;
    for (const s of segs.slice(0, -1)) node = node[s] ?? (node[s] = {});
    node[segs[segs.length - 1]] = m[2] === "json" ? JSON.parse(tree[path]) : parseYaml(tree[path]);
  }

  // pass 1: classify every path into a page (front-matter fence) or a static file, and compute each
  // page's output path + url BEFORE rendering, so site.pages is fully populated when any page renders.
  const pages = [], statics = [];
  for (const path of Object.keys(tree)) {
    if (SPECIAL.some((s) => path.startsWith(s))) continue;
    if (excluded(path, config.exclude)) continue;
    if (isPage(path) && FM_RE.test(tree[path])) {
      const { fmText, body } = splitFront(tree[path]);
      const data = fmText ? (parseYaml(fmText) || {}) : {};
      const out = outputPath(path, data, pretty);
      pages.push({ path, data, body, isMd: /\.(md|markdown)$/.test(path), out, url: urlOf(out) });
    } else {
      statics.push(path);                                    // assets, seed JSON, front-matter-less md/html
    }
  }

  // the Jekyll page/site model: site.pages carries a stub per page (its front matter + url + path), so a
  // real-Jekyll template that iterates site.pages for nav runs through this builder unchanged.
  site.pages = pages.map((e) => ({ ...e.data, url: e.url, path: e.path }));

  const out = {};
  for (const e of pages) {
    const page = { ...e.data, url: e.url, path: e.path, name: e.path.split("/").pop(), dir: urlOf(e.out).replace(/[^/]*$/, "") };
    const ctx = { site, page, content: "" };
    out["_site/" + e.out] = renderPage(e.path, e.body, e.isMd, ctx, tree, plugs, tpl);
  }
  for (const p of statics) out["_site/" + p] = tree[p];
  return out;
}
