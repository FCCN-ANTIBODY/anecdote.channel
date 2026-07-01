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

## Two repo-init entry points, and the swap (The Castle · The King's Leap)

A repo becomes *ours* two ways, and they need holding in mind together:

**1. Greenfield — we init.** The privileged installable ops ship a **scaffold factory** that `init`s what
the origin needs into your workspace, and then commits begin. They come from several hands, all legitimate:
the **system / scaffold** (structural commits), **you** (deliberate saves), and **side-effects** (a
browser op leaving cache files as you work). Phase 1 takes author/committer as *parameters*, so "who
committed" is just a different ident on the same beat — no separate machinery to tell the hands apart.

**2. Import — we adopt an existing GitHub origin.** *"Take this github origin to my offline, reconfigure it
to listen to me now."* The **swap**: a repo that was an upstream stops being one and becomes a **downstream
client** of your new offline origin (which then publishes to it — see the section above). By default we
offer the swap as a choice of two configurations:

- **The Castle** — *bring the whole castle* (**✅ built**). Load the remote's objects into ours with
  **pure git mechanics**, preserving **full history and lineage** — a **one-time bootstrap fetch**, not a
  standing upstream (after the swap the relationship inverts and we push). Implemented as
  [`git-enough/unpack.mjs`](../git-enough/unpack.mjs) (read a v2 pack, resolve OFS/REF **deltas**, verify
  every oid) + [`git-enough/fetch-pack.mjs`](../git-enough/fetch-pack.mjs) (`git-upload-pack` discover →
  `want`/`done` → strip the NAK → unpack → `clone` into a fresh `repo()`). Verified against a real
  `git upload-pack`: a deltified pack fetched, deltas resolved, all objects + refs imported, and a real
  `git` reads the **full lineage** back from our clone. It carries the old repo's **foreign authorship**
  across (that's the point — full lineage). The one-time non-native worry — **byte-accurate inflate** (a
  pack concatenates zlib members with no length prefix) — is **closed natively**:
  [`git-enough/inflate.mjs`](../git-enough/inflate.mjs) turns `DecompressionStream`'s strictness into a
  feature (too-short rejects, exact resolves, too-long throws "trailing junk" — a monotonic signal) and
  **gallops + binary-searches the member boundary** in O(log n) attempts. No vendored zlib; identical in
  the browser and Node. It is the default seam, and a faster inflate can still be injected via `{ inflate }`.
- **The King's Leap** — *the king leaves the castle and leaps to new ground.* **Photocopy the current
  tree** (GitHub's tarball/contents API — plain files, no git protocol) and **stage it ourselves as a fresh
  root commit** under **your** identity. A deliberate **hard break in ownership history** — and that's a
  feature, not a wound: (a) the old repo's fate is **negligible to us** (they may well delete it), (b) all
  we actually need is to **land in data-pile / data:chamber territory** with the content in hand, and (c)
  the break *is* the sovereignty statement — *"this is mine now, since T0,"* exactly where the seal-enough
  **`held-since`** attestation belongs. Cost: **phase 1 alone** (download → stage → root-commit).

*(Considered and set aside: **wholesale-regenerate** their history — rewrite the commits ourselves. It is
the worst of both — the cost of preserving lineage with none of its authenticity. The Castle preserves
honestly; the King's Leap breaks honestly; regeneration only launders.)*

**Default: the King's Leap.** It stands on phase 1 with no fetch machinery, and its clean break is the
ownership thesis made literal (you become the origin, dated). The Castle is the opt-in for anyone who wants
the full lineage carried across. Both entry points stand on the **same floor** — *stage a tree, commit onto
a ref* — which is exactly what phase 1 is: greenfield is that on repeat (the beat), the King's Leap is that
once with `parents: []` and your ident, the Castle adds an object-import step before the beat resumes.

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
- **Phase 1 — refs + index + a working commit (✅ built).** `update-ref`/`read-ref`, stage a set of files
  into a (nested) tree, `commit-tree` onto a parent, advance a branch — [`git-enough/repo.mjs`](../git-enough/repo.mjs).
  `commitFiles(files, {author, root?})` is the one call behind both entry points: the greenfield **beat**
  (repeat, multi-author) and the **King's Leap** import (once, `root: true`, your ident). Verified by
  [`git-enough/repo.test.mjs`](../git-enough/repo.test.mjs): our history materializes into a real repo and
  `git fsck --strict`/`git log`/`git cat-file` read it back — a two-commit multi-author beat with a nested
  dir, and a King's-Leap **root** commit (no parent, authored by you) that git confirms.
- **Phase 2 — packfiles (✅ built).** Serialize a set of objects into a v2 **packfile** — the format git
  transfers over the wire, needed for push (and compact storage). [`git-enough/pack.mjs`](../git-enough/pack.mjs)
  emits base objects (no delta yet — a valid, if larger, pack; deltas are a later size optimization). All
  native: object bodies zlib via `CompressionStream`, the trailer SHA-1 via `subtle`. Verified by
  [`git-enough/pack.test.mjs`](../git-enough/pack.test.mjs): `git index-pack --stdin` accepts our pack and
  its reported pack sha **equals our trailer checksum**; `git verify-pack` lists our oids; `git
  unpack-objects` + `cat-file` restore the content. *(Later degrees: OFS/REF delta compression, thin
  packs.)*
- **Phase 3 — send-pack to a downstream (the headline; ✅ protocol built + offline-verified).** The git
  **smart-HTTP** `git-receive-pack` flow — [`git-enough/send-pack.mjs`](../git-enough/send-pack.mjs):
  `discover` (GET `…/info/refs?service=git-receive-pack`), `sendPack`/`publish` (POST `…/git-receive-pack`
  with pkt-line ref-update commands + the phase-2 packfile), and report-status parsing, authenticated by
  the **homebrew fine-grained PAT** as HTTP Basic (Contents R/W; + Workflows R/W only if the pack touches
  `.github/workflows/**`). The transport `fetch` is injectable, so
  [`git-enough/send-pack.test.mjs`](../git-enough/send-pack.test.mjs) runs the **whole path against a real
  `git receive-pack --stateless-rpc`** (the exact program GitHub's backend runs): **create** an empty repo's
  ref, **fast-forward** it, and the **King's Leap** non-fast-forward **replace** — the downstream ends
  carrying the single fresh root, the old lineage gone. Only the literal network socket to github.com is
  left for a live push. The operator fires it with [`git-enough/publish-cli.mjs`](../git-enough/publish-cli.mjs)
  — `OFFLINE_ORIGIN_PAT=… node git-enough/publish-cli.mjs <repo-url> [--root] [--file p=c] [--dry-run]`
  (token from the environment, never a flag; `--root` = the King's Leap replace). Later degrees:
  force-with-lease, thin/negotiated packs (only send what the downstream lacks), multi-downstream fan-out.
- **Read-side — the Castle (✅ built, complements the push track).** `git-upload-pack` fetch + pack
  reading with delta resolution + `clone` into a fresh origin — see **The Castle** above. This is the
  inbound "kidnap full history" path; the King's Leap remains the content-only default. Inspection:
  [`git-enough/read.mjs`](../git-enough/read.mjs) parses commits/trees and walks history, and
  [`git-enough/verify-cli.mjs`](../git-enough/verify-cli.mjs) clones a downstream back and prints its
  ref/commit/file-tree — an eyes-on verification that also exercises the Castle against real GitHub.
- **On the probe line — git as governed capabilities (✅ built).**
  [`git-enough/probe-ops.mjs`](../git-enough/probe-ops.mjs) vends git-enough as probe-line ops so a chamber
  can drive the origin under the consent ladder: `git.log`/`git.files` (Rung 0, read-only),
  `git.commit`/`git.push`/`git.clone` (Rung 1, each `yield→check-cancel` before it persists). The **staging
  beat** is the Rung-2 standing behavior — a grant over `git.commit` the scheduler runs on your behalf
  (its cadence is Origin's open "privileged budget"). This is where git-enough joins the constellation: the
  same gate + standing grants + grants panel that govern the composer now govern the origin's git. Byte-accurate
  inflate is now browser-native ([`git-enough/inflate.mjs`](../git-enough/inflate.mjs)), so the whole
  read-side runs in the Elevated app, not just Node. Later degrees: incremental fetch with `have`s (only
  what we lack); shallow clone; a faster inflate if pack sizes demand it.

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
