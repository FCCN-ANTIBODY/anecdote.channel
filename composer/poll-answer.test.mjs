// Unit: the poll-answer view — parse a Tell QR, always-custom invariant, and BYTE-PARITY with the wire
// format tell.anecdote.channel/index.md emits. The oracle below is index.md's own issueUrl construction
// (lines 67-83) frozen as the migration contract: when index.md is retired, this test still guards the
// shape anecdote must keep emitting. Run: node composer/poll-answer.test.mjs
import { elevatedSession, request, FRAME } from "./probe-line.mjs";
import { parseQR, submissionBlock, issueUrl, answerView, pollAnswerOps, SUBMISSION_SCHEMA, CANONICAL_REPO } from "./poll-answer.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// ---- the oracle: index.md's issueUrl, verbatim (parameterized by cfg + ts) --------------------------
function oracleIssueUrl(cfg, answer, ts) {
  const block = {
    schema: "tell.submission/v1",
    pile: cfg.pile, poll: cfg.poll, round: cfg.round,
    type: cfg.type || "open", asker: cfg.asker || "",
    shown_guidance: cfg.guidance || "",
    tok: cfg.tok, answer: answer, ts: ts,
  };
  if (cfg.sig) block.qr = cfg.rawQuery;
  const body = "Reply to **" + cfg.pile + "** / poll **" + cfg.poll + "** — option: **" + answer + "**\n\n" +
               "```tell\n" + JSON.stringify(block) + "\n```\n";
  const qs = "title=" + encodeURIComponent("tell submission " + cfg.pile + " / " + cfg.poll) +
             "&labels=" + encodeURIComponent("tell-submission") +
             "&body=" + encodeURIComponent(body);
  return "https://github.com/" + cfg.repo + "/issues/new?" + qs;
}

const TS = "2026-07-01T00:00:00.000Z";

// 1. parseQR — search wins, first-key-wins, options trimmed, repo validated, rawQuery verbatim.
{
  const cfg = parseQR("pile=cd04-q1&poll=budget&round=1&tok=abc123&type=multichoice&opts=Cut,%20Keep&guidance=One+of+the+listed+options.&asker=alice@example.com");
  ok(cfg.loaded, "a QR with pile/poll/round/tok is loaded");
  ok(cfg.options.length === 2 && cfg.options[1] === "Keep", "options split + trimmed");
  ok(cfg.repo === CANONICAL_REPO, "no &repo → canonical Tell repo");
  ok(cfg.question === "One of the listed options." ? false : cfg.question.includes("Reply to"), "no &q → a default question");
  ok(!parseQR("poll=x").loaded, "missing tok → not loaded (index.md's empty state)");
  ok(parseQR("pile=p&poll=q&round=1&tok=t&repo=evil injection").repo === CANONICAL_REPO, "a malformed &repo falls back to canonical");
  ok(parseQR("pile=p&poll=q&round=1&tok=t&repo=me/mine").repo === "me/mine", "a clean OWNER/NAME &repo is honored");
}

// 2. parseQR from a full URL + from the hash fallback.
{
  ok(parseQR("https://tell.anecdote.channel/?pile=p&poll=q&round=1&tok=t").loaded, "parses a full URL's search");
  ok(parseQR("#pile=p&poll=q&round=1&tok=t").loaded, "parses the hash when there's no search");
}

// 3. BYTE-PARITY: submissionBlock key order + issueUrl match the index.md oracle across cases.
{
  const cases = [
    parseQR("pile=cd04-q1&poll=budget&round=1&tok=abc123&type=multichoice&opts=Cut,Keep&guidance=Pick+one.&asker=alice@example.com"),
    parseQR("pile=cd04-q1&poll=open-q&round=2&tok=deadbeef"),               // open, no opts, no guidance
    parseQR("pile=p&poll=q&round=1&tok=t&repo=jur/tell"),                    // jurisdiction repo
  ];
  const answers = ["Keep", "a free-form write-in with **markdown** & <html>", ""];
  let allMatch = true;
  for (const cfg of cases) for (const a of answers) if (issueUrl(cfg, a, { ts: TS }) !== oracleIssueUrl(cfg, a, TS)) allMatch = false;
  ok(allMatch, "issueUrl is byte-identical to the index.md oracle (options, write-ins, jurisdiction repos)");

  const block = submissionBlock(parseQR("pile=cd04-q1&poll=budget&round=1&tok=abc123&type=multichoice&guidance=Pick+one.&asker=alice@example.com"), "Keep", { ts: TS });
  ok(JSON.stringify(block) === '{"schema":"tell.submission/v1","pile":"cd04-q1","poll":"budget","round":"1","type":"multichoice","asker":"alice@example.com","shown_guidance":"Pick one.","tok":"abc123","answer":"Keep","ts":"2026-07-01T00:00:00.000Z"}',
     "the tell.submission/v1 block serializes with the exact contract key order");
}

// 4. Signed QR carries the verbatim rawQuery as block.qr (provenance travels into the reply).
{
  const raw = "pile=p&poll=q&round=1&tok=t&sig=BASE64SIG&kid=SHA256:fp";
  const cfg = parseQR(raw);
  ok(cfg.sig === "BASE64SIG", "sig is parsed");
  const b = submissionBlock(cfg, "yes", { ts: TS });
  ok(b.qr === raw, "block.qr is the verbatim, undecoded query (byte-for-byte, for signature verification)");
  ok(!("qr" in submissionBlock(parseQR("pile=p&poll=q&round=1&tok=t"), "yes", { ts: TS })), "an unsigned poll carries no qr field");
}

// 5. ALWAYS-CUSTOM invariant: even a multichoice poll promises a custom answer; options are suggestions.
{
  const mc = answerView(parseQR("pile=p&poll=q&round=1&tok=t&type=multichoice&opts=Cut,Keep"), { ts: TS });
  ok(mc.alwaysCustom === true, "a multichoice poll STILL promises a custom answer (no write-in gate)");
  ok(mc.options.length === 2 && mc.options[0].issueUrl.includes("issues/new"), "options are suggestions, each with a prebuilt reply link");
  ok(answerView(parseQR("poll=x"), { ts: TS }).loaded === false, "an unloaded QR → the empty state");
}

// 6. pollAnswerOps over the probe line — poll.view + poll.compose, both Rung 0 (no prompt).
{
  const ops = pollAnswerOps({ qr: "pile=cd04-q1&poll=budget&round=1&tok=abc123&type=multichoice&opts=Cut,Keep&guidance=Pick+one.", ts: TS });
  const run = async (op, input) => { const frames = []; const s = elevatedSession({ ops, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
    await s.handle(request({ id: "x", op, input })); return frames; };

  const v = (await run("poll.view", {})).find((f) => f.type === FRAME && f.view)?.view;
  ok(v && v.question === "Reply to cd04-q1 / budget" && v.alwaysCustom, "poll.view returns the answer view with no prompt");
  ok(v.options.length === 2, "poll.view carries the suggested options");

  const c = (await run("poll.compose", { answer: "Keep" })).find((f) => f.type === FRAME && f.issueUrl);
  ok(c && c.issueUrl === issueUrl(parseQR("pile=cd04-q1&poll=budget&round=1&tok=abc123&type=multichoice&opts=Cut,Keep&guidance=Pick+one."), "Keep", { ts: TS }), "poll.compose builds the reply link for a write-in");
  ok(c.block.answer === "Keep" && c.block.schema === SUBMISSION_SCHEMA, "poll.compose returns the submission block too");

  const empty = (await run("poll.compose", { answer: "  " })).find((f) => f.type === FRAME && "issueUrl" in f);
  ok(empty && empty.issueUrl === null, "poll.compose with a blank answer yields no link (nothing to submit yet)");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall poll-answer tests passed");
