# git-enough — the offline origin's steady beat, and the data it tends

> Status: **shaping note + phase 0 built** under [Milestone: Origin](origin.md). Continues the
> "enough-client" family (git-enough, jekyll-enough, and the **seal-enough** factory this note surfaces).
> Phase 0 (the git object layer) is implemented in [`git-enough/objects.mjs`](../git-enough/objects.mjs),
> cross-verified byte-for-byte against a real `git` — see **The phased plan** below.

## git is shorthand for capabilities, not a goal

We do very little by way of ops. **git's probe API is the workhorse**, but it doesn't need to *look* like
git to us — we're not hiding it, but git isn't being *enshrined* so much as used as **shorthand for
capabilities**, the way our JS is the batteries-included actions and the **auto-staging schedule** is the
offline origin's version of "the repo's workflows choosing their cron." git-enough exposes *version /
stage / commit / read*, nothing more.

## The offline origin PUBLISHES: it pushes downstream, it never pulls upstream

The headline for this build is direct: **simulate enough of an origin repo that a public GitHub repo can
be a *client* of it.** The whole difficulty is **addressing**, and it resolves in one insight:

- Our offline pocket universe is **not addressable in any way git understands** — no URL, no DNS, it isn't
  a listening server. So a GitHub repo can never `pull` *from* us; it has no way to name us.
- The **catastrophic** shape to avoid is inverting that into supplication: distributing updates by
  **opening PRs on our downstream mirrors** — the origin begging its own clients to accept it, per repo,
  by hand. That is not an origin; it is a fugitive.
- The clarifying inversion: **the origin is the one that pushes.** GitHub repos *are* addressable, so the
  origin (whenever the device has a moment of connectivity — "airgapped, not down") **addresses them and
  pushes** its already-built, signed history outward. Downstreams are mirrors that fast-forward to what the
  origin published; they never try to name the thing that can't be named.

This does **not** contradict Origin's "no self-roll without consent" / "no upstream." Those are about
*above* us — we hold a snapshot, nothing pulls into us, first-contact signer-pinning is the only way in.
Push is about *below* us. The direction of trust and the direction of bytes both point **outward, from the
origin to its clients** — which is exactly what "being the origin" means.

## The beat: stage, commit — or no-op (incognito)

The default rhythm: the cache's **ephemeral blob shelf** (the v0 `medium.js` IndexedDB store) **tees to
git's event intake** — staging what's wanted, **no-opping for incognito** (a no-cache session keeps
nothing except what is staged *on purpose*). The "workflows" of the offline origin are these **scheduled
staging/commit beats** — cron, chosen by the origin, the local analogue of GitHub Actions.

This is the first **accessibility guarantee** the platform makes plainly:

> **Your environment is being recorded — or not.** Recording-consent is a first-class toggle, not a
> buried setting: the steady beat (commit history) vs. incognito (no-op) is the user's switch.

## The op set (a `git-enough` subsystem-surface study)

The core surface for a **local** origin: an **object store** (hash-object/blob, write-tree, commit-tree,
cat-object), **refs** (update-ref/read-ref), an **index** (stage), and **checkout**. **No fetch, no pull,
no merge, no rebase** — flatly rejected, because our origin has **no upstream** (Origin's "no self-roll
without consent"). The one transport we *do* build is **send-pack to a downstream** (§ above) — pack
generation + smart-HTTP push, and nothing else. git object ids are SHA-1 (`crypto.subtle.digest('SHA-1')`,
native); loose objects are zlib via `CompressionStream('deflate')` (native — git's exact format). The whole
client lives in **admin-space (Elevated)** and is **called by the chamber over the probe line** (it needs
`subtle` + the storage, which the chamber lacks).

## The phased plan (degrees of "git-enough")

Core behaviors that can be added in degrees — each phase is independently useful and independently
verifiable against a real `git`, so future agents can pick up at any boundary:

- **Phase 0 — objects (✅ built).** Content-addressed blob / tree / commit with **byte-identical git object
  ids**, plus the on-disk loose (zlib) encoding and read-back. All native (`subtle` SHA-1 +
  `CompressionStream`). [`git-enough/objects.mjs`](../git-enough/objects.mjs), cross-checked against
  `git 2.43` by [`git-enough/objects.test.mjs`](../git-enough/objects.test.mjs): our blob/tree/commit ids
  equal `git hash-object`, git `cat-file`-reads our zlib loose objects, the empty blob is git's canonical
  id. *This is the "compatible underneath" foundation — a real git already reads what we write.*
- **Phase 1 — refs + index + a working commit.** `update-ref`/`read-ref`, stage a set of files into a
  tree, `commit-tree` onto a parent, advance a branch. Now the origin builds **real local history**
  (the steady beat). Verify: `git log`/`git fsck` on the objects we wrote.
- **Phase 2 — packfiles.** Serialize a set of objects into a v2 **packfile** (+ index) — needed both for
  compact storage and, critically, for push. Verify: `git index-pack` / `git verify-pack` accept ours.
- **Phase 3 — send-pack to a downstream (the headline).** The git **smart-HTTP** `git-receive-pack`
  flow against a GitHub repo: `GET …/info/refs?service=git-receive-pack`, then `POST …/git-receive-pack`
  with the ref-update command(s) + the phase-2 packfile, authenticated by the **homebrew fine-grained PAT**
  (the egress credential we already chose). The downstream **fast-forwards to what the origin published** —
  the inversion realized, no PRs. Later degrees: force-with-lease semantics, thin packs, multi-downstream
  fan-out.

Each phase is a probe-line **capability** (Rung 1 `commit`/`stage`, Rung 2 the staging beat, and push as a
consequential Rung-1 op gated like any egress). *(Run the subsystem-surface study to confirm each phase's
exact op list before building — same idiom as the Jekyll study.)*

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
