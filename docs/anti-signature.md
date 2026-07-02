# The anti-signature — crimping data on the way out, and who counts as a constituent

> Status: **shaping note** under [Milestone: Origin](origin.md) — ideation, not built. Captures a cluster of
> ideas that reshape how *encountered* (as opposed to *authored*) data is treated: a damage-as-signature on
> the way out, the trust grades of passed-around data, and the presence test that decides constituency.
> Companion to [offline-transfer.md](offline-transfer.md) (the carrier) and [consent-surface.md](consent-surface.md)
> (the gesture / the cracked judge).

## Two signatures: one when you make it, one when you give it away

We already sign what we make (Ed25519, gesture-gated). The new idea is a **second, opposite mark**: when
you *give data away*, you **crimp it** — dent it on purpose. The signature says *I made this*; the dent says
*I let this go.*

> **We signed it when we made it, and we dented it as we handed it over — a different kind of signature.**

The dent is a **hard-to-reverse proof of intent to part with the pristine thing**: no one else holds it the
way you held it, because you *ruined your copy's twin* on the way out. It's a **forever, instant revoke made
of physics, not policy** — "when I give it away, I revoke." Crucially, it can't be *only* a claim ("the
text-lock says this is revoked, but you could decrypt it anyway"). The **ruining is the enforcement**: the
copy that left is provably not the copy you keep.

## Healable vs. fragile — what can be dented

- **Unencrypted / fountain-coded data** *can* be dented and still **heal** (watch the loop one full pass; the
  [fountain](offline-transfer.md) fills the punched-out frames). Here the dent is a **mark**, not
  destruction — it corroborates *how you encountered it* (you saw it damaged; that's one more true fact about
  its journey). Punching out a quadrant even for branding is fine; it heals.
- **Encrypted / archival / "fragile" data** *can't* be dented healably — damage it and it's gone. So it must
  be **labeled fragile** and moved differently. Open worry: a fragile blob is opaque, so *how do we trust it
  isn't smuggling something?* (Recorded, not solved.) The stance: **prefer channels where we can dent it;**
  fragile is the exception you have to declare.

## The anti-signature is the only mark you can put on open data

On unencrypted, passed-around things — a meme, a document a friend holds out on their phone — **damage is the
only signature you can apply.** You can't re-sign someone else's content as yours, but you *can* dent it, and
that dent is *your* anti-signature on this encounter. And scanning such a thing is a **knowing, willing act**:
you want what's inside. So the rule falls out cleanly:

> **Passed-around, open data is *seeable*, not *privileged*.** You scan it because you want to see it; it is
> **not presumed authorized to *do* anything** in your system.

## Sign your damage

When the app meets a QR, it would be lovely if it understood from the **outset — from context and
circumstance, before fully reading the contents —** that *this carries an anti-signature* (it's a dented,
passed-around thing, not a pristine authored one). It may not read *what* the dent says, but it can **sign
the damaged artifact** — record "I encountered this, thus dented, on this day." Signing your own dent is the
text-log part, and it's a little bit brilliant: an **attestation of an anti-attestation**, the corroborating
fact that you met a thing already given-away.

## Presence, not papers — who is a constituent

This answers the parked boundary problem: a node presenting boundaries wants to say *"**these** are the ones
**we attest to**,"* not merely the ones it also happens to agree with. The answer has to do with **proving you
can *be there*** — emphasis on **be there**:

> It is not citizenship. There is no state or federal document you could hand us that would change the
> assessment. The only question is: **are you a constituent *right now*?**

Real-space scanning is exactly this proof. When tiles are **spaced** — spread across a billboard, spelling a
word, or looped in a video only present in a room — **you had to be there to know which codes neighbor the
one you already knew about.** Being-present-to-scan *is* the authentication. This is not an ARG; the physical
act carries the meaning. Constituency is **present participation**, verified by presence, not by credentials.

## Trust grades of encountered data

A ladder, from the vivid picture (intermediate names still open):

1. **Mine** — I made it and signed it; pristine, authoritative, revocable (`consent.mjs` trove).
2. **First-contact-signed** — from a signer I pinned on day one ([origin.md](origin.md)); trusted-to-act if on
   my friend list ([offline-transfer.md](offline-transfer.md)).
3. **Hearsay / relayed** — a friend handed me what *they* got from someone else. Lower, and **the dent helps
   here**: the anti-signature tells me it's a given-away copy and corroborates its journey. Seeable; not
   privileged.
4. **Anonymous** — verifies as *someone's*, trusted by no one. Seeable at most.

The through-line: **what we make is clear to us; what we're handed is legible by how it arrived** — signature
for the authored, anti-signature (the dent) for the relayed.

## Acquire-by-doing (and the bigger lens)

Every step should make a person **acquire something by doing something in the real world**. Special
capabilities are **earned by presence**: e.g. the heavier, more-efficient decoder — the "bigger lens" — could
be an **acquirable module** you assemble by scanning a **~300-QR constellation** off a billboard or a looped
video. Ship the small, reliable decoder by default (hard to argue with small-and-reliable); make the big one
a thing you *go get*. Doors into the system are many (download a video file, a single image), which is exactly
why the trust grades above matter: the door doesn't confer privilege; presence and provenance do.

## Aside: Instruction Case (brand voice)

A recurring house style worth naming: **Capitalizing The First Letter Of Every Word** to mark an *imperative
or a proper-noun-like phrase we have no proper noun for* — "instruction case." It's a poor-man's **bold**
(Markdown's `**` punctuation isn't visible without a render preview), deployed for things someone is *telling
you to do*. Part of the anecdote tone: **been seen by at least one agent.**

## Open questions

- **Mechanics of the dent.** For fountain data: is the anti-signature literally *N punched-out frames*, and is
  it itself *signed* (sign-your-damage) so the dent is attributable, not just present? What's the minimal
  dent that's provably intentional (not mere transmission loss)?
- **Fragile handling.** How a "fragile" (un-dentable) blob is labeled, and the anti-smuggling story for opaque
  archives.
- **Presence proof, concretely.** What artifact a real-space scan produces that stands as "I was there,"
  and how spaced/constellation layouts encode "which neighbors exist" so absence-of-presence is detectable.
- **Naming the middle trust grades** between first-contact-signed and anonymous.
