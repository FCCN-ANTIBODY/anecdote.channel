// reducer/pos-schedule.mjs — the POS reduction SCHEDULE, parser-INJECTED and browser-safe.
//
// The rules that turn a parsed utterance into its fewest-verbs kernel, given a compromise-style `nlp`
// factory passed IN. Kept separate from the compromise import so one source runs in three places:
//   - Node tests + makePosNamer, via the bare "compromise" package (pos-reduce.mjs);
//   - the browser model-worker and the Elevated composer page, via the vendored, servable
//     runtime/compromise.bundle.mjs (a module Worker can't resolve a bare specifier).
//
// A NOTE ON "THE SAME EVERYWHERE" (the operator's language worry): this schedule — the light-verb list,
// the drop-tags — is the ENGLISH-first stage behind the reducer's `name` seam. It is deliberately not the
// reducer's identity. The seam takes ANY (text) => label, so a different language's stage (or a smarter
// universal one, if it ever fits on-device) swaps in HERE without a second reducer. The "acts the same
// everywhere" promise lives in the SEAM and the deterministic contract, never in this word list. Holding
// that distinction is what keeps a hardcoded list from becoming a fork.

import { fewestVerbs } from "./embedders.mjs";

// Tags whose presence removes a term outright — the scaffolding and the modifiers (schedule steps 1–2).
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

// Pure: an utterance -> its fewest-verbs caveman kernel, using the injected compromise `nlp`. Deterministic
// for a fixed compromise version. The small embedder never sees the raw text — only these kernels, so
// paraphrases collapse downstream (reducer.mjs). Falls back to the v0 heuristic when the parse yields
// nothing, so reduction degrades but never breaks.
export function reduceWithNlp(nlp, text) {
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
