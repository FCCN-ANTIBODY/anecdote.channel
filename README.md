# anecdote.channel

Anecdote lets a city poll itself without consenting to anyone's privacy policy — open
questions, write-in answers, anonymized by a revocable nonce, orchestrated on the smartphones
people already carry. It is governed by its own [`CONSTITUTION`](CONSTITUTION.md).

This repository is the **authoritative home** of Anecdote's shared instruments.

## The Mobile LLM reducer

[`reducer/`](reducer/) is the on-device "Mobile LLM" the CONSTITUTION promises
(**§ Mobile LLM**, **§ Responses**): a heavily pruned instrument you run with your own device's
power, whose only job is **label reducing** — shaping free text into the constitution's
fewest-verbs form, **privately, in memory, before anything flies into the network**, and
caching its dictionary **locally, in domain-scoped storage**, never on a backend.

```sh
node reducer/test.mjs   # core + local-cache persistence, dependency-free
node reducer/demo.mjs   # two gatherers collide; dictionary cold-loads from a domain-scoped cache
```

See [`reducer/README.md`](reducer/README.md) for the algorithm, the local cache, and how the
real on-device model (transformers.js + all-MiniLM) drops in behind one seam.

## Other contents

- [`widget/`](widget/) — the baked, dormant (no event loop, no live fetch) public widget a
  civic node embeds.
- [`config/`](config/), [`scripts/`](scripts/), [`docs/`](docs/) — TLS/ACM edge plumbing for
  serving the channel.
