// scripts/page.test.mjs — RUN the page's own renderer against real data, with a DOM small enough
// to fit in this file. Dependency-free, like everything else here.
//
// Why this exists: the listing vanished in production because a helper was deleted while one
// caller survived. It threw, the catch swallowed it, and the page fell back to "Please Stand By."
// — a silent, total failure that `node --check` cannot see because the syntax was fine. Parsing is
// not running.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

// A FIXTURE, not sites.json. That file is generated at deploy and gitignored, so reading it here
// passes on a machine that has run the resolver and fails everywhere else — which is exactly what
// it did: green locally, ENOENT in CI, red for five commits. A test that depends on an artifact
// tests the artifact.
//
// This covers every shape the renderer branches on: a served name, a shell that leaves, a shell
// that is shielded, a name that is not answering, a node with extra roles, and an empty place.
const data = {
  apex: "anecdote.channel",
  root: "colorado.anecdote.channel",
  listing: [
    {
      host: "fort-collins.colorado.anecdote.channel",
      name: "Fort Collins",
      rows: [
        { category: "journal", entries: [
          { host: "antibody.fort-collins.colorado.anecdote.channel", name: "ANTIBODY",
            href: "https://antibody.fort-collins.colorado.anecdote.channel/",
            linked: true, leaves: false, shielded: false, dest: "", also: "atlas · antidote" },
        ] },
        { category: "media", entries: [
          { host: "public.media.fort-collins.colorado.anecdote.channel", name: "FC Public Media",
            href: "https://new.fcpublicmedia.org", linked: true, leaves: true, shielded: false,
            dest: "://new.fcpublicmedia.org", also: "" },
          { host: "fcreport.media.fort-collins.colorado.anecdote.channel", name: "The FC Report",
            href: "https://fcreport.org", linked: true, leaves: true, shielded: true,
            dest: "://fcreport.org", also: "" },
        ] },
        { category: "voices", entries: [
          { host: "north.voices.fort-collins.colorado.anecdote.channel", name: "north",
            href: "https://north.voices.fort-collins.colorado.anecdote.channel/",
            linked: false, leaves: false, shielded: false, dest: "", also: "" },
        ] },
      ],
    },
    { host: "wellington.colorado.anecdote.channel", name: "Wellington", rows: [] },
  ],
};

// ---- the smallest DOM that can hold this page -------------------------------------------
class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this._text = ""; }
  set className(v) { this.attrs.class = v; }  get className() { return this.attrs.class || ""; }
  set textContent(v) { this._text = String(v); } get textContent() { return this._text; }
  set href(v) { this.attrs.href = v; }        set rel(v) { this.attrs.rel = v; }
  set hidden(v) { this.attrs.hidden = v; }
  append(...ns) { for (const n of ns) this.children.push(...(n instanceof Frag ? n.children : [n])); }
  remove() { this._removed = true; }
  querySelector(sel) { return this._find(sel.replace(/^\./, "")); }
  _find(cls) {
    for (const c of this.children) {
      if (c._removed) continue;
      if ((c.className || "").split(/\s+/).includes(cls)) return c;
      const d = c._find?.(cls); if (d) return d;
    }
    return null;
  }
  all(cls, out = []) {
    for (const c of this.children) {
      if (c._removed) continue;
      if ((c.className || "").split(/\s+/).includes(cls)) out.push(c);
      c.all?.(cls, out);
    }
    return out;
  }
}
class Frag extends El { constructor() { super("frag"); } cloneNode() { const f = new Frag(); f.children = this.children.map(clone); return f; } }
const clone = (n) => { const c = new El(n.tagName); c.attrs = { ...n.attrs }; c._text = n._text; c.children = n.children.map(clone); return c; };

// Build the <template> contents by hand from the page's own markup, so the test breaks if a
// template loses an element the script reaches for.
function parseTemplate(id) {
  const m = new RegExp(`<template id="${id}">([\\s\\S]*?)</template>`).exec(html);
  assert.ok(m, `template ${id} is missing from index.html`);
  const frag = new Frag();
  const stack = [frag];
  const re = /<(\/?)([a-z0-9]+)([^>]*)>([^<]*)/gi;
  let t;
  while ((t = re.exec(m[1]))) {
    const [, close, tag, attrs, text] = t;
    if (close) { stack.pop(); continue; }
    const el = new El(tag);
    const cm = /class="([^"]*)"/.exec(attrs); if (cm) el.className = cm[1];
    if (/\shidden(\s|$|=)/.test(attrs)) el.attrs.hidden = true;
    el._text = text.trim();
    stack[stack.length - 1].append(el);
    if (!/\/>$/.test(t[0]) && !["img", "br"].includes(tag)) stack.push(el);
  }
  return frag;
}

const nav = new El("nav");
const eyebrow = new El("p");
const templates = { "t-place": parseTemplate("t-place"), "t-row": parseTemplate("t-row"), "t-entry": parseTemplate("t-entry") };
globalThis.document = {
  getElementById: (id) => (id === "directory" ? nav : id === "eyebrow" ? eyebrow : templates[id] ? { content: templates[id] } : new El("div")),
};
globalThis.location = { hostname: "anecdote.channel" };
globalThis.fetch = async () => ({ ok: true, json: async () => data });

// ---- run the page's actual script --------------------------------------------------------
const script = /<script type="module">([\s\S]*?)<\/script>/.exec(html)[1];
const mod = script.replace(/from "\/directory\.mjs"/, `from "${new URL("../directory.mjs", import.meta.url).href}"`);
await import("data:text/javascript;base64," + Buffer.from(mod).toString("base64"));
await new Promise((r) => setTimeout(r, 0));

// ---- what it must have produced ----------------------------------------------------------
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

t("the listing renders — a thrown helper would leave this empty", () => {
  const places = nav.all("place-block");
  assert.equal(places.length, data.listing.length, "every place in the data renders");
  assert.equal(eyebrow.textContent, "anecdote.channel", "standing-by means the render threw");
});

t("every place that has entries shows them", () => {
  const rows = data.listing.flatMap((p) => p.rows);
  assert.equal(nav.all("cat").length, rows.length, "one category header per row");
  assert.equal(nav.all("item").length, rows.flatMap((r) => r.entries).length, "one item per entry");
});

t("NO ENTRY SAYS SOON UNLESS IT IS GENUINELY NOT ANSWERING", () => {
  const soon = nav.all("soon").filter((e) => !e._removed);
  const expected = data.listing.flatMap((p) => p.rows).flatMap((r) => r.entries).filter((e) => !e.linked);
  assert.equal(soon.length, expected.length,
    `${soon.length} entries say SOON; only ${expected.length} are actually not answering`);
});

t("a linked entry has an href and no leftover soon in the same item", () => {
  for (const item of nav.all("item")) {
    const a = item._find("place"), s = item._find("soon");
    assert.ok(!(a && s), "an entry rendered both a link and SOON");
    if (a) assert.ok(a.attrs.href, "a link without an href");
  }
});

t("a reserved place says so, and an occupied one does not", () => {
  const reservedNames = data.listing.filter((p) => !p.rows.length).map((p) => p.name);
  const shown = nav.all("reserved").filter((e) => !e._removed);
  assert.equal(shown.length, reservedNames.length,
    `${shown.length} places say "reserved"; ${reservedNames.length} actually are`);
});

console.log(`\n${n}/${n} passed`);
