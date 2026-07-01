# The system viewer — shaping (the offline self-inspector)

> Status: **shaping note** under [Milestone: Origin](origin.md). Not built. Expands the
> [archive-browser](archive-browser.md) "launchpad" from *a data-pile browser* into **a viewer for
> everything anecdote.channel has stashed on this device** — the foundational op that lets you see your own
> offline system at all.

## The job grows: from piles to your whole offline self

The archive browser started as a tape-line of data-piles. But the real need is bigger: **browser storage is
opaque.** Nobody can see what's inside their IndexedDB, Cache API, OPFS, `localStorage`, or the platform
keychain — and anecdote.channel uses those APIs wherever they best fit. So the viewer's true job is to
**enumerate and inspect everything we've put on your device.** Seeing your own system is the point; the
data-pile tape-line becomes just *one view* inside it.

It is a **free-form viewer** — think a Files app — but **not dumb**: each kind of thing gets a view that
*knows* that kind. It is **one of the main ops**, and it's foundational: it inspects its own place, for you.

## Two layers: raw enumeration (existence) and the registry (meaning)

An earlier draft said "there is no list-all-my-storage API." That was too pessimistic — modern browsers
**do** offer per-API discovery, and it's exactly what lets the viewer show what's on the device even when
the registry is empty:

- `localStorage` — enumerable (`length` + `key(i)`).
- IndexedDB — **`indexedDB.databases()`** lists the DBs; opening each reveals its object stores.
- Cache API — **`caches.keys()`** lists caches; each cache's `keys()` lists the cached request URLs.
- OPFS — walk the directory tree (`getDirectory()` → async `entries()`).
- `StorageManager.estimate()` — the usage/quota summary.

So there are **two layers**:

- **Raw enumeration = existence.** [`viewer/enumerators.mjs`](../viewer/enumerators.mjs) surfaces whatever
  is physically there (built — see below). This is honest even with an empty registry.
- **The registry = meaning.** It's still needed to *type* a raw blob (this IndexedDB record is a
  `pile.session`; that key is the trove) and to pick the **widget** that renders it. The registry doesn't
  gate visibility; it adds interpretation on top of what enumeration already reveals.

Nothing hidden leaks in (these APIs are all origin-scoped to anecdote.channel's own storage); nothing you
own is invisible.

## The shape: a type registry + widgets

Each **type** officially declares itself (the direction from the note). A registry entry:

| field | meaning |
|---|---|
| `kind` | `pile.session`, `pile.poll`, `repo`, `keyring`, `trove.receipt`, `cache.blob`, … |
| `surface` | which storage API + key/prefix pattern — so the viewer can **enumerate** that branch |
| `widget` | an **HTML fragment / template** (the probe-widget shape) that renders *one item* |
| `index?` | optional list-widget; **default fallback is a dumb index/list** — the XML-feed "this is a list view" shorthand |
| `actions?` | the graded capabilities that hang off an item (open, push, delete, shred) |

- **Widgets render in a `data:` chamber over the probe line.** They render *data*, so the same laundering
  stance holds — a widget can't escape the tank, and it runs no ambient authority.
- **Installing a new type/widget is a firmware-trust act** ([probe-line.md](probe-line.md) Edge 4,
  signer-pinned). The "expertise branches know what to do with their branch" — but only trusted branches
  get mounted. This is how the weird file system stays legible *and* safe.
- **The viewer is almost entirely Rung 0.** Enumerate + read + render are read-only. The *actions* on an
  item are the graded ops we already built (`git.push` Rung 1, `discard`/shred, etc.) — they hang off the
  item, gated as always.

So the archive-browser "Reel" is the viewer's **index**; the "Tank" (on-ice page view) is simply the
**widget for `pile.session`**; polls get their own widget (the question + live results).

## The offline origin hosts many repositories

The load-bearing realization from the note: **the offline app hosts any number of repositories** — and
`repo` is itself a viewer type. Reconciled:

- **`pile.session`** — **native to the offline origin, no upstream.** A git repo ready to push, *or not* —
  "light vs. deep copy" is just whether it was ever given a downstream.
- **`pile.poll`** — hosted offline **and** twinned to a Tell (light or deep = King's Leap vs. the Castle).
- **`keyring`** — its own **most-private** repo behind a dedicated probe line ([archive-browser.md](archive-browser.md)
  "keyring fine print": rotation metadata only; the key material stays non-extractable in the keychain).

Each is a git-enough `repo()` addressed by an id.

**Built (first slice):** the **repositories** type — [`viewer/repos.mjs`](../viewer/repos.mjs) +
[`viewer/anecdote-url.mjs`](../viewer/anecdote-url.mjs). A `repoRegistry()` tracks every hosted repo with
its metadata; `repoListView()` is the account-page index. Each row carries the **local `anecdote://repo/…`
id** (the scheme asserts locality — vs. the resolvable-web **downstreams** it mirrors to), its `kind`, git
facts (head/tip/last message/objects), and a **trust grade** for the meter (`private` keyring / `native`
session / `mirrored` poll / `local`). This is the account-page metaphor made concrete.

**Clickable on ice:** [`viewer/repo-detail.mjs`](../viewer/repo-detail.mjs) opens a repo — commit timeline
+ tree at a ref + a file's bytes — and [`viewer/probe-ops.mjs`](../viewer/probe-ops.mjs) vends the viewer
as **Rung-0** ops (`viewer.repos` / `viewer.repo` / `viewer.file`). Worked demo
[`viewer/viewer-demo.html`](../viewer/viewer-demo.html), **Chromium-verified**: a powerless `data:` chamber
renders the account list (trust meters + downstreams), opens any repo on ice (history + tree), and views a
file — all over the probe line. *(Fixed a real probe-line bug in passing: the frame envelope
`{type,id,seq,final}` is now authoritative, so a payload field named `id` can't clobber the correlation
id.)* The pile-type-specific widgets (a poll's live results; a session page rendered from cached blobs)
build on this.

**Raw device storage (existence, even with an empty registry):**
[`viewer/enumerators.mjs`](../viewer/enumerators.mjs) + the Rung-0 `viewer.storage` op list the actual
surfaces on the device — `localStorage`, IndexedDB (DBs + object stores), the Cache API (caches + URLs),
OPFS, and the usage estimate. **Chromium-verified**: a powerless chamber shows the real Elevated-origin
storage over the probe line even when zero repos are registered. Enumeration runs Elevated (the chamber's
null origin has none of its own); the listing is handed down.

## Poll-piles, reconciled offline (Tell is addressable, not the pile)

The clarification the note reached:

- **A poll is a data object** — the QR payload: the *question* + its *mini-constitution* + the *possible
  answers* + routing/run/token. You **author it offline** as that object.
- **The Tell is what's addressable, not the pile.** You **publish** the poll to a **public** Tell (it
  *cannot* be a private Tell — something must be reachable so responders can talk to it), and the Tell keeps
  an **impression** — enough to recognize who's answering. This is exactly the existing Tell ingress
  (`open-poll` / `qr` / `collect-submissions` in `tell.anecdote.channel`).
- The **offline origin also hosts the poll-pile** and **fetches deliveries back** (Castle-style). So the
  pile is a first-class *offline* object — not only a GitHub repo.

Net: `pile.session` and `pile.poll` are **both offline-native**; the only difference is a poll-pile carries
an **addressable Tell twin + an ingress filter** (its "question"), while a session-pile has **no upstream**.

**And authoring a poll as a data object backed by a privileged app is what `tell.anecdote.channel` is
becoming** — the poll-authoring app in the constellation. Making a poll is a create-a-data-object act; the
Tell is the addressable face it publishes to.

**Built (the `pile.poll` type):** [`viewer/poll.mjs`](../viewer/poll.mjs) declares the poll-as-data-object
and renders it. The on-disk object is **`anecdote.poll/v1`** — the Tell's per-poll *constitution* verbatim
(`type` / `text` / `options` / `accept_writein` / `guidance` / `lifecycle`, matching
`tell.anecdote.channel`'s `_data/constitutions/<pile>/<poll>.json`) plus one field, `tell`, naming the
addressable face it answers through. It's committed as `poll.json` in a git-enough `repo()`, so it's a real
pile you can push downstream. `authorPoll()` is the create-a-data-object act; `recordDelivery()` writes a
fetched-back Tell delivery under `deliveries/` (carrying the tree forward, since git-enough's `commitFiles`
stages only what it's given); `pollView()` folds the object + a **live tally** of accepted deliveries
(pending / rejected counted separately, listed options seeded at 0, write-ins flagged) + the Tell twin + a
lifecycle `open`/`closed`/`scheduled` state + the tip commit as the **"Proven by"** artifact. Vended Rung-0
as [`viewer.poll`](../viewer/probe-ops.mjs) (the view nested under `view` so its `type` field can't clobber
the frame envelope's own `type`). Worked demo in [`viewer/viewer-demo.html`](../viewer/viewer-demo.html),
**Chromium-verified**: a powerless `data:` chamber clicks a poll pile and renders the question, the
mini-constitution, per-option tally bars, "N counted · M pending judgment", the Tell it answers through,
and an "open pile on ice" hatch to the raw `poll.json` + `deliveries/`. The Tell-side ingress
(`open-poll` / `qr` / `collect-submissions` / `govern` / `deliver`) is unchanged — this is purely the
offline origin's authoring + hosting + viewing side of the same object.

## Why this is the right "thrust"

It converts "how do I even see my stuff?" into a single, extensible surface: **a declared registry the
viewer enumerates, and a trusted widget per type.** New capabilities (a new pile kind, a new storage
surface) arrive as **registry entries + signer-pinned widgets**, not viewer rewrites. The viewer stays a
thin, Rung-0 enumerator; the intelligence lives in the per-type widgets, exactly like the probe widgets.

## Open questions

- **Registry format + where it lives.** A manifest (like v0's `payload.js` recursion?) — declared where,
  and how a widget is bound to a `surface` enumerator.
- **Enumerator adapters.** One small reader per storage API (IndexedDB / Cache / OPFS / localStorage /
  keychain / git-enough repos) that lists a branch. What's the minimal common shape?
- **Widget trust + rendering.** Exactly how a widget mounts in a chamber, what it's handed (read-only item
  data over the probe line), and the Edge-4 install/pinning flow.
- **The publish + fetch-back wiring.** The `anecdote.poll/v1` schema is now declared and viewable offline
  (above); what remains is the *round trip* — `tell.anecdote.channel` authoring UI that writes the
  constitution + mints the QR (`bin/qr`), and the offline origin's fetch-back that decrypts a
  `tell.digest/v1` manifest into the `deliveries/` the widget already tallies.
- **Cross-type connections.** The note's "connectable → inspectable → filterable": what edges join a poll
  to a session (labels? time? the same identity/nonce?), and does filtering live in the index widget.
