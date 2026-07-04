// viewer/atlas-index.mjs — the aggregate index docs/atlas-index.md names and #90 tracks: fold every
// `atlas.snapshot` registry entry into one deduped, sorted, mixed feed. Deliberately NOT a new registry
// type parallel to repoRegistry() — it's a fold *over* the existing registry, the way repoListView()
// already folds over it for one Atlas's worth of rows (docs/atlas-index.md "The aggregate index").
//
// Each listed item lives as its OWN file under `listing/<slug>.json` inside a snapshot's repo — a real git
// blob, so two different Atlases fronting byte-identical content for the same item land on the SAME oid.
// That's git's own content addressing doing the dedup, not a hand-rolled hash: "deduped by content hash"
// (the doc's phrase) is true by construction, not by extra code here.

import { parseCommit, filesAt } from "../git-enough/read.mjs";

const dec = new TextDecoder();
const LISTING_PREFIX = "listing/";

// One atlas.snapshot entry's contribution: every listing/*.json file at its tip, decoded into a row.
// `tip` is the commit this row was read at (what "signed off" checks against, docs/atlas-index.md
// "Provenance in the UI") — NOT the same as the tier-1 `lastSeenTip` refresh check, which is a separate,
// still-open piece (comparing THIS against a fresh ref advertisement to decide whether to re-pull at all).
function rowsFromSnapshot(entry) {
  const r = entry.repo;
  const tip = r.readRef(r.head());
  if (!tip) return [];
  const commitObj = r.objects.get(tip);
  const signer = commitObj && commitObj.type === "commit" ? parseCommit(commitObj.content).author : null;

  return filesAt(r.objects, tip)
    .filter((f) => f.path.startsWith(LISTING_PREFIX))
    .map((f) => {
      const blob = r.objects.get(f.oid);
      let item = {};
      try { item = blob ? JSON.parse(dec.decode(blob.content)) : {}; } catch { item = {}; }
      return {
        oid: f.oid,
        title: item.title ?? f.path.slice(LISTING_PREFIX.length),
        kind: item.kind ?? "unknown",
        source: entry.source || null,
        signer,
        tip,
      };
    });
}

// Fold every atlas.snapshot entry into one feed, deduped by oid. Two snapshots surfacing the SAME item
// (same oid) collapse to one row whose `sources` lists every Atlas it was seen through — corroboration is
// information, not noise, so it's kept rather than discarded at the first match.
export function mergeAtlasIndex(registry) {
  const byOid = new Map();
  for (const entry of registry.list()) {
    if (entry.kind !== "atlas.snapshot") continue;
    for (const row of rowsFromSnapshot(entry)) {
      const existing = byOid.get(row.oid);
      if (!existing) {
        byOid.set(row.oid, { oid: row.oid, title: row.title, kind: row.kind, signer: row.signer, tip: row.tip,
                              sources: row.source ? [row.source] : [] });
        continue;
      }
      if (row.source && !existing.sources.includes(row.source)) existing.sources.push(row.source);
    }
  }
  const rows = [...byOid.values()].sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
  const byKind = {};
  for (const row of rows) byKind[row.kind] = (byKind[row.kind] || 0) + 1;
  return { rows, total: rows.length, byKind };
}
