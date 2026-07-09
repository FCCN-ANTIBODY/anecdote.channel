// reducer/pos-reduce.mjs — the Node/bundler BINDING of the POS reducer (docs/label-reducer.md; #79/#80).
//
// Bare-imports `compromise` (an optionalDependency) and applies the shared, parser-injected schedule
// (pos-schedule.mjs). Tests and embedders.mjs `makePosNamer()` use this binding; the browser paths import
// the same schedule with the vendored runtime/compromise.bundle.mjs instead — one set of rules, three
// homes. See pos-schedule.mjs for the schedule itself and the "same everywhere" note.

import nlp from "compromise";
import { reduceWithNlp, DROP_TAGS, LIGHT_VERBS } from "./pos-schedule.mjs";

export { DROP_TAGS, LIGHT_VERBS, reduceWithNlp };

// Pure, synchronous: an utterance -> its fewest-verbs caveman kernel. Deterministic for a fixed compromise.
export function posReduce(text) {
  return reduceWithNlp(nlp, text);
}
