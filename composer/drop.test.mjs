// Unit: the Atlas drop-door resolver — the three-rule table (turn-in / quell-back shrug /
// flood-onward) over quell.stillLive and ballot.turnInSubmission. Pure, synchronous, verify-free.
// Run: node composer/drop.test.mjs
import { generateIdentity } from "./sign.mjs";
import { buildBallot, signBallot, SUBMISSION_SCHEMA } from "./ballot.mjs";
import { buildQuell, signQuell } from "./quell.mjs";
import { resolveDrop, projectTurnIns } from "./drop.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const me = await generateIdentity();
const author = await generateIdentity();

const mkBallot = (over = {}) => signBallot(buildBallot({
  pile: "cd04-q1", poll: "budget", answer: "Keep", ts: "2026-07-04T18:00:00Z", scope: "colorado", ...over,
}), me);
const listing = (over = {}) => ({ pile: "cd04-q1", poll: "budget", host: "tell:cd04", ts: "2026-07-01T00:00:00Z", ...over });
const colorado = ["colorado"];

// 1. turn-in: a known live door (a listing, no quell) + arrived in my scope.
{
  const b = await mkBallot();
  const { turnIn, shrugQuellBack, floodOnward } = resolveDrop({ ballots: [b], listings: [listing()], myScopes: colorado });
  ok(turnIn.length === 1 && !shrugQuellBack.length && !floodOnward.length, "known live door + arrived -> turnIn");
  const blocks = projectTurnIns(turnIn);
  ok(blocks[0].schema === SUBMISSION_SCHEMA && blocks[0].ballot === turnIn[0],
    "turnIn projects to tell.submission/v1 with the ballot riding whole");
}

// 2. flood: unknown poll (no listing, no quell) even though arrived — nowhere to turn it in.
{
  const b = await mkBallot();
  const { turnIn, shrugQuellBack, floodOnward } = resolveDrop({ ballots: [b], myScopes: colorado });
  ok(!turnIn.length && !shrugQuellBack.length && floodOnward.length === 1, "unknown door -> floodOnward (never dropped)");
}

// 3. flood: a live known door, but the ballot is addressed to a scope I don't serve.
{
  const b = await mkBallot({ scope: "wyoming" });
  const { turnIn, floodOnward } = resolveDrop({ ballots: [b], listings: [listing()], myScopes: colorado });
  ok(!turnIn.length && floodOnward.length === 1, "live door out of my scope -> floodOnward (forward toward it)");
}

// 4. shrug: an AUTHOR quell (no host, signed by the poll's author) ends the question -> hand it back.
{
  const b = await mkBallot();
  const q = await signQuell(buildQuell({ pile: "cd04-q1", poll: "budget", ts: "2026-07-05T00:00:00Z" }), author);
  const authorKidFor = (pile, poll) => (pile === "cd04-q1" && poll === "budget" ? author.fingerprint : undefined);
  const { turnIn, shrugQuellBack, floodOnward } = resolveDrop({ ballots: [b], quells: [q], myScopes: colorado, authorKidFor });
  ok(!turnIn.length && !floodOnward.length && shrugQuellBack.length === 1, "author quell -> shrugQuellBack");
  ok(shrugQuellBack[0].ballot === b && shrugQuellBack[0].quells[0] === q, "the operative quell rides back to the carrier");
}

// 5. shrug: the only known host door is closed by a host quell no fresher listing supersedes.
{
  const b = await mkBallot();
  const q = await signQuell(buildQuell({ pile: "cd04-q1", poll: "budget", ts: "2026-07-03T00:00:00Z", host: "tell:cd04" }), me);
  const { turnIn, shrugQuellBack } = resolveDrop({ ballots: [b], listings: [listing()], quells: [q], myScopes: colorado });
  ok(!turnIn.length && shrugQuellBack.length === 1, "all known host doors quelled unsuperseded -> shrugQuellBack");
}

// 6. freshness: a listing newer than the host quell reopens the door -> live again, turnIn.
{
  const b = await mkBallot();
  const fresh = listing({ ts: "2026-07-06T00:00:00Z" });
  const q = await signQuell(buildQuell({ pile: "cd04-q1", poll: "budget", ts: "2026-07-03T00:00:00Z", host: "tell:cd04" }), me);
  const { turnIn, shrugQuellBack } = resolveDrop({ ballots: [b], listings: [fresh], quells: [q], myScopes: colorado });
  ok(turnIn.length === 1 && !shrugQuellBack.length, "listing fresher than the host quell supersedes it -> turnIn");
}

// 7. a non-ballot is not this door's business.
{
  const r = resolveDrop({ ballots: [{ hello: "world" }], myScopes: colorado });
  ok(!r.turnIn.length && !r.shrugQuellBack.length && !r.floodOnward.length, "non-ballot skipped");
}

process.exit(fails ? 1 : 0);
