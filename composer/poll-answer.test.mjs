// Unit: the poll-answer view — parse a Tell QR, always-custom invariant, and BYTE-PARITY with the wire
// format tell.anecdote.channel/index.md emits. The oracle below is index.md's own issueUrl construction
// (lines 67-83) frozen as the migration contract: when index.md is retired, this test still guards the
// shape anecdote must keep emitting. Run: node composer/poll-answer.test.mjs
import { elevatedSession, request, FRAME, ERROR } from "./probe-line.mjs";
import { parseQR, submissionBlock, issueUrl, issueRequest, submitAnswer, answerView, pollAnswerOps, SUBMISSION_SCHEMA, CANONICAL_REPO } from "./poll-answer.mjs";

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

// 5b. OBSERVABILITY of the empty state: the view says WHY it didn't load — no query at all vs a query
// missing required params — with param NAMES only, never values (three failures used to render as one).
{
  const none = answerView(parseQR(""), { ts: TS });
  ok(none.why && none.why.rawQueryBytes === 0 && none.why.missing.length === 4,
     "an empty query says so: 0 bytes, all four required params missing");
  const partial = answerView(parseQR("pile=p&type=multichoice"), { ts: TS });
  ok(partial.why.rawQueryBytes > 0 && partial.why.missing.join(",") === "poll,round,tok",
     "a partial query names exactly what's missing (poll, round, tok)");
  ok(partial.why.params.includes("pile") && partial.why.params.includes("type"),
     "…and names what arrived (param names, not values)");
  ok(!partial.why.params.includes("repo"), "normalize's defaults (repo) do NOT masquerade as arrived");
  ok(JSON.stringify(partial.why).indexOf("multichoice") === -1, "the diagnosis carries NO param values");
  ok(answerView(parseQR("pil=oops&poll=q"), { ts: TS }).why.params.includes("pil"),
     "an unrecognized (typo'd) param name shows itself in the diagnosis");
  const loadedView = answerView(parseQR("pile=p&poll=q&round=1&tok=t"), { ts: TS });
  ok(!("why" in loadedView), "a loaded view carries no diagnosis (shape unchanged)");
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

// 7. the HTTP submit — the tap that SENDS. Same block as the URL (equivalence), credential header-only,
// failure surfaced not swallowed, and no-credential falls back to the issueUrl (phones-home-nothing).
{
  const QR = "pile=cd04-q1&poll=budget&round=1&tok=abc123&type=multichoice&opts=Cut,Keep&guidance=Pick+one.";
  const cfg = parseQR(QR);
  const CRED = "ghs_semi_public_post_token";

  // equivalence: the POST request carries byte-identical content to the issues/new URL's body/title/labels.
  const req = issueRequest(cfg, "Keep", { ts: TS });
  const urlBody = new URL(issueUrl(cfg, "Keep", { ts: TS })).searchParams.get("body");
  ok(req.method === "POST" && req.path === "/repos/FCCN-ANTIBODY/tell.anecdote.channel/issues", "issueRequest posts a fresh issue to the Tell repo");
  ok(req.payload.body === urlBody && req.payload.title === "tell submission cd04-q1 / budget" && req.payload.labels[0] === "tell-submission",
     "the POST submits the SAME block/title/labels as the URL — URL and direct submit are equivalent");

  // submitAnswer: the credential rides only in the transport token, never in the body; returns the placement.
  let seen = null;
  const api = async (call) => { seen = call; return { status: 201, json: { id: 7, number: 9, html_url: "https://github.com/o/r/issues/9" } }; };
  const out = await submitAnswer(cfg, "Keep", { api, credential: CRED, ts: TS });
  ok(seen.token === CRED, "the post credential is used as the transport token");
  ok(!JSON.stringify(seen.body).includes(CRED), "the credential is NEVER in the posted body");
  ok(out.placement.url === "https://github.com/o/r/issues/9" && out.placement.issue === 9, "the placement carries where the answer landed");

  // the op: with a credential it submits; the emitted frame carries the placement and NOT the credential.
  const ops = pollAnswerOps({ qr: QR, ts: TS, egressApi: api });
  const run = async (op, input, confirmed = true) => { const frames = []; const s = elevatedSession({ ops, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
    await s.handle(request({ id: "s", op, input, confirmed })); return frames; };

  // CONFIRM POSTURE: poll.submit is Rung 1 — without a fresh confirmation the gate asks first, never sends.
  const gated = (await run("poll.submit", { answer: "Keep", credential: CRED }, false)).find((f) => f.type === ERROR);
  ok(gated && gated.needsConfirm, "poll.submit is confirm-gated — an unconfirmed tap asks first, it does not fire");

  const sent = (await run("poll.submit", { answer: "Keep", credential: CRED })).find((f) => f.type === FRAME && "submitted" in f);
  ok(sent && sent.submitted === true && sent.placement && !JSON.stringify(sent).includes(CRED), "a confirmed poll.submit sends and emits the placement — the credential never enters a frame");

  // no credential → falls back to the issueUrl (the no-cred, phones-home-nothing path is preserved).
  const fell = (await run("poll.submit", { answer: "Keep" })).find((f) => f.type === FRAME && "issueUrl" in f);
  ok(fell && fell.submitted === null && fell.issueUrl === issueUrl(cfg, "Keep", { ts: TS }), "no credential → poll.submit falls back to the issueUrl link");

  // failure is surfaced, not swallowed (the promise: you will know if it wasn't accepted).
  const boom = async () => ({ status: 403, json: { message: "no" } });
  const opsF = pollAnswerOps({ qr: QR, ts: TS, egressApi: boom });
  const runF = async (input) => { const frames = []; const s = elevatedSession({ ops: opsF, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
    await s.handle(request({ id: "f", op: "poll.submit", input, confirmed: true })); return frames; };
  const failed = (await runF({ answer: "Keep", credential: CRED })).find((f) => f.type === FRAME && f.submitted === false);
  ok(failed && /403/.test(failed.error) && failed.issueUrl, "a failed submit is surfaced (error + fallback link), never silent");
}

// 8. the QR-carried post credential — parsed, but NEVER in the provenance field or the submission body, and
// used as the fallback credential for the anonymous-public submit. (bin/qr appends post= after the signed
// canon; the client mirrors the tell's exclusion.)
{
  const CRED = "ghs_public_qr_token";
  // a signed QR that also carries the post credential (post rides last, after sig)
  const QR = `pile=cd04-q1&poll=budget&round=1&tok=abc123&type=open&sig=SIGBYTES&kid=SHA256%3Akkk&post=${CRED}`;
  const cfg = parseQR(QR);
  ok(cfg.cred === CRED, "the QR's post= credential is parsed (decoded) into cfg.cred");
  ok(!/post=/.test(cfg.rawQuery), "post= is STRIPPED from rawQuery — the provenance field never carries the credential");
  ok(/tok=abc123/.test(cfg.rawQuery) && /sig=SIGBYTES/.test(cfg.rawQuery), "the rest of the signed query survives byte-for-byte (only post is excised)");

  // the submission block's provenance field (qr) must not contain the credential
  const block = submissionBlock(cfg, "Keep", { ts: TS });
  ok(block.qr && !block.qr.includes(CRED), "block.qr carries the signed QR for provenance but NOT the credential");
  ok(!JSON.stringify(block).includes(CRED), "the credential appears nowhere in the submission block");

  // the anonymous-public path: poll.submit uses the QR-carried credential when none is host-injected
  let seen = null;
  const api = async (call) => { seen = call; return { status: 201, json: { number: 5, html_url: "https://github.com/o/r/issues/5" } }; };
  const ops = pollAnswerOps({ qr: QR, ts: TS, egressApi: api });
  const run = async (input) => { const frames = []; const s = elevatedSession({ ops, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
    await s.handle(request({ id: "q", op: "poll.submit", input, confirmed: true })); return frames; };
  const sent = (await run({ answer: "Keep" })).find((f) => f.type === FRAME && "submitted" in f);   // NO input.credential
  ok(seen && seen.token === CRED, "poll.submit falls back to the QR-carried credential for anonymous public");
  ok(sent && sent.submitted === true && !JSON.stringify(sent).includes(CRED), "it sends, and the credential never enters the emitted frame");
}

// 9. the submit-gateway relay (`su=`) — the graduated route: the QR carries a non-secret worker address
// instead of a credential (tell …/workers/submit-gateway); the client holds no token at all and POSTs the
// same GitHub-shaped request to the relay. su may stay in rawQuery (it is an address, not a bearer token;
// the Tell's canon drops it), and it beats the legacy QR-carried credential when both somehow appear.
{
  const SU = "https://tell.anecdote.channel/submit";
  const QR = `pile=cd04-q1&poll=budget&round=1&tok=abc123&type=open&su=${encodeURIComponent(SU)}`;
  const cfg = parseQR(QR);
  ok(cfg.submitUrl === SU, "the QR's su= relay address is parsed (decoded) into cfg.submitUrl");
  ok(/su=/.test(cfg.rawQuery), "su stays in rawQuery — an address is not a credential, and the Tell's canon drops it");
  ok(parseQR("pile=p&poll=q&round=1&tok=t&su=http%3A%2F%2Finsecure").submitUrl === null, "a non-https su is refused, not carried");

  // submitAnswer with NO credential routes through the relay transport: the request body is {path, body},
  // it goes to the su URL, and no Authorization header exists anywhere on this side.
  const fetches = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { fetches.push({ url, init }); return { status: 201, json: async () => ({ number: 5, html_url: "https://github.com/o/r/issues/5" }) }; };
  try {
    const out = await submitAnswer(cfg, "Keep", { ts: TS });                   // no api, no credential
    ok(fetches.length === 1 && fetches[0].url === SU, "the relay route POSTs to the su address, not api.github.com");
    const relayed = JSON.parse(fetches[0].init.body);
    ok(relayed.path === "/repos/FCCN-ANTIBODY/tell.anecdote.channel/issues" && relayed.body && relayed.body.labels[0] === "tell-submission",
       "the relay carries the same GitHub-shaped {path, body} the direct route would send");
    ok(!fetches[0].init.headers.Authorization, "no Authorization header — the client holds no credential at all");
    ok(out.placement.issue === 5, "the relay's projection still resolves to a placement");
  } finally { globalThis.fetch = realFetch; }

  // poll.submit routes via the relay when no credential is host-injected — even if a stray post= rode along.
  const QR2 = QR + "&post=ghs_should_lose";
  let seen = null;
  const api = async (call) => { seen = call; return { status: 201, json: { number: 6, html_url: "https://github.com/o/r/issues/6" } }; };
  const ops = pollAnswerOps({ qr: QR2, ts: TS, egressApi: api });
  const run = async (input) => { const frames = []; const s = elevatedSession({ ops, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
    await s.handle(request({ id: "r", op: "poll.submit", input, confirmed: true })); return frames; };
  const sent = (await run({ answer: "Keep" })).find((f) => f.type === FRAME && "submitted" in f);
  ok(sent && sent.submitted === true, "poll.submit sends through the relay route with no client credential");
  ok(seen && !seen.token, "the relay route hands the transport NO token — the stray legacy credential lost");
  // a host-injected credential still wins (the operator's own chamber bypasses the relay)
  seen = null;
  await run({ answer: "Keep", credential: "ghs_host" });
  ok(seen && seen.token === "ghs_host", "an explicitly host-injected credential still wins over the relay");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall poll-answer tests passed");
