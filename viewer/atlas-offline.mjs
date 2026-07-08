// viewer/atlas-offline.mjs — THE OFFLINE ATLAS (civic-node #73): your local copy, everything public,
// the matcher running for you. Bridges the sneakernet's kept copies (composer/sneakernet.mjs,
// atlas.snapshot-kept/v1) into repo-world so every surface that already exists just works:
//
//   landSnapshot — commit a kept copy's carried files into a git-enough repo, PLUS the derived
//     `listing/<slug>.json` rows the aggregate index reads (viewer/atlas-index.mjs) — a real git
//     blob per item, so two Atlases fronting byte-identical content land on the SAME oid and the
//     mixed feed dedups by construction. The repo registers as kind `atlas.snapshot` (viewer/repos:
//     trust grade "atlas", source = the Atlas url, pushes nowhere). A newer stamp ADVANCES the same
//     repo (parent-linked history — the carried record's own timeline); an equal/older stamp is a
//     no-op (the sneakernet already refuses regression; this is depth, not the gate). The commit
//     author IS the Atlas's signer fingerprint (provenance in the UI); the committer is the carrier.
//   atlasView — the whole PUBLIC surface, read back off the repo tip, fully offline: tells, piles,
//     needs, peers, hearsay doors, antidotes, matches — plus both dates, so staleness stays honest.
//     No keys, no reach into piles: an Atlas holds none, and neither does its copy.
//   matchOffline — the exact same matcher contract working for you offline ({need, candidate} ->
//     {verdict, reason}; atlas bin/match's mixed model, hearsay doors included, marked self-kept).
//     HONEST DEFAULT: no judge -> needs-judgment -> nothing matches. Your own needs ride alongside
//     the carried ones — when a new snapshot arrives, the same workflows are working for you.
//
// The metadata-crunch decision (#73's open sub-question, recorded): per-slice reflections
// (/piles/<id>/map.xml) ride the snapshot's EXTENSIBLE FILE LIST (atlas bin/snapshot
// ATLAS_SNAPSHOT_FILES) — embedded, since content-addressing them to a later fetch contradicts
// "everything public, on your copy". A snapshot that didn't carry them names them absent; this
// module renders what rode and never fetches.

import { repo as makeRepo } from "../git-enough/repo.mjs";
import { filesAt } from "../git-enough/read.mjs";
import { anecdoteUrl } from "./anecdote-url.mjs";
import { canonicalize } from "../composer/sign.mjs";
import { KEPT_SCHEMA } from "../composer/sneakernet.mjs";

const dec = new TextDecoder();

// ---- vendored flat-registry reader (byte-mirrors atlas bin/drop.mjs readItems) -------------------------
export function readItems(yml) {
  const strip = (s) => { const q = s.replace(/\s+#.*$/, "").trim(); return q.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"); };
  const items = []; let cur = null;
  for (const line of (yml || "").split("\n")) {
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;
    const m = line.match(/^(\s*)(- )?([\w-]+):\s*(.*)$/);
    if (!m) continue;
    const [, , dash, key, rawVal] = m;
    if (dash) { cur = {}; items.push(cur); }
    if (!cur) continue;
    cur[key] = strip(rawVal);
  }
  return items;
}

// ---- the crunch: carried registries -> listing rows (one file per item; content-addressed dedup) --------
const REGISTRY_KINDS = [
  { path: "_data/tells.yml", kind: "tell" },
  { path: "_data/piles.yml", kind: "pile" },
  { path: "_data/needs.yml", kind: "need" },
  { path: "_data/atlases.yml", kind: "peer" },
  { path: "_data/hearsay-piles.yml", kind: "hearsay" },
  { path: "_data/antidotes.yml", kind: "antidote" },
];

export function listingsFrom(snapshot) {
  const byPath = new Map((snapshot.files || []).map((f) => [f.path, f.content]));
  const rows = [];
  for (const { path, kind } of REGISTRY_KINDS) {
    if (!byPath.has(path)) continue;
    for (const item of readItems(byPath.get(path))) {
      if (!item.id && !item.pile) continue;
      const slug = kind === "hearsay" ? `${kind}-${item.pile}-${item.poll}` : `${kind}-${item.id}`;
      const title = kind === "hearsay" ? (item.question || `${item.pile}/${item.poll}`) : (item.name || item.id);
      rows.push({ path: `listing/${slug}.json`, content: canonicalize({ title, kind, ...item }) });
    }
  }
  if (byPath.has("matches.json")) {
    try {
      for (const m of JSON.parse(byPath.get("matches.json")) || []) {
        rows.push({ path: `listing/match-${m.need_id}-${m.candidate?.pile_id}.json`,
          content: canonicalize({ title: `${m.need_id} -> ${m.candidate?.pile_id}`, kind: "match", ...m }) });
      }
    } catch { /* a malformed derived surface never blocks the registries */ }
  }
  return rows;
}

// ---- land: kept copy -> a registered, history-keeping atlas.snapshot repo -------------------------------
export async function landSnapshot(kept, { registry, label } = {}) {
  if (!registry) throw new Error("atlas-offline: landSnapshot needs a repoRegistry");
  if (!kept || kept.schema !== KEPT_SCHEMA) throw new Error("atlas-offline: not an atlas.snapshot-kept/v1 — ingest via the sneakernet first");
  const snapshot = kept.snapshot;
  const name = label || `atlas:${kept.atlas}`;

  const existing = registry.get(name);
  const r = existing ? existing.repo : makeRepo();
  if (existing) {
    const tip = r.readRef(r.head());
    const keptFile = tip && filesAt(r.objects, tip).find((f) => f.path === "kept.json");
    if (keptFile) {
      const prior = JSON.parse(dec.decode(r.objects.get(keptFile.oid).content));
      if (Date.parse(prior.stamped_at) >= Date.parse(kept.stamped_at))
        return { id: anecdoteUrl("repo", name), unchanged: true, tip };
    }
  }

  const files = [
    ...(snapshot.files || []).map((f) => ({ path: f.path, content: f.content })),
    ...listingsFrom(snapshot),
    { path: "kept.json", content: canonicalize({ schema: kept.schema, atlas: kept.atlas, url: snapshot.url || null,
      stamped_at: kept.stamped_at, accepted_at: kept.accepted_at, by: kept.by, carried_by: kept.carried_by || null,
      absent: snapshot.absent || [] }) },
  ];
  const author = { name: kept.by, email: `${kept.atlas}@atlas`, epoch: Math.floor(Date.parse(kept.stamped_at) / 1000), tz: "+0000" };
  const committer = { name: kept.carried_by || "local", email: "carrier@sneakernet", epoch: Math.floor(Date.parse(kept.accepted_at) / 1000), tz: "+0000" };
  const oid = await r.commitFiles(files, { author, committer,
    message: `snapshot ${kept.atlas} @ ${kept.stamped_at} (accepted ${kept.accepted_at}${kept.carried_by ? `, carried by ${kept.carried_by}` : ""})\n` });
  const id = registry.register({ label: name, kind: "atlas.snapshot", repo: r, source: snapshot.url || null });
  return { id, tip: oid, unchanged: false };
}

// ---- the view: everything public on that Atlas, on your copy of it, no fetch ----------------------------
export function atlasView(entry) {
  if (!entry || entry.kind !== "atlas.snapshot") throw new Error("atlas-offline: not an atlas.snapshot entry");
  const r = entry.repo;
  const tip = r.readRef(r.head());
  if (!tip) return null;
  const files = filesAt(r.objects, tip);
  const read = (p) => { const f = files.find((x) => x.path === p); return f ? dec.decode(r.objects.get(f.oid).content) : null; };
  const items = (p) => { const c = read(p); return c ? readItems(c) : []; };
  const kept = JSON.parse(read("kept.json") || "{}");
  let matches = [];
  try { matches = JSON.parse(read("matches.json") || "[]") || []; } catch { matches = []; }
  return {
    atlas: kept.atlas, url: kept.url, stamped_at: kept.stamped_at, accepted_at: kept.accepted_at,
    by: kept.by, carried_by: kept.carried_by, absent: kept.absent || [], tip,
    tells: items("_data/tells.yml"), piles: items("_data/piles.yml"), needs: items("_data/needs.yml"),
    peers: items("_data/atlases.yml"), hearsay: items("_data/hearsay-piles.yml"),
    antidotes: items("_data/antidotes.yml"), matches,
  };
}

// ---- the matcher, running for you: the same contract, the same mixed model, honest default off ----------
export async function matchOffline(view, { judge = null, needs = [] } = {}) {
  const all = [...(view.needs || []), ...(needs || [])];
  const matches = [], judged = [];
  let needsJudgment = 0;
  for (const need of all) {
    const scope = need.scope || "";
    const tellUrl = (view.tells || []).find((t) => t.scope === scope)?.url || "";
    const candidates = [
      ...(view.piles || []).filter((p) => p.scope === scope).map((p) => (
        { atlas_url: view.url || "", tell_url: tellUrl, pile_id: p.id })),
      ...(view.hearsay || []).filter((h) => h.scope === scope && (h.status || "live") === "live").map((h) => (
        { atlas_url: view.url || "", tell_url: view.url || "", pile_id: h.id, provisioner: "self", question: `${h.pile}/${h.poll}` })),
    ];
    for (const candidate of candidates) {
      let verdict = "needs-judgment", reason = "constitutional fit needs an agent/human (no judge configured)";
      if (judge) ({ verdict = "needs-judgment", reason = "" } = (await judge({ need, candidate })) || {});
      judged.push({ need_id: need.id, pile_id: candidate.pile_id, verdict });
      if (verdict !== "accept") { needsJudgment++; continue; }
      matches.push({ need_id: need.id, asker_repo: need.asker_repo || null, candidate, verdict, reason,
        consent_required: !(need.terms && need.terms !== "") });
    }
  }
  return { matches, judged, needsJudgment };
}
