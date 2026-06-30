# Milestone: Origin — an offline-first shipyard of data:chambers

> Status: **milestone vision + broad-strokes contract.** Not built. This records the design direction
> and the invariants it must hold to; the binding law stays in [`CONSTITUTION.md`](../CONSTITUTION.md),
> and the delivery substrate it builds on is [`docs/DELIVERY.md`](DELIVERY.md) (content-addressing makes
> the source not matter). Companion offline role on the Tell side: a Tell runs an offline app too — it
> has all the *data* on hand and *none* of the workflow workers / environment.

## The threat it answers: possession

Everything so far trusts that `anecdote.channel` (the served origin) keeps behaving. But a web app's
honest weakness is that **if the served origin is possessed, the good owner-operator no longer matters** —
a future version, or a mis-signed payload, can be pushed to everyone. The Origin milestone is how we
**lock the hatch on the way out**: make what a person already holds, on day one, strong enough that no
later server can quietly replace it.

## The move: the offline foundation eclipses the server

A held offline foundation, once distributed, **is** `anecdote.channel` — and it **eagerly eclipses
whatever the served `anecdote.channel` distributes later**. The copy you have recorded the **"firmware"
creation circumstance at first contact** — the signer, the fingerprint, the bytes — so it can refuse a
later payload that isn't the same signer it met on day one. New *signed* versions are welcome (someone can
hand you a signed upgrade, optically or over DNS); silent or mis-signed replacement is not. **Trust-on-
first-contact, pinned forever, upgradable only by the same key.** This is the same instinct as the Tell's
signer-pinning and DELIVERY's "verify the bytes, accept them from anyone" — turned on the app itself.

## Distribution: DNS-first, optical-eventually, never an app store

First contact with a *fully custom* payload is still the hard problem (the QR research below). The working
hypothesis: **distribute the base system over DNS first** and the initial asymptote is already solved —
`anecdote.channel` becomes an **offline-first web app that loads with no connection**, and **anyone who
consented on it already has it seeded, forevermore.** No app store: if DNS *and* app stores *and*
Cloudflare *and* all of it broke, it must still work for someone who already holds it. The app store is a
single point of permission we refuse.

## Home base: the trove is Origin

The **trove of nonces** `anecdote.channel` keeps of your submitted data is **home base — where Your Shit
lives.** It is the concrete fulfillment of the constitution's demand that **We Own It In The First
Place**, with **Proof** (capital P, not house style) — signed, revocable (given the right connectivity),
yours. As the offline foundation lands, the trove becomes **long-term storage**, and the offline **git
origin** below is where it durably lives.

## The two layers: the Elevated context and the data:chamber

The execution environment, as often as possible, runs inside a **data:chamber** — a `data:text/html` tab
the offline app sends you into on purpose, because of what a `data:` URI **cannot** do:

- it **can't set cookies**, **can't watch you**, **can't betray you**;
- it is a browser proxy that can't even *do* some things — including, crucially, **`crypto.subtle`**, which
  a `data:` URI lacks because **it is not a secure context.**

That last gap is the keystone, not an obstacle. The data:chamber is spawned with a **secure probe line**
back to the **Elevated context** — the real offline app on the `anecdote.channel` origin (HTTPS, a secure
context) — which **vends `crypto.subtle` and the other powers down the line.** The Elevated context is
where the **trove** lives. Arriving on the Elevated layer makes your data:chamber **bunker completely
clean** and hands you the **git checkout + the tooling to stage and commit** to the offline origin. The
offline origin is the delivery of **Our Software — not updatable by the operator if the holder never wants
an update again.**

## The probe line: behavior submodules (the GitHub-submodule metaphor)

There is a clean rhyme worth keeping load-bearing:

> GitHub **submodules** stock your *workspace repo* from a centralized source (FCCN-ANTIBODY) with things
> it can't whip up itself. The offline app's **probe API** delivers logical **"submodules of behavior"**
> to a *data:chamber* for things it cannot do for itself.

So some distributed packages are **canonical programs that live in the Elevated frame** and add to your
offline tools, which may in turn **add to the probe API** to perform tasks *from the Elevated context at
data:chamber runtime*. The data:chamber asks; the Elevated context — which can — answers.

## Zero-space and admin-space (no user space)

The data:chamber is **zero-space**: unprivileged, cookieless, watcher-proof, capable only of what the
probe line grants it. The Elevated context is **admin-space**: the secure origin, the trove, the keys, the
git origin. **There is no user space between them** — nothing half-trusted. You are either in the clean
bunker asking, or in the elevated frame able to answer. That binary is the security model.

## The two deliverables (the coup de grâce)

1. **An offline git origin.** A **"git-enough" client in vendorless JavaScript** — enough of git to do a
   checkout and to stage/commit into `anecdote.channel`'s offline storage, and **deliberately not
   registered as a service worker** (see #2). It may **opportunistically omit operations we flatly reject**
   as possible against our custom offline origin; adding powers later is not against the ethos, it's just
   *not a problem* for a starting point.
2. **The data:chamber runtime.** `anecdote.channel`'s offline app sends you to a `data:text/html` URI and
   uses **every tool available to itself** to connect that tab to the **Trusted Resources** it needs at
   runtime — to be the **git client that transacts all files coming from the data:chamber's Blob cache
   shelving**, while also serving as the **mainline canonical runtime offline app environment.** (Not a
   service worker precisely because the chamber is a `data:` tab puppeted over the probe line, not a
   registered origin worker.)

## The optical layer: data QRs and code QRs

The QR research was always about the *no-DNS, no-store, no-network* first contact. The prototype proved an
`anecdote` build can be **a data payload that fits in a QR when byte-deflated** — not a scannable URL (it
doesn't scan conventionally, so it can't be mistaken for one). The QR payload **is the data:chamber
itself**, in `data:text/html`, byte-deflated, still leaning on DNS (or, once bootstrapped, on *esoteric QR
support packages*) for what doesn't fit — a **physical template cloneable by anyone who has the Elevated
context** to read it.

This suggests a real distinction:

- **data QRs** — your stuff / a document / a payload to take into a chamber.
- **code QRs** — canonical programs that can live in the Elevated frame and extend the offline toolset (and
  thus the probe API).

These esoteric QRs are a **physical layer of authentication**: they're for someone who decides not just to
scan, **but to be ready to scan** — an initial consent to interact the way the QR needs. A **v0 firmware is
already in the wild** (the prototype's QR build artifacts), which include themselves **recursively as the
favicon resource** — the reproducible fingerprint of *exactly what spawned this chamber*: what you scanned,
and a public key in it you'll recognize if you came from the Elevated environment.

The unsolved spark, historically: the QR alone was **turning a key with no spark** — it couldn't reach an
environment with extended custom code to puppet a camera API for bespoke handling. The Elevated context +
probe line **is** the spark: it takes the load off the QR's data-tank by delivering powers (camera/QR
decode, `crypto.subtle`, git) to the chamber over the message API. So DNS-first distribution makes the QR
the *resilient fallback*, not the bootstrap — exactly the layering DELIVERY.md already argues for the model.

## v0 prototype — `tiliv/anecdote` (recorded from the operator; not yet read here)

> Out of this session's granted repo scope, so captured from description, to be reconciled against the
> source. Its main listing reveals the hierarchy of concerns.

- A **two-step build system** that fabricates the QR prediction **into the thing it contains**; otherwise a
  **manifest of what the bootstrapper should fetch** — resources named and **signed by a prototype key**
  (hand-made, lean, focused, deliberately incomplete), served over DNS for now.
- Already has: the **blob cache layer**, a **widget content-type** concept, and **custom manifests that
  describe loading the agent**.
- Its initial (failed) job as a data:chamber factory: it **couldn't, alone, reach an environment with
  extended custom code** to puppet a camera API — the missing spark the Elevated probe line now supplies.

## Distributed resources — the shipyard's first stock

What the Elevated context hands a data:chamber to start:

1. **The same MiniLM the reducer already vendors** (`runtime/` + `reducer/model.lock.json`, hash-pinned,
   cold-loaded — see [`docs/DELIVERY.md`](DELIVERY.md) / [`reducer/README.md`](../reducer/README.md)). In a
   chamber this makes **label-reducing an offline, private power**: bring any document in from your offline
   git origin and the reducer helps you *read* it — perception, on-device, watcher-proof.
2. **The git-enough client** (deliverable #1) — vendorless JS, checkout + stage/commit against the offline
   origin, omitting the ops we reject.

## Broad-strokes contract (the invariants this milestone must keep)

- **The held copy is authoritative over the server.** A pinned first-contact signer; a later payload that
  isn't the same signer is refused; only same-key signed upgrades are accepted. The operator cannot push a
  silent replacement to a holder who doesn't want one.
- **The data:chamber is powerless by construction.** No cookies, no surveillance, no `crypto.subtle`,
  no ambient network it didn't ask for. Everything it can do, it does **only** via the Elevated probe line.
- **The Elevated context is the only privileged thing, and it is local.** It holds the keys, the trove, the
  git origin, and `crypto.subtle`; it vends powers down the line; it is *yours*, on your device.
- **No user space.** Zero-space (chamber) or admin-space (Elevated) — nothing in between.
- **Not a service worker.** The chamber is a puppeted `data:` tab, not a registered origin worker.
- **DNS-first, store-never, optical-eventually.** It must keep working for a holder when every distribution
  channel is gone.
- **The trove is Origin.** Your data is owned-in-the-first-place, proven, revocable — and it lives here.

## Open questions / the trilogy

- The exact **probe-line protocol** (which powers, how requested, how the Elevated context authorizes a
  chamber it spawned) — the message-API analogue of the postMessage tunnel we already built for ingress.
- The **git-enough op set**: the minimum to checkout + stage + commit our offline origin, and which ops we
  reject outright.
- **First-contact-from-QR** end to end (camera decode of the esoteric, byte-deflated QR; the
  data-vs-code-QR split; the recursive favicon fingerprint as the day-one signer record).
- **Revocability "with the right connectivity"** — the hat trick teased as part of a **trilogy of
  surprises**; recorded here as a pointer, not yet drawn.
