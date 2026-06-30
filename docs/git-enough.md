# git-enough — the offline origin's steady beat, and the data it tends

> Status: **shaping note** under [Milestone: Origin](origin.md). Not built. Continues the "enough-client"
> family (git-enough, jekyll-enough, and the **seal-enough** factory this note surfaces).

## git is shorthand for capabilities, not a goal

We do very little by way of ops. **git's probe API is the workhorse**, but it doesn't need to *look* like
git to us — we're not hiding it, but git isn't being *enshrined* so much as used as **shorthand for
capabilities**, the way our JS is the batteries-included actions and the **auto-staging schedule** is the
offline origin's version of "the repo's workflows choosing their cron." git-enough exposes *version /
stage / commit / read*, nothing more.

## The beat: stage, commit — or no-op (incognito)

The default rhythm: the cache's **ephemeral blob shelf** (the v0 `medium.js` IndexedDB store) **tees to
git's event intake** — staging what's wanted, **no-opping for incognito** (a no-cache session keeps
nothing except what is staged *on purpose*). The "workflows" of the offline origin are these **scheduled
staging/commit beats** — cron, chosen by the origin, the local analogue of GitHub Actions.

This is the first **accessibility guarantee** the platform makes plainly:

> **Your environment is being recorded — or not.** Recording-consent is a first-class toggle, not a
> buried setting: the steady beat (commit history) vs. incognito (no-op) is the user's switch.

## The op set (a `git-enough` subsystem-surface study)

The minimal surface for a **local** origin (no transport): an **object store** (hash-object/blob,
write-tree, commit-tree, cat-object), **refs** (update-ref/read-ref), an **index** (stage), and
**checkout**. **No** remotes, pack negotiation, fetch/push, merge, or rebase — flatly rejected, because
our origin has no upstream (see Origin's "no self-roll without consent"). git object ids are SHA-1 and
content SHA-256 — both `crypto.subtle.digest`. The whole client lives in **admin-space (Elevated)** and is
**called by the chamber over the probe line** (it needs `subtle` + the storage, which the chamber lacks).
*(Run the subsystem-surface study to confirm the exact op list before building — same idiom as the Jekyll
study.)*

## The probe surface: tools are utility services, and they use each other

git and the **label-reducer (LM)** are **utility services**; other tools (a journal UI, a poll frontend)
are **end-user**. They **compose**: the LM indexes git history; a journal tool calls git to commit; the
poll frontend (a module) is offered to peers over the probe API. The probe line exposes **capabilities**,
not apps — which is the second accessibility guarantee:

> **Your text/image can be labeled like pulling out a pair of reading glasses** — the LM as an assistive
> labeler, summoned on demand, on-device, watcher-proof.

## MiniLM as historian

The label-reducer — the ecosystem's **preeminent labeler** — can **slowly index history**: it labels
**disembodied text strings** (shorter is better, hence the eager span-crunch as you type) and, because it
*is* the canonical labeler, should also take a shot at **longform**, using **explicit + context clues the
user supplies**. It is **not a tl;dr bot** — it is a labeler. Its output is a **proto-report** about the
**directional spotlights the user passively anchors** (keywords, labels) over their own history.

## The history pile

Store the proxy browser's history as a **literal data-pile**. The pile's **"question"** — normally a
poll's per-poll constitution — generalizes to an **ingress filter checked at rollup**: *what is allowed
into this pile*. A pile can carry **multiple questions** at once. A **history pile's** question is about
as permissive as **"a JSON event stream"** — one homogeneous *type*, diverse *fields*; it admits whatever,
and you could **restore an entire session** from it. These piles are **fabricated inside data:chamber
sessions** and **exported on the wire to live in Elevated anecdote storage** — i.e. the trove becomes a
set of owned, sealed piles, including your own history.

## The crux: the encryption factory (a `seal-enough` client)

The one real red flag: **writing data-piles ourselves needs the seal step**, which today is a **Tell
GitHub-submodule behavior** (the `deliver` pipeline in CI). Concretely, from the pile crypto core
(`data-pile/bin/lib.sh`, vendored as `tell/bin/pile-lib.sh`):

| step | primitive | in the browser |
|---|---|---|
| forward ratchet | `K_{n+1} = sha256("ratchet:" ‖ K_n)` | `subtle.digest('SHA-256')` ✓ |
| key commitment | `ratchet_pub = sha256("pub:" ‖ K_n)` | `subtle.digest` ✓ |
| block IV | `iv = sha256("iv:" ‖ K_n)[:16]` | `subtle.digest` ✓ |
| block encryption | **AES-256-CTR** under `K_n` | `subtle` AES-CTR ✓ |
| entries digest | `sha256(canonical-JSON(entries))` | `subtle.digest` + JS ✓ |
| signed head | **ed25519** over the digest | `subtle` Ed25519 ✓ |
| seed wrap | **age** (X25519 + ChaCha20-Poly1305) to the owner | **the only gap** ✗ |

So the "factory" is **almost entirely WebCrypto-native** — the *only* non-native piece is the **age
seed-wrap**: `subtle` has X25519 (`deriveBits`) but **not** ChaCha20-Poly1305, so age interop needs a
**small vendored AEAD** (or an age-js).

**The reframe that defuses the flag — it isn't monolithic:**

- **Seal-at-rest in your own Elevated storage can be WebCrypto-native end to end.** Wrap `K_0` to *your
  own* key (ECDH→AES-KW, or RSA-OAEP) instead of age. A **pure-local history pile needs only this** — no
  age, no vendored AEAD.
- **age is only needed at the handoff boundary** — when exporting a **Tell-ecosystem-compatible** pile
  whose existing verifiers (`bin/verify`, `bin/prove`, the Tell ratchet-resume) expect an age-wrapped
  seed. That's the one place to vendor age (or run the wrap in an Elevated tool).

Either way it's another **enough-client: `seal-enough`** — mostly WebCrypto, speaking `age` only when it
must interoperate. **Decided: hybrid (C)** — native-local at rest, `age` synthesized only on export.

### The export attestation — "possession-since"

Because the artifact lived **native-local first** and is only `age`-keyed at export, the export is the
moment to also emit a signed **provenance attestation about the pre-seal life**:

> `held-since: <ISO-8601>` — *"I've had this since T0,"* asserted (and **ed25519-signed**) at export time
> T1, riding in the export envelope **beside** the age-wrapped seed, **distinct from** the seal itself.

It states the **pre-seal possession window** the seal would otherwise erase (age-keying has no memory of
how long you held the plaintext). Properties, kept honest:

- **It is a claim + `basis[]`, graded not gated** — the merged label-authority stance. A bare self-claim
  is **antedating-spoofable** (you can name any past T0), so it is believed only as far as its basis.
- **What crypto can and can't prove.** A commitment witnessed at `T_anchor` proves the content existed
  **no *later* than** `T_anchor`; proving **no *earlier* than / since T0** against antedating needs an
  anchor *at* T0. So "possession-since" is strengthened by **contemporaneous anchors**, never by assertion
  alone.
- **Basis candidates** (each an independent upper-bound pin, converging toward un-antedatability): the
  `git-enough` hash-chain (proves order + integrity, not absolute time); a prior **Atlas-routed receipt**
  or counter-signature dated at/after T0; the data-pile manifest's own `window_end`; a GitHub-timestamped
  Tell delivery. This is the **private, self-asserted cousin of the "first to say it" credit** — and the
  same Atlas-routed anchors are what make either one hard to game.
- **Why it's wanted:** it lets a long-held artifact carry its **lineage** into the ecosystem the moment it
  surfaces — *"I didn't mint this at export time; I've sat on it since T0"* — which is **stiction** (weight
  for an anonymous claim) and dovetails with the ownership thesis: you owned it first, and here is the
  since-when.

## Open questions

- **A) Seal-enough scope — DECIDED: hybrid (C).** History piles seal **WebCrypto-native at rest**; `age`
  is synthesized **only on export** to the Tell ecosystem, carrying the **possession-since** attestation
  (above). Open sub-thread: the exact basis set that makes "held-since T0" credible enough to act on.
- **B) Two factories, kept in lockstep.** If the seal exists both in CI (Tell submodule) and in the
  browser, they must stay **byte-compatible** — the same drift-guard discipline as `bin/check-pile-lib`.
- **C) The staging beat.** What schedules the commit cron (a worker? the privileged-budget question from
  Origin), and the exact incognito no-op semantics.
- **D) LM history-indexing cadence.** Slow background labeling is a worker-like privileged behavior — ties
  to Origin's open "privileged budget."
- **E) git-enough op list.** Confirm via the subsystem-surface study before building (object store + refs +
  index + checkout; no transport).
