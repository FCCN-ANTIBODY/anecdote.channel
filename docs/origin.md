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

**Built (two slots, and the holder's lever — the aggression finally points both ways).** [`sw.js`](../sw.js)
now keeps the shell in **two** caches instead of one. `anecdote-held` is the **floor**: proven-whole,
boots with the origin dead, and moves only on a deliberate **promote**. `anecdote-rolling` is **what you
run**: always accumulating, allowed to be partial. (`anecdote-runtime` holds everything that is not
shell, network-first as before.) The slot names are **not versioned** — a cache key carrying the version
is exactly what stranded installs — so a generation change is a *merge*, not a discard.

**Promotion is a merge, never a swap:** rolling's bytes for every path it has, held's for every path it
lacks. The floor is whole by construction and cannot acquire a hole, which is why completeness is a
number the control page *shows* rather than a veto anywhere in the code.

**The lockout this fixes was real and shipped.** The old `activate()` deleted every shell cache whose key
differed from `VERSION` the moment a new worker took over. Kill the network mid-install and the holder was
left with a half-filled new cache and no floor — the system locking someone out of their own copy, which
is the one outcome the whole design exists to prevent. Deletion is now a **consequence of a proven floor**
(`retireLegacy()`, gated on the floor being whole, reachable from both activate and promote) and never of
activation. *Verified in Chromium:* an upgrade from the one-cache worker on a crippled network **rescued
46 of 49 files** out of the old cache into the floor and **kept the old cache** because the floor was
still short three; a later refresh completed the floor and only then was the old cache retired.

**One axis, three stops** — `free` / `hold` / `guard`, monotone in how much motion is allowed, kept in the
same IndexedDB as the pin and surfaced as a switch in the apex masthead and on [`shell.html`](../shell.html).
`free` runs rolling and revalidates behind the response; `hold` runs held and stops revalidating while
rolling keeps filling underneath; `guard` is hold with the pin enforced and refusals recorded. **The
setting governs what may REPLACE what you hold. It never governs what you may SEE:** every mode reaches
every slot, every read is layered (rolling → held → network → navigate fallback), and an unparseable mode
reads as `free` so a setting we cannot understand can never lock anybody down. A branch here that ends in
"so we don't show it" is a bug regardless of its reason.

**Stillness is a feature.** `install()` no longer calls `skipWaiting()`: a new worker waits until every tab
closes, the way firmware should sit still. Mismatch between a held shell and a newer worker is the
**steady state**, not an error — on the gravel path you do not get to dictate your update frequency — so
nothing gates on generation skew, and an *old* worker is never treated as a foreign one. The holder can
pull a waiting worker forward from `shell.html` whenever they want it; that is their gesture, not ours.

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

**`jekyll-enough` went first** — [FCCN-ANTIBODY/jekyll-enough](https://github.com/FCCN-ANTIBODY/jekyll-enough),
thirteen commits with their authors intact, mounted back here as a submodule at the same path. It was
chosen because it cost nothing to find out: its four modules import each other and nothing else, not
even a `node:` builtin, and every file went across byte-identical. It carries two things a folder
never needed, and both are the real product of going first:

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

### `age-enough` already exists, and somebody already vendored it by hand

Found 2026-09-13 while counting the shell gap, and it is the sharpest argument in this document
because **it is the failure the extraction exists to prevent, already committed.**

`composer/` holds a working age implementation — `age-mint.mjs` (178), `age-seal.mjs` (151),
`age-open.mjs` (89), `chacha20poly1305.mjs` (107) — with `age-mint.test.mjs` asserting that WebCrypto
derives the same recipient the real `age-keygen -y` does. That is the family's health test, met
against the actual tool.

> **Corrected 2026-09-13, same day.** This section first said the copies had *"nothing that fails
> when they drift"* and that `composer/` was the source for all of it. **Both were wrong.** There is
> a drift guard, the direction is per-file, and the real finding is sharper than the one it replaced
> — see [D5's guard cannot run where it matters](#d5s-guard-cannot-run-where-it-matters) below.

`FCCN-ANTIBODY/data-pile` shares this code, and the sharing is a **documented discipline, not an
improvisation**: [`docs/decisions.md`](decisions.md#d5--mirror-discipline) **D5 · Mirror discipline**
— *"the copy is byte-identical to its single source of truth, and its provenance is recorded."*

The direction is **per-file and it runs both ways**, which is the part easiest to get backwards:

| module | source of truth | mirror |
|---|---|---|
| `chacha20poly1305.mjs` | `composer/` | `data-pile/bin/`, *"VENDORED verbatim"* |
| `age-open.mjs` | **`data-pile/bin/`** | `composer/`, *"VENDORED verbatim"* |
| `feed-open.mjs` | **`data-pile/bin/`** | `composer/`, *"VENDORED verbatim"* |
| `age-keygen.mjs` | `composer/age-mint.mjs` | `data-pile/bin/`, a *"trimmed slice"* — D5's one allowed exception |

**This is not the `yaml-enough` situation** — there are no rival implementations to reconcile, only
one source per module and verbatim copies of it. So `age-enough` needs no merge: extract, mount,
delete the mirrors. It may still be the cheapest member after `jekyll-enough`.

And the mirroring is not the problem. **The absence of an address is**, because it is what forces a
byte-identical copy plus a guard to exist at all — which brings us to the guard.

`data-pile/bin/prove.mjs` calls it **"the vendored age battery"** — and `git-enough/workflow.mjs`
names the shell gap as needing *"a JS battery."* Same word, arrived at independently, for a thing
with no address.

#### D5's guard cannot run where it matters, and the mirror has already drifted

D5 is enforced by `composer/pile-keeper.test.mjs`, which asserts the mirrors are byte-identical to
`data-pile/bin/` after the provenance line. It is a real guard and it works. It also **cannot run in
CI**, and it resolves its subject like this:

    const dp = process.env.DP_REPO || join(root, "..", "data-pile");
    if (existsSync(join(dp, "bin", "feed-open.mjs"))) { …assert… }
    else console.log("  note: mirror drift guard skipped (no data-pile checkout; set DP_REPO)");

A **sibling checkout on disk.** `actions/checkout` gives a job one repository, `.gitmodules` here
names only `jekyll-enough`, and no workflow sets `DP_REPO` — so in CI the `existsSync` is false, the
guard prints a note, and the suite passes. It holds only on a workstation that happens to have both
repositories side by side, which is to say it holds by coincidence.

**And it has already caught something nobody saw.** Run on this machine, 2026-09-13:

    FAIL: composer/feed-open.mjs is byte-identical to data-pile/bin/feed-open.mjs
      ok: composer/age-open.mjs is byte-identical to data-pile/bin/age-open.mjs

39 lines of drift. `data-pile/bin/feed-open.mjs` grew a **`partial: true` verification mode** — for
*"a reader that holds only SOME blocks: a disclosed excerpt, an ejected piece, a player that has
fetched eight chunks of ninety-three"* — and `composer/`'s mirror does not have it. The half that
most needs partial verification is the browser half, and the browser half is the one that missed it.

D5's stated reason is *"avoids two copies drifting into two behaviors — **especially dangerous for
crypto/verify code**."* `feed-open.mjs` is verify code. The discipline was right, the guard was
written, and it still happened, because **the guard was conditional on something CI does not have.**

This is the same shape as the submodule guard in #233: a check that silently becomes a no-op when
what it needs is not on disk, reporting a pass for work it did not do. Two instances in two days is
a pattern worth naming — **a guard that can skip is a guard that will skip, and the skip is the
state nobody reads.** Whatever else happens, the skip branch should be a failure unless something
explicitly declares the subject absent on purpose.

**The drift itself is repaired in the same change that records this** — `composer/feed-open.mjs`
re-copied verbatim from the source of truth, which is what D5 says to do when the source moves. Its
one consumer (`composer/pile-keeper.mjs`) passes no `partial`, and the new parameter defaults to
`false`, so behaviour is unchanged and the browser half now *has* the mode it was missing. 118/118
with the guard armed via `DP_REPO`.

What is **not** repaired is the guard's reach, and it should not be papered over from this side:
making the skip fatal would fail every CI run, because CI genuinely has no `data-pile`. The fix is
the address. Until then this drift can recur at any time and the only thing standing between it and
production is whether someone runs the suite on a workstation with both repos checked out.

It is also the strongest argument in this document for the family's whole premise: an address would
make this a submodule pin, and a pin cannot drift.

#### What it is already worth, measured

Of the 13 `hosted-only` steps in [the count](actions-enough.md#the-shell-gap-counted), **five are
`sudo apt-get install age`** — and the battery has already made most of them unnecessary without
anyone noticing:

| workflow | installs `age` for | state |
|---|---|---|
| `ingest.yml` | `bin/ingest` | **nothing** — `bin/ingest` and `bin/lib.sh` make zero `age` calls |
| `report.yml` | `bin/ingest`, `bin/report` | **nothing** — same |
| `prove.yml` | `bin/prove` (bash), which shells to `age -d` | replaceable: `bin/prove.mjs` is a byte-compatible port cross-verified against the bash bin in `test/prove.test.mjs` |
| `setup.yml` | `age-keygen` | replaceable: `bin/age-keygen.mjs` |
| `test.yml` | `test/run.sh`, making fixtures with the real tool | **keep it.** Generating a fixture with the tool and asserting the port reads it is how parity is proven |

Two installs are vestigial, two are replaceable by JS that is already written and already tested,
one is load-bearing and should stay. **That is not a build; it is a deletion and two path changes**,
which is what the closing note of the shell count meant by *the cheapest way to shrink this gap is
not to build anything.*

**It is `data-pile`'s call, not this repository's.** Recorded here because the family boundary is
defined here and because the inlining is evidence about *this* repository's missing address, not
about their judgement — they did the correct thing with the options they had.

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

1. **`jekyll-enough`** — done. 117 suites before, 118 after: the same four ran out of the
   submodule and `dependencies.test.mjs` came with it.
2. **Prove the guard on a real submodule, not a renamed folder.** The first version of the
   hardening tested for a *missing* directory, and an unhydrated submodule is an **empty directory
   that exists** — `readdirSync` returns `[]` rather than throwing. It reported `113/113 passed`
   having run none of the five. The test is *no suites*, never *no directory*, and that is only
   findable by deinit-ing an actual mount.
3. **`cron-enough` and `node-enough`** next, not `git-enough`. They are small, they have no outward
   imports, and each one settles a *naming* question that is cheaper to settle before the big move.
4. **The bottle cluster's relocation**, once the served-path question is answered.
5. **`git-enough`**, which by then is only the transport and objects — the name finally meaning one
   thing.
6. **`actions-enough`**, whose boundary is clearest after `cron-enough` has left.
7. **`yaml-enough`**, as a merge, whenever both callers can be satisfied at once.

**`age-enough` is unplaced in this order on purpose.** It needs no merge and has a proven consumer,
so it could go second — but it is `composer/`'s code rather than `git-enough/`'s, and whether the
family takes members from outside that folder is a question this list has not had to answer before.

`liquid-enough` and a genuine `sh-enough` are **new work, not extractions**, and neither is on this
list. The 105 lines of `node-compat` and its shims would be a shell tool's substrate, not its
content.

**`sh-enough` now has a measured size and a warning attached.** 41 of 141 workflow steps across nine
repositories are shell the interpreter cannot run, and 13 of them write `$GITHUB_OUTPUT` — a file the
hosted runner owns, which a shell interpreter would write into the void. Counted by
[`scripts/workflow-gaps.mjs`](../scripts/workflow-gaps.mjs) and argued in
[`docs/actions-enough.md`](actions-enough.md#the-shell-gap-counted). The order that falls out: **the
runner's inter-step contract comes before any shell at all.**

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
