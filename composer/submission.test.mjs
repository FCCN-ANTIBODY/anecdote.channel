// Unit: the poll-answer path across the backend line — the neutral core (composer/submission.mjs), the
// github adapter (composer/egress-github.mjs), and the router (composer/submit-route.mjs). BYTE-PARITY of
// the `tell.submission/v1` block (and the comment body the adapter builds from it) is the migration
// contract, frozen here against a local oracle. The offline/no-route case HOLDS for the mesh — never a
// github.com link. Run: node composer/submission.test.mjs
import { elevatedSession, request, FRAME, ERROR } from "./probe-line.mjs";
import { parseQR, submissionBlock, answerView, SUBMISSION_SCHEMA, CANONICAL_REPO } from "./submission.mjs";
import { commentRequest, commentBody, deliver } from "./egress-github.mjs";
import { pollAnswerOps } from "./submit-route.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// ---- the oracle: the frozen block + comment body (was index.md's construction) ----------------------
function oracleBlock(cfg, answer, ts) {
  const block = {
    schema: "tell.submission/v1",
    pile: cfg.pile, poll: cfg.poll, round: cfg.round,
    type: cfg.type || "open", asker: cfg.asker || "",
    shown_guidance: cfg.guidance || "",
    tok: cfg.tok, answer: answer, ts: ts,
  };
  if (cfg.sig) block.qr = cfg.rawQuery;
  return block;
}
function oracleBody(cfg, answer, ts) {
  return "Reply to **" + cfg.pile + "** / poll **" + cfg.poll + "** — option: **" + answer + "**\n\n" +
         "```tell\n" + JSON.stringify(oracleBlock(cfg, answer, ts)) + "\n```\n";
}

const TS = "2026-07-01T00:00:00.000Z";

// 1. parseQR — search wins, first-key-wins, options trimmed, repo validated, rawQuery verbatim.
{
  const cfg = parseQR("pile=cd04-q1&poll=budget&round=1&tok=abc123&type=multichoice&opts=Cut,%20Keep&guidance=One+of+the+listed+options.&asker=alice@example.com");
  ok(cfg.loaded, "a QR with pile/poll/round/tok is loaded");
  ok(cfg.options.length === 2 && cfg.options[1] === "Keep", "options split + trimmed");
  ok(cfg.backend.repo === CANONICAL_REPO, "no &repo → canonical Tell repo (backend namespace, #105)");
  ok(cfg.question.includes("Reply to"), "no &q → a default question");
  ok(!parseQR("poll=x").loaded, "missing tok → not loaded (the empty state)");
  ok(parseQR("pile=p&poll=q&round=1&tok=t&repo=evil injection").backend.repo === CANONICAL_REPO, "a malformed &repo falls back to canonical");
  ok(parseQR("pile=p&poll=q&round=1&tok=t&repo=me/mine").backend.repo === "me/mine", "a clean OWNER/NAME &repo is honored");
}

// 1b. THE ROUTING NAMESPACE LAW (#105): backend-owned fields live under cfg.backend, never at the top;
// the core's own outputs (the neutral block, the view) surface none of them.
{
  const cfg = parseQR("pile=cd04-q1&poll=budget&round=1&tok=abc123&type=open&canonical=7&repo=me/mine&submit=" + encodeURIComponent("https://x/submit") + "&post=ghs_tok");
  ok(cfg.backend && cfg.backend.repo === "me/mine" && cfg.backend.canonical === "7"
     && cfg.backend.submitUrl === "https://x/submit" && cfg.backend.cred === "ghs_tok",
     "backend-owned fields are grouped under cfg.backend");
  for (const k of ["repo", "canonical", "cred", "submitUrl", "post", "submit"])
    ok(!(k in cfg), "the top level (anecdote's namespace) carries no backend field: " + k);
  const blockStr = JSON.stringify(submissionBlock(cfg, "Keep", { ts: TS }));
  ok(!/me\/mine|ghs_tok|\/submit/.test(blockStr), "the neutral block carries nothing from the backend namespace");
  const view = answerView(cfg);
  for (const k of ["repo", "canonical", "cred", "submitUrl"])
    ok(!(k in view), "the core view surfaces no backend field: " + k);
}

// 2. parseQR from a full URL + from the hash fallback.
{
  ok(parseQR("https://tell.anecdote.channel/?pile=p&poll=q&round=1&tok=t").loaded, "parses a full URL's search");
  ok(parseQR("#pile=p&poll=q&round=1&tok=t").loaded, "parses the hash when there's no search");
}

// 3. BYTE-PARITY: the neutral block AND the adapter's comment body match the frozen oracle across cases.
{
  const cases = [
    parseQR("pile=cd04-q1&poll=budget&round=1&tok=abc123&type=multichoice&opts=Cut,Keep&guidance=Pick+one.&asker=alice@example.com&canonical=7"),
    parseQR("pile=cd04-q1&poll=open-q&round=2&tok=deadbeef&canonical=3"),        // open, no opts, no guidance
    parseQR("pile=p&poll=q&round=1&tok=t&repo=jur/tell&canonical=9"),            // jurisdiction repo
  ];
  const answers = ["Keep", "a free-form write-in with **markdown** & <html>", ""];
  let blockMatch = true, bodyMatch = true;
  for (const cfg of cases) for (const a of answers) {
    if (JSON.stringify(submissionBlock(cfg, a, { ts: TS })) !== JSON.stringify(oracleBlock(cfg, a, TS))) blockMatch = false;
    if (commentBody(cfg, a, { ts: TS }) !== oracleBody(cfg, a, TS)) bodyMatch = false;
  }
  ok(blockMatch, "the neutral tell.submission/v1 block is byte-identical to the frozen oracle (key order)");
  ok(bodyMatch, "the adapter's comment body carries that block byte-identically (the migration contract)");

  const block = submissionBlock(parseQR("pile=cd04-q1&poll=budget&round=1&tok=abc123&type=multichoice&guidance=Pick+one.&asker=alice@example.com"), "Keep", { ts: TS });
  ok(JSON.stringify(block) === '{"schema":"tell.submission/v1","pile":"cd04-q1","poll":"budget","round":"1","type":"multichoice","asker":"alice@example.com","shown_guidance":"Pick one.","tok":"abc123","answer":"Keep","ts":"2026-07-01T00:00:00.000Z"}',
     "the block serializes with the exact contract key order");
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

// 5. ALWAYS-CUSTOM invariant, and the view carries NO destinations (options are bare suggestions).
{
  const mc = answerView(parseQR("pile=p&poll=q&round=1&tok=t&type=multichoice&opts=Cut,Keep"));
  ok(mc.alwaysCustom === true, "a multichoice poll STILL promises a custom answer (no write-in gate)");
  ok(mc.options.length === 2 && mc.options[0].answer === "Cut", "options are suggestions — bare answers");
  ok(!("issueUrl" in mc.options[0]) && Object.keys(mc.options[0]).length === 1, "an option carries NO link/destination — the chamber drives the op");
  ok(answerView(parseQR("poll=x")).loaded === false, "an unloaded QR → the empty state");
}

// 5b. OBSERVABILITY of the empty state: the view says WHY it didn't load, param NAMES only.
{
  const none = answerView(parseQR(""));
  ok(none.why && none.why.rawQueryBytes === 0 && none.why.missing.length === 4,
     "an empty query says so: 0 bytes, all four required params missing");
  const partial = answerView(parseQR("pile=p&type=multichoice"));
  ok(partial.why.rawQueryBytes > 0 && partial.why.missing.join(",") === "poll,round,tok",
     "a partial query names exactly what's missing (poll, round, tok)");
  ok(partial.why.params.includes("pile") && partial.why.params.includes("type"), "…and names what arrived (names, not values)");
  ok(!partial.why.params.includes("repo"), "normalize's defaults (repo) do NOT masquerade as arrived");
  ok(JSON.stringify(partial.why).indexOf("multichoice") === -1, "the diagnosis carries NO param values");
  ok(answerView(parseQR("pil=oops&poll=q")).why.params.includes("pil"), "a typo'd param name shows itself");
  ok(!("why" in answerView(parseQR("pile=p&poll=q&round=1&tok=t"))), "a loaded view carries no diagnosis");
}

// 6. pollAnswerOps over the probe line — poll.view + poll.compose, both Rung 0 (no prompt), no destinations.
{
  const ops = pollAnswerOps({ qr: "pile=cd04-q1&poll=budget&round=1&tok=abc123&type=multichoice&opts=Cut,Keep&guidance=Pick+one.", ts: TS });
  const run = async (op, input) => { const frames = []; const s = elevatedSession({ ops, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
    await s.handle(request({ id: "x", op, input })); return frames; };

  const v = (await run("poll.view", {})).find((f) => f.type === FRAME && f.view)?.view;
  ok(v && v.question === "Reply to cd04-q1 / budget" && v.alwaysCustom, "poll.view returns the answer view with no prompt");
  ok(v.options.length === 2 && !("issueUrl" in v.options[0]), "poll.view carries bare suggested options — no links");

  const c = (await run("poll.compose", { answer: "Keep" })).find((f) => f.type === FRAME && f.block);
  ok(c && c.answer === "Keep" && c.block.answer === "Keep" && c.block.schema === SUBMISSION_SCHEMA, "poll.compose returns the neutral block (no destination)");
  ok(!("issueUrl" in c), "poll.compose emits NO url — nothing points at github");

  const empty = (await run("poll.compose", { answer: "  " })).find((f) => f.type === FRAME && "block" in f);
  ok(empty && empty.block === null, "poll.compose with a blank answer yields no block (nothing to submit yet)");
}

// 7. deliver — the public backend seam. Comment on the canonical issue, credential header-only, placement.
{
  const QR = "pile=cd04-q1&poll=budget&round=1&tok=abc123&type=multichoice&opts=Cut,Keep&guidance=Pick+one.&canonical=7";
  const cfg = parseQR(QR);
  const CRED = "ghs_semi_public_post_token";
  ok(cfg.backend.canonical === "7", "the QR's canonical= issue number is parsed into cfg.backend.canonical");
  ok(parseQR("pile=p&poll=q&round=1&tok=t&canonical=7x").backend.canonical === null, "a non-numeric canonical is refused, not carried");

  const req = commentRequest(cfg, "Keep", { ts: TS });
  ok(req.method === "POST" && req.path === "/repos/FCCN-ANTIBODY/tell.anecdote.channel/issues/7/comments",
     "commentRequest posts a comment onto the poll's canonical issue — never a fresh issue");
  ok(req.payload.body === oracleBody(cfg, "Keep", TS) && !("title" in req.payload) && !("labels" in req.payload),
     "the comment carries the frozen block bytes and nothing else");

  let seen = null;
  const api = async (call) => { seen = call; return { status: 201, json: { id: 77, html_url: "https://github.com/o/r/issues/7#issuecomment-77" } }; };
  const out = await deliver(cfg, "Keep", { api, credential: CRED, ts: TS });
  ok(seen.token === CRED, "the post credential is used as the transport token");
  ok(!JSON.stringify(seen.body).includes(CRED), "the credential is NEVER in the posted body");
  ok(out.placement.url === "https://github.com/o/r/issues/7#issuecomment-77" && out.placement.issue === 7,
     "the placement carries where the answer landed — the canonical issue");

  const ops = pollAnswerOps({ qr: QR, ts: TS, egressApi: api });
  const run = async (op, input, confirmed = true) => { const frames = []; const s = elevatedSession({ ops, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
    await s.handle(request({ id: "s", op, input, confirmed })); return frames; };

  const gated = (await run("poll.submit", { answer: "Keep", credential: CRED }, false)).find((f) => f.type === ERROR);
  ok(gated && gated.needsConfirm, "poll.submit is confirm-gated — an unconfirmed tap asks first, it does not fire");

  const sent = (await run("poll.submit", { answer: "Keep", credential: CRED })).find((f) => f.type === FRAME && "submitted" in f);
  ok(sent && sent.submitted === true && sent.placement && !JSON.stringify(sent).includes(CRED), "a confirmed poll.submit sends and emits the placement — the credential never enters a frame");

  // failure is surfaced, not swallowed — and it HOLDS (never a link out).
  const boom = async () => ({ status: 403, json: { message: "no" } });
  const opsF = pollAnswerOps({ qr: QR, ts: TS, egressApi: boom });
  const runF = async (input) => { const frames = []; const s = elevatedSession({ ops: opsF, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
    await s.handle(request({ id: "f", op: "poll.submit", input, confirmed: true })); return frames; };
  const failed = (await runF({ answer: "Keep", credential: CRED })).find((f) => f.type === FRAME && f.submitted === false);
  ok(failed && /403/.test(failed.error) && failed.held === true && !("issueUrl" in failed), "a failed submit is surfaced (error) and HELD for retry/carry — never a link");
}

// 7b. NO PUBLIC ROUTE → HELD for the mesh (the offline/presence default). Nothing is posted, no link is
// offered — the signed answer waits and travels (composer/ballot.mjs). A credential with no canonical also
// holds; the adapter is never touched without a thread to comment on.
{
  const cfg = parseQR("pile=cd04-q1&poll=budget&round=1&tok=abc123&type=open");   // no canonical, no route
  ok(cfg.backend.canonical === null, "a QR with no canonical carries none");
  let called = false;
  const api = async () => { called = true; return { status: 201, json: {} }; };

  // deliver defends itself if called without a thread; the router never calls it here.
  let threwReq = false; try { commentRequest(cfg, "Keep", { ts: TS }); } catch { threwReq = true; }
  ok(threwReq, "commentRequest has no target without a canonical issue");

  const ops = pollAnswerOps({ qr: "pile=cd04-q1&poll=budget&round=1&tok=abc123&type=open", ts: TS, egressApi: api });
  const run = async (input) => { const frames = []; const s = elevatedSession({ ops, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
    await s.handle(request({ id: "n", op: "poll.submit", input, confirmed: true })); return frames; };

  const heldNoCred = (await run({ answer: "Keep" })).find((f) => f.type === FRAME && "submitted" in f);
  ok(heldNoCred && heldNoCred.submitted === null && heldNoCred.held === true && !("issueUrl" in heldNoCred),
     "no credential + no route → HELD for the mesh, not a github link (the presence default)");
  const heldCredNoThread = (await run({ answer: "Keep", credential: "ghs_x" })).find((f) => f.type === FRAME && "submitted" in f);
  ok(heldCredNoThread && heldCredNoThread.held === true, "a credential with no canonical thread also holds — no dangling post");
  ok(!called, "the credentialed route was never exercised without a thread");
}

// 8. the QR-carried post credential — parsed, never in provenance/body, and used as the anonymous route
// WHEN the poll has a canonical thread.
{
  const CRED = "ghs_public_qr_token";
  const QR = `pile=cd04-q1&poll=budget&round=1&tok=abc123&type=open&canonical=7&sig=SIGBYTES&kid=SHA256%3Akkk&post=${CRED}`;
  const cfg = parseQR(QR);
  ok(cfg.backend.cred === CRED, "the QR's post= credential is parsed (decoded) into cfg.backend.cred");
  ok(!/post=/.test(cfg.rawQuery), "post= is STRIPPED from rawQuery — the provenance field never carries the credential");
  ok(/tok=abc123/.test(cfg.rawQuery) && /sig=SIGBYTES/.test(cfg.rawQuery), "the rest of the signed query survives byte-for-byte");

  const block = submissionBlock(cfg, "Keep", { ts: TS });
  ok(block.qr && !block.qr.includes(CRED), "block.qr carries the signed QR for provenance but NOT the credential");
  ok(!JSON.stringify(block).includes(CRED), "the credential appears nowhere in the submission block");

  let seen = null;
  const api = async (call) => { seen = call; return { status: 201, json: { id: 501, html_url: "https://github.com/o/r/issues/7#issuecomment-501" } }; };
  const ops = pollAnswerOps({ qr: QR, ts: TS, egressApi: api });
  const run = async (input) => { const frames = []; const s = elevatedSession({ ops, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
    await s.handle(request({ id: "q", op: "poll.submit", input, confirmed: true })); return frames; };
  const sent = (await run({ answer: "Keep" })).find((f) => f.type === FRAME && "submitted" in f);   // NO input.credential
  ok(seen && seen.token === CRED, "poll.submit falls back to the QR-carried credential for anonymous public");
  ok(seen.path.endsWith("/issues/7/comments"), "…and it only ever comments on the canonical issue");
  ok(sent && sent.submitted === true && !JSON.stringify(sent).includes(CRED), "it sends, and the credential never enters the emitted frame");
}

// 9. the submit-gateway relay (`submit=`) — the graduated route: a non-secret worker address, no client token.
{
  const SU = "https://tell.anecdote.channel/submit";
  const QR = `pile=cd04-q1&poll=budget&round=1&tok=abc123&type=open&canonical=7&submit=${encodeURIComponent(SU)}`;
  const cfg = parseQR(QR);
  ok(cfg.backend.submitUrl === SU, "the QR's submit= relay address is parsed (decoded) into cfg.backend.submitUrl");
  ok(/submit=/.test(cfg.rawQuery), "submit stays in rawQuery — an address is not a credential, and the Tell's canon drops it");
  ok(parseQR("pile=p&poll=q&round=1&tok=t&submit=http%3A%2F%2Finsecure").backend.submitUrl === null, "a non-https submit is refused, not carried");

  const fetches = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { fetches.push({ url, init }); return { status: 201, json: async () => ({ id: 501, html_url: "https://github.com/o/r/issues/7#issuecomment-501" }) }; };
  try {
    const out = await deliver(cfg, "Keep", { ts: TS });                   // no api, no credential → relay
    ok(fetches.length === 1 && fetches[0].url === SU, "the relay route POSTs to the submit address, not api.github.com");
    const relayed = JSON.parse(fetches[0].init.body);
    ok(relayed.path === "/repos/FCCN-ANTIBODY/tell.anecdote.channel/issues/7/comments" && relayed.body && !relayed.body.labels,
       "the relay carries the canonical issue's comments path — never a new-issue path");
    ok(/```tell\n/.test(relayed.body.body), "…and the comment body carries the fenced block, byte-identical to the direct route");
    ok(!fetches[0].init.headers.Authorization, "no Authorization header — the client holds no credential at all");
    ok(out.placement.issue === 7, "the relay's projection still resolves to a placement on the canonical issue");
  } finally { globalThis.fetch = realFetch; }

  const QR2 = QR + "&post=ghs_should_lose";
  let seen = null;
  const api = async (call) => { seen = call; return { status: 201, json: { number: 6, html_url: "https://github.com/o/r/issues/6" } }; };
  const ops = pollAnswerOps({ qr: QR2, ts: TS, egressApi: api });
  const run = async (input) => { const frames = []; const s = elevatedSession({ ops, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
    await s.handle(request({ id: "r", op: "poll.submit", input, confirmed: true })); return frames; };
  const sent = (await run({ answer: "Keep" })).find((f) => f.type === FRAME && "submitted" in f);
  ok(sent && sent.submitted === true, "poll.submit sends through the relay route with no client credential");
  ok(seen && !seen.token, "the relay route hands the transport NO token — the stray legacy credential lost");
  seen = null;
  await run({ answer: "Keep", credential: "ghs_host" });
  ok(seen && seen.token === "ghs_host", "an explicitly host-injected credential still wins over the relay");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall submission/adapter/router tests passed");
