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

- **The model** is local. *In the browser* transformers.js stores the ~23 MB ONNX weights in
  the **Cache API under the page's origin**, so it cold-loads with no network after first visit.
  *In Node* — and in any environment whose policy blocks HuggingFace — the weights are
  **vendored and hash-pinned**, served from anecdote.channel's own GitHub Release and verified
  on load (see [Dropping in the real instrument](#dropping-in-the-real-instrument) and
  `weights.mjs`). Either way it is a private, cold-loaded appliance, never a runtime call to a
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
feature-extraction model — mean-pooled, normalized) swaps in with no change to the core. It is
distributed the way the CONSTITUTION § Mobile LLM and civic-node OPEN-QUESTIONS §O ask for:
**one uniform, verifiable instrument** — vendored, **hash-pinned**, **cold-loaded**, never
fetched from a third party at runtime.

```sh
cd reducer && npm i                 # @xenova/transformers (optional dep, pinned 2.17.2)
node reducer/weights.mjs fetch      # pull + hash-verify the pinned weights into vendor/models/
node reducer/calibrate.mjs          # print recommended assignT/mergeT for MiniLM
node reducer/minilm.test.mjs        # synonymy collides; distinct stays distinct
```
```js
import { makeMiniLmEmbed, fewestVerbs } from "./embedders.mjs";

const embed = await makeMiniLmEmbed();              // local-first; verifies vendored weights
const r = new Reducer({ embed, name: fewestVerbs, reducerVersion: embed.reducerVersion,
  assignT: /* from calibrate.mjs */, mergeT: /* from calibrate.mjs */ });
```

`makeMiniLmEmbed()` loads the vendored weights only (`allowRemoteModels=false`) and carries
`.reducerVersion` — the canonical id **keyed by the weights' SHA-256**, so a label anchored to
these bytes can never be confused with a different quantization. Pass `{ local:false,
allowRemote:true }` in an environment where huggingface.co is permitted to use transformers.js's
own download instead (relies on `NODE_EXTRA_CA_CERTS` behind a proxy).

With real embeddings, synonymous utterances ("library catalog codes" / "Dewey numbers") collide
where the toy can't — the demo's honest miss becomes a merge.

### Distribution & bootstrap

The weights are **not** committed to this Jekyll repo (they live in the gitignored `vendor/`)
and **not** in git-LFS — they are a **GitHub Release asset** on `FCCN-ANTIBODY/anecdote.channel`,
fetched over `objects.githubusercontent.com` and checked against the SHA manifest in
`weights.mjs`. To mint that manifest once (where HuggingFace is reachable):

```sh
node reducer/weights.mjs record <downloaded-model-dir>   # prints the pinned manifest + version
node reducer/weights.mjs verify                          # re-hash on disk vs the manifest
```

Until the manifest is pinned, `weights.mjs`, `calibrate.mjs`, and `minilm.test.mjs` all
**skip/refuse cleanly** — the dependency-free `test.mjs` and `demo.mjs` keep passing regardless.

## Not yet (the layers above this core)

- **fewest-verbs naming** is a heuristic (`fewestVerbs`); v1 is the small *generative* model
  rewriting to atomic form — but the embedding carries the meaning regardless, so the core
  stands without it.
- **nudge-not-write-in approval**, **cold-load / untampered verification** of the cached model,
  and a trust-weighted (distinct trusted signers) gatherer count are open mechanism — this core
  is the spine they attach to.

---

History: this began as a runnable spike under `prototype/reducer/` in `civic-node`. It is now
enshrined here, in `anecdote.channel`, its authoritative home.
