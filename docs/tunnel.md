# The runtime tunnel — a host opens us by iframing us and saying hello

> Status: **first real cut.** Protocol + guest orchestration implemented and tested
> ([`composer/tunnel.mjs`](../composer/tunnel.mjs), [`composer/tunnel.test.mjs`](../composer/tunnel.test.mjs));
> the postMessage transport is the thin browser-only view at the bottom of that file. This is the seam
> that turns the pieces — reduce → route → build → sign → nonce → trove — into one embeddable intake.

## The picture

A **Tell-as-a-service is just a poll sheet** in someone's browser. When a response **goes out the
door**, that page should not hand-roll a submission. Instead it **embeds anecdote.channel in an
iframe** and **says hello**. anecdote becomes the **data-assisted intake**:

1. **canonical labeling** — the reducer shapes the answer to its fewest-verbs kernel;
2. **build** — into an `anecdote/v1` (text inline, attachments as receipts);
3. **sign + nonce** — signed on-device with a freshly minted revocable nonce, the Mobile LLM
   co-signing by its pinned identity;
4. **leave the receipt with anecdote** — recorded in **our own trove**, on the **anecdote.channel
   origin**;
5. **put it where it belongs** — hand the host the artifact to deliver: a **Tell for private**
   (the issue-as-input), an **Atlas for unsolicited**.

## Why an iframe (and not a library the Tell bundles)

The two things that give a constituent power — the **signing key** and the **trove** — must live on
the **anecdote.channel origin** (domain-scoped storage; CONSTITUTION §"Mobile LLM" / §"Aggregation").
A Tell page on *its* origin cannot reach them, and must not. The iframe puts anecdote on its own
origin inside the Tell's page; the tunnel is the **only door** between the two.

This is also what makes the trove **one trove**: whichever Tell's page you are answering, the iframe is
the same anecdote.channel origin, so *"all the nonsense you ever sent"* accumulates in **one** place
you control — exactly the home the consent model wants.

## The protocol (pure, in [`tunnel.mjs`](../composer/tunnel.mjs))

| message | dir | meaning |
|---|---|---|
| `…hello/v1` | host → guest | open the tunnel; declare the **destination** `{kind,id,url,excludes?}` and the **poll** context (poll/round/asker/question) the Tell already holds |
| `…ack/v1` | guest → host | ready; names the **pinned instrument** that will co-sign and what it `accepts` |
| `…intake/v1` | host → guest | a **confirmed** answer going out the door (`text` + optional attachments) — sending this *is* the user's confirmed action |
| `…built/v1` | guest → host | the **signed** anecdote + a **receipt** summary (nonce/status/label) + `where` it belongs + `deliver` (the artifact to submit) |
| `…declined/v1` | guest → host | **not offered** here — never "blocked" — with the reason and the offending topic |
| `…error/v1` | guest → host | malformed/out-of-order/origin-refused |

The guest is a small **stateful session**: `hello` fixes the destination + poll; `intake` reduces →
checks the destination's verdict → (if offered) `prepare` → `build` → `mintNonce` → `sign` →
`record`. The **poll context is bound under the signature** (the response is cryptographically tied to
the poll it answered; it is passed through from the Tell, never invented by us).

## "Out the door" = the issue-as-input seam

For a **Tell**, `deliver.kind = "tell-issue"`: the signed anecdote becomes a GitHub **issue or
comment** — the ingress the Tell already expects (`tell.anecdote.channel/CONTRACT.md` → *"Ingress: QR →
authorized Issue → digest"*). Either the host posts it itself, **or** — if `hello` supplied an `egress`
config (repo, mode, canonical issue, run, and the semi-public post credential) — **anecdote posts it for
the host** and records a `delivery` against the nonce, so the page becomes the **detail view of its
async status** (queryable later via `status({nonce})`, surviving a tab close). See
[`docs/egress-github.md`](egress-github.md). For an **Atlas**, `deliver.kind = "atlas-public"`: an
unsolicited public submission. We never reach out except on a confirmed intake; nothing else phones home.

## Trust model (narrow on purpose)

- **The host must prove who it is going to talk to — at `hello`, before we sign anything.** Two honest
  ways, no secret in the browser (`verifyDestination`):
  - **origin-bind (a Tell).** The embedding page must be **served from the destination's own `url`** —
    the browser attests `event.origin` and cannot be made to lie, so this proves domain control for
    free. A page therefore cannot claim to *be* a Tell it isn't served from. (A Tell is listed
    nowhere; its `url` *is* its identity.) The ack reports `verified: "origin"`.
  - **registry (an Atlas).** An Atlas is public and in anecdote's **own** cache of registered Atlases,
    so we verify the claim against what we already know (`deps.knownAtlas`), never the host's word —
    even cross-origin. The ack reports `verified: "registry"`. Without a registry, an Atlas falls back
    to origin-bind.
  This is **one-directional on purpose**: the host proves *itself*; we never ask it to prove anything
  about the **user** — that asymmetry is the anonymity.
- **The poll token rides to the door, not under the signature.** `hello` may carry the Tell's
  server-minted poll capability (`tok`); we thread it onto `deliver` so the **Tell verifies it at its
  own door** (`bin/authz`), and we deliberately keep it **out of the signed anecdote** — it is the
  Tell's authority, not the user's words.
- **Origin-checked transport, too.** The guest also gates by an `allowedOrigins` policy before opening;
  the host connects with an **explicit** anecdote `targetOrigin` and ignores any other
  (`connectTunnel` refuses `"*"`).
- **Nothing signs or records except on an `intake`.** `hello` only establishes (and proves) context. An
  intake represents the user's confirmed "send" — consistent with §"Mobile LLM" (no event loop for
  anything but a user-confirmed action; confirmation never mandatory in the UX the host wraps around us).
- **The host never touches the key or the trove.** It receives only the finished, signed artifact to
  deliver and a receipt *summary*; the full record stays on the anecdote origin.
- **Never blocked, only routed.** A statement a destination doesn't offer comes back `declined` with
  the reason — the composer's "no stupid statements," enforced at the tunnel.
- **A backstop beneath the handshake.** The user's signature binds `to` (the destination) under it, so
  even a lie that slipped the handshake is recorded in the trove and rejected on a `to`-mismatch at the
  receiver.

## Open questions (recorded, not resolved)

- **The Tell-issue payload mapping.** `deliver` now carries the signed anecdote + poll context + the
  carried `token`; mapping that onto the Tell's exact `tell.submission/v1` Issue body is the cross-repo
  seam the Tell page closes (it already mints the `tok` it now hands us back).
- **Allowed-origins policy** — who may open a tunnel *at all* (the coarse `allowedOrigins` gate, above
  the per-destination proof): any origin, a registered set, or "ask the user the first time a new
  origin says hello." Still open.
- **The browser-probe handshake.** "Transmit on browser probe to anecdote.channel for a signed
  nonce-gen when it goes out the door" — the concrete embed/probe flow (auto-iframe vs. user gesture,
  visible vs. headless) needs a worked HTML demo, the way `crunch.html` made the worker bus tangible.
- **Identity persistence.** The guest is handed an identity; on device it must load/persist a
  non-extractable key in the trove store on first run.
- **Allowed-origins policy.** Who may open a tunnel — any Tell, a registered set, or "ask the user the
  first time a new origin says hello."
- **Offered media.** `accepts` advertises `text`/`ref`; gating which attachment media a destination
  will take is unbuilt (extends the routing verdict).
