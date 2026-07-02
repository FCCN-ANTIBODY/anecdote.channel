# Offline data transfer — "gravel"

> Status: **innards built (carrier-agnostic), carriers not yet.** [`composer/transfer.mjs`](../composer/transfer.mjs)
> + [`composer/transfer.test.mjs`](../composer/transfer.test.mjs) implement the signed envelope, chunking,
> and the constellation layout — all pure, all tested, with no QR/file/Web-Share carrier yet. Reuses the
> Ed25519 `attest` primitive (composer/sign.mjs) and inherits the trust model of
> [consent-surface.md](consent-surface.md) and [DELIVERY.md](DELIVERY.md): **verify the bytes, accept them
> from anyone; a LOCAL friend-list decides whether to act.**

## The trust stance

`verifyTransfer` answers two *different* questions and keeps them apart:

- **`ok` — is it authentic + intact?** Truly signed by `by`, and the payload hashes to its `hash`. This is
  "verify from anyone" — you can check a stranger's transfer.
- **`trusted` — should you act on it?** Is `by` on your **local friend list**? There is no global registry;
  a face-copy of our branding buys nothing, because trust is a fingerprint you hold, not a look. A
  valid-but-untrusted transfer verifies fine and waits on your **accept** (friend-add + the platform gesture
  from consent-surface.md). *Verifying ≠ trusting.*

## The two "multis" — deliberately different things

Conflating these is where a design like this rots, so they're separate:

- **Chunking (size) — "bricks in the road."** One payload too big for one carrier unit → N blocks. The
  platform has **no opinion** about N; `chunk(signed, capacity)` lays down `ceil(size/capacity)` bricks,
  where capacity is the *carrier's* limit. Blocks carry **no signature** — the envelope inside is what's
  signed. `reassemble` rebuilds and re-checks the **whole-payload checksum** (the reassembled bytes must hash
  to the payload id), so: a **partial** scan returns `ok:false` with the missing indices (never processed as
  if whole), a **foreign** brick from another payload is ignored (grouped by id), and a **swapped** brick is
  caught (`corrupt`).
- **Constellation (a set) — the "physical checksum."** Several *different* transfers laid out together, with
  a **signed layout manifest** (`packLayout`) that attests the whole set: the member content-hashes + the
  intended shape (count, and any physical arrangement a carrier records). This signed tile is the
  codes-you-can't-alter that say *what the shape must be.* `verifyLayout` catches an **intruder tile** (scanned
  but not an attested member — a stranger's QR on the side) and a **missing tile** (attested but absent) —
  **the set validates itself, so the human doesn't have to recognize good-vs-malicious by eye.** Coarse human
  check: "is the shape/count right?" Exact check: no interlopers, none missing, signer trusted.

## First contact — the one door, and code vs data

First contact is **the one place data enters the system.** Everything that arrives is attested as **code** or
**data**, and the two take different paths:

- **Data** (`kind: "data-pile" | "poll" | "anecdote" | …`) → the transfer-accept path above: verify, decide
  on the friend list, gate the accept with the platform gesture, **journal** it.
- **Code** (a program to absorb into the trusted toolset — origin.md's *code-QR*) → the heavier
  **firmware-trust install**: signer-pinned ([origin.md](origin.md) / [consent-surface.md](consent-surface.md)),
  gesture-gated, journaled. Inserting into the trusted area is never casual; it's the same bar as a firmware
  roll-forward.

The boundary is tight; the interior is discussed next.

## The room behind the door — no hidden storage (the hardline)

"The room" is the origin (`anecdote.channel`), a secure context surrounded by encrypted piles. A tempting
idea is a **shared commons** — ambient room-scoped storage all processes could scribble in to talk or to keep
non-commit working memory (the closest thing to the "user space" the model otherwise refuses:
[origin.md](origin.md) "no user space — zero-space or admin-space, nothing in between").

**Decision: no.** We do **not** platform hidden-away storage. The hardline:

> **If a process needs data to persist, it commits to the repo.**

There is exactly one durable surface — the **committed repo** (the trove / the git-enough origin) — and a
commit is a legible, attributed, journaled, revocable act. This is the honest form of "no user space": no
*user storage*, hence **no ambient sink to collude in and nothing hidden to overlook.** Consequences:

- **Non-commit work is ephemeral and in-process** — it dies with the process/focus; it is never persisted to a
  shared area. "Memory to do something other than commit" (the [single-attention](single-attention.md) note)
  is scratch that *stays* scratch: real, but transient and private to the running thing.
- **Cross-process talk is a live channel, not a dead-drop.** Processes coordinate over the **probe line**
  (explicit, capability-scoped — [probe-line.md](probe-line.md)), not by leaving notes in shared storage.
  Anything that must outlive the conversation gets **committed** (and is therefore visible).
- **"Leave stuff by its own convention" is refused, not sanctioned.** There's nowhere to leave it that both
  persists and hides. This keeps the cracked judge's world legible: to persist is to commit, and commits are
  seen.

So the interior is as legible as the door: one door in (attested code/data), one durable surface out (the
committed repo), and nothing durable in between.

## Built vs. ahead

- **Built:** `packTransfer`/`verifyTransfer` (envelope), `chunk`/`reassemble` (bricks), `packLayout`/
  `verifyLayout` (constellation), `transferId`. 18 tests; carrier-agnostic.
- **Ahead:** the **carriers** (QR/Aztec encode+decode of blocks and the layout tile; file pick; Web Share),
  the **accept flow** (friend-add + gesture + journal on the receiving side), and the **friend list** itself
  (how fingerprints are added out of band). None of that changes the innards above.

## Open questions

- **Carrier density + the layout tile's position.** How blocks/layout encode into QR/Aztec, and whether the
  layout ("physical checksum") tile sits at a known position so the coarse human shape-check is reliable.
- **Friend-list bootstrap.** How a signer fingerprint enters your local friend list (a signed handshake; the
  `/polls.json`-style discovery seam in qr-provenance.md — which only *proposes*; the local merge disposes).
- **Accept = commit.** Since there's no scratch commons, accepting a data transfer *is* a commit to the repo
  (under a gesture) — confirm the accept path lands the payload as a committed pile, not a staging limbo.
- **Ephemeral coordination limits.** Exactly what in-process/probe-line coordination is allowed before
  something must be committed, so "no hidden storage" doesn't accidentally push people toward premature
  commits.
