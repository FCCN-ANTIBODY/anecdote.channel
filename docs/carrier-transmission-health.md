# Carrier transmission health — will this loop survive the trip?

> Status: **measured, 2026-09-04.** Empirical, from a real round trip: a rendered
> droplet loop ([`composer/carrier.mjs`](../composer/carrier.mjs) →
> [`composer/qr-encode.mjs`](../composer/qr-encode.mjs)) was sent over SMS and the
> degraded copy measured against the original. Raw data, scripts and the sample
> live outside this repo in the FCCN-ANTIBODY workspace at
> `renders/lucky-sevens/_degradation-study/`.

A droplet loop that leaves our hands gets re-encoded by somebody else's pipeline —
SMS, a repost, a screen recording. This is what actually breaks, and the two
numbers that predict it before you ship.

## The result that motivated writing this down

A 584×584 loop of 261 frames went through SMS and came back **192×192**. It still
reassembled the full 16,358-byte payload, signature verified, **in a single
pass**. Of 234 frames that decoded both before and after, all 234 agreed byte for
byte. The pixel histogram had gone from 2 distinct values to 220, with 16.8% of
pixels sitting in ambiguous midtones — and QR binarization plus Reed–Solomon
absorbed all of it.

SMS did not drop frames, reorder them, or change the frame rate. **The damage was
purely spatial**, which is the one kind the fountain cannot help with: it is
already insurance against loss and disorder.

So the good news is real, but it is not a guarantee. It is one sample from a
channel that happened to stay above the floor.

## Number one: 2.0 pixels per module, and it is a cliff

    modulesTotal = qr.modules + 2 × quietModules
    pxPerModule  = outputWidth / modulesTotal

Measured across a downscale ladder (65-module QR, 4-module quiet zone, so 73
across):

| px/module | frames decoding | payload reassembles |
| ---: | ---: | :--- |
| 4.38 | 100.0% | yes |
| 2.63 | 96.9% | yes *(where SMS landed)* |
| 2.19 | 96.6% | yes |
| **1.97** | 82.4% | **yes — last one that works** |
| **1.75** | 11.5% | **no, and 40 passes did not help** |
| 1.53 | 0.0% | no |

Nyquist, exactly: two samples per module. Above it the stream lives, below it the
stream is gone. There is no graceful degradation between.

Two consequences that are easy to get wrong:

- **Decode rate oscillates above the floor rather than declining smoothly.** In
  the ladder, 3.51 px/module scored *worse* than 3.07 — non-integer px/module
  lands module edges mid-pixel and smears them. A single decode-rate sample is
  therefore a bad health metric. Headroom in px/module is the good one.
- **Below the floor, looping buys nothing.** The same frames fail every pass, so
  replaying adds no information. The fountain protects against *random* loss;
  this is *systematic* loss.

## Number two: usable frames ≥ 1.2 × K

The fountain needs about **1.2 × K** distinct droplets to rebuild (measured: 202,
204, 208 and 213 frames consumed against K=174 — efficiency 1.16–1.22). Since a
render emits `overhead × K` frames:

    decodeRate needed  ≈  1.2 / overhead

| overhead | decode rate the stream needs |
| ---: | ---: |
| **1.5× (current default)** | **80%** |
| 2× | 60% |
| 2.5× | 48% |
| 3× | 40% |

This is the number that bites. **At the 1.5× default a loop needs four frames in
five to decode**, which sounds comfortable and is not: it leaves almost no margin
for a channel worse than the one we happened to test.

It also explains a failure that px/module alone does not. At 144px, EC L decoded
64.4% → **168 usable frames against K=174** → arithmetically impossible, dead
forever. EC M at the same size decoded 82.4% → 215 frames → caught in one pass.
The weaker-looking render won because it cleared the frame count.

## Overhead is the strongest lever

Same payload, same EC, same 144px output, same ~65% decode rate — only overhead
changed:

| render | usable frames | K | result |
| --- | ---: | ---: | --- |
| overhead 1.5× | 168 | 174 | never reassembles |
| overhead 3× | 344 | 174 | **caught in one pass, verified** |

Raising overhead turned a permanently dead stream into a live one without
touching resolution, EC or payload. It costs loop length and nothing else — and
for a loop that plays forever behind a video, loop length is the cheapest thing
we have.

## EC level: prefer L, for a reason that is architectural

EC **L** yields a 61-module QR where M yields 65 — 6% larger modules at the same
output size, with **identical frame count and loop length**. Above the floor it
wins consistently (98.5% vs 96.9% at 2.6–2.8 px/module; 91.2% vs 79.3% one step
down). Near the floor it goes noisy, and **it does not move the floor** — it only
changes which pixel width corresponds to 2.0 px/module.

The reason to prefer it is that **per-frame error correction is largely redundant
here: the fountain is the error correction, across frames.** A frame too damaged
to read is just a miss, and misses are precisely what the carrier is built to
absorb. Spending modules on in-frame redundancy buys a second layer of the
protection we already have, at the cost of the one resource that actually decides
survival — module size.

## Block size is the wrong knob

Each frame carries a fixed ~120-character header (hash, signature, indices), so
shrinking `blockSize` shrinks the QR much less than it multiplies frames:

| block | frame chars | version | modules | frames @1.5× | loop @4fps |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 128 | 277 | v12 | 65 | 261 | 65s |
| 64 | 192 | v10 | 57 | 522 | 131s |
| 32 | 148 | v8 | 49 | 1043 | 261s |

Halving the block buys 12% smaller modules and doubles the runtime. **If frame
size needs to come down, shorten the header, not the block.**

## Recommended defaults

- **`--overhead 2.5`** rather than 1.5. Turns an 80%-decode requirement into 48%.
- **`--ec L`** rather than M. Free; same frames, same seconds.
- **Never emit fewer than ~50 frames**, whatever the overhead says. Small-K
  payloads cannot span their own blocks at low overhead — a 25-block payload
  already had to be re-rendered at 2× to pass its own catch test.
- **Record the floor in the manifest**: `modulesTotal`, and
  `minOutputWidth = 2.0 × modulesTotal` — the width at or below which the loop is
  dead. Cheaper than re-deriving it later.
- **Raise the catch test's simulated miss rate to ~40%.** At 25% everything
  passes, and it did not predict the frame-count failure above, because that
  failure is about absolute count rather than miss rate.

## What this does not cover: dwell time

At 4fps, catching `1.2 × K` frames takes `1.2 × K / 4` seconds of *continuous*
filming at best. For K=707 that is **three and a half minutes** of holding a phone
at a screen. Raising overhead does not help — dwell is a function of K, which is a
function of payload size. Levers are higher fps, splitting the payload, or
accepting that large bottles are pause-and-rewind artifacts rather than
scan-and-go ones. For anything published as "point your camera at this", **size
the payload against the dwell you can ask of a person.**

## Caveat on the measurements

Decoding used OpenCV 4.8.1's `QRCodeDetector` at 1×/2×/4× upscales per frame. At
these module sizes the detector — not the damage — is the limiting factor: the
SMS copy scored 95.0% against the pristine original's 93.9%, and their failure
sets overlapped in only 2 frames of 261. A real phone will do **better** than
these numbers. Treat every percentage here as a floor, and the two thresholds as
conservative.
