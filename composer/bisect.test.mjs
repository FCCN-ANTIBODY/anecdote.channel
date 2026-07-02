// Unit: the bisect stack — attested boundaries (polygon + basis[], signed, PLURAL) and on-device
// point-in-polygon, ending in the graduation: a presence claim whose bisect.method is "bisect" with the
// boundary's content hash inside, witnessed by a witness who bisected the same place.
// Run: node composer/bisect.test.mjs
import { generateIdentity } from "./sign.mjs";
import { buildBoundary, signBoundary, verifyBoundary, boundaryId, contains, bisect, placementsFor, BOUNDARY } from "./bisect.mjs";
import { makeClaim, witnessClaim, verifyWitness } from "./presence.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const hub = await generateIdentity();        // the state hub's key — provenance, never authority
const alice = await generateIdentity();
const walker = await generateIdentity();

// Shapes (lon, lat — planar at this scale). A city square, an overlapping watershed, a district with a
// hole (the park is carved out), and a two-island multipolygon.
const city = await signBoundary(buildBoundary({ constituency: "city-fc", polygons: [[[[0, 0], [10, 0], [10, 10], [0, 10]]]], basis: [{ kind: "official", note: "municipal GIS" }] }), hub);
const watershed = await signBoundary(buildBoundary({ constituency: "watershed-p", polygons: [[[[5, 5], [20, 5], [20, 20], [5, 20]]]], basis: [{ kind: "drawn", note: "USGS trace" }] }), hub);
const holed = await signBoundary(buildBoundary({ constituency: "district-9", polygons: [[[[0, 0], [10, 0], [10, 10], [0, 10]], [[4, 4], [6, 4], [6, 6], [4, 6]]]] }), hub);
const islands = await signBoundary(buildBoundary({ constituency: "twin-isles", polygons: [[[[0, 0], [2, 0], [2, 2], [0, 2]]], [[[8, 8], [10, 8], [10, 10], [8, 10]]]] }), hub);
const ALL = [city, watershed, holed, islands];

// 1. shape rules: degenerate rings and bent signatures place nobody.
{
  let threw = 0;
  try { buildBoundary({ constituency: "x", polygons: [[[[0, 0], [1, 1]]]] }); } catch { threw++; }
  try { buildBoundary({ constituency: "x", polygons: [] }); } catch { threw++; }
  try { buildBoundary({ polygons: [[[[0, 0], [1, 0], [1, 1]]]] }); } catch { threw++; }
  ok(threw === 3, "two-point rings / no polygons / no constituency are refused at build time");
  const bent = JSON.parse(JSON.stringify(city)); bent.constituency = "city-elsewhere";
  ok(!(await verifyBoundary(bent)).ok, "a bent boundary fails verification");
  ok((await bisect([1, 1], [bent])).length === 0, "…and an unverified shape places NOBODY");
  const closed = buildBoundary({ constituency: "x", polygons: [[[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]]] });
  ok(closed.polygons[0][0].length === 4, "a repeated closing point is tolerated and dropped");
}

// 2. geometry: convexity not assumed, holes are outside, islands are one constituency.
{
  ok(contains(city, [1, 1]) && !contains(city, [11, 5]), "in the square / off the square");
  const concave = buildBoundary({ constituency: "c", polygons: [[[[0, 0], [10, 0], [10, 10], [5, 5], [0, 10]]]] });
  ok(contains(concave, [2, 3]) && !contains(concave, [5, 8]), "a concave notch is respected");
  ok(contains(holed, [2, 2]) && !contains(holed, [5, 5]), "inside the district, but the carved-out park is OUTSIDE");
  ok(contains(islands, [1, 1]) && contains(islands, [9, 9]) && !contains(islands, [5, 5]), "two islands, one constituency; the strait between is neither");
}

// 3. THE PLURAL BISECT: overlapping, non-nested constituencies are the normal case.
{
  const both = await bisect([7, 7], ALL);
  ok(both.map((p) => p.constituency).join(",") === "city-fc,district-9,watershed-p",
     "a point in the overlap answers with EVERY containing constituency (city ∩ district ∩ watershed)");
  const cityOnly = await bisect([2, 2], ALL);
  ok(cityOnly.some((p) => p.constituency === "city-fc") && !cityOnly.some((p) => p.constituency === "watershed-p"),
     "a point outside the overlap answers with only its own");
  ok((await bisect([50, 50], ALL)).length === 0, "a point in nobody's shape places nowhere");
  const withFriends = await bisect([2, 2], ALL, { friends: [hub.fingerprint] });
  ok(withFriends.every((p) => p.trusted && p.by === hub.fingerprint), "placements carry the asserter + local trust (provenance, not authority)");
}

// 4. determinism: same shapes, same ids, stable order — the hash a judge re-checks.
{
  const id1 = await boundaryId(city), id2 = await boundaryId(city);
  ok(id1 === id2 && id1.startsWith("sha256:"), "a boundary's content id is stable");
  const a = await bisect([7, 7], ALL), b = await bisect([7, 7], [...ALL].reverse());
  ok(JSON.stringify(a) === JSON.stringify(b), "bisect order is deterministic regardless of dump order");
}

// 5. THE GRADUATION: bisect → claim (method "bisect", boundary hash inside) → witnessed by a witness who
// bisected the same place → copresent. The whole presence stack, grounded in geometry.
{
  const placements = await placementsFor([2, 2], ALL);
  const cityPlacement = placements.find((p) => p.constituency === "city-fc");
  ok(cityPlacement && cityPlacement.bisect.method === "bisect" && cityPlacement.bisect.boundary === await boundaryId(city),
     "placementsFor yields claim-ready placements: method 'bisect', the boundary's hash riding along");
  const claim = await makeClaim({ ...cityPlacement, at: "2026-07-02T18:00:00.000Z" }, alice);
  ok(claim.bisect.method === "bisect" && claim.bisect.boundary === await boundaryId(city),
     "the claim GRADUATES from 'asserted' — geometry named, hash checkable by any judge holding the dump");
  const wPlace = (await placementsFor([3, 3], ALL)).find((p) => p.constituency === "city-fc");
  const record = await witnessClaim(claim, { bisect: { ...wPlace.bisect, constituency: wPlace.constituency }, at: "2026-07-02T18:01:00.000Z" }, walker);
  const v = await verifyWitness(record);
  ok(v.ok && v.copresent && v.fresh, "witness bisected the same place a minute later → copresent + fresh: two placements, one moment");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall bisect tests passed");
