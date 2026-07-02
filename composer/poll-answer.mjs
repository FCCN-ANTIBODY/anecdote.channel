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

// The pre-filled GitHub issues/new URL for a chosen answer (byte-identical to index.md's issueUrl).
export function issueUrl(cfg, answer, { ts } = {}) {
  const block = submissionBlock(cfg, answer, { ts });
  const body = `Reply to **${cfg.pile}** / poll **${cfg.poll}** — option: **${answer}**\n\n` +
               "```tell\n" + JSON.stringify(block) + "\n```\n";
  const qs = "title=" + encodeURIComponent(`tell submission ${cfg.pile} / ${cfg.poll}`) +
             "&labels=" + encodeURIComponent("tell-submission") +
             "&body=" + encodeURIComponent(body);
  return `https://github.com/${cfg.repo}/issues/new?` + qs;
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

// The poll-answer view as probe-line capabilities. Both Rung 0: rendering the poll and building the reply
// link are pure compute — no persistence, no egress (the submit is the user leaving to click the link).
// `qr` is the scanned QR (Elevated has the real URL; the powerless chamber does not). The later "remember
// the polls you answered" face adds a Rung-1 `poll.remember` op that persists into a pile.
export function pollAnswerOps({ qr, canonicalRepo, ts } = {}) {
  const cfg = parseQR(qr, { canonicalRepo });
  return {
    "poll.view": async (_input, api) => { api.emit({ view: answerView(cfg, { ts }) }); },
    "poll.compose": async (input, api) => {
      const answer = ((input && input.answer) || "").trim();
      api.emit({ answer, issueUrl: answer ? issueUrl(cfg, answer, { ts }) : null,
                 block: answer ? submissionBlock(cfg, answer, { ts }) : null });
    },
  };
}
