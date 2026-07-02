// composer/bisect.mjs — THE BISECT STACK: knowing your constituencies on device (docs/presence.md; the
// tell-side notes settled the atom — tell.anecdote.channel/notes/boundary-declaration.md and
// reporting-locus-rethink.md: an ATTESTED BOUNDARY is polygon + basis[], "official" is a provenance tag
// never load-bearing, boundaries are PLURAL and overlapping-non-nested is the NORMAL case, and authority
// emerges from convergence among many assertions — no single attester confers it).
//
// This is the client half: the state hub dumps the boundaries it knows as signed files; a device holds
// them (they ride any carrier — the gravel included) and bisects LOCALLY. "Where am I" is computed against
// held shapes and never leaves the device; only the CLAIM does (presence.mjs, whose bisect.method
// graduates here from "asserted" to "bisect" with the boundary's content hash riding in the claim).
//
// Geometry, honestly scoped: rings are [lon, lat] (GeoJSON order), treated PLANAR — right for the
// municipal/district scale these constituencies live at; geodesy and the antimeridian are out of scope and
// a boundary that needs them should say so in its basis. Containment is even-odd ray casting; a point on
// an edge may fall either way — constituencies are defined by their interiors, and a resident on the line
// has bigger questions than this module answers. A bbox precheck keeps a state's worth of shapes cheap.

import { attest, verifyAttestation, canonicalize } from "./sign.mjs";
import { defaultHash } from "./anecdote.mjs";

export const BOUNDARY = "anecdote.boundary/v1";
const te = new TextEncoder();

// ---- the attested boundary ------------------------------------------------------------------------------

// Build an unsigned boundary. `polygons` = [ [outerRing, ...holeRings], ... ] (multipolygon; one entry for
// the simple case), each ring = [[lon,lat],...] with ≥3 distinct points (closure is implied — a repeated
// last point is tolerated and dropped). `basis` says what the assertion is made of; it is provenance, not
// authority.
export function buildBoundary({ constituency, name = "", polygons, basis = [] } = {}) {
  if (!constituency || typeof constituency !== "string") throw new Error("bisect: a boundary names its constituency");
  const cleaned = (polygons || []).map((poly) => poly.map((ring) => {
    const r = ring.slice();
    if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
    if (r.length < 3) throw new Error("bisect: a ring needs at least 3 distinct points");
    for (const p of r) if (!Array.isArray(p) || p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) throw new Error("bisect: ring points are [lon, lat] numbers");
    return r;
  }));
  if (!cleaned.length) throw new Error("bisect: a boundary needs at least one polygon");
  return { schema: BOUNDARY, constituency, name, polygons: cleaned, basis };
}

export async function signBoundary(boundary, identity, opts = {}) { return attest(boundary, identity, opts); }

// The boundary's content id — the hash a presence claim carries as `bisect.boundary`, so a judge can check
// the CLAIM was made against the same shape everyone else holds.
export async function boundaryId(signed) { return defaultHash(te.encode(canonicalize(signed))); }

// Verify signature + shape. Returns { ok, by, trusted, constituency, id, errors }.
export async function verifyBoundary(signed, { friends = [] } = {}) {
  if (!signed || signed.schema !== BOUNDARY) return { ok: false, by: null, trusted: false, constituency: null, id: null, errors: ["not a boundary"] };
  const v = await verifyAttestation(signed, {});
  if (!v.ok) return { ok: false, by: v.by, trusted: false, constituency: null, id: null, errors: v.errors };
  try { buildBoundary(signed); } catch (e) { return { ok: false, by: v.by, trusted: false, constituency: null, id: null, errors: [e.message] }; }
  return { ok: true, by: v.by, trusted: friends.includes(v.by), constituency: signed.constituency,
           id: await boundaryId(signed), errors: [] };
}

// ---- the geometry ---------------------------------------------------------------------------------------

function inRing([x, y], ring) {                        // even-odd ray casting
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function bbox(polygons) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of polygons) for (const p of poly[0]) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return [x0, y0, x1, y1];
}

// Is `point` ([lon, lat]) inside this boundary? Inside the outer ring of any polygon and not inside any of
// that polygon's holes. The bbox cache lives in a WeakMap — NEVER on the boundary itself, whose canonical
// bytes are signed (an own-property cache would corrupt the very signature the bisect re-checks).
const bboxCache = new WeakMap();
export function contains(boundary, point) {
  const [x, y] = point;
  let bb = bboxCache.get(boundary);
  if (!bb) { bb = bbox(boundary.polygons); bboxCache.set(boundary, bb); }
  if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) return false;
  for (const poly of boundary.polygons) {
    if (!inRing(point, poly[0])) continue;
    let inHole = false;
    for (let h = 1; h < poly.length; h++) if (inRing(point, poly[h])) { inHole = true; break; }
    if (!inHole) return true;
  }
  return false;
}

// ---- the bisect -----------------------------------------------------------------------------------------

// Place a point against a set of VERIFIED boundaries (verifyBoundary first — an unverified shape places
// nobody). Returns EVERY containing constituency — plural on purpose: you belong to many overlapping,
// non-nested constituencies at once, and a point in city ∩ watershed answers with both. Deterministic
// order (by constituency, then id).
export async function bisect(point, signedBoundaries, { friends = [] } = {}) {
  const placements = [];
  for (const signed of signedBoundaries || []) {
    const v = await verifyBoundary(signed, { friends });
    if (!v.ok) continue;
    if (contains(signed, point)) placements.push({ constituency: v.constituency, boundary: v.id, by: v.by, trusted: v.trusted });
  }
  placements.sort((a, b) => (a.constituency < b.constituency ? -1 : a.constituency > b.constituency ? 1 : a.boundary < b.boundary ? -1 : 1));
  return placements;
}

// The graduation: placements in the exact shape presence.makeClaim takes — bisect.method becomes "bisect"
// and the boundary's content hash rides in the claim. One entry per containing constituency; the caller
// (or the person) picks which constituency this claim is about.
export async function placementsFor(point, signedBoundaries, opts = {}) {
  return (await bisect(point, signedBoundaries, opts)).map((p) => ({
    constituency: p.constituency,
    bisect: { method: "bisect", boundary: p.boundary },
  }));
}
