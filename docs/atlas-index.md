# The Atlas index — shaping (the thin fetch layer)

> Status: **shaping note + built** (#90, #91, #94, #95). Named the missing middle tier between
> [`git-enough.md`](git-enough.md)'s two originally-built fetch modes — full clone (**the Castle**) and
> nothing — so a **mixed feed of polls from every Atlas you've attached to (and their friends)** can be
> shown in the UI without paying full-clone weight per Atlas. The fetch/extract/merge machinery below is
> now real; what's still open is the refresh-policy loop and the per-row foundational/on-demand wiring
> (see Open questions). Extends the `atlas.snapshot` registry kind added for
> [issue #87 / PR #88](https://github.com/FCCN-ANTIBODY/anecdote.channel/pull/88) from "one kept snapshot"
> to "many, merged." Cross-refs [`system-viewer.md`](system-viewer.md) (the registry this feeds) and
> [`dark-mode.md`](dark-mode.md) ("Atlas, offline" — the friend-Atlas one-hop model).

## The job

Attaching to an Atlas should make **your universe bigger**, not your disk fuller. Every Atlas you keep a
copy of also brings its **friend Atlases'** listings (`dark-mode.md`'s one-hop model) — polls, anecdotes,
businesses, all of it — and the point of the landing index (#87) is to **shuffle all of that into one mixed
feed**, each row signed off and labeled with the Atlas it came from. That only scales if a "kept Atlas" is
mostly a **pointer**, not a payload: the full body of a poll or anecdote is fetched **when opened**, not
when the Atlas is merely seen.

`git-enough.md` already named this gap and deferred it — its "later degrees" line reads *"incremental fetch
with `have`s (only what we lack); shallow clone."* This note is that gap, specific to Atlases.

## Four degrees, all now built

Git's own wire protocol has three tiers of "how much do I actually pull," plus a fourth, targeted degree.
All four exist in `git-enough/fetch-pack.mjs` now (#94, #95) — corrected from this note's original draft,
which mis-tracked tier 1 as missing and hadn't built tiers 2 or 4 yet.

1. **Ref advertisement — thinnest.** Just `name → oid`. `discoverFetch()` speaks `service=git-upload-pack`
   — this predates the whole Atlas-index effort, built as part of the Castle. Tells you an Atlas's tip
   **moved** — new content exists — without holding one byte of it. This is the re-poll degree (see
   Refresh, below).
2. **Shallow / tip-only fetch.** `fetchTree()` recursively lists every tree under a root — no blobs, one
   round trip per depth level — feeding straight into the existing `walkTree`/`filesAt`
   (`git-enough/read.mjs`), which already tolerate absent blobs. This is the **aggregate-index** degree —
   enough to render a mixed-feed row, too little to be "the data."
3. **Full clone — the Castle.** [`git-enough/read.mjs`](../git-enough/read.mjs) + the Castle's `clone`
   "kidnap full history" path. Correct for *your own* piles (you want their whole lineage); the wrong tool
   for a friend-of-a-friend's Atlas you're just indexing.
4. **Targeted single-object fetch.** `fetchObject`/`fetchObjects` pull already-known oids directly;
   `fetchFileAt` walks a path down to its blob one tree level at a time; `fetchFilesUnder` batch-fetches
   everything under a path prefix. Open one item's actual body once a user drills in, by its already-known
   oid from tier 2 — without a full clone. Paired with [`viewer/materialize.mjs`](../viewer/materialize.mjs)
   (#91) for where the fetched bytes are kept.

**One real, documented cost, not papered over:** wanting a blob or tree oid is genuinely minimal (neither
carries a parent pointer); wanting a *commit* oid without `have` negotiation pulls its full ancestor
history. That's still the one open "later degree" (`docs/git-enough.md`'s "incremental fetch with `have`s")
— see Open questions.

## The aggregate index (the merge) — built

[`viewer/atlas-index.mjs`](../viewer/atlas-index.mjs)'s `mergeAtlasIndex(registry)` builds one local table
from every `atlas.snapshot` registry entry, **deduped by content hash** — literally: each listed item is
its own `listing/<slug>.json` file inside a snapshot's repo, a real git blob, so two Atlases fronting
byte-identical content for the same item land on the same oid by construction, not by a hand-rolled hash.
Per row:

| field | meaning |
|---|---|
| `oid` | the content-addressed id of the listed item (poll/anecdote/business) — the dedup key |
| `title`, `kind` | enough to render the row without fetching the body |
| `sources` | **plural**, refined from the original singular sketch: every Atlas URL a deduped row was seen
  through, not just the first — corroboration (two Atlases agreeing on the same item) is information worth
  keeping, not noise to discard at the first match |
| `signer` | the snapshot's commit author at the tip it was read from — what "signed off" in the UI
  currently checks (real signing over a snapshot is still future work, per `qr-provenance.md`'s SSHSIG path) |
| `tip` | the snapshot commit this row was read at |

**Not yet in a row:** `lastSeenTip` — the tier-1 oid last observed for an Atlas, for the re-poll/refresh
check below. That's a property of the *refresh policy* (comparing a fresh ref advertisement against what
was last merged), not of a single merge pass, and is still open.

This is deliberately **not** a new registry type parallel to `repoRegistry()` — it's a fold *over* several
`atlas.snapshot` entries, the way `repoListView()` already folds over the whole registry for one Atlas's
worth of rows. Vended over the probe line as `viewer.atlasFeed` (Rung 0), same as everything else the
system-viewer reads.

## Refresh, not re-clone ("RAM" behavior)

Checking whether an attached Atlas has anything new is tier 1 (cheap, no packfile): compare its advertised
tip oid to the row set's `lastSeenTip`. Only on a **change** do you escalate to tier 2 for that one Atlas —
never re-walk Atlases that haven't moved, never re-fetch bodies for rows whose oid you already hold. A dropped
Atlas (no longer reachable) doesn't have to evict its rows immediately — they're small, and staleness is
visible from `lastSeenTip` rather than absence.

## Provenance in the UI

The mixed feed's "signed off" claim is exactly what tier-2's tip commit already carries (author/committer,
and — once `qr-provenance.md`'s SSHSIG path extends here — a signature over the snapshot). A row's `source`
+ `signer` are what the UI shows next to it; opening a row (tier 3/4) re-verifies against the same tip oid,
so a stale or tampered fetch is refused the same way `origin.md`'s firmware pin refuses a foreign-signed
manifest.

## Open questions

- **Incremental fetch with `have`s.** The one real cost still standing: wanting a commit oid with no `have`
  negotiation pulls its full ancestor history. `docs/git-enough.md`'s original "later degree," unaffected
  by tiers 2/4 landing.
- **The refresh policy itself.** Tiers 1–4 and the merge are all built; what's not built is the *loop* that
  compares a fresh tier-1 ref advertisement against a row's `tip`, decides whether to escalate to tier 2,
  and re-merges. `lastSeenTip` (above) belongs to this piece, not to a single merge pass.
- **The foundational/on-demand split for merged rows.** #91 built this policy for materialized *files*
  (`viewer/materialize.mjs`); it isn't yet wired to *rows* — does a merged row know whether its full body is
  actually hydrated (materialized) versus just known-to-exist from a listing?
- **Eviction of stale rows.** Small individual rows make this low-stakes, but an unbounded number of
  attached-and-abandoned Atlases still isn't free; ties to the quota/eviction discussion (browser storage is
  one shared, LRU-evicted bucket — nothing here is exempt from that).

## See also
- [`docs/git-enough.md`](git-enough.md) — the phases this extends; "later degrees" names this gap directly.
- [`docs/system-viewer.md`](system-viewer.md) — the registry + widget shape the merge feeds into.
- [`docs/dark-mode.md`](dark-mode.md) — "Atlas, offline" and the friend-Atlas one-hop model this is meant to
  scale.
- [`viewer/repos.mjs`](../viewer/repos.mjs) — the `atlas.snapshot` kind and `source` field this reuses.
- [`viewer/atlas-index.mjs`](../viewer/atlas-index.mjs) — the merge function; `viewer.atlasFeed` on the probe line.
- [`viewer/materialize.mjs`](../viewer/materialize.mjs) — tier-4's cache/storage side (#91).
- [`git-enough/fetch-pack.mjs`](../git-enough/fetch-pack.mjs) — all four fetch degrees (#94, #95).
- [issue #87](https://github.com/FCCN-ANTIBODY/anecdote.channel/issues/87) / [PR #88](https://github.com/FCCN-ANTIBODY/anecdote.channel/pull/88) — where `atlas.snapshot` first landed.
- #90, #91 — the issues this closes out the remaining scope of.
