// jekyll-enough/build.mjs - THE BUILD (docs/actions-enough.md, closing the "jekyll" gap). Wires the three
// dumb readers into a Jekyll-shaped static build: front matter + _config -> the `site`/`page` model, _data/*
// -> site.data, each page rendered (Liquid -> markdown for .md -> wrapped in its layout), pretty permalinks
// -> a _site tree. It operates on an IN-MEMORY tree (path -> content) so git-enough can hand it a held tree
// and take the built _site straight to send-pack - the offline origin runs Publish and deploys, no runner.
//
// Deliberately partial, matching the civic sites (measured): pages are files WITH front matter; everything
// else not excluded is copied verbatim (assets, seed JSON). No collections, no sass, no pagination, no
// plugins - atlas reflects its pile maps client-side at runtime, so the static shell is pure template+data.

import { parse, frontMatter } from "./yaml.mjs";
import { render as liquid } from "./liquid.mjs";
import { render as markdown } from "./markdown.mjs";

const SPECIAL = ["_layouts/", "_includes/", "_data/", "_plugins/", "_site/", "_sass/"];
const dirOf = (p) => { const i = p.lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); };
const isPage = (p) => /\.(md|markdown|html)$/.test(p);

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
    let p = pl.replace(/^\//, "");
    if (p === "" ) return "index.html";
    if (p.endsWith("/")) return p + "index.html";
    if (/\.html?$/.test(p)) return p;
    return p + "/index.html";
  }
  const base = srcPath.replace(/\.(md|markdown|html)$/, "");
  const name = base.split("/").pop();
  if (name === "index") return base + ".html";
  return prettyDefault ? base + "/index.html" : base + ".html";
}

// Render one page body through Liquid (+ markdown for .md) then wrap it up its layout chain.
function renderPage(srcPath, body, isMd, ctx, tree) {
  const loaders = {
    include: (name, c) => {
      const key = "_includes/" + name.trim();
      if (!(key in tree)) throw new Error("jekyll-enough: missing include " + key);
      const { body: ib } = frontMatter(tree[key]);
      return liquid(ib, c, loaders);
    },
    includeRelative: (rel, c) => {
      const key = (dirOf(srcPath) ? dirOf(srcPath) + "/" : "") + rel.trim();
      if (!(key in tree)) throw new Error("jekyll-enough: missing include_relative " + key);
      const { body: ib } = frontMatter(tree[key]);
      return liquid(ib, c, loaders);
    },
  };
  let out = liquid(body, ctx, loaders);
  if (isMd) out = markdown(out);

  // wrap up the layout chain: page.layout -> _layouts/<name>.html (itself possibly having a parent layout)
  let layoutName = ctx.page.layout;
  const seen = new Set();
  while (layoutName) {
    if (seen.has(layoutName)) throw new Error("jekyll-enough: layout cycle at " + layoutName);
    seen.add(layoutName);
    const key = "_layouts/" + layoutName + ".html";
    if (!(key in tree)) throw new Error("jekyll-enough: missing layout " + key);
    const { data: ldata, body: lbody } = frontMatter(tree[key]);
    out = liquid(lbody, { ...ctx, content: out }, loaders);
    layoutName = ldata.layout;
  }
  return out;
}

// Build the whole site. `tree` is { path: content } (utf8 strings). Returns { "_site/...": content }.
export function buildSite(tree) {
  const config = "_config.yml" in tree ? parse(tree["_config.yml"]) : {};
  const site = { ...config, data: {}, time: config.time || null };
  const pretty = config.permalink === "pretty";

  // _data/*.yml|json (top-level files) -> site.data[basename]
  for (const path of Object.keys(tree)) {
    const m = /^_data\/([^/]+)\.(ya?ml|json)$/.exec(path);
    if (!m) continue;
    site.data[m[1]] = m[2] === "json" ? JSON.parse(tree[path]) : parse(tree[path]);
  }

  const out = {};
  for (const path of Object.keys(tree)) {
    if (SPECIAL.some((s) => path.startsWith(s))) continue;
    if (excluded(path, config.exclude)) continue;

    // Jekyll processes a file ONLY if it opens with a front matter fence; otherwise it is a static file
    // (a .md without front matter is served as-is, NOT converted). The fence is the mark, not the extension.
    if (isPage(path) && /^---\r?\n/.test(tree[path])) {
      const { data, body } = frontMatter(tree[path]);
      const page = { ...data };
      const ctx = { site, page, content: "" };
      const isMd = /\.(md|markdown)$/.test(path);
      const html = renderPage(path, body, isMd, ctx, tree);
      out["_site/" + outputPath(path, data, pretty)] = html;
    } else {
      out["_site/" + path] = tree[path];                   // assets, seed JSON, etc.: copied verbatim
    }
  }
  return out;
}
