# Single attention — the stick, the data-pile halt, and a legible focus

> Status: **shaping note** under [Milestone: Origin](origin.md) — ideation, not built, and not being built
> yet. One of the "long faces" of the work. Recorded now because it's cheap to hold while the innards are
> small (on the gravel, they won't grow much), so it's about the same weight to pull later. Companion to
> [consent-surface.md](consent-surface.md) (the human layer) — this is the *attention* half of the same
> instinct: keep what's happening legible to an imperfect judge.

## The instinct: only one thing runs on purpose

anecdote should hold **single attention** — exactly one thing running *on purpose* at a time. This is more
than a UX paradigm; it's a **legibility property.** The harder it is to promise "only one thing is running,"
the harder it is to ever know something is *wrong*. Conversely, if single-attention is a real, enforced
invariant, then "is anything else running?" becomes an answerable question — and anomalies surface. Legibility
for the cracked judge starts with a countable foreground.

## The data-pile as the default — a halt, not a homepage

On entry, the system does **not** rush you into one of the usual activities it thinks you want. It rushes you
into a **fresh data-pile.** The difference matters:

- A "browse/activity" landing means **the system knew what to do** — it's driving.
- A **data-pile** is empty. There's nothing there. **You** start controlling things from *inside* it. It is a
  place where authority begins with the person, not the platform.

So a data-pile is a kind of **halt instruction**: nothing is happening, and the empty pile **is in charge of
the focus now.** The baseline state of the machine is user-driven emptiness, not system-driven motion. (This
also reconciles with the archive browser: the pile is where a session *starts*; the browse is something you
then choose to do from inside it.)

## Diversion is the tell

If the honest default is "drop the person into a user-driven pile," then **any diversion from that — for any
amount of time — shows up.** A platform that instead rushed you somewhere, or made you wait, or quietly did
something first, is deviating from a baseline you can feel. The value isn't that diversion is impossible; it's
that diversion is **visible**, because the normal state is so plainly *yours and idle-until-you-act*.

## The stick — focus is a token, and it must be instrumental

To make "only one thing on purpose" enforceable rather than aspirational, model focus as a **stick** that is
passed to obtain focus legitimately. The load-bearing rule:

> **Passing the stick around as a ritual only matters if the stick is instrumental.**

If holding the stick doesn't actually *do* anything, the ritual is theater (the same failure as a web-painted
consent prompt — [consent-surface.md](consent-surface.md)). So the stick must **gate real capability**:

- **Holding the stick grants focus** — you are the one thing running on purpose.
- **Holding the stick quiesces the queen.** The user's stick should **stop the service worker from doing
  anything else** while you hold it. The most powerful layer (the SW — see [origin.md](origin.md)) is *not*
  free to initiate its own work while you're driving a pile. The queen waits her turn; the stick is a
  user-held constraint on her autonomy. (Yes, the SW "could be busy" — the stick is exactly the thing that
  says: not while I hold this.)

Because the stick is instrumental, **taking it illegitimately can't be silent.** Picking up the stick when
someone else holds it must be **evident**. An intruder who wants focus has to *act like an intruder* — to
**obscure something** to cover the grab — which makes their already-imperfect intrusion **a little less
perfect still**, and thus a little more catchable. We don't promise to catch it; we force the thief to leave
a smudge.

## How this ties into the rest

- **Cracked judge / preserve-the-possibility.** Single attention + an instrumental stick make the machine's
  activity *countable*, so a diversion, a stolen stick, or a busy queen become **noticeable** — the same goal
  as the tamper-evident [authority journal](consent-surface.md) (absence as a canary). Attention and record
  are two faces of legibility.
- **The queen (SW).** The stick is a rare thing: a *user-held lever over the most privileged layer.* It
  doesn't fix the queen's replaceability (that's the optical origin-bypass), but it bounds what the queen may
  *do on her own* while a person is present.
- **The gesture (consent-surface).** Obtaining the stick may itself be an authority-boundary **platform
  gesture** — one unforgeable act that both grants focus and mints the session's grant, so entering a pile
  and authorizing what happens in it are the *same* gesture, not two.

## Open questions

- **Does the stick need to be cryptographic?** Is it enough for it to be instrumental (gate focus + queen
  quiescence) and *evident-on-theft*, or does legitimate hand-off require passing a signed token so a grab is
  provable, not just visible? (The cheaper "instrumental + smudge" bar may be enough; a signed baton is the
  heavier option.)
- **What exactly quiesces in the queen.** Which SW activities pause under the stick (background sync, its own
  firmware roll-forward adoption, any autonomous fetch) vs. which must remain (serving the very pile you're
  driving). The queen can't go fully dark — she still serves your foreground — so the line is "no *initiating*
  while the stick is held."
- **Multi-surface reality.** Browsers give tabs/workers real concurrency; "one thing on purpose" is a
  *policy* we enforce atop that, so the note must eventually say how a second tab, or a spawned chamber, asks
  for the stick rather than just running.
- **Entry = pile.** The mechanics of "always land in a fresh pile" and how discarding/keeping it works
  (ties into the archive browser's data-pile lifecycle).
