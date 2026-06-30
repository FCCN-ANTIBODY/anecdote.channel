# The probe line — shaping (edges first)

> Status: **shaping note** under [Milestone: Origin](origin.md). **Not a spec** — we identify *edges*.
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
- **Remaining edges:** (b) **iframe vs. `window.open`** (the verified path is iframe; the tab path is
  untested); (c) the chamber's bootstrap must **listen for exactly one init message**, then talk only down
  the port.

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

## Edge 3 — the consent ladder for probe ops (the async question)

The tunnel rule was "nothing signs or records except on a user-confirmed intake." The probe line must
**grade ops**:

- **cheap / auto:** `label`, `trove.read` (read-only, no new artifact).
- **consequential / confirmed:** `sign`, `seal`, `export`, a `commit` that persists.
- **Edge — standing consent for behaviors over time:** the **staging beat** and **slow LM indexing** act
  *on your behalf while you're away*. What standing consent covers them, how it's **shown**, and how it's
  **revoked mid-stream**, is the open async-consent edge the operator flagged. (Recording-on/off — Origin's
  guarantee #1 — is the coarse lever; this is the fine one.)

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

## Not deciding yet (multiple paths)

iframe vs. tab; whether a toy labeler ever runs in-chamber; the exact op schema and correlation-id
framing. We're mapping **edges**; the protocol spec follows once we've walked them. The first three
(capability primitive, op direction, consent ladder) are the load-bearing ones.

**Settled by the Edge 1 test:** **port-transfer is the default, not a co-equal path** — it's verified to
cross into a (sandboxed) `data:` chamber, it needs no guessable secret, and closing it revokes cleanly.
The spawn-time **secret nonce** is demoted to a *fallback* for a transport that can't carry a port. The
iframe path is verified; the **tab (`window.open`) path is the next thing to churn**.
