// composer/egress-github.mjs — "out the door": serialize a delivery into a GitHub issue/comment and
// post it, so a response actually reaches a Tell's mailbox (CONTRACT.md → "Ingress: QR → authorized
// Issue → digest"). Pure serialization + an injected HTTP seam, in the house style.
//
// THREE distinct tokens, never confused (this is the crux):
//   - the POST CREDENTIAL — a semi-public, GitHub-acceptable write token the Tell minted into the QR
//     so a respondent needs no GitHub account of their own. It is used ONLY in the Authorization
//     header; it is NEVER serialized into the body, the placement, or the trove. (Its blast radius is
//     "anyone with the QR can comment on this one repo" — a public comment box, which is what a poll
//     inbox is; mitigations live in docs/egress-github.md.)
//   - the `tok` — the existing HMAC capability bound to {pile,poll,round} that the Tell's bin/authz
//     verifies to ACCEPT a submission. It rides in the body, as it already does.
//   - the `run` — a non-secret id that tells QRs/runs apart ("identify the semi-public token"). It is
//     serialized as metadata and as a label, so a human can filter by run; it is not a credential.
//
// Two modes:
//   - "comment"  — POST a comment onto a CANONICAL per-poll issue the Tell opened when it made the
//                  poll answerable. The comment's position in that one thread is a free, verifiable,
//                  contemporaneous ordinal ("which cohort this came in with") — gracefully better than
//                  a random issue id. Comments carry no labels, so the metadata lives in the body block.
//   - "issue"    — POST a fresh issue per response (labels available for human filtering).
//
// The body stays forward-compatible with the Tell's existing parser (bin/collect-submissions reads a
// fenced ```tell``` block: pile/poll/round/type/asker/shown_guidance/answer/ts/tok). We keep `answer`
// the raw statement (a string) and ADD `nonce` (revocation linkage), `run`, and the full `anecdote`.

export const SUBMISSION = "tell.submission/v1";

// Pull the poll/pile context the Tell handed us through the tunnel deliver artifact.
function ctx(deliver, opts = {}) {
  const p = deliver.poll || {};
  const signed = deliver.anecdote || {};
  return {
    pile: p.pile || (deliver.to && deliver.to.id) || null,
    poll: p.poll || null,
    round: p.round != null ? String(p.round) : null,
    asker: p.asker || null,
    question: p.question || null,
    shown_guidance: opts.shownGuidance != null ? opts.shownGuidance : (p.shown_guidance || null),
    tok: deliver.token || null,
    signed,
    raw: (signed.body && signed.body[0] && signed.body[0].text) || "",
    nonce: signed.nonce || null,
    qr: opts.qr || deliver.qr || null,
  };
}

// The fenced ```tell``` block — the metadata + the signed anecdote. NEVER contains the post credential.
export function submissionBlock(deliver, opts = {}) {
  const c = ctx(deliver, opts);
  const block = {
    schema: SUBMISSION,
    pile: c.pile, poll: c.poll, round: c.round,
    type: "anecdote",
    asker: c.asker,
    shown_guidance: c.shown_guidance,
    tok: c.tok,
    answer: c.raw,            // the verbatim statement — what the Tell's parser already reads
    nonce: c.nonce,           // ties this submission to the constituent's revocable consent handle
    run: opts.run || null,    // which run/QR this came through (non-secret; for telling runs apart)
    anecdote: c.signed,       // the full signed anecdote/v1 (the Tell reads this going forward)
  };
  if (c.qr) block.qr = c.qr;  // optional signed QR payload for bin/authz provenance (docs/qr-provenance.md)
  if (opts.at) block.ts = opts.at;
  // Drop nulls so the block reads clean.
  for (const k of Object.keys(block)) if (block[k] == null) delete block[k];
  return block;
}

// Human-readable body: the raw answer, then the fenced machine block under it.
export function submissionBody(deliver, opts = {}) {
  const c = ctx(deliver, opts);
  const block = submissionBlock(deliver, opts);
  return `${c.raw}\n\n\`\`\`tell\n${JSON.stringify(block, null, 2)}\n\`\`\`\n`;
}

// Issue-mode labels (poll-level metadata a human can filter on). Comments cannot carry labels.
export function labelsFor(deliver, opts = {}) {
  const c = ctx(deliver, opts);
  return ["via:anecdote", c.poll && `poll:${c.poll}`, c.round && `round:${c.round}`, opts.run && `run:${opts.run}`].filter(Boolean);
}

// Build the GitHub API request — no network, no credential. opts:
//   repo {owner,name}, mode "comment"|"issue", canonicalIssue (number, comment mode), run, title,
//   shownGuidance, qr, at
export function request(deliver, opts = {}) {
  const { repo, mode } = opts;
  if (!repo || !repo.owner || !repo.name) throw new Error("egress: need repo {owner,name}");
  const body = submissionBody(deliver, opts);
  if (mode === "comment") {
    if (!opts.canonicalIssue) throw new Error("egress: comment mode needs canonicalIssue");
    return { method: "POST", path: `/repos/${repo.owner}/${repo.name}/issues/${opts.canonicalIssue}/comments`, payload: { body } };
  }
  if (mode === "issue") {
    const c = ctx(deliver, opts);
    const title = opts.title || c.question || `[${c.poll || "poll"}] ${(c.signed && c.signed.label) || ""}`.trim();
    return { method: "POST", path: `/repos/${repo.owner}/${repo.name}/issues`, payload: { title, body, labels: labelsFor(deliver, opts) } };
  }
  throw new Error(`egress: unknown mode ${mode}`);
}

// Post it. `api` is injected: async ({method,path,body,token}) => {status, json}. Default uses fetch.
// The credential is passed to the api ONLY; it never enters the returned placement.
export async function post(deliver, opts = {}) {
  const req = request(deliver, opts);
  const api = opts.api || defaultApi;
  const res = await api({ method: req.method, path: req.path, body: req.payload, token: opts.credential });
  if (!res || res.status >= 300) {
    throw new Error(`egress: github responded ${res ? res.status : "?"}${res && res.json && res.json.message ? " — " + res.json.message : ""}`);
  }
  const j = res.json || {};
  const placement = {
    mode: opts.mode,
    repo: `${opts.repo.owner}/${opts.repo.name}`,
    run: opts.run || null,
    url: j.html_url || null,
    id: j.id != null ? j.id : null,
    issue: opts.mode === "comment" ? opts.canonicalIssue : (j.number != null ? j.number : null),
  };
  return { placement, delivery: { state: "pending", placement, at: opts.at || null } };
}

// Interpret a later-fetched issue/comment into an acceptance state, so the page can resolve "was my
// input accepted?" The Tell signals it differently per mode (a real cross-repo convention — see doc):
//   issue  : the Tell labels `ingested` (accepted) or `rejected[:reason]` and closes it.
//   comment: comments can't be labeled, so the Tell reacts (👍 accepted / 👎 rejected) — by convention.
export function interpretStatus(obj, opts = {}) {
  if (!obj) return { state: "pending" };
  if (opts.mode === "comment") {
    const r = obj.reactions || {};
    if (r["-1"] > 0) return { state: "rejected", reason: "reaction" };
    if (r["+1"] > 0) return { state: "accepted" };
    return { state: "pending" };
  }
  const labels = (obj.labels || []).map((l) => (typeof l === "string" ? l : l && l.name)).filter(Boolean);
  const rej = labels.find((l) => l === "rejected" || l.startsWith("rejected:"));
  if (rej) return { state: "rejected", reason: rej.includes(":") ? rej.slice(rej.indexOf(":") + 1) : null };
  if (labels.includes("ingested")) return { state: "accepted" };
  return { state: obj.state === "closed" ? "closed" : "pending" };
}

async function defaultApi({ method, path, body, token }) {
  if (typeof fetch !== "function") throw new Error("egress: no fetch; inject opts.api");
  const res = await fetch("https://api.github.com" + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty/non-json */ }
  return { status: res.status, json };
}
