# The human layer — consent as a platform gesture, the cracked judge, and the authority journal

> Status: **shaping note** under [Milestone: Origin](origin.md). Not built. Records the trust model at the
> one place the system touches a person: how consent is asked, why the keys are gesture-gated, what we can
> and cannot do about a possessed origin re-serving the service worker, and the forensic journal that keeps
> all of it legible to an imperfect judge. Companion to the three-rung ladder in
> [probe-line-consent.md](probe-line-consent.md); this is the *surface* the ladder is asked through.

## The cracked judge

Offline, there is no `FCCN-ANTIBODY/judge` in the loop. **You are the judge of your own stuff** — and a
*cracked* one: everything we do, we do imperfectly, so you might not notice a thing, or not connect it the
right way. The design goal is therefore **not perfect enforcement** — it's to **preserve the possibility of
noticing.** Anywhere the system touches the human layer, it must leave you *able* to be the detective later,
even if you often won't be. We recite our own constitutions here; they shift and change; we are the
imperfect authority over our own data, and the machinery's job is to keep that authority *legible* to us.

## Consent is a platform gesture, at an authority boundary — never web-painted

A prompt the app *paints* is chrome; once it's chrome, it's forgeable, so it's theater, so it trains people
to click through. The UI must not develop **a duty to UI** — throwing up "are you sure?" modals out of a
sense of responsibility. Those are exactly the surface an attacker imitates.

The web already exposes the right thing: **platform UI that is callable but not paintable** — the platform
authenticator (WebAuthn / passkeys / the Touch-ID-class prompt). You don't imitate it; when you see it, you
*know the platform summoned it*, not the page. That unspoofability is the point (not the aesthetic — the
liquid-glass look is not what you copy; the *provenance* is). It gives three things at once:

- an **unforgeable mnemonic** — "the real system is asking; this isn't a trick";
- a **human-presence proof** (user verification) a script cannot synthesize;
- a **signature** — the verdict is cryptographic, so it binds, not just a boolean.

**The rule:** the only consent surface is the platform gesture, and it is invoked **at a real authority
boundary — not per op.** The anti-spam property is *scoping*, which the [consent ladder](probe-line-consent.md)
already provides: a **standing grant** is one gesture that authorizes a *behavior or session* over time, and
the ops inside ride it silently. "I consent to a browse session in the tank" is **one** platform gesture that
mints the grant; everything the tank does under it needs no second ask. Minimize when we invoke the judge;
batch under a grant; make the one gesture unforgeable. (The [data:chamber](origin.md) has a null origin and
cannot summon a passkey — correctly, the gesture lives in admin-space, never the tank.)

### Passkeys offline (feasibility)

- **Using a passkey is fully offline** — `credentials.get()` is a local browser↔authenticator ceremony over
  a locally-generated challenge; nothing touches the network. Ideal for an offline origin.
- **Adding one offline works because we are our own relying party** — `create()` makes the keypair locally;
  we store the returned public key in the **pinned page's IndexedDB** (no server round-trip, which is our
  model anyway). The only friction is platform *polish*: some OSes nudge toward cloud **sync** at creation
  (sync needs network), so prefer a **device-bound** platform authenticator that stays usable offline.

## Keys are gesture-gated, so a swapped queen can't act as you

The service worker is now the **queen** of the app's bytes ([origin.md](origin.md)): after first contact +
firmware pin, it decides which shell code every page runs, and it enforces the possession guarantee. But its
own script is the one thing the browser re-fetches from the origin on update — so the queen is
**replaceable by a possessed origin** (see below). The load-bearing defense is to make sure that even a
replaced queen — or a compromised page — **cannot wield your identity without you present.**

So: keep the SW **verify-only** (no keys), keep the identity key in the **pinned page**, and **gate every
consequential *signing* behind the platform gesture.** Non-extractability stops *export*; the gesture stops
*silent use*. With that, a usurper can serve you different pixels but cannot sign your data, mint as you, or
push downstream as you without a live OS prompt you did not start — which the cracked judge can catch. This
turns "the origin can run a different agent" from **catastrophe** (it acts as you) into **nuisance +
detectable** (it can show you a screen; the moment it tries to *act* as you, the platform asks).

> **Open fork (to decide, not decided here): the key style.** Either (a) the **passkey is the signing
> identity** — cleanest human-gating, but its assertion is not the `ssh-ed25519`/SSHSIG the Tell verifies
> ([qr-provenance.md](qr-provenance.md)), so it breaks Tell interop; or (b) the **device Ed25519 key stays**
> (for interop) and the **passkey gates/unlocks its use** (e.g. a PRF-derived wrap, or a required
> user-verification step before each signing). Both are offline-viable. (b) preserves interop; (a) is
> simpler but siloed. This note only fixes that *some* unforgeable gesture gates signing.

## The possessed origin re-serving the service worker — honest analysis

The obvious hole, stated plainly: **within the pure browser model you cannot *prevent* a possessed origin
from shipping a new `sw.js`.** The browser reserves service-worker-update authority (it re-fetches the
script; `updateViaCache` only stretches HTTP caching, capped ~24h). Self-verification is circular — the SW
cannot refuse its own replacement, because the replacement is what runs after it installs, and it simply
won't run our check. Whoever controls the served worker can install a **different agent**; and an agent that
could build this can drive it. We do not pretend to close this by pinning the SW to itself. We defend in
depth:

- **Layer A — bound the blast radius (buildable today):** gesture-gated keys (above). A swapped queen can't
  act *as you*. This is the most important layer and it is pure-web.
- **Layer B — make the swap loud (prevention impossible → notify the judge):** pin the SW's expected
  fingerprint out-of-band and, on boot, surface "your firmware changed — did you approve this?" The
  transition (a new registration / changed script hash) is observable to the still-controlling old worker or
  an out-of-band checker even though a malicious new worker won't self-report. Telling the judge is the
  correct move when you can't prevent.
- **Layer C — the real escape, and the true purpose of the optical firmware:** own a **boot path the origin
  is not in.** When the app *is* the `data:`-chamber artifact you scanned/hold ([origin.md](origin.md)'s
  code-QR / recursive-favicon firmware), there is **no served origin and no SW to swap** — a possessed
  `anecdote.channel` is simply not in your loop. So the optical layer is not "pin the SW harder" (which can't
  fully work); it is **route around the origin entirely.** That reframes the "seal the SW" thread from a
  tidy capstone into the keystone: it makes the queen's unfixable hole *not matter*.

## The authority journal — a tamper-evident log where absence is a clue

Because the judge is cracked, the system keeps a durable, **tamper-evident journal** of everything that
touches authority: a grant minted (with what the user saw), a firmware change observed, a signing gated, an
offline payload accepted, a revocation. Each entry carries a **timestamp** and is **hash-chained** to the
prior one (each references the previous entry's hash — the same idiom as the Tell's delivery manifest and the
trove ledger). Two properties matter:

- **A funky little prompt you don't remember becomes checkable** — you can go back to *that day* and see what
  was authorized, instead of relying on memory.
- **Absence is a canary.** Sometimes the signal is not a bad entry but the **sudden absence of data** — a
  gap. Hash-chaining makes a deletion leave a **scar**: a broken link where an entry was removed, or an
  expected entry that never appears. The detective can find the seam. We are not promising you'll always
  notice; we are promising the trail *exists* so that noticing is **possible**.

The journal lives in the pinned page (admin-space) alongside the trove; the SW writes firmware-transition
observations into it. It is legibility infrastructure for an imperfect judge — the thing that, everywhere we
touch the human layer, keeps open the possibility of piecing together what happened.

## How this shapes what's next

- **Offline data transfer ("gravel").** Accepting a payload from a carrier (QR / peer / file) is itself an
  **authority-boundary gesture** — your friend-list "yes, from this signer." So gravel reuses this exact
  model: **verify at the queen's checkpoint (the SW), consent with the platform gesture in the pinned page**,
  and **journal the acceptance.** Same shape the firmware pin already proved (SW enforces, page consents).
- **Sealing the SW (thread 2).** Its real job is **Layer C** above — an origin-bypass boot path — plus
  **Layer B** notification, not an attempt to make the browser refuse a bad worker.

## Open questions

- **The key style** (the fork above) — passkey-as-identity vs. passkey-gates-Ed25519.
- **What warrants a gesture vs. a grant** — the exact authority boundaries (a browse session; a downstream
  push; enrolling a firmware signer) so the judge is asked rarely and meaningfully, never out of duty-to-UI.
- **Journal placement + shape** — hash-chain details, where it's stored so a shredded data-pile doesn't take
  the journal with it, and how (if ever) it's exported for off-device forensics without leaking.
- **Layer-B fingerprint mechanics** — how the SW's own expected bytes are pinned out-of-band and compared on
  boot without depending on the (possibly swapped) worker to be honest.
