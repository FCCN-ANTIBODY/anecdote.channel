# The backend seam — a backend-blind core, one vendored adapter, an opaque credential slot

A poll's answer flows to one of **two peer backends**, not a path with a fallback:

- **Public backend (GitHub today)** — batch, durable, "going live," reached only by an empowered
  relay doing an API action. Needs a credential. Vendored: a swappable adapter, and the token is
  its own concern.
- **Presence backend (the mesh)** — private, person-to-person, QR exchange straight back to a data
  pile. Needs no credential; stopping is physical/social, not a revocation.

## The line

- **`composer/submission.mjs`** — the backend-blind core. Parses a Tell QR, builds the neutral,
  signed `tell.submission/v1` block (the byte-frozen contract), and renders the view. It knows
  nothing about issues, comments, POSTs, or tokens. `submission.test.mjs` freezes the block and
  the comment body against a local oracle.
- **`composer/submit-route.mjs`** — the router (`pollAnswerOps`). A chosen answer goes to the
  public adapter when a route is at hand (a credential, or the QR's relay `su=`) *and* the poll has
  a canonical thread; otherwise it is **held** (`{ held: true }`) for the mesh
  (`composer/ballot.mjs`). Held is not failure; a failed public send also holds.
- **`composer/egress-github.mjs`** — the one GitHub-aware file. `deliver(cfg, answer, …)` posts a
  comment on the poll's canonical issue and returns a placement; `commentRequest`/`commentBody`
  build it from the neutral block; `interpretStatus` reads a fetched issue/comment for ingest. No
  new-issue path, no visitor-facing github.com link. Swap the public backend by writing a sibling
  to `deliver`'s shape.

Nothing above the adapter contains the words issue, comment, POST, or token. A respondent never
touches GitHub — most piles are private repos where they couldn't anyway.

## The credential slot

The QR reserves an **opaque, bounded, backend-only** credential slot — `post` / `su` / `canonical`
/ `repo` today. The core parses it and passes it through untouched; only the adapter reads it. It is
**reserved-optional**: filled when a public backend will serve, empty when the exchange is
presence-only. An empty-slot ("no-token") mint is valid and is **not** refused — refusing it would
forbid the offline private poll the mesh exists to make space for. The slot's byte budget (it
strains the QR into multi-block territory) is a design constraint the mint honors.

**The routing-namespace law (#105).** `parseQR` groups all backend-owned fields under one
`cfg.backend = { repo, canonical, cred, submitUrl }`; the top level is anecdote's alone
(pile/poll/round/tok/answer/sig). "Carried, never read" is thus structurally true — the core touches
only the top level, and only `egress-github.mjs` (the adapter) and `submit-route.mjs` (the router)
read `cfg.backend`. The **wire (query string) is unchanged** — this is a parsed-object partition, not
a format change. Ownership is exclusive (whoever declares a field owns it); a top-level `auth` is
reserved for anecdote's own credential someday, unspent. A backend may later collapse its whole
namespace into one opaque blob (`sc` is the first).

## Deferred

- Formalizing the slot into one named field + a reserved-empty big-block QR test.
- The mesh handoff from a held answer (the router returns `{ held }`; the caller mints the ballot).
- A second backend adapter written to `deliver`'s shape — the real proof the line holds.
