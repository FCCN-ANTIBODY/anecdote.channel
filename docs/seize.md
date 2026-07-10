# Seizing a downstream — making a GitHub repo listen to the offline origin

> Status: **shaping note (from the operator's memo); shape, not settled spec.** This is phase 3 of
> [`docs/actions-enough.md`](actions-enough.md), given its real form: the "auth fragment" is a
> **signed origin-declaration**, and locking is **making a GitHub repo carry it.** Builds on
> [`docs/git-enough.md`](git-enough.md) (the push, the Castle/King's-Leap swap) and the seal-enough
> **`held-since`** attestation it names.

## The problem

GitHub is **losing origin status** to an authority it cannot see — the un-addressable offline origin.
We want a GitHub repo to become a **downstream client** of that origin: it fast-forwards to what the
origin pushes, reversibly, **locked to the device that seized it** — and we want to do it *without*
puppeting GitHub's API into verifying signatures on every push (which keeps demanding the user's
intervention, the very thing the offline origin exists to avoid). We must be able to **authorize the
user before, or as, GitHub's authentication**, not after it.

## What "ready to be seized" is — no special GitHub configuration

The push already works (git-enough `send-pack`, a Contents-R/W token the device holds). "Downstream"
is therefore **not a GitHub setting** — it is a **declaration the repo carries.** A downstream repo is
an ordinary repo that holds one extra thing: a **signed origin-declaration** — the offline origin's
seal, *"I am the origin of this repo since T0, pinned to fingerprint X"* (seal-enough's `held-since`).

- **Seize** = the origin pushes its history **plus** the signed declaration. GitHub fast-forwards.
  That is the whole act — **committing the declaration *is* becoming ready.**
- **Verify** = anyone who reads the repo checks the declaration signs to the fingerprint it names —
  **client-side, never on GitHub.** GitHub stays dumb storage; it never has to know the authority it
  cannot see.
- **What happens to the repo** — in the branch form (below), *nothing destructive*: a branch appears
  carrying the seized state. The aggressive **kidnap-and-blank** (a King's-Leap force-push over `main`)
  is a deliberate *later* option, never the default.

## The lock — cryptographic trust, not a GitHub ACL

This is what dodges the API-puppeting:

- The declaration is signed by the **device-held origin key** (gesture-gated in the vault). A *valid*
  change to it — un-seize, or re-seize to a new origin — **requires that key.** "A configuration
  switch only from the offline origin" = "only a commit signed by the held key is a valid
  re-declaration."
- GitHub **cannot** enforce that, and **we do not ask it to.** Someone with write access *can* push a
  bad declaration — but it is **detectably invalid** (wrong signature), and the whole architecture
  already runs on *verify-from-anyone; trust decides action, not admission.* A hostile rewrite is
  rejected by the origin's tooling and by any catcher — not by a branch-protection rule we had to
  puppet into place. It is a **domain-lock by pinned key**, not by GitHub permissions.
- **The 2FA is device possession + gesture.** Unlocking the vault key authorizes the user *before* the
  PAT is ever used to push; GitHub's token is downstream of the device auth. Enterprise/multitenant is
  the same shape: *"can you get into your own device's anecdote."*

## Branch-first — yes, and it is the right first slice

The entire **seize → verify → reverse** cycle is testable **with only branches**, using `send-pack`
(already built), touching **zero GitHub settings**:

1. **seize** — push the signed history + the `.origin` declaration to a branch (`origin-held`), not
   `main`.
2. **verify** — clone the branch; check the declaration signs to the pinned fingerprint.
3. **reverse** — delete the branch, or push a new signed declaration. Reversible, from the device that
   holds the key.

No branch protection, no rulesets, no API puppeting — just `git push <branch>` and a client-side
signature check. Only once that holds do `main` and the optional kidnap-and-blank become a deliberate
next step.

## Later, optional — the readiness endpoint on our DNS

`anecdote.channel` could publish *"here is the valid origin signature for repo X"* as a readiness
endpoint a GitHub-side hand could consult — the operator's "offer the off-part on our DNS." It is a
**nice-to-have, not required** (the committed declaration already carries its own proof), and it would
reuse the **existing** gateway, never a **new** worker.

## Phased plan

1. **The seal** — `seize`/`verify`/`unseize` over the `held-since` origin-declaration, driven by
   git-enough; unit-tested against a real `git`.
2. **Branch seize** — push declaration + history to a branch of a real (or scratch) downstream; verify
   from a fresh clone; reverse. The whole cycle, no GitHub settings.
3. **The lock's teeth** — the origin's tooling rejects a declaration not signed by the pinned key;
   re-seize requires the held key.
4. **`main` + the kidnap option** — force-push over `main` (the King's Leap), reversibility preserved.
5. **The readiness endpoint** — optional, on the existing DNS/gateway.

## Open questions

- **The declaration's exact bytes** — repo id, origin fingerprint, `held_since`, ref, and how a
  re-declaration supersedes (a chain the pinned key extends).
- **How dangerous is an un-preventable-but-detectable hostile push**, and whether the branch form's
  "additive, reversible" default is enough shelter before `main` is ever touched.
- **The example downstream** — a blank scratch repo we swap in and out, vs. letting each repo keep its
  own version and only carry the declaration (the operator's "swap a blank one around, or let each
  stay on their versions").

## See also
- [`docs/actions-enough.md`](actions-enough.md) — phase 3 is this.
- [`docs/git-enough.md`](git-enough.md) — the push and the swap this stands on.
