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

## There is no "late" — the quell, and the timeline as artifact

Lateness is not a state; it is a position on a timeline already evidenced (every ballot's `ts`
rides inside its signature). What ends a poll is one of two things:

* **A close date** — final on its face. The date inside the signed poll IS a standing quell:
  post-close traffic is derelict, and anyone holding the poll can shrug at it without ever
  seeing a packet. (This retired the `late_until` window and the `late` bucket — v1 ideas
  superseded before they grew doors.)
* **A quell** (`quell.mjs`) — for undated polls (an RSVP is a poll; general-sentiment questions
  someone eventually ends on purpose) and for withdrawals. Two claims, told apart by who
  signed:
  - **author quell** (hostless, the poll's own kid): the QUESTION is ended — terminal, final,
    no listing resurrects it. Carriers prune its ballots (`applyQuells` — one packet replaces
    N dead ballots in every pocket) and carry the quell onward on the same labels they were
    already pinning. The quit-a-Tell case lives here: take your pile, end or re-home the
    question on your own signature.
  - **host quell** (names its `host`): MY door is closed — archived per end-of-life policy,
    membership removed, a donated pile sealed ("a box in storage now"). It binds nobody else:
    the same poll on two hosts with different archive policies has one door close while the
    other keeps collecting, maybe forever, maybe as its whole purpose. And it loses to
    freshness (`supersededBy`): a same-host listing newer than the quell means your cache saw
    the door open after it supposedly closed — believe the newer signed word. Host quells
    never prune ballots.

  `stillLive()` is the client's whole question: dead if author-quelled; otherwise alive while
  ANY known door stands unquelled-or-superseded.

For open sentiment polls the timeline becomes the interesting artifact — answers dated months
apart, revocations and changes included, are trajectory data a snapshot never was.

## The doors (unbuilt, in order)

1. **Turn-in at the mirror.** `turnInSubmission()` already projects a carried ballot into the
   ordinary `tell.submission/v1` idiom — a comment on the poll's canonical issue, the signed
   ballot riding whole so its age is *evidenced*, not asserted. `register-exchange.mjs`'s
   replay move applied to answers. Admission stays the Tell's: closed-dated means closed.
2. **The Atlas door, with the three-rule table.** For hand-carried traffic reaching an Atlas:
   poll known here → ingest and route — and the Atlas may **provision the ballot-box pile
   itself**, signed as exactly what it is (data-pile's `provisioner`/`provisioner_spec`
   grammar, the Atlas as attested provisioner; aggregation is then automatic). Poll quelled or
   past its close date → shrug — and the efficient shrug hands the quell BACK to the carrier,
   who prunes and spreads it. Poll unknown, no quell → flood to friends and forget; free
   forwarding, no custody. Atlases hold quell lists long and generously, purge eventually.
   Private polls never satchel-broadcast in the first place (the client knows the routing);
   taking one public is a re-signed poll object, free to reach discovery, where any data an
   Atlas already holds is harmless — it is all signed.
3. **The meet wiring.** Satchel + quell exchange riding the same gesture that rolls the
   labeler and mints met-records — transport over `transfer.mjs`/`carrier.mjs` framing, more
   member envelopes in the layout. No per-hop signing: the artifacts' own signatures are the
   integrity; encounter receipts (`accept.mjs`) stay local and optional.

## What is deliberately not here

No global registry of carriers, no delivery guarantees, no dedup authority — convergence is
content-id math, delivery is social probability, and admission is the Tell's alone (the `tok`
still rides the ballot for exactly that door). Collusion can fabricate a meet; thresholds
price it, nothing eliminates it (pinned honestly in sealed-credential.md).
