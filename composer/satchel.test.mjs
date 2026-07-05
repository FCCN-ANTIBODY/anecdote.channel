// Unit: the satchel — what you carry for others. Verify-before-keep, dedup convergence, the pinned
// conduit vs the last-N passive buffer, the reducer screen seam, staleness pruning, and the
// arrived() hold-for-turn-in partition. Run: node composer/satchel.test.mjs
import { generateIdentity } from "./sign.mjs";
import { buildBallot, signBallot } from "./ballot.mjs";
import { addBallots, exchangeOffer, solicit, takeOffered, pruneSatchel, arrived, isPinned } from "./satchel.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const me = await generateIdentity();
const T0 = Date.parse("2026-07-01T00:00:00Z");
const mint = async (poll, i, labels, scope = "colorado") =>
  signBallot(buildBallot({ pile: "cd04-q1", poll, answer: "a" + i, ts: new Date(T0 + i * 60000).toISOString(),
                           labels, scope }), me);

// 1. add: verify-from-anyone before keeping; dedup by content id; screen drops quietly-but-accounted.
const b1 = await mint("budget", 1, ["budget"]);
const b2 = await mint("parks", 2, ["parks"]);
let r = await addBallots([], [b1, b2, b1, { ...b1, answer: "forged" }, "garbage"]);
ok(r.satchel.length === 2 && r.added.length === 2, "kept two of five");
ok(r.dropped.some((d) => d.why === "already carried"), "duplicate converged");
ok(r.dropped.some((d) => /does not verify/.test(d.why)), "a forged ballot never enters the pocket");
r = await addBallots([], [b1, b2], { screen: (b) => b.poll !== "parks" });
ok(r.satchel.length === 1 && r.dropped.some((d) => d.why === "screened"),
  "the reducer's quiet constitutional check drops in-category-but-unwanted");

// 2. the meet: offer everything; the receiver's pins + caps shape the pocket.
const flood = [];
for (let i = 0; i < 120; i++) flood.push(await mint("bland", i + 10, ["bland"]));
const pinnedFlood = [];
for (let i = 0; i < 120; i++) pinnedFlood.push(await mint("budget", i + 200, ["budget"]));
const mine = await takeOffered([], [...flood, ...pinnedFlood], { pins: ["budget"], cap: 100, now: T0 + 10 ** 9 });
ok(mine.satchel.filter((e) => isPinned(e, ["budget"])).length === 120, "pinned conduit rides uncapped");
ok(mine.satchel.filter((e) => !isPinned(e, ["budget"])).length === 100, "the passive buffer keeps the last 100 per label");
const newestBland = mine.satchel.filter((e) => e.ballot.poll === "bland").map((e) => e.ballot.answer);
ok(!newestBland.includes("a10") && newestBland.includes("a129"), "the buffer keeps the NEWEST, drops the oldest");

// 3. the exchange economy: pins are the PUSH tier (first on the wire, newest first); the slush is
// pull-only, solicitable by label, never pushed.
const offer = exchangeOffer(mine.satchel, { pins: ["budget"] });
ok(offer.push.length === 120 && offer.available.length === 100, "push carries the pinned tier; slush stays available");
ok(offer.push.every((b) => (b.labels || []).includes("budget")), "everything pushed is what I champion");
ok(Date.parse(offer.push[0].ts) >= Date.parse(offer.push[offer.push.length - 1].ts),
  "push rides newest first — a truncated session still moved the freshest");
ok(offer.push.length + offer.available.length === mine.satchel.length, "the two tiers are the whole carry");
const asked = solicit(mine.satchel, ["bland"]);
ok(asked.length === 100 && asked.every((b) => b.labels.includes("bland")), "solicit pulls the slush by label");
ok(solicit(mine.satchel, ["nope"]).length === 0, "nobody gets what nobody carries");

// 4. staleness: the passive buffer goes stale and prunes; pins do not.
const old = await mint("bland", 1, ["bland"]);
const pinnedOld = await mint("budget", 1, ["budget"]);
let s = (await addBallots([], [old, pinnedOld])).satchel;
s = pruneSatchel(s, { pins: ["budget"], now: T0 + 40 * 86400000, staleAfterMs: 30 * 86400000 });
ok(s.length === 1 && s[0].ballot.poll === "budget", "stale passive traffic prunes; the pinned conduit stays");

// 5. arrived: inside the constituency it was trying to reach -> turn in, stop re-broadcasting.
const away = await mint("budget", 3, ["budget"], "oregon");
const both = (await addBallots([], [b1, away])).satchel;
const part = arrived(both, ["colorado"]);
ok(part.turnIn.length === 1 && part.turnIn[0].ballot.scope === "colorado", "a colorado ballot in colorado turns in");
ok(part.carryOn.length === 1 && part.carryOn[0].ballot.scope === "oregon", "an oregon ballot keeps riding");

process.exit(fails ? 1 : 0);
