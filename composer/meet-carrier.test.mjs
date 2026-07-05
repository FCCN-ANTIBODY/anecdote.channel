// Unit: the meet's physical leg — hello and trade over real frames, caught by a real carrier
// session out of order, duplicated, and with an intruder on the side. One voice enforced: a
// member signed by anyone but the layout's signer is not part of the trade.
// Run: node composer/meet-carrier.test.mjs
import { generateIdentity } from "./sign.mjs";
import { buildBallot, signBallot } from "./ballot.mjs";
import { buildQuell, signQuell } from "./quell.mjs";
import { addBallots } from "./satchel.mjs";
import { greeting, meetOffer, receiveMeet } from "./meet.mjs";
import { packTransfer } from "./transfer.mjs";
import { carrierSession, fountainTransfer } from "./carrier.mjs";
import { packGreeting, unpackGreeting, packMeetOffer, meetFrames, unpackMeetOffer,
         KIND_BALLOTS } from "./meet-carrier.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const alice = await generateIdentity();
const bob = await generateIdentity();
const mallory = await generateIdentity();
const voter = await generateIdentity();

// --- HELLO: Bob's greeting crosses as one standalone transfer's frames.
const bobHello = greeting({ pins: ["parks"], scopes: ["oregon"] });
const helloEnv = await packGreeting(bobHello, bob);
const helloStream = await fountainTransfer(helloEnv, { blockSize: 128 });
const helloCatch = carrierSession({});
for (const f of helloStream.frames(30)) await helloCatch.feed(f);
const helloResult = await helloCatch.result();
ok(helloResult.ok, "the hello completes from its droplets");
const caughtHello = unpackGreeting(helloResult.transfers[0].verify);
ok(caughtHello && caughtHello.pins[0] === "parks", "the greeting survives the wire: " + JSON.stringify(caughtHello));
ok(unpackGreeting({ ...helloResult.transfers[0].verify, kind: "meet-ballots" }) === null, "a non-greeting never parses as one");

// --- TRADE: Alice's offer, shaped by the caught hello, over a signed layout.
const mint = (poll, answer, labels, scope) =>
  signBallot(buildBallot({ pile: "cd04-q1", poll, answer, ts: "2026-07-01T00:00:00Z", labels, scope }), voter);
const satchel = (await addBallots([], [
  await mint("budget", "Keep", ["budget"]), await mint("parks", "More", ["parks"]),
  await mint("roads", "Fix", ["roads"], "oregon"),
])).satchel;
const endQ = await signQuell(buildQuell({ pile: "cd04-q1", poll: "old-poll", ts: "2026-07-02T00:00:00Z" }), alice);
const offer = meetOffer({ satchel, quells: [endQ] }, { pins: ["budget"], peerGreeting: caughtHello });

const packed = await packMeetOffer(offer, alice);
const wire = await meetFrames(packed, { blockSize: 128 });
ok(wire.streams.length === 2, "two member streams, quells leading the wire order");

// Bob catches: frames shuffled, duplicated, plus an INTRUDER tile from Mallory on the side.
const intruder = await packTransfer(KIND_BALLOTS, JSON.stringify([]), mallory);
const intruderFrames = (await fountainTransfer(intruder, { blockSize: 128, layoutShort: wire.layoutShort })).frames(4);
const session = carrierSession({});
let snap, passes = 0;
while (passes < 50) {
  const frames = [...wire.burst(20), ...(passes === 0 ? intruderFrames : [])];
  for (let i = frames.length - 1; i > 0; i--) { const j = (i * 7919) % (i + 1); [frames[i], frames[j]] = [frames[j], frames[i]]; }
  frames.push(...frames.slice(0, 5)); // duplicates: a camera catches what it catches
  for (const f of frames) snap = await session.feed(f);
  passes++;
  if (snap.complete) break;
}
ok(snap.complete, "the attested set completes by looping — shuffle, duplicates, intruder and all (passes: " + passes + ")");
ok(snap.foreign.some((x) => /interloper/.test(x.reason)), "the intruder tile is called out by the set, not the eye");

const result = await session.result();
const trade = unpackMeetOffer(result);
ok(trade.ok && trade.by === alice.fingerprint, "the trade unpacks under one voice: " + (trade.errors || []).join("; "));
ok(trade.offer.quells.length === 1 && trade.offer.ballots.map((b) => b.poll)[0] === "budget",
  "quells and wire-ordered ballots survive intact");

// One-voice enforcement: a valid member signed by another identity is refused at unpack.
const tampered = { ...result, transfers: result.transfers.map((t, i) => (i === 1 ? { signed: intruder, verify: { ok: true, by: mallory.fingerprint, kind: KIND_BALLOTS, bytes: new TextEncoder().encode("[]") } } : t)) };
const refused = unpackMeetOffer(tampered);
ok(!refused.ok && refused.errors.some((e) => /another voice/.test(e)), "a member in another voice is not part of the trade");

// --- and the pocket takes it, end to end.
const bAfter = await receiveMeet({ satchel: [], quells: [] }, trade.offer, {
  pins: ["parks"], now: Date.parse("2026-07-03T00:00:00Z"),
});
ok(bAfter.quells.length === 1 && bAfter.satchel.length === 3,
  "caught bytes land through the pocket's own economy — the whole leg holds");

process.exit(fails ? 1 : 0);
