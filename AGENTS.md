# Orientation

This repository is **the offline origin**: Anecdote, an offline-first PWA that lets a city poll
itself from the smartphones people already carry — no persistent backend, no privacy policy to
consent to. Once held, it boots with no connection and the origin unreachable. It is also the
**destination** of the constellation's ongoing migration: capability is moving off GitHub and down
onto this client, so what this repo can do is, increasingly, what the whole project can do.

This file is deliberately `AGENTS.md`, not a Claude-specific file — any agent working here needs
the same map.

## The demo shelf — read this before designing anything

The demos are the representative, technical reflection of the project's real capabilities. They are
not toys beside the product; they are the product's capability index. **Before you build, check the
shelf** — if your need category is represented here, the machinery exists: compose it, don't
rebuild it.

Serve the repo (`node scripts/serve.mjs`, or `python3 -m http.server 8000`) and open them —
they are ES modules and chamber-spawners, so `file://` won't work. `reducer/demo.mjs` runs under
plain `node`. The camera demos want a real device.

| Demo | What it proves |
| --- | --- |
| `composer/composer-chamber-demo.html` | The compose UI running in a powerless `data:` chamber, summoning label/sign capabilities from the Elevated page over the probe line — the app's two load-bearing ideas in one page |
| `composer/qr-mint-demo.html` | Elevated operator tool: mints a signed poll QR — token authorizes replies, on-device Ed25519 signature proves origin, emits the `keys/tell.signers` enrollment line |
| `composer/poll-answer-demo.html` | The respondent's view of a poll QR: question + options in a chamber, answer always custom, builds the pre-filled issue link — nothing phones home |
| `composer/answered-demo.html` | "Polls you've answered": chamber lists remembered answers joined to trove receipts; memory lives Elevated, never in the chamber |
| `composer/gesture-demo.html` | The two-factor consent surface: a WebAuthn/passkey gesture gates use of the signing key, and proof-of-presence is folded into the signed bytes |
| `composer/grants-panel-demo.html` | "Running on your behalf": mint/touch/revoke standing consent grants, each row showing the artifact that proves it |
| `composer/constituency-demo.html` | Self-constituency assertion over signed Atlas dumps, entirely on-device — a live counter proves outbound network calls stay at zero |
| `composer/carrier-loop-demo.html` | A payload as an endless rateless QR-droplet billboard, healing through deliberate frame damage — the optical transfer substrate |
| `composer/carrier-catch-demo.html` | The receiving end: this device's camera drinks another device's billboard through the repo's own QR lens |
| `composer/meet-demo.html` | Two phones trading pockets face-to-face over light — one page playing both roles, hello→trade→receipt |
| `composer/host-demo.html` | The runtime tunnel: a stand-in Tell poll sheet iframes the guest, which does data-assisted intake + egress without ever exposing key or trove |
| `git-enough/git-chamber-demo.html` | The offline origin's own git, driven from a powerless chamber over the probe line — commits happen Elevated, the chamber only asks |
| `viewer/viewer-demo.html` | The "your repositories" account page: every locally hosted repo with its `anecdote://` id and trust grade, opened on-ice |
| `viewer/landing-demo.html` | The landing index every storage manifest on the device becomes (work-in-progress scratch for the future landing page) |
| `reducer/demo.mjs` | (Node CLI) Two gatherers reduce independently, label sets union, the merge-only ratchet collapses duplicates, and the cache cold-loads by re-derivation |

`index.html?diag` runs older preflight pages (`composer/crunch.html`, `bench.html`) as cold-load
diagnostics — those are not the demo surface; the table above is.

## Where the rest of the truth is, in reading order

1. **Open issues are urgent.** An open GitHub issue here is a live problem with the current
   implementation — ahead of the deferred backlog. Roadmapping does *not* live in issues; it lives
   in the documents (`docs/`, civic-node `VISION.md`), and design writing is moving back into repo
   files, off the public issue surface.
2. **The deferred half lives in one place** — civic-node
   [`OPEN-QUESTIONS.md`](https://github.com/FCCN-ANTIBODY/civic-node/blob/main/OPEN-QUESTIONS.md).
   Record a deferral there, never as caveats threaded through law or spec.
3. **`docs/` is the design corpus** — `origin.md` (the offline-first thesis), `probe-line-v1.md`
   (normative; supersedes the older `probe-line.md` shaping note), `git-enough.md`,
   `consent-surface.md`, `offline-transfer.md`. `CONSTITUTION.md` is the binding law.

## You are the second factor

Signing happens **here, on the device**: WebCrypto Ed25519 under a non-extractable key in
domain-scoped IndexedDB, gesture-gated by a passkey ceremony (`composer/sign.mjs`,
`composer/gesture.mjs`), interoperable with real `ssh-keygen -Y verify` (`composer/ssh-sig.mjs`).
The device proves the operator can do the thing. Elsewhere in the constellation, GitHub workflows
are being kept as a **declarative definition of the pipeline** — a spec the offline origin can read
and mirror — not as the presumed runtime. Whether or not GitHub holds the secrets to run a
workflow, the offline origin does. Build accordingly: capability lands here first; a workflow is
its declarative mirror, not its home.

## Invariants — violate these and you're building the wrong system

1. **Neighbors, not a graph.** No central authority, ever; one hop, no transitive reach. "Above" is
   a position an operator occupies, never an enforced apex.
2. **Verify-from-anyone; trust decides *action*, not *admission*.** Anyone can check a signature
   (`ok`); a local friend/lineage list decides whether to act (`trusted`).
3. **Witness, not judge.** Never rule on whether content is genuine or fit; never block a
   submission — the submitter learns the outcome instead.
4. **Sign ≠ decrypt.** Signing is public authorship/integrity; encryption controls reading. Keep
   them separate.
5. **Honest defaults fire nothing.** Judges, thresholds, automation ship *off* until an operator
   sets policy.
6. **Attest before you run.** New conduct goes into the relevant `CONSTITUTION.md` in plain words
   *before* it is coded.
7. **Content-id is the join key.** `defaultHash(canonicalize(signed))` — reuse
   `ballotId`/`atlasPollId`/`quellId`; never invent a second hashing scheme.
8. **No new cryptography without cause.** WebCrypto Ed25519 (`composer/sign.mjs`), `age` (X25519),
   `sha256`. Every capability here was built by composing these.

## Built here — reuse, don't rebuild

`composer/` is pure, dependency-free ESM with real WebCrypto: `sign.mjs` (the attest/verify
envelope), `ballot.mjs`, `quell.mjs`, `atlaspoll.mjs`, `drop.mjs` (`resolveDrop`), `lease.mjs`
(the freshness lease), `qr-encode.mjs`/`qr-decode.mjs` (our own QR codec — iOS has no
BarcodeDetector), `age-mint.mjs` (browser-minted `age` identity, byte-interoperable),
`register-exchange.mjs` (offline PR-consent), plus `transfer`/`carrier`/`meet`/`satchel`/
`accept`/`route`. `git-enough/` is vendorless browser git, cross-verified against real `git`.
`reducer/` is the on-device labeler behind one embedder seam.

House test style: dependency-free, real crypto, one command — `node scripts/test.mjs` (each
`*.test.mjs` is a standalone `node` script). Verify locally; CI is the final gate.
