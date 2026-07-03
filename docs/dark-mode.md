# Milestone: Dark Mode — the offline origin, fleshed out

> Status: **milestone vision, shaping** — the successor to [Milestone: Origin](origin.md). Origin
> proved the shipyard (the held copy, the probe line, git-enough, the firmware pin); Dark Mode
> fleshes out what LIVES there: QR exchange proven in place of PR mechanics, delivery carried from
> Atlases and their friend Atlases, and the origin's whole ecosystem of behaviors named as the
> primitives they are. Deferrals cite civic-node
> [`OPEN-QUESTIONS.md`](https://github.com/FCCN-ANTIBODY/civic-node/blob/main/OPEN-QUESTIONS.md)
> where a section exists; the rest are **this milestone's items**, listed at the end.

## The thesis: the origin is its own category

The offline origin resists being categorized alongside Tell and Atlas, and should stop being
forced to. It is an **ecosystem of behaviors that are primitives for a substitute for our online
activity** — a place to do some essential things in definite privacy, where we own our data if we
care about that sort of thing — and *on top of that* is built the idea that we can disclose data
to others for polls. Disclosure is the second story, not the foundation.

What the one instrument already is, or is becoming:

- a **file-system browser** — it needs to show itself;
- a **`data:` chamber factory** — it manages the browsing model Origin pinned;
- an **incidental data-transfer** device (the gravel/carrier layer);
- an **offline web-app packager** — a sensibly packaged app plays offline because all its
  resources are there in a little package (one such thing exists already);
- an **opinion provider** — the unsolicited kind — and an **opinion discovery platform**;
- a **directory of local information** that nobody paid by advertisers cares to catalogue;
- a **local map of public directory structures** — libraries, parks, the things that are weirdly
  hard to get listed without going to a provider who knows our own towns better than we do, ranks
  "local restaurants" by who pays the most, and isn't even from here;
- a **document fetcher for your constituencies** — the city council agenda, the minutes after,
  the video streams of it.

## Three faces of every name

There are now **canonical, hosted-instance, and offline-origin versions** of multiple names —
especially Tell. anecdote.channel gets away with the cleanest job because it drops so quickly
into the offline UI and is driven by your constituency attestations. **Atlas has no offline
frontend yet** — it too will behave like Tell and Anecdote and use the **probe methodology to be
smarter than any one workflow.**

- **Atlas, offline:** the origin reads from **its own local copy of the Atlas**. Offline, you see
  everything that's public on that Atlas, on your copy of it. Open: how the metadata gets crunched
  for an offline public directory so the local copy really is everything you'd normally see.
- **Delivery from friends:** carry delivery from Atlases *and their friend Atlases* — the one-hop
  neighbor model, exercised offline.

## The workspace-switching delicacy

The origin keeps **multiple Tells and Atlases that it runs**. There is a workspace-switching
paradigm to these (the single-focus app lock), so a **manual trigger for several actions is okay**
— and will likely inform the UX of workspace maintenance in the general form. These maintenance
actions are **precisely like the GitHub workflows**: the mirror thesis
([`ROUTES.md`](https://github.com/FCCN-ANTIBODY/civic-node/blob/main/docs/ROUTES.md)) extends past
signing into maintenance itself — a workspace's chores are the same chores, triggered by a person
holding the focused workspace instead of a cron holding a repo.

## Proving QR exchange in place of PR mechanics

The exchange core is built (`composer/register-exchange.mjs` — envelope + consent receipt,
replay-to-mirror). Dark Mode **proves it in place**: the chamber UI (scan → confirm →
counter-scan), the registry-side replay, and module installation — **a module must install from
the QR-read module, as an op in the offline origin.** (The remainder items civic-node §P already
tracks, plus the install-op named here.)

## Tell as a re-broadcast splitter

An open shaping question: can a Tell server be something like **RSS** — designed to deliver
something to everyone, a **re-broadcast splitter** — so that as a client of it you experience it
like an RSS broadcast? This would give the "fetch documents attached to your constituencies" story
its transport: the Tell fronts the recurring feed; the origin subscribes like a reader.

## Mere anecdotes: the uncatalogued public layer

We will share **public articles from our caches — mere anecdotes**, unformed by any Tell or
Atlas, just our churn. **NOT catalogued unless it rises to the level of commentary**, on large
Atlas nodes with many neighbors spotting it too. Reviews are just opinions posted to the
ecosphere — anything: the current Atlas's adopted state-border shape, someone else's entirely,
*I hate this restaurant*, or the positive licensing stories a city wants to hear.

- **The photo drop** (the library as the keystone example): photograph a shelf, work out the
  Dewey codes, report which books are there and which aren't — not especially specific, but it
  becomes an **offline category**: queryable later without having thought to need it. The same
  gesture as a **business-card directory** — a place index where a listing sometimes starts
  unowned, just hearsay: *I have a business card and here's a photo I took of it.* A library's
  public listing could include its entire shelf index, patched together from whatever photo
  dumps get processed. The trick is mostly *how much*.
- **Embedded vs linked:** there's no real limit on what data gets posted, so posting *War and
  Peace* should yield a **resource link** — to where a Tell hosts it, or to the outside world —
  not the body, unless the body is the joke. Between the wholly-embedded document and the bare
  link is the phase that's **allowed to have metadata**. (Named item: **commit size limits where
  they impact a hub piece.**)

## The sneakernet: from polling pull to cascading push

The friend-Atlas delivery glossed above, un-glossed: it is a **sneakernet of manually delivered
data updates**. Everyone is carrying the last snapshot they saw. **They're not even in
agreement — but they're all signed, and they all have timestamps.** Slow, asynchronous
information in a chaotic slow simulation, and yet everyone's shit is signed.

- **Drop-off semantics.** You can hand someone the latest update that's newer than theirs — and
  do it **in stacks**: all the Atlases you're a part of, all the Tell servers on Atlases you
  interact with. You're carrying that offline data around and you can give it to goddamn
  anybody. More than memes and offline HTML games: **we can deliver those city documents to each
  other** — stacks of the town-hall bills you've seen, handed to someone who needed at least a
  little bit of an update on them.
- **Constituency masking.** Delivering your whole snapshot set works like the constituency
  bisect: the ones you're *both* in are all you really care about, so you mask to the overlap.
  They can separately offer you membership in something — Atlases are always public, just not
  all connected to all things.
- **The offline matcher.** Atlas-the-offline-app runs a needs-matching layer over **your
  device's slice of what you've got**, so when new snapshots come in — instead of you going to
  fetch them — **the exact same workflows are working for you offline**, and you get all the
  local benefits the entire time. As long as new snapshots keep arriving, that's cool.
- **The chaos doesn't touch the heartbeat.** Everyone's hierarchy snapshots are a soup of
  shifting dates — irregular deliveries, all stale, all *right at one point in time*, all signed
  underneath. None of the frequency/heartbeat structure is affected: as long as the Atlases keep
  talking to each other for structure, keep their records consistent, and **keep broadcasting a
  truthful one when they aren't being fetched for their truthful one** (connectivity problems),
  the whole record stays intact — as long as everyone keeps behaving well.
- **The signed snapshot export.** Ingesting stops meaning `git pull`: a communication arrives
  representing itself as *the data snapshot for something canonical you know about* — so an
  Atlas must be able to **export a snapshot of itself, signed a certain way**, and the local
  checkout must **verify that signature on ingest**. Probably not code-bound — it is signing the
  **content of the checkout**, so you can know it was real at one time. (The layout/envelope
  grammar and the git-enough tree are the obvious primitives; which signs what is this
  milestone's design work.)
- **Transport-promiscuous by design.** Whatever transport the next milestone springs, **QR and
  QR-video are the proof of basic concept** — a piece of data transfer no one can stop you from
  as long as you're together and you have cameras (the carrier's fountain frames already speak
  it). Sound, or something funnier, can follow: one working example, add anything else, all dark
  mode. There will be a **promiscuous sharing of these items so that they proliferate** — the
  move is from a **polling pull model to a cascading push model.**

## The label reducer grows up

The reducer must learn to **read entire documents and strategically summarize them** — locating
information inside public documents we have no vectorization of and no token budget for:

- **Progressive, hierarchical labels:** collapse regions into what they are, with guided context —
  *where in this document a field might exist*. Almost a **reverse digital form**: recovering the
  blank form back from the filled-out version, selecting a known field (the meeting date) from a
  pre-known spot because the document's format is known.
- **Cumulative cataloguing:** units of effort accumulate across recurring document fetches. Some
  city documents have an explicit **TTL** — good until a meeting date, then a new one is
  canonically known by that same name for the next meeting.
- **Interrogation + the misses:** the labels get interrogated many ways, and the search can
  always run locally once the document is fetched off the Atlas. When someone drills into the
  hierarchy and finds an answer, the node might want to know — so **categorize the queries we are
  not serving well.** This is philosophy as much as telemetry: centralized cloud tooling succeeds
  financially by smothering feedback — a small business owner doesn't realize they aren't
  receiving *whole classes* of feedback; they don't know what they don't know, and the big-web
  paradigm has industrialized that. The origin's answer is feedback that reaches its subject.
- **The directory doubles as an employment board:** small businesses are ignored by city
  resources (federal funds and their conditions foreclose local help), so the business directory
  carries that metadata too — the same metadata idea that lets a city-council document identify
  certain template answers from current info **without even needing the text**.

## Why "Dark Mode"

When DNS isn't working — Cloudflare or AWS or GCP or Vercel or whatever — **anecdote still
functions, and it lets you still function.** Its message architecture is already slow-async,
frame-limited by everyone to decide on their own, and physically transportable. And **it doesn't
know what you'll need to prove, so it lets you make the attestations.**

## The items

Named here so nothing from the founding memo evaporates; slicing into issues is its own planning
round.

1. **Atlas offline frontend** — the local copy of an Atlas, probe-methodology, read-everything
   offline; the metadata crunch for offline public directories.
2. **QR exchange proven in place** — chamber UI, registry-side replay (couples §B), and
   **module-install-from-QR as an origin op**.
3. **Workspace switching + maintenance UX** — the single-focus lock; manual triggers as the
   general form of workspace maintenance (the workflow mirror, made a UI).
4. **Tell as re-broadcast splitter** — the RSS-shaped delivery question; constituency document
   feeds (agendas, minutes, streams) riding it.
5. **Mere anecdotes layer** — uncatalogued public churn; commentary-threshold cataloguing on
   large, many-neighbored Atlas nodes; the photo drop; hearsay listings.
6. **Embedded vs linked posting + metadata phase** — and commit size limits where they impact a
   hub piece.
7. **Label reducer: documents** — progressive hierarchical summarization, reverse-digital-form
   extraction, TTL'd recurring documents, cumulative catalogue effort, and query-miss
   categorization (couples §O's supply/verification story).
8. **The sneakernet** — stacked snapshot drop-off (newer-than-yours semantics), constituency
   masking to the overlap, the offline matcher over your device's slice, and the pull→push
   inversion; heartbeat/structure invariants stated (truthful broadcast when unfetchable).
9. **Signed snapshot export + verify-on-ingest** — an Atlas exports a signed snapshot of its
   checkout's content; the local copy verifies it before ingest ("real at one time"); which
   primitive signs what (layout envelope vs git-enough tree) is the design work.
