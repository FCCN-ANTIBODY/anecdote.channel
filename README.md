# anecdote.channel

Anecdote lets a city poll itself without consenting to anyone's privacy policy — open
questions, write-in answers, anonymized by a revocable nonce, orchestrated on the smartphones
people already carry. It is governed by its own [`CONSTITUTION`](CONSTITUTION.md).

This repository is the **authoritative home** of Anecdote's shared instruments.

## The Mobile LLM reducer

[`reducer/`](reducer/) is the on-device "Mobile LLM" the CONSTITUTION promises
(**§ Mobile LLM**, **§ Responses**): a heavily pruned instrument you run with your own device's
power, whose only job is **label reducing** — shaping free text into the constitution's
fewest-verbs form, **privately, in memory, before anything flies into the network**, and
caching its dictionary **locally, in domain-scoped storage**, never on a backend.

```sh
node reducer/test.mjs   # core + local-cache persistence, dependency-free
node reducer/demo.mjs   # two gatherers collide; dictionary cold-loads from a domain-scoped cache
```

See [`reducer/README.md`](reducer/README.md) for the algorithm, the local cache, and how the
real on-device model drops in behind one seam: an optional, **hash-pinned all-MiniLM-L6-v2**,
vendored and cold-loaded (`reducer/weights.mjs`) — one uniform, verifiable instrument, never a
runtime call to a third party.

## The composer

[`composer/`](composer/) is the front-door **experience**: type a statement → it reduces to its
kernel of intent → a **"to" picker** shows where it can go. anecdote is ingress with no
user-side constitution; it never blocks a statement, it only **routes** it. The picker is driven
by your local cache of destinations — **Tells** you address directly (private) and public,
jurisdiction-scoped **Atlases** (discoverable) — dimming any a statement isn't *offered* into,
with the reason. There are no stupid statements.

```sh
python3 -m http.server 8000   # open http://localhost:8000/composer/
node composer/route.test.mjs  # the routing core, dependency-free
```

See [`composer/README.md`](composer/README.md) for the full experience model.

## Design notes

- [`docs/anecdote-schema.md`](docs/anecdote-schema.md) — what a confirmed send **carries**:
  `anecdote/v1`, the payload `route.prepare` grows into. Text rides inline; an image, a GeoJSON
  shape, or a citation rides as a **receipt** (hash + provenance) whose bytes live in your own
  references pile — anecdote cites and proves, it does not host. Signed on-device
  ([`composer/sign.mjs`](composer/sign.mjs)). Implemented in [`composer/anecdote.mjs`](composer/anecdote.mjs).
- [`docs/consent-and-nonce.md`](docs/consent-and-nonce.md) — your **power over your data**: every
  contribution carries a **revocable nonce**, the **trove** keeps the complete local record of
  everything you've sent (the exact bytes — the reproducible QR), and **removal of consent** is a
  signed act only you can make (CONSTITUTION §"Revocation of consent"). Implemented in
  [`composer/consent.mjs`](composer/consent.mjs).
- [`docs/tunnel.md`](docs/tunnel.md) — the **runtime tunnel** a host opens by **iframing us and
  saying hello**: a Tell's poll sheet embeds anecdote.channel, which canonical-labels the answer,
  builds + signs it with a fresh nonce, leaves the receipt in our own trove, and hands back the
  artifact to put where it belongs — a Tell for private (the issue-as-input), an Atlas for
  unsolicited. Implemented in [`composer/tunnel.mjs`](composer/tunnel.mjs).
- [`docs/label-reducer.md`](docs/label-reducer.md) — what the instrument **is**: the organ of
  **perception** (base face fact, fewest-verbs, descriptive-never-prescriptive), the amoral
  counterpart to the moralizing Judge, running *ahead* of the user's own constitution.
- [`docs/DELIVERY.md`](docs/DELIVERY.md) — how it **reaches a device**: content-addressed and
  source-agnostic — DNS/edge now, optical QR fountain offline, mesh later — all verified against
  one hash-pinned lock (answering civic-node `OPEN-QUESTIONS.md` §O).

## Other contents

- [`widget/`](widget/) — the baked, dormant (no event loop, no live fetch) public widget a
  civic node embeds.
- [`config/`](config/), [`scripts/`](scripts/), [`docs/`](docs/) — TLS/ACM edge plumbing for
  serving the channel.
