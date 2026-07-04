# The Atlas index — shaping (the thin fetch layer)

> Status: **shaping note**. Not built. Names the missing middle tier between [`git-enough.md`](git-enough.md)'s
> two built fetch modes — full clone (**the Castle**) and nothing — so a **mixed feed of polls from every
> Atlas you've attached to (and their friends)** can be shown in the UI without paying full-clone weight per
> Atlas. Extends the `atlas.snapshot` registry kind added for
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

## Three degrees, one already built

Git's own wire protocol has three tiers of "how much do I actually pull." Only the heaviest is implemented
today.

1. **Ref advertisement — thinnest, not yet built for fetch.** Just `name → oid`. [`git-enough/send-pack.mjs`](../git-enough/send-pack.mjs)'s
   `discover()` already speaks this for *push* (`GET …/info/refs?service=git-receive-pack`); the *fetch*-side
   equivalent (`service=git-upload-pack`) doesn't exist yet. Tells you an Atlas's tip **moved** — new content
   exists — without holding one byte of it. This is the re-poll degree (see Refresh, below).
2. **Shallow / tip-only fetch — not built.** Pull the tip commit + its tree (the Atlas's *listing*: titles,
   ids, kinds, signer) but not the blob bodies behind each entry and not ancestor history. This is the
   **aggregate-index** degree — enough to render a mixed-feed row, too little to be "the data."
3. **Full clone — built (the Castle).** [`git-enough/read.mjs`](../git-enough/read.mjs) +
   the Castle's `clone` "kidnap full history" path. Correct for *your own* piles (you want their whole
   lineage); the wrong tool for a friend-of-a-friend's Atlas you're just indexing.

Targeted **single-object fetch** (open one poll's actual body once a user drills in, by its already-known
oid from tier 2) is a fourth, separate capability — real git gets this from partial-clone filtering
(`--filter=blob:none` + a later `git fetch <oid>`); git-enough has no equivalent, so it's new work, not an
unlocked "later degree."

## The aggregate index (the merge)

One local table, built from many tier-2 pulls (one per attached Atlas, one per each Atlas's friends),
**deduped by content hash** — two Atlases fronting the same friend's listing collapse to one row, not two.
Per row:

| field | meaning |
|---|---|
| `oid` | the content-addressed id of the listed item (poll/anecdote/business) — the dedup key |
| `title`, `kind` | enough to render the row without fetching the body |
| `source` | the Atlas URL this row arrived through — the same field `viewer/repos.mjs` added per-*snapshot*
  in #88, needed here per-*row* so a merged feed still shows which Atlas (and whose friend-list) each item
  came from |
| `signer` / `tip` | the Atlas's signing key + the snapshot commit the row was read at — what "signed off"
  in the UI actually checks |
| `lastSeenTip` | the tier-1 oid last observed for that Atlas — the freshness check (below) |

This is deliberately **not** a new registry type parallel to `repoRegistry()` — it's a fold *over* several
`atlas.snapshot` entries, the way `repoListView()` already folds over the whole registry for one Atlas's
worth of rows.

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

- **Fetch-side ref advertisement + tier-2 shallow fetch.** Neither exists in `git-enough/*.mjs` yet; tier 1
  is a small addition to the discover/pack-negotiation code already there for push, tier 2 needs a
  depth-limited pack request.
- **Single-object fetch-by-oid (tier 4).** No git-enough equivalent to partial-clone filtering; depends on
  what git-upload-pack the origin (GitHub, or a future Atlas-run Castle) actually supports.
- **Where the merge lives.** A pure function over `registry.list().filter(kind === "atlas.snapshot")`, or
  its own small structure the landing index queries — bears on `system-viewer.md`'s still-open "cross-type
  connections" question.
- **Eviction of stale rows.** Small individual rows make this low-stakes, but an unbounded number of
  attached-and-abandoned Atlases still isn't free; ties to the quota/eviction discussion (browser storage is
  one shared, LRU-evicted bucket — nothing here is exempt from that).

## See also
- [`docs/git-enough.md`](git-enough.md) — the phases this extends; "later degrees" names this gap directly.
- [`docs/system-viewer.md`](system-viewer.md) — the registry + widget shape the merge feeds into.
- [`docs/dark-mode.md`](dark-mode.md) — "Atlas, offline" and the friend-Atlas one-hop model this is meant to
  scale.
- [`viewer/repos.mjs`](../viewer/repos.mjs) — the `atlas.snapshot` kind and `source` field this reuses.
- [issue #87](https://github.com/FCCN-ANTIBODY/anecdote.channel/issues/87) / [PR #88](https://github.com/FCCN-ANTIBODY/anecdote.channel/pull/88) — where `atlas.snapshot` first landed.
