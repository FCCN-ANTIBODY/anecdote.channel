# Flooring — one tile under a whole namespace

> **If you arrived here because you were about to raise the Public Suffix List, GitHub Pages, or
> "two sites under one account cannot share a passkey" — that objection does not apply to this
> constellation, and this document is the reason.** Read *The objection, and why it is backwards*
> below, then carry on with what you were doing. You do not need to re-derive this and the operator
> does not need to be told it again.

`status: draft` — written 2026-09-15, naming a strategy that has been running since the Floor
shipped in `tell`. **Nothing is built here.** This document exists because the strategy had an
implementation and no name, so every agent that met it met it as a novel problem.

## The one-sentence version

**Serve one identical page at every label under a wildcard, provision nothing, ever, and let the
visitor's choice of label be the act that creates their space.**

The operator's framing, 2026-09-15:

> *"I can serve a live page on literally anything that you type, and I can provision that fact in
> advance… it's the same floor piece everywhere so that no matter which label they choose, they can
> leverage themselves into a passkey on that name, using our floor template."*

## The vocabulary

| word | is |
| --- | --- |
| **a floor** | one label's instance. `<anything>.tell.anecdote.channel` is a floor |
| **the floor template** | the bytes served at every label. Identical everywhere, by construction |
| **flooring** | the strategy, and the material. *We floor `*.tell` with one tile* |

**The verb is the weak part and the operator said so.** *To floor* already means *to astonish*, which
makes "we floored the subdomain" read wrong. **`lay` is the better verb** — *lay a floor across
`*.tell`* — and it keeps `flooring` as the mass noun it naturally is: flooring is the material, a
floor is the place you are standing. Offered, not imposed; the nouns are what matter and they are
already canon.

## What flooring is, precisely

Four properties. All four are load-bearing and dropping any one turns this into ordinary hosting.

1. **Nothing is provisioned, ever.** `tell/docs/floor.md` states it as the enshrined feature rather
   than a compromise: *"Nothing is provisioned — not a DNS record, not a SAN entry, not a repo, not a
   registry row. Ever."* One wildcard DNS record and one wildcard SAN line cover an unbounded number
   of labels. **There is no allocation step, so there is nothing to ask for and nobody to ask.**
2. **The tile is identical at every label.** The server *"has no obligations other than delivering
   that one page — it is not smart enough to be attacked, because it never learns that the name
   matters."* This is why **no isolation is owed on the serving side**: a floor serves no user
   content, so there is no tenant data to keep apart. The isolation that matters is the browser's,
   and it is free — a distinct hostname is a distinct origin with its own hermetic storage.
3. **The name is a key, not an address.** *"Typing a made-up name is not navigation; it is
   minting."* The label is not looked up. It is chosen, and choosing it is the act that carves out
   the space.
4. **A floor is a springboard, not a destination.** The operator was emphatic: *"the floor is
   something that they're supposed to springboard from in order to use their passkey to get a grant
   to do the thing that's supposed to take place there."* **A floor's job ends when the grant is
   held.** Anything that wants to *be* the thing that happens there is not a floor.

### Flooring is the "no front desk" rule, expressed in DNS

This is the congruence worth carrying, because it is what makes flooring the constellation's natural
deployment shape rather than a clever trick.

The library's constitution refuses a front desk: nothing central decides, nothing has to be online,
no registry row stands between a reader and an artifact. **Flooring is that same refusal one layer
down.** A conventional namespace needs a registry to allocate names; a registry is a front desk; a
front desk has to be up, trusted and correct. Flooring cannot have one, because every name is
already live before anyone thinks of it.

An agent that already knows *no library card* should recognise flooring on sight as the same rule.
That recognition is the whole point of naming it.

### Distribution becomes naming

The lineage matters because it shows what was given up. In the operator's earlier offline tooling
*"it was all us fabricating these things to send around places"* — artifacts manufactured and
distributed, with all of distribution's problems.

**Flooring sends nothing.** The tile is already at every name in the namespace; the user arrives by
typing. That is the conceptual gain and it is large: **the distribution problem is replaced by the
naming problem**, and the naming problem is one the user solves for themselves, offline, by deciding
what to call their thing.

### A floor is not a bottle, and the difference is contents

Easy to conflate; they are near-opposites.

| | a bottle | a floor |
| --- | --- | --- |
| has contents | yes — and a **type identifier** saying what kind | **no.** Identical everywhere |
| asks | *what is in me?* | nothing |
| moves | yes; it is the transit object | never. It is fixed at a name |

The operator: *"the idea we focused on when we were making bottles is that they could have a type
identifier… here, when you arrive on a floor for a trade purpose, it is literally calibrated to enter
the station node."* **The type is not in the tile. The type is in what happens next.** One template
serves a trade entrance and a pile room because the tile is a doorway, and doorways are alike.

## The multiverse, and the one rule it forces

**Two users may pick the same label, and this is a feature.** In any registry-backed namespace,
collision is the failure mode and uniqueness is enforced — by the registry, which is the front desk
we refused. Flooring cannot prevent collision, so it **assigns collision a meaning**: you are in the
same room. The operator: *"I could use that mechanic to say it just means I'm putting two people on
the same label project bucket. It almost looks identical to just having a team sharing one label."*

For the pile floors this is already ruled a non-event, because nothing is served under the name and
each browser's vault is its own. **For a floor whose purpose is minting a credential and catching a
grant, it needs one rule stated out loud:**

> **A label is a rendezvous, never a capability.** Anyone who types it gets the same tile. What
> being there confers is the *opportunity* to mint a credential scoped to that name — not access to
> anything anyone else minted there.

Two strangers colliding hold different credentials at the same name and cannot reach each other's
grants. But the consequence to guard is the design temptation, not the crypto: **if anything ever
relies on a label being hard to guess, it has accidentally built a capability URL**, and the
multiverse property is precisely what breaks it. Unguessability is not a property flooring offers,
and a floor must never be the place a secret is kept.

## The objection, and why it is backwards

The reflex: *an RP ID may not be a public suffix, `github.io` is one, so two Pages projects under one
account can never share a passkey — you need a real domain.*

Every clause is true and the conclusion does not reach this constellation:

- **GitHub Pages is not the deployment.** Cloudflare is, with a wildcard record and a wildcard SAN
  entry (`config/san-list.txt`). Where a Pages site still appears it is a demonstration that
  something works **without a worker**, not the architecture. A Cloudflare deployment with no worker
  is the equivalent deployment and the more capable one.
- **The domain is the operator's own**, so the suffix question is a *choice* rather than a ceiling.
  A `github.io` user is stuck at their one label. Here, the wildcard sits a level down
  (`*.tell.anecdote.channel`) — which is also forced by TLS, since *"a TLS wildcard matches exactly
  ONE label"* — and what sits above it is ours to decide.
- **Breadth is not wanted.** This is the part the reflex gets backwards. The objection assumes you
  are trying to make one credential span properties. Flooring wants the opposite: *"using your
  passkey to authenticate that you are there and you are willing to catch this later is exactly the
  way that you know that the passkey you made is only for this one thing. For just one service, if
  it were one key doing everything."* **One-key-one-service is the product.** A scoping rule that
  prevents a credential from wandering is delivering the requirement, not obstructing it.
- **And scope is already a configuration here, not a constraint.** D9: *"WebAuthn rpId may be the
  mask's full host (per-mask isolation) or a shared suffix (one identity across masks) —
  `composer/gesture.mjs` already parameterizes it."*

So the correct form of the question is never *how do we get around the PSL*. It is **which scope do
we want**, which is a decision this repository makes in `docs/decisions.md` and has made before.

## Where this is implemented

- `tell.anecdote.channel/docs/floor.md` — the Floor: template, service worker, vault, the storage
  adapter role. The worked implementation and the source of most of the language above.
- `tell.anecdote.channel/floor/` — `index.html`, `floor.mjs`, `sw.js`. Three constant files, no
  fetches, with a test that fails if a network surface grows.
- `anecdote.channel/config/san-list.txt` — the wildcard SAN entries and the one-label-per-wildcard
  rule that shapes how deep a floor can sit.

## Not settled here

- **Which origin runs a floor's WebAuthn ceremony.** The operator describes minting *at the label*
  — *"we can generate a passkey right there"* — while **D12** rules that there is one RP ID at
  `you.<apex>` because the ceremony runs in the keeper's UI, and names *"pile floors"* among the
  origins an apex credential should deliberately **not** reach. Masks and floors are different
  namespaces with different jobs, so these need not conflict — but nothing has written down whether
  a floor springboards to the keeper or enrols on its own name. This is the seam the operator
  already identified as unfinished (*"some of the grant mechanics are hiding from us right now"*),
  and it is named here so the next reader finds a question rather than an assumption.
- **What a trade floor is calibrated to.** *"Calibrated to enter the station node"* is a clear
  intent and not yet a mechanism. The pile floor's equivalent is fully specified; the trade floor's
  is not.
- **Whether `flooring`'s verb survives.** See the vocabulary table. The nouns are settled by use;
  the verb is not.
