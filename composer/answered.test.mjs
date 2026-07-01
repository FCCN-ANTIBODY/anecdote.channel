// Unit: the "remember" face — persist the polls you answered, one per poll-round, joined to the trove item
// each produced. Plus the gated ops (Rung-1 remember refused in incognito; Rung-0 list). Run:
// node composer/answered.test.mjs
import { elevatedSession, request, FRAME, ERROR } from "./probe-line.mjs";
import { rememberAnswer, listAnswered, getAnswered, forgetAnswered, answeredView, answeredKey, answeredOps, ANSWERED } from "./answered.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// An in-memory { get, set, delete } store (the domain-scoped contract consent.mjs uses).
const memStore = () => { const m = new Map(); return { get: async (k) => (m.has(k) ? m.get(k) : null), set: async (k, v) => void m.set(k, v), delete: async (k) => void m.delete(k) }; };

const QR = "pile=cd04-q1&poll=budget&round=1&tok=abc123&type=multichoice&opts=Cut,Keep&guidance=Pick+one.";

// 1. remember an answer → stored, keyed by pile:poll:round, with the composed submission.
{
  const store = memStore();
  const rec = await rememberAnswer(store, { qr: QR, answer: "Keep", ts: "2026-07-01T00:00:00.000Z" });
  ok(rec.schema === ANSWERED && rec.key === "cd04-q1:budget:1", "keyed by pile:poll:round");
  ok(rec.answer === "Keep" && rec.submission.answer === "Keep" && rec.submission.tok === "abc123", "keeps the answer + the composed tell.submission/v1");
  ok(rec.issueUrl.includes("/issues/new"), "keeps the reply link");
  ok((await listAnswered(store)).length === 1, "listAnswered shows it");
  ok((await getAnswered(store, "cd04-q1:budget:1")).answer === "Keep", "getAnswered by key");
}

// 2. re-answering the same poll-round UPDATES (one record per poll-round), a different poll adds one.
{
  const store = memStore();
  await rememberAnswer(store, { qr: QR, answer: "Cut", ts: "2026-07-01T00:00:00.000Z" });
  await rememberAnswer(store, { qr: QR, answer: "Keep", ts: "2026-07-01T01:00:00.000Z" });    // same round
  await rememberAnswer(store, { qr: "pile=p&poll=other&round=1&tok=t", answer: "yes", ts: "2026-07-01T02:00:00.000Z" });
  const all = await listAnswered(store);
  ok(all.length === 2, "re-answering a round updates in place; a new poll adds a record");
  ok((await getAnswered(store, "cd04-q1:budget:1")).answer === "Keep", "the updated answer wins");
}

// 3. a loaded QR is required, and a non-empty answer.
{
  const store = memStore();
  let a = false, b = false;
  try { await rememberAnswer(store, { qr: "poll=x", answer: "y" }); } catch { a = true; }
  try { await rememberAnswer(store, { qr: QR, answer: "  " }); } catch { b = true; }
  ok(a, "an unloaded QR is refused"); ok(b, "a blank answer is refused");
}

// 4. answeredView joins each answer to the trove item it produced (via injected resolveReceipt).
{
  const store = memStore();
  await rememberAnswer(store, { qr: QR, answer: "Keep", receipt: "nonce:xyz", ts: "2026-07-01T00:00:00.000Z" });
  await rememberAnswer(store, { qr: "pile=p&poll=solo&round=1&tok=t", answer: "just saying", ts: "2026-07-01T01:00:00.000Z" });
  const trove = { "nonce:xyz": { nonce: "nonce:xyz", label: "keep the budget", status: "live" } };
  const view = await answeredView(store, { resolveReceipt: async (n) => trove[n] || null });
  ok(view[0].poll === "solo", "newest-first ordering");
  const budget = view.find((v) => v.poll === "budget");
  ok(budget.trove && budget.trove.label === "keep the budget" && budget.trove.status === "live", "an answer is linked to the trove item it produced");
  ok(view.find((v) => v.poll === "solo").trove === null, "an answer with no receipt has no trove link");
  ok(!("submission" in budget), "the view is lean (no full submission block on the wire)");
}

// 5. forget.
{
  const store = memStore();
  await rememberAnswer(store, { qr: QR, answer: "Keep", ts: "2026-07-01T00:00:00.000Z" });
  await forgetAnswered(store, "cd04-q1:budget:1");
  ok((await listAnswered(store)).length === 0, "forgetAnswered removes the record");
}

// 6. ops over the probe line: poll.remember is Rung 1 (refused in incognito), poll.answered is Rung 0.
{
  const store = memStore();
  const ops = answeredOps({ store });
  const run = (op, input, ctx) => { const frames = []; const s = elevatedSession({ ops, emit: (f) => frames.push(f), context: () => ctx });
    return s.handle(request({ id: "x", op, input, confirmed: ctx.confirmed })).then(() => frames); };

  // incognito (recordingOn:false) refuses the persisting remember
  const inc = await run("poll.remember", { qr: QR, answer: "Keep" }, { recordingOn: false, grants: [] });
  ok(inc.some((f) => f.type === ERROR), "poll.remember refused in incognito (persistence off)");
  ok((await listAnswered(store)).length === 0, "nothing written when refused");

  // needs confirmation (Rung 1)
  const noconf = await run("poll.remember", { qr: QR, answer: "Keep" }, { recordingOn: true, grants: [] });
  ok(noconf.some((f) => f.type === ERROR && f.needsConfirm), "poll.remember needs a confirmation (Rung 1)");

  // confirmed → persists + returns the link
  const done = await run("poll.remember", { qr: QR, answer: "Keep" }, { recordingOn: true, grants: [], confirmed: true });
  ok(done.some((f) => f.type === FRAME && f.remembered && f.issueUrl), "confirmed poll.remember persists + returns the reply link");

  // poll.answered lists it (Rung 0, no prompt)
  const listed = await run("poll.answered", {}, { recordingOn: true, grants: [] });
  const arr = listed.find((f) => f.type === FRAME && f.answered)?.answered;
  ok(arr && arr.length === 1 && arr[0].answer === "Keep", "poll.answered lists the remembered answer with no prompt");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall answered tests passed");
