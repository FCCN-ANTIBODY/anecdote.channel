// Unit: the quell — two claims told apart by who signed. Author quell ends the QUESTION (terminal,
// prunes ballots); host quell closes ONE door (a de-listing that loses to same-host freshness).
// Run: node composer/quell.test.mjs
import { generateIdentity } from "./sign.mjs";
import { buildBallot, signBallot } from "./ballot.mjs";
import { addBallots, applyQuells } from "./satchel.mjs";
import { buildQuell, signQuell, verifyQuell, isQuell, quells, isAuthorQuell, supersededBy, stillLive } from "./quell.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const author = await generateIdentity();
const atlasA = await generateIdentity();
const stranger = await generateIdentity();

// 1. build/sign/verify; a dated poll needs none of this (its close date is the standing quell).
const endQ = await signQuell(buildQuell({ pile: "cd04-q1", poll: "budget", ts: "2026-07-04T00:00:00Z" }), author);
ok(isQuell(endQ) && (await verifyQuell(endQ)).ok && endQ.reason === "ended", "an author quell signs and verifies");
const archiveQ = await signQuell(
  buildQuell({ pile: "cd04-q1", poll: "budget", ts: "2026-07-01T00:00:00Z", reason: "archived", host: "atlas-a" }), atlasA);
ok((await verifyQuell(archiveQ)).ok && archiveQ.host === "atlas-a", "a host quell names its one door");

// 2. authority: terminal only when the signature IS the poll's known author.
ok(isAuthorQuell(endQ, author.fingerprint), "the author's hostless quell is terminal");
ok(!isAuthorQuell(archiveQ, atlasA.fingerprint), "a host quell is never terminal, even validly signed");
const forged = await signQuell(buildQuell({ pile: "cd04-q1", poll: "budget", ts: "2026-07-04T00:00:00Z" }), stranger);
ok(!isAuthorQuell(forged, author.fingerprint), "nobody quells someone else's question");

// 3. freshness: a same-host listing NEWER than the quell supersedes it; other hosts are irrelevant.
ok(supersededBy(archiveQ, { host: "atlas-a", ts: "2026-07-02T00:00:00Z" }), "newer same-host listing reopens the door");
ok(!supersededBy(archiveQ, { host: "atlas-a", ts: "2026-06-01T00:00:00Z" }), "an older listing is just stale");
ok(!supersededBy(archiveQ, { host: "atlas-b", ts: "2027-01-01T00:00:00Z" }), "another host's listing never applied");

// 4. stillLive: the client's one question.
const ctx = { authorKid: author.fingerprint };
ok(!stillLive({ ...ctx, quells: [endQ], listings: [{ host: "atlas-a", ts: "2027-01-01T00:00:00Z" }] }),
  "an author quell is final — no listing resurrects the question");
ok(stillLive({ ...ctx, quells: [forged] }), "a forged terminal claim changes nothing");
ok(!stillLive({ ...ctx, quells: [archiveQ], listings: [{ host: "atlas-a", ts: "2026-06-01T00:00:00Z" }] }),
  "the only known door quelled unsuperseded -> dead for me");
ok(stillLive({ ...ctx, quells: [archiveQ], listings: [{ host: "atlas-a", ts: "2026-06-01T00:00:00Z" }, { host: "atlas-b", ts: "2026-06-01T00:00:00Z" }] }),
  "a second, unquelled door keeps the poll alive (different archive policies coexist)");
ok(stillLive({ ...ctx, quells: [archiveQ], listings: [{ host: "atlas-a", ts: "2026-07-02T00:00:00Z" }] }),
  "your cache's newer refresh beats the quell — free to ignore it");

// 5. the pocket: a terminal quell retires what it names, one packet for N ballots.
const b1 = await signBallot(buildBallot({ pile: "cd04-q1", poll: "budget", answer: "Keep", ts: "2026-07-01T00:00:00Z" }), stranger);
const b2 = await signBallot(buildBallot({ pile: "cd04-q1", poll: "parks", answer: "More", ts: "2026-07-01T00:00:00Z" }), stranger);
const s = (await addBallots([], [b1, b2])).satchel;
const after = applyQuells(s, [endQ]);
ok(quells(endQ, b1) && !quells(endQ, b2), "a quell names exactly its poll");
ok(after.satchel.length === 1 && after.satchel[0].ballot.poll === "parks" && after.pruned.length === 1,
  "the quelled poll's ballots leave the pocket; everything else rides on");

process.exit(fails ? 1 : 0);
