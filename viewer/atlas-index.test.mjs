// Tests for viewer/atlas-index.mjs — the merge function (#90). Run: node viewer/atlas-index.test.mjs
import { repo } from "../git-enough/repo.mjs";
import { repoRegistry } from "./repos.mjs";
import { mergeAtlasIndex } from "./atlas-index.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const author = { name: "You", email: "you@origin", epoch: 1700000000, tz: "+0000" };

async function snapshot(items) {
  const a = repo();
  const files = items.map(([slug, item]) => ({ path: `listing/${slug}.json`, content: JSON.stringify(item) + "\n" }));
  await a.commitFiles(files, { author, message: "atlas snapshot" });
  return a;
}

const reg = repoRegistry();

// Two Atlases, one item ("park-budget") appearing in BOTH with byte-identical content — the dedup case.
const cd04 = await snapshot([
  ["council-agenda", { title: "council agenda, March", kind: "document" }],
  ["park-budget", { title: "park budget poll", kind: "poll" }],
]);
reg.register({ label: "cd04-atlas", kind: "atlas.snapshot", repo: cd04, source: "https://cd04.atlas.example" });

const neighbor = await snapshot([
  ["park-budget", { title: "park budget poll", kind: "poll" }],     // same content as cd04's copy → same oid
  ["zoning-notice", { title: "zoning notice", kind: "document" }],
]);
reg.register({ label: "neighbor-atlas", kind: "atlas.snapshot", repo: neighbor, source: "https://oldtown.atlas.example" });

// A non-atlas.snapshot registry entry (a native pile) — must be ignored entirely by the merge.
const session = repo();
await session.commitFiles([{ path: "index.html", content: "<h1>hi</h1>\n" }], { author, message: "browse" });
reg.register({ label: "browse-example", kind: "pile.session", repo: session });

const view = mergeAtlasIndex(reg);

// 1. Every non-duplicate item from both Atlases is present, and the pile.session is not.
{
  const titles = view.rows.map((r) => r.title);
  ok(titles.includes("council agenda, March") && titles.includes("zoning notice"), "non-duplicate items from both Atlases are present");
  ok(view.total === 3, "three distinct items total (park-budget deduped from 2 down to 1)");
}

// 2. The duplicated item collapses to ONE row, carrying both Atlases as sources.
{
  const budget = view.rows.find((r) => r.title === "park budget poll");
  ok(budget, "the duplicated item is present exactly once");
  ok(budget.sources.length === 2 && budget.sources.includes("https://cd04.atlas.example") && budget.sources.includes("https://oldtown.atlas.example"),
    "the deduped row lists BOTH Atlases as sources, not just the first seen");
}

// 3. Rows carry a real content-addressed oid, a signer (from the commit author), and a tip.
{
  const budget = view.rows.find((r) => r.title === "park budget poll");
  ok(typeof budget.oid === "string" && budget.oid.length === 40, "a row's oid is a real git blob oid");
  ok(typeof budget.signer === "string" && budget.signer.startsWith(author.name), "a row's signer comes from its snapshot's commit author");
  ok(typeof budget.tip === "string" && budget.tip.length === 40, "a row carries the tip commit it was read at");
}

// 4. byKind counts and sorted order.
{
  ok(view.byKind.document === 2 && view.byKind.poll === 1, "byKind counts documents and polls correctly");
  ok(view.rows.map((r) => r.title).join("|") === [...view.rows].sort((a, b) => (a.title < b.title ? -1 : 1)).map((r) => r.title).join("|"),
    "rows are sorted by title");
}

// 5. A registry with no atlas.snapshot entries at all yields an empty, well-formed view.
{
  const empty = mergeAtlasIndex(repoRegistry());
  ok(empty.total === 0 && empty.rows.length === 0, "an empty registry merges to an empty feed, not an error");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall atlas-index merge tests passed");
