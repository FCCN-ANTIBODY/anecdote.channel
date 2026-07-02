# Presence as constituency — the in-place proof, the bisect, and the witness

> Status: **shaping note** under [Milestone: Origin](origin.md) — ideation, not built. This picks up the
> presence thread from [anti-signature.md](anti-signature.md) ("prove you can *be there*") and gives it a
> mechanism. Companion to the tell-side boundary notes (`tell.anecdote.channel/notes/reporting-locus-rethink.md`
> and `notes/boundary-declaration.md` — the attested boundary = polygon + basis[], boundaries as a list,
> authority emergent from convergence) and to [offline-transfer.md](offline-transfer.md) (the carrier all of
> this rides on).

## The short version

> It should be possible for someone to **prove they are a constituent of a place by scanning a code that
> could only be generated in that constituency — while their current constituency bisect has them placed
> there.**

Two independent signals, converging in one signed moment:

1. **The in-place code** — a short-lived token minted by a key that lives *in* the constituency (the same
   shape as a poll QR's mint: a secret the place's operator holds — qr-mint.mjs's pattern, with a clock).
   You cannot scan it from elsewhere because it is not *displayed* elsewhere, and it rotates faster than it
   can usefully travel.
2. **The bisect** — your own device, holding the constituencies it knows about, placing you inside one.
   Geometry evaluated locally, against boundary files you hold; no query leaves the device.

Neither alone is strong. A code can be photographed and relayed; a location can be spoofed. Together,
countersigned and repeated, they become the thing the judge reads.

## What this drags in: knowing your constituencies on device

The bisect needs the shapes. The **state hub dumps out the constituencies it knows about** in a form a
client can cheaply bisect — the boundary files the tell-side notes already shaped (polygon + basis[],
signed, plural, overlapping and non-nested by design). The dump is just data over any carrier — the
gravel included: boundary files are exactly the kind of signed payload the loop already pours and the pin
already grades. A device could acquire its constituency map *in the constituency*, which is pleasingly
circular and entirely within the machinery.

On-device bisect keeps the geo question private: "where am I" is computed against held shapes, never asked
of a server. What leaves the device is only the *claim* — "my bisect places me in C" — inside a signature.

## The false-location problem, and the judge

This is a geo question, so **the location can be false.** That is not a hole to patch at this layer; it is
the reason the layer above exists:

> The ability to perform an **in-constituency proof on demand** is probably part of what the **judge** does
> when it is thinking about this constituency layer.

A single proof is weak evidence. The *standing ability to produce one whenever asked* — across days,
codes, and witnesses — is strong evidence, and it is evidence of exactly the right thing: not citizenship,
not papers, but *are you a constituent right now?* The judge weighs a **history of convergent proofs**, and
a spoofed one is a bet against every future demand. (The cracked-judge caution from
[consent-surface.md](consent-surface.md) applies: the judge reasons over artifacts anyone can re-verify —
its conclusions are checkable, not oracular.)

## The witness — a physical, unrepeatable gesture

The unlock for the offline app is social, not infrastructural:

> It's almost like being able to scan a QR from **literally anyone next to you**. If you show them your QR
> and they scan it, it's almost like a **witness**.

- **You present; they witness.** Your device shows your presence claim as a QR (a signed
  `anecdote.presence/v1` artifact: the in-place code you caught, your bisect result, the moment). The
  person next to you — *anyone*, no enrollment required — scans it and countersigns what they saw. Their
  signature says only: *this claim was physically shown to me, here, now.* A witness attests to the
  **encounter**, not to your virtue — the same shape as the accept flow's signed encounter record
  ("I met this, thus dented, on this day"), pointed at a person instead of a payload.
- **The inverse: they present; you witness.** Anyone can hold a constituency proof as a QR, and **you
  scanning and signing it is part of the proof that *you* are there.** Witnessing is itself presence
  evidence — the countersignature you gave them lands in *your* trove too, and it could only have been
  made within camera range of them. Every witnessing is two proofs: one for the shown, one for the
  scanner.

This makes presence proofs **mutually thickening**: two strangers in a room, each scanning the other, each
walk away with a claim + a witness and a witnessing-of-their-own. No prior trust needed — the witness
grades like everything else (MINE / FRIEND / ANONYMOUS), and an anonymous witness is still a body that was
demonstrably co-present. The trust ladder already knows what to do with them.

Machinery already in place for all of this: the camera path (the catch), the signed encounter record
(accept.mjs), the friend list with `how: "first-contact"`, TOFU-over-gravel (a pin bootstrapped entirely
in a room — firmware-offer.mjs), and the mint pattern for place-held secrets (qr-mint.mjs).

## Open questions

- **Minting the in-place code.** Held by whom (the Tell's operator? a device on the wall?), rotated how
  fast, and what makes "could only be generated here" true against a relay — TTL + the witness layer, or
  something structural (the spaced-tiles idea: neighbors only knowable in place)?
- **Replay economics.** A photographed code travels at the speed of a photo; how short must the TTL be
  before relaying costs more than being there?
- **The dump format.** What exactly the state hub emits (the boundary-declaration note's `boundaries/`
  list, presumably), how big it is, and how a phone bisects it cheaply (point-in-polygon over a handful of
  local shapes is trivial; a state's worth wants tiling or a coarse index).
- **Privacy of the presence log.** Proofs and witnessings are sensitive by construction — they live in the
  trove under the recording toggle like everything else, but *presenting* them to a judge is a consent
  surface of its own (which proofs, how many, how recent — enough to answer "constituent right now?"
  without handing over a movement history).
- **Naming.** "Presence proof" / "witness" / "the bisect" are working words; the instruction-case names
  will emerge.
