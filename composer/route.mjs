// Composer routing — the experience core (CONSTITUTION §"Mobile LLM" / §"Responses").
//
// anecdote.channel is INGRESS: it does not carry a user-side constitution to moderate you.
// Its only opinion is the reducer's — label-reduce your words to the kernel of intent — and
// then it asks the one question that matters: where can this go? There are no stupid questions,
// so anecdote posits there are no stupid statements; a statement is never blocked, it is only
// ROUTED. Some statements simply aren't OFFERED into some destinations.
//
// A subject is NOT a destination. The reduced label is an emergent, unowned subject that rides
// ALONG to a destination, where collision happens. The "to" field routes over DESTINATIONS that
// someone owns and operates:
//
//   - a TELL you address directly (you hold its QR/token/URL). Discoverability is irrelevant;
//     a Tell may not list itself anywhere. This is the private side.
//   - an ATLAS representing your state/jurisdiction (the public, discoverable, bird's-eye side).
//
// What makes the list fluent is the LOCAL CACHE: your "installed" anecdote already knows your
// registered Atlases, their neighbor suggestions, your private Tells, each destination's
// constitution shorthand (the topics it excludes), and the topics you have chosen to self-mute
// per destination. All of that is domain-scoped, on your device. This module is pure: it turns
// (text, cache) into a routing plan. No network, no event loop — that is the view's job, and
// only on a confirmed action.

import { content, fewestVerbs } from "../reducer/embedders.mjs";

// Reduce an utterance to its intent: the fewest-verbs label plus its content tokens. The label
// is what would ride along as the subject; the tokens are what destinations filter on.
export function intentOf(text, name = fewestVerbs) {
  const label = name(text || "");
  return { label, tokens: content(label) };
}

// Why a destination is or isn't offered for THIS intent. A destination excludes a set of topic
// tokens by its own constitution; you may additionally mute topics there yourself. Either kind
// of overlap with the intent's tokens closes the door — and we say which, and which word.
//   constitution exclude -> { eligible:false, reason, by:"constitution" }
//   your own mute        -> { eligible:false, reason, by:"you" }
// Self-mutes are checked first so "you muted this" wins the explanation when both apply: the
// thing you can change is the thing worth surfacing.
export function verdict(intent, dest, muted = []) {
  const has = (topic) => intent.tokens.includes(topic);
  const mutedHit = muted.find(has);
  if (mutedHit) {
    return { eligible: false, by: "you", topic: mutedHit, reason: `you muted “${mutedHit}” here` };
  }
  const exclHit = (dest.excludes || []).find(has);
  if (exclHit) {
    const where = dest.kind === "atlas" ? "this Atlas’s constitution excludes" : "this Tell declines";
    return { eligible: false, by: "constitution", topic: exclHit, reason: `${where} “${exclHit}”` };
  }
  return { eligible: true, by: null, topic: null, reason: dest.kind === "atlas" ? "public · routable" : "you address this" };
}

// Build the full routing plan for an utterance against the local cache. Destinations are grouped
// by kind (Tells you address directly first — the private, intentional side — then public
// Atlases), and each is stamped with its verdict. Eligible-first within each group so the open
// doors lead. Nothing is dropped: ineligible destinations stay in the plan, dimmed, with a
// reason — the view shows the door and why it's shut.
export function plan(text, cache = {}) {
  const intent = intentOf(text, cache.name);
  const mutes = cache.muted || {};
  const stamp = (dest) => ({ ...dest, verdict: verdict(intent, dest, mutes[dest.id] || []) });
  const sort = (list) => list
    .map(stamp)
    .sort((a, b) => (a.verdict.eligible === b.verdict.eligible ? 0 : a.verdict.eligible ? -1 : 1));
  const tells = sort(cache.tells || []);
  const atlases = sort(cache.atlases || []);
  return {
    intent,
    groups: [
      { kind: "tell", title: "Tells — you address these directly", dests: tells },
      { kind: "atlas", title: "Atlases — public, by jurisdiction", dests: atlases },
    ],
    routableCount: [...tells, ...atlases].filter((d) => d.verdict.eligible).length,
  };
}

// A prepared anecdote — what a CONFIRMED send would hand off. The reducer's label rides along as
// the subject; collision into the destination's dictionary happens THERE, not here. This builds
// the object only; it never transmits. (CONSTITUTION: confirmations are never mandatory in the
// UX, and nothing uses an event loop for anything but a user-confirmed action.)
export function prepare(text, dest, cache = {}) {
  const intent = intentOf(text, cache.name);
  const v = verdict(intent, dest, (cache.muted || {})[dest.id] || []);
  if (!v.eligible) throw new Error(`not routable to ${dest.id}: ${v.reason}`);
  return { to: { id: dest.id, kind: dest.kind, url: dest.url }, label: intent.label, text };
}
