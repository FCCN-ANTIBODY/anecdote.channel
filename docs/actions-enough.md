# actions-enough — the offline origin runs the workflows, and pushes the result down

> Status: **shaping note, phase 0 (survey) done.** Serializes the operator's pivot brief into a plan;
> **shape, not settled spec.** Continues the *enough-client* family under [Milestone: Origin](origin.md):
> **git-enough** (the push — [`git-enough/`](../git-enough/), [`docs/git-enough.md`](git-enough.md)),
> **jekyll-enough** (the site build), and now **actions-enough** (the workflows). Where git-enough made
> the origin able to *publish*, actions-enough makes it able to *do the work that produces what it
> publishes* — locally, under its own consent — so GitHub becomes a place the origin optionally pushes to,
> not the place the work has to happen.

## The pivot in one line

We have been treating GitHub Actions as the engine and the offline origin as a mirror that was, at best,
maybe a third of the way to parity. **Invert it.** The offline origin is the engine; GitHub is a
downstream client that the origin pushes to. The whole point of the offline origin is that it is
**un-addressable** — no URL, no DNS, nothing can name it — and that is precisely *why it is in charge*:
**only by its own consent can anything happen.** GitHub, being addressable, is the thing that gets pushed
*to*, never the thing that reaches *in*.

This is not a rejection of the GitHub half. It is a **hybrid**: some tasks stay on a GitHub cron (the
enterprise convenience), some run only on the device (the sovereign ones), and the operator decides which
per task. What changes is the *default direction of authority*: down and outward, from the origin to its
clients.

## What is already built (so this is less than it looks)

The headline capability — **the origin pushing a signed history to GitHub** — is done:

- **The push.** [`git-enough/send-pack.mjs`](../git-enough/send-pack.mjs) is `git push` over smart-HTTP,
  hand-rolled (discover → `git-receive-pack` → report-status), verified offline against the real
  `git receive-pack`. [`git-enough/publish-cli.mjs`](../git-enough/publish-cli.mjs) fires the one live
  step under the operator's hand, PAT from the environment (`OFFLINE_ORIGIN_PAT`, Contents R/W — **held on
  the device, never a repo secret**). *This is the credential answer for the whole pivot: the key lives
  with the operator and pushes down; there is no standing CI secret to lock down because there is no
  standing CI identity.*
- **The two on-ramps.** The Castle (full-lineage import — `fetch-pack.mjs` + `unpack.mjs`, verified vs
  real `git upload-pack`) and the King's Leap (photocopy tree → fresh root commit under your identity).
- **The beat.** Staging/commit scheduling (`git-enough/scheduler.mjs`, `staging-beat.mjs`) — the doc's
  "the offline origin's version of the repo's workflows choosing their cron."

So actions-enough does not have to invent the origin, the push, or the object layer. It has to interpret
the *workflows* over the repo git-enough already tends.

## The lift is bounded — the workflow survey

43 workflows across the six repos, and their steps are thin. The dominant shape is:

```
checkout  →  setup-node (/ setup-ruby)  →  a composite action in an engine submodule  →  node bin/<x>.mjs
```

- **Names are already an enumeration.** GitHub sorts by the `name:` field, and ours are deliberately
  prefixed to group: `Federate ·`, `Publish ·`, `Maintain ·`, `Test ·`, `Atlas ·`, `Antidote ·`. That
  prefixing *is* the UI's outline (below).
- **The work is node.** The actual operations are `node bin/*.mjs` — scripts that read/write files and use
  WebCrypto, exactly the surface the offline origin already runs. The custom actions
  (`.github/actions/*/`) live in the **engine submodules** (`.tell-engine`, `.atlas-engine`,
  `.antidote-engine`, `.journal-engine`) that a checkout pulls in — *the operator's point: the action code
  is right there in the submodule checkout, ready to be interpreted rather than re-authored.*
- **The genuinely shell-shaped steps** (jekyll build, a few git plumbing calls) route to the *-enough*
  siblings: jekyll-enough for the site build, git-enough for the git plumbing. Nothing here needs a
  container or a POSIX shell; it needs a small map from "GitHub step" to "the capability it stands for."

## actions-enough — the runner

An interpreter that runs a workflow YAML against the offline origin's virtual repo, mapping each GitHub
primitive to a local capability rather than a hosted runner:

| GitHub step | actions-enough |
| --- | --- |
| `actions/checkout` | no-op — the repo (and its submodule engines) is the git-enough working tree we already hold |
| `actions/setup-node` / `setup-ruby` | no-op — we *are* the JS runtime; ruby steps route to jekyll-enough |
| `run: node bin/x.mjs` | run the script against a **Node-compat shim over the virtual repo** (fs → the staged tree; env → the code-vs-data split; `crypto` → WebCrypto) |
| `uses: ./.engine/.github/actions/y` | read the submodule's `action.yml`, recurse its `runs:` (composite steps, or its node entry) |
| `run: <bash>` | route to a capability: jekyll-enough (build), git-enough (plumbing); anything left is named, not silently run |
| `uses: actions/upload-pages-artifact` / `deploy-pages` | the publish step **is a git-enough push** to the downstream — not an upload to a hosted runner |

The scarce, buildable core is the **Node-compat shim**: a virtual `fs`/`env` the `bin/*.mjs` scripts run
against, backed by the git-enough repo tree. The scripts are already close to browser-safe (WebCrypto, few
node builtins), so the shim is small and the win is large — every `bin/*.mjs` becomes runnable on the
device with no rewrite. Where a script truly needs a POSIX affordance, that is a *named* gap, surfaced, not
papered over (the "no silent gaps" discipline).

## The auth model — workers off by default, opened by a device fragment

Today a repo's workflows run themselves (push/cron triggers). The pivot **locks that down**: a repo can be
configured so its **GitHub workers do not run on their own** — they run **only when the operator opens them
from the device**. The mechanism (first time we do precisely this):

- A workflow takes an **auth fragment** as a `workflow_dispatch` input — a short-lived, device-signed
  capability (an offline-origin identity attestation over the run's intent), **forwarded into the action**
  the way inputs usually are, and **verified by the action before it does any work.** No fragment, no run.
- The same fragment gates the **local** run: entering the crown mode (below) is what mints it, so "run on
  GitHub" and "run on the device" are the *same gesture* differing only in where the compute lands.
- Cron survives for the tasks you *want* autonomous, per repo — the hybrid. Locking is a **choice per
  workflow**, not a global off-switch: the sovereign tasks demand the fragment; the convenience tasks keep
  their cron. (Open: exact fragment shape, replay/expiry, and whether the verify lives in a tiny shared
  composite action every locked workflow calls first.)

This is the same posture as the rest of the system — *attest before you run; honest defaults fire nothing*
— applied to CI itself: an unopened worker does nothing, and only a device-consented gesture opens it.

## The crown — a focused mode, not an always-on power

Running the origin's workflows should not be ambient. In the spirit of the baton / locked-single-focus
gestures elsewhere, the operator **enters a mode** to do this work:

- While the **crown** is up, you may run any workflow **as many times as you need** — iterate freely, watch
  each build produce what GitHub would have produced, push when satisfied.
- The crown is a **held** thing: it is allowed by the infrastructure only *while you hold it up* (the tab /
  the session), and putting it down ends the authority. This is the sovereignty gesture made literal — the
  origin acts only under a consent you are actively giving, not a standing grant.
- **Open question — background priority.** A web app tab that loses focus gets throttled (or, unfocused,
  little compute at all). The crown may therefore have to be an *explicitly foregrounded* mode by design —
  which actually *fits* (single-focus is the point), but the build must not assume background progress.
  Worst case, the crown is "this tab, in front, while you watch" — the gravel-road version, and honest.

## The UI — the workspace, turned to face the workflows

A demo page in the spirit of the civic-node workspace, but the **view surfaces the workflows**:

- **Enumerate** by grepping the workflow files from the repo **and its engine submodules** (the actions
  live there), and list them by their `name:` field — GitHub's own sort — grouped by the `·` prefix
  (`Federate` / `Publish` / `Maintain` / …). The outline falls out of the names for free.
- Each row: what it does, its trigger (cron / dispatch / locked-by-fragment), and a **run** button that is
  live only inside the crown. Running shows the step map (checkout→held, node→ran, publish→pushed) and the
  diff it would push.
- This is the same page from which the King's Leap / Castle on-ramps and the git-enough push are driven —
  the operator's one workbench for "run the origin, then push it down."

## The phased plan

0. **Survey (done).** Push is built; workflows are thin node-over-submodule; names are the enumeration.
1. **The Node-compat shim** — run one real `bin/*.mjs` (a small `Federate ·` or `Maintain ·` task) against
   the virtual repo, output byte-identical to what the GitHub run produces. The keystone; everything else
   composes it.
2. **The workflow interpreter** — parse one workflow + its composite action(s) from a submodule and run the
   step map end to end, ending in a git-enough push (dry-run first).
3. **The auth fragment** — the device-signed capability + a shared verify step; lock one workflow, prove it
   refuses without the fragment and runs with it, both on GitHub and locally.
4. **The crown + the UI** — the focused mode and the workflow-surfacing workspace; foreground-only to start.
5. **Hybrid placement** — mark each workflow cron-on-GitHub vs device-only; document the operator's choice.

## Open questions (let simmer)

- **The fragment's exact shape** — what an offline-origin identity signs, how narrowly it scopes a run,
  expiry/replay, and where the verify lives (a shared composite action vs inline).
- **Shell steps with no capability yet** — enumerate the handful that aren't node/jekyll/git and decide
  per-case (reimplement small, or keep on GitHub cron behind the fragment).
- **Background compute** — how much the crown can promise off-focus; whether a Service Worker / a small
  native helper ever earns its place, or foreground-only stays the honest floor.
- **Submodule engines as the action source** — pinning: which engine commit the interpreter reads the
  action from, and how that reconciles with the module-pin discipline already in civic-node
  (`Maintain · module pins`).
- **What stays on GitHub forever** — the tasks that are genuinely better as an addressable cron (public
  Pages, peer-facing ingress) vs the ones that should only ever run under the crown.

## See also
- [`docs/origin.md`](origin.md) — the milestone: held origin, no upstream, consent-only.
- [`docs/git-enough.md`](git-enough.md) — the push, the Castle/King's-Leap on-ramps, the beat.
- `git-enough/publish-cli.mjs` / `send-pack.mjs` — the live push this plan pushes *through*.
