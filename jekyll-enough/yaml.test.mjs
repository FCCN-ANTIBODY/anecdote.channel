// Unit: yaml-enough (yaml.mjs) - the dumb YAML reader, driven against fixtures copied verbatim from the
// real atlas _data/*.yml and _config.yml, plus front-matter splitting. Run: node jekyll-enough/yaml.test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse, frontMatter } from "./yaml.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (n) => readFileSync(join(HERE, "fixtures", n), "utf8");

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// 1. scalars: quoted / bare / number / bool / null / empty collections, and quote-aware comments.
{
  const y = parse([
    'a: "quoted"',
    "b: bare words",
    "n: 42",
    "t: true",
    "nul: null",
    "e: []",
    'h: "has # hash inside" # trailing comment',
    "# whole-line comment",
    "z: ~",
  ].join("\n"));
  ok(y.a === "quoted" && y.b === "bare words", "quoted and bare strings");
  ok(y.n === 42 && y.t === true && y.nul === null, "number / bool / null");
  ok(Array.isArray(y.e) && y.e.length === 0, "empty [] is an empty array");
  ok(y.h === "has # hash inside", "a # inside quotes is NOT a comment; the trailing one is stripped");
  ok(y.z === null, "~ is null");
}

// 2. a sequence of flat maps (the _data shape), by hand.
{
  const y = parse('- id: t1\n  name: "One"\n- id: t2\n  name: "Two"\n');
  ok(Array.isArray(y) && y.length === 2, "top-level sequence of two items");
  ok(y[0].id === "t1" && y[0].name === "One" && y[1].id === "t2", "each item is a flat map with its fields");
}

// 3. the REAL atlas _data/tells.yml (all comments + one entry with fields).
{
  const tells = parse(fixture("tells.yml"));
  ok(Array.isArray(tells) && tells.length >= 1, "tells.yml parses to a non-empty sequence");
  const t = tells[0];
  ok(t.id === "tell" && t.name === "Tell (reference hub)", "first Tell's id + quoted name");
  ok(t.url === "https://tell.anecdote.channel" && t.scope === "colorado", "url + scope (comments after values ignored)");
  ok(typeof t.signer === "string" && t.reports === "reports/govern-*", "signer + reports strings");
}

// 4. the REAL atlas _data/needs.yml.
{
  const needs = parse(fixture("needs.yml"));
  ok(Array.isArray(needs), "needs.yml is a sequence");
  if (needs.length) {
    const n = needs[0];
    ok("id" in n && "scope" in n && "topic" in n, "a need carries id/scope/topic");
    ok(n.terms === "" || typeof n.terms === "string", 'empty terms ("") reads as an empty string, not null');
  } else ok(true, "needs.yml empty is acceptable");
}

// 5. the REAL atlas _config.yml: mapping with a folded block scalar (description) + a list + empty [].
{
  const cfg = parse(fixture("_config.yml"));
  ok(cfg.title === "Atlas", "config title");
  ok(typeof cfg.description === "string" && cfg.description.includes("directory of Tells") && !cfg.description.includes("\n"),
    "the >- folded block scalar reads as a single joined line");
  ok(cfg.url === "https://atlas.anecdote.channel" && cfg.baseurl === "", "url + empty baseurl");
  ok(Array.isArray(cfg.plugins) && cfg.plugins.length === 0, "plugins: [] is an empty array");
  ok(Array.isArray(cfg.exclude) && cfg.exclude.includes("README.md") && cfg.exclude.includes("bin/"),
    "exclude: is a sequence of the excluded paths");
  ok(cfg.permalink === "pretty", "permalink: pretty");
}

// 6. front matter split: the real page shape (layout/title/permalink), and title: null.
{
  const fm = frontMatter("---\nlayout: default\ntitle: Tells\npermalink: /tells/\n---\n# Body\n\ntext\n");
  ok(fm.data.layout === "default" && fm.data.title === "Tells" && fm.data.permalink === "/tells/", "front matter keys parsed");
  ok(fm.body === "# Body\n\ntext\n", "body is everything after the closing ---");
  ok(frontMatter("---\ntitle: null\n---\nx").data.title === null, "title: null in front matter reads as null");
  ok(frontMatter("no front matter here").body === "no front matter here", "a page with no front matter returns the whole body");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall yaml-enough tests passed");
