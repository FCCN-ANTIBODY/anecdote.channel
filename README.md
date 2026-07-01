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

- [`docs/origin.md`](docs/origin.md) — **Milestone: Origin** (vision + broad-strokes contract): the
  offline-first **shipyard of data:chambers**. The held copy eclipses the served origin (first-contact
  signer-pinning); the trove is home base; a powerless `data:` chamber is handed powers — including
  `crypto.subtle`, which it lacks because it isn't a secure context — down a **probe line** from the
  Elevated `anecdote.channel` origin; an offline **git origin** + a vendorless **git-enough** client make
  it long-term storage. DNS-first, store-never, optical-eventually.
- [`docs/git-enough.md`](docs/git-enough.md) — shaping the offline origin's **steady beat** (stage/commit,
  or no-op for incognito), git-as-capability-shorthand, the **LM-as-historian** indexing, the **history
  pile** (the pile's "question" as an ingress filter), and the **`seal-enough`** factory — almost all
  WebCrypto, with `age` spoken only at the Tell-interop boundary. The **offline origin publishes** (pushes
  downstream, never pulls upstream — GitHub repos become its clients); two repo-init entry points
  (greenfield scaffold, and the **import swap**: *The Castle* = full-lineage git import vs *The King's
  Leap* = photocopy-as-fresh-root). The **phased plan** builds toward a send-pack push. **Phase 0** (the
  git object layer, [`git-enough/objects.mjs`](git-enough/objects.mjs)), **phase 1** (refs + index +
  working commits, [`git-enough/repo.mjs`](git-enough/repo.mjs)), and **phase 2** (v2 packfiles,
  [`git-enough/pack.mjs`](git-enough/pack.mjs)) are built — vendorless and browser-native, cross-verified
  against a real `git` (`git fsck`/`log`/`cat-file` read our history; `git index-pack`/`verify-pack` accept
  our packs and the pack sha matches our trailer). **Phase 3** — smart-HTTP `send-pack` push
  ([`git-enough/send-pack.mjs`](git-enough/send-pack.mjs)) — is built and **offline-verified against a real
  `git receive-pack`** (create / fast-forward / King's-Leap replace); only a live push to github.com
  (Contents-R/W PAT) is left for the operator to trigger. The **Castle read-side** — `git-upload-pack`
  fetch + delta-resolving pack reader + `clone`
  ([`git-enough/fetch-pack.mjs`](git-enough/fetch-pack.mjs), [`git-enough/unpack.mjs`](git-enough/unpack.mjs))
  — is built and **offline-verified against a real `git upload-pack`** (a deltified pack fetched, deltas
  resolved, the full lineage imported and read back by git). Byte-accurate inflate is **browser-native**
  ([`git-enough/inflate.mjs`](git-enough/inflate.mjs) — `DecompressionStream` + gallop/binary-search on the
  zlib member boundary), so the whole stack runs vendorless in the browser, not just Node.
- [`docs/probe-line.md`](docs/probe-line.md) — shaping (edges first) the **probe line** between a powerless
  `data:` chamber and the **Elevated anecdote app**: the ingress tunnel **inverted** (capability = a
  transferred `MessagePort`, since a `data:` origin is null), the enough-clients vended as ops, the consent
  ladder, and how the demos become clients once they load from offline arch + MiniLM. Edges 1/2/6
  (capability primitive, streaming op surface, iframe-vs-tab + teardown) are **verified in Chromium**.
- [`docs/probe-line-consent.md`](docs/probe-line-consent.md) — the probe line's **consent ladder**
  (implementation plan, Edge 3): three rungs (ambient / confirmed / standing), and the **standing grant**
  as the behavior-shaped cousin of the revocable nonce — signed, legible in a "running-on-my-behalf" panel,
  and revoked mid-stream (`cancel` + `port.close()`) with **the commit as the atomic revocation unit**.
  Implemented across [`composer/consent.mjs`](composer/consent.mjs) (the grants API),
  [`composer/authorize.mjs`](composer/authorize.mjs) (the gate), and
  [`composer/probe-line.mjs`](composer/probe-line.mjs) (the Elevated session + transport — verified
  end-to-end in Chromium), and [`composer/grants-panel.mjs`](composer/grants-panel.mjs) (the glanceable
  "running on my behalf" panel — every row shows its state and the artifact that proves it; live demo in
  [`composer/grants-panel-demo.html`](composer/grants-panel-demo.html)).
  The frame is realized: [`composer/probe-ops.mjs`](composer/probe-ops.mjs) vends the **real** composer
  (reducer `label`, `anecdote/v1` build + on-device sign, the trove) as probe-line ops, and
  [`composer/composer-chamber-demo.html`](composer/composer-chamber-demo.html) runs the compose UI inside a
  powerless `data:` chamber that summons them over the port (Chromium-verified).
- [`docs/probe-line-v1.md`](docs/probe-line-v1.md) — the **`probe-line/v1` protocol specification**: the
  normative reference (roles, capability-by-port trust + mutual auth, the handshake, the frame grammar,
  the two revocations, the consent ladder, conformance) that `composer/probe-line.mjs` implements — with a
  provenance table tying every rule back to a Chromium-verified edge or a test.
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
  unsolicited. Implemented in [`composer/tunnel.mjs`](composer/tunnel.mjs); **worked end-to-end demo**
  in [`composer/host-demo.html`](composer/host-demo.html) + [`composer/guest.html`](composer/guest.html)
  (`node scripts/serve.mjs` → open `/composer/host-demo.html`).
- [`docs/egress-github.md`](docs/egress-github.md) — **out the door**: serialize a delivery into a
  GitHub **issue or comment** (a canonical per-poll issue, responses as comments, so the comment
  ordinal is free contemporaneous metadata) and post it with a semi-public, repo-scoped credential —
  kept strictly out of the body and trove. The page then becomes the **detail view of its async
  status** (your nonce, stapled to the request, queryable after a reload). Implemented in
  [`composer/egress-github.mjs`](composer/egress-github.mjs).
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
