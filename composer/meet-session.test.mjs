// Unit: the meet-session driver (composer/meet-session.mjs, anecdote.channel#107) — two openMeet()
// sessions meet ENTIRELY in memory, each side's show() feeding the other's feed(), until both read done.
// Proves the driver sequences hello → trade → receipt without the caller touching a carrier, and that the
// two async lines hold: a side that finishes first keeps bursting its trade so the slower side still lands.
// Run: node composer/meet-session.test.mjs
import { generateIdentity, verifyAttestation } from "./sign.mjs";
import { buildBallot, signBallot } from "./ballot.mjs";
import { buildQuell, signQuell } from "./quell.mjs";
import { addBallots } from "./satchel.mjs";
import { greeting } from "./meet.mjs";
import { openMeet } from "./meet-session.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const alice = await generateIdentity();
const bob = await generateIdentity();
const voter = await generateIdentity();
const author = await generateIdentity();   // the poll author whose quell is TERMINAL

const mint = (poll, answer, labels, scope) =>
  signBallot(buildBallot({ pile: "cd04", poll, answer, ts: "2026-07-01T00:00:00Z", labels, scope }), voter);

// Alice champions "alpha" and carries one alpha ballot. She also carries a TERMINAL quell that ends the
// "sunset" question (signed by the poll's own author).
const aliceHold = {
  satchel: (await addBallots([], [await mint("alpha", "Yes", ["alpha"])])).satchel,
  quells: [await signQuell(buildQuell({ pile: "cd04", poll: "sunset", ts: "2026-07-02T00:00:00Z" }), author)],
};
// Bob champions "beta" and "sunset" and carries a ballot for each — his sunset ballot is exactly what
// Alice's quell should retire from his pocket when they meet.
const bobHold = {
  satchel: (await addBallots([], [await mint("beta", "No", ["beta"]), await mint("sunset", "Keep", ["sunset"])])).satchel,
  quells: [],
};

// Both sides know the same author kid ends the sunset question; nothing else is terminal.
const authorKidFor = (_pile, poll) => (poll === "sunset" ? author.fingerprint : undefined);

const A = await openMeet({ hold: aliceHold, greeting: greeting({ pins: ["alpha"] }), identity: alice,
                           receiveOpts: { authorKidFor }, ts: "2026-07-05T00:00:00Z", blockSize: 128 });
const B = await openMeet({ hold: bobHold, greeting: greeting({ pins: ["beta", "sunset"] }), identity: bob,
                           receiveOpts: { authorKidFor }, ts: "2026-07-05T00:00:00Z", blockSize: 128 });

// The whole meet, driven by nothing but show()/feed() — no carrier, no camera in the test either.
let passes = 0;
while (!(A.state().done && B.state().done) && passes < 80) {
  for (const f of A.show(24)) await B.feed(f);
  for (const f of B.show(24)) await A.feed(f);
  passes++;
}
ok(A.state().done && B.state().done, "both sessions reach done from show()/feed() alone (passes: " + passes + ")");

const aOut = A.outcome(), bOut = B.outcome();
ok(aOut && bOut, "each side produced an outcome");

const polls = (o) => o.hold.satchel.map((e) => e.ballot.poll).sort();
ok(polls(aOut).includes("beta"), "Alice's hold gained Bob's beta ballot: " + polls(aOut).join(","));
ok(polls(aOut).includes("alpha"), "Alice kept her own alpha ballot");
ok(polls(bOut).includes("alpha"), "Bob's hold gained Alice's alpha ballot: " + polls(bOut).join(","));
ok(polls(bOut).includes("beta"), "Bob kept his own beta ballot");

// The terminal quell crossed and pruned: Bob's sunset ballot is gone from his pocket, and the quell is now
// held on his side (evidence, and it keeps pruning future offers of that dead question).
ok(!polls(bOut).includes("sunset"), "Bob's sunset ballot was pruned by Alice's terminal quell: " + polls(bOut).join(","));
ok(bOut.hold.quells.length === 1, "Bob now holds the terminal quell he received");

// Each side signed an exchange receipt naming the OTHER — the co-signable evidence of the moment.
const aRcpt = await verifyAttestation(aOut.receipt);
const bRcpt = await verifyAttestation(bOut.receipt);
ok(aRcpt.ok && aRcpt.by === alice.fingerprint, "Alice's receipt verifies under her own key");
ok(aOut.receipt.peer === bob.fingerprint && aOut.peer === bob.fingerprint, "Alice's receipt names Bob as the peer");
ok(bRcpt.ok && bRcpt.by === bob.fingerprint, "Bob's receipt verifies under his own key");
ok(bOut.receipt.peer === alice.fingerprint && bOut.peer === alice.fingerprint, "Bob's receipt names Alice as the peer");

// The transcript records what each side put on the wire (content ids), non-empty on both.
ok(aOut.transcript.sent.length > 0 && aOut.transcript.received.length > 0, "Alice's transcript logs sent + received ids");
ok(bOut.transcript.sent.length > 0 && bOut.transcript.received.length > 0, "Bob's transcript logs sent + received ids");

process.exit(fails ? 1 : 0);
