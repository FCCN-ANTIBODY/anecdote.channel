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

**Built (the offline app shell).** [`sw.js`](../sw.js) + [`manifest.webmanifest`](../manifest.webmanifest)
make the served origin *held*: on first visit the service worker precaches the minimal shell (the
answer-a-poll runtime `poll.html` + its probe-line/consent/sign module graph, and the mint+sign operator
tool `qr-mint-demo.html`), then serves **cache-first**, so anecdote boots with the origin unreachable. The
heavy ~48 MB on-device model is *not* precached — it's cached on-demand on first use — so install stays
fast while the core flows (answer, mint, sign, publish) hold offline. **This resolves the open "name the two
load paths" delta:** the *shell* uses a SW (`sw.js`); the powerless **data:chamber never is/uses one** (it
stays a puppeted `data:` tab over the probe line) and **git-enough stays a normal module, never the worker** —
the "not a service worker" invariant is chamber-scoped, and honored. The Cache-API shell (code) is a
distinct layer from the IndexedDB trove/blob store (your data); the SW never touches your data.
**Chromium-verified offline:** with the browser offline and *zero* origin hits, `poll.html` boots and
composes a reply, and the operator tool mints a QR whose signature real `ssh-keygen -Y verify` accepts — so
answering and Tell-minting both work with no connection.

**Built (the firmware-pin machinery — the possession guarantee, slice 1a).** [`composer/firmware.mjs`](../composer/firmware.mjs)
is the trust root that "locks the hatch": a signed **`anecdote.firmware/v1`** manifest names the shell's
files by content hash + a monotonic version, signed with a firmware Ed25519 key (`sign.mjs`'s `attest` —
canonical-JSON, so it verifies with WebCrypto inside a SW). `pinDecision` is the **trust-on-first-contact**
rule: pin the signer at first contact; thereafter **accept only same-key, forward-moving** manifests —
a different signer is refused *even at a higher version* (a possessed origin can't swap what you hold), and
a validly-signed older version is refused too (no downgrade/replay). `verifyFiles` confirms the served bytes
match the manifest hashes (a carrier can't swap bytes under a valid signature). The operator arms it with
their own key via [`composer/firmware-cli.mjs`](../composer/firmware-cli.mjs) (the ceremony: hash the shell,
sign `firmware.json`, **hold the key — never commit it**); with no `firmware.json` deployed, pinning is
dormant and the shell falls back to its static precache, so this is opt-in. This same verify-a-signed-
payload-and-decide-locally machinery is what **offline data transfer** ("gravel") reuses to accept data from
any carrier (QR, peer, mesh) — DELIVERY.md's "verify the bytes, accept them from anyone."

**Built (the SW enforces the pin, slice 1b — the guarantee is live).** [`sw.js`](../sw.js) is now a module
service worker that enforces the pin. On install it holds the fallback shell, then `checkFirmware()` fetches
`/firmware.json`, runs `pinDecision` against the fingerprint kept in IndexedDB, and — only if accepted —
re-fetches the manifest's files, `verifyFiles` (hash-checks the bytes), and commits them to the shell cache.
A **foreign-signed** or **downgraded** manifest is refused and the held shell is kept untouched; a page
re-checks on load (best-effort — it fails gracefully offline without blocking boot) so a **same-key
roll-forward** is adopted on a later visit. (The holder's explicit "accept the roll-forward" consent lever is
the remaining refinement; dev auto-accepts same-key, per the roll-forward-consent stand-in above.)
**Chromium-verified end-to-end:** first contact pins signer A; a **possessed origin serving a B-signed
manifest is REFUSED** ("signer ≠ pinned day-one key") and the pinned shell survives; a genuine same-key,
higher-version manifest **is adopted** — and offline boot still holds (poll.html boots, a QR mints and
verifies with real `ssh-keygen`) with the origin dead. The residual, by design: the SW *script itself* is
fetched from the origin on update, so pinning the SW code from a possessed origin is the **optical/QR
firmware**'s job (the recursive-favicon fingerprint / code-QRs), anchored on this same trust root — which is
also the on-ramp to **offline data transfer** (verify a signed payload from any carrier, decide trust locally).
The full analysis of this residual — why the browser makes it unpreventable, the defense-in-depth
(gesture-gated keys so a swapped worker can't act as you; loud out-of-band notification; the optical
origin-bypass) — plus the consent-as-platform-gesture model, the "cracked judge," and the tamper-evident
authority journal (where even a deletion leaves a scar), is in [consent-surface.md](consent-surface.md).

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

## v0 prototype — `tiliv/anecdote` (reconciled against a source snapshot)

> Read from a snapshot the operator provided (the live repo is out of this session's git scope). The
> README states five need-layers: a long-lived QR+Aztec that loads signed resources with a public key; a
> network-free label-reducing mobile LLM; query privacy; community-documentation TTL workflows; live
> passive polling with implicit moderation. The seams the milestone needs are **already present in
> embryo** — Origin is mostly *naming and hardening* them, not inventing them.

**The build chain (`bin/build.sh`)** is the "fabricate the prediction into the thing it contains":
copy-vendors → minify `_data/payload.js` → Jekyll build (standard `_site`) → **Jekyll build the QR
variant (`_site_qr`)** → `sign-manifest.js` → `make-bytes.sh` (→ `index.qr.bin`) → `make-permatank.mjs`
(the **Aztec "permatank"** — CBOR-framed, CRC32-per-chunk, currently one symbol for the whole deflated
blob) → `make-qr.mjs` → **`make-datachamber.js`**, which is literally
`data:text/html,` + `encodeURIComponent(_site_qr/index.html)`. So **the data:chamber *is* the QR-variant
site**, and the QR/Aztec are its optical carriers.

**The seams already there (build the probe line on these):**

- **The resolver — `docs/_data/payload.js`.** Fetches `.well-known/manifest.json` and turns each resource
  into a live behavior **by content-type** — the embryonic "submodules of behavior": `module`/`script` →
  `<script>` (Blob-URL), `text/css` → `<link>`, **`application/manifest+html` (WIDGET) → a sandboxed
  `<iframe>`**, **`application/vnd.anecdote.worker` (WORKER) → `navigator.serviceWorker.register`**, and
  **`application/manifest+json` (BUNDLE) → recursively load a sub-manifest**. Recursion + content-type
  dispatch is exactly the extension mechanism Origin formalizes; `candidates` (today just `dns: /resources/`)
  is the strategy switch where `optical` / `blob-cache` / `peer` slot in.
- **The verification/probe seam — `docs/resources/integrity.mjs`.** Reads a `public-key-fingerprint`
  meta, fetches the **canonical** `manifest.json` + `.sig` (fully-qualified, because "the QR instance never
  builds its own"), and verifies with **`crypto.subtle?.`** — the optional-chaining is the smoking gun:
  the prototype **already anticipates the chamber lacking `subtle`**. On failure it injects
  `"verification":"failed"`. This is precisely the seam the Elevated probe line replaces "supply `subtle`
  + verified manifest down the line."
- **The blob cache — `docs/resources/medium.js`** (the `▒` worker). An **IndexedDB** blob store driven
  over a **BroadcastChannel** (`retain`/`retrieve`/`prefixed`, NFC-normalized keys, `{bytes,type,date_added}`)
  — the runtime **shelving** for the trove / git objects.
- **The widget store-probe — `docs/resources/manifest.html` + `widget.js`.** A `layout: widget`, strict-CSP
  iframe that answers an **origin-checked `postMessage`** by returning its `[id]` DOM as a structured
  object (gated on a `for:` meta). This is "browse your own stores via postMessage" and the companion-app
  message line, in miniature.
- **The agent bundle — `docs/resources/assistant.json`** (a recursive BUNDLE): loads `assistant.html` +
  `assistant.js` and declares **`tasks`** mapping a job (MNLI/QNLI) → a model → a `@xenova/transformers`
  pipeline (zero-shot / text-classification on `mobilebert`). The offline label-reducer, manifest-loaded.

**Signing (a reconciliation point):** the prototype signs the manifest with **RSA-PSS / SHA-256** in
WebCrypto (`sign-manifest.js`, `make-key.sh` → `public.pem`/`local/private.pem`), not the constellation's
`ssh-ed25519`. A wrong signature is currently **non-fatal by design** (the runtime self-marks
`verification: failed`) "until sources and sub-manifests are signed in distribution."

## Distributed resources — the shipyard's first stock

What the Elevated context hands a data:chamber to start:

1. **The same MiniLM the reducer already vendors** (`runtime/` + `reducer/model.lock.json`, hash-pinned,
   cold-loaded — see [`docs/DELIVERY.md`](DELIVERY.md) / [`reducer/README.md`](../reducer/README.md)). In a
   chamber this makes **label-reducing an offline, private power**: bring any document in from your offline
   git origin and the reducer helps you *read* it — perception, on-device, watcher-proof.
2. **The git-enough client** (deliverable #1) — vendorless JS, checkout + stage/commit against the offline
   origin, omitting the ops we reject.

## Taking shape — the workspace is the firmware

Refinements toward deliverables (still vision, but sharpening):

- **The app pulls itself down, with the update-allowed lever ON for exploration.** During this phase
  updates are accepted freely; in the real thing the holder **pulls the lever** — and *dev's roll-forward
  is the direct stand-in* for the **in-app "accept the roll-forward diff" consent** the holder will own.
- **Modules carry functions and become probe-exposed.** Group a capability into a module (e.g. the
  **polling frontend**) and it is *runnable in concept* and **offered over the probe API to others**. We
  are **not** designing a full sync+async bus — we are *enabling peers to*. When one frame iframes another
  they already know how to **greet** and exchange **signatures to learn/remember** each other; the async
  **consent** questions are deferred, but the greeting+signature handshake is the seam.
- **The `file:` candidate backbone.** The manifest's loader strategies (`candidates`) gain a **`file:`**
  backbone — the unspoken default, likely a name we **invent and map to a blob**. Loading is us
  **"submoduling" the snapshot we hold**; we have **no upstreams**, so we cannot roll our own version
  without being **puppeted by outside tooling** (in dev we must be — same roll-forward-consent stand-in as
  above). A `file:`/blob reference **can point anywhere**, so a holder may bring **vendored-whatever**: our
  **license is done — we ship the nervous system without vendors**; a whole UI framework their journal
  build wants is on them.
- **civic-node is the firmware.** `civic-node` **is the offline origin** — a giant metaphor replacement for
  **firmware + the DNS/QR bootstrap**. The workspace **ignores QR packaging for now** but must be able to
  fabricate the **real v1 seed**: one that boots **aware it's taking its preloaded modules for granted**.
  **`anecdote.channel` is submoduled in the workspace root** alongside the other tools, its job to
  **provide the JS runtime to the offline origin**.
- **Distribution beyond DNS.** Allocate the space, then **phone-to-phone transfer**, or a **raw QR-video
  (≈60 fps, loop as many times as a bad camera needs; or 30 fps interleaved so there's one to watch)**.
  **Offline and airgapped — not offline-because-down:** you can still pull in a QR of anything DNS could
  have delivered.
- **Tools are the point (v0's humble truth).** v0 couldn't assemble the workspace; the workspace is what we
  built — but v0 captured the desire for **tools** here: the **LLM agent** (foundational), the **data-pile
  browser + monitor**. Offline, yet able to ingest a QR of anything DNS could've sent.
- **Privileged behaviors are an open budget.** Some behaviors are **worker-like** (e.g. **cron tasks**),
  and workers sometimes carry **privileged powers**. The **sum of privileged-environment needs** — and
  where even the "elevated" browser context needs *more* — is unknown; that uncertainty is exactly what
  motivates shipping a **library of tools for data:chamber dives**.
- **The "enough-client" family.** `git-enough` (deliverable #1), `jekyll-enough`, and the `seal-enough`
  encryption factory: each is a **narrow client compatible with the features actually used — not API
  parity**. `git-enough` is shaped in [`docs/git-enough.md`](git-enough.md) (the staging beat, the op set,
  the history-pile, and the seal-enough analysis); `jekyll-enough` is scoped by the study below.
  **Where each member LIVES is settled separately** — see *The family gets addresses* below, which
  names the repository boundaries and the order. `jekyll-enough` is extracted and waiting on its
  remote; the rest have not moved.

## Research idiom — the "subsystem-surface study" (reusable brief)

When we adopt an "enough-client" (git-enough, jekyll-enough, …), the first move is to measure **how much
of the upstream subsystem the product actually lights up**, so we implement the used surface and skip the
rest. Spawn a **read-only** study with these instructional parameters:

- **Target & dependency:** which product (e.g. the Journal) and which upstream to scope (e.g. Jekyll/Liquid).
- **Framing:** "compatible with the features used, NOT API parity."
- **Inventory dimensions:** the upstream's feature axes (for Liquid: tags, filters; for Jekyll: front
  matter, collections, `_data`, includes/layouts, permalinks, pagination, plugins/gems, Sass, the build
  trigger) — each with `file:line` evidence.
- **Output shape:** **Lit up — must implement** (ranked easy→hard) · **Dark — can ignore** · **Uncertain —
  needs a human call** · a one-paragraph **bottom line** (how big is "enough," and the 2–3 hardest pieces).
- **Constraint:** read-only; conclusion only, not file dumps.

### First study — how much Jekyll the Journal lights up

**Bottom line: ~5% of Jekyll. SMALL** — a template renderer over simple YAML data; **no** plugins,
collections, pagination, Sass, or Ruby. `jekyll-enough` is genuinely small.

- **Liquid tags to implement:** `for`, `if`/`unless`, `assign`, `capture`, `include`, `include_relative`,
  `comment` (incl. `forloop.last`, the `and` operator, hash access by `[0]`/`[1]`).
- **Liquid filters to implement:** `default`, `jsonify`, `where`, `split`, `join`, `relative_url`.
- **Jekyll features:** YAML front matter (`layout`/`title`/`permalink` + custom fields); `_data/*.yml`
  loaded and iterated as `site.data.<name>` (including **nested** hashes, e.g. Tell's
  `site.data.constitutions[pile][poll]`); single-level `_layouts`; `_includes` fragments; pretty
  permalinks; `site.*` / `page.*` variables; Kramdown markdown→HTML.
- **Dark — ignore:** collections / `_posts`, pagination, Sass/SCSS, plugins/gems, `_plugins/`, themes, and
  the long filter tail (`date`/`slugify`/`markdownify`/`sort`/`group_by`/`map`/`replace`/…).
- **The 3 hardest to replicate offline:** (1) **`jsonify`** — precise JSON escaping of YAML scalars;
  (2) **Ruby-style nested-hash iteration** (`for k,v in hash`, unpacking `pile[1]`) in a JS engine;
  (3) **Kramdown block-attribute shorthand** (`{: .journal-font}`) — non-standard markdown needing a
  Kramdown-ish pass.
- **Build trigger / caveat:** the journal-engine is a **submodule** (`journal/autumn-ryan` + `.journal-engine`)
  that advances + builds on a weekly cron; no custom `jekyll build` flags or plugins surfaced. The
  submodule's *own* templates aren't in this workspace, so the surface above is measured from the
  constellation's shared Liquid usage (Tell/Atlas/civic-node) plus what's visible — **re-run the study
  against the journal-engine repo once it's in scope** to confirm nothing exotic hides there.

## The family gets addresses — the boundary table, and the order

> Status: **decided in outline, one item needs the operator.** Adopted 2026-09-13 from the petition
> `extract-the-enough-family.md`, filed to this repository from the station node's library because
> the library group `build/enough/` was carved out to hold these and had nothing to hold.

The family has been a set of folders in this repository. It becomes a set of repositories, mounted
back **at the same paths**, because a folder and a submodule are byte-identical to an importer:
`../git-enough/read.mjs` resolves the same either way. Nothing that imports these has to change,
which is the entire reason this is affordable.

**`jekyll-enough` goes first**, and it is already extracted — thirteen commits with their authors
intact, its 4 suites plus a new one passing standalone, parked on this machine awaiting
`FCCN-ANTIBODY/jekyll-enough`. It was chosen because it cost nothing to find out: its four modules
import each other and nothing else, not even a `node:` builtin. It carries two things a folder never
needed, and both are the real product of going first:

- **`dependencies.test.mjs`** — the family's promise as a test. A production module may import a
  sibling and nothing else. `-enough` is a claim about *where the thing runs*, so the failure that
  would end it is not a bad feature, it is an import, and that failure is invisible from inside the
  repository.
- **`docs/mounting.md`** — the four places an unfilled mount fails **silently**. Read it before
  mounting any of these anywhere.

### What the folder called `git-enough` actually contains

This is the finding that changes what "extract git-enough" means. One folder, at least four things:

| | modules | wants to be |
|---|---|---|
| git transport and objects | `fetch-pack`, `send-pack`, `pack`, `unpack`, `objects`, `inflate`, `read`, `repo`, `git-client` | **`git-enough`** — the whole name, and nothing else under it |
| a workflow runner | `workflow`, `run-action` | **`actions-enough`** — [`docs/actions-enough.md`](actions-enough.md) already calls it that |
| a scheduler | `scheduler`, `staging-beat` | **`cron-enough`** — it already has a `minGap` and a `maxCommits` cap and no-ops when its authority gate declines. Best-effort-and-say-so is already its design |
| shims for `node:*` | `node-compat`, `shim-fs`, `shim-path`, `shim-os`, `shim-url` | **`node-enough`**, not `shell-enough`. There is no `ls`, no `grep`, no pipeline — it stands in for `node:*`, and in this family the lowercase word has to read as the thing it replaces |
| this repository's own concerns | the bottle cluster, `publish-cli`, `verify-cli` | **stay here.** See below |

Defaulting to one-repo-per-folder would ship a `git-enough` containing a scheduler and a workflow
engine — the exact thing a family of small primitives exists to avoid.

### The bottle cluster leaves `git-enough`, and that is the recommendation

Two modules hold the other 1,850 lines in place: `bottle.mjs` imports five things from `composer/`
and `seize.mjs` imports one. **148 lines pinning 1,850.**

Of the petition's two options — *leave them behind* or *invert the dependency* — **leave them
behind**, and the reason is no longer only about the import graph. `bottle.mjs` and `seize.mjs` are
not git plumbing that happens to sign things; they are *this repository's bottle and attestation
concerns* that happen to use git plumbing. `composer/` already holds `bottle-attest`, `bottle-embed`
and `bottle-uri`, and since 2026-09-08 the vocabulary itself has an owner in
[`bottles.anecdote.channel`](https://github.com/FCCN-ANTIBODY/bottles.anecdote.channel). Inverting
the dependency would make the new repository's API bigger in order to keep a boundary in the wrong
place.

**The part that needs the operator, because it is bigger than the petition said.** It is not two
modules. `bottle-boot.mjs` imports `serveOnHello` from `bottle.mjs`, and `bottle-boot.mjs` is
*served* — `probe-test/glove.ui.test.mjs` boots a page against `/git-enough/bottle-boot.mjs`. So
moving only `bottle.mjs` relocates the outward import rather than removing it. The clean cut takes
the whole cluster:

    bottle.mjs · bottle-boot.mjs · bottle-inception.mjs · bottle.html · seize.mjs  (+ their tests)

That changes a served URL path, which is a bigger decision than a file move and is why it is named
here rather than done.

### The tests reach further than the code, and a test that cannot run is a repository that cannot be trusted

A first pass over the modules misses this entirely. Eight things outside the folder are needed, and
the module graph names only six of them:

    bottle.test.mjs        composer/{bottle-attest, bottle-uri, probe-line, sign}
    seize.test.mjs         composer/sign
    probe-ops.test.mjs     composer/probe-line          ← probe-ops.mjs itself is CLEAN
    bundle-action.test.mjs scripts/bundle-action
    run-antidote.test.mjs  scripts/bundle-action

`probe-ops.mjs` is the instructive one: the module imports nothing outward and would extract without
comment, while its test stops running the moment the folder moves. `composer/bottle-uri.mjs` appears
here and nowhere in the module graph at all. **Survey both layers or the extraction ships a repository
whose suite is decoration.** A fixture may legitimately be duplicated where a module may not.

### Two more members, and one of them is a merge

- **`liquid-enough`** is a *file* — `jekyll-enough/liquid.mjs`, 430 lines. It is the biggest thing in
  the repository that just shipped and it may want its own address eventually. Not now: splitting it
  on day one would mean the first mount of the first member was itself a two-submodule affair.
- **`yaml-enough` already exists twice.** `jekyll-enough/yaml.mjs` (172 lines) and
  `advocate.anecdote.channel/bin/yaml-enough.mjs` (144 lines) are different code for the same job,
  and the second **already has the name**. So this member is a *merge*, not an extraction, and
  whichever survives has to satisfy both callers. A third reader — `station-node/bin/services.read_block`,
  ~45 lines of Python — should stay: system python has no yaml and putting a package manager on that
  node's boot path was refused deliberately. Worth knowing there are three, because *"the parser is
  shared by every repository that mounts the engine"* is true of one of them and reads as though it
  were true of the format.

### The order

**Harden every consumer before moving any code.** A runner that skips a missing directory and a
checkout that does not fetch submodules compose into a build that silently stops testing; a
`pages deploy .` over an unfilled mount publishes the hole into a live site. Both are fixed in this
repository *now*, ahead of anything needing them — which is why this document lands before the first
folder leaves rather than after.

1. **`jekyll-enough`** — extracted; the folder here becomes a submodule at the same path as soon as
   the repository exists.
2. **Re-run the full suite across the swap.** 117/117 today. The number must not move, and if a
   suite disappears instead of failing, step 2 of the hardening did not work.
3. **`cron-enough` and `node-enough`** next, not `git-enough`. They are small, they have no outward
   imports, and each one settles a *naming* question that is cheaper to settle before the big move.
4. **The bottle cluster's relocation**, once the served-path question is answered.
5. **`git-enough`**, which by then is only the transport and objects — the name finally meaning one
   thing.
6. **`actions-enough`**, whose boundary is clearest after `cron-enough` has left.
7. **`yaml-enough`**, as a merge, whenever both callers can be satisfied at once.

`liquid-enough` and a genuine `sh-enough` are **new work, not extractions**, and neither is on this
list. The 105 lines of `node-compat` and its shims would be a shell tool's substrate, not its
content.

### What this does not ask for

Not a monorepo split on a schedule. Not a package published anywhere — submodule pins are the
versioning and that is already exact. Not a rename of anything already right: `git-enough` and
`jekyll-enough` keep their names, and the naming findings above are about parts that never had one.

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
- **No self-roll without consent.** We hold a *snapshot*, not an upstream; the app cannot roll its own
  version except by being **puppeted** (dev tooling now; the holder's accept-the-diff lever later). A
  `file:` reference can point anywhere, but *our* update is never silent.
- **The nervous system, without vendors.** We ship the connective tissue; a holder may bring their own
  vendored frameworks/tools (`file:`/blob can point anywhere), and that is on them, not us. Our license
  ends at the nervous system.

## Open questions / the trilogy

- The exact **probe-line protocol** (which powers, how requested, how the Elevated context authorizes a
  chamber it spawned) — the message-API analogue of the postMessage tunnel we already built for ingress.
  Edges mapped in [`docs/probe-line.md`](probe-line.md) (capability = a transferred `MessagePort`, not
  origin; the ingress tunnel inverted; the op surface, consent ladder, and layering).
- The **git-enough op set**: the minimum to checkout + stage + commit our offline origin, and which ops we
  reject outright.
- **First-contact-from-QR** end to end (camera decode of the esoteric, byte-deflated QR; the
  data-vs-code-QR split; the recursive favicon fingerprint as the day-one signer record).
- **Revocability "with the right connectivity"** — the hat trick teased as part of a **trilogy of
  surprises**; recorded here as a pointer, not yet drawn.

### Reconciliation deltas (v0 prototype → constellation)

Surfaced by reading the snapshot; each is a decision, not a blocker:

- **Signing primitive: RSA-PSS (v0) vs. `ssh-ed25519` (Tell/anecdote).** WebCrypto now does Ed25519, and
  the rest of the constellation is Ed25519 — unifying on it lets the **same key** anchor the firmware-pin,
  the digest manifests, and the anecdote signature. Decide before the firmware-pin hardens.
- **The WORKER content-type registers a service worker (v0) vs. "the chamber is not a service worker."**
  No conflict once split by context: in the **served** origin a worker may be a SW; in a **`data:`
  chamber** `navigator.serviceWorker` is absent (the v0 already optional-chains it), so the medium must load
  as a **module / Blob worker** there. Name the two load paths explicitly.
- **Model set: v0 ships `mobilebert` MNLI/QNLI (zero-shot/NLI) via `@xenova/transformers`; mainline vendors
  MiniLM-L6 embeddings + a flan-t5 namer.** Same offline-pipeline pattern, different weights — converge the
  `tasks`→model map onto one hash-pinned lock (`reducer/model.lock.json`) so a chamber and the reducer agree.
- **`candidates` strategies.** v0 has only `dns: /resources/`; the resolver's `strategy` switch is the
  extension point for `optical` (QR/Aztec), `blob-cache` (the `medium.js` store), and `peer` — the same
  source-agnostic, verify-the-bytes stance as [`DELIVERY.md`](DELIVERY.md).
- **Probe line vs. origin-binding.** The ingress tunnel proved the host by **origin**; a `data:` chamber
  has an **opaque (`null`) origin**, so the probe line must authorize by a **spawn-time capability secret**
  the Elevated context mints into the chamber (postMessage `targetOrigin: "*"`, validated by the secret),
  not by origin. This is the one place the tunnel pattern inverts.
