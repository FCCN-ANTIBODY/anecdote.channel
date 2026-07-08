// viewer/hydration.mjs — THE FOUNDATIONAL / ON-DEMAND DISCIPLINE (anecdote#91 items 4–6). Not every
// target file needs the same freshness guarantee. Two classes, and the split is the same one
// sw.js's firmware pin already lives by (docs/origin.md): a manifest names what matters; fetches
// verify and fail gracefully; a miss is retried on a later visit, never silently forgotten.
//
//   FOUNDATIONAL — named by THE ATLAS'S OWN MANIFEST (atlas.foundational/v1, a committed
//     `foundational.json` at its checkout root — the docs/origin.md `file:` backbone spirit),
//     never inferred by us. Fetched eagerly, kept current, expected to work with zero
//     connectivity once fetched once. A miss is a REAL, NAMED gap — surfaced, and retried on the
//     next sync — and so is a path the manifest names that the listing doesn't serve.
//   ON-DEMAND — everything else. Fetched lazily the first time something asks; a miss just means
//     "not fetched yet," resolved next time there's connectivity, blocking nothing.
//
// This module owns the DISCIPLINE only. The wire is git-enough/fetch-pack (proven there); the
// cache address is viewer/materialize.mjs's (`anecdote://repo/<label>/<path>`); listings come
// from the caller (fetchFilesUnder / fetchTree). heldStatus is the #90 wiring: a row can say
// whether its target content is actually held offline right now vs merely reachable-when-online.

import { hydrateFile } from "./materialize.mjs";

export const FOUNDATIONAL_SCHEMA = "atlas.foundational/v1";
export const FOUNDATIONAL_PATH = "foundational.json";

// The marker (item 4): parse an Atlas's own manifest. Malformed or missing marks NOTHING
// foundational — inference is exactly what this refuses to do.
export function readFoundational(text) {
  try {
    const m = JSON.parse(text);
    if (m?.schema !== FOUNDATIONAL_SCHEMA || !Array.isArray(m.files)) return [];
    return m.files.filter((f) => typeof f === "string" && f.length);
  } catch { return []; }
}

// The eager class (item 5): sync every foundational path against the current listing.
// `listing` is [{path, oid, tip?}] from the caller's tier-2 pull. Every failure mode is NAMED in
// `gaps` — a foundational miss is a real gap, not a skip — and a re-run retries exactly the gaps
// (plus anything whose oid moved), which IS the retry discipline: on a later visit, try again.
export async function syncFoundational(materialized, { label, foundational = [], listing = [],
  url, credential, treeOid, inflate, fetch, hydrate = hydrateFile } = {}) {
  const byPath = new Map(listing.map((f) => [f.path, f]));
  const hydrated = [], gaps = [];
  for (const path of foundational) {
    const current = byPath.get(path);
    if (!current) { gaps.push({ path, why: "named foundational by the Atlas, but not in its listing" }); continue; }
    let r = null;
    try { r = await hydrate(materialized, { url, credential, label, path, treeOid, current, inflate, fetch }); }
    catch (e) { gaps.push({ path, why: "fetch failed: " + e.message }); continue; }
    if (!r) { gaps.push({ path, why: "not served (fetch returned nothing)" }); continue; }
    hydrated.push({ path, oid: r.oid, fromCache: !!r.fromCache });
  }
  return { hydrated, gaps, complete: gaps.length === 0 };
}

// The lazy class (item 5): one path, first time something asks. A miss is not a gap — it means
// "not fetched yet"; we trust the device to have (or go find) connectivity at that moment, and a
// failure degrades gracefully rather than blocking anything else.
export async function hydrateOnDemand(materialized, opts = {}) {
  const { hydrate = hydrateFile, ...rest } = opts;
  try {
    const r = await hydrate(materialized, rest);
    if (r) return { held: true, ...r };
  } catch { /* graceful: offline is a normal state, not an error */ }
  return { held: false, path: opts.path, why: "not fetched yet — resolved next time there's connectivity and something asks" };
}

// The #90 wiring (item 6): for listing rows, what the device actually holds RIGHT NOW.
//   held      — cached and the oid still matches the current listing (works with zero connectivity)
//   stale     — cached, but the listing moved on (usable, honest about its age)
//   reachable — in the remote listing, not yet cached (needs connectivity when asked)
export async function heldStatus(materialized, label, rows = []) {
  const out = [];
  for (const row of rows) {
    const cached = await materialized.get(label, row.path);
    out.push({ ...row, held: cached ? (cached.oid === row.oid ? "held" : "stale") : "reachable" });
  }
  return out;
}
