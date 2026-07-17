# Constellation decisions

The load-bearing architectural decisions for the whole constellation, and the **why** — so a new
session (or you after a break) can onboard without re-deriving them from memory. These are the
things that were expensive to arrive at and cheap to forget.

**Read this before designing anything cross-cutting.** When a decision is made or changed, record it
here in the same shape. Never silently contradict an entry — mark the old one *Superseded* and link
forward, so the trail of reasoning survives (the reasoning is the point; the conclusion alone invites
re-litigation).

Scope: decisions that span repos (anecdote.channel + tell / atlas / antidote / data-pile / civic-node
/ journal). Repo-local specifics stay in that repo's own docs; this is the shared map.

## Index

- **D1 — Environment-sourced identity.** Operator key material lives in the environment, never committed.
- **D2 — The glove.** Bottles deliver signed client code over the wire; consumers wear it, never vendor it.
- **D3 — The platform pin.** One canonical Anecdote identity verifies every bottle; env-sourced (D1).
- **D4 — Bottles topology.** `*.tell` = pile floors; `bottles.<apex>` = free-form; wildcard on the sub-sub-domain.
- **D5 — Mirror discipline.** Cross-repo shared code is byte-identical from one source of truth.
- **D6 — Boundary signer public half → environment-sourced.** `keys/boundary.fpr` removed; nothing pins it.
- **O1 (open) — The delivery signer's committed public half.** `tell.fpr`/`pub`/`signers` under the D1 lens.

---

## D1 · Environment-sourced identity
*Status: accepted 2026-07-15*

**Context.** These repos are offline origins that also run on GitHub (Actions, or the offline Actions
emulation — see `docs/actions-enough.md`). They need identity material — private keys, and sometimes
just the public half — to do their jobs.

**Decision.** Operator-specific identity material is **never committed to the repository** — not the
private key, and not its public fingerprint. The repo ships an empty *slot*; the operator's
**environment** fills it: from the on-device offline origin (the authoritative, gesture/2FA
environment), mirrored into a GitHub Secret only when a job runs under Actions. A JS runtime reads it
from `process.env`; a static site (the Floor) has it stamped in at build from the same env var.

**Why.** Two properties fall out, and both are load-bearing:
1. **Forks stay clean.** A committed value is *your* identity; a fork inherits it, must notice and
   replace it, and fights conflicts pulling upstream. An empty slot forks with nothing to unpick.
2. **The repo is single-operator, and the operator is the device.** If identity lives only in the
   environment, the repo itself is inert: a GitHub collaborator who "walks up" gets a repo that
   cannot act, because being the operator is not a repo permission — it is holding the environment.
   This is the on-device-as-two-factor posture made structural.

Even a harmless *public* fingerprint is kept out, so the model's shape (identity-lives-in-env) stays
uniform rather than "secrets by env, public halves by commit."

**Consequence.** See D3 for the platform pin as the first slot converted, and D6 for the boundary
signer's public half. See O1 for the delivery signer's committed public half still under question.

---

## D2 · The glove
*Status: accepted 2026-07 (install grammar)*

**Context.** A storage engine (e.g. `git-enough`) must run inside a consumer (the Floor) without the
consumer vendoring the engine's code, and without the engine gaining the consumer's power.

**Decision.** An engine is a **powerless glove**. It delivers its client code to the consumer at
runtime as a **signed `install` manifest** over the probe; the consumer verifies every blob against
the platform pin (D3), mounts them as Blob URLs, and `import()`s the single named entry — borrowed
for the session, dropped on reload, **never committed or vendored**. The consumer vendors only its
*own* machinery (verify, mount, transport). "Load a blob and run it" stops being a hole because the
bytes are checked against the pin or they do not run.

**Why.** Keeps the engine canonical and updatable without every consumer re-vendoring it; keeps the
trust boundary at the signature, not at a git submodule; keeps the consumer's power its own.

---

## D3 · The platform pin
*Status: accepted 2026-07-15 (supersedes the "Tell key" and "committed constant/file" attempts)*

**Context.** The Floor's storage-adapter seam must verify the client an engine delivers. Which
identity signs, and where does the Floor get the key to check it?

**Decision.** The signer is the **one canonical Anecdote platform identity** — the module-loader root
of trust that signs *every* bottle's install and domain attestation. It is named once in
`composer/platform-key.mjs` (`PLATFORM_KEY`), which `verifyInstall` defaults to; downstreams that
cannot import it (the Floor, another repo) vendor it byte-identically (D5). The **value** is
environment-sourced (D1): the slot is empty in the repo and filled from the device / a Secret.

**Why — and the paths not taken:**
- *Not the Tell's own key.* Tell's office is **collection** (gathering poll answers into antidote;
  `keys/tell.fpr` is its delivery signer, which never signs installs). Signing the pile floors felt
  Tell-ish only because they sit on Tell's subdomain; it never generalized to the free-form bottles
  (D4). Anecdote — the one loading modules — signs them all. One office, not two.
- *Not a committed constant or `keys/*.fpr` file.* That records the device's identity into the repo —
  the fork/single-operator problem of D1. The pin is a slot the environment fills, not a value the
  repo holds.

Trust is *served-from-the-bottle* (the iframed canonical origin resolves — `bottle-attest`'s domain
anchor) **and** *signed-by-Anecdote* (the pin). Null until set → the adapter is inert (safe default).

---

## D4 · Bottles topology
*Status: accepted 2026-07*

**Decision.** The wildcard is on the **sub-sub-domain**. Grammar: `<label>.<storage>.<apex>`, where
`<label>` is the user-invented, isolated origin (the wildcard), `<storage>` is a provisioned
subdomain, `<apex>` is `anecdote.channel`.
- `*.tell.anecdote.channel` — **pile floors** (Tell's subdomain; Tell's office is collection).
- `bottles.anecdote.channel` — **free-form bottles**: arbitrary cubbies (user data, code blocks,
  storage engines like `git-enough`). Not Tell's to vouch for.
- A floor takes its role from the path: `/storage/.<adapter>` → storage consumer; anything else → the
  pile UI. Every wildcard path serves the one Floor template.

**Why.** One provisioned storage domain + an invented isolated label per origin, with no registry
(canonical names). Keeps engines shared/canonical while each `<label>` is its own hermetic origin.

---

## D5 · Mirror discipline
*Status: accepted 2026-07*

**Decision.** When two repos must share code that cannot be imported across the repo boundary (e.g.
the Floor vendoring `composer/*` modules), the copy is **byte-identical** to its single source of
truth, and its provenance is recorded (e.g. `floor/adapter/MIRROR.md`). One definition; the mirror is
re-copied verbatim when the source changes; consumers never re-invent or fork the logic. A deliberate
*subset* (e.g. `probe-client.mjs` = the consumer half of `probe-line`) is the only allowed exception,
and it is documented as such.

**Why.** Avoids two copies drifting into two behaviors — especially dangerous for crypto/verify code.

---

## D6 · Boundary signer public half → environment-sourced
*Status: accepted 2026-07-15 (resolves the boundary half of the former O1)*

**Context.** `keys/boundary.fpr` was a committed public fingerprint (`tell.anecdote.channel`) — the
boundary signer's public half, the same committed-public-half shape D1 questions. The motivation to
fix it: the same Tell code runs on many offline clients, and each must sign boundaries with *its own*
env key; a committed fingerprint bakes one operator's identity into shared code.

**Decision.** The boundary fingerprint is environment-sourced (D1), never committed. `keys/boundary.fpr`
is removed and gitignored; `bin/boundaries compile`/`bootstrap` no longer write or commit it.

**Why it was safe (the deciding investigation).** Nothing *external* pins `boundary.fpr` — an Atlas
ingests boundary artifacts verbatim and trusts each artifact's own signature, enforcing same-key
continuity itself (`atlas bin/dump.mjs`). So the fingerprint was only the operator's own
self-consistency check. `bin/boundaries check` now catches a signer swap by **internal consistency**
(every compiled artifact shares one signer — needs no key, so it still runs in a fork's CI) and, when
the environment names the identity (`TELL_BOUNDARY_FPR`, or derivable from `TELL_BOUNDARY_KEY`),
additionally confirms it is the operator's key. Strictly ≥ the old committed-file check for the
realistic (partial-swap) threat, with nothing committed.

**Contrast for O1.** This worked *because* boundary.fpr had no external pinner. The delivery signer is
different — see O1.

---

## O1 · (open) The delivery signer's committed public half
*Status: open — narrowed 2026-07-15 (the boundary half is resolved by D6)*

D1 says operator identity material lives in the environment; D6 moved the boundary signer's public half
there. The **delivery signer** (`keys/tell.fpr` / `tell.pub` / `tell.signers`) is the remaining committed
public half — but it is *not* the same case: a **data-pile pins it** (copies `tell.signers`/`tell.fpr`
into its own `pile.yml`), so the committed file is a genuine **publication channel** for external
verifiers, not just the operator's self-consistency. Moving it to the environment means giving piles
another way to *discover* the Tell's key (a deployed artifact / published endpoint) instead of reading
it from the repo. Open question: build that publication channel and env-source the delivery signer, or
accept its committed public half as a deliberate exception (it is per-node, so a fork re-keys it anyway).
Decide before adding any *new* committed key material.
