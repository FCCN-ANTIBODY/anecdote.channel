// composer/constituency.mjs — THE SELF-CONSTITUENCY ASSERTION, client side (docs/presence.md,
// atlas.anecdote.channel/notes/boundary-canon.md). This is where the offline app drinks the picture: it
// holds atlas dumps (fetched, or CAUGHT over the gravel), verifies the ledger and every shape inside it,
// bisects the holder's own position LOCALLY, and answers the only question that matters — "does my literal
// position fall inside any of these, competing included?" Nothing about the position ever leaves the
// device; only the resulting CLAIM does (presence.mjs), and only when the person chooses to present it.
//
// FETCH THE WORLD, FIND YOURSELF LOCALLY (the privacy inversion): never ask a regional server a regional
// question. The client holds the whole bundle of dumps and does the geometry itself, so the fetch reveals
// only "someone who uses anecdote," never "someone asking about Colorado." Dumps are signed, so provenance
// is irrelevant to trust — a mirror, a friend, a peer Atlas, or a QR loop in a room are equally good
// sources (verify-from-anyone). We NEVER trust the dump's word about a shape: every member boundary is
// re-verified by its OWN Tell signature (composer/bisect.mjs). The Atlas signed its ledger; the Tell signed
// the shape; the phone checks both.
//
// The answer is PLURAL and collapses by the user's selection, never by an arbiter: you belong to every
// constituency whose shape contains you — city ∩ watershed ∩ district, claims and competing proposals
// alike. Proposals are surfaced apart (a wish you could SELECT to start your symbology, or make your own by
// running a Tell that draws it). The judge's pinpointing grade rides along, countable not geometric: how
// many shapes contain you, and whether a claim and a competing proposal DISAGREE about containing you.

import { verifyAttestation } from "./sign.mjs";
import { verifyBoundary, contains } from "./bisect.mjs";

export const DUMP = "anecdote.atlas-dump/v1";

// Verify one atlas dump end to end: the LEDGER signature (who signed this SET, at this moment) + each
// member boundary's OWN Tell signature (never trust the atlas's word — a well-formed atlas may relay junk;
// a member whose own signature fails is simply not held). `roots` are the signer fingerprints you walked
// to / installed from; the dump signer is graded trusted iff it is one of them (provenance, not authority).
export async function verifyDump(dump, { roots = [] } = {}) {
  if (!dump || dump.schema !== DUMP) return { ok: false, errors: ["not an atlas dump"] };
  const led = await verifyAttestation(dump, {});
  if (!led.ok) return { ok: false, errors: ["dump ledger signature: " + led.errors.join("; ")] };
  const members = [], proposals = [], dropped = [];
  for (const m of dump.members || []) {
    const v = await verifyBoundary(m.artifact, {});
    if (!v.ok) { dropped.push({ id: m.id, errors: v.errors }); continue; }
    members.push({ id: v.id, constituency: v.constituency, artifact: m.artifact, tellSigner: v.by, anchored: m.anchored ?? null });
  }
  for (const p of dump.proposals || []) {
    const v = await verifyBoundary(p.artifact, {});
    if (!v.ok) { dropped.push({ id: p.id, errors: v.errors }); continue; }
    proposals.push({ id: v.id, constituency: v.constituency, artifact: p.artifact, by: v.by, proposes: p.artifact.proposes || null });
  }
  return { ok: true, atlas: dump.atlas, by: led.by, atlasTrusted: roots.includes(led.by), at: dump.at, members, proposals, dropped, errors: [] };
}

// Hold several dumps as one working picture (the bundle). Dedupe boundaries by content id — a shape listed
// by many atlases is remembered as such (more corroboration, computable later); each remembers which
// atlas(es) carried it and whether any carrier was trusted. Proposals kept in their own map. Invalid dumps
// are recorded, not fatal.
export async function holdDumps(dumps, { roots = [] } = {}) {
  const boundaries = new Map(), proposals = new Map(), atlases = [];
  for (const dump of dumps || []) {
    const v = await verifyDump(dump, { roots });
    if (!v.ok) { atlases.push({ atlas: dump && dump.atlas, ok: false, errors: v.errors }); continue; }
    atlases.push({ atlas: v.atlas, by: v.by, trusted: v.atlasTrusted, ok: true, members: v.members.length, dropped: v.dropped.length });
    for (const m of v.members) {
      const e = boundaries.get(m.id) || { id: m.id, artifact: m.artifact, constituency: m.constituency, tellSigner: m.tellSigner, anchored: m.anchored, atlases: new Set(), trustedCarrier: false };
      e.atlases.add(v.atlas); if (v.atlasTrusted) e.trustedCarrier = true;
      boundaries.set(m.id, e);
    }
    for (const p of v.proposals) {
      const e = proposals.get(p.id) || { id: p.id, artifact: p.artifact, constituency: p.constituency, by: p.by, proposes: p.proposes, atlases: new Set(), trustedCarrier: false };
      e.atlases.add(v.atlas); if (v.atlasTrusted) e.trustedCarrier = true;
      proposals.set(p.id, e);
    }
  }
  const listOut = (m) => ({ ...m, atlases: [...m.atlases] });
  return { atlases, boundaries: [...boundaries.values()].map(listOut), proposals: [...proposals.values()].map(listOut) };
}

// THE ASSERTION. Bisect `point` ([lon, lat]) against every held claim AND every held proposal — all local,
// nothing leaves. Returns:
//   placements[]         — claims that contain me, each carrying a ready `bisect: {method:"bisect",boundary}`
//                          (drop straight into presence.makeClaim). Deterministic order.
//   proposalPlacements[] — wishes that contain me: what I could SELECT to start a symbology.
//   ambiguity            — the judge's countable pinpoint grade (see below).
export function whereAmI(point, held) {
  const inside = (x) => contains(x.artifact, point);
  const placements = (held.boundaries || []).filter(inside).map((b) => ({
    constituency: b.constituency, boundary: b.id, atlases: b.atlases, tellSigner: b.tellSigner,
    trustedCarrier: b.trustedCarrier, anchored: b.anchored,
    bisect: { method: "bisect", boundary: b.id },        // graduation-ready: presence.makeClaim eats this
  })).sort((a, b) => (a.constituency < b.constituency ? -1 : a.constituency > b.constituency ? 1 : a.boundary < b.boundary ? -1 : 1));
  const proposalPlacements = (held.proposals || []).filter(inside).map((p) => ({
    constituency: p.constituency, boundary: p.id, proposes: p.proposes, atlases: p.atlases, trustedCarrier: p.trustedCarrier,
  })).sort((a, b) => (a.boundary < b.boundary ? -1 : 1));

  // Ambiguity, computed from artifacts (never sliver geometry): per REFERENT, does a claim and a competing
  // proposal disagree about containing me? A proposal's referent is proposes.for; a claim's is its slug.
  const ref = new Map();  // referent -> { claimIn, proposalIn }
  for (const b of held.boundaries || []) { const e = ref.get(b.constituency) || {}; if (inside(b)) e.claimIn = true; else if (e.claimIn === undefined) e.claimIn = false; ref.set(b.constituency, e); }
  for (const p of held.proposals || []) { const r = (p.proposes && p.proposes.for) || p.constituency; const e = ref.get(r) || {}; if (inside(p)) e.proposalIn = true; else if (e.proposalIn === undefined) e.proposalIn = false; ref.set(r, e); }
  const contested = [...ref].filter(([, e]) => e.claimIn !== undefined && e.proposalIn !== undefined && e.claimIn !== e.proposalIn).map(([r]) => r).sort();

  return {
    placements, proposalPlacements,
    ambiguity: { containing: placements.length, proposalsContaining: proposalPlacements.length, contested },
  };
}

// ---- thin transport (browser/network): fetch a bundle of dumps. Pure core above takes objects; this only
// gathers bytes. Provenance doesn't matter — each dump is verified on hold — so any URL/source is fine. ----
export async function fetchDumps(urls, { fetch: f = globalThis.fetch } = {}) {
  const out = [];
  for (const url of urls || []) { try { const r = await f(url); if (r && r.ok) out.push(await r.json()); } catch { /* a dead mirror holds nothing; another source may carry it */ } }
  return out;
}

// ---- probe-line capability ------------------------------------------------------------------------------
// Rung 0: bisecting held shapes is PERCEPTION — pure compute, no persistence, no egress (the position never
// leaves; only a later presence.claim, its own gated act, does). The chamber passes the point + held bundle;
// Elevated returns the plural assertion. Works even in incognito.
export function constituencyOps() {
  return {
    "constituency.where": async (input, api) => {
      const held = await holdDumps((input && input.dumps) || [], { roots: (input && input.roots) || [] });
      api.emit(whereAmI((input && input.point) || [0, 0], held));
    },
  };
}
