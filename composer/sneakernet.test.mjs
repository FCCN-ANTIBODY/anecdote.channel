// Unit: the sneakernet (composer/sneakernet.mjs, civic-node #72). Two origins with divergent stale
// sets exchange stacks and CONVERGE on newest-per-Atlas; regression (older-over-newer) is refused;
// a different signer never replaces a kept canon; intruder/damaged tiles are caught by the set and
// named, never silently dropped; the ordinary offer is the masked overlap. Composes transfer.mjs —
// the transport half is proven there, not retested. Run: node composer/sneakernet.test.mjs
import { generateIdentity, attest } from "./sign.mjs";
import { defaultHash } from "./anecdote.mjs";
import { packStack, receiveStack, verifySnapshotRecord, newerOf, maskCarried, overlapOf } from "./sneakernet.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const te = new TextEncoder();
const T1 = "2026-07-01T00:00:00.000Z", T2 = "2026-07-05T00:00:00.000Z", T3 = "2026-07-08T00:00:00.000Z";
const NOW = "2026-07-09T00:00:00.000Z";

// an Atlas's signed record, as atlas bin/snapshot emits it (content inline, per-file ids, stamped at).
async function mkSnapshot(atlasId, at, identity, note = "r1") {
  const content = `- id: ${note}\n  scope: ${atlasId}\n`;
  return attest({ schema: "atlas.snapshot/v1", atlas: atlasId, url: `https://${atlasId}.example.org`, at,
    files: [{ path: "_data/piles.yml", id: await defaultHash(te.encode(content)), content }], absent: [] }, identity);
}

const atlasX = await generateIdentity(), atlasY = await generateIdentity(), atlasZ = await generateIdentity();
const alice = await generateIdentity(), bob = await generateIdentity();

const X1 = await mkSnapshot("xenia", T1, atlasX), X2 = await mkSnapshot("xenia", T2, atlasX, "r2");
const Y1 = await mkSnapshot("yampa", T1, atlasY);
const Z3 = await mkSnapshot("zuni", T3, atlasZ);

// 1. the record verifies from anyone; a flipped byte or a re-stamp fails.
{
  const v = await verifySnapshotRecord(X2, { signer: atlasX.fingerprint });
  ok(v.ok && v.trusted && v.at === T2, "a snapshot verifies from anyone; trusted against its atlas's pin");
  const doctored = JSON.parse(JSON.stringify(X2));
  doctored.files[0].content += "tamper";
  ok(!(await verifySnapshotRecord(doctored)).ok, "edited carried content fails (content-bound)");
  ok(newerOf(X1, X2).newer === "b" && newerOf(X1, Y1).comparable === false,
    "stamps of one canon order by date; different canons never compare");
}

// 2. the stack: newest-per-canon, carrier-attested set, invalid members refused from packing.
{
  const doctored = JSON.parse(JSON.stringify(Y1)); doctored.files[0].content += "x";
  const { layout, tiles, carried, refused } = await packStack([X1, X2, Z3, doctored], alice);
  ok(carried.join(",") === "xenia,zuni" && tiles.length === 2, "dedup keeps only the newest stamp per canon");
  ok(refused.length === 1 && refused[0].atlas === "yampa", "a carrier never attests a record that does not verify");
  ok(layout.shape.count === 2 && layout.shape.atlases.join(",") === "xenia,zuni" && layout.sig.by === alice.fingerprint,
    "the layout attests the whole set and names what it carries");
}

// 3. convergence: divergent sets exchange both ways and meet at newest-per-Atlas.
{
  // alice carries X@T2 + Y@T1; bob carries X@T1 + Z@T3.
  let aliceKept = (await receiveStack(await packStack([X2, Y1], alice), [], { now: NOW })).kept;
  let bobKept = (await receiveStack(await packStack([X1, Z3], bob), [], { now: NOW })).kept;
  const aliceStack = await packStack(aliceKept.map((k) => k.snapshot), alice);
  const bobStack = await packStack(bobKept.map((k) => k.snapshot), bob);
  const aliceAfter = await receiveStack(bobStack, aliceKept, { now: NOW });
  const bobAfter = await receiveStack(aliceStack, bobKept, { now: NOW });
  const brief = (kept) => kept.map((k) => `${k.atlas}@${k.stamped_at}`).sort().join(" ");
  ok(brief(aliceAfter.kept) === brief(bobAfter.kept) &&
     brief(aliceAfter.kept) === `xenia@${T2} yampa@${T1} zuni@${T3}`.split(" ").sort().join(" "),
    "both origins converge on newest-per-Atlas");
  ok(aliceAfter.keptNewer.some((r) => r.atlas === "xenia"), "alice's newer xenia stamp is kept, the older offer noted");
  ok(bobAfter.taken.find((t) => t.atlas === "xenia").carried_by === alice.fingerprint,
    "provenance rides: who handed it over, never identity theater");
  ok(aliceAfter.kept.every((k) => k.stamped_at && k.accepted_at === NOW),
    "every kept copy carries BOTH dates — staleness honest");
}

// 4. never regress, never swap canons.
{
  const kept = (await receiveStack(await packStack([X2], alice), [], { now: NOW })).kept;
  const older = await receiveStack(await packStack([X1], bob), kept, { now: NOW });
  ok(older.taken.length === 0 && older.keptNewer.length === 1 && older.kept[0].stamped_at === T2,
    "an older stamp never replaces the kept newer one");
  const impostor = await generateIdentity();
  const forged = await mkSnapshot("xenia", T3, impostor, "r9"); // fresher, wrong key
  const swap = await receiveStack(await packStack([forged], bob), kept, { now: NOW });
  ok(swap.taken.length === 0 && /new canon is a decision/.test(swap.refused[0].why),
    "a fresher stamp under a different key never replaces the canon in hand");
}

// 5. the pin gates first contact when held.
{
  const r = await receiveStack(await packStack([Z3], bob), [], { now: NOW, pins: { zuni: "key:sha256:" + "0".repeat(64) } });
  ok(r.taken.length === 0 && /not the pinned/.test(r.refused[0].why), "a held pin refuses a first contact under another key");
  const r2 = await receiveStack(await packStack([Z3], bob), [], { now: NOW, pins: { zuni: atlasZ.fingerprint } });
  ok(r2.taken.length === 1, "the right pin admits it");
}

// 6. the set catches what the eye can't: intruders named, damage named, valid members still taken.
{
  const stack = await packStack([X2, Y1], alice);
  const intruder = (await packStack([Z3], bob)).tiles[0]; // a real tile, but not of THIS attested set
  const r = await receiveStack({ layout: stack.layout, tiles: [...stack.tiles, intruder] }, [], { now: NOW });
  ok(r.taken.length === 2 && r.refused.some((x) => /intruder/.test(x.why)),
    "an unattested tile on the side is refused by the set; the attested members still land");
  const damaged = JSON.parse(JSON.stringify(stack.tiles[0])); damaged.bytes = damaged.bytes.slice(0, -4) + "AAAA";
  const r2 = await receiveStack({ layout: stack.layout, tiles: [damaged, stack.tiles[1]] }, [], { now: NOW });
  ok(r2.taken.length === 1 && r2.refused.length === 1, "a damaged tile is refused and named; the intact one lands");
}

// 7. the mask: the ordinary offer is the overlap; the full set stays a deliberate act.
{
  const mineCarried = ["xenia", "yampa"], theirsCarried = ["xenia", "zuni"];
  const overlap = overlapOf(mineCarried, theirsCarried);
  ok(overlap.join(",") === "xenia", "the overlap is what you both carry");
  const offered = maskCarried([X2, Y1], overlap);
  ok(offered.length === 1 && offered[0].atlas === "xenia", "the masked offer presents only the overlap");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall sneakernet tests passed");
