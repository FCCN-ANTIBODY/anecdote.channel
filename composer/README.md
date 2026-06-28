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

## Not in this slice

Real on-device embeddings (the toy embedder routes on shared tokens, so synonyms like
"intimacy"/"sex" don't yet collide — that's [MiniLM](../reducer/)'s job), live Atlas/Tell
discovery and registration, the QR/token ingress into a Tell, and the actual signed send. This
prototype is the **experience spine** those attach to.
