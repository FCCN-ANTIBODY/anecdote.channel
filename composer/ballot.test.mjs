// Unit: the hand-signed ballot — an answer that travels as a person. Build/sign/verify from anyone,
// content-id convergence, and the turn-in projection onto the mirror's tell.submission/v1 idiom.
// Run: node composer/ballot.test.mjs
import { generateIdentity } from "./sign.mjs";
import { buildBallot, signBallot, verifyBallot, isBallot, ballotId, lateSubmission,
         BALLOT_SCHEMA, SUBMISSION_SCHEMA } from "./ballot.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const me = await generateIdentity();
const spec = { pile: "cd04-q1", poll: "budget", round: 3, tok: "deadbeef", answer: "Keep",
               ts: "2026-07-04T18:00:00Z", labels: ["budget", "parks "], scope: "colorado" };

// 1. build: required fields enforced, labels trimmed, round stringified.
const b = buildBallot(spec);
ok(b.schema === BALLOT_SCHEMA && b.round === "3" && b.labels.join(",") === "budget,parks", "ballot builds normalized");
for (const bad of [{ ...spec, pile: "NOPE" }, { ...spec, poll: "" }, { ...spec, answer: "" }, { ...spec, ts: null }]) {
  let threw = false;
  try { buildBallot(bad); } catch { threw = true; }
  ok(threw, "refused a malformed spec: " + JSON.stringify(Object.keys(bad).filter((k) => bad[k] !== spec[k])));
}

// 2. sign + verify from anyone; the age stamp is INSIDE the signature.
const signed = await signBallot(b, me);
ok(isBallot(signed), "signed ballot keeps its shape");
ok((await verifyBallot(signed)).ok && (await verifyBallot(signed)).by === me.fingerprint, "verifies to the signer");
const tampered = { ...signed, ts: "2026-08-01T00:00:00Z" };
ok(!(await verifyBallot(tampered)).ok, "a backdated/tampered age stamp fails the signature");

// 3. content id converges: many hands, one entry.
ok((await ballotId(signed)) === (await ballotId({ ...signed })), "same signed ballot -> same id");
ok((await ballotId(signed)) !== (await ballotId(await signBallot(buildBallot({ ...spec, answer: "Cut" }), me))),
  "a different answer is a different ballot");

// 4. turn-in projection: the Tell-readable fields in contract order, the signed ballot riding whole.
const block = lateSubmission(signed);
ok(block.schema === SUBMISSION_SCHEMA, "projects to tell.submission/v1");
ok(JSON.stringify(Object.keys(block)) === JSON.stringify(["schema", "pile", "poll", "round", "tok", "answer", "ts", "ballot"]),
  "key order is the contract: " + Object.keys(block).join(","));
ok(block.ballot.sig && (await verifyBallot(block.ballot)).ok, "the attached ballot re-verifies at the door");

process.exit(fails ? 1 : 0);
