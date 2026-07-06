// composer/submission.mjs — the BACKEND-BLIND core of answering a poll (docs/backend-seam.md).
// A Tell QR names a poll (pile+poll+round+tok) and, always offering a CUSTOM answer with any options
// shown only as SUGGESTIONS, this module turns a chosen answer into a neutral, signed `tell.submission/v1`
// block. That block is the artifact both backends carry: the public one (a relay's API action —
// composer/egress-github.mjs) and the presence one (the mesh — composer/ballot.mjs). The router
// (composer/submit-route.mjs) picks which; NOTHING here knows about issues, comments, POSTs, or tokens.
//
// The QR also carries a CREDENTIAL SLOT — `post`/`su`/`canonical`: reserved, bounded, backend-only fields
// this core parses and passes through OPAQUELY and never reads. Filled when a public backend will serve;
// empty when the exchange is presence-only (a valid, "no-token" mint). `repo` is likewise an opaque
// OWNER/NAME address the adapter interprets — the core never builds a URL or an API path from it.
//
// anecdote's invariant: THE ANSWER IS ALWAYS CUSTOM. No write-in "choice", never a hidden custom box;
// options are suggestions. Byte-parity of the `tell.submission/v1` block (schema + field order) is the
// migration contract — see composer/submission.test.mjs, whose oracle freezes the block shape.

export const SUBMISSION_SCHEMA = "tell.submission/v1";
// The default mailbox address a QR assumes when it names none — an opaque OWNER/NAME coordinate the
// backend adapter resolves; the core treats it as a string, never a github target.
export const CANONICAL_REPO = "FCCN-ANTIBODY/tell.anecdote.channel";
const REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

// Parse a Tell QR into the answer config. `input` is a URL, a raw query string, or a params object.
// Search wins over hash, first value for a key wins. `rawQuery` is the verbatim, UNDECODED query — a
// signed poll's provenance must travel byte-for-byte into the reply.
export function parseQR(input, { canonicalRepo = CANONICAL_REPO } = {}) {
  let search = "", hash = "";
  if (input && typeof input === "object" && !(input instanceof URL)) {
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

// Remove the `post=` credential pair from a raw query, preserving the rest byte-for-byte. bin/qr appends it
// AFTER the signature preimage and tl_qr_canon drops `post`, so the Tell never signs it; the client must
// likewise keep it OUT of the provenance field it carries forward (block.qr) and out of the submission body.
function stripCred(q) {
  return String(q || "").replace(/(?:^|&)post=[^&]*/g, "").replace(/^&/, "");
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
    repo, sig: cfg.sig || null,
    // ---- the backend credential slot: parsed, carried, NEVER interpreted here ----
    cred: cfg.post || null,        // legacy semi-public post token (decoded), if any
    submitUrl: /^https:\/\//.test(cfg.su || "") ? cfg.su : null,   // a relay address (`su=`), https-only
    canonical: /^[0-9]+$/.test(cfg.canonical || "") ? String(cfg.canonical) : null, // the poll's one thread
    // -------------------------------------------------------------------------------
    rawQuery: stripCred(rawQuery), // the credential NEVER rides in the provenance field or the submission body
  };
}

function toQuery(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v != null) p.set(k, String(v));
  return p.toString();
}

// The tell.submission/v1 block for a chosen answer. KEY ORDER IS THE CONTRACT (JSON.stringify preserves it,
// and the Tell's authz reads the token). `ts` is injectable so the wire output is deterministic under test.
// This is the neutral, backend-blind artifact both routes carry.
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

// The view-model a chamber renders: the question + guidance + SUGGESTED options (bare answers — a chamber
// drives the compose/submit op, it does NOT link out anywhere) + the always-custom promise.
//
// OBSERVABILITY: when the poll DIDN'T load, the view says WHY — no query vs a query missing required params —
// with param NAMES only, never values (the tok is an authorization).
export function answerView(cfg) {
  if (!cfg.loaded) return {
    loaded: false,
    why: {
      rawQueryBytes: (cfg.rawQuery || "").length,
      params: [...new Set([...new URLSearchParams(cfg.rawQuery || "").keys()])],
      missing: ["pile", "poll", "round", "tok"].filter((k) => !cfg[k]),
    },
  };
  return {
    loaded: true,
    pile: cfg.pile, poll: cfg.poll, round: cfg.round, type: cfg.type,
    question: cfg.question, guidance: cfg.guidance, repo: cfg.repo, signed: !!cfg.sig,
    alwaysCustom: true,                                             // anecdote's invariant
    options: cfg.options.map((o) => ({ answer: o })),              // suggestions only, no destinations
  };
}
