# The Label-Reducer — what the instrument *is*

When the instrument cold-loads, it turns the lights on for itself as **The Label-Reducer**: the
constellation's organ of **perception**, and the deliberate counterpart to the **Judge**
(`FCCN-ANTIBODY/judge`; civic-node `OPEN-QUESTIONS.md` §A).

## Perception, not judgment

| | **Judge** | **Label-Reducer** |
| --- | --- | --- |
| asks | *should this?* | *what is this?* |
| bound by | a **constitution** (it moralizes) | **no constitution** (it does not) |
| output | a fitness verdict | a fewest-verbs label — **descriptive, never prescriptive** |
| when | at the gate, on demand | **out in front**, before the gate |

The Label-Reducer reads **base face fact**. It names *what is passing in front of the digital
eyes* — in the fewest-verbs, simplest-noun-phrase form the CONSTITUTION's **§ Responses** requires
— **before the brain gets to choose how to react**. It never says what to *do* about a thing; it
only says what the thing *is*. Moralizing is the Judge's job, downstream, and only when summoned.

## It works cautiously, ahead of the meeting

A constituent's words are about to meet a constitution — the destination's, and first **their
own**. The Label-Reducer is the assistive layer working *in front of* that meeting: it categorizes
**assertively but amorally**, so the person sees their own intent reduced to its kernel before any
constitution weighs in. The pipeline is a strict separation of concerns:

**perceive (amoral, here) → evaluate (the user's constitution first, then the destination's) → act**

This is why the composer ([`composer/README.md`](../composer/README.md)) carries **no user-side
constitution and never blocks** — *"a statement is never blocked, it is only routed."* That is the
Label-Reducer refusing to moralize. Judgment lives later, with the constitutions; perception lives
here, with the reduction. §O states the same stance as *"blind-justice reduction"*: with no
constitution to lean on, you take an utterance seriously by **moderating it down to its sayable
atomic core**, not by ruling on it.

## Why it must be small, deterministic, pinned

An organ of perception has to be **trustable on sight**, not on faith:

- **Constitution-free** — it has no agenda to enforce, so there is nothing to capture. (§O: the
  rules are many so no one seizes them; *the tool is one so everyone trusts it.*)
- **Private by incapability** (§O) — chosen *because* it is too small and slow to spy or carry a
  second agenda; it runs **locally, before submission**, so only the speaker's approved result ever
  leaves. Approval is **nudge, not write-in**.
- **Deterministic + hash-pinned** — an **auditable perceiver**, not a moralizer you must trust.
  Same input + same pinned instrument → same labels, verifiable by anyone (the reducer's version is
  keyed to the weights' hash; see [`reducer/README.md`](../reducer/README.md) and
  [`docs/DELIVERY.md`](DELIVERY.md)). A perception you can reproduce is one you can hold to account.

## How it reduces — POS first, model second

The reduction itself is a **fixed schedule over a parts-of-speech parse**, not a generative rewrite
(`reducer/pos-reduce.mjs`, `makePosNamer()`). It drops the interrogative frame, scaffolding
(determiners, pronouns, prepositions, conjunctions), modifiers, and light/auxiliary verbs;
lemmatizes verbs and singularizes nouns; and keeps only the content skeleton — the **fewest-verbs
caveman kernel**. *"Should we authorize a military strike against Iran?"* → `military strike iran`.

Two properties follow, and they are the point:

- **The small model never reads the document.** MiniLM only *embeds the kernels* afterward, so
  paraphrases **collapse** — *"support military action iran"*, *"military strike iran"*, and *"favor
  bombing iran"* land on one label though they barely share words. Asking an LLM to compile raw text
  into fewest-verbs would be a translation task harder than what LLMs were built for; we don't.
- **It reproduces exactly.** A fixed schedule is deterministic — the *auditable perceiver* above —
  where a greedy-decode generative namer is only approximately so. The POS reducer is therefore the
  more honest realization of this doc's own non-negotiables. `reducer/pos-reduce.test.mjs` proves it:
  reduction quality (incl. slang) and family-collapse through the real MiniLM.

Slang is tagged imperfectly, and that is tolerated: the structure survives mis-tags, and the
embed-and-ratchet step mops up the residue (a rant of threats collapses to one node *downstream*,
not here). It is **text-only** — sniffing files and distrusting misrepresented payload metadata is a
different organ, upstream; a supplied title or region rides only as an optional prior, never
authority.

## In one line

The Judge decides; the Label-Reducer only *sees* — clearly, cheaply, and the same way for everyone
— so that what you choose to do next is yours, and what it saw can be checked.

## See also
- civic-node `OPEN-QUESTIONS.md` §O ("the first-contact appliance") and §A ("the summonable judge").
- [`CONSTITUTION.md`](../CONSTITUTION.md) — § Mobile LLM, § Responses (the fewest-verbs rule).
- [`reducer/README.md`](../reducer/README.md) — the perceiver in code.
- [`composer/README.md`](../composer/README.md) — "route, don't moralize."
- [`docs/DELIVERY.md`](DELIVERY.md) — how this instrument reaches a device, cold and verified.
