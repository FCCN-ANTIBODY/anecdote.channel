// Unit: the pile.poll data object — author it, read it back, tally fetched-back deliveries into live
// results, and compute lifecycle state. Run: node viewer/poll.test.mjs
import { repo } from "../git-enough/repo.mjs";
import { repoRegistry } from "./repos.mjs";
import { buildPoll, authorPoll, parsePoll, isPoll, recordDelivery, deliveryRecords,
         tallyDeliveries, pollState, pollView, POLL_SCHEMA } from "./poll.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const author = { name: "You", email: "you@origin", epoch: 1700000000, tz: "+0000" };

// 1. buildPoll normalizes + validates (defaults mirror the Tell constitution).
{
  const p = buildPoll({ pile: "cd04-q1", poll: "budget", type: "multichoice", text: "Cut or keep?", options: ["Cut", "Keep"], tell: "https://tell.anecdote.channel" });
  ok(p.schema === POLL_SCHEMA && isPoll(p), "buildPoll stamps anecdote.poll/v1 and passes isPoll");
  ok(!("accept_writein" in p), "no write-in gate on the object — the reply is always custom");
  ok(p.lifecycle.round === 1, "lifecycle carries round 1 by default");
  ok(buildPoll({ poll: "q", text: "?" }).type === "open", "type defaults to open");
  let threw = false; try { buildPoll({ poll: "x", text: "?", type: "multichoice" }); } catch { threw = true; }
  ok(threw, "multichoice with no options is rejected");
  let threw2 = false; try { buildPoll({ text: "?" }); } catch { threw2 = true; }
  ok(threw2, "a poll needs a slug");
}

// 2. authorPoll commits the data object; parsePoll reads it back.
{
  const r = repo();
  const p = await authorPoll(r, { pile: "cd04-q1", poll: "budget", type: "multichoice", text: "Cut or keep the library budget?", options: ["Cut", "Keep"], guidance: "One of the listed options.", tell: "https://tell.anecdote.channel" }, { author });
  const back = parsePoll(r);
  ok(back && back.poll === "budget" && back.text === p.text, "authorPoll → parsePoll round-trips the object");
  ok(back.tell === "https://tell.anecdote.channel", "the addressable Tell twin survives the round-trip");
  ok(parsePoll(repo()) === null, "a repo with no poll.json → parsePoll null (not a poll pile)");
}

// 3. deliveries → live results. Records flatten from both single-record files and sealed digests.
{
  const r = repo();
  await authorPoll(r, { pile: "cd04-q1", poll: "budget", type: "multichoice", text: "?", options: ["Cut", "Keep"] }, { author });
  await recordDelivery(r, "000000", { schema: "tell.digest/v1", records: [
    { poll: "budget", answer: "Keep", governed: "accept" },
    { poll: "budget", answer: "Keep", governed: "accept" },
    { poll: "budget", answer: "Cut",  governed: "accept" },
    { poll: "budget", answer: "Burn it down", governed: "needs-judgment" },  // write-in, pending
    { poll: "budget", answer: "spam", governed: "reject" },                  // rejected → uncounted
    { poll: "other",  answer: "Keep", governed: "accept" },                  // other poll → ignored
  ] }, { author });
  const recs = deliveryRecords(r);
  ok(recs.length === 6, "deliveryRecords flattens digest records[]");
  const t = tallyDeliveries(recs, { poll: "budget", options: ["Cut", "Keep"] });
  ok(t.total === 3, "only accepted, in-poll records count toward total");
  ok(t.pending === 1 && t.rejected === 1, "needs-judgment counts pending; reject counts rejected");
  const keep = t.tally.find((x) => x.answer === "Keep");
  ok(keep.count === 2 && keep.listed === true, "listed option tallied and flagged listed");
  ok(t.tally.find((x) => x.answer === "Cut").count === 1, "second listed option tallied");
  ok(t.tally.every((x) => x.answer !== "Burn it down"), "pending write-in is not in the accepted tally");
}

// 4. an option nobody picked still shows (seeded at 0).
{
  const t = tallyDeliveries([{ poll: "p", answer: "A", governed: "accept" }], { poll: "p", options: ["A", "B"] });
  ok(t.tally.find((x) => x.answer === "B").count === 0, "an unpicked listed option is seeded at 0");
}

// 5. lifecycle state is pure (caller supplies now).
{
  const lc = { round: 1, opens_at: "2026-01-01T00:00:00Z", closes_at: "2026-12-31T00:00:00Z" };
  ok(pollState(lc).state === "unknown", "no `now` → unknown (window still reported)");
  ok(pollState(lc, Date.parse("2026-06-01T00:00:00Z")).state === "open", "mid-window → open");
  ok(pollState(lc, Date.parse("2025-06-01T00:00:00Z")).state === "scheduled", "before opens_at → scheduled");
  ok(pollState(lc, Date.parse("2027-01-01T00:00:00Z")).state === "closed", "after closes_at → closed");
}

// 6. pollView assembles the whole widget model from a registry entry.
{
  const r = repo();
  await authorPoll(r, { pile: "cd04-q1", poll: "budget", type: "multichoice", text: "Cut or keep?", options: ["Cut", "Keep"], guidance: "Pick one." }, { author });
  await recordDelivery(r, "000000", [{ poll: "budget", answer: "Keep", governed: "accept" }], { author });
  const registry = repoRegistry();
  registry.register({ label: "budget", kind: "pile.poll", repo: r, downstreams: ["https://github.com/tiliv/tell-budget"] });
  const v = pollView(registry.get("budget"), { now: Date.parse("2026-06-01T00:00:00Z") });
  ok(v.text === "Cut or keep?" && v.type === "multichoice", "pollView carries the question + type");
  ok(v.results.total === 1 && v.results.tally.find((x) => x.answer === "Keep").count === 1, "pollView folds in live results");
  ok(v.tell === "https://github.com/tiliv/tell-budget", "pollView falls back to a downstream for the addressable Tell");
  ok(typeof v.provenBy === "string" && v.provenBy.length === 40, "pollView cites the tip commit as the proof artifact");
  ok(pollView(registry.get("budget")).lifecycleState.state === "unknown", "no now → unknown state via view");
  const notPoll = repoRegistry(); notPoll.register({ label: "s", kind: "pile.session", repo: repo() });
  ok(pollView(notPoll.get("s")).error, "a non-poll pile → error, not a crash");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall poll tests passed");
