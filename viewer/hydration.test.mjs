// Unit: the foundational/on-demand hydration discipline (viewer/hydration.mjs, anecdote#91 items
// 4–6). The Atlas's OWN manifest marks the foundational class (never inferred; malformed marks
// nothing); a foundational miss is a NAMED gap retried on the next sync, never silently skipped;
// an on-demand miss degrades gracefully ("not fetched yet"); heldStatus tells a #90 row held /
// stale / reachable. The wire is fetch-pack's business (proven there) — tests drive the `hydrate`
// seam. Run: node viewer/hydration.test.mjs
import { readFoundational, syncFoundational, hydrateOnDemand, heldStatus, FOUNDATIONAL_SCHEMA } from "./hydration.mjs";
import { materializedStore } from "./materialize.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const memory = () => { const m = new Map(); return { get: async (k) => m.get(k), set: async (k, v) => m.set(k, v), delete: async (k) => m.delete(k) }; };
const enc = (s) => new TextEncoder().encode(s);

// a fake wire behind the hydrate seam: serves some paths, fails others, counts trips.
function fakeWire(served, { fail = [] } = {}) {
  const trips = [];
  const hydrate = async (materialized, { label, path, current }) => {
    trips.push(path);
    if (fail.includes(path)) throw new Error("no route to atlas");
    if (!(path in served)) return null;
    const cached = await materialized.get(label, path);
    if (cached && cached.oid === current.oid) return { ...cached, fromCache: true };
    return materialized.put(label, path, { oid: current.oid, tip: current.tip, content: enc(served[path]) });
  };
  return { hydrate, trips };
}

// 1. the marker is the Atlas's own word — malformed or missing marks NOTHING foundational.
{
  const good = JSON.stringify({ schema: FOUNDATIONAL_SCHEMA, files: ["polls.json", "directory.json"] });
  ok(readFoundational(good).join(",") === "polls.json,directory.json", "the Atlas's manifest names its foundational files");
  ok(readFoundational("not json").length === 0 && readFoundational(JSON.stringify({ files: ["x"] })).length === 0,
    "malformed or unschema'd manifests mark nothing — inference is refused");
}

// 2. the eager sync: hydrates the named class; every failure mode is a NAMED gap.
{
  const materialized = materializedStore(memory());
  const listing = [{ path: "polls.json", oid: "a1", tip: "t1" }, { path: "directory.json", oid: "b1", tip: "t1" }];
  const wire = fakeWire({ "polls.json": "[poll rows]" }, { fail: ["directory.json"] });
  const r = await syncFoundational(materialized, { label: "cd04", foundational: ["polls.json", "directory.json", "ghost.json"],
    listing, hydrate: wire.hydrate });
  ok(r.hydrated.length === 1 && r.hydrated[0].path === "polls.json", "what can land, lands");
  ok(r.gaps.length === 2 && r.gaps.some((g) => /fetch failed/.test(g.why)) && r.gaps.some((g) => /not in its listing/.test(g.why)),
    "a failed fetch AND a named-but-unserved path are both REAL, NAMED gaps — never silently skipped");
  ok(r.complete === false, "the sync says honestly that the foundation is not whole");
}

// 3. the retry discipline: a re-run retries exactly the gaps; a healed wire completes the foundation.
{
  const materialized = materializedStore(memory());
  const listing = [{ path: "polls.json", oid: "a1" }, { path: "directory.json", oid: "b1" }];
  const broken = fakeWire({ "polls.json": "[poll rows]" }, { fail: ["directory.json"] });
  await syncFoundational(materialized, { label: "cd04", foundational: ["polls.json", "directory.json"], listing, hydrate: broken.hydrate });
  const healed = fakeWire({ "polls.json": "[poll rows]", "directory.json": "[businesses]" });
  const r2 = await syncFoundational(materialized, { label: "cd04", foundational: ["polls.json", "directory.json"], listing, hydrate: healed.hydrate });
  ok(r2.complete === true && r2.hydrated.find((h) => h.path === "polls.json").fromCache === true,
    "the later visit retries the gap and completes; the already-held file costs no trip's worth of bytes (cache hit)");
}

// 4. freshness follows the listing: a moved oid re-fetches; an unmoved one stays cached.
{
  const materialized = materializedStore(memory());
  const wire = fakeWire({ "polls.json": "v1" });
  await syncFoundational(materialized, { label: "cd04", foundational: ["polls.json"], listing: [{ path: "polls.json", oid: "a1" }], hydrate: wire.hydrate });
  const wire2 = fakeWire({ "polls.json": "v2" });
  const r = await syncFoundational(materialized, { label: "cd04", foundational: ["polls.json"], listing: [{ path: "polls.json", oid: "a2" }], hydrate: wire2.hydrate });
  ok(r.hydrated[0].fromCache === false && r.hydrated[0].oid === "a2", "a moved oid re-fetches — foundational stays CURRENT, not merely present");
}

// 5. on-demand degrades gracefully: a miss is "not fetched yet", never a thrown error.
{
  const materialized = materializedStore(memory());
  const dark = fakeWire({}, { fail: ["menu.json"] });
  const r = await hydrateOnDemand(materialized, { label: "cd04", path: "menu.json", current: { oid: "c1" }, hydrate: dark.hydrate });
  ok(r.held === false && /not fetched yet/.test(r.why), "an on-demand miss blocks nothing and says why");
  const lit = fakeWire({ "menu.json": "[menu]" });
  const r2 = await hydrateOnDemand(materialized, { label: "cd04", path: "menu.json", current: { oid: "c1" }, hydrate: lit.hydrate });
  ok(r2.held === true, "next time there's connectivity and something asks, it resolves");
}

// 6. the #90 wiring: a row says held / stale / reachable — what the device actually has, right now.
{
  const materialized = materializedStore(memory());
  await materialized.put("cd04", "polls.json", { oid: "a1", tip: "t", content: enc("v1") });
  await materialized.put("cd04", "old.json", { oid: "zz", tip: "t", content: enc("old") });
  const rows = await heldStatus(materialized, "cd04", [
    { path: "polls.json", oid: "a1" }, { path: "old.json", oid: "z2" }, { path: "new.json", oid: "n1" }]);
  ok(rows[0].held === "held" && rows[1].held === "stale" && rows[2].held === "reachable",
    "held (works dark) / stale (usable, honest) / reachable (needs connectivity) — no guessing");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall hydration tests passed");
