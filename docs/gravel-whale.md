# The whale — large cold payloads over gravel, and the vault

> Status: **shaping note** — companion to [offline-transfer.md](offline-transfer.md) (gravel) and
> [single-attention.md](single-attention.md). The transport primitives this leans on are **built and
> tested** ([`composer/fountain.mjs`](../composer/fountain.mjs), [`composer/carrier.mjs`](../composer/carrier.mjs),
> [`composer/transfer.mjs`](../composer/transfer.mjs), [`composer/meet-carrier.mjs`](../composer/meet-carrier.mjs)).
> What is **not** built: streamed (out-of-RAM) reassembly, a **vault** storage adapter, and the receiver as a
> bottle. Names **whale** (an oversized cold payload), **vault**/**cellar** (user-owned cold storage), and
> **gravel-catcher** (the receiver bottle) are proposed here, not yet in code.

## The problem in one line

Some payloads are too big to ever sit in a bottle — a multi-gigabyte model that would monopolize the shared
storage quota, never fit in RAM, and blow the wasm32 4 GB address wall if you tried to hold it. gravel already
moves bytes offline over QR-video; it does **not** yet move a *whale*. This note is how it does, without any of
the whale ever resting in a bottle or living in memory at once.

## First principle: sharding is a memory-loading problem, not a transport problem

The instinct to cut a whale into uniform blocks is the wrong order of decisions. **The way the payload is
*loaded into memory to be used* has to pick the shard boundaries — not the carrier, not a round number.** A cut
that lands in the middle of a load-unit forces you to page in two shards to compute one thing, and it lets a
single indivisible unit quietly exceed your memory budget. Memory-first inverts it:

1. **Fix the working-set budget first.** The most bytes you can hold resident at once — a few hundred MB on a
   phone, and hard-capped by the **wasm32 4 GB address ceiling** regardless. This number is an *input* to the
   sharding, not an outcome of it.
2. **Choose logical shard boundaries to match the loader's access pattern.** For a model that means
   tensor/layer-aligned cuts, read straight from the payload's own header (safetensors: an 8-byte length + a
   JSON table of `{name → dtype, shape, byte-range}`; GGUF: the same idea). "Pull tensor X" becomes one
   contiguous range. **No single load-unit may exceed the budget** — anything that does (a giant embedding
   matrix) is **tiled**, and that tiling is the *only* reason to repackage/fork the artifact: a precise trigger,
   not a default.
3. **Let transport shards nest underneath.** Small, uniform, fountain-coded for the noisy QR channel — sized so
   a run of *whole* transport shards composes a logical load-unit with no partial-shard waste.

## The whale is a multi-member layout — gravel already has the two tiers

gravel's constellation is exactly this two-tier structure, and we do not need to invent a "shard VFS":

- A layout **member** — coarse, individually content-hashed, independently verifiable
  ([`carrier.mjs`](../composer/carrier.mjs) `carrierSession`, hash re-check at reassembly) — is the natural home
  for **one load-aligned working-set unit.**
- The fountain **block size `B`** ([`fountain.mjs`](../composer/fountain.mjs), default 256 B) is the **transport
  granularity within a member** — the rateless droplet unit that heals over a bad camera.

A test already proves members can be heterogeneous and independently sized:
[`carrier.test.mjs`](../composer/carrier.test.mjs) — *"a MIXED set: one member arrives as bricks, the other as a
fountain stream — same layout, both attested."* So:

> **The memory problem picks the member cuts. The transport problem is already solved below that line.**

A 5 GB whale is therefore a **signed layout of N member-shards**, each member sized to the working-set budget,
each its own bounded fountain. Each member: reassembles in bounded RAM → verifies against its own hash → spills
to the vault → frees. The layout is the manifest that attests the whole set and gives resume-at-shard
granularity.

## Classify from anywhere: what the wire already tells us, and the one gap

The intake must decide *this is a whale, it goes to cold storage* from **any** entry point in the stream (you
may start scanning in the middle; the payload is not chronological). Two of the three signals are already on
every frame; the third needs a one-line change to the sender.

- **Size — already on every droplet frame.** The droplet grammar carries `L` (total byte length) in cleartext:
  `AC1|d|<layoutShort>|<memberId>|<K>|<B>|<L>|<seed>|<sum8>|<xor>`. **The whale-detector rides the wire today.**
- **Identity — already on every frame.** `memberId` is the SHA-256 of the canonical envelope: dedup, resume,
  and reconciliation key, catchable immediately.
- **Kind (data vs code) and the signed attestation — the gap.** These live in the *envelope*, which only exists
  after reassembly — for a single standalone payload you cannot read `kind` early. But the **layout tile**
  carries `members:[{hash, kind}]` and the shape, and a test proves it classifies early:
  [`carrier.test.mjs`](../composer/carrier.test.mjs) — *"the layout tile alone yields the expected shape
  (count=2) BEFORE any member decodes."* And [`meet-carrier.mjs`](../composer/meet-carrier.mjs) `meetFrames().burst()`
  already **re-emits the layout tile on every pass** (`out = [tile.frame, ...droplets]`) — a true manifest
  carousel.

**The fix:** the standalone billboard ([`carrier-loop-demo.html`](../composer/carrier-loop-demo.html)) pours bare
droplets with no layout tile. Have it **always emit a one-member (or N-member) layout and carousel the tile** —
the `meetFrames` pattern, reused. Then the signed `{hash, kind, size, shape}` is catchable from any entry point,
which is the manifest carousel the intake needs.

## Where the whale rests: the vault, never the bottle

The receiver's own origin gives clean isolation from *other* bottles' data, but **not a separate storage
ceiling.** Per [civic-node `docs/TENANCY.md`](../../civic-node/docs/TENANCY.md): *"every chapter sharing the
canonical multi-tenant host also shares one browser storage quota group (browsers group by registrable
domain)."* So every `*.bottles.anecdote.channel` label draws from the one `anecdote.channel` pool. "Carve out the
whole buffer" is therefore a mirage — and unnecessary, because **the whale never rests in a bottle.**

- **OPFS is a bounded conveyor, not a vault.** The receiver origin holds only a few shards in flight plus the
  tiny manifest. (Today the only OPFS use is the read-only enumerator
  [`viewer/enumerators.mjs`](../viewer/enumerators.mjs); `createSyncAccessHandle` / `showSaveFilePicker` /
  `showOpenFilePicker` appear **nowhere** in first-party code — this is net-new.)
- **The vault is user-owned storage** — the OS Downloads folder (stream a completed shard out as a short,
  robust download) or, on desktop Chromium, a picked directory handle persisted in IndexedDB. On mobile the
  real-FS pickers do not exist; OPFS-conveyor + downloads is the path.
- **Read-back is a re-pick, not a copy.** A file handed back via `<input type=file>` is a lazy reference —
  `Blob.slice(start,end)` is a true range read, so the seekable reader works over it with zero copy. The bytes
  never re-enter the origin's quota. Desktop persists the handle (one permission tap); mobile re-picks per
  session, which is nothing against a month-long compute.

This is the **librarian, not owner** stance: the browser will not give the app a vault, only broker the user's.
The user gesture is the mechanism, not friction to remove.

## The stub: a cold-store receipt

What the target bottle holds is **not** the bytes — it is a stub: a content-addressed **receipt** that points at
a vault file needing re-pick. This extends an existing, partly-built idea rather than inventing one:
[anecdote-schema.md](anecdote-schema.md) §"everything else rides as a receipt" defines a `ref` = a content hash
(`sha256:…`) + a source + an optional pile pointer, with the builder in
[`composer/anecdote.mjs`](../composer/anecdote.mjs). A **cold-store receipt** is a `ref` whose source is
"user-vault, re-pick required," plus the shard manifest. When a bottle opens the stub, its UI conceit is: *point
me at the file to resume* — and how long it lasts is on the user.

## The gesture is the crown, generalized

The privileged, foreground, single-focus gesture that gates the whale's promotion **already exists in code**:
[`git-enough/held-token.mjs`](../git-enough/held-token.mjs) `makeCrown()` — *"a held gesture (foreground,
single-focus). A boolean you take up on purpose."* Today `credentialFor(crown)` gates git push (*"the crown is
down — a push needs you present"*). The platform-wide version is [single-attention.md](single-attention.md)'s
"stick" (explicitly unbuilt).

The staging→vault boundary is the same kind of boundary a push is: committing real device storage, transacting
data with someone on purpose. So **generalize the crown to authorize vault promotion.** Decode-and-heal into the
bounded conveyor is unprivileged and runs freely; **crossing into the user's durable vault is what the crown
signs** — in batch, with a legible manifest-derived description (size, source, kind, shape) so one gear-tick
signs many, which is the crown's whole premise.

## Trust and admissibility — the hostile case

A whale forces a decision the rest of gravel never has to make: you must **commit resources (storage, camera
time) before you can verify anything**, because you stage gigabytes as they stream, long before the complete
signed envelope exists to check. Getting this wrong is the one way intake can be attacked, so it is settled here
rather than left open.

**Split the word "trust" into two authorities it quietly bundles:**

- **Shape is signed *sender*-authority.** The layout's member boundaries and sizing are the sender's to declare,
  signed in the layout tile. You trust the shape *only for reconstruction*, and *only after* the signature
  verifies. A lying or wrong shape cannot corrupt you — it can only **fail** (members won't reassemble, or the
  whole-payload hash won't match). So there is nothing to negotiate about the shape: verify, then rebuild.
- **Budget is *receiver*-authority, and is never delegated to the manifest.** The manifest *proposes* a size
  (`L`); the crown *grants* a budget. Admission is `declared L ≤ granted budget`, and then you **allocate against
  verified bytes, never declared bytes** — a manifest claiming 900 GB cannot make you reserve 900 GB, only make
  you refuse. This is the whole answer to "trust the envelope or make it negotiate": you do neither for
  resources.

**This adds a third gate in front of gravel's existing two.** gravel already keeps `ok` (authentic + intact,
*verify from anyone*) apart from `trusted` (signer on your local friend-list, *should you act*) —
[offline-transfer.md](offline-transfer.md). Whales add **`admissible`**, which runs *before* either, on
declared-but-unverified data, so it must be defensive:

1. **Admissibility is consented, not demanded** — the crown grants the resource budget at intake; the manifest
   never sets it.
2. **Allocate against verified bytes only** — per-shard `intact` hashing means a lying or corrupt shard is
   dropped, not staged; exposure stays bounded to the conveyor (a few shards) at all times.
3. **Trust, learned early, scales the budget** — and this is why carousel'ing the signed layout tile is a
   *security* feature, not just a classification one. The tile is a small signed object caught from any entry
   point, so the *signer* is verifiable before the bulk is committed: a friend's whale gets a generous default
   budget; an unknown or unverifiable signer's whale gets a minimal one, or an explicit *"this is anonymous —
   how much will you spend?"* crown grant. That is the "installing something anonymous" instinct, made
   mechanical.

**The byte/execution boundary is the safety story.** A whale at rest is always **inert** — the danger is never
the bytes, only the transition to code. A hostile whale can at worst waste storage and camera time you already
consented to spend; it **cannot execute**, because data→module is a separate, signed, crown-gated door (the
glove D2, signed `kind` D7). So the receiver's rule, which it cannot get wrong: **admit inert data freely within
a consented budget; let nothing become code without a trusted signature and the crown.** An anonymous big file
is admitted as inert and **marked** (`untrusted`/`anonymous` on its cold-store receipt); it simply has no path to
doing anything — the start of something malicious never gets its second step.

## Data vs code is already born — the receiver just sorts on it

The receiver's job is to sort what arrives, and the distinction it sorts on is **already a signed fact**, not a
thing to invent: [`bottle-attest.mjs`](../composer/bottle-attest.mjs) bakes `kind` into the signed inception
(*"a bottle cannot quietly become code when it was chartered as data"*, decision D7), and the envelope's `kind`
field uses the same vocabulary. So intake branches on the signed `kind`:

- **`kind: data`** → vault + cold-store stub (this note's path).
- **`kind: module`** → a candidate bottle. Today a received module becomes a Blob + download link — *"seeable,
  not privileged; nothing installs or runs"* ([`carrier-catch-demo.html`](../composer/carrier-catch-demo.html)).
  Auto-provisioning it into a live bottle (inception → boot) is a real, separate stand-up, correctly gated
  behind the crown and the glove (D2). Inert during load; a content-type only after verification.

## One receiver bottle, transfers namespaced by hash

The receiver should be its **own** bottle (own origin = clean scratch, boots from the same floor template as
everything it delivers — which is what proves "load it all out of a bottle"). It should be **single-instance**,
not multiply-loaded, for three grounded reasons: the shared quota group means multiple receiver bottles buy
*namespaces, not capacity*; the camera + decode loop is a single serialized resource (two receivers contend for
one camera); and single-instance is the house style (crown / single-attention). Concurrent transfers are
separate objects **namespaced internally by `memberId`**, not separate origins.

Throughput, then, is not won by more bottles — the bottleneck is camera capture + decode. The real lever is
**more recognizable payload per captured frame** (denser or multiplexed tiles), an open question below.

## Reuse / modify / stand-up

**Reuse as-is:** vendorless QR codec ([`qr-decode.mjs`](../composer/qr-decode.mjs) — exists *because*
`BarcodeDetector` is absent on iOS Safari), fountain + carrier session, envelope/block/layout schemas, signed
`kind` (D7), the glove (D2), bottle addressing + floor + SW + iframe/port mesh
([`bottle-embed.mjs`](../composer/bottle-embed.mjs)), the crown, the `ref`/receipt builder.

**Modify (small):**
1. Standalone sender always emits + carousels a layout tile (early classification).
2. Reassembly expressed as a multi-member layout so each shard reassembles → verifies → spills → frees, instead
   of the current whole-payload in-memory `Uint8Array` ([`carrier.mjs`](../composer/carrier.mjs)).
3. Extend `ref`/receipt into a cold-store (re-pick) receipt.

**Stand up (net-new):**
1. **gravel-catcher bottle** — [`carrier-catch-demo.html`](../composer/carrier-catch-demo.html) packaged as a
   signed, single-instance bottle.
2. **vault adapter** — a new `<slug>.bottles.anecdote.channel` (sibling to the named-but-unbuilt `.opfs` in
   [`bottle-uri.mjs`](../composer/bottle-uri.mjs)): OPFS bounded conveyor + downloads-stream + File System Access
   re-pick, exposing a seekable `read(offset,len) / stat()` surface. The bottle behind the stub does not know
   which backend served the bytes. *Core skeleton built and Node-tested — [`vault/vault-store.mjs`](../vault/vault-store.mjs)
   (the seekable shard VFS with a memory-bounded working set), [`vault/admit.mjs`](../vault/admit.mjs) (the trust
   model above, in code), and the glove halves [`vault/vault-client.mjs`](../vault/vault-client.mjs) /
   [`vault/probe-ops.mjs`](../vault/probe-ops.mjs). Still stubbed: the real OPFS/Downloads/File-handle backends
   and the served, signed bottle (inception + boot).*
3. **Streamed reassembly** — member-at-a-time spill (leverages the multi-member layout above).
4. **Crown → vault-promotion** generalization.
5. **Format-adapter** (safetensors/GGUF seek) — read-time, later; the compute (WebGPU where present incl. iOS
   Safari, wasm-SIMD fallback) is downstream of loading and out of scope here.

## The smallest demo that proves the thesis

Package the gravel-catcher as a bottle; receive a **multi-member layout**; spill each shard to a
downloads-backed vault via the new `.vault` adapter; leave a re-pick stub in the target bottle — with a payload
big enough to prove it never lived in RAM or in a bottle's OPFS. That exercises every reused primitive and both
net-new pieces end to end.

## Open questions

- **Denser frames.** Is the throughput win in bigger QR versions, multiplexed tiles-per-frame, or a different
  visual code? The bottleneck is capture+decode, not the channel.
- **Member sizing policy.** *Settled in "Trust and admissibility": the sender declares the member shape (signed
  in the layout); the receiver decides the resource budget at intake (crown-granted).* What remains open is the
  narrower mechanic: how the receiver *measures* its own working-set budget on a given device — a probe at first
  run, a conservative default, or a value the user sets — and whether that number surfaces in the vault adapter's
  `stat()` contract.
- **Verify-don't-trust the manifest.** *Settled in "Trust and admissibility": shape is trusted only for
  reconstruction after the signature verifies; budget is never delegated to the manifest; allocate against
  verified bytes; trust-of-signer scales the admissibility budget.* Remaining: the exact default budgets for
  trusted vs. anonymous signers, and whether an anonymous whale is refused outright or admitted inert-and-marked
  by default (this note leans **admit-inert-and-marked**).
- **Persistence.** `navigator.storage.persist()` is unused today; the conveyor origin is the one tenant that
  should request it. iOS quota grant for multi-GB is unproven — measure per-device before relying on it.
