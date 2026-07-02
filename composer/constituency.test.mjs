// Unit: the self-constituency assertion — hold atlas dumps (verify the ledger AND every shape's own Tell
// signature), bisect the holder's position LOCALLY, answer "does my literal position fall inside any of
// these, competing included?" The position never leaves; only the graduated CLAIM does. Closes the loop:
// a placement drops straight into presence.makeClaim. Run: node composer/constituency.test.mjs
import { generateIdentity, attest } from "./sign.mjs";
import { buildBoundary, signBoundary, boundaryId } from "./bisect.mjs";
import { makeClaim, verifyClaim } from "./presence.mjs";
import { verifyDump, holdDumps, whereAmI, constituencyOps, DUMP } from "./constituency.mjs";
import { elevatedSession, request, FRAME } from "./probe-line.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const tellA = await generateIdentity();      // signs Colorado shapes
const tellB = await generateIdentity();      // signs a watershed + a proposal
const atlasCO = await generateIdentity();    // a Colorado atlas (a root the holder walked to)
const atlasWater = await generateIdentity(); // another atlas that also carries the watershed
const stranger = await generateIdentity();

const sq = (x0, y0, x1, y1) => [[[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]]];
const parkside = await signBoundary(buildBoundary({ constituency: "parkside", polygons: sq(0, 0, 10, 10) }), tellA);
const watershed = await signBoundary(buildBoundary({ constituency: "poudre", polygons: sq(5, 5, 20, 20) }), tellB);
const parksideShrunk = await signBoundary(buildBoundary({ constituency: "parkside", polygons: sq(0, 0, 8, 8) }), tellB);
parksideShrunk.proposes = { for: "parkside", replaces: await boundaryId(parkside) };
const parksideProposal = await attest({ ...parksideShrunk, sig: undefined }, tellB);  // re-sign WITH proposes inside

async function dump(atlasId, name, memberArtifacts, proposalArtifacts = []) {
  const members = [];
  for (const a of memberArtifacts) members.push({ tell: "t", id: await boundaryId(a), anchored: null, artifact: a });
  const proposals = [];
  for (const a of proposalArtifacts) proposals.push({ tell: "t", id: await boundaryId(a), artifact: a });
  return attest({ schema: DUMP, atlas: name, at: "2026-07-02T21:00:00.000Z", windowDays: 90, boundary: null,
    memberIds: members.map((m) => m.id), members, proposals, expired: [], refused: [] }, atlasId);
}

// 1. verifyDump: the ledger verifies, members re-verify by their OWN Tell signature, a bent member is dropped.
{
  const d = await dump(atlasCO, "colorado", [parkside, watershed], [parksideProposal]);
  const v = await verifyDump(d, { roots: [atlasCO.fingerprint] });
  ok(v.ok && v.by === atlasCO.fingerprint && v.atlasTrusted, "a dump's ledger verifies; a root signer is trusted");
  ok(v.members.length === 2 && v.members.every((m) => m.tellSigner === tellA.fingerprint || m.tellSigner === tellB.fingerprint),
     "each member re-verified by its OWN Tell signature (not the atlas's word)");
  ok(v.proposals.length === 1 && v.proposals[0].proposes.for === "parkside", "the proposal is surfaced apart, its referent intact");

  const bentLedger = JSON.parse(JSON.stringify(d)); bentLedger.atlas = "not-colorado";
  ok(!(await verifyDump(bentLedger)).ok, "a tampered ledger fails the atlas signature");
  // an atlas HONESTLY signs its ledger over a member whose own signature is junk (an atlas relays; it does
  // not re-verify). The ledger verifies; the junk member fails ITS signature and is dropped, never bisected.
  const junkMember = JSON.parse(JSON.stringify(parkside)); junkMember.constituency = "forged-by-relay";
  const relayed = await dump(atlasCO, "colorado", [junkMember, watershed]);
  const vb = await verifyDump(relayed);
  ok(vb.ok && vb.members.length === 1 && vb.members[0].constituency === "poudre" && vb.dropped.length === 1,
     "a member whose OWN signature no longer holds is dropped, not bisected (the atlas's word is never trusted)");
  const untrusted = await verifyDump(d, { roots: [] });
  ok(untrusted.ok && !untrusted.atlasTrusted, "a dump from a non-root still verifies (verify-from-anyone) but is untrusted");
}

// 2. holdDumps: the bundle — dedupe a shape carried by two atlases, remember every carrier + trust.
{
  const dCO = await dump(atlasCO, "colorado", [parkside, watershed], [parksideProposal]);
  const dWater = await dump(atlasWater, "poudre-atlas", [watershed]);   // a second atlas also carries the watershed
  const held = await holdDumps([dCO, dWater], { roots: [atlasCO.fingerprint] });
  ok(held.boundaries.length === 2, "a shape carried by two atlases is held ONCE (deduped by content id)");
  const ws = held.boundaries.find((b) => b.constituency === "poudre");
  ok(ws.atlases.length === 2 && ws.atlases.includes("colorado") && ws.atlases.includes("poudre-atlas"), "…remembering every atlas that carried it");
  ok(ws.trustedCarrier === true, "…and that at least one carrier was a trusted root");
  ok(held.atlases.length === 2 && held.atlases.every((a) => a.ok), "both dumps recorded as held");
}

// 3. whereAmI: PLURAL — every containing shape, claims + proposals; the graduation-ready bisect rides along.
{
  const held = await holdDumps([await dump(atlasCO, "colorado", [parkside, watershed], [parksideProposal])], { roots: [atlasCO.fingerprint] });

  const at99 = whereAmI([9, 9], held);   // inside parkside claim + watershed; OUTSIDE the shrunk proposal
  ok(at99.placements.map((p) => p.constituency).join(",") === "parkside,poudre", "at [9,9]: BOTH containing claims, plural and ordered");
  ok(at99.proposalPlacements.length === 0, "…the shrunk proposal does not contain [9,9]");
  ok(at99.ambiguity.containing === 2 && at99.ambiguity.contested.includes("parkside"),
     "the judge's grade: 2 containing, and 'parkside' CONTESTED — under the claim I'm in, under the rival proposal I'm not");

  const at44 = whereAmI([4, 4], held);   // inside parkside claim + its proposal; OUTSIDE watershed
  ok(at44.placements.map((p) => p.constituency).join(",") === "parkside", "at [4,4]: only parkside claims me");
  ok(at44.proposalPlacements.length === 1 && at44.proposalPlacements[0].proposes.for === "parkside",
     "…and the parkside proposal contains me — a wish I could SELECT to start a symbology");
  ok(at44.ambiguity.contested.length === 0, "…claim and proposal AGREE here, so nothing contested");

  const outside = whereAmI([50, 50], held);
  ok(outside.placements.length === 0 && outside.ambiguity.containing === 0, "standing in nobody's shape places nowhere");
}

// 4. THE LOOP CLOSES: a placement graduates straight into a presence claim (method 'bisect', boundary hash).
{
  const me = await generateIdentity();
  const held = await holdDumps([await dump(atlasCO, "colorado", [parkside, watershed])], { roots: [atlasCO.fingerprint] });
  const placement = whereAmI([9, 9], held).placements[0];
  const claim = await makeClaim({ ...placement, at: "2026-07-02T21:05:00.000Z" }, me);
  const v = await verifyClaim(claim);
  ok(v.ok && claim.bisect.method === "bisect" && claim.bisect.boundary === placement.boundary,
     "a placement drops into presence.makeClaim → a signed claim that GRADUATED from 'asserted', geometry named");
  ok(claim.bisect.boundary === await boundaryId(parkside), "…the claim cites the exact boundary hash any judge can re-check against the dump");
}

// 5. over the probe line: Rung 0 — bisecting held shapes is perception; works even in incognito.
{
  const dCO = await dump(atlasCO, "colorado", [parkside, watershed], [parksideProposal]);
  const frames = [];
  const s = elevatedSession({ ops: constituencyOps(), emit: (f) => frames.push(f), context: () => ({ recordingOn: false, grants: [] }) });
  await s.handle(request({ id: "w", op: "constituency.where", input: { point: [9, 9], dumps: [dCO], roots: [atlasCO.fingerprint] } }));
  const out = frames.find((f) => f.type === FRAME && f.placements);
  ok(out && out.placements.length === 2, "constituency.where returns the plural assertion — Rung 0, runs in incognito (the position never leaves)");
}

// 6. cross-repo, guarded: the REAL atlas dump builder produces a dump this client drinks — Tell → Atlas →
// client → graduated claim, three repos on every byte. Skips honestly if the atlas sibling isn't present.
{
  const { existsSync, mkdtempSync, writeFileSync, mkdirSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const path = (await import("node:path")).default;
  const atlasDump = path.resolve(process.cwd(), "../atlas.anecdote.channel/bin/dump.mjs");
  if (existsSync(atlasDump)) {
    const atlas = await import(atlasDump);
    const tell = await generateIdentity();
    const co4 = await signBoundary(buildBoundary({ constituency: "colorado-4", polygons: sq(-105, 37, -102, 41) }), tell);
    const dir = mkdtempSync(path.join(tmpdir(), "atlas-real-"));
    writeFileSync(path.join(dir, "atlas.yml"), "id: colorado\nscope: colorado\n");
    const bdir = path.join(dir, "_data/boundaries/tell"); mkdirSync(path.join(bdir, "renewals"), { recursive: true });
    process.env.ATLAS_DUMP_KEY = path.join(dir, "dump.pk8");
    writeFileSync(path.join(bdir, "colorado-4.json"), JSON.stringify(co4));
    const id = await boundaryId(co4);
    writeFileSync(path.join(bdir, "renewals/colorado-4.json"),
      JSON.stringify(await attest({ schema: "anecdote.boundary-renewal/v1", boundary: id, slug: "colorado-4", at: "2026-07-01T00:00:00Z" }, tell)));
    const { dump: realDump } = await atlas.buildDump(dir, { windowDays: 90, now: "2026-07-02T21:00:00.000Z" });
    const held = await holdDumps([realDump], { roots: [] });
    ok(held.boundaries.length === 1 && held.boundaries[0].constituency === "colorado-4",
       "the client drinks a dump from the REAL atlas builder and holds its member");
    const plains = whereAmI([-103.5, 39.5], held), slope = whereAmI([-107, 39], held);
    ok(plains.placements.length === 1 && plains.placements[0].constituency === "colorado-4" && slope.placements.length === 0,
       "eastern plains bisect INTO colorado-4, western slope does not — three repos agree");
    const me = await generateIdentity();
    const claim = await makeClaim({ ...plains.placements[0], at: "2026-07-02T21:05:00Z" }, me);
    ok((await verifyClaim(claim)).ok && claim.bisect.boundary === held.boundaries[0].id,
       "THE LOOP CLOSES: Tell → real Atlas dump → client bisect → a graduated presence claim citing the exact hash");
  } else {
    console.log("  ok: (cross-repo atlas-builder leg SKIPPED — no sibling atlas.anecdote.channel checkout)");
  }
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall constituency tests passed");
