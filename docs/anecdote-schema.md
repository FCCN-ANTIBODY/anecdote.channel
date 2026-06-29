# The anecdote schema (`anecdote/v1`) — what a confirmed send hands off

> Status: **first real cut.** The shape is implemented and tested
> ([`composer/anecdote.mjs`](../composer/anecdote.mjs), [`composer/anecdote.test.mjs`](../composer/anecdote.test.mjs));
> the **signing** and **platform validation** of references are deliberately left as seams (below).
> This is the payload the [composer](../composer/README.md) builds *after* `route.prepare`, when a
> statement actually leaves the device.

## Why a schema, and why now

The composer already takes you from a typed statement to a routed hand-off —
`route.prepare` returns `{ to, label, text }` — but stops before "the actual signed send"
(`composer/README.md` → *Not in this slice*). An **anecdote** is what that hand-off becomes when it
goes: the single quantum that flows through the channel. The boundary work upstream forced the
question — a Tell that declares a GeoJSON boundary is just **minting an anecdote whose content is a
shape**, which means an anecdote's content "could be anything." That is the useful, slightly
alarming realization this schema has to answer: *if content can be anything, what does anecdote
actually carry, given it must not become a host for arbitrary files?*

## The shape

```jsonc
{
  "schema": "anecdote/v1",
  "to":    { "id": "foco", "kind": "atlas", "url": "https://…" },  // from route.prepare
  "label": "park needs more shade",                                 // the reducer's fewest-verbs subject
  "body": [
    { "kind": "text", "text": "The park needs more shade", "label": "park needs more shade" },
    { "kind": "ref",  "mediaType": "application/geo+json",
      "hash":   "sha256:…",            // the content address — the "you have it" proof
      "source": "drawn by me",         // provenance — "it came from here"
      "pile":   "refs://mine",         // optional: YOUR references data-pile that holds the bytes
      "bytes":  "<base64>",            // optional: an included copy (omitted = receipt only)
      "receipt": { "schema": "anecdote.receipt/v1", "hash": "sha256:…", "source": "drawn by me", "pile": "refs://mine" }
    }
  ]
}
```

- **`body[0]` is always the statement** — the verbatim text you typed, with the reduced `label`
  riding along as the subject. anecdote never rewrites you (CONSTITUTION §"Responses": the reducer
  *shapes and shows*, it does not write on your behalf), so the raw `text` is kept exactly.
- **Every other part is an attachment**, and attachments are the interesting part.

## Text rides inline; everything else rides as a *receipt*

The core decision, drawn straight from "we don't want to host arbitrary files":

- **Text is inline.** It is the statement; it is small; it is the thing being said.
- **An image, a GeoJSON shape, a citation — anything with bytes — rides as a `ref`:** a **receipt**
  that says *"I have these bytes, and they came from here."* A receipt is a **content hash**
  (`sha256:…`, the "you have it" proof) plus a **source** (provenance, "came from here"), and
  optionally a **`pile`** pointer to *your own references data-pile* that actually holds the bytes.
- **Including the bytes is optional.** You *may* carry an inline copy (`include: true` →
  `bytes` as base64), but the **canonical thing is the receipt**, not the file. Over
  [`INLINE_MAX`](../composer/anecdote.mjs) the inline copy is dropped and only the receipt travels —
  the anecdote can never bloat into a file host.

This is the same move the rest of the channel already makes, said for content:

- **Content addressing makes the source not matter** (`docs/DELIVERY.md`): once a consumer can verify
  a hash, it can accept the bytes from anyone — a CDN, your pile, a neighbor's screen. A receipt is
  just that hash with its origin attached.
- **Opinions are public; the data that moves is licensed** (the Atlas exposure model): the receipt is
  the *opinion-layer* artifact (public, small, says what you cited); the bytes live in your
  references pile and are **resolved/licensed consentfully**, never hosted on the public surface.
- **`basis[]` from the Tell voucher** is the same idea one tier down: a claim plus *what it's made
  of*. A reference is what an anecdote is made of.

So an anecdote with a boundary, a photo, and a quote is one statement plus three receipts — each
proving possession and provenance, each resolvable from a pile under consent, none of them hosted
here.

## The references pile

"It might go straight to a local data-pile that is your references." A **references pile** is an
ordinary [data-pile](https://github.com/FCCN-ANTIBODY/data-pile) you own, holding the bytes you cite.
The anecdote points at it (`ref.pile`) and carries the receipt; the bytes stay yours. This keeps the
privacy posture intact: nothing about *what you attached* is forced into the open beyond the receipt
you chose to attach, and the bytes are licensable on your terms — the data-pile already owns "decide
if it is ever proven public."

## What the code does today

[`composer/anecdote.mjs`](../composer/anecdote.mjs), a pure core in the house style (no DOM, no
network, no event loop; the one heavy primitive behind a seam):

- `build(routed, attachments, opts)` — turn `route.prepare`'s `{to,label,text}` plus raw attachment
  descriptors into an `anecdote/v1`. Each attachment becomes a `reference` (receipt).
- `reference(attachment, opts)` — hash the bytes, build the `ref` part + its unsigned `receipt`,
  optionally carry an inline copy (bounded by `inlineMax`).
- `validate(anecdote)` — **structural** check the platform can run on anything it receives **without
  holding any bytes** (schema, destination, a real statement at `body[0]`, every receipt covers its
  part's `{hash, source}`).
- `verify(anecdote, opts)` — for any reference that **included** a copy, recompute the hash and
  confirm the carried bytes match the receipt (catches tampering); receipt-only references report as
  "not locally resolvable."
- `defaultHash` — SHA-256 via SubtleCrypto (browser) or `node:crypto` (Node), dependency-free;
  pluggable like the reducer's embedder.

## Signing (implemented — [`composer/sign.mjs`](../composer/sign.mjs))

"Something signed to say you have it, and it came from here" is now real. A signed anecdote grows
three fields, and the signature covers **the whole envelope** (so it covers every receipt — signing
the envelope *is* signing "you have it"):

```jsonc
{
  "schema": "anecdote/v1", "to": …, "label": …, "body": [ … ],
  "agent": { "instrument": "minilm:sha256:…", "constitution": "anecdote:sha256:…" },
  "nonce": "<platform-minted handle>",
  "sig":   { "alg": "ed25519", "by": "key:sha256:…", "key": "<base64 raw pubkey>", "signature": "<base64>" }
}
```

The honest cryptography of a **no-backend device** (CONSTITUTION: *"no persistent backend… just
auditable evidence and signatures"*):

- **One real signature — the constituent's.** The only secret-holding party on the device is the
  person. They sign the canonical envelope with an **Ed25519** device key (matching the
  constellation's `ssh-ed25519` identities). `alg` is in the sig block, so it is never frozen.
- **The Mobile LLM co-signs *without a key*.** It is a public, vendored, **hash-pinned** instrument
  (`reducer/model.lock.json`) — identical for everyone — so it cannot hold a secret; forging a
  keypair for it would be theater. It co-signs the only honest way a content-addressed thing can: its
  **verifiable pinned identity** (`agent.instrument`, the instrument version hash) and the
  `constitution` it ran under are **bound into the bytes the constituent signs**. The human's
  signature thus vouches "this exact pinned agent was involved" — which is what §"Mobile LLM" asks.
  If a real agent-key model ever exists, it slots in as a second `sig`.
- **Pseudonymous, accountable.** The public id is the key **fingerprint** (`sig.by`,
  `key:sha256:…`), presented behind a **revocable `nonce`**. The nonce is bound under the signature
  so a platform can tie an anonymous, unrevoked slot to a submission **without learning who** —
  minting and revoking it stay the platform/Tell's job (the Tell already mints an HMAC capability;
  the data-pile already owns join/leave).

`verifySignature` recomputes the canonical bytes, checks the signature against the **embedded** key,
and confirms that key's fingerprint equals `sig.by` — so swapping the content fails the signature and
swapping the key fails the fingerprint. It reports *who* signed; whether that identity is
expected/unrevoked is the consumer's call against the nonce. Canonicalization is deterministic
(sorted keys, no whitespace) so the same logical anecdote always signs identically.

## Open questions (recorded, not resolved)

- **How does the platform validate a reference whose bytes it cannot see?** Today: verify the
  **envelope signature** (which covers every receipt) and, when an inline copy is present, the
  **hash**. The bytes themselves resolve later from the `pile` **under license/consent** — that
  resolution + its consent gate is unspecified. ("I don't know how the platform validates that
  exactly, but this is the shape of it.")
- **Nonce minting + revocation.** The signature binds a `nonce`, but minting it (the Tell's HMAC
  capability is the concrete instance) and revoking it (the data-pile's join/leave) are the
  platform's job, unspecified here. How a verifier maps an unrevoked nonce to "one anonymous,
  accountable slot" without de-anonymizing is the live question.
- **Private-key custody.** `generateIdentity` currently returns an extractable key for portability;
  on-device it should be **non-extractable** and stored as a `CryptoKey` in domain-scoped IndexedDB
  (never serialized). A hardening pass, not a shape change.
- **Media types and limits.** Which `mediaType`s a destination will *offer* (the routing verdict
  could extend from topic tokens to attachment kinds), and the real `INLINE_MAX`.
- **Receipt time/identity.** The receipt omits a timestamp for determinism; a signer adds time +
  identity at signing. Where exactly that lands (in the receipt vs. an envelope signature) is open.
- **GeoJSON as a first-class kind.** A boundary anecdote is a `ref` of `application/geo+json` today;
  whether the Tell-side boundary declaration profile (polygon + `basis[]`) needs its own named part
  is the cross-repo seam back to `tell.anecdote.channel/notes/boundary-declaration.md`.
- **The reducer over attachments.** Text reduces to a label; an image or shape does not. Whether (and
  how) an attachment contributes to the riding subject is unexplored.
