// composer/poll-answer.mjs — the poll-answer view: anecdote shaped by a Tell QR (docs/system-viewer.md,
// the "answer face"). This is what `tell.anecdote.channel/index.md` becomes when it moves into anecdote:
// you land on a poll's QR, it shows the single question, and — always offering a CUSTOM answer, with any
// options shown only as SUGGESTIONS — it composes a `tell.submission/v1` block addressed to the Tell whose
// Issues are this poll's mailbox. A credentialed submit only ever COMMENTS on the poll's canonical issue
// (`canonical=`; issue-per-response is retired). The base face still phones home nothing: it builds a
// pre-filled issues/new link, and the click that opens the issue is the user's — the one new-issue path.
//
// The QR was addressed to a Tell from the start (the token is minted against pile+poll+round); an Atlas
// showing it in public is just lending the photocopy. So "answering a poll" is always a Tell submission.
//
// anecdote's invariant: THE ANSWER IS ALWAYS CUSTOM. There is no write-in "choice" — we don't honor a
// `writein` gate and never hide the custom box; options are suggestions. Byte-parity with the wire format
// index.md emits (schema/field order/URL shape) is the migration contract — see poll-answer.test.mjs, whose
// oracle is index.md's own construction frozen as the contract.

import { githubApi, relayApi } from "./egress-github.mjs";

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

// Remove the `post=` credential pair from a raw query, preserving the rest byte-for-byte. bin/qr appends it
// AFTER the signature preimage and tl_qr_canon drops `post`, so the Tell never signs it; the client must
// likewise keep it OUT of the provenance field it carries forward (block.qr), and out of the submission body.
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
    cred: cfg.post || null,        // the semi-public post credential the QR carried (decoded), if any (legacy)
    // the Tell's submit-gateway address (`su=`) — a non-secret relay that holds the credential SERVER-SIDE
    // (tell …/workers/submit-gateway). https-only, mirroring bin/qr's own validation. Unlike `post` it may
    // stay in rawQuery: it is an address, not a bearer token, and the Tell's canon drops it (tl_qr_canon).
    submitUrl: /^https:\/\//.test(cfg.su || "") ? cfg.su : null,
    // the poll's CANONICAL issue number (`canonical=`, bin/open-poll → bin/qr) — the one thread every
    // credentialed reply comments onto. Digits only, like bin/qr's own validation. Absent => the only
    // submit route is the credential-free issueUrl fallback (mode=issue is retired for credentialed paths).
    canonical: /^[0-9]+$/.test(cfg.canonical || "") ? String(cfg.canonical) : null,
    rawQuery: stripCred(rawQuery), // the credential NEVER rides in the provenance field or the submission body
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

// The same submission as a GitHub API request — a COMMENT on the poll's canonical issue, the one thread
// every credentialed reply lands on (issue-per-response is retired; only the issueUrl fallback still opens
// a fresh issue, and there the click is the respondent's own). The comment body carries the identical
// fenced block the issueUrl would — same bytes, different envelope (comments take no title/labels). No
// network, no credential here (pure): the credential is passed to the transport at call time, header-only.
export function commentRequest(cfg, answer, { ts } = {}) {
  if (!cfg.canonical) throw new Error("poll-answer: no canonical issue to comment on (the QR carried no canonical=)");
  const [owner, name] = String(cfg.repo).split("/");
  const { body } = issueParts(cfg, answer, { ts });
  return { method: "POST", path: `/repos/${owner}/${name}/issues/${cfg.canonical}/comments`, payload: { body } };
}

// Submit a chosen answer directly over HTTP — the tap that SENDS, lifting the seam off the github.com URL
// that routes badly on mobile. Two routes, one wire shape:
//   credential — the semi-public post token (host-supplied, transient); rides ONLY in the transport's
//                Authorization header, NEVER in the request body or the returned placement.
//   submitUrl  — the Tell's submit-gateway relay (`su=`): the client holds NO credential at all; the
//                worker injects it server-side. Preferred over a QR-carried credential.
// EVERY credentialed route lands as a comment on the poll's canonical issue — issue-per-response is
// retired, and a QR with no canonical= has no credentialed route at all (the caller falls back to
// issueUrl, where the respondent's own click is the authority).
// Throws on a non-2xx so the caller can surface "not accepted" — the submit is never silent.
export async function submitAnswer(cfg, answer, { api, credential, submitUrl, ts } = {}) {
  const a = (answer || "").trim();
  if (!a) throw new Error("poll-answer: nothing to submit");
  const relay = submitUrl || cfg.submitUrl;
  if (!credential && !relay) throw new Error("poll-answer: no submit route — use issueUrl (the no-credential fallback)");
  if (!cfg.canonical) throw new Error("poll-answer: no canonical issue — a credentialed submit only ever comments on the poll's one thread (issue-per-response is retired); use issueUrl, the own-click fallback");
  const req = commentRequest(cfg, a, { ts });
  const call = api || (credential ? githubApi : relayApi(relay));
  const res = await call({ method: req.method, path: req.path, body: req.payload, token: credential });
  if (!res || res.status >= 300) throw new Error(`poll-answer: github responded ${res ? res.status : "?"}${res && res.json && res.json.message ? " — " + res.json.message : ""}`);
  const j = res.json || {};
  return { placement: { repo: cfg.repo, url: j.html_url || null, id: j.id != null ? j.id : null, issue: Number(cfg.canonical) } };
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
    // The confirm-gated SEND. Route order: a host-injected credential wins (operator chamber); else the
    // Tell's submit-gateway relay (`su=` — no client credential at all); else the QR-carried post token
    // (legacy anonymous public); else emit the issueUrl so the caller falls back to the link. Every
    // credentialed route comments on the poll's canonical issue — with no canonical= there is no
    // credentialed route, and the issueUrl fallback (the respondent's own click) is offered instead.
    // Neither a credential nor the relay address ever enters a frame.
    "poll.submit": async (input, api) => {
      const answer = ((input && input.answer) || "").trim();
      const credential = (input && input.credential) || (cfg.submitUrl ? null : cfg.cred);
      if (!answer) { api.emit({ submitted: null, issueUrl: null }); return; }
      if ((!credential && !cfg.submitUrl) || !cfg.canonical) { api.emit({ submitted: null, issueUrl: issueUrl(cfg, answer, { ts }) }); return; }
      try {
        const { placement } = await submitAnswer(cfg, answer, { api: egressApi, credential, ts });
        api.emit({ submitted: true, placement });                 // no credential in the frame
      } catch (e) {
        api.emit({ submitted: false, error: e.message, issueUrl: issueUrl(cfg, answer, { ts }) });  // never silent; fallback offered
      }
    },
  };
}
