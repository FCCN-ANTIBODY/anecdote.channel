# The ballot mesh — hearsay carried by hand until it finds a door

> Status: **first primitives built; the doors are not.** Companion to
> tell.anecdote.channel `docs/sealed-credential.md` → "The offline parallel" (why the QR's
> platform token is dead weight face to face), `composer/ballot.mjs`, `composer/satchel.mjs`,
> and the transfer stack they compose with (`transfer.mjs`, `carrier.mjs`, `accept.mjs`,
> `met.mjs`, `register-exchange.mjs`, `route.mjs`).

## The realization this starts from

In person, the token embedded in a poll's QR is meaningless — it only ever spoke to an issue
platform. The meet doesn't unlock anything; it **produces** something: a hand-signed ballot.
An ambassador presents a poll they carry (they authored it, or hold it as a member of a Tell
or an Atlas); the respondent answers on the spot; the artifact is the answer bound to its
poll, age-stamped inside the respondent's device signature (`ballot.mjs`; gesture-gating
composes at the caller). The ambassador is now **carrying the hearsay of a vote** — the first
time a rando, not GitHub, is the carrier — and it has to get back.

## Getting back: satchels, pins, and the quiet constitutional check

When carriers can't reach the jurisdiction themselves, ballots travel the mesh: every meet
that already exchanges keys, labels, and met-records also exchanges **everything both sides
carry** (`satchel.mjs`). The broadcast is deliberately overwhelming; the *pocket* is the
filter:

- you **pin** the labels you choose to champion (reducer vocabulary — your slang, your
  filter). Pinning means **hyperbroadcast**: pinned ballots are the push tier, first on the
  wire when you scan with someone, newest first, so a truncated session still moved what you
  came to move — and they ride uncapped in your pocket;
- everything else is **slush**: kept (last ~100 per label), never pushed — available to fill
  in *if they ask* (`solicit()` pulls it by label), staling, prunable. Push what you champion,
  carry what you tolerate, screen what you refuse — that is the economy;
- the **screen seam** is where the offline label-reducer stands in for a constitution check:
  after mesh passing nobody knows whose constitution checked what, so your reducer may quietly
  drop what is in-category but carries what you won't (`route.mjs`'s posture: never blocked,
  only routed — this is routing's refusal half);
- a ballot that **arrives** — reaches the constituency it was addressed to — is held for
  turn-in and stops re-broadcasting; outside it, we don't care if a carrier was ever inside:
  seven degrees gets it there.

Everything is verify-from-anyone before it is kept; whose signature you *act* on stays the
friend-list's question (`accept.mjs`).

## The doors (unbuilt, in order)

1. **Turn-in at the mirror.** `lateSubmission()` already projects a carried ballot into the
   ordinary `tell.submission/v1` idiom — a comment on the poll's canonical issue, the signed
   ballot riding whole so lateness is *evidenced* (the age stamp is inside the signature), not
   asserted. This is `register-exchange.mjs`'s replay move applied to answers. Tell-side:
   `bin/authz`/`bin/govern` learn the **late window** — a poll's lifecycle gains `late_until`
   (already understood by `pollState`, state `"late"`), and a ballot arriving closed-but-late
   is admitted into the **late bucket** (`late: true` on the record; `tallyDeliveries` already
   counts and surfaces it) instead of rejected. Two buckets, one poll, recognizably the same.
2. **The Atlas door.** A carrier who reaches *any* running node — including a git server alive
   without internet — dumps what they hold; if it's for that Atlas it ingests, or routes to
   the right Tell as originally designed. Late ballots arriving on the discovery pipeline
   means the late ballot-box is a **discoverable pile that never registered its poll** — the
   opposite of the two-question pile: one question used twice, registered once. Needs the
   Atlas-side drop surface.
3. **The meet wiring.** Satchel exchange riding the same gesture that rolls the labeler and
   mints met-records — transport over `transfer.mjs`/`carrier.mjs` framing, one more member
   envelope in the layout.

## What is deliberately not here

No global registry of carriers, no delivery guarantees, no dedup authority — convergence is
content-id math, delivery is social probability, and admission is the Tell's alone (the `tok`
still rides the ballot for exactly that door). Collusion can fabricate a meet; thresholds
price it, nothing eliminates it (pinned honestly in sealed-credential.md).
