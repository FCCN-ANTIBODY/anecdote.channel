# The revocable nonce, the trove, and the removal of consent

> Status: **first real cut.** Implemented and tested ([`composer/consent.mjs`](../composer/consent.mjs),
> [`composer/consent.test.mjs`](../composer/consent.test.mjs)) on top of the signing primitive
> ([`composer/sign.mjs`](../composer/sign.mjs)). This is the part that makes a constituent's power
> over their own data **real**, and enshrines its withdrawal.

## Why this matters most

A data broker claims consent it never had and can never prove; it sells your shadow and you see
none of it. Anecdote inverts every term of that. The mechanism here is the proof: each contribution
is **signed**, tied to a **revocable nonce**, kept **whole** in a trove **you** hold, and
**withdrawable by you alone, at any age.** "New buyers for old information" pay *you* through these
live systems — and the existence of this loop is the standing demonstration of what consent and
proof actually entail, which the brokers are not doing **at all**.

## The nonce — an anonymous, revocable handle

Every anecdote you send carries a per-submission **`nonce`**: random, high-entropy, derived from
nothing about you, and **bound under your signature** (`sign.mjs` folds it into the signed bytes). It
does two jobs at once:

- **It anonymizes.** It is not your name and links to nothing — not to you, not to your other
  submissions. The platform can tag a contribution with its nonce without ever learning who or
  correlating what.
- **It is the revocation handle.** Because it is bound under your key, a **signed revocation naming
  that nonce** is something only you can produce — so withdrawing consent is a cryptographic act, not
  a request to a support desk.

`mintNonce()` produces `nonce:<22 url-safe chars>` (16 random bytes).

## The trove — "we hold all of them, ever," and it's here

anecdote.channel is the **domain-scoped space where all of it lives** — so it is the natural home for
the **complete local record of everything you have ever transmitted.** Each entry is a receipt:

```jsonc
{
  "schema": "anecdote.receipt/v1",
  "nonce":  "nonce:…",
  "to":     { … }, "label": "…", "by": "key:sha256:…",
  "film":   "<the exact bytes you transmitted>",   // see below
  "signed": { … the whole signed anecdote/v1 … },
  "status": "live",                                  // live = offered & earning · revoked = withdrawn
  "revocation": null,
  "placements": []                                   // where it is now + what it has earned
}
```

It is kept in the reducer's same `{get, set, delete}` store — `memoryStore()` for tests,
`idbStore()` (per-origin IndexedDB) on device. `list()` is the prominent **"view what you've already
said"** surface; `get(nonce)` opens one.

## The film — the exact QR you saw, kept forever, elegantly

You wanted to keep *the exact QR they saw* — and to do it beautifully, on "the little film." The
elegant form is to **not store pixels at all.** A QR is a deterministic render of its content, and the
content is the canonical signed anecdote. So the trove keeps the **`film` = the exact transmitted
bytes** (`canonicalize(signed)`), a few hundred of them, and the identical QR can be re-rendered on
demand, forever. "Every receipt you want, darling — it's here; tell me which one and you can look
again, or destroy it right now." (Rendering those bytes to an on-screen QR — and the optical fountain
for the big ones — is the seam in [`docs/DELIVERY.md`](DELIVERY.md); the trove already holds
everything that render needs.)

## Removal of consent — the act, in three moves

- **Keep.** Do nothing: the contribution stays `live`, offered into the datasets Anecdote solicits to
  your city, earning for you.
- **Revoke.** `revoke(store, nonce, identity)` mints a **signed `anecdote.revocation/v1`** for that
  nonce and flips the local status to `revoked`. The revocation is the artifact you transmit to pull
  your data. **Only the original signer can revoke** — the identity's fingerprint must match the
  contribution's `by` — so no one withdraws your consent but you, and no one fakes yours. `verifyRevocation`
  confirms both the signature and that the revoker *is* the original contributor. Works no matter how
  old the contribution is.
- **Forget.** `forget(store, nonce)` hard-deletes the local receipt. This is distinct from revoking:
  forgetting drops your *own copy*; it does not by itself withdraw consent already given — **revoke
  first, then forget** if you want both.

## Where your data is, and what it earned

`recordPlacements(store, nonce, […])` attaches, to a receipt, where a contribution currently lives
and what it has earned — the surface behind "look at where your data is now and what it has earned for
you in those live poll & results systems." The platform feeds these; the core only holds the place to
show them.

## Open questions (recorded, not resolved)

- **Practical fulfilment of revocation** across datasets already delivered to buyers. The signed
  revocation is honored in what Anecdote *offers going forward*; clawing back a copy already sold is a
  real, hard problem **we are happy to ignore for now** — the constituent-side instrument that
  *demands* it is what this slice builds.
- **Nonce minting vs. the Tell's capability.** The Tell already mints an HMAC authorization token for
  a poll; this consent nonce is the constituent's *own* handle. How the two compose (does the Tell
  echo the nonce back as the "Human Receipt of a nonce we give you" the CONSTITUTION mentions?) is the
  cross-repo seam.
- **Per-submission keys** for maximum unlinkability (a fresh identity per contribution, all held in
  the trove) vs. one device identity + per-submission nonce (today). A privacy/UX trade to revisit.
- **Trove scale.** "All of them, ever" in one domain-scoped store is fine now; sharding/pruning of the
  local record is deferred.
- **Placements/earnings accounting** — the live-poll economics that fill `placements` are platform-side
  and unspecified here.
