# The probe line — shaping (edges first)

> Status: **shaping note** under [Milestone: Origin](origin.md). **Not a spec** — we identify *edges*.
> The edges are now walked and the protocol is specified in **[`probe-line-v1.md`](probe-line-v1.md)**
> (implemented in [`composer/probe-line.mjs`](../composer/probe-line.mjs), verified end-to-end in Chromium).
> The lens: the **anecdote offline app (the Elevated context) is the first-class citizen**, and the demos
> it has already generated — the composer tunnel (`composer/host-demo.html` + `guest.html` +
> `tunnel.mjs`) and the v0 resolver/widget patterns (`payload.js`, `integrity.mjs`, `widget.js`,
> `medium.js`) — become its **clients** once they load from the offline arch and bring up MiniLM. They
> were never fully stood up, and *couldn't* be, except that way.

## Frame — the offline app hosts its own demos

The composer and widgets aren't standalone pages; they are **capability clients**. Reduce-as-you-type
needs the **LM**; `sign` needs **`crypto.subtle`**; record/export need the **trove + seal-enough**; a
commit needs **git-enough**. All of those live in **admin-space (the Elevated app)**. So the probe line is
the bus by which a client (a composer, a widget, a data:chamber tool) **summons** the Elevated app's
capabilities. Spec it from the app outward, not the demo inward.

> **Realized (Chromium-verified).** The composer now actually runs this way:
> [`composer/composer-chamber-demo.html`](../composer/composer-chamber-demo.html) hosts the compose UI in a
> powerless `data:` chamber (`subtle: undefined`, not secure, `origin: null`) that summons `label`
> (Rung 0, live as you type) and `sign-anecdote` (Rung 1, on the confirmed Send) from the Elevated page
> over a transferred port. The capabilities are the **real** modules, vended by
> [`composer/probe-ops.mjs`](../composer/probe-ops.mjs) (the reducer, `anecdote/v1` build, on-device
> Ed25519 signing, the trove) — the chamber holds only the screen. The frame is no longer aspirational.

## It is the ingress tunnel, inverted

We already built one postMessage bus: `composer/tunnel.mjs` (`hello → ack → intake → built/status`,
where the **guest proves itself by ORIGIN** via `verifyDestination`). The probe line **reuses the shape
and inverts the trust**:

| | ingress tunnel | probe line |
|---|---|---|
| privileged side | the **Tell host** (it holds the poll/token) | the **Elevated anecdote app** (keys/subtle/trove/LM) |
| other side | the anecdote **guest** (proves by origin) | the **data:chamber** (powerless; **opaque/null origin**) |
| how trust is established | **origin-bind** (`verifyDestination`) | **capability** handed in at spawn (origin can't help) |
| reuse | typed messages; "nothing consequential without a confirmed action" | same |

The keystone consequence: **a `data:` chamber has a null origin, so the tunnel's origin-bind cannot
authorize it.** Everything below follows from replacing origin with a capability.

## Edge 1 — the capability primitive (how a chamber is trusted at all)

- v0's `medium.js` used a **`BroadcastChannel`** (`▒`) — *not* capability-scoped: any listener in the
  context hears it. Fine for a single-page worker; wrong for a trust boundary.
- The probe line wants a **private `MessageChannel`**: at spawn the Elevated app does
  `chamber.postMessage(initMsg, '*', [port2])`, **transferring a port**. **Possession of the port *is* the
  capability** — no guessable secret, no origin check — and **closing the port revokes** it cleanly. A
  spawn-time **secret nonce** is the fallback if a port can't be transferred.
- **VERIFIED (Chromium 141, headless).** A real `data:text/html` iframe inside a served (localhost,
  secure) parent: the parent did `iframe.contentWindow.postMessage({type:'init'}, '*', [port2])` and the
  chamber received the port on `event.ports[0]` and ran a full **capability-by-port round-trip** — it asked
  the parent to `SHA-256` a string, the parent computed it with `crypto.subtle`, and the chamber got the
  correct digest back over the port. The chamber reported: `gotPort: true`, `isSecureContext: false`,
  `typeof crypto.subtle === 'undefined'`, `location.origin === "null"`. The same worked with the iframe
  hardened to **`sandbox="allow-scripts"`** (no `allow-same-origin`). So:
  - **the port transfers into a `data:` (even sandboxed) chamber** — the capability primitive holds;
  - **the chamber genuinely lacks `subtle` and is not a secure context** — it *must* delegate (Edge 2),
    confirmed empirically, not assumed;
  - **its origin is `null`** — origin-bind is impossible, so the port-capability is the only option.
- **Bonus finding — mutual auth, two different primitives.** The chamber *also* sees `event.origin` of the
  init message = the **Elevated origin** (`http://localhost:8011` in the test). So the trust is symmetric
  with asymmetric tools: **Elevated authorizes the chamber by possession of the port; the chamber
  authorizes Elevated by the init message's `event.origin`** (it can refuse a port that didn't come from
  its expected Elevated origin). Record this — the chamber isn't blindly trusting whoever postMessages it.
- **Remaining edges:** (b) iframe vs. `window.open` — **now resolved, see Edge 6**; (c) the chamber's
  bootstrap must **listen for exactly one init message**, then talk only down the port.

## Edge 2 — the op surface, and which way data flows

The Elevated app vends capabilities; the chamber calls them. Candidate ops = the **enough-clients as
services**: `label` (LM/MiniLM), `sign` / `subtle.*` (crypto), `stage` / `commit` (git-enough), `seal` /
`export` (seal-enough, incl. the `held-since` attestation), `trove.read`, `pile.fabricate`.

- **Direction:** heavy/privileged work runs **Elevated** (it has `subtle`, keys, the model, the storage);
  the chamber sends the **input** (text to label, bytes to seal) and gets a **result or handle** back.
- **Edge — where MiniLM runs:** v0 loaded transformers *in the page*, but real threading wants
  `crossOriginIsolated` (COOP/COEP), which a `data:` tab **cannot** have. So **the LM runs Elevated** and
  the chamber asks `label` — confirming "tools are utility services." (A tiny toy labeler *could* run
  in-chamber; the real one can't.)
- **Edge — privacy of crossing the line:** sending chamber text to Elevated to be labeled/sealed is
  *fine* (same device, your own trusted admin app) — but name it, because the chamber's whole appeal is
  cleanliness. The trust is "Elevated is yours," not "the line hides from Elevated."
- **Edge — streaming:** label/seal results may stream; the port carries a request id ↔ many response
  frames (the tunnel was one-shot req/reply; the probe line needs correlation ids).

**VERIFIED (Chromium 141, headless) — the multiplexed streaming op surface holds.** The sandboxed `data:`
chamber asked Elevated for a `label` op that streams a frame **per token**, while Elevated did the
per-token `crypto.subtle` digest the chamber can't. Findings:

- **Correlation ids genuinely disambiguate concurrent streams.** The chamber fired two `label` requests
  (ids `A`, `B`) at once; with a realistic per-token delay the frames **interleaved on the wire**
  (arrival order `ABABABABBB`), yet each stream **reassembled in seq order with no cross-contamination**
  (`A`→"the quick brown fox", `B`→"lorem ipsum dolor sit amet consectetur"). One port multiplexes many
  ops; the **id is what keeps them apart** — without it the interleaved frames are unreadable.
- **One request → many frames + a terminator.** Each response frame carries `{id, seq, …, final}`; the
  chamber treats `final:true` as end-of-stream. Frame ordering per id is preserved by the port.
- **Errors are just another correlated frame.** An empty input returned `{type:'error', id}` against the
  right id — the error path rides the same correlation, no side channel.
- **Cancel works mid-stream and is correlated.** The chamber sent `{type:'cancel', id}` after the first
  frame of a stream; Elevated stopped (the chamber got one frame, then `cancelled` at seq 1, never
  `final`). This is the **cooperative, in-band** counterpart to Edge 6's *unilateral, silent*
  `port.close()` — and it's the concrete mechanism behind Edge 3's "revoke a behavior mid-stream."
- **Scheduling caveat worth keeping:** naive per-request `async` loops on one port can *serialize* (drain
  one request before starting the next) unless each op actually yields between frames — observed directly
  (no-delay run produced `AAAABBBBBB`, not interleaved, and the cancel arrived too late to bite). A real
  streaming op must yield per frame for both fair interleaving **and** timely cancel.

So the message shape is no longer hand-wavy: **`{type, id, seq?, final?}` request/stream/error/cancel
frames over the one transferred port** — de-risked, ready to harden into `probe-line/v1`.

## Edge 3 — the consent ladder for probe ops (the async question)

> **Planned in detail → [`probe-line-consent.md`](probe-line-consent.md)** (implementation plan). This is
> the design-led edge — the transport is verified (Edges 1/2/6); this is the *policy* on top.

The tunnel rule was "nothing signs or records except on a user-confirmed intake." The probe line must
**grade ops** into three rungs:

- **Rung 0 — ambient / auto:** `label`, `trove.read` (read-only, no new artifact) — no prompt, works even
  in incognito (perception, not persistence).
- **Rung 1 — confirmed:** `sign`, `seal`, `export`, a `commit` that persists — one op, one confirm (the
  probe-line analogue of the tunnel's `intake`).
- **Rung 2 — standing:** the **staging beat** and **slow LM indexing** act *on your behalf while you're
  away*. The plan resolves the open async-consent edge with a **standing grant** — the behavior-shaped
  cousin of the revocable **nonce** (same `attest` signing, same trove home, same "only you can revoke"),
  made legible in a "**what's running on my behalf**" panel and revoked **mid-stream** via the two verified
  mechanisms: `cancel` (cooperative, in-band) + `port.close()` (unilateral, silent). The load-bearing rule:
  **the commit is the atomic unit — `cancel` lands between commits, never inside one**, so Edge 2's
  yield-per-frame point doubles as the only safe revocation boundary. (Recording-on/off — Origin's
  guarantee #1 — is the coarse master switch; the grants panel is the per-behavior breaker.)

## Edge 4 — adding capabilities (the "submodules of behavior" recursion)

v0's `payload.js` already recurses: a `manifest+json` BUNDLE loads a sub-manifest of more tools. Under
"**no user space**," a tool is either **zero-space** (chamber UI) or **admin-space** (an Elevated
capability). Therefore **adding a new probe op = adding an admin-space tool**, which gets keys/`subtle` —
so it is a **firmware-trust act**, gated by the same **first-contact signer-pin** as the app itself.

- **Edge:** how a holder *authorizes* a new admin tool (signed, pinned, an accepted roll-forward) vs. how
  a chamber merely *uses* existing ops. A chamber-side tool **cannot register** a capability; it can only
  request one that an admin-space tool already exposes.

## Edge 5 — layering with the ingress tunnel (don't unify prematurely)

Two buses, inverted trust. The likely composition: the anecdote **"guest" inside a Tell page *is* the
Elevated app** (iframed, origin-bound by the tunnel), and *it* spawns **chambers** over the probe line. So
a real submission could flow **Tell page →(tunnel, origin-bound)→ Elevated anecdote →(probe line,
port-capability)→ chamber tool**. **Edge:** name this layering; keep the two buses distinct (one proves by
origin, one by capability) rather than collapsing them into one API.

## Edge 6 — spawning + lifecycle

The Elevated app **spawns** the chamber via the `make-datachamber` pattern (`data:text/html` +
encoded payload). **Edges:** iframe(`sandbox="allow-scripts"`) vs. a new tab; delivering the port at t=0
(the chamber boots, signals ready, the Elevated app replies with the port — a tiny inverted `hello`);
**teardown** (closing the port/tab revokes every capability at once — the "completely clean bunker" is
re-established by *destroying* it, not cleaning it).

**VERIFIED (Chromium 141, headless) — the inverted `hello` and revocation-by-close both hold.** Same
sandboxed-iframe chamber: it boots, posts `ready` to `window.parent`, the Elevated side replies with the
init message carrying the port (the t=0 inverted hello), and a port round-trip succeeds (digest matched
`sha256sum` exactly). Then the Elevated side calls **`port.close()`** on *its* end and tells the chamber
to try again. The chamber's subsequent `port.postMessage(...)` over the same port **does not throw**
(`post_threw: null`) and **no reply ever arrives** (the chamber waited 800 ms; `revoked_after_close:
true`). So:

- **closing the privileged end revokes the capability cleanly and unilaterally** — the chamber keeps a
  live-looking port object but nothing answers it; the "destroy, don't clean" teardown is real.
- **revocation is failure-*silent*** — the chamber gets no error, just silence, and **cannot locally
  distinguish "revoked" from "slow."** Design consequence: every chamber-side call needs **its own
  timeout** (or a heartbeat) to notice it's been cut off; the protocol can't rely on an error event.

**VERIFIED (Chromium 141, headless) — iframe vs. tab is settled: a `data:` chamber must be an iframe.**
A served (localhost, secure) opener tried three `window.open` targets and watched for the popup page +
the chamber's inverted-hello to its `opener`:

| `window.open` target | handle returned? | top-level page actually loaded? | chamber origin / powers |
|---|---|---|---|
| `data:text/html,…` | **yes (truthy)** | **NO — silently blocked** | n/a (never ran) |
| `blob:…` (opener-created) | yes | yes | **`http://localhost:8015`** (the opener's), `isSecureContext: true`, **has `crypto.subtle`** |
| served `http://…` | yes | yes | the served origin (powered) |

Two findings, both load-bearing:

- **Top-level navigation to a `data:` URL is blocked** (Chrome's long-standing anti-phishing rule).
  `window.open` returns a *truthy* handle — so a naive caller thinks it worked — but no page is created,
  no opener message ever arrives, the chamber code never executes. **So a `data:` chamber cannot be a
  tab/window; the verified iframe is the only host for it.**
- **A tab can only host a *powered* context.** The two targets that *do* open as tabs (`blob:`, served)
  **inherit the opener's origin**, become secure contexts, and **get `crypto.subtle`** — the exact
  opposite of the chamber's defining powerlessness. A `blob:` "chamber" is effectively same-origin with
  Elevated, so there's nothing to delegate and nothing the port-capability is protecting.

**Conclusion:** the chamber's null-origin powerlessness and its iframe-hosting are *the same fact* — only
an iframe can carry a `data:` document, and only a `data:` document is null-origin/`subtle`-less. "Tab vs.
iframe" was never a real fork for chambers: choose a tab and you've chosen a *different, powered* thing
(blob/served), not a chamber. Tabs remain available for spawning **another Elevated-origin surface**
(a full app window), never a chamber.

## Not deciding yet (multiple paths)

Whether a toy labeler ever runs in-chamber; the exact field names and types of the op schema (the *shape*
is now de-risked — see Edge 2 — but `probe-line/v1` still has to pin it down). We're mapping **edges**;
the protocol spec follows once we've walked them. The first three (capability primitive, op direction,
consent ladder) are the load-bearing ones — **the first two are verified; the third is now planned in
detail** in [`probe-line-consent.md`](probe-line-consent.md).

**Settled by the Edge 1 test:** **port-transfer is the default, not a co-equal path** — it's verified to
cross into a (sandboxed) `data:` chamber, it needs no guessable secret, and closing it revokes cleanly.
The spawn-time **secret nonce** is demoted to a *fallback* for a transport that can't carry a port.

**Settled by the Edge 6 test:** **iframe vs. tab is not a fork for chambers** — a `data:` document can't be
a top-level tab (Chrome blocks the navigation), and the things that *can* be tabs (`blob:`, served)
inherit the opener's origin and powers, so they aren't chambers at all. The chamber is an iframe, full
stop; tabs are reserved for spawning another *powered* surface. **Revocation-by-close is real but
silent** — `port.close()` on the privileged end cuts the chamber off unilaterally with no error, so every
chamber-side call needs its own timeout to notice.

**Planned by the Edge 3 note ([`probe-line-consent.md`](probe-line-consent.md)):** ops grade into three
rungs (ambient / confirmed / standing); a **standing grant** is the behavior-shaped cousin of the
revocable nonce (same signing, same trove, same only-you-can-revoke); it is made legible in a
"running-on-my-behalf" panel and revoked mid-stream by `cancel` + `port.close()`; and **the commit is the
atomic revocation unit** — Edge 2's yield-per-frame point *is* the safe cancel boundary.

**Settled by the Edge 2 test:** the **multiplexed streaming op surface** holds — one port carries many
concurrent ops disambiguated by **correlation id**, each request fans out to seq-ordered frames with a
`final` terminator, errors are correlated frames, and **mid-stream cancel** works (the cooperative,
in-band counterpart to `port.close()`'s unilateral cut). Caveat: a streaming op **must yield per frame**
or it serializes and cancel lands too late. Message shape de-risked: `{type, id, seq?, final?}`.
