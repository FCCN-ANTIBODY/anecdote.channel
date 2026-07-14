// Unit: gate (gate.mjs) — the Atlas Gate. Proves: the reducer verdict admits by topic-collision with the
// Atlas's excludes (no LLM); a resolution binds the resolver's constituency+recency proof; verification
// refuses a lifted proof, an out-of-boundary resolver, or a stale one; and an item is admitted only on a
// QUORUM of distinct, valid, agreeing constituents. Real presence + enroll artifacts; a stub reducer (no
// model). Run: node composer/gate.test.mjs
import { generateIdentity } from "./sign.mjs";
import { mintAgeIdentity } from "./age-mint.mjs";
import { makeClaim, witnessClaim } from "./presence.mjs";
import { mintMembership } from "./enroll.mjs";
import {
  GATE_ITEM, GATE_RESOLUTION, buildItem, lodgeItem, itemId,
  gateVerdict, resolveItem, verifyResolution, admit,
} from "./gate.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// A stub reducer (model-free): the label is the text; tokens are its lowercased words. An Atlas that
// excludes "spam" then refuses any item whose words include it — deterministic, same as the real reducer path.
const reduce = (t) => ({ label: t, tokens: String(t || "").toLowerCase().split(/\s+/).filter(Boolean) });

const ATLAS = "atlas:boulder";
const C = "boulder.watershed";
const now = "2026-07-14T18:00:00.000Z";
const dest = { kind: "atlas", excludes: ["spam", "abuse"] };
const RECENCY = 4 * 60 * 60 * 1000;   // this Atlas wants presence within 4 hours

const witness = await generateIdentity();
// A constituency+recency proof for `who`, placed in `constituency`, stamped at `at`.
async function presenceProof(who, { at = now, constituency = C } = {}) {
  const claim = await makeClaim({ constituency, bisect: { method: "bisect", boundary: "b-1" }, at }, who);
  return witnessClaim(claim, { bisect: { method: "bisect", boundary: "b-1", constituency }, at }, witness);
}

// 1. the reducer verdict: eligible text admits; an excluded topic does not.
{
  const good = buildItem({ target: ATLAS, kind: "anecdote", text: "a story about my garden", at: now });
  const bad = buildItem({ target: ATLAS, text: "buy cheap spam now", at: now });
  ok(gateVerdict(good, dest, { reduce }).admit === true, "an item clear of the Atlas's excludes → admit");
  const v = gateVerdict(bad, dest, { reduce });
  ok(v.admit === false && v.topic === "spam", "an item colliding with an excluded topic → not admit (names the topic)");
}

// 2. itemId is stable over the entry-relevant facts (not the signature/time).
{
  const a = buildItem({ target: ATLAS, text: "hello", at: now });
  const b = buildItem({ target: ATLAS, text: "hello", at: "2020-01-01T00:00:00.000Z" });
  ok((await itemId(a)) === (await itemId(b)), "itemId ignores the timestamp — same target+kind+text is the same item");
}

// 3. resolveItem + verifyResolution: a valid, bound, in-boundary, recent resolution.
{
  const item = buildItem({ target: ATLAS, text: "a story about my garden", at: now });
  const resolver = await generateIdentity();
  const r = await resolveItem(item, dest, resolver, { proof: await presenceProof(resolver), reduce, at: now });
  ok(r.schema === GATE_RESOLUTION && r.admit === true, "a resolution carries the reducer verdict");
  const v = await verifyResolution(r, { atlasConstituency: C, recencyWindowMs: RECENCY, now });
  ok(v.ok && v.resolver === resolver.fingerprint && v.admit, "a bound, in-boundary, recent resolution verifies");
}

// 4. the anti-Sybil bindings: lifted proof, wrong boundary, stale presence all fail.
{
  const item = buildItem({ target: ATLAS, text: "a story", at: now });
  const resolver = await generateIdentity();

  const lifted = await resolveItem(item, dest, resolver, { proof: await presenceProof(await generateIdentity()), reduce, at: now });
  ok(!(await verifyResolution(lifted, { atlasConstituency: C, recencyWindowMs: RECENCY, now })).ok, "a proof lifted from someone else is refused");

  const elsewhere = await resolveItem(item, dest, resolver, { proof: await presenceProof(resolver, { constituency: "denver.council" }), reduce, at: now });
  ok(!(await verifyResolution(elsewhere, { atlasConstituency: C, recencyWindowMs: RECENCY, now })).ok, "a resolver outside the Atlas's boundary is refused");

  const stale = await resolveItem(item, dest, resolver, { proof: await presenceProof(resolver, { at: "2026-07-14T12:00:00.000Z" }), reduce, at: now }); // 6h old
  ok(!(await verifyResolution(stale, { atlasConstituency: C, recencyWindowMs: RECENCY, now })).ok, "a stale presence (older than the recency window) is refused");

  const recentEnough = await resolveItem(item, dest, resolver, { proof: await presenceProof(resolver, { at: "2026-07-14T15:00:00.000Z" }), reduce, at: now }); // 3h old
  ok((await verifyResolution(recentEnough, { atlasConstituency: C, recencyWindowMs: RECENCY, now })).ok, "presence within the window is accepted");
}

// 5. THE QUORUM: an item is admitted only on ≥quorum distinct valid agreeing constituents.
{
  const item = buildItem({ target: ATLAS, text: "a story about my garden", at: now });
  const opts = { atlasConstituency: C, recencyWindowMs: RECENCY, now, quorum: 2 };
  const mk = async () => { const id = await generateIdentity(); return resolveItem(item, dest, id, { proof: await presenceProof(id), reduce, at: now }); };

  const one = await mk();
  ok(!(await admit(item, [one], opts)).admitted, "one voter does not reach a quorum of 2");

  const two = [one, await mk()];
  const a2 = await admit(item, two, opts);
  ok(a2.admitted && a2.forCount === 2, "two distinct in-boundary constituents reach quorum → admitted");

  // a duplicate resolver (same identity, two resolutions) counts once.
  const dupId = await generateIdentity();
  const d1 = await resolveItem(item, dest, dupId, { proof: await presenceProof(dupId), reduce, at: now });
  const d2 = await resolveItem(item, dest, dupId, { proof: await presenceProof(dupId), reduce, at: now });
  const dupFold = await admit(item, [d1, d2], opts);
  ok(dupFold.forCount === 1 && !dupFold.admitted, "one body, one vote — a duplicate resolver counts once");

  // an out-of-boundary voter is dropped from the tally, not counted toward quorum.
  const outsider = await generateIdentity();
  const outRes = await resolveItem(item, dest, outsider, { proof: await presenceProof(outsider, { constituency: "denver.council" }), reduce, at: now });
  const mixed = await admit(item, [one, outRes], opts);
  ok(!mixed.admitted && mixed.forCount === 1 && mixed.invalid.length === 1, "an out-of-boundary voter is dropped, quorum not reached");
}

// 6. an ineligible item never gathers admit=true votes — honest resolvers vote it down.
{
  const bad = buildItem({ target: ATLAS, text: "buy cheap spam now", at: now });
  const opts = { atlasConstituency: C, recencyWindowMs: RECENCY, now, quorum: 2 };
  const mk = async () => { const id = await generateIdentity(); return resolveItem(bad, dest, id, { proof: await presenceProof(id), reduce, at: now }); };
  const a = await admit(bad, [await mk(), await mk(), await mk()], opts);
  ok(!a.admitted && a.forCount === 0 && a.againstCount === 3, "an excluded item is voted down by every honest resolver → not admitted");
}

// 7. a membership can stand in for the presence proof (do-you-belong + recency via its stamp).
{
  const item = buildItem({ target: ATLAS, text: "a garden story", at: now });
  const resolver = await generateIdentity();
  const atlasId = await generateIdentity();
  const memberAge = await mintAgeIdentity();
  const membership = await mintMembership({ atlas: "boulder", constituency: C, recipient: memberAge.recipient, member: resolver.fingerprint }, atlasId, { at: now, window: 24 * 60 * 60 * 1000 });
  const r = await resolveItem(item, dest, resolver, { proof: membership, reduce, at: now });
  const v = await verifyResolution(r, { atlasConstituency: C, recencyWindowMs: RECENCY, now: "2026-07-14T20:00:00.000Z" }); // 2h later
  ok(v.ok && v.admit, "a fresh membership stands in as the constituency+recency proof");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall gate tests passed");
