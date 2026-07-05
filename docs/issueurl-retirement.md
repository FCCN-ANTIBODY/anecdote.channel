# HANDOFF: delete the issueUrl fallback — GitHub is a backend nobody sees

> Status: **spec for the next worker, not built.** The decision is final (user ruling,
> 2026-07-05): GitHub is an unwanted-but-used BACKEND. It is never a portal a respondent
> visits, never a page they see, never a comment they type. Most piles are private repos
> where a human could not comment anyway. Every submission is an API action by an empowered
> relay (su= today, the sealed credential next), writing metadata-laden comment bodies on the
> authority of a token the pile owner gave the poll. The fallback for a dead or absent
> credential is NOT a GitHub page — it is the SATCHEL: the signed answer waits locally and
> travels the ballot mesh (composer/ballot.mjs, satchel.mjs, docs/ballot-mesh.md) until a
> live door exists. There is no other path.

## Work list (mechanical; redirect tests, never delete coverage)

### anecdote.channel
1. `composer/poll-answer.mjs` — delete `issueUrl()` and every export/use. `answerView`'s
   per-option `issueUrl` fields go. A credentialed submit that cannot proceed (no
   `canonical`, dead transport) returns a clean refusal object with NO URL in it — shape it
   so the app can route it to "hold the answer" (the satchel). `pollAnswerOps.poll.submit`'s
   fallback frame likewise loses `issueUrl` — refusal only.
2. `poll.html` + `composer/poll-answer-demo.html` — the chambers render options as plain
   choices (no links to github.com); a refused submit shows "held — will travel" language,
   never a GitHub URL.
3. `composer/answered.mjs` (+ test) — receipts anchor to `{repo, canonical, poll}` placement
   data, not a human URL.
4. `composer/qr-mint.mjs` (+ test) — refuse a fully credential-free mint (must carry `post`
   or `su`/submit address): every QR carries something DISABLEABLE. Mirror bin/qr (below)
   byte-identically; the parity oracle in qr-mint.test.mjs/poll-answer.test.mjs must stay
   untouched on the tell.submission/v1 block bytes.
5. NOTE: an agent started this scrape; its partial diff is in `git stash` on this branch's
   checkout (files: poll-answer{,-demo,.test}, answered{,.test}, qr-mint{,.test}, poll.html,
   authorize.mjs). Prefer redoing cleanly over trusting the stash; it was never test-run.

### tell.anecdote.channel (branch restarts from main — #52 already merged)
6. `bin/qr` — refuse a credential-free mint (no TELL_POST_TOKEN and no --submit-url =>
   error). The "fallback-only QR" carve-out from #52 is dead. Update test/run.sh [8]-ish
   assertions (tokens for tests can mint with a dummy --post/--submit-url as the suite
   already does elsewhere).
7. Docs sweep — `submission-credential.md` (the "no GitHub account → prefilled link" framing
   is obsolete; the anonymous story is the relay), `answer-runtime.md`, `issue-ingress.md`,
   `sealed-credential.md` (mentions of the issueUrl fallback → the satchel is the fallback).
   State the stop story plainly: lock the canonical issue (transport) + quell / round-bump
   (admission). Keep: ingest stays tolerant of historical issue-shaped submissions.

## Invariants that must not move
- `tell.submission/v1` block bytes and key order (frozen oracle: poll-answer.test.mjs).
- `tl_qr_canon` strip discipline (`sig|kid|post|su` out of the signed preimage).
- Suites fully green: anecdote `node scripts/test.mjs`; tell `./test/run.sh`.
- anecdote PR #102 is open on this branch — add commits there. Tell gets a FRESH PR from a
  main-restarted branch.
