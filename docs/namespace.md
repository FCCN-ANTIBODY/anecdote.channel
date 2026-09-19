# Labels, names, and what belongs in DNS

> Status: **shaping note**, captured 2026-09-19 from a working conversation — ideation, not built.
> Why the sub-sub-domain namespace keeps feeling impossible to settle, which parts are genuinely
> decided, and the one criterion that tells you whether a thing belongs in a hostname at all.
> Companion to [`config/san-list.txt`](../config/san-list.txt) (the row budget),
> [tls-acm.md](tls-acm.md) (deep wildcards), and [coring.md](coring.md) (signed claims over registries).

## The criterion

**A label belongs in DNS if and only if it needs its own origin. Otherwise it is a path.**

That is the whole rule, and most of the difficulty below dissolves once it is applied. A hostname buys
exactly one thing a path does not: an **origin** — its own storage partition, its own passkey scope, its
own same-origin boundary. Everything else a hostname appears to give you (hierarchy, legibility,
grouping) a path gives you for free and without a certificate row.

So stapling path information onto the front of DNS only to unwind it back into a folder is a round trip
that accomplishes nothing. It costs a SAN row and a DNS record and returns you to where you started.

- **Library labels need origins.** Per-label storage, and a passkey scoped to that one editable
  data-bottle rather than all of them. → hostname.
- **Atlas category views do not.** A category board is a `/`-separated list of labels unioned into a
  filter over a shared index: read-only, no per-view storage, no per-view credential. → path.

Which answers "why have `atlas` in there at all": it should not be. `atlas.anecdote.channel` publishing
the state sites is rational — those are real, separate places. Minting sub-sub-domains so a visitor can
look deeper at their own town is path information wearing a hostname.

## Labels are not names

Three things holding `north` is not a collision. It is a **set**.

- A **label** is a category membership: many-to-many, unowned, and pointless to reserve.
- A **name** is an identity: one holder, established by signature.

Pinning three entries at the same label is only absurd if you expect the label to identify them —
it never did. They are told apart by their monikers, or by a garbage nonce minted at generation
time, or by nothing at all until one of them signs something. *"These are labels more than names,
which is why they feel like categories."* They feel like categories because they are.

This is why the squatting race dissolves. An address is a **rendezvous coordinate, not a claim**;
holding it grants nothing, exactly as [`composer/bottle-book.mjs`](../composer/bottle-book.mjs) already
says — *the network put nothing at either address*. Two `north`s in two towns coexist. The claim "these
two are the same entity" is a **signed assertion in the content**, never a fact in DNS. Nobody has to
race to reserve a word in every town, which was the point.

It also unifies two things that looked separate: an Atlas category path and a library label are the same
structure — a label-set. They differ only in that one of them needs storage.

## The apex keeps the bottle space empty, on purpose

`library.anecdote.channel` stays a press site with a **deliberately empty bottle space**, so the label
space is *the visitor's* rather than something we have to arbitrate.

This dissolves the two-occupants problem instead of managing it. There is no collision between what the
apex publishes and what a holder stores, no asymmetry where our content silently vanishes while their
storage persists, and no question about whose data a storage clear belongs to. Canonical bottles are
still distributable — a bottle travels by its bytes, not by its address, which is the entire point of
the carrier. It does not need to live at `<label>.library.anecdote.channel` to be gettable.

The rule states in one line, which naming schemes usually cannot: **the apex serves the floor and
nothing else; every label is yours.**

## "Library" is a name, not a level

If a node can publish `library1` and `library2`, then there is **no such thing as plain `library`** —
it is a name among names, the same kind of thing as `voices` or `media`. Putting it in the hostname as a
fixed level privileges one library and then cannot address the rest.

The cost is concrete. `library1.north.voices.fort-collins…` needs `*.north.voices.fort-collins…`, which
is one row per node and is needed anyway. Adding `library` as a level needs `*.library.north.voices…`
**as well** — a second row per node, against a pack capped at 50 hosts that aborts rather than truncates
([tls-acm.md](tls-acm.md)). Keeping `library` out of the hostname halves the row count.

Related: a node's libraries are **wings**, and engine directories beginning with `.` are never
referenceable as wings — a small win, taken.

## Why it feels impossible: a matrix, and DNS is a tree

The namespace is two-dimensional — **moniker × facet** (`north` × {voices, library, media}) — and a
hostname can express only one ordering. Whichever axis is the parent, the other becomes the wildcard,
and portability *along the parent axis* is precisely what a tree cannot represent. There is no shape
that fixes this; there is only a choice of which cost to pay.

- **Facet as parent** (what exists today): `*.voices.fort-collins…` covers every moniker.
  Rows = cities × **facets**. Facets are a small closed set.
- **Moniker as parent**: `*.north.fort-collins…` covers every facet for one moniker.
  Rows = cities × **monikers**. Monikers are open-ended.

The current orientation is already the cheap one. Inverting it — `north.library.fort-collins` — would
multiply the row count by the one quantity that grows without bound. However suggestive the inversion
reads (*"the library belongs to the city and some of us have branches on it"*), it is the expensive
direction, and the row budget is the binding constraint.

Portability of a moniker across facets is then not a naming problem at all: the `north` under `voices`
and the `north` under some other facet are different addresses that happen to share a word, and their
linkage is signed content.

## Wildcard fall-through

`*.anecdote.channel` **does** yield to explicitly served names: DNS consults a wildcard only when there
is no exact match and no closer enclosing node (RFC 1034). An existing record wins, and a name that
exists as a node at all occludes the wildcard beneath it. So "fall through only after our served ones
match" is not a feature to arrange — it is how resolution already works.

The limit is the one that governs everything here: **a wildcard covers exactly one label.**
`*.anecdote.channel` answers for `foo.anecdote.channel` and never for `foo.bar.anecdote.channel`. A
catch-all at the apex is therefore a floor for one level, not a contraction of the deeper scheme.

## Nodes publish their own configuration

A node's wings live on **non-main branches**, so something has to say which — a press site with wings
available does not advertise them from `main`, and nothing can guess.

So each node repository (`station-node`, `civic-node`, a voice node) publishes a small **signed
manifest**: branch → wing name. [`git-enough/`](../git-enough/) can already read refs, so this is a
read, not an integration. One artifact answers both questions that matter:

- *what are your wings* — for anything mounting or listing them;
- *what would you cost* — the DNS records and SAN rows required to support that configuration, which
  is the thing the row budget needs to know before a node is onboarded rather than after.

## Open

- Whether Atlas's label order is deterministic enough to navigate directly rather than rendering HTML
  to click through. *"Making them html to click through is the bad leg — it could take you there itself
  if the tag/label order is so deterministic after all."*
- Whether `share/` stays the mount for what is shared. Removing it makes shared-ness a configuration
  matter rather than a structural one; keeping it is the current preference.
- Whether a node's own-config manifest is the same artifact as its wing list or two files.
- The serving attachment for any wildcard at all — neither GitHub Pages nor Cloudflare Pages will take
  a wildcard custom domain, so an unbounded label space needs a Worker. That decision is still open and
  is independent of everything above.
