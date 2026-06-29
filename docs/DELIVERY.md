# Delivery — how the instrument reaches a device

This answers the piece civic-node `OPEN-QUESTIONS.md` **§O** leaves open:

> *"who serves the model, and how a client verifies it loaded **cold and untampered** (pinned
> hash / signed weights?)."*

The answer is **content addressing**: the whole instrument is hash-pinned, so the *source*
becomes irrelevant and interchangeable — a CDN edge today, a neighbor's screen tomorrow, a mesh
hop after that, each verified against the same lock. Delivery is therefore not one wire; it is a
**verified artifact** plus a **set of sources** ranked by speed and reach.

## The spine: content addressing makes the source not matter

The reducer already pins its weights in `reducer/model.lock.json` and refuses anything that
doesn't match (see [`reducer/README.md`](../reducer/README.md), "The local cache" and "Dropping in
the real instrument"). Extended to the **whole instrument** — library + onnx runtime + weights —
the lock becomes §O's *"one uniform, verifiable instrument everyone runs identically."* Once a
consumer can verify the bytes, it can accept them from anyone. That is the precondition for every
source below.

## The instrument, in layers (vendoring tiers)

Three separable layers, distributed differently because they scale differently:

| Layer | Files | Size | Where it lives |
| --- | --- | --- | --- |
| **Library** | `transformers.web.min.js` | 0.43 MB | in-repo (Tier-0) |
| **Runtime** | `ort-wasm-simd-threaded.jsep.mjs` (loader) + `…jsep.wasm` | 0.05 + **26.1 MB** | in-repo (Tier-0) |
| **Weights** | MiniLM `model_quantized.onnx` + tokenizer/config | ~23 MB | in-repo (Tier-0) |
| | namer (flan-t5) · "next tier" | ~135 MB · 250 MB+ | **Tier-1: your edge, hash-pinned, fetched + verified** |

- **Tier-0 (~50 MB, committed):** library + runtime + MiniLM. Runs from a bare clone, **offline of
  any CDN** — every Tier-0 byte is obtainable from the **npm registry** (the wasm ships inside the
  `onnxruntime-web` package; the loader is **bundled in transformers' own dist**, *not* CDN-only as
  once feared). The only CDN dependency was the default `wasmPaths`, overridden to a local path.
- **Tier-1 (big weights):** served from anecdote.channel's **own Cloudflare edge** (or a GitHub
  Release origin it fronts — `objects.githubusercontent.com` is reachable where CDNs are not),
  fetched at load and SHA-verified against the lock. Reuses the edge plumbing already here
  ([`docs/tls-acm.md`](tls-acm.md), `scripts/reconcile-acm.sh`, `scripts/check-edge.sh`).

**Efficiency lever (to test):** the `jsep` wasm (26 MB) is WebGPU-capable; the plain
`…simd-threaded.wasm` is roughly half that. The model is tiny, so wasm-only may suffice — a
"best-config" decision that could cut Tier-0 by ~15 MB.

## The sources, ranked (DNS now → optical → mesh)

1. **DNS / edge — round-1 nervous system (primary, fast).** The constellation already routes
   subdomains through Cloudflare ([`atlas.anecdote.channel/DNS.md`](https://github.com/FCCN-ANTIBODY/atlas.anecdote.channel/blob/main/DNS.md)).
   The instrument is served same-origin, cached at the edge, verified against the lock. This is how
   nearly everyone gets it.
2. **Optical QR fountain — offline / peer / last-resort (slow, unkillable).** Screen→camera
   transport for the air-gapped and the network-denied. Continuous with the constellation's
   existing *"the QR is the floppy disk"* framing
   ([tell `docs/qr-provenance.md`](https://github.com/FCCN-ANTIBODY/tell.anecdote.channel/blob/main/docs/qr-provenance.md)),
   extended from polls to the **instrument itself**. Spec below.
3. **Mesh — the molasses future (resilient, neighborly).** *"Neighbors, not a graph"* (civic-node
   `VISION.md`; §M): you are sometimes fewer hops from someone who already has what you want. The
   optical channel is the *physical-layer* mesh primitive; DNS is the *logical* one. Content
   addressing unifies them — same lock, any neighbor.

## Optical transport (documented future mechanism — not built)

A model is too big for one QR, so transmit it as a **rateless fountain code** (LT → Raptor /
RaptorQ): the display **radiates an endless stream of encoded symbols**, and a receiver decodes
once it has collected **≈ K·(1+ε) *distinct* symbols** (ε ≈ 5%), *not any particular ones*. This
is the load-bearing property:

- **No handshake, no shared clock.** The loop just shines; cameras just soak. Any holder can
  generate unbounded fresh symbols — which is why **every holder is a retransmission factory**.
- **Redundancy is free / automatic.** Every frame is already a repair frame for the whole block,
  so the "bloated checksum lagging behind the read head" is simply the steady state.
- **Two camera classes, one loop.** Interleave near **60 fps / 30 fps** (curve-graded to
  practical numbers) so both sensors sample distinct frames. The honest limiter is **distinct-
  capture rate** — rolling shutter × refresh beat × exposure × decode — realistically ~10–30
  symbols/sec, *not* raw fps. So a faster camera buys **earlier completion + jank repair**, not a
  linear speedup.
- **Diff-repair (a two-way optical mesh primitive).** A receiver does block analysis, flashes a
  tiny **need-map** QR of what it's missing/janky; a helper who holds the instrument radiates
  **targeted** symbols for exactly those blocks. Recovery, not re-download — *"no matter the
  size."*

**The math that forces the layering** (≈ 1–1.5 KB usable per QR, screen→camera realistic, below
the v40 ~2,953-byte ceiling; ~10–30 distinct symbols/sec):

| Artifact | Symbols (≈) | Optical time (≈) |
| --- | --- | --- |
| Tier-0 (~50 MB) | 33k–50k | ~½–1+ hr |
| + namer (~135 MB) | 90k–135k | ~1.5–2.5 hr |
| + next tier (~250 MB) | 170k–250k | ~3–4 hr |

So "100–200k QR codes" is *accurate* for the big tiers, and optical is an **hours** channel. This
is exactly why **DNS is primary, optical is the resilient fallback, and "lean whale" is required,
not aesthetic** — every megabyte trimmed is *minutes* off the worst case, and every byte left out
is a side-channel we choose to trust later.

## Roadmap (what's deferred, in order)

1. **Tier-0 vendor + whole-instrument lock** — commit library + runtime, extend the lock to
   `lib`/`runtime`/`weights`, point the worker's `wasmPaths`/`localModelPath` at the in-repo
   copies. The crunch badge ([`composer/crunch.html`](../composer/crunch.html)) then flips to
   `minilm` offline-of-CDN, with the whole stack verified.
2. **Tier-1 edge channel** — stand up the models origin behind the edge + the fetch-and-verify
   path; vendor the namer there; activate v1 naming.
3. **Optical encoder/decoder** — the fountain loop + camera reader + diff-repair, as the offline
   and mesh source.

## See also
- civic-node `OPEN-QUESTIONS.md` §O (the open mechanism this answers), §M (neighbors/discovery).
- civic-node `VISION.md` — *"neighbors, not a graph."*
- [`reducer/README.md`](../reducer/README.md) — cold-load, `model.lock.json`, the local cache.
- [`docs/label-reducer.md`](label-reducer.md) — what the instrument *is* (the identity it boots into).
- tell `docs/qr-provenance.md` — *"the QR is the floppy disk."*
