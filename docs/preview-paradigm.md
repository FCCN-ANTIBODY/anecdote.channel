# The preview paradigm — a two-sided app, and the broadcast profiles that measure it

> Status: **shaping note**, captured 2026-09-19 from a working conversation, written down because a reboot
> was coming. The UI half is **ideation, not built and not being built yet**. The measurement half **is
> built** (`press/broadcast.mjs`, `press/broadcast.html`) because it was cheap and because it is the part
> that produces facts rather than opinions. Companion to [`offline-transfer.md`](offline-transfer.md) and
> `bottles.anecdote.channel/README.md` (the three renderings); the UI it describes is congruent with
> `press/counter.html` ([`../press/README.md`](../press/README.md)).

## The paradigm, as observed

The operator, 2026-09-19:

> *"ios apps like Runestone use the finder/preview thingy the way Preview and apple Pages and Keynote and
> stuff does at the splash. The lower half is a browser but you can make it full. it's weird, but it's a
> paradigm."*

It is worth naming because it is genuinely odd and genuinely load-bearing. Several first-party Apple apps
open not on a document and not on a menu, but on a **file browser that is half the screen**, with the other
half doing something else — and the browser can take the whole screen when you want it to. The split is not
a master/detail view and it is not a sidebar. It is *two things of equal standing, one of which is a way in*.

**The question this note exists to hold:** what does a *trivialized* iOS app of that shape look and feel like
when the other half — the part that is not the file browser — is **the bottle engine doing its thing**? A
Preview that is half "your files" and half "a bottle, as light", which can also **receive** files.

> *"i do wonder what a trivialized ios app looks and feels like (expo dev client stuff is suitable) for an
> app that is like Preview, but that top area is the QR bottle-engine doing its thing, and it can receive
> files."*

Expo's dev client is named as suitable, which matters mostly as a statement about *ambition*: this is a
proof, not a product. Nothing about the constellation requires a native app — the whole architecture is
built so it does not — so an app here is a way of **learning what the paradigm feels like in the hand**,
and of reaching the two things a browser tab cannot: the system file surface, and a camera that behaves.

## Why The Counter is the congruent one

`press/counter.html` was built the same day, from a different starting point (D14's *"an act between two
people who are present"*), and arrived at the same shape: **two halves, equal standing, each a verb.** Hand
over on top, take underneath.

The operator's own reading of it, and the reason this note is filed against The Counter rather than against
the press in general:

> *"This feels most like The Counter, which is intriguingly simple and why this comes to mind as I've played
> with iOS UI. It's the least capable for first-order choices, but it's also obviously a complete version of
> the concept."*
>
> *"It's not the winner design but it's congruent with that ios proof."*

Both halves of that are the finding, and the second half is the one that usually gets lost:

- **Least capable for first-order choices.** From The Counter you cannot browse, cannot search, cannot get
  to a pile without going through a verb first. Every other skin beats it on reach.
- **Obviously a complete version of the concept.** Nothing is missing. The two things the system is *for* —
  give a thing, take a thing — are both there, at full size, with nothing in front of them.

**A design can be complete and not be the winner, and saying so is not a criticism of it.** The Counter's
job in this constellation may turn out to be exactly this: the shape you build when you are proving the
paradigm, because it has no parts that are not the paradigm.

**The mapping, if the app is built.** The Counter's top half (hand over, slate) is the preview paradigm's
*other half* — the bottle engine doing its thing. The Counter's bottom half (take) is where the file browser
would go, because taking is what a file browser is **for** here: it is not "your documents", it is *the
things you have been handed and the things you might hand on*. Receiving a file from the system share sheet
lands in the same place a caught bottle does. That is a guess and it is the cheapest part of this note to
throw away.

## The instrument: three ways to cut a bottle up, and the floor each sets

The other half of the conversation was what to point the second phone at. The operator asked for *"a
baaaaasic do-nothing-but-broadcast target file, but offer options for how we know how to cut it up"*, and
named three ways, which are now the three profiles in [`../press/broadcast.mjs`](../press/broadcast.mjs):

| profile | her words | the property |
| --- | --- | --- |
| **stream** | *"Every frame is technically valid even if there are 300k of them (it's reeeaaallll…)"* | redundancy in **time**. Rateless: frame 300,000 is as valid as frame 0, so a late arrival is never late and a loop can heal |
| **collage** | *"n chunks playing in tiled/collage video"* | redundancy in **space**. One read of the screen catches n pieces, so a camera that gets one good frame in ten can still finish |
| **still** | *"a single frame that is just a single QR of our bytes"* | no loop and no playhead. A **glance**, not a transfer — while the payload fits one code |

And a second axis, orthogonal to all three, because "chunks" has two honest readings and both are worth
having: **droplets** (any sufficient subset rebuilds it) or **blocks** (a fixed set, each needed exactly
once). `press/broadcast.mjs` takes both as `cut`.

**Every plan reports a FLOOR** — the fewest screen-reads a perfect camera would need. That is the whole
design of the instrument: everything on the page except one number is arithmetic, printed so that the one
measured number has something to be measured against. **Observed ÷ floor is the yield**, and the yield is
the camera, the screen, the glare, the distance and the hands. It is the thing two phones can tell you and
nothing else can.

### What it already says (measured 2026-09-19, `node press/broadcast.test.mjs`)

A 27 KB bottle at error correction M, 8 screens/second, against a *simulated* receiver — so these are the
optics-free baseline the phones get compared to, not a prediction about phones:

| cut | block | pieces | floor | observed | overhead |
| --- | ---: | ---: | ---: | ---: | --- |
| stream / droplets | 128 B | 212 | 212 screens (26.5 s) | 251 | **1.18×** |
| …with ⅓ of screens missed and every 5th damaged | 128 B | 212 | 212 | 467 | costs time and nothing else |
| collage of 9 / droplets | 128 B | 212 | **24 screens (3.0 s)** | 28 | same code size per tile — *the screen pays, not the code* |
| collage of 4 / blocks, no loss | 256 B | 106 | 27 | **27** | **none at all** |
| …with ¼ of screens missed | 256 B | 106 | 27 | 51 | a miss waits for the loop |

Three findings fall out, and none of them was obvious in advance:

1. **A block cut with no loss is exactly its floor.** Zero overhead — better than the fountain, which pays
   ~18% for being rateless. The fountain wins the moment anything goes wrong, and only then. *Which cut is
   right is a question about the room, not about the format.*
2. **The collage buys wall-clock time at no cost in code density.** Nine tiles divided the floor by nine at
   the same v12 65×65 per tile. What it spends is *screen area*, which is why the target draws the tiles at
   the scale they actually get rather than hiding the trade behind a scrollbar.
3. **The still has a hard ceiling and it is worth knowing exactly.** 2,953 frame bytes at level L, 1,273 at
   level H — so roughly a 2 KB payload at best, and a ~1 KB anecdote fits in a single v31 code. Under that
   line, "hand someone a bottle" needs no loop, no video and no playhead at all. **That is a product fact,
   not a format detail**, and it is why the still is a profile rather than an optimisation.

`blockSize` is the knob everything else hangs off, and `transfer.mjs` says outright that *"the platform has
NO opinion about N"*. Measured: 64 B → 424 pieces at v10; 128 → 212 at v12; 256 → 106 at v16; 512 → 53 at
v23. Bigger blocks mean fewer pieces and a denser code — fewer things to catch, each one harder to catch.
**The trade is legible now and it was not before.**

## How to run the two-phone test

1. One phone opens `/press/broadcast.html`, makes or takes a payload, picks a profile, presses **full
   screen**. The tuning line states the floor and counts what it has shown.
2. The other opens any press skin's *read a bottle* (or `counter.html` → **Take**). It reports what it
   actually caught, and how many damaged frames it healed around.
3. Record: profile, cut, blockSize, ec level, fps, phone models, distance, lighting — and **observed
   screens ÷ floor**.

Front camera and screen, as the operator framed it, is the hard case on purpose: a front camera is the worse
lens on every phone, and two screens facing each other is the worst geometry for glare. If a profile works
there, the rear-camera case is not in question.

**Everything in that loop is already built and tested** (`probe-test/press.ui.test.mjs` catches across
origins through deliberately damaged frames). What is missing is a phone, a second phone, and someone to
hold them — which is exactly the kind of gap that does not get smaller by being designed at.

## Open

- **Does the app get built at all?** The paradigm can be felt in a browser tab on a phone, badly. The two
  things a tab cannot reach are the system file surface and a camera that behaves. Whether those are worth
  an Expo dev client is unanswered and should stay unanswered until the two-phone numbers exist, because the
  numbers may say the optical path needs the native camera or may say it does not.
- **Which half is the browser.** The mapping above (take = file browser) is a guess from one sitting.
- **Whether the collage should be droplets of one bottle or tiles of several.** `bottles/README.md`'s
  *enchanted* rendering is nine tiles of the **same** frame in different contrast schemes — redundancy
  against glare. This note's collage is nine **different** pieces — redundancy against time. They are
  different axes and they compose (a 3×3 of distinct droplets, each re-rendered three ways, is a 27-tile
  screen). Nobody has tried it and the arithmetic does not settle it.
- **A recording is still a first-class artifact** (`bottles/README.md`: *"A single one-shot recording is as
  good as nine loops"*). The target does not yet emit one; `press/ui.mjs`'s pour panel does. They should
  probably be the same code.
- **Where the bottles driver ends and the press begins.** D18 divides it by sense (the lens is the driver's,
  the catching is ours) and explicitly calls that a working arrangement rather than a ruling.
