# Intermediates — the rendered artifact is canonical, the source is always still there

> Status: **shaping note**, captured 2026-09-19 from a working conversation — ideation, not built.
> Names the composition model the `jekyll-enough` source-render path will need in front of it:
> `{% include %}` as an iframe, the intermediate as the canonical copy, static collapse of forwarding
> nodes, and the depth budget. Companion to [coring.md](coring.md) (what a published artifact proves)
> and [origin.md](origin.md) (the held shell, whose shape this repeats).

## The convention

**An intermediate overrides the sources it was built from — by convention, not by force.** It is the
canonical version because it was affirmatively flattened, the way release artifacts sit beside a dirty
HEAD. Nothing stops anyone looking at the sources; the intermediate is simply what is served.

The other half of that convention is the part that matters more:

> *"If an outer artifact was not refreshed, there is no reason in the universe I would want to stop you
> from rendering it raw from sources, which is the whole point."*

A stale or missing intermediate is never a refusal. It falls through to rendering from source. That is
the **same shape as the service worker's cache slots** — a fast canonical copy, a slower path that
always works, and never a blank screen between them. One mental model covers both, and the tri-state
switch's vocabulary may extend here too: free to rebuild, hold the artifact, guard it.

## `{% include %}` is an iframe, and that is what makes it accessible

Includes become iframes rather than inlined HTML. The usual objection — iframes are bad for assistive
technology — inverts here, because **the iframe is written explicitly**:

- An explicit iframe already documents what it points at, its assistive labels, and its caption.
- An include carries variables that communicate exactly what it communicates on the page when you read
  it in a template.

So the composed page degrades legibly by construction. The thing that makes the authoring honest is the
same thing that makes the rendering accessible.

The rough case is a **loop** of includes. Degradation inside a loop reads worse, and the quarter-step
that fixes it is to render the loop body as *one intermediate elsewhere* rather than as N composed
nodes.

## Collapse belongs in the intermediate, not in the handshake

An include whose only content is opening another iframe is a **forwarding node**. If includes are
functionally pure, forwarding is **statically detectable**: a node that renders nothing of its own and
contributes no variables that change the child's output can be identified while the intermediate is
built.

So flatten there. The runtime mounts an already-collapsed tree and pays a probe handshake only for
nodes that actually render something. Runtime negotiation — probes talking each node down until the
ends address each other directly — stays as the fallback for rendering raw from source with no
intermediate present. That path is the slow one by definition, so eating handshakes on it costs nothing
we care about.

This follows the convention rather than fighting it: if the intermediate is canonical, the work of
being canonical should have happened inside it.

## The fan-out is the cost, not the depth

Five or six levels deep is unremarkable. The shape that bites is **breadth at a level**: an article
listing with six siblings in one issue and fifteen in another, each going that deep. The multiplier is
what hurts.

Which is why rendering a loop body as a single intermediate is the highest-leverage move available —
**it turns a multiplier into an addend.** Fifteen mounted frames become one. That likely buys more than
any runtime compaction would.

## The depth budget degrades into the label

A shallow view is a sensible safeguard — you can only see so many layers down. It must not be a
refusal. Past the cap, the child is not blanked; it renders as its link with its label and caption,
which already exist because the iframe was written explicitly.

The floor and the fallback are therefore the same artifact, and the depth cap costs nothing in
legibility.

## Open

- Where the intermediate lives and how staleness is detected — a content hash of the sources it was
  built from is the obvious candidate, and would make "not refreshed" a checkable fact rather than a
  timestamp guess.
- Whether purity of includes can be *enforced* or only *detected*. Detection is enough for collapse;
  enforcement would make the collapse total.
- The real depth cap number, and whether it is global or per-publication.
- Whether a runtime (React and friends) is ever worth driving this with. Explicitly out of scope for
  now, but noted as a way to climb out of trouble later.
- How this interacts with the firmware bottle player mounted at
  `firmware-<deterministic-authoritative-nonce>.library.anecdote.channel`: those sub-sub-domains are
  separate origins by design (a passkey scoped to that origin alone is the contribution credential), so
  an include crossing into one is a genuine cross-origin mount, not a same-origin shortcut.

## Why the vendored design system is the precondition

CSS does not inherit across an origin boundary, so an invisible iframe cannot be styled by its parent.
This repo already solved that sideways: the design system is **vendored** (`/assets/ds/colors.css`,
`spacing.css`, `typography.css`, `fonts.css`, all in `sw.js`'s `FALLBACK_SHELL` so it boots with a dead
origin). If both sides vendor the same tokens, styles match **by construction** instead of by
inheritance — which is exactly what lets a `{% include %}`-as-iframe disappear into simply composed
kramdown. The precondition is already standing.
