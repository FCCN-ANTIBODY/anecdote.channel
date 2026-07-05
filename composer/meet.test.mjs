// Unit: the meet — the combined gesture moment's trade, end to end between two parties in
// memory. Greeting-driven solicitation, scope-directed couriering, quells-before-ballots on
// receive, and the co-signed exchange receipt. Run: node composer/meet.test.mjs
import { generateIdentity } from "./sign.mjs";
import { buildBallot, signBallot } from "./ballot.mjs";
import { buildQuell, signQuell } from "./quell.mjs";
import { addBallots } from "./satchel.mjs";
import { greeting, meetOffer, receiveMeet, exchangeReceipt, countersign, verifyExchange,
         transcriptIds, GREETING_SCHEMA } from "./meet.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const alice = await generateIdentity();
const bob = await generateIdentity();
const author = await generateIdentity();
const voter = await generateIdentity();

const mint = (poll, answer, labels, scope) =>
  signBallot(buildBallot({ pile: "cd04-q1", poll, answer, ts: "2026-07-01T00:00:00Z", labels, scope }), voter);

// Alice carries: budget (her pin), parks (slush), a roads ballot scoped to oregon, and an
// author quell for the dead "old-poll" whose ballot still lingers in her pocket.
const aBudget = await mint("budget", "Keep", ["budget"]);
const aParks = await mint("parks", "More", ["parks"]);
const aRoads = await mint("roads", "Fix", ["roads"], "oregon");
const aDead = await mint("old-poll", "Yes", ["old"]);
const endQ = await signQuell(buildQuell({ pile: "cd04-q1", poll: "old-poll", ts: "2026-07-02T00:00:00Z" }), author);
let alicehold = { satchel: (await addBallots([], [aBudget, aParks, aRoads, aDead])).satchel, quells: [endQ] };

// Bob pins parks, can turn in for oregon, and unknowingly still carries the dead poll's ballot.
const bDead = await mint("old-poll", "No", ["old"]);
let bobhold = { satchel: (await addBallots([], [bDead])).satchel, quells: [] };
const bobHello = greeting({ pins: ["parks"], scopes: ["oregon"] });
ok(bobHello.schema === GREETING_SCHEMA, "a greeting declares pins + scopes");

// 1. Alice's offer to Bob: her quell, her budget push, the parks slush HIS pins solicited,
//    and the oregon-scoped roads ballot HE can turn in — the dead ballot stays home.
const offer = meetOffer(alicehold, { pins: ["budget"], peerGreeting: bobHello });
const polls = offer.ballots.map((b) => b.poll);
ok(offer.quells.length === 1, "quells ride first and whole");
ok(polls[0] === "budget", "the push tier leads the wire");
ok(polls.includes("parks"), "the peer's pins solicited the slush without a second round");
ok(polls.includes("roads"), "scope-directed couriering: the oregon ballot goes to the oregon-bound peer");
ok(!polls.includes("old-poll"), "the dead ballot had nothing selecting it (a carrier who LEARNS a quell prunes at receive, as Bob is about to)");

// 2. Bob receives: the quell verifies, turns terminal via the author kid he knows, prunes his
//    own lingering dead ballot, and blocks the incoming budget/parks/roads NOT AT ALL.
const bAfter = await receiveMeet(bobhold, offer, {
  pins: ["parks"], now: Date.parse("2026-07-03T00:00:00Z"),
  authorKidFor: (pile, poll) => (poll === "old-poll" ? author.fingerprint : undefined),
});
ok(bAfter.quells.length === 1, "the quell entered Bob's hold to spread onward");
ok(bAfter.pruned.length === 1 && bAfter.pruned[0].ballot.poll === "old-poll",
  "the quell retired Bob's own lingering ballot before anything landed");
const bPolls = bAfter.satchel.map((e) => e.ballot.poll).sort();
ok(JSON.stringify(bPolls) === JSON.stringify(["budget", "parks", "roads"]), "the live traffic landed: " + bPolls);

// a forged quell in an offer is ignored entirely
const forged = { ...endQ, ts: "2026-01-01T00:00:00Z" };
const unmoved = await receiveMeet({ satchel: bAfter.satchel, quells: [] }, { quells: [forged], ballots: [] }, {});
ok(unmoved.quells.length === 0 && unmoved.satchel.length === 3, "a tampered quell neither enters nor prunes");

// 3. The co-signed receipt: Alice signs the transcript naming Bob; Bob countersigns; anyone
//    verifies both signatures AND that the countersigner is the named peer.
const ids = await transcriptIds(offer);
ok(ids.length === offer.quells.length + offer.ballots.length, "the transcript summarizes what crossed");
const receipt = await exchangeReceipt({ peer: bob.fingerprint, ts: "2026-07-03T00:00:00Z", sent: ids }, alice);
const sealed = await countersign(receipt, bob);
const v = await verifyExchange(sealed);
ok(v.ok && v.author === alice.fingerprint && v.peer === bob.fingerprint, "two signatures, one transcript, both named");
const mallory = await generateIdentity();
ok(!(await verifyExchange(await countersign(receipt, mallory))).ok,
  "a receipt countersigned by anyone but the named peer is not evidence of THIS meet");
ok(!(await verifyExchange({ ...sealed, receipt: { ...receipt, sent: [] } })).ok,
  "a rewritten transcript fails the countersignature");

process.exit(fails ? 1 : 0);
