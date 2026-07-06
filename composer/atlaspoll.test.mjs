// Unit: the Atlas-fronted poll — anecdote.atlaspoll/v1. Build/sign/verify with the ok/trusted lineage
// split, the content id, the custody accessors (age recipient + instigator), and a network-addressed
// ballot answered against it. Run: node composer/atlaspoll.test.mjs
import { generateIdentity } from "./sign.mjs";
import { verifyBallot } from "./ballot.mjs";
import { buildAtlasPoll, signAtlasPoll, verifyAtlasPoll, isAtlasPoll, atlasPollId,
         custodyRecipient, instigatorOf, ballotForFronted, ATLASPOLL_SCHEMA } from "./atlaspoll.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const atlas = await generateIdentity();   // the fronting Atlas
const stranger = await generateIdentity(); // an Atlas NOT in my lineage
const owner = await generateIdentity();    // the poll's instigator/owner (device identity)
const RECIPIENT = "age1lggyhqrw2nlhcxprm67z43rta597azn8gknawjehu9d9dl0jq3yqqvfafg";

const spec = { pile: "cd04-q1", poll: "budget", fronts: "colorado", scope: "colorado",
               instigator: owner.fingerprint, age_recipient: RECIPIENT, license: "antidote/public-v0" };

// 1. build: required fields enforced; age_recipient format checked; stores_public defaults true.
{
  const p = buildAtlasPoll(spec);
  ok(p.schema === ATLASPOLL_SCHEMA && p.stores_public === true && p.age_recipient === RECIPIENT, "builds a fronted poll, stores_public defaults true");
  for (const bad of [{ ...spec, pile: "NOPE" }, { ...spec, poll: "" }, { ...spec, fronts: "" }, { ...spec, age_recipient: "notage" }]) {
    let threw = false; try { buildAtlasPoll(bad); } catch { threw = true; }
    ok(threw, "refused a malformed spec: " + JSON.stringify(Object.keys(bad).filter((k) => bad[k] !== spec[k])));
  }
}

// 2. sign + the ok/trusted lineage split.
{
  const signed = await signAtlasPoll(buildAtlasPoll(spec), atlas);
  ok(isAtlasPoll(signed), "signed fronted poll keeps its shape");
  const mine = await verifyAtlasPoll(signed, { lineage: [atlas.fingerprint] });
  ok(mine.ok && mine.trusted && mine.by === atlas.fingerprint, "verify-from-anyone AND trusted when the fronting Atlas is in my lineage");
  const notmine = await verifyAtlasPoll(signed, { lineage: [stranger.fingerprint] });
  ok(notmine.ok && !notmine.trusted, "still verifies (ok) but is untrusted when the signer isn't in my lineage");
  const tampered = { ...signed, license: "evil/relabel" };
  ok(!(await verifyAtlasPoll(tampered)).ok, "a tampered fronted poll fails the signature");
}

// 3. content id converges.
{
  const signed = await signAtlasPoll(buildAtlasPoll(spec), atlas);
  ok((await atlasPollId(signed)) === (await atlasPollId({ ...signed })), "same fronted poll -> same id");
}

// 4. custody accessors: the age recipient a stand-in pile seals to, and the instigator (authorKid).
{
  const signed = await signAtlasPoll(buildAtlasPoll(spec), atlas);
  ok(custodyRecipient(signed) === RECIPIENT, "custodyRecipient exposes the owner's age recipient (Slice 3 seals to this)");
  ok(instigatorOf(signed) === owner.fingerprint, "instigatorOf exposes the author fingerprint (drop door's authorKidFor)");
  const noRcpt = await signAtlasPoll(buildAtlasPoll({ ...spec, age_recipient: undefined }), atlas);
  ok(custodyRecipient(noRcpt) === null, "no age recipient -> null -> custody degrades to archive-only");
}

// 5. a network-addressed ballot answered against the fronted poll: ordinary ballot, matching coords.
{
  const signed = await signAtlasPoll(buildAtlasPoll(spec), atlas);
  const b = await ballotForFronted(signed, { answer: "Keep", ts: "2026-07-04T18:00:00Z" }, owner);
  ok(b.pile === "cd04-q1" && b.poll === "budget" && b.scope === "colorado", "the ballot carries the fronted poll's (pile,poll,scope) — how any Atlas correlates it back");
  ok((await verifyBallot(b)).ok && (await verifyBallot(b)).by === owner.fingerprint, "it is a plain, verifiable anecdote.ballot/v1 signed by the respondent");
}

process.exit(fails ? 1 : 0);
