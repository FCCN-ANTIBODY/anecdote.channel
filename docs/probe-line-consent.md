# probe-line consent — the ladder and standing grants (implementation plan)

> Status: **implementation plan** under [Milestone: Origin](origin.md), detailing **Edge 3** of
> [`probe-line.md`](probe-line.md). Design-led, not a Chromium finding: the *transport* is already verified
> (port-capability, streaming+correlation, `cancel`, `port.close()` — Edges 1/2/6). This is the **policy
> layer** that rides on top of it. Not built.

## Consent is already a four-layer thing — this is the missing middle

The constellation already has consent in several places; the probe line needs its own layer that **slots
between them**, not a fifth invention:

| layer | question it answers | where it lives today |
|---|---|---|
| **recording toggle** (coarse) | *is my environment recorded at all?* | git-enough guarantee #1 (steady beat vs. incognito no-op) |
| **probe-op consent** ← **THIS DOC** | *may this chamber invoke this capability, now / while I'm away?* | — (the gap) |
| **egress + nonce** | *this artifact is leaving; can I pull it back later?* | `composer/consent.mjs` (the revocable nonce + trove), the tunnel `intake` |
| **firmware trust** | *may a new admin-space tool exist at all?* | Edge 4 (first-contact signer-pin) |

The probe-op layer governs **capability invocation on-device** — *before* anything is an artifact and
*before* anything leaves. The critical reframe: at the probe line, consent is **not about
privacy-from-Elevated** (Elevated is yours; the line doesn't hide from it — see Edge 2). It is about
**authority and surprise**: which ops may run silently, which need a human in the loop, and which may run
*on your behalf while you're away*.

## The ladder — three rungs, graded by the op, not the caller

The **rung is a property of the op**, declared by the admin-space tool that exposes it. Because tools are
firmware-trusted (Edge 4), their declared grade is trustworthy, and **a chamber cannot self-upgrade** an
op's rung — it can only request what an admin tool already exposes at the grade the tool set.

- **Rung 0 — ambient / auto.** Read-only, produces **no new persisted artifact**, no network. `label`
  (the reading-glasses guarantee #2), `trove.read`, a bare `subtle.digest`. Gated only by *the port
  existing*. **No prompt** — asking would be the paper-cut that kills the "reading glasses" feel. Works
  even in incognito (labeling is perception, not persistence).
- **Rung 1 — confirmed.** Signs or **persists** an artifact: `sign`, `seal`, `export`, a `commit` that
  writes, `pile.fabricate` that stores. Requires a **fresh, specific** user confirmation — the probe-line
  analogue of the tunnel's `intake` ("sending this IS the user's confirmed action"). **One op, one
  confirm.** In incognito, the *persisting* half no-ops (this is exactly what the recording toggle
  switches off — see below).
- **Rung 2 — standing.** A behavior that runs **repeatedly, over time, possibly while you're away**: the
  git-enough **staging beat**, the **LM history-indexing**. Requires a **standing grant** (next section):
  minted by one explicit act, shown persistently, revocable mid-stream.

## The hard part: standing consent for async behaviors

This is the open question the operator flagged ("what standing consent covers the beat, how it's shown,
how it's revoked mid-stream"). The plan resolves it in three parts.

### 1. The standing grant — a signed, scoped, revocable record (the nonce's cousin)

A **grant** is the behavior-shaped twin of the per-submission **nonce**:

| | nonce (exists) | grant (this plan) |
|---|---|---|
| governs | one **artifact** | one **behavior** |
| minted by | a confirmed send | a confirmed *start a standing behavior* |
| signed with | `sign.attest` | `sign.attest` (same primitive) |
| lives in | the trove | the trove (a sibling section) |
| revoked by | only the original signer, signed | only the original signer, signed |
| tombstone | `status: revoked` kept | `status: revoked` kept |

So the API mirrors the nonce API rather than inventing a parallel world:

```
GRANT = "probe.grant/v1"
{ schema, grant: "grant:<rand>", behavior: "git-enough:staging-beat",
  scope: { piles:[...], paths:[...], labels:[...] },   // what it may touch
  cadence: "on-change|~5m|idle",                        // hint, not a promise
  granted_at, basis: { shown: "...what the user saw..." },
  expiry: <ISO|null>, status: "live"|"revoked", revocation: null }
```

`mintGrant / listGrants / revokeGrant / verifyGrant` extend `composer/consent.mjs`, reusing
`attest / verifyAttestation` — **the same "only you can revoke, and here's the signed instrument that
proves it" discipline the nonce already has.** This is the unification the plan buys: *ownership of a
running behavior* is expressed with the exact machinery as *ownership of a sent artifact*.

### 2. How it's shown — legibility is the whole legitimacy

A standing grant is only legitimate if it is **glanceable**. The fine-grained sibling of the coarse
recording toggle: a persistent **"what's running on my behalf"** panel where every Rung-2 behavior appears
with *what it does, its scope, its last activity, and a one-tap revoke*.

> **recording toggle = the master switch** (guarantee #1: recorded, or not).
> **grants panel = the per-behavior breaker** (this staging beat, this indexer — off, now).

A behavior that isn't in the panel isn't allowed to run. No silent standing authority.

### 3. How it's revoked — mid-stream, using the two verified mechanisms

We proved two revocations; the plan uses **both, for different jobs**:

- **Cooperative (in-band) — `cancel` (Edge 2, verified).** Revoking a grant sends a `cancel` for the
  behavior's stream; it stops **at the next yield**. Graceful, and it lets the behavior finish an atomic
  unit cleanly.
- **Unilateral (silent) — `port.close()` (Edge 6, verified).** Tearing the chamber down drops *all* its
  authority at once; the behavior can't even be notified, it just stops getting answers.
- **Revoking a grant does both:** `cancel` for a graceful stop **and** mark the grant `revoked` so it is
  never re-honored (a cached/replayed grant hits the tombstone); `port.close()` when the chamber itself is
  going away.

**The load-bearing rule — revoke is atomic to the artifact, not the stream:**

> The **commit is the atomic unit.** `cancel` may land **between** commits, **never inside** one. Stopping
> the staging beat must leave **no half-written committed object**; stopping the indexer must not leave a
> partially-written pile **marked complete**. This is why Edge 2's "**a streaming op must yield per
> frame**" caveat is not just about fairness — the yield point is *also* the only safe **revocation
> boundary**. Yield → check-cancel → commit-or-abandon.

## The recording toggle threads *through* the ladder (not beside it)

The coarse toggle isn't a separate gate — it *is* the persistence switch the upper rungs already depend on:

- **incognito** ⇒ Rung 0 still works (label/read are perception, not persistence), but every **persisting**
  op (Rung 1 `seal`/`commit`, Rung 2 staging beat) either **refuses or runs without persisting**.
- **recording on** ⇒ persistence is available; Rung 1 still needs its per-op confirm, Rung 2 still needs a
  grant.

So the gate consults the toggle first, and the ladder degrades cleanly: *incognito is simply "Rung 1+
persistence is off."*

## The gate — one pure function

```
authorize(op, { recordingOn, grants }) -> {
  allow: bool,
  rung: 0|1|2,
  needsConfirm: bool,        // Rung 1 with no covering grant
  grantId?: string,          // Rung 2: the live grant that covers this op+scope
  reason?: string            // why refused / why it needs a human
}
```

- Rung 0 → `{allow:true, rung:0}`.
- Rung 1 → `allow` only with a fresh confirm **and** (if it persists) `recordingOn`; else `needsConfirm`.
- Rung 2 → `allow` only if a **live, in-scope, unexpired** grant covers it **and** `recordingOn`; else
  refused with `reason:"no standing grant"` (the UI offers to mint one).

Pure, dependency-free, testable in the house style — the same shape as `composer/route.*` and the
`consent.mjs` core.

## Implementation roadmap

1. **Grants in `consent.mjs`** — `GRANT` schema + a `grants` section in the trove; `mintGrant`,
   `listGrants`, `revokeGrant`, `verifyGrant` mirroring the nonce API; `.test.mjs` (pure). *Smallest,
   highest-leverage — it's mostly a re-shape of code that already exists.*
2. **`authorize()` gate** — the pure function above + exhaustive rung/toggle/expiry tests.
3. **Probe-line module skeleton** — the inverse of `tunnel.mjs`; its op dispatcher calls `authorize()`
   before handing an op to an admin tool, and enforces **yield → check-cancel → commit** around Rung-1
   commits.
4. **Grants panel** — the glanceable "running on my behalf" surface + one-tap revoke (wired to
   `revokeGrant` + `cancel`).
5. **Capstone demo** — a mock staging-beat behavior: grant it, watch it emit, **revoke mid-stream**, and
   **assert** (a) it stops at a commit boundary, (b) no half-written object, (c) the grant tombstone
   remains. *This tests **our gate + atomicity discipline**, not the browser (that's Edges 1/2/6) — worth
   doing, honestly labeled.*

## Open sub-questions (carried, not blocking)

- **Who runs the beat** (the "privileged budget"): a worker? the page's idle time? Cross-refs git-enough
  open-Q **C/D** and Origin's privileged-budget question. A grant *authorizes* the behavior; it doesn't
  answer *what executes it*.
- **Dormancy re-confirmation:** a grant lives in the trove across restarts (good — it's ownership), but a
  long-dormant grant should probably require a **"still running X — keep it?" re-attestation** after N
  days, so standing authority can't quietly outlive the user's intent.
- **Grant expiry defaults** and whether `scope` is enforced by the admin tool, the gate, or both
  (defense-in-depth suggests both).
