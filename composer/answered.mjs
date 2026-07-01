// composer/answered.mjs — the "remember" face of anecdote.poll/v1 (docs/system-viewer.md). The offline
// app's job on the responder side: REMEMBER the polls you've answered. Where the trove of nonsense lives
// (composer/consent.mjs), connected to it are the polls you probably answered to get those items — so a
// remembered answer can point at the trove RECEIPT the answer produced. This is the one poll face that
// needs Elevated persistence: a data: chamber has no storage, so `poll.remember` runs Elevated (Rung 1).
//
// Same store contract as the trove/grants: an injected { get, set, delete } (async, domain-scoped). One
// record per (pile, poll, round) — re-answering the same round updates it (you answered it once).

import { parseQR, issueUrl, submissionBlock } from "./poll-answer.mjs";

export const ANSWERED = "anecdote.answered/v1";
const ANSWERED_KEY = "anecdote:answered";

async function readAll(store) { const raw = await store.get(ANSWERED_KEY); return raw ? JSON.parse(raw) : {}; }
async function writeAll(store, m) { await store.set(ANSWERED_KEY, JSON.stringify(m)); }

// One remembered answer per poll-round.
export function answeredKey(cfg) { return `${cfg.pile}:${cfg.poll}:${cfg.round}`; }

// The lean view of a record for the wire / a list widget (drops the full submission block).
function summary(r) {
  return { key: r.key, pile: r.pile, poll: r.poll, round: r.round, type: r.type,
           question: r.question, answer: r.answer, repo: r.repo, issueUrl: r.issueUrl,
           receipt: r.receipt, answered_at: r.answered_at };
}

// Remember an answer you gave to a poll. `qr` is the scanned QR (or pass a parsed `cfg`); `answer` is what
// you replied; `receipt` optionally links the trove entry (nonce) this answer produced. Idempotent per
// poll-round. Stores + returns the full record (with the exact submission it composes).
export async function rememberAnswer(store, { qr, cfg, answer, receipt = null, ts, canonicalRepo } = {}) {
  const c = cfg || parseQR(qr, { canonicalRepo });
  if (!c.loaded) throw new Error("answered: need a loaded poll QR (pile/poll/round/tok) to remember an answer");
  if (typeof answer !== "string" || !answer.trim()) throw new Error("answered: need the answer you gave");
  const at = ts || new Date().toISOString();
  const record = {
    schema: ANSWERED,
    key: answeredKey(c),
    pile: c.pile, poll: c.poll, round: c.round, type: c.type,
    question: c.question, options: c.options, repo: c.repo,
    answer, tok: c.tok,
    issueUrl: issueUrl(c, answer, { ts: at }),
    submission: submissionBlock(c, answer, { ts: at }),
    receipt,                    // the trove nonce this answer produced (the anecdote you made), or null
    answered_at: at,
  };
  const all = await readAll(store);
  all[record.key] = record;
  await writeAll(store, all);
  return record;
}

// Everything you've answered (records, whole).
export async function listAnswered(store) { return Object.values(await readAll(store)); }
export async function getAnswered(store, key) { return (await readAll(store))[key] || null; }

// Hard local delete — forget you answered a poll (does not withdraw the submission already sent).
export async function forgetAnswered(store, key) {
  const all = await readAll(store); delete all[key]; await writeAll(store, all);
}

// The "polls you've answered" view, newest first, each JOINED to the trove item it produced (if any).
// `resolveReceipt(nonce) -> { nonce, label, status } | null` is injected so this stays decoupled from the
// trove's storage (the ops factory wires it to consent.get; tests pass a fake).
export async function answeredView(store, { resolveReceipt } = {}) {
  const records = Object.values(await readAll(store));
  const out = [];
  for (const r of records) {
    let trove = null;
    if (r.receipt && resolveReceipt) {
      const rc = await resolveReceipt(r.receipt);
      if (rc) trove = { nonce: rc.nonce, label: rc.label, status: rc.status };
    }
    out.push({ ...summary(r), trove });
  }
  return out.sort((a, b) => (a.answered_at < b.answered_at ? 1 : a.answered_at > b.answered_at ? -1 : 0));
}

// The remember face as probe-line capabilities. `store` is Elevated storage; `troveStore` (default: the
// same store) resolves receipt links via consent.get. poll.remember persists (Rung 1 — refused in
// incognito by the gate); poll.answered lists (Rung 0).
export function answeredOps({ store, troveStore, canonicalRepo } = {}) {
  if (!store) throw new Error("answered ops: need a store ({get,set,delete})");
  const trove = troveStore || store;
  return {
    "poll.remember": async (input, api) => {
      await api.tick();                                   // cancel lands BEFORE the write (commit atomicity)
      const rec = await rememberAnswer(store, { qr: input && input.qr, cfg: input && input.cfg,
        answer: input && input.answer, receipt: input && input.receipt, canonicalRepo });
      api.emit({ remembered: summary(rec), issueUrl: rec.issueUrl });
    },
    "poll.answered": async (_input, api) => {
      const { get } = await import("./consent.mjs");     // resolve receipt → trove entry, lazily
      api.emit({ answered: await answeredView(store, { resolveReceipt: (n) => get(trove, n) }) });
    },
  };
}
