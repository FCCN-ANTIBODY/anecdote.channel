# Anecdote reducer — the Mobile LLM instrument

This is the authoritative home of the **first-contact reducer**: the on-device "Mobile LLM"
the [`CONSTITUTION`](../CONSTITUTION.md) promises under **§ Mobile LLM**, and the thing that
makes **§ Responses** ("a fewest-verbs form to express its self-determined concept")
mechanical rather than aspirational.

> _"Anecdote delivers a heavily pruned mobile LLM for your browser, but you must run it with
> your device's power… If a fundamentally context-aware agent cannot rationalize Your Input,
> 1) it will not be collected and 2) you will be allowed to know it."_ — CONSTITUTION

Its pristine, only job is **label reducing**: turning whatever a constituent types into a small
set of atomic labels, **privately, in memory, on their own device, before anything flies into
the network**. It is assistive tech — it shapes a person's words into the constitution's accepted
form and shows them the result; it never writes on their behalf.

## What it does

- **Labels are anchored to their fewest-verbs name's embedding**, not a drifting centroid — a
  growing curated dictionary. The name is durable; the vector is derived and keyed by the
  embedder version (a label's `constitution_sha`).
- **`assign()` = proposer + acceptor** — nearest label by cosine proposes; a threshold accepts;
  mint a new label only when nothing clears the bar. Multi-label.
- **`ratchet()` = merge-only convergence** — fold any two labels whose names embed within
  `mergeT` into one, *one way*, to a fixpoint. Label count only ever drops and there is no
  split, so it terminates and **cannot flicker** (no reversal trap). This is where
  cross-gatherer duplicates collapse and the trust-weighted **gatherer count** falls out.

## Run

```sh
node reducer/test.mjs   # deterministic, dependency-free — core + persistence
node reducer/demo.mjs   # two gatherers -> union -> ratchet -> fixpoint -> local cache
```

Both use a **toy embedder** (bag-of-content-words → cosine). It proves the assign/collide/merge
*logic* offline; it does **not** understand synonymy — the demo ends on an honest miss to make
that explicit. "Does the algorithm converge" and "does the model load" are deliberately separate
problems.

## The local cache (CONSTITUTION § Mobile LLM)

The CONSTITUTION forbids a persistent backend, so the reducer's state is cached **locally, in
domain-scoped storage on the constituent's device** — never a server.

- **The model** is local. The ~23 MB quantized ONNX is **committed in this repo** under
  `models/Xenova/all-MiniLM-L6-v2/`, so it arrives with every clone and loads cold with no
  network — and is **hash-pinned**: `makeMiniLmEmbed` verifies every byte against
  `reducer/model.lock.json` before use (see [Dropping in the real instrument](#dropping-in-the-real-instrument)).
  *In the browser* transformers.js can additionally cache weights in the **Cache API under the
  page's origin**. Either way it is a private, cold-loaded appliance, never a runtime call to a
  third party.
- **The dictionary** persists as *durable names only*. A snapshot (`toJSON()`) carries the
  label names, members, and aliases — **never the float vectors**. On load, every vector is
  **re-derived** from its name with the same-version embedder (`Reducer.from` /
  `Reducer.load`). The name is authoritative; the vector is reconstructed. A version mismatch is
  refused rather than silently trusting stale floats.

```js
import { Reducer } from "./reducer.mjs";
import { toyEmbed, fewestVerbs } from "./embedders.mjs";
import { idbStore } from "./store.mjs";   // browser: IndexedDB, partitioned per origin

const store = idbStore();                  // domain-scoped to anecdote.channel
const r = await Reducer.load(store, "anecdote:dictionary", { embed: toyEmbed, name: fewestVerbs });
await r.assign("Is there shade at this park?");
await r.save(store);                        // persists names, not embeddings
```

A `store` is just `{ get, set, delete }` returning promises; `memoryStore()` is the
dependency-free default the tests use, `idbStore()` is the browser's domain-scoped cache.

## Dropping in the real instrument

The embedder is pluggable and async, so `all-MiniLM-L6-v2` (a 384-dim bi-encoder
feature-extraction model — mean-pooled, normalized) runs with no change to the core. It is the
**one uniform, verifiable instrument** the CONSTITUTION § Mobile LLM and civic-node
OPEN-QUESTIONS §O ask for: the quantized weights are **committed in-repo** at
`models/Xenova/all-MiniLM-L6-v2/`, **hash-pinned** in `reducer/model.lock.json`, and
**cold-loaded** — never fetched from a third party at runtime.

```sh
cd reducer && npm i                 # optional dep: @huggingface/transformers (transformers.js v3+)
node reducer/weights.mjs record     # writes model.lock.json: file SHAs + canonical version
node reducer/calibrate.mjs          # writes calibrated assignT/mergeT into the lock
node reducer/minilm.test.mjs        # synonymy collides; distinct stays distinct
```
```js
import { makeMiniLmEmbed, fewestVerbs } from "./embedders.mjs";
import { thresholds } from "./weights.mjs";

const embed = await makeMiniLmEmbed();              // local-first; verifies the in-repo weights
const { assignT, mergeT } = thresholds();          // calibrated, from model.lock.json
const r = new Reducer({ embed, name: fewestVerbs, reducerVersion: embed.reducerVersion, assignT, mergeT });
```

`makeMiniLmEmbed()` loads the in-repo weights only (`allowRemoteModels=false`, `dtype:"q8"` for
the committed quantized ONNX) and carries `.reducerVersion` — the canonical id **keyed by the
weights' SHA-256**, so a label anchored to these bytes can never be confused with a different
quantization. Pass `{ local:false, allowRemote:true }` where huggingface.co is permitted to use
the library's own download instead.

> **Package note:** uses `@huggingface/transformers` (transformers.js v3+), which lazy-loads
> `sharp`, so text feature-extraction runs without native image libraries. The older
> `@xenova/transformers` v2 eager-loads `sharp` at import and won't start where libvips can't be
> fetched.

**What MiniLM-L6 buys (honestly):** real embeddings collide *no-shared-token* synonyms the toy
can't — "trash pickup" ↔ "garbage collection", "more bus routes" ↔ "expand public transit". But
it is a small model: synonymy that needs world knowledge ("Dewey decimal" = "library catalog")
sits below the precision-preserving merge threshold and does **not** auto-fold. `calibrate.mjs`
reports exactly which pairs separate and which don't, and `minilm.test.mjs` encodes both the win
and the documented limit. Better naming (the generative fewest-verbs v1) or a larger embedder is
the lever for the hard cases.

### How the lock is produced

`reducer/model.lock.json` is **generated, not hand-edited**: `record` pins the committed weights'
SHAs + version; `calibrate` writes the thresholds. Because you may not have a local Node
environment, the **`.github/workflows/reducer-model.yml`** workflow does this in CI on any change
under `models/` or `reducer/` — record → calibrate → verify → test → commit the refreshed lock
back to `main` (`[skip ci]`, idempotent, so steady-state runs are no-ops). Until the lock carries
SHAs/thresholds, `weights.mjs`/`calibrate.mjs`/`minilm.test.mjs` **skip cleanly** and the
dependency-free `test.mjs`/`demo.mjs` keep passing.

## Generative naming (v1) — plumbed, model deferred

The `name` seam is anchored to the heuristic `fewestVerbs` by default. v1 upgrades it to a small
**generative** namer (`makeNamer()`, default `Xenova/flan-t5-small`) that rewrites an utterance to
its atomic fewest-verbs concept — the lever for synonymy the embedder can't resolve on raw text
(e.g. "Dewey decimal" ≈ "library catalog"). It's distributed exactly like the embedder (in-repo,
hash-pinned in the lock's optional `namer` block, cold-loaded) and decodes **greedily** for
determinism; it **falls back to `fewestVerbs`** on any degenerate output, so naming never breaks
reduction.

The ~135 MB seq2seq model (separate encoder + decoder ONNX) is **deferred** — not committed yet —
so `makeNamer`, `namer.test.mjs`, and `weights.mjs record-namer/verify-namer` all **skip/refuse
cleanly**, and `fewestVerbs` stays the default. To activate it later, vendor the model under
`models/Xenova/flan-t5-small/` and let CI (or in-session) run the same loop as the embedder:

```sh
node reducer/weights.mjs record-namer   # pins the namer into model.lock.json's `namer` block
node reducer/calibrate.mjs              # re-derives thresholds over generative names
node reducer/namer.test.mjs             # asserts naming is deterministic and helps collision
```

`makeNamer()` carries `.namerVersion` (hash-keyed like `.reducerVersion`). The reducer's `name`
seam is async-capable, so `new Reducer({ embed, name: await makeNamer(), ... })` just works.

## Not yet (the layers above this core)

- **nudge-not-write-in approval**, **cold-load / untampered verification** of the cached model,
  and a trust-weighted (distinct trusted signers) gatherer count are open mechanism — this core
  is the spine they attach to.
- **nudge-not-write-in approval**, **cold-load / untampered verification** of the cached model,
  and a trust-weighted (distinct trusted signers) gatherer count are open mechanism — this core
  is the spine they attach to.

---

History: this began as a runnable spike under `prototype/reducer/` in `civic-node`. It is now
enshrined here, in `anecdote.channel`, its authoritative home.
