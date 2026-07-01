# probe-line/v1 — protocol specification

> Status: **normative spec** of the protocol implemented by
> [`composer/probe-line.mjs`](../composer/probe-line.mjs) and exercised by
> [`composer/probe-line.test.mjs`](../composer/probe-line.test.mjs). It is the reference an independent
> implementation conforms to. Every load-bearing claim was verified in Chromium during the edge walk
> ([`probe-line.md`](probe-line.md)); the consent layer is specified by
> [`probe-line-consent.md`](probe-line-consent.md).
>
> Key words **MUST**, **MUST NOT**, **SHOULD**, **MAY** are used per their usual RFC-2119 sense.

## 1. Purpose and roles

The probe line is a capability bus that lets a **powerless chamber** summon capabilities from a
**privileged Elevated context** on the same device. It is the [ingress tunnel](tunnel.md) *inverted*:
where the tunnel's privileged side is a remote host proving itself by **origin**, here the privileged
side is local and the untrusted side proves nothing by origin (it has none) — trust flows by
**capability possession** instead.

| role | who | powers |
|---|---|---|
| **Elevated** | the `anecdote.channel` HTTPS origin (the app) | `crypto.subtle`, signing keys, the trove, the LM, storage — a secure context |
| **Chamber** | a `data:text/html` document in a sandboxed iframe | **none**: `origin` is `null`, not a secure context, **no `crypto.subtle`** |

The chamber's powerlessness is not incidental — it is the security property. (Verified: a `data:` chamber
genuinely lacks `subtle` and is not a secure context; and a `data:` document **cannot** be a top-level
tab, so a chamber is **always an iframe** — `probe-line.md` Edges 1, 6.)

## 2. Trust model

- **The capability is a transferred `MessagePort`.** Elevated creates a `MessageChannel` and transfers one
  port to the chamber. **Possession of the port is the authority**; there is no shared secret and no origin
  check. This is the only way to authorize a null-origin peer.
- **Mutual authentication, asymmetric primitives.** Elevated authorizes the chamber by *giving it the
  port*. The chamber authorizes Elevated by inspecting the **`origin` of the `INIT` message** (which the
  browser attests and cannot be forged): a chamber **SHOULD** reject an `INIT` whose `event.origin` is not
  its expected Elevated origin. (Edge 1, verified.)
- **The line does not hide from Elevated.** Everything the chamber sends crosses to Elevated in the clear.
  The trust is *"Elevated is yours,"* not *"the line is private from Elevated."* An implementation **MUST
  NOT** market probe-line traffic as concealed from the Elevated app.

## 3. Channels

Two distinct message channels, used in two distinct phases:

1. **The window channel** — `window.postMessage` between the iframe and its parent. Carries **only** the
   handshake (§4): `READY` and `INIT`. `INIT` is the message that *transfers the port*.
2. **The port channel** — the transferred `MessagePort`. Carries **all** op traffic (§5): `REQUEST`,
   `FRAME`, `CANCEL`, `CANCELLED`, `ERROR`.

After the handshake, peers **MUST** speak only over the port channel. All message objects carry a
`type` string; port-channel receivers **MUST** ignore any message whose `type` does not begin with
`probe.line.`.

## 4. Lifecycle and handshake (the inverted hello)

```
Elevated                                   Chamber (data: iframe)
   │  create iframe(sandbox="allow-scripts")
   │  src = data:text/html,<chamber>              boots
   │                                    ◀── READY (window)      "I'm up, send my port"
   │  INIT + [port2] (window) ──▶                              receives port on event.ports[0]
   │  serveProbeLine(port1)                       connectProbeLine(port)
   │                                    ◀── REQUEST (port)
   │  FRAME* … FRAME{final} (port) ──▶
   │  … teardown: port.close() ──────────────────▶ (silent revocation)
```

- The chamber **MUST** post `READY` to its parent once, on boot, and then **MUST NOT** act until it
  receives `INIT`.
- Elevated, on `READY` from the chamber's window, **MUST** reply with `INIT` transferring exactly one
  port, and **MUST** verify `event.source` is the spawned iframe's window.
- The chamber, on `INIT`, takes the port from `event.ports[0]`, **SHOULD** verify `event.origin` (§2), and
  thereafter uses only that port.
- **Teardown**: Elevated closes its port end (and **SHOULD** remove the iframe). Closing revokes every
  capability at once (§7). This is the "clean bunker re-established by *destroying* it."

### Handshake messages (window channel)

| message | fields | direction |
|---|---|---|
| `READY` — `probe.line.ready/v1` | `{ type }` | chamber → Elevated |
| `INIT` — `probe.line.init/v1` | `{ type }` + one transferred port in `message.ports` | Elevated → chamber |

## 5. Op messages (port channel)

### 5.1 REQUEST — chamber → Elevated

| field | req? | meaning |
|---|---|---|
| `type` | ✓ | `probe.line.request/v1` |
| `id` | ✓ | **correlation id**, unique per in-flight request (see §6) |
| `op` | ✓ | catalog op name (§8) |
| `input` | — | op-specific payload |
| `behavior` | — | the standing behavior this request belongs to (lets it ride a grant, §8) |
| `scope` | — | `{ piles?, paths?, labels? }` — the specific resources it touches |
| `confirmed` | — | `true` iff this call carries a fresh user confirmation (for a one-off Rung-1 op) |

The chamber declares `op`/`behavior`/`scope`; it **MUST NOT** be able to raise an op's rung — the
**rung and persistence are fixed by the Elevated-side catalog**, never by the request (§8).

### 5.2 FRAME — Elevated → chamber

A response is a **stream** of `FRAME`s sharing the request's `id`.

| field | req? | meaning |
|---|---|---|
| `type` | ✓ | `probe.line.frame/v1` |
| `id` | ✓ | the request's correlation id |
| `seq` | ✓ | 0-based, strictly ascending per `id`; ordering preserved by the port |
| `final` | ✓ | `false` for a data frame; `true` for the terminator |
| `grantId` | — | on the terminator only: the grant that authorized the op, if any (§8) |
| *(payload)* | — | op-specific fields on data frames (`final:false`) |

The terminator (`final:true`) carries no op payload; it ends the stream. A receiver **MUST** treat
`final:true` as end-of-stream for that `id`.

### 5.3 CANCEL — chamber → Elevated

`{ type: "probe.line.cancel/v1", id }` — request that the stream `id` stop. Cooperative (§7).

### 5.4 CANCELLED — Elevated → chamber

`{ type: "probe.line.cancelled/v1", id, seq }` — the stream `id` stopped before completing; `seq` is the
count reached. A stream ends with **either** a `final:true` FRAME **or** a `CANCELLED`, never both.

### 5.5 ERROR — Elevated → chamber

| field | req? | meaning |
|---|---|---|
| `type` | ✓ | `probe.line.error/v1` |
| `id` | ✓ | the request this refuses/fails |
| `reason` | ✓ | human-readable cause |
| `rung` | — | the op's rung, when the error is a consent refusal (§8) |
| `needsConfirm` | — | `true` when the op would be allowed *with* a fresh confirmation |

`ERROR` is a correlated frame like any other — refusals and failures ride the same channel, never a side
channel. A `needsConfirm` error is an invitation to re-request with `confirmed:true`, not a dead end.

## 6. Correlation and streaming

- One port **multiplexes many concurrent requests**; frames from different requests **MAY interleave** on
  the wire. The `id` is what keeps them separable — a receiver **MUST** demultiplex by `id`. (Edge 2,
  verified: two streams interleaved `ABABABABBB` yet each reassembled correctly.)
- Per `id`, `seq` is strictly ascending and order is preserved.
- Elevated **MUST** reject a `REQUEST` whose `id` is already in flight (an `ERROR` with reason
  "duplicate request id").
- An op that streams **MUST yield between frames** (see §7) — this is required both for fair interleaving
  and for timely cancellation.

## 7. The two revocations

The probe line has **two** ways to revoke, for two different jobs. An implementation provides both.

1. **Cooperative — `CANCEL` (in-band).** The chamber sends `CANCEL {id}`; Elevated stops the stream at its
   next yield and emits `CANCELLED`. Graceful: it lets an op finish an atomic unit first.
2. **Unilateral — `port.close()` (out-of-band, silent).** Elevated closes the port. The chamber keeps a
   live-*looking* port object but **nothing answers it, and it receives no error** — revocation is
   **failure-silent**. (Edge 6, verified.)

Consequences an implementation **MUST** honor:

- **Silent-failure rule.** Because a closed port is indistinguishable from a slow one, every **chamber-side
  call MUST have its own timeout** (or heartbeat). The protocol provides no "you were revoked" signal for
  the unilateral path.
- **Atomicity rule — the commit is the unit of revocation.** A `CANCEL` **MUST** be honored only at a
  yield point *between* commits, **never inside** one. An op that persists **MUST** structure each unit as
  **yield → check-cancel → commit**, so that a cancellation abandons the in-flight unit rather than leaving
  it half-written. (Implemented as `api.tick()`; proven by the keystone test: a beat cancelled after 2 of
  4 commits ends with exactly 2 commits and a `CANCELLED`, no `final`.)

## 8. The consent ladder (normative summary)

Full rationale in [`probe-line-consent.md`](probe-line-consent.md); the gate is
[`composer/authorize.mjs`](../composer/authorize.mjs). Before running any op, Elevated **MUST** evaluate
`authorize(op, ctx)` and, if it does not `allow`, emit an `ERROR` (with `rung`/`needsConfirm`) instead of
running it.

- **The op's grade is Elevated-declared.** An op descriptor is `{ name, rung, persists }`, taken from the
  Elevated-side catalog; unknown ops **MUST** fail safe (treated as consequential + persisting). The
  request's `op`/`behavior`/`scope` select an op; they **MUST NOT** set its rung or `persists`.
- **Rung 0 (ambient):** read-only, no artifact. Allowed with no prompt; works in incognito.
- **Rung 1 (confirmed):** signs/persists. Allowed iff (`confirmed`) **or** a live in-scope grant covers it;
  otherwise `ERROR needsConfirm`.
- **Rung 2 (standing):** a behavior that runs over time. Allowed **iff** a live, in-scope, unexpired
  **grant** (§consent doc) covers it; a one-off `confirmed` **MUST NOT** substitute for a grant.
- **Recording toggle threads through:** if the op `persists` and recording is off (incognito), it is
  refused at **any** rung; read-only ops still pass.
- **Grants cover Rung 1 too.** A live grant for a behavior covers that behavior's internal Rung-1 commits,
  so a running behavior does not re-prompt per commit. Scope is **least-authority**: a requested dimension
  must be explicitly permitted (or by an explicit `"*"`); an unlisted dimension permits nothing.

## 9. Security considerations

- **Null origin is the point.** The chamber has no origin, no `subtle`, no secure context; it **must**
  delegate anything privileged. Do not "fix" this by hosting the chamber anywhere it would gain an origin
  (a `blob:`/served tab inherits the opener's origin and powers — that is *not* a chamber; Edge 6).
- **Sandbox.** The chamber iframe **SHOULD** be `sandbox="allow-scripts"` (no `allow-same-origin`); the
  capability still transfers (Edge 1).
- **Mutual auth.** §2 — the chamber checks `INIT`'s origin; Elevated authorizes by port possession.
- **Least authority + fail-safe.** §8 — unknown ops are consequential+persisting; scope permits only what
  it lists.
- **Trust boundary is the device, not the line.** §2 — the line is not a privacy boundary against Elevated.

## 10. Conformance

A conforming **Elevated** implementation:

1. spawns the chamber as a sandboxed `data:` iframe and completes the §4 handshake, transferring exactly
   one port;
2. serves op traffic only over that port, ignoring non-`probe.line.` messages;
3. evaluates the §8 gate before every op and refuses via `ERROR` when disallowed;
4. streams `FRAME`s with ascending `seq` per `id`, terminating with `final:true` or `CANCELLED`;
5. honors `CANCEL` only at inter-commit yield points (§7 atomicity) and `port.close()` as total revocation.

A conforming **Chamber** implementation:

1. posts `READY` once and waits for `INIT`; verifies `INIT`'s origin; uses only the received port;
2. tags each `REQUEST` with a unique in-flight `id`; demultiplexes replies by `id`;
3. applies its own per-call timeout (§7 silent-failure rule);
4. never assumes it holds any power the Elevated context has not vended it.

## 11. Versioning

The `/v1` suffix is carried in every `type` string. A breaking change ships as `probe.line.*/v2`; a peer
**MUST** ignore message types it does not recognize (so a v1 peer simply never acts on v2 traffic). Adding
a new **op** or a new optional field is **not** a version bump — ops are discovered/negotiated at the
catalog layer, and unknown fields **MUST** be ignored. Adding a new *capability* (op) is governed by the
firmware-trust act of [`probe-line.md`](probe-line.md) Edge 4, not by this transport version.

## 12. Non-normative: provenance

Every rule here is grounded, not guessed:

| spec section | grounded in |
|---|---|
| §2 capability / mutual auth | Edge 1 (Chromium): port transfers into a sandboxed `data:` chamber; chamber reads `INIT` origin |
| §4 iframe-only, teardown | Edge 6 (Chromium): `data:` can't be a tab; `port.close()` revokes silently |
| §6 correlation / interleave | Edge 2 (Chromium): concurrent streams interleave yet reassemble by `id` |
| §7 atomicity | Edge 2 caveat → keystone test: yield-per-frame is the safe cancel boundary |
| §8 consent ladder | `probe-line-consent.md` + `authorize.mjs` (23 tests) + `consent.mjs` grants (27 tests) |
| §10 conformance | `probe-line.mjs` + `probe-line.test.mjs` (18 tests) + the end-to-end Chromium run |
