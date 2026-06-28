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

- **The model** caches itself: with the real embedder, transformers.js stores the ~23 MB ONNX
  weights in the browser **Cache API under the page's origin**. After the first visit the
  instrument cold-loads with no network — a private, in-memory appliance.
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

The embedder is pluggable and may be async, so the on-device model swaps in with no change to
the core:

```sh
npm i @xenova/transformers
```
```js
import { makeMiniLmEmbed, fewestVerbs } from "./embedders.mjs";

const embed = await makeMiniLmEmbed();      // Xenova/all-MiniLM-L6-v2, on-device
const r = new Reducer({ embed, name: fewestVerbs, reducerVersion: "Xenova/all-MiniLM-L6-v2" });
```

`all-MiniLM-L6-v2` is ~23 MB ONNX, runs in Node and the browser, ships over NPM — the literal
shape of "one pinned package everyone runs identically." With real embeddings, synonymous
utterances ("library catalog codes" / "Dewey numbers") collide where the toy can't.

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
