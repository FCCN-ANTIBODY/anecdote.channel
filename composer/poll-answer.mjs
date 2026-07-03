// composer/poll-answer.mjs — the poll-answer view: anecdote shaped by a Tell QR (docs/system-viewer.md,
// the "answer face"). This is what `tell.anecdote.channel/index.md` becomes when it moves into anecdote:
// you land on a poll's QR, it shows the single question, and — always offering a CUSTOM answer, with any
// options shown only as SUGGESTIONS — it builds a pre-filled GitHub issue carrying a `tell.submission/v1`
// block addressed to the Tell whose Issues are this poll's mailbox. Nothing phones home: this only builds a
// link; the click that opens the issue is the user's.
//
// The QR was addressed to a Tell from the start (the token is minted against pile+poll+round); an Atlas
// showing it in public is just lending the photocopy. So "answering a poll" is always a Tell submission.
//
// anecdote's invariant: THE ANSWER IS ALWAYS CUSTOM. There is no write-in "choice" — we don't honor a
// `writein` gate and never hide the custom box; options are suggestions. Byte-parity with the wire format
// index.md emits (schema/field order/URL shape) is the migration contract — see poll-answer.test.mjs, whose
// oracle is index.md's own construction frozen as the contract.

import { githubApi } from "./egress-github.mjs";

export const SUBMISSION_SCHEMA = "tell.submission/v1";
export const CANONICAL_REPO = "FCCN-ANTIBODY/tell.anecdote.channel";
const REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

// Parse a Tell QR into the answer config. `input` is a URL, a raw query string, or a params object.
// Mirrors index.md's params(): search wins over hash, first value for a key wins. `rawQuery` is the
// verbatim, UNDECODED query — a signed poll's provenance must travel byte-for-byte into the reply.
export function parseQR(input, { canonicalRepo = CANONICAL_REPO } = {}) {
  let search = "", hash = "";
  if (input && typeof input === "object" && !(input instanceof URL)) {
    // a plain params object — treat it as already-parsed config
    return normalize(input, { canonicalRepo, rawQuery: toQuery(input) });
  }
  const s = String(input || "");
  if (s.includes("://") || s.startsWith("data:") || s.startsWith("http")) {
    try { const u = new URL(s); search = u.search.replace(/^\?/, ""); hash = (u.hash || "").replace(/^#/, ""); } catch {}
  } else if (s.startsWith("#")) { hash = s.replace(/^#/, ""); }
  else { search = s.replace(/^\?/, ""); }

  const out = {};
  const take = (src) => { try { new URLSearchParams(src).forEach((v, k) => { if (!(k in out)) out[k] = v; }); } catch {} };
  take(search); take(hash);
  const rawQuery = search || hash;      // where bin/qr puts the params; hash is the fallback
  return normalize(out, { canonicalRepo, rawQuery });
}

function normalize(cfg, { canonicalRepo, rawQuery }) {
  const loaded = !!(cfg.pile && cfg.poll && cfg.round && cfg.tok);
  const options = (cfg.opts ? String(cfg.opts).split(",") : []).map((s) => s.trim()).filter(Boolean);
  const repo = cfg.repo && REPO_RE.test(cfg.repo) ? cfg.repo : canonicalRepo;
  return {
    loaded,
    pile: cfg.pile, poll: cfg.poll, round: cfg.round, tok: cfg.tok,
    type: cfg.type || "open", asker: cfg.asker || "", guidance: cfg.guidance || "",
    question: cfg.q || (cfg.pile && cfg.poll ? `Reply to ${cfg.pile} / ${cfg.poll}` : ""),
    options,                       // SUGGESTED answers (may be empty)
    repo, sig: cfg.sig || null, rawQuery,
  };
}

function toQuery(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v != null) p.set(k, String(v));
  return p.toString();
}

// The tell.submission/v1 block for a chosen answer. KEY ORDER IS THE CONTRACT (index.md builds the object
// literal in exactly this order; JSON.stringify preserves it, and the Tell's authz reads the token). `ts`
// is injectable so the wire output is deterministic under test.
export function submissionBlock(cfg, answer, { ts } = {}) {
  const block = {
    schema: SUBMISSION_SCHEMA,
    pile: cfg.pile, poll: cfg.poll, round: cfg.round,
    type: cfg.type || "open", asker: cfg.asker || "",
    shown_guidance: cfg.guidance || "",
    tok: cfg.tok, answer, ts: ts || new Date().toISOString(),
  };
  if (cfg.sig) block.qr = cfg.rawQuery;   // carry the signed QR verbatim for the Tell to verify provenance
  return block;
}

// The issue content for a chosen answer — title, labels, body — in ONE place, so the pre-filled URL and the
// direct POST submit byte-identical content (the migration equivalence; both carry the same signed block).
export function issueParts(cfg, answer, { ts } = {}) {
  const block = submissionBlock(cfg, answer, { ts });
  const body = `Reply to **${cfg.pile}** / poll **${cfg.poll}** — option: **${answer}**\n\n` +
               "```tell\n" + JSON.stringify(block) + "\n```\n";
  return { title: `tell submission ${cfg.pile} / ${cfg.poll}`, labels: ["tell-submission"], body, block };
}

// The pre-filled GitHub issues/new URL for a chosen answer (byte-identical to index.md's issueUrl). This is
// the NO-CREDENTIAL, phones-home-nothing fallback: it only builds a link; the click is the user's. Kept as
// the escape hatch even once the direct POST lands (works over long-press/new-tab, needs no post token).
export function issueUrl(cfg, answer, { ts } = {}) {
  const { title, labels, body } = issueParts(cfg, answer, { ts });
  const qs = "title=" + encodeURIComponent(title) +
             "&labels=" + encodeURIComponent(labels.join(",")) +
             "&body=" + encodeURIComponent(body);
  return `https://github.com/${cfg.repo}/issues/new?` + qs;
}

// The same submission as a GitHub API request — POST a fresh issue instead of navigating to issues/new. No
// network, no credential here (pure): the credential is passed to the transport at call time, header-only.
export function issueRequest(cfg, answer, { ts } = {}) {
  const [owner, name] = String(cfg.repo).split("/");
  const { title, labels, body } = issueParts(cfg, answer, { ts });
  return { method: "POST", path: `/repos/${owner}/${name}/issues`, payload: { title, body, labels } };
}

// Submit a chosen answer directly over HTTP — the tap that SENDS, lifting the seam off the github.com URL
// that routes badly on mobile. The `credential` is the semi-public post token (host-supplied, transient);
// it rides ONLY in the transport's Authorization header, NEVER in the request body or the returned
// placement. Throws on a non-2xx so the caller can surface "not accepted" — the submit is never silent.
export async function submitAnswer(cfg, answer, { api, credential, ts } = {}) {
  const a = (answer || "").trim();
  if (!a) throw new Error("poll-answer: nothing to submit");
  if (!credential) throw new Error("poll-answer: no post credential — use issueUrl (the no-credential fallback)");
  const req = issueRequest(cfg, a, { ts });
  const call = api || githubApi;
  const res = await call({ method: req.method, path: req.path, body: req.payload, token: credential });
  if (!res || res.status >= 300) throw new Error(`poll-answer: github responded ${res ? res.status : "?"}${res && res.json && res.json.message ? " — " + res.json.message : ""}`);
  const j = res.json || {};
  return { placement: { repo: cfg.repo, url: j.html_url || null, id: j.id != null ? j.id : null, issue: j.number != null ? j.number : null } };
}

// The view-model a chamber renders: the question + guidance + SUGGESTED options (each with its prebuilt
// issue link) + the always-custom promise. `ts` pins option links' timestamps under test.
//
// OBSERVABILITY: when the poll DIDN'T load, the view says WHY — no query at all vs a query missing required
// params — with param NAMES only, never values (the tok is an authorization). Three different failures used
// to collapse into one "No poll loaded" (docs/probe-line.md); a chamber can now render the diagnosis.
export function answerView(cfg, { ts } = {}) {
  if (!cfg.loaded) return {
    loaded: false,
    why: {
      rawQueryBytes: (cfg.rawQuery || "").length,
      // what ACTUALLY arrived, straight from the raw query — unrecognized names included, so a typo'd
      // param shows itself (normalize's defaults, like repo, must not masquerade as arrived)
      params: [...new Set([...new URLSearchParams(cfg.rawQuery || "").keys()])],
      missing: ["pile", "poll", "round", "tok"].filter((k) => !cfg[k]),
    },
  };
  return {
    loaded: true,
    pile: cfg.pile, poll: cfg.poll, round: cfg.round, type: cfg.type,
    question: cfg.question, guidance: cfg.guidance, repo: cfg.repo, signed: !!cfg.sig,
    alwaysCustom: true,                                             // anecdote's invariant
    options: cfg.options.map((o) => ({ answer: o, issueUrl: issueUrl(cfg, o, { ts }) })),
  };
}

// The poll-answer view as probe-line capabilities. `poll.view` and `poll.compose` are Rung 0 — rendering the
// poll and building the reply link/block are pure compute. `poll.compose` is the PREVIEW the confirm shows
// (the answer + exactly what will be sent); `poll.submit` is the Rung-1 tap that actually SENDS it — the two
// split encodes the confirm posture (a tap never fires an irrevocable submit; you confirm what compose drew).
// `qr` is the scanned QR (Elevated has the real URL; the powerless chamber does not). `egressApi` is the
// injected GitHub transport; the post credential is host-supplied per submit, transient, never stored.
export function pollAnswerOps({ qr, canonicalRepo, ts, egressApi } = {}) {
  const cfg = parseQR(qr, { canonicalRepo });
  return {
    "poll.view": async (_input, api) => { api.emit({ view: answerView(cfg, { ts }) }); },
    "poll.compose": async (input, api) => {
      const answer = ((input && input.answer) || "").trim();
      api.emit({ answer, issueUrl: answer ? issueUrl(cfg, answer, { ts }) : null,
                 block: answer ? submissionBlock(cfg, answer, { ts }) : null });
    },
    // The confirm-gated SEND. With a post credential it POSTs directly (no github.com tap-through); without
    // one it emits the issueUrl so the caller falls back to the link. The credential never enters a frame.
    "poll.submit": async (input, api) => {
      const answer = ((input && input.answer) || "").trim();
      const credential = input && input.credential;
      if (!answer) { api.emit({ submitted: null, issueUrl: null }); return; }
      if (!credential) { api.emit({ submitted: null, issueUrl: issueUrl(cfg, answer, { ts }) }); return; }
      try {
        const { placement } = await submitAnswer(cfg, answer, { api: egressApi, credential, ts });
        api.emit({ submitted: true, placement });                 // no credential in the frame
      } catch (e) {
        api.emit({ submitted: false, error: e.message, issueUrl: issueUrl(cfg, answer, { ts }) });  // never silent; fallback offered
      }
    },
  };
}
