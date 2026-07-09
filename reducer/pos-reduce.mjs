// reducer/pos-reduce.mjs — POS-GUIDED fewest-verbs reduction (docs/label-reducer.md; civic-node #79/#80).
//
// The `name` seam's real upgrade from the v0 stopword-strip (embedders.mjs `fewestVerbs`). It does the
// REDUCTION the Label-Reducer promises but never proved: turn an utterance into its caveman kernel —
// fewest verbs, smallest noun phrases — DETERMINISTICALLY, so the same input always yields the same
// label (the CONSTITUTION's "auditable perceiver"). It is NOT a generative rewrite (that is a translation
// task harder than what LLMs solved, and not reproducible across quantizations); it is a fixed schedule
// over a parts-of-speech parse, and the small model never reads the document — MiniLM only embeds these
// kernels afterward so paraphrases COLLAPSE (embedders.mjs + reducer.mjs ratchet).
//
// The schedule, applied to a POS-tagged parse (compromise — pure-JS, offline, browser-safe):
//   1. drop SCAFFOLDING  — determiners, pronouns, prepositions, conjunctions, the interrogative frame
//      (question words + leading auxiliaries), discourse markers/expressions;
//   2. drop MODIFIERS    — adverbs and intensifiers;
//   3. drop LIGHT VERBS  — auxiliaries, modals, and delexical verbs (be/do/have/will/should/get/say…),
//      so what remains approaches the fewest-verbs form;
//   4. keep the SKELETON — content nouns (singularized), content verbs (lemmatized to the infinitive),
//      adjectives and values doing categorical work;
//   5. de-duplicate, preserve order. The result is a short, lowercased kernel.
//
// It never MORALIZES and never blocks — it only says what a thing is (perceive → evaluate → act). Slang
// is tagged imperfectly, and that is fine: the structure survives mis-tags, and the embed+ratchet step
// mops up the residue (a rant of threats collapses to one node downstream, not here). Falls back to the
// heuristic whenever the parse yields nothing, so reduction never breaks.
//
// Node + browser (compromise is dependency-free). Pure and synchronous, so tests drive posReduce directly.

import nlp from "compromise";
import { fewestVerbs } from "./embedders.mjs";

// Tags whose presence removes a term outright — the scaffolding and the modifiers (steps 1–2).
export const DROP_TAGS = [
  "Determiner", "Pronoun", "Preposition", "Conjunction", "QuestionWord",
  "Expression", "Adverb", "Auxiliary", "Modal", "Negative", "Possessive",
];

// Delexical / auxiliary verbs dropped even when tagged Verb (step 3). want/need are deliberately KEPT —
// they carry categorical weight on the needs side (civic-node #98) — this set is a calibration knob.
export const LIGHT_VERBS = new Set(
  ("be is am are was were been being do does did have has had will would shall should can could may " +
   "might must ought oughta gonna gotta get got gets make makes made go goes went come comes came " +
   "say says said let lets seem seems seemed become becomes became").split(" ")
);

const CLEAN = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\- ]/g, " ").replace(/\s+/g, " ").trim();

// Pure: an utterance -> its fewest-verbs caveman kernel. Deterministic for a fixed compromise version.
export function posReduce(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  let doc;
  try {
    doc = nlp(raw);
    doc.contractions().expand();       // "don't" -> "do not", so the aux/negation drop can see them
    doc.verbs().toInfinitive();        // lemmatize: "banned"/"banning" -> "ban"
    doc.nouns().toSingular();          // "fireworks" -> "firework"
  } catch {
    return fewestVerbs(raw);           // a parser hiccup never breaks reduction
  }

  const out = [];
  const seen = new Set();
  for (const group of doc.terms().json()) {
    const term = (group.terms && group.terms[0]) || {};
    const tags = term.tags || [];
    if (DROP_TAGS.some((t) => tags.includes(t))) continue;            // steps 1–2
    const word = CLEAN(term.normal || group.normal || group.text);
    if (!word) continue;
    const isVerb = tags.includes("Verb");
    const isContent = isVerb || tags.includes("Noun") || tags.includes("Adjective") || tags.includes("Value");
    if (!isContent) continue;                                          // keep only the skeleton (step 4)
    for (const w of word.split(" ")) {                                 // a chunk may carry >1 word
      if (!w || seen.has(w)) continue;
      if (LIGHT_VERBS.has(w)) continue;                                // step 3 (also catches chunk-internal aux)
      seen.add(w); out.push(w);                                        // step 5: dedupe, keep order
    }
  }
  const kernel = out.join(" ");
  return kernel || fewestVerbs(raw);   // if everything dropped, fall back rather than mint nothing
}
