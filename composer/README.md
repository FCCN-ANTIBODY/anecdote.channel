# Composer — the experience

The composer is anecdote.channel's front door. It is **ingress**: it carries no user-side
constitution to moderate you. Its only opinion is the [reducer](../reducer/)'s — label-reduce
your words to the **kernel of intent** — and then it asks the single question that matters:
**where can this go?**

> There are no stupid questions, so anecdote posits there are **no stupid statements**. A
> statement is never blocked. It is only **routed** — and some statements simply aren't
> *offered* into some destinations.

## The model

**A subject is not a destination.** This is the crux. On a subreddit, the subject *is* a
canonical label-name someone owns and operates. In anecdote, the reduced label is an emergent,
unowned **subject that rides along** to a destination, where collision into that destination's
dictionary happens. So the **"to" field routes over destinations**, not subjects:

| | **Tell** | **Atlas** |
|---|---|---|
| what | a hub you **address directly** (you hold its QR / token / URL) | the **public, jurisdiction-scoped** directory (e.g. `colorado`) |
| discoverability | irrelevant — a Tell may not list itself anywhere | the bird's-eye side: `/tells`, peers, neighbor suggestions |
| in the picker | "you address this" · the private side | "public · &lt;scope&gt;" · the discoverable side |

What makes the list **fluent** is the **local cache** — your "installed" anecdote (the
lightweight, domain-scoped copy of this instrument) already knows:

- your **registered Atlases** and their **neighbor suggestions**,
- your **private Tells** that never appear on any public Atlas,
- each destination's **constitution shorthand** (the topics it excludes),
- the topics **you have self-muted** per destination — a banned-topics list *you* enforce,
  socially or by their constitution, to stop a statement being *offered* there.

Not all Atlases get the same traffic. Knowing their constitutions locally keeps your list
filtering as you type, so the only destinations that lead are the ones this anecdote can reach.

## How a statement flows

1. **You type.** Nothing leaves the device. The only loop is your keystrokes.
2. **It reduces** to its fewest-verbs intent (`Looking for sex` → `looking sex`).
3. **The picker routes it.** Each destination gets a verdict against the intent's tokens:
   - **offered** → selectable ("✓ you address this" / "✓ public · routable").
   - **not offered** → shown **dimmed, with the reason**, naming the topic
     ("— this Atlas's constitution excludes "sex"", "— you muted "politics" here").
     The door is visible and so is why it's shut — transparent, never shaming.
4. **You confirm.** "Prepare to send" assembles the hand-off `{ to, label, text }` — the reduced
   label riding along as the subject — and shows it. It **does not transmit**. Per the
   [CONSTITUTION](../CONSTITUTION.md) § Mobile LLM, nothing uses an event loop for anything but a
   user-confirmed action, and confirmation is never mandatory.

`"Looking for sex"` is the worked example: not a stupid statement, just not *offered* into the
public Atlases that exclude it — while the Tells you address directly stay open.

## Run it

ES modules need http, not `file://`:

```sh
python3 -m http.server 8000      # from the repo root
# open http://localhost:8000/composer/
node composer/route.test.mjs     # the routing core, dependency-free
```

## Shape

- [`route.mjs`](route.mjs) — the **pure decision core**: `intentOf` (reduce), `verdict`
  (offered? why?), `plan` (grouped, eligible-first), `prepare` (build hand-off, never send). No
  DOM, no network, no event loop — testable like the reducer.
- [`route.test.mjs`](route.test.mjs) — the worked cases, deterministic.
- [`index.html`](index.html) — a thin view over `route.mjs` + the reducer's embedder. The local
  cache (registered destinations, self-muted topics) persists in this origin's `localStorage`,
  i.e. domain-scoped to anecdote.channel.

## Crunch — the worker-bus proof

[`crunch.html`](crunch.html) is a runnable proof that what you type can be **crunched behind your
cursor, chasing your meaning**: keystrokes are embedded **off the main thread** in a Web Worker
and ranked against a small concept dictionary, surfacing live nearest-concept snippets — like
autocorrect for intent.

```sh
node scripts/serve.mjs            # static server for the repo root
# open http://localhost:8000/composer/crunch.html
node composer/crunch.test.mjs     # the ranking brain, dependency-free
```

Shape (same pure-core / thin-view split as the composer):
- [`model-bus.mjs`](model-bus.mjs) — **fluent, dependency-free** promise-RPC over a Web Worker:
  `await bus.ready; await bus.embed(text)`. Mirrors [`widget/public.html`](../widget/public.html)'s
  constitution — the worker announces ready **once** and is otherwise dormant, answering only the
  RPCs you address to it; no event loop beyond your keystrokes.
- [`model-worker.mjs`](model-worker.mjs) — hosts the embedder off-thread. **Embedder-agnostic**:
  the pure-JS toy embedder by default (instant, zero network); with `?real=1` it tries on-device
  **MiniLM** — the **vendored, hash-pinned** browser runtime under [`/runtime/`](../runtime/) (the
  esbuild-bundled transformers.js + the onnx wasm) loading the in-repo model, **no CDN** — and
  **falls back to toy** on any failure. A heavier "next tier" model swaps in behind the same bus.
- [`crunch.mjs`](crunch.mjs) — the pure ranking brain (`nearest`, `cosineSim`, `debounce`),
  Node-tested in [`crunch.test.mjs`](crunch.test.mjs).
- [`scripts/serve.mjs`](../scripts/serve.mjs) — tiny dependency-free static server (correct MIME
  for `.mjs`/`.wasm`/`.onnx`) so `/composer/`, `/runtime/`, `/models/` resolve from one origin.

**Status:** the toy backend runs anywhere with no network. The real-MiniLM runtime is
**vendored offline-of-CDN** (see [`docs/DELIVERY.md`](../docs/DELIVERY.md)) and now **flips to
`minilm` off-thread in the Worker** — `?real=1` (or the toggle) routes by real meaning, e.g. "the
bins were not emptied" → `trash pickup` (no shared tokens). The earlier in-Worker tokenizer
failure was a full-URL `localModelPath`; using worker-relative paths fixed it. Falls back to toy on
any failure. (Device load + per-embed timings: [`bench.html`](bench.html).)

## Not in this slice

Real on-device embeddings in the browser where the wasm loader isn't served (toy fallback covers
it; see above), live Atlas/Tell discovery and registration, the QR/token ingress into a Tell, and
the actual signed send. These prototypes are the **experience spine** those attach to.

The **payload** that a confirmed send hands off now has a shape: [`anecdote.mjs`](anecdote.mjs)
(`build` / `validate` / `verify`) turns `route.prepare`'s `{to,label,text}` into an `anecdote/v1` —
text inline, attachments as receipts (hash + provenance) whose bytes live in your references pile.
And [`sign.mjs`](sign.mjs) signs it on-device: one Ed25519 constituent signature over the whole
envelope, the Mobile LLM co-signing by its hash-pinned identity bound into the signed bytes, all
behind a revocable nonce. See [`docs/anecdote-schema.md`](../docs/anecdote-schema.md).

It all comes together in the **runtime tunnel** ([`docs/tunnel.md`](../docs/tunnel.md),
[`docs/egress-github.md`](../docs/egress-github.md)) — a host iframes anecdote.channel and says hello;
the guest builds, signs, posts out the door, and becomes the status view. A **worked end-to-end demo**
runs in a browser:

```sh
node scripts/serve.mjs                         # or: python3 -m http.server 8000
# open http://localhost:8000/composer/host-demo.html
```

[`host-demo.html`](host-demo.html) (a stand-in Tell poll sheet) frames [`guest.html`](guest.html)
(anecdote.channel): hello (origin-verified) → type → reduce → build → sign → post (simulated GitHub)
→ the guest becomes the detail view of its async status. What remains for production: a live GitHub
post credential + nonce minting/revocation (platform-side), and persisting a non-extractable key.
