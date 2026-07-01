# The data-pile archive browser — shaping (a use case for the staging beat)

> Status: **shaping note** under [Milestone: Origin](origin.md). Not built. This is the "one pass to
> prepare" before the **staging beat** ([git-enough.md](git-enough.md) Rung-2 behavior): it decides *what
> goes on the git stage* by following one use case — starting a browsing session inside anecdote and
> keeping it as a data-pile you can later open, inspect, and discard.

## The use case

A constituent is in anecdote and starts a **session** aimed somewhere (a wide-open activity). **A session's
worth of activity is a data-pile.** The archive browser is the surface over *all* your piles — polls,
submissions, and browsing sessions alike; they are just **data-piles by type**, and the UX sorts it out
once we're past demo. It is **archival-first**: a **tape-line** of the piles you've made, newest on top,
each pile **connectable → inspectable → filterable** across the spread of what you kept.

The session **does not close** on a timer — it closes when you **dismantle its `data:` chamber**. So
"end of session" is a teardown event, and the beat's job is partly to **flush what's left on the stage**
as the chamber goes offline.

## The browser op is two halves (and it is not a live iframe)

We **cannot** usefully embed a live site to view it: `<iframe src="https://real.site">` inside a `data:`
document loads in the *site's own* origin — **cross-origin (opaque, un-inspectable, un-scriptable) and it
makes live network requests.** That is the opposite of what we want. So the op splits:

- **The launchpad (the Reel).** Runs in a normal, capable context (or the Elevated app). Your history *on
  tap*, self-reporting, filtering — the tape-line. It reads piles and their git logs; it never runs foreign
  code.
- **The on-ice viewer (the Tank).** A **sibling `data:` chamber** — a sensory-deprivation tank: null
  origin, no `subtle`, **no outside requests**, headless, **puppeted from the launchpad over the probe
  line**. It renders a captured page **from cached blobs** (not a live fetch), **on ice**: the DOM splayed
  open so you can see exactly what you saw, with a standard format for **notations from elsewhere**. Our
  job is *not* to plant a foreign site and let it run; it is to view the page **frozen**.

Rendering-on-ice notes (stretch, not v1): **DOM-flattening** so a page's init-time JS is moot (runtime JS
is the harder, later question); **strip the site's CSS** and lean on a rewritten **`useragent.css`** as the
normalizer — the one thing a commercial browser could never do (you can't rewrite styles that comingle with
theirs; here we're not keeping theirs, so we can normalize freely and add flavor back deliberately).

## What crosses the probe: three classes of data

The whole point of this pass — the kinds of data the beat sorts onto (or away from) the stage:

1. **Ignorable churn** — the supporting resources (CSS, JS, tracker tokens) that land in a history entry's
   folder but we do **not** keep. **`.gitignore` is the workhorse here** (see below): per-session, it can
   be extremely aggressive.
2. **The documents** — the concrete things you viewed. **Auto-commit / instant-commit**, a **session
   preference** the flow agent dictates (commit each view live, or batch on a tempo).
3. **Literally Private** — a label, a text body, a note you attach to a history entry. This is **not** a
   git commit in the session repo (see "Literally Private" below); it's a secret, stored as a secret.

## The git stage: `.gitignore` per session, history as commits, zero-diff revisits

The **per-session repository** model makes `.gitignore` unusually powerful: it is the exact expression of
**what we're configured to keep**. Browsing **history is git commits**; a **repeat visit with no change is
a zero-diff commit** (or no commit at all) — and where something *did* change (a rotating token in the
HTML, a timestamp) the diff shows precisely that. The **raw `git log` is real-time history reporting**,
available *during* the session or after — no separate history store, the commit graph *is* the record.

This is why the beat is downstream of this note: **commit-on-tempo** isn't the first goal, but it is an
operational one, and it's the same machinery as **flushing the stage on teardown**. The beat is a Rung-2
grant over `git.commit` (already vended — [git-enough/probe-ops.mjs](../git-enough/probe-ops.mjs)); this
note tells it *which files* (`.gitignore`-filtered) and *when* (session preference: instant / tempo /
on-teardown).

## Literally Private — secrets, not commits (and the keyring's fine print)

The `data:` chamber is **free to hold Literally Private data in many places** — we made sure we're alone in
the tank (barring riders on the chamber factory, who go to the same deprivation purgatory) — but everything
there **tears down without persistence**. So the model:

- Literally Private lives in a **secrets store**, not the session repo. When the chamber has it, it can
  **bus it back over the probe line** at any time — or better, **never hold it at all**: fetch-on-demand,
  a **secrets-manager where you may still say "show me the secret."**
- **Platform keychains are viable** (WebAuthn/credential store; non-extractable `CryptoKey` in
  origin-scoped IndexedDB on the *Elevated* origin). That's where keys belong.
- **The keyring fine print (a real hazard):** it is tempting to "publish your keyring" onto an
  ultra-private git meta-repo (great for key-rotation history + prior keys). But the offline origin is a
  place **where anyone can run content scripts in your context via extensions.** A keyring sitting readable
  in your own origin is exactly what a hostile extension harvests. So: **keys stay in the keychain**
  (non-extractable), and if a key-*history* repo is wanted it rides **its own most-private probe line** and
  holds **rotation metadata, not the secret material.** "The definition of private" has to survive the
  extension threat, or it isn't.

## Deletion, in stages (the shredding ladder)

Because someone can auto-commit a whole session and then, at the end, **decide they don't want it** (the
non-default path), we need a data model for **discarding a pile** — including one that already powers
public aggregate reporting. The stages, weakest to strongest:

1. **Drop from the stage** — never committed; the ephemeral shelf just isn't flushed. Nothing persisted.
2. **`.gitignore` / uncommit** — it was staged but is excluded or rewritten out; recoverable from history
   until history is pruned.
3. **Discard the pile** — remove the local record. But if it was ever *offered*, copies may exist
   elsewhere.
4. **Throw away the key — the first *unrecoverable* step.** Crypto-shred: destroy the seed and the sealed
   pile is noise, everywhere it ever went. This is the clean line between "deleted locally" and "gone."

The insight worth enshrining: **throwing away the key pre-satisfies every revocation request that ever
tried to reach you.** Instead of processing revocations one by one across old datasets (the hard,
never-quite-solved problem in [consent.mjs](../composer/consent.mjs)), shredding the key **pre-allows all
of them at once** — the data that powered public aggregates simply becomes unreadable noise, so the
aggregate can no longer resolve *you* out of it. It is the strongest possible revocation, and it's *cheap*.

*(The philosophical inversion: for Atlas I once imagined **unclaimed** data going free like a lootbox — but
Atlas owns no polls or piles, so that never fit. Here in offline-origin space the **inverse** is the sharp
tool: not "unclaimed becomes free" but "**shredded becomes nothing** — and that nothing is the most complete
consent-withdrawal there is.")*

## Honest constraints (name them so v1 is truthful)

- **CORS bounds the fetcher, not just the chamber.** Fetching arbitrary foreign resources is CORS-limited
  from **any** web origin. So "operate the browser over the open web" needs an **elevated fetcher** (an
  extension, or Origin's DNS/optical channels) — it can't be the null `data:` chamber, and even the
  Elevated origin can't freely fetch cross-origin. **v1 corpus = the constellation's own piles** (polls,
  submissions, your history, which are same-ecosystem and CORS-friendly); general web capture is the
  stretch that needs the elevated fetcher.
- **JS-hostility is a CSP safety stance, not a capability gap.** We *can* fetch JS into a blob and plug it
  into our laundered origin — and that is exactly the danger: a script we treated as *data* becomes *code*
  in *our* origin, and a permissive CSP could let it reach out. So the on-ice viewer **runs no foreign JS**;
  JS is archived as inert data, never re-executed in our origin.
- **The tank has no outside requests by construction** — a `data:` chamber's null origin can't do much, and
  we sandbox it further; capabilities arrive only down the probe line.

## How this sets up the staging beat (the next build)

**Built:** [`git-enough/staging-beat.mjs`](../git-enough/staging-beat.mjs) implements exactly this — the
`.gitignore`-filtered shelf, `instant`/`tempo`/`manual` + `teardownFlush()`, zero-diff no-op, and the
`mayRun()` authority gate (grant + recording). The cadence scheduler is built too
([`git-enough/scheduler.mjs`](../git-enough/scheduler.mjs)) — tempo `tick()` + teardown-flush + a concrete
"privileged budget" (`minGap` / `maxCommits`); what's left is the budget *policy* (ride it in the grant). With the above settled, the beat is well-defined:
- **What it stages:** the `.gitignore`-filtered "documents" class (2) — never the churn (1), never the
  secrets (3).
- **When it commits:** a **session preference** — instant-commit, commit-on-tempo, or only a
  **teardown-flush** when the chamber is dismantled.
- **Under what authority:** a Rung-2 **standing grant** over `git.commit`, shown in the grants panel,
  revocable mid-stream — and its cadence/worker is Origin's open **"privileged budget"** question.
- **Discard path:** the beat must make **stage 1–2 deletion trivial** (don't-flush / ignore) and hand off
  to **key-shred (stage 4)** for the unrecoverable step.

## Open questions

- **The elevated fetcher.** Extension vs. Origin's DNS/optical channels vs. accepting archival-first over
  ecosystem piles only. Determines how "browsing" the browser really is.
- **Runtime JS on ice.** Init-time JS is defused by DOM-flattening; is there ever a safe, sandboxed way to
  let *runtime* interactions replay, or is frozen-only the honest ceiling?
- **Session-preference surface.** Where instant/tempo/teardown-flush and the `.gitignore` policy are
  chosen (the "flow agent"), and how they read as grants.
- **Key-history repo shape.** If we keep one, exactly what metadata (rotations, prior-key fingerprints) is
  safe to store given the extension threat — and how its probe line is made "the definition of private."
