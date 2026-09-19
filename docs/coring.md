# Coring — redaction that proves you have the rest

> Status: **shaping note**, captured 2026-09-18 from a working conversation — ideation, not built.
> Names the redaction/disclosure layer the `cite-autumn-ryan` journal needs, the container format it
> implies, and the one trust property the whole thing turns on. Companion to
> [anti-signature.md](anti-signature.md) (marks on the way out), [offline-transfer.md](offline-transfer.md)
> (the carrier), and `data-pile/CONTRACT.md` Layer 3 (the ratchet, which this does **not** replace).

## What coring is for

**Coring proves possession of the rest.** That is the whole claim, and it is much weaker — and much more
buildable — than it first sounds. We are not proving that a published artifact is a faithful derivation of
some original. We are proving that the revealed parts came out of a committed whole, that they sit where
they claim to sit, and that what is missing is exactly as wide as it is claimed to be.

This is **not zero-knowledge** and does not need to be. A re-encoded image with a black rectangle burned in
is unprovable precisely because nothing connects it to the committed original — that is the failure mode the
core keys exist to avoid, not a gap to be closed with heavier crypto. Reveal the real cored regions and the
connection is structural.

### The proximate cause

`cite-autumn-ryan` wants each folder to produce an `index.md` that presents the decrypted parts — stockpiled
locally with their receipts — together with the core that produces them against a **public** data-pile:
the journal itself. The live case is an audio recording awaiting treatment, where the text has to be
produced too so it can be redacted and proven.

**Making the pile public is what raises the assertion at all.** An earlier note in Autumn's own voice says a
data-pile "should probably be private"; that was a pedestrian context, where privacy was the eager default
and the owner had every right to it. Here the posture inverts: we core *specifically* to prove we have the
thing inside, and a sealed pile proves nothing to anybody.

## The gear: the grid picks the size, not the author

If the author chooses how big a redaction is, they can hide three paragraphs behind something that reads as
a comma, or inflate a comma into something that reads as three paragraphs. Either direction is a lie about
the shape of what is missing, and no amount of signing fixes it.

So the author never touches the grid:

- Chunk the artifact on a **format-native grid** — a codec's frame boundary, a tile grid in pixel space,
  byte spans on markdown. The format already chose the quantum; we do not invent one.
- The author paints a mask. The system **snaps outward** to chunk boundaries. Monotone in one direction
  only: the painted region is a *lower* bound on what is hidden, never an upper one.
- **Granularity is publication policy, never a per-redaction choice.** If the author picks the grid per
  redaction they are picking the size again through the back door. Set it before the editor opens, with a
  floor — a redaction is always at least *k* chunks — which is the wiggle room text redactions have always
  had informally, made explicit.

Granularity is also the single dial on the silhouette problem: fine chunks give precise redaction and a
sharp outline (the guess-the-shape game); coarse chunks give a blurrier ballpark and cruder editing. One
number, legible, set by the publication.

## The chain: edges, count, no content

Hash-chain the chunks the way `data-pile/CONTRACT.md` already chains blocks with `prev_hash`. Revealing a
subset then asserts three things at once:

- **The edges connect.** Chunk 5 and chunk 12 are provably 5 and 12 of the same artifact, in that order —
  two halves of unrelated documents cannot be grafted together.
- **The gap is measured.** Six chunks missing is six chunks, counted without being seen. This is the direct
  answer to hiding a massive span behind a small-looking mark.
- **Nothing else leaks.** Only commitments made at production time cross.

Ballpark size disclosure is a **feature** here, not a leak to be minimized. Without it an author can hide
anything; the box communicating roughly how much is gone is the point.

## When the payload is a git repo, git *is* the chain

Everything above describes building a chunk chain. For a git payload you do not build one — **git
already is one**, and using it instead collapses a whole layer:

- **The grid is the object graph**, not byte spans. Core by ref, tree and blob — names git already
  gives you, which stay stable when packfile offsets move. That is the direct answer to "their inner
  byte ranges change and move for HEAD despite being stable": offsets were never the addressing
  scheme.
- **A tree hash commits to its contents**, so revealing a subtree under a committed root proves that
  subtree genuinely belongs to it, with no structure added by us.
- **"Faking a submodule" is not a fake.** A tree object is a legitimate root; publishing a subtree as
  its own repo yields a real repo that verifies against the parent's committed hash for anyone holding
  both. Per-branch, per-subtree, per-anything access control falls out of this.
- **The lower-bound claim comes free.** A revealed subtree proves possession of exactly itself and
  says nothing about its siblings — the sidecar's "(and there could be more)" as a structural property
  rather than a promise we have to keep.

So a published bottle need not carry the whole repository. It carries the part the holder is expected
to reach, and the rest is simply not disclosed.

**The judge already exists.** "A fast-forward that makes no sense for the state it has as canonical"
is an ancestry check against the merge base — git's own rule, not a policy we invent, and
[`git-enough/`](../git-enough/) already has the object and pack machinery for it. A partial or hostile
bottle is refused on git-shaped grounds.

## The plexed-map

Text is easy — already sequential, chunks are byte spans. Audio normalizes to real time, so chunk on the
codec's own frame boundary. The hard case is anything with both a page and a text layer: a Word file needs
sequencing for what is inside it, almost without formatting awareness, and may contain an image that needs a
rectangle against some coordinate space anyway. Bitmapped PDFs are the thing to avoid — we need the pages
*and* the text.

What that implies is a container format that is, in Autumn's words, **a fat duck-typed bitmap**: for
well-chosen 2D grids, cells flow in grid rows and core exactly like a sequence. One artifact should be
redactable in **both 2D space and sequential space**, knowing where in 2D the sequential piece was affixed.

The format has to know it is masked — the way an SVG viewport ignores what is unrenderable — so that areas
outside the boundary are never revealed by accident. We are always masking to the right spot, and the
container carries that boundary rather than leaving it to a renderer.

A **Derivative Hearsay Thing** — a redacted presentation copy — belongs *inside* the plexed-map, not
assembled back out to a re-encoded format. The derivative is a convenience for viewing. The cored regions
are the evidence.

## The exhibit's three copies

The exhibits pile takes the storage hit on purpose:

1. **The raw original** — one of the largest bitmapped copies.
2. **A pristine**, the thing redaction happens from.
3. **A webp shadow**, cored from *identical coordinate space*, with opinionated encoder settings, attested
   at entry.

Either or both can be revealed; webp simply presents better, so coring can be optimized against it. If the
raw is cored for publishing, its tiles can be made webp with exactly the same promises about revealing the
heavier copy after proving your way around the lighter one.

If the public wants the raws, publish them **separately — not as another data-pile**, which would strain the
webp provenance claim by implying a second chain of custody over the same material.

## Where this sits relative to the ratchet

`data-pile`'s Layer 3 ratchet discloses **suffixes**: publish checkpoint `K_n` and everything from `seq = n`
forward derives. Cheap, forward-only, never surrenders the identity — and unable to express "these, not
those." `bin/revealed` is honest that its withhold ledger is an accident guard, not a cryptographic
protection, because a published key stays published.

Coring is the **per-object** lever: one key per chunk, released selectively, chained for adjacency. The two
coexist over one pile and are chosen per artifact. Coring inherits the same one-shot discipline — keys go
loose the moment they are out, so the mask must be finished and the core performed as a single authorized,
gesture-gated act.

## Settled / open

**Settled in this pass.** Coring proves possession, not derivation, and needs no zero-knowledge machinery.
The grid picks the size and belongs to the format. Granularity is publication policy with a floor. Chunk
chaining gives edges plus count without content. The public pile is what makes the assertion possible.

**Open.**

- The plexed-map's actual encoding — how a page layer and a text layer share one coordinate space, and how
  a cell addresses both.
- Whether multiple chunkings at different scales over one artifact (coarse map + fine map, released as a
  layered collection) is worth the coordinate bookkeeping, or whether one grid per artifact is enough.
- Tiled encoding's real cost: tile seams and size inflation versus whole-image compression.
- Text redaction still discloses size in chunk units. That is wanted, but the floor value that keeps it from
  becoming a silhouette has not been chosen.
