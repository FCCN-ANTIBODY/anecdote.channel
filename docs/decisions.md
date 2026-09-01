# Constellation decisions

The load-bearing architectural decisions for the whole constellation, and the **why** — so a new
session (or you after a break) can onboard without re-deriving them from memory. These are the
things that were expensive to arrive at and cheap to forget.

**Read this before designing anything cross-cutting.** When a decision is made or changed, record it
here in the same shape. Never silently contradict an entry — mark the old one *Superseded* and link
forward, so the trail of reasoning survives (the reasoning is the point; the conclusion alone invites
re-litigation).

Scope: decisions that span repos (anecdote.channel + tell / atlas / antidote / data-pile / civic-node
/ journal). Repo-local specifics stay in that repo's own docs; this is the shared map.

## Index

- **D1 — Environment-sourced identity.** Operator key material lives in the environment, never committed.
- **D2 — The glove.** Bottles deliver signed client code over the wire; consumers wear it, never vendor it.
- **D3 — The platform pin.** One canonical Anecdote identity verifies every bottle; env-sourced (D1).
- **D4 — Bottles topology.** `*.tell` = pile floors; `bottles.<apex>` = free-form; wildcard on the sub-sub-domain.
- **D5 — Mirror discipline.** Cross-repo shared code is byte-identical from one source of truth.
- **D6 — Boundary signer public half → environment-sourced.** `keys/boundary.fpr` removed; nothing pins it.
- **D7 — Bottle self-description.** Signed macro `kind` at inception; live descriptor as self-report; the map is a device-local book, explicit-save; deletion is enumerate-and-destroy.
- **D8 — Identity arrival.** The keeper vends the *capability*, never the secret; origin-bound at the hello; consent in the keeper's own UI; every vend chronicled.
- **D9 — The you namespace.** `<label>.you.<apex>`: masks and per-site dossiers, kept BY the user ABOUT the web; reading one is a consented embed anchored on the asker's attested origin (D8 reversed); identity stays the keeper's.
- **D10 — The bottles engine.** `bottles.<apex>` repo = the minting/signing machinery outlets mount; signatures cover the canonical payload, never the image container; the platform pin endorses outlet keys; receiving/browsing is D7's book, given a face.
- **D11 — The bottle storefront and intake.** A distributed bottle is an inert capsule at a flat path, trusted by signature not origin; a live bottle stays a D4 wildcard origin. Canonical takes in, mounted outlets give out. An embed is scoped to a named bottle — never the shelf.
- **O1 (open) — The delivery signer's committed public half.** `tell.fpr`/`pub`/`signers` under the D1 lens.

---

## D1 · Environment-sourced identity
*Status: accepted 2026-07-15*

**Context.** These repos are offline origins that also run on GitHub (Actions, or the offline Actions
emulation — see `docs/actions-enough.md`). They need identity material — private keys, and sometimes
just the public half — to do their jobs.

**Decision.** Operator-specific identity material is **never committed to the repository** — not the
private key, and not its public fingerprint. The repo ships an empty *slot*; the operator's
**environment** fills it: from the on-device offline origin (the authoritative, gesture/2FA
environment), mirrored into a GitHub Secret only when a job runs under Actions. A JS runtime reads it
from `process.env`; a static site (the Floor) has it stamped in at build from the same env var.

**Why.** Two properties fall out, and both are load-bearing:
1. **Forks stay clean.** A committed value is *your* identity; a fork inherits it, must notice and
   replace it, and fights conflicts pulling upstream. An empty slot forks with nothing to unpick.
2. **The repo is single-operator, and the operator is the device.** If identity lives only in the
   environment, the repo itself is inert: a GitHub collaborator who "walks up" gets a repo that
   cannot act, because being the operator is not a repo permission — it is holding the environment.
   This is the on-device-as-two-factor posture made structural.

Even a harmless *public* fingerprint is kept out, so the model's shape (identity-lives-in-env) stays
uniform rather than "secrets by env, public halves by commit."

**Consequence.** See D3 for the platform pin as the first slot converted, and D6 for the boundary
signer's public half. See O1 for the delivery signer's committed public half still under question.

---

## D2 · The glove
*Status: accepted 2026-07 (install grammar)*

**Context.** A storage engine (e.g. `git-enough`) must run inside a consumer (the Floor) without the
consumer vendoring the engine's code, and without the engine gaining the consumer's power.

**Decision.** An engine is a **powerless glove**. It delivers its client code to the consumer at
runtime as a **signed `install` manifest** over the probe; the consumer verifies every blob against
the platform pin (D3), mounts them as Blob URLs, and `import()`s the single named entry — borrowed
for the session, dropped on reload, **never committed or vendored**. The consumer vendors only its
*own* machinery (verify, mount, transport). "Load a blob and run it" stops being a hole because the
bytes are checked against the pin or they do not run.

**Why.** Keeps the engine canonical and updatable without every consumer re-vendoring it; keeps the
trust boundary at the signature, not at a git submodule; keeps the consumer's power its own.

---

## D3 · The platform pin
*Status: accepted 2026-07-15 (supersedes the "Tell key" and "committed constant/file" attempts)*

**Context.** The Floor's storage-adapter seam must verify the client an engine delivers. Which
identity signs, and where does the Floor get the key to check it?

**Decision.** The signer is the **one canonical Anecdote platform identity** — the module-loader root
of trust that signs *every* bottle's install and domain attestation. It is named once in
`composer/platform-key.mjs` (`PLATFORM_KEY`), which `verifyInstall` defaults to; downstreams that
cannot import it (the Floor, another repo) vendor it byte-identically (D5). The **value** is
environment-sourced (D1): the slot is empty in the repo and filled from the device / a Secret.

**Why — and the paths not taken:**
- *Not the Tell's own key.* Tell's office is **collection** (gathering poll answers into antidote;
  `keys/tell.fpr` is its delivery signer, which never signs installs). Signing the pile floors felt
  Tell-ish only because they sit on Tell's subdomain; it never generalized to the free-form bottles
  (D4). Anecdote — the one loading modules — signs them all. One office, not two.
- *Not a committed constant or `keys/*.fpr` file.* That records the device's identity into the repo —
  the fork/single-operator problem of D1. The pin is a slot the environment fills, not a value the
  repo holds.

Trust is *served-from-the-bottle* (the iframed canonical origin resolves — `bottle-attest`'s domain
anchor) **and** *signed-by-Anecdote* (the pin). Null until set → the adapter is inert (safe default).

---

## D4 · Bottles topology
*Status: accepted 2026-07*

**Decision.** The wildcard is on the **sub-sub-domain**. Grammar: `<label>.<storage>.<apex>`, where
`<label>` is the user-invented, isolated origin (the wildcard), `<storage>` is a provisioned
subdomain, `<apex>` is `anecdote.channel`.
- `*.tell.anecdote.channel` — **pile floors** (Tell's subdomain; Tell's office is collection).
- `bottles.anecdote.channel` — **free-form bottles**: arbitrary cubbies (user data, code blocks,
  storage engines like `git-enough`). Not Tell's to vouch for.
- A floor takes its role from the path: `/storage/.<adapter>` → storage consumer; anything else → the
  pile UI. Every wildcard path serves the one Floor template.

**Why.** One provisioned storage domain + an invented isolated label per origin, with no registry
(canonical names). Keeps engines shared/canonical while each `<label>` is its own hermetic origin.

---

## D5 · Mirror discipline
*Status: accepted 2026-07*

**Decision.** When two repos must share code that cannot be imported across the repo boundary (e.g.
the Floor vendoring `composer/*` modules), the copy is **byte-identical** to its single source of
truth, and its provenance is recorded (e.g. `floor/adapter/MIRROR.md`). One definition; the mirror is
re-copied verbatim when the source changes; consumers never re-invent or fork the logic. A deliberate
*subset* (e.g. `probe-client.mjs` = the consumer half of `probe-line`) is the only allowed exception,
and it is documented as such.

**Why.** Avoids two copies drifting into two behaviors — especially dangerous for crypto/verify code.

---

## D6 · Boundary signer public half → environment-sourced
*Status: accepted 2026-07-15 (resolves the boundary half of the former O1)*

**Context.** `keys/boundary.fpr` was a committed public fingerprint (`tell.anecdote.channel`) — the
boundary signer's public half, the same committed-public-half shape D1 questions. The motivation to
fix it: the same Tell code runs on many offline clients, and each must sign boundaries with *its own*
env key; a committed fingerprint bakes one operator's identity into shared code.

**Decision.** The boundary fingerprint is environment-sourced (D1), never committed. `keys/boundary.fpr`
is removed and gitignored; `bin/boundaries compile`/`bootstrap` no longer write or commit it.

**Why it was safe (the deciding investigation).** Nothing *external* pins `boundary.fpr` — an Atlas
ingests boundary artifacts verbatim and trusts each artifact's own signature, enforcing same-key
continuity itself (`atlas bin/dump.mjs`). So the fingerprint was only the operator's own
self-consistency check. `bin/boundaries check` now catches a signer swap by **internal consistency**
(every compiled artifact shares one signer — needs no key, so it still runs in a fork's CI) and, when
the environment names the identity (`TELL_BOUNDARY_FPR`, or derivable from `TELL_BOUNDARY_KEY`),
additionally confirms it is the operator's key. Strictly ≥ the old committed-file check for the
realistic (partial-swap) threat, with nothing committed.

**Contrast for O1.** This worked *because* boundary.fpr had no external pinner. The delivery signer is
different — see O1.

---

## D7 · Bottle self-description — signed kind, self-reported descriptor, a book instead of a registry
*Status: accepted 2026-07-25*

**Context.** Tools need to PICK bottles — the journal picking a data-pile, antidote listing what it
provisioned — but a label on a sub-sub-domain carries almost no information, nothing signed says what a
bottle *is* (code vs data vs a pile), and no map of created bottles exists at all ("an empty pit of
unknown addresses"). A global registry was repeatedly considered and rejected: it would break the
name-is-a-key property (D4 — the network puts nothing at either address, so two strangers at one name
never collide and a wiped name returns to mint condition).

**Decision — three layers, three trust treatments:**
1. **The KIND is a signed fact.** The inception attestation (`composer/bottle-attest`, the boot gate's
   anchor) optionally carries `kind` — one free string, the coarse "what this origin is" (`data-pile`,
   `storage-engine`). Signed by the platform key at inception: a picker can trust it *before*
   connecting, and a bottle cannot quietly become code when it was chartered as data. One macro kind
   covers polls and investigations alike — subtypes are never enumerated here.
2. **The DESCRIPTOR is a self-report.** The `describe` op (`composer/describe-op`, sibling of
   `install`; Rung 0, pre-crunched static bytes) vends a dated snapshot of what the bottle holds —
   questions/leads, input filters, counts, optionally its op surface. For skimming and sifting, never
   for trust; **subtypes stay emergent** — the descriptor's content is the taxonomy, no enum anywhere.
   **Empty is observable**: a fresh bottle ships a zero-count descriptor from inception, so "nothing
   here yet, as of <date>" is a statement, not an absence. Nothing runs in the background: the
   snapshot updates only when the owner re-crunches (staleness chosen and visible in `as_of`).
   Stats derivable from the *public* surface (question texts, sealed-block counts) may always ride;
   stats requiring *decryption* (answer distributions) are owner-side work and publishing them is a
   disclosure act, forward-only, in the `bin/prove` family.
3. **The map is the DEVICE'S OWN BOOK** (`composer/bottle-book`), never a registry: Elevated memory,
   explicit-save only (provisioning records what it made; the room offers "remember this pile on this
   device"), synced nowhere by default, read over the probe (`bottles.list` Rung 0; `bottles.save`/
   `bottles.forget` Rung 1). No ambient visit-tracking — a browsing history is creepy; a bookmarks
   shelf is consented.

**Deletion is enumerate-and-destroy.** Forget (the book stops knowing the name) and wipe (the room
tears down EVERY storage kind the origin can hold — vault, IndexedDB, caches, the service-worker
registration — so the name returns to mint condition and "might not be a data-pile anymore") are two
rungs of one gesture. Teardown enumerates the *platform's* storage surfaces rather than asking each
feature to clean up after itself — cooperative teardown rots; enumerated teardown doesn't care what was
stored. Teardown needs **no counterparty**: nothing was ever provisioned server-side for a name, and
the no-registry decision means there is no third place to scrub. "Know we can make a blank state" is a
test obligation, not a promise: blankness gets measured from outside the page (the harness, over CDP).

**Why this shape.** Splitting signed-kind from self-report keeps the trust boundary crisp (a bottle can
lie in its descriptor; it cannot lie about its charter), keeps subtypes emergent (the journalism pile
is just a data-pile whose descriptor lists anecdote-type filters — no coordination on names), and keeps
the map consistent with D4's no-registry stance by making memory personal, deliberate, and destroyable.

---

## D8 · Identity arrival — the keeper vends the capability, never the secret
*Status: accepted 2026-07-25*

**Context.** The room (`<name>.tell.anecdote.channel`) can now decrypt a delivered feed (feed-open in
WebCrypto) — but only if the pile's age identity reaches it. D1 says identity lives in "the
environment"; for a room nobody instantiated (the user typed a name), what counts as the environment?

**Decision.** The device's one keeper — the **anecdote.channel origin**, whose trove holds the
identity — is the environment, and it **never hands the secret down**. The room embeds the keeper as
an Elevated guest (the bottle-embed hello: the keeper is the capable child) and receives the
*capability*: the keeper pulls the sealed feed itself, verifies and decrypts it keeper-side, and
returns **plaintext frames for display**. The identity never crosses the port; the room — the least-
trusted code in the system, a wildcard-served dumb shell — never holds a credential of any kind.
Plaintext never *rests* in the room either (display-only, re-asked per session): the wipe story stays
trivially true and the room stays dumb.

**What is proven to get it — two things, neither a credential the room holds:**
1. **The asking origin, browser-attested.** At the hello the keeper reads the embedding parent's
   `event.origin` and binds the session's scope to it: the capability for pile `parks-2026` is offered
   only to the origin whose *name is that pile*. The name-is-a-key property becomes the authorization
   anchor. (Honestly stated: ports are technically re-transferable — the origin check happens at
   adoption, as in probe-line §2; the mitigations are tight scopes, `port.close()` revocation, and the
   chronicle.)
2. **The operator's consent, in the keeper's OWN UI.** The keeper iframe is visible and renders its
   own allow surface — a click in the keeper's origin the room cannot paint or fake. A session allow
   is a scoped, session-lived grant `{piles:[<name>]}` on the standard ladder; standing grants come
   via the grants panel later. The consent surface hardens further with the gesture gate.

**Every vend is chronicled.** The keeper appends each act — when, which pile, which op, which asking
origin, which grant — to its own hash-chained local log (freshness-not-secrecy applied to *key use*;
the `grantId` accounting hook already rides the probe-line terminator). The operator can audit every
use of their identity; an act that skipped the ceremony isn't in the log. Local only — the metadata
never leaves the device any more than the key does.

**No daisy chains.** One hop, no transitive reach: a tool that wants pile records makes its *own*
hello to the keeper, so the keeper always sees the true asking origin — forwarded requests would
launder the binding (the confused deputy). The chain to "where the secret is" terminates at devices
the operator holds: another device's keeper hands it across by the deliberate transfer gestures
(meet/QR), never an automatic fetch; a lost identity means an unreadable pile — the stated cost,
softened only by published `prove` checkpoints. The D1 slot has two fillings: the trove for the
offline origin, the GitHub Secret (`PILE_AGE_IDENTITY`) for the workflow mirror.

**Consequence.** The keeper page and its op catalog (`pile.read` / `pile.recipient` / `pile.adopt`)
live on anecdote.channel; the consumer core (`feed-open`/`age-open`, data-pile's `bin/` as source of
truth) is byte-mirrored into `composer/` under D5 with a drift guard.

---

## D9 · The you namespace — masks, and the dossier a user keeps about the web
*Status: accepted 2026-08-31*

**Context.** A user-account system has now been designed or built separately for two operator sites
outside this repo, and a third was about to start. Meanwhile D8 already fixed where identity lives
(the keeper) and D4 fixed the namespace grammar. Missing was the *user-side* namespace: where a user
keeps profiles — records kept **by** the user **about** any site on the web — without that site
knowing, and how a site that wants to read one is allowed to ask.

**Decision.** A provisioned storage subdomain **`you.anecdote.channel`** (spelled out, never `u`),
carrying the D4 grammar `<label>.you.<apex>`:

- **A single invented label is a MASK** — a persona surface the user curates and can switch at will.
  Recognizable the way a bottle is recognizable: one wildcard label, its own hermetic origin, and
  always findable-by-construction — if an account surface exists, it is on a routable DNS name, never
  behind navigation or cookie machinery.
- **A label that is a registrable domain, kept intact left-to-right** (`example.com.you.<apex>`), is
  the user's **DOSSIER about that site**: notes, drafts, cached finds, unreleased posts — out of
  band, on an address that never pings the subject. The familiar reading order is the point: the
  observant see exactly what happened, and that it is safe.
- **A label that is a bare TLD** (`com.you.<apex>`) is a mask over everything under that TLD — and it
  is also the **certificate seam**. A TLS wildcard covers exactly one label (`config/san-list.txt`),
  so `*.com.you.<apex>` is the single SAN entry that makes every `<domain>.com.you.<apex>` servable.
  TLD wildcards are demand-driven like every other wildcard in the SAN list: minted when occupied,
  never speculatively.
- **Depth stops at the registrable domain.** Covering `blog.example.com.you.<apex>` would take a
  wildcard per subject domain — unbounded, against the 50-host pack cap. Anything deeper is a path
  inside the dossier origin, never more DNS. (Rewriting deep names onto paths of one shared host was
  considered and rejected: TLS terminates before any rewrite runs, and collapsing profiles onto one
  origin destroys the very thing D8 authorizes against — a path is not an origin.)

**Identity here is D8, not a new system.** A mask origin is a wildcard-served dumb shell holding no
credential; the keeper vends capability. The passkey remains the gesture gate over the device's
Ed25519 identity and is **never presented** to anyone. Scope is a configuration, not code: WebAuthn
rpId may be the mask's full host (per-mask isolation) or a shared suffix (one identity across masks)
— `composer/gesture.mjs` already parameterizes it. Derived per-context secrets come from the
credential's PRF extension, not from moving the key.

**Reading a mask is a consented embed, on our terms.** No site can *address* a mask — it does not
know the label; only the user's outer tooling does. The user places a mask in an **active slot**; a
consenting site reads it by embedding our surface (the clean-room/probe posture), and at the hello
the browser attests *their* `event.origin` to us — D8's name-is-a-key anchor, reversed: the
capability "the dossier about X" is offered **only to the origin whose name is on it**. Each mask
serves its own CSP, so `frame-ancestors` is the user's per-mask allow/deny list of who may even ask.
Anything revealed from a dossier is a forward-only disclosure act (the D7 `prove` posture) and
carries the user's license at the point of delivery.

**Posting inverts.** A "post" lands first in the user's own canonical store; the site learns of it
only when the user marks it discoverable, and reads it through the embed above. Conventions for where
released things live (`posts.yaml`, or whatever the ecosystem settles on) stay **emergent and
user-side** — D7's no-enum stance again: providers read where users publish; they do not dictate
schema, and a user who keeps things on an unadvertised label has published nothing that can be asked
for.

**The machinery is an engine.** The same you-engine that serves this namespace can be mounted by an
outside site to serve `you.<their-domain>` — a real account system on their own registrable domain,
passkeys under their own rpId, joining the convention with `you` leftmost. Designed blind to its
consumers: capability, never customer.

**Why.** One account system instead of three; profiles that cannot be hidden from their owner or
discovered by their subject; the subject site controls nothing (D8); and the trust story reuses
decisions already paid for rather than minting new ones.

**Amendment 2026-09-01 — two implementation constraints found after acceptance.** Neither changes the
decision; both change what has to be built before it works.

1. **A `you` mount is a different origin, and every `'self'` in a mounting site's CSP refuses it — in
   both directions.** `'self'` does not cover subdomains. A node whose policy is written in `'self'`
   terms will refuse the mount silently, which is the worst way to find out. Relatedly, a declared
   directive does **not** fall back to `default-src`: a policy naming `frame-src` without `'self'`
   cannot frame its own documents either. Both want one deliberate policy decision per mounting site
   rather than a directive edited per symptom.
2. **The label freedom sits on top of exactly one RP ID decision.** Masks are free-form, plural and
   disposable; the WebAuthn RP ID beneath them is single, and can only be the origin or a registrable
   parent. That one choice decides where an account works at all — including whether a signing gesture
   performed at the node origin is the same identity as one performed at the mount. Settle it before
   the label design hardens; it is not a detail that follows from the naming.

**Discovery without decorating DNS has a precedent already shipped.** A sibling operator site serves
`docs/.well-known/manifest.json` with a detached `manifest.sig`: a signed document at a well-known
path that names DNS as a *candidate* rather than carrying configuration in DNS records, templated
per-mount from the site's own canonical name. That is the shape the `you` mount should advertise
itself in — signed-document discovery, the same primitive D10's endorsement chain already uses, and
no new cryptography (invariant #8). The civic node currently being prototyped against serves no
`.well-known` path at all, so that is a prerequisite there, not an assumption.

---

## D10 · The bottles engine — minting, signing, and the outlet chain
*Status: accepted 2026-08-31*

**Context.** The bottle's carried form has settled: a stacked, zero-delay-frame QR animation at
unscannable scale — the capsule. Kept as received, it is the proof of the original; only a fresh edit
regenerates it. Outlets outside the constellation are preparing to distribute bottles of ejected
pieces from marketplace-shaped hosts (`bottles.<their-domain>`), and need the minting machinery
without hand-rolling it. Until now `bottles.anecdote.channel` existed only as the D4 DNS fact, and
the receiving side of bottle life (naming, remembering, browsing) had no code home.

**Decision.**
1. **The repo `bottles.anecdote.channel` becomes the bottles ENGINE**, owning the domain's fact the
   way `tell.anecdote.channel` owns `*.tell`. It is build machinery in the journal-engine mold —
   workflows and composite actions a distributor repo mounts to mint, sign, and publish bottles —
   kept as a declarative pipeline the offline origin can read and mirror. This is the CI layer only:
   **runtime client code still travels solely as the D2 glove.** The engine never becomes a second
   path for delivering executable code, or D3's trust seam forks.
2. **The signature covers the canonicalized PAYLOAD, never the image container** (invariant #7:
   `defaultHash(canonicalize(signed))`). The frame stack — WebP, PNG, or GIF, deliberately still
   open — is presentation; image encoders are not deterministic across tools, so a container-byte
   signature would break on any transcode. The received container keeps its own content-id, and
   *that* is what "unedited since I got it" means. Authorship survives re-encoding; the capsule stays
   load-bearing proof; the format choice stays free.
3. **An OUTLET signs its own bottles with its own key; the platform pin ENDORSES the outlet key.**
   The endorsement is a platform-signed statement of the outlet's public half (allowed-signers shape
   — invariant #8, no new cryptography), and it is committable because it is signed *content*, not
   identity configuration; every private key stays in its holder's environment per D1 (device trove /
   Actions Secret). **An unendorsed outlet is a metadata signal, not a failure** — someone else's
   net; verify-from-anyone, trust decides action, not admission (invariant #2). D3 is not
   superseded: the pin remains the one root; endorsement is how it scales past first-party signing.
4. **Receiving and naming is D7's book, and the engine gives it a face.** No registry, and no label
   prompt fired mid-catch: a received bottle is saved into the device's own bottle-book under the
   receiver's label, while its origin and charter ride in its own attestation (`bottle-attest`,
   signed kind) — collisions are impossible by construction, and "what is this?" is answerable
   before trusting it. The browsing surface for the bottle system lives with this engine and reads
   the book over the probe (`bottles.list` / `bottles.save` / `bottles.forget`) — the "system
   browser" job, done by the method D7 already ratified instead of a parallel tracker.

**Why.** Outlets get batteries-included distribution with the trust seam in the right place —
endorse keys, not hosts — while the capsule's proof property and the no-registry stance survive
contact with a marketplace. The last unowned layer of bottle life gets a home consistent with every
prior decision.

---

## D11 · The bottle storefront and intake — the capsule travels, the shelf never enumerates
*Status: accepted 2026-09-01 (refines D10; does not supersede D4)*

**Context.** D10 settled minting and signing. What it left open was the *interface*: how an outlet
serves the bottles it distributes, and what happens on the receiving device when one arrives. The
storefront the operator wants is a flat list of downloadable labels — "this is what it means to be a
website, because I can give you stuff" — which does not look like D4's wildcard-per-origin grammar at
all. Reconciling the two is the work here.

**Decision — a bottle has TWO forms, and only one of them needs an origin.**

1. **A LIVE bottle is a D4 origin.** `<label>.<storage>.<apex>`, iframed, running a probe, vending ops
   behind the consent gate (`git-enough/bottle.mjs`). Hermetic because it *executes*. Unchanged.
2. **A DISTRIBUTED bottle is an inert CAPSULE at a flat path.** A mounted outlet serves
   `bottles.<their-domain>/<label>` — no file extension, the label is the whole address, and what sits
   there is the zero-delay QR frame stack (a folder may back it; only the label is public API). Nothing
   executes, so nothing needs isolating: **trust rides on the signature, not on the origin** — which is
   precisely what D10 bought by signing the canonicalized payload rather than the container. The
   capsule can therefore travel through an untrusted storefront and still be verifiable on arrival.
   The engine's default shape is a `bottles/` folder that deploys to that subdomain; an outlet is free
   to make it a project of its own instead.

   This does **not** loosen D4. D4's wildcard exists to isolate origins that *run code*; a storefront
   is a directory of downloads. Two grammars because there are two jobs — and the only bridge between
   them is a signature, which is the property that makes the bridge safe.

**Canonical and mounted are asymmetric.** `bottles.anecdote.channel` is the intake — where a scanned
capsule lands, where a long import shows progress, where the device's collection lives. A mounted
outlet is the outgoing storefront. Same engine, opposite direction; the canonical instance is not
merely the first customer.

**Getting started is a vanilla control QR** — a standard, unsigned code pointing at
`bottles.anecdote.channel`, carrying no more than the address it needs to. It bootstraps a device that
has nothing yet; it is not a trust anchor and must never be read as one.

**An embed is scoped to a NAMED bottle. The shelf is never enumerable.** External embedding is already
the bottle pattern (`git-enough/bottle.mjs`: "a tool iframes the bottle... and talks to its probe"), so
an outlet asking to embed is not new. What *would* be new — and is refused here — is embedding the
**collection**: `bottle-uri.mjs` already states the rule for the floor's adapters, that a surface
"never ENUMERATES... (that would solicit 'which apps do you have' — a leak); it only answers 'give me
THIS one'." The same rule governs the shelf. An outlet embeds to ask after **the bottle it already
named**; it never receives, and cannot probe for, the set of bottles the device holds. The asking
origin is attested at the hello and the embed is visible (D8), so a silent frame cannot stand in for
consent. Referral context is therefore a *consequence* of the outlet naming its own bottle, not an
extra disclosure the user makes.

**Name collision on intake is resolved by a REF, and it taints the name, not the artifact.** Labels are
free-form and distributors are strangers, so two bottles may arrive under one name. Because a bottle's
store is a git repo and `git-enough` already carries arbitrary refs (`fastForward`, per-ref commit),
the second arrival lands on a **new branch** rather than overwriting or being refused — which also
covers the benign case, a new version of the same bottle. The name is thereby marked as no longer
single-provenance, deliberately: it is one repo, and that is visible. Each capsule keeps its own
content-id and signature on its own ref, so **what the collision costs is the name's cleanliness, never
any artifact's proof.** The receiver may instead take a shallow copy or choose a different label. No
registry is consulted, and none is created (D7).

**Cold storage is a real limit, stated rather than assumed.** Large bottles must be able to leave hot
storage for the device's own filesystem, reachable again only if the operator hands back a handle. That
model — a persisted directory handle — is **Chromium-desktop only**; Safari and iOS have the
origin-private filesystem (already anticipated as the `/storage/.opfs` facet) but no re-openable handle
to user-visible storage. On those platforms the honest degraded path is a one-way export the operator
re-imports by picking the file again. Design the eviction gesture so the handle is an optimization, not
a precondition; verify current platform support before this becomes load-bearing.

**Consequence — three concrete gaps this opens in existing code, none fixed here.**
`composer/bottle-book.mjs` keys entries by a host matched against `/^<label>\.<storage>$/` — exactly
two labels — and `composer/bottle-uri.mjs` hardcodes `APEX`. Neither can express a bottle held at a
third-party outlet, so mounting the engine elsewhere requires admitting a foreign apex in both. And
`isSlug` permits `storage` as a label, which would let a storefront path shadow the
`/storage/.<adapter>` load condition; it should be reserved.

**Why.** The storefront the operator wants and the isolation D4 requires turn out not to be in tension
once the capsule is understood as an artifact rather than an address — and the signature D10 already
put on the payload is what lets it cross. Meanwhile the two instincts that felt like open questions
(squeamishness about being iframed; worry about naming collisions) were both already answered by rules
this constellation had written down for other reasons.

---

## O1 · (open) The delivery signer's committed public half
*Status: open — narrowed 2026-07-15 (the boundary half is resolved by D6)*

D1 says operator identity material lives in the environment; D6 moved the boundary signer's public half
there. The **delivery signer** (`keys/tell.fpr` / `tell.pub` / `tell.signers`) is the remaining committed
public half — but it is *not* the same case: a **data-pile pins it** (copies `tell.signers`/`tell.fpr`
into its own `pile.yml`), so the committed file is a genuine **publication channel** for external
verifiers, not just the operator's self-consistency. Moving it to the environment means giving piles
another way to *discover* the Tell's key (a deployed artifact / published endpoint) instead of reading
it from the repo. Open question: build that publication channel and env-source the delivery signer, or
accept its committed public half as a deliberate exception (it is per-node, so a fork re-keys it anyway).
Decide before adding any *new* committed key material.
