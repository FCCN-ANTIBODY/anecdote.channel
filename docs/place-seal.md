# Place-seal — decryption keyed to presence, and the live/snapshot boundary

> Status: **shaping note** under [Milestone: Origin](origin.md). The core wire is **built**
> (`composer/place-seal.mjs`, `composer/place-seal.test.mjs`); the judge policy layer it feeds is **not**.
> Picks up the presence thread from [presence.md](presence.md) (the in-place code, the bisect, the witness)
> and the encryption battery from `composer/age-seal.mjs` / `composer/age-mint.mjs`, and finally wires the
> two together — the one seam neither module reached across. Companion to [lease.md-in-spirit](lease.mjs)
> (freshness that decays) and [consent-surface.md](consent-surface.md) (the cracked judge).

## The problem, stated honestly

We want: **you can only view the LIVE version of an atlas inside the constituency; any SNAPSHOT you hold,
you can carry and share anywhere.** With no server and no online token mint, three things are simply not
achievable and we stop trying to beat them (they are the frame, not a bug):

1. **You cannot bind decryption to physical presence against the owner of the decrypting device.** Location
   is not a secret; a phone attesting its own position is circular. Presence can only be vouched by
   something that is *not* the device — an in-place secret, or a co-present witness.
2. **If a legitimate reader can see plaintext, a rogue legitimate reader can rebroadcast it.** The goal is
   attribution and friction, never prevention.
3. **"No secret offline" + "a snapshot must open forever" means the snapshot key lives on the device**, as
   extractable as the device allows.

So we do not build a wall. We build a **decay**, which is the grain of this whole system (grade, don't
block; revoke-by-silence; the judge weighs a history). "Live" is keyed to a secret that rotates out from
under you; "snapshot" is the still you re-seal to yourself and keep.

## The mechanism

`age-seal.mjs` seals a payload to X25519 **recipients**; whoever holds the matching **identity** opens it.
Place-seal makes the live recipient a *rotating, in-place* thing:

- **Epoch.** Time is floored into windows (`epochOf`, default 3 minutes — faster than a code can usefully
  travel). Each window is one integer epoch.
- **Seed.** The place operator (who "runs their own Tell" and already holds `TELL_QR_SECRET`) derives an
  epoch **seed** — `HMAC(HMAC(secret, "place-seal:"+place), "epoch:"+epoch)`. The `place-seal:` domain
  prefix keeps it disjoint from the poll tokens (`qr:`) the same secret mints, so **no new credential is
  introduced** — it is a fresh derivation of a secret the operator already has.
- **Epoch keys.** The 32-byte seed *is* an X25519 scalar, so it expands directly (`age-mint` encoding) to
  an `AGE-SECRET-KEY` identity + `age1…` recipient. Deterministic on any device.
- **Beacon.** The place paints a signed QR — `anecdote.place-beacon/v1` — that **carries the seed** (the
  controlled in-place exposure) and is operator-signed so a catcher can tell it from a decoy. This is
  presence.md's "in-place code," now doubling as a key, not just a proof.
- **Seal live.** `sealLive` encrypts to the current epoch's recipient plus the previous `grace` epoch(s), so
  a payload minted at a rotation boundary still opens for a body one epoch behind.
- **Open live.** `openLive` refuses unless the caught beacon **verifies and is fresh** — you hold a *current*
  in-place secret. A stale beacon opens nothing new. That refusal is the entire point.
- **Snapshot.** `toSnapshot` re-seals an opened payload to *your own* recipient. Portable, openable by you
  alone, copy-proof to anyone else (their stanza was never written). This is the "the Atlas had a hand in
  supplying the key, but it made it for you" move — the hand was the live seal; the you-only copy is this.
  **Discipline: a decrypted live payload should never rest as plaintext — re-seal on first open.**

## What this does and does not buy

- ✅ **GitHub / any passive host cannot read** either form. Total, trivial, at rest.
- ✅ **Live is gated to present-within-the-last-epoch.** Walk out of range, wait one rotation, and new live
  frames stop opening for you.
- ✅ **Snapshots are portable by design** — the feature you wanted, not a compromise.
- ⚠️ **The seed is relayable inside its window.** A confederate can photograph the beacon and text it to
  someone a mile away within the rotation window. Shrinking the window trades usability for tightness; it
  does not close the gap. This is why live-open should be paired with a **fresh witness** (`presence.mjs`) —
  two independent placements — and why the **judge** matters (below).
- ⚠️ **Plaintext leak is not attributable.** Every recipient unwraps the *same* file key, so a leaked
  plaintext is byte-identical across readers. A leaked *seed/identity* is attributable to an epoch; a leaked
  *plaintext* is not, without per-recipient watermarked variants (N seals — deliberately not built). We lean
  on social cost + the judge downgrading a signer caught rebroadcasting, not on cryptographic tracing.

## The judge reads freshness as a spectrum — the policy layer (not built)

Place-seal is only the crypto. The user-facing power your instinct reached for — *"a constituency can say
be-in-Colorado-once-a-year; a neighborhood can say here-3-of-7-days"* — lives one layer up, in the **judge**
(`consent-surface.md`), reading artifacts anyone can re-verify. It needs no new cryptography; it composes
what exists:

- **A presence claim** (`presence.mjs`) = one dated "my bisect places me in C," optionally **witnessed** =
  two independent placements at one moment.
- **A lease** (`lease.mjs`) = a signed "still live as of `at`," whose value **decays** on its own; non-renewal
  is the revoke.
- **A membership policy** is then a predicate over a *history* of those, with a freshness window:

  | Constituency kind | Policy the judge evaluates |
  |---|---|
  | State ("be in Colorado once a year") | a single witnessed presence claim inside a 1-year lease window |
  | Neighborhood ("here 3 of 7 days") | ≥3 distinct-day presence claims within a rolling 7-day window |
  | Live view right now | a *fresh* beacon-open (this module) **and** a fresh witness co-signature |

  Being somewhere is the only thing that makes you a constituent — so the policy is always "produce
  convergent presence on demand," tuned by *how fresh* and *how often*. A spoof is a bet against every future
  demand; the judge weighs the standing ability, not the instant.

## Membership cost — the real blast-radius lever (built: `composer/enroll.mjs`)

Confidentiality against members is only as strong as membership is expensive. An age recipient is just a
public key: if anyone added is in, the key is de-facto public and one rogue joiner's blast radius is the
whole constituency. `composer/enroll.mjs` makes **joining cost a body in the shape**:

- A would-be member proves presence in C — ideally **witnessed** (`presence.mjs`: a co-present body
  countersigns), so it costs a *second* person, not a spoofable self-GPS — and **binds their age recipient**
  to that proof in a signed enroll request.
- The binding is enforced at verify: the request must be signed by the **same identity the presence proof
  places in the shape**, so a recipient can only be enrolled by the body that actually stood there.
- The atlas grants a **membership that decays** (the lease idiom: a dated, atlas-signed "still a member as
  of `at`, window W"). Non-renewal is the revoke; renewal costs another fresh proof.
- `freshRecipients` folds a bag of memberships into exactly the currently-fresh recipients — the
  presence-gated, self-expiring seal list you hand `age-seal.encrypt` / `toSnapshot`.

`meetsPolicy` is the judge's enrollment-time face: it defaults to STRICT (witnessed + co-present + fresh) and
an atlas loosens it deliberately, never by accident. This gates the **recipient set** (who may hold snapshots
/ dumps); the beacon above gates **live** (who may open the live frame, in-place, right now). Two
complementary gates: enrollment is the standing "you belong here," the beacon is the momentary "you are here."

## Where the code sits

- `composer/place-seal.mjs` — `epochOf`, `deriveSeed`, `epochKeys`, `deriveEpoch`, `mintBeacon`,
  `verifyBeacon`, `sealLive`, `openWithSeed`, `openLive`, `toSnapshot`.
- `composer/place-seal.test.mjs` — the wiring proof: fresh beacon opens, stale/absent/decoy does not, grace
  straddles a boundary, snapshot is portable-to-holder-alone.

## The judge — canonical shape and the offline seam

The judge is **`FCCN-ANTIBODY/judgement`**, a composite GitHub Action (`uses: FCCN-ANTIBODY/judgement@main`),
not a hosted worker. It renders one of three verdicts — **`accept` / `reject` / `needs-judgment`** — over a
request `{constitution_a, constitution_b, subject, guidance}`: is the subject, as clarified by its guidance,
permitted by BOTH constitutions? The compare is a **pluggable LLM agent** (Opus 4.8); `needs-judgment` is the
honest default that **routes to a human** whenever no agent is available (no key, rate-limited, off, unsure).
Online it runs three ways — `ondemand`, a `board` that drains a fixed bucket of `judge:pending` issues, and a
**PR consent-gate** (the PR is the consent event, the merge is the append).

`composer/judgment.mjs` is the **offline emulation of that same seam.** Offline there is no agent and no key,
so it *is* the no-agent branch: a cheap lattice fast-path settles the pairs that need no intelligence, and
everything novel becomes `needs-judgment` — where the human it routes to is the user's own **gesture**
(`resolveByGesture`, the compressed PR-open+PR-close, its signature carrying proof-of-presence). Same case
record either way; only the closer changes. The presence/enroll **predicates** are an offline *extension* —
the material for the signed authorization envelope the judge's OPEN-QUESTIONS #1 wants (below).

## Next, in order

1. ✅ **Presence-gated enrollment** — `composer/enroll.mjs` ties an atlas's recipient set to witnessed
   presence, per "membership cost" above.
2. ✅ **Offline judge runner** — `composer/judgment.mjs` emulates the `judgement` Action; verdicts aligned to
   the canonical `accept`/`reject`/`needs-judgment`, the gesture as the human failover.
3. **The authorization envelope** (`judgement` OPEN-QUESTIONS #1) — bind presence/enroll attestations into a
   signed request envelope that proves a judgement request is legitimate. This is where the whole arc —
   are-you-here, do-you-belong — plugs into the judge.
4. **Probe-line capabilities** — expose `place.seal` / `place.open`, `enroll.*`, `judgment.*` on the consent
   ladder (Rung 1; the secret stays Elevated, the chamber hands only the payload + caught beacon / presence
   proof), mirroring `qr-mint`'s `poll.mint`.
5. **WebAuthn-PRF at-rest binding** — already flagged in `gesture.mjs` as the "stronger follow-on": derive the
   snapshot wrap key from the passkey so on-device keys are cryptographically unusable without the live
   gesture — the best in-browser answer to impossibility #3.
