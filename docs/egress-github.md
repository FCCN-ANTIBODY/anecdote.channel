# Out the door — Tell → GitHub issue/comment egress

> Status: **first real cut.** Implemented and tested
> ([`composer/egress-github.mjs`](../composer/egress-github.mjs),
> [`composer/egress-github.test.mjs`](../composer/egress-github.mjs)); wired into the tunnel
> ([`composer/tunnel.mjs`](../composer/tunnel.mjs)). **No credentials are created here** — the post
> token is injected; minting it is the Tell-side seam (below). This closes the loop the tunnel opened:
> a confirmed answer actually reaches a Tell's mailbox.

## The picture

A Tell makes a poll answerable. A respondent's anecdote, built and signed in the iframe, **goes out
the door** as a GitHub **issue or comment** on the Tell's repo — the ingress the Tell already expects
(`tell.anecdote.channel/CONTRACT.md` → *"Ingress: QR → authorized Issue → digest"*). anecdote.channel
(the runtime, in the iframe) does the POST using a token the Tell handed it, records **where it
landed** against the nonce, and becomes the **detail view of its own async status**.

## Three tokens, never confused

The single most important thing to keep straight:

| token | what it is | where it goes |
|---|---|---|
| **post credential** | a semi-public, GitHub-acceptable **write token** the Tell mints into the QR, so a respondent needs **no GitHub account of their own** | **Authorization header only** — never the body, the placement, or the trove |
| **`tok`** | the existing **HMAC capability** bound to `{pile,poll,round}` that `bin/authz` verifies to **accept** a submission | in the fenced body block (as today) |
| **`run`** | a **non-secret id** that tells QRs/runs apart ("identify the semi-public token") | serialized as metadata + an issue label, so a human can filter by run |

The post credential being **semi-public** is intentional and well-motivated: it removes the
GitHub-login barrier for respondents (CONSTITUTION: *"orchestrated on smartphones … even The
Homeless"*). Its blast radius is **"anyone with the QR can comment on this one repo"** — which is what
a poll inbox *is*. Mitigations: the `tok` is still required for a submission to be **accepted** (a bare
comment without a valid `tok` is swept as `rejected`); the credential should be **repo-scoped,
issues-only, short-lived** (a GitHub App installation token, or a fine-grained PAT, rotated per round);
and a canonical-issue thread keeps everything in one moderatable place. **The credential is never
serialized** — the code asserts this and the tests prove it.

## Canonical issue as a thread (the graceful default) vs. issue-per-response

Two modes (`request`/`post` take `mode`):

- **`comment`** — the Tell opens **one canonical issue per poll** when it makes the poll answerable;
  every response is a **comment** on it. The comment's **position in that single thread** is a free,
  verifiable, **contemporaneous ordinal** — *which cohort a response came in with* — gracefully better
  than a random, ever-increasing issue id. (GitHub comment ids are global; the per-poll ordinal is the
  comment's place in the thread, which the Tell derives at sweep time — no client-side counting.)
  Comments **cannot carry labels**, so all metadata lives in the body block.
- **`issue`** — a fresh issue per response, which **can** carry labels (`via:anecdote`, `poll:…`,
  `round:…`, `run:…`) for human filtering.

## The serialized body (Tell-parser-compatible)

The body is the **raw answer** followed by a fenced ` ```tell ` block — the exact shape
`bin/collect-submissions` already extracts (`pile/poll/round/type/asker/shown_guidance/answer/ts/tok`),
**plus** three additions it currently ignores and will read going forward:

```jsonc
{
  "schema": "tell.submission/v1",
  "pile": "cd04-q1", "poll": "budget", "round": "1",
  "type": "anecdote", "asker": "…", "shown_guidance": "…",
  "tok": "<HMAC capability — bin/authz>",
  "answer": "<the verbatim statement (string, as the Tell already reads)>",
  "nonce": "nonce:…",          // ties the submission to the constituent's revocable consent handle
  "run":   "run-7",            // which run/QR it came through
  "anecdote": { …signed anecdote/v1… }   // the full signed artifact
}
```

Carrying the **`nonce`** here is what finally closes the consent loop across repos: the Tell records it,
so a later **signed revocation** (`composer/consent.mjs`) can be honored against the exact submission.

## The async status / detail view

The CONSTITUTION promises *you will know if your input was not accepted*. So:

1. On a confirmed `intake`, if the host supplied an `egress` config (incl. the credential), the guest
   **posts** and writes a **`delivery`** onto the receipt in **its own trove**: `{ state: "pending",
   placement: { url, id, issue, run } }`. A failed POST is recorded as `{ state: "error" }` — **never
   silent**.
2. The sending page **becomes the detail view** of that delivery. You can **close the tab** and it is
   fine: your **nonce now lives in the trove, stapled to the request**, on the anecdote.channel origin.
3. Reopening, the page re-queries by nonce — `tunnel.status({ nonce })` relays through postMessage and
   returns the stored `delivery`. Later, `interpretStatus()` resolves acceptance from a fetched
   issue/comment: an issue **labeled `ingested`** is accepted, `rejected[:reason]` is refused; a comment
   is signalled by a **reaction** (👍/👎) since it can't be labeled.

## The Tell-side seam (cross-repo, not built here)

This egress assumes three things the Tell repo must provide — the follow-up on
`tell.anecdote.channel`:

- **Mint the QR's post credential** (repo-scoped, issues-only, short-lived/rotating) alongside the
  existing `tok` and a `run` id — and embed all three in the QR / landing config. (`bin/qr` today emits
  the landing URL with `tok`; it grows to also carry the post credential + run.)
- **Sweep comments**, not just issues, for `comment` mode — `bin/collect-submissions` reads open issues'
  bodies today; the canonical-issue-as-thread model needs it to also read that issue's **comments**, and
  to read the new `nonce`/`run`/`anecdote` fields.
- **Signal acceptance on comments** via a reaction (the issue path already labels/closes).

## Open questions (recorded)

- **Credential custody & rotation.** App-installation token vs. fine-grained PAT; rotation cadence;
  what a leaked round-credential actually lets an attacker do (spam one repo's comments) and the
  rate/abuse posture around it.
- **Acceptance polling.** Who re-fetches the placement to flip `pending → accepted/rejected`, and when —
  a visible-tab poll, a user-pull "check now," or a relay the host triggers. `interpretStatus` is ready;
  the trigger is not chosen.
- **Comment ordinal as cohort metadata.** Exactly how the Tell derives and publishes the per-poll
  ordinal as "the group something came in with," and how contemporaneity is verified.
- **OAuth alternative.** If a Tell would rather respondents post under **their own** GitHub identity
  (no shared credential, accountability = the Issue author), the egress shape is the same — only the
  credential's provenance changes. Recorded as the other branch.
