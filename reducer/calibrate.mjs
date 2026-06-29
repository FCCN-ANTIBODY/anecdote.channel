// Threshold calibration for the real instrument.
//   node reducer/calibrate.mjs
//
// The toy embedder's thresholds (assignT=0.5, mergeT=0.62) are tuned for bag-of-words cosine.
// all-MiniLM is 384-dim and its cosine distribution is different — unrelated sentences rarely
// sit near zero, paraphrases sit high — so the reducer needs its OWN numbers. This harness
// embeds labeled SAME/DIFFERENT pairs and recommends assignT/mergeT that separate them.
//
// It compares the FEWEST-VERBS NAMES, not the raw utterances, because assign()/ratchet() embed
// a label's name — calibration must mirror what the reducer actually compares.
//
// Skips cleanly (exit 0) when the package or the vendored weights are absent, so it is safe to
// run in any checkout; it only does real work once `node reducer/weights.mjs fetch` has run.

import { cos } from "./reducer.mjs";
import { fewestVerbs, makeMiniLmEmbed } from "./embedders.mjs";
import { present, canonicalVersion, setThresholds } from "./weights.mjs";

try { await import("@huggingface/transformers"); }
catch { console.log("calibrate: @huggingface/transformers not installed — `npm i` in reducer/; skipping."); process.exit(0); }
if (!(await present())) {
  console.log("calibrate: vendored MiniLM weights absent/unverified — `node reducer/weights.mjs fetch`; skipping.");
  process.exit(0);
}

// SAME = should collide (same intent). Heavy on the synonymy the toy CANNOT see.
const SAME = [
  ["the library catalog codes here", "Dewey decimal numbers on this shelf"],
  ["Is there shade at this park?", "park shade?"],
  ["trash pickup is late", "garbage collection is delayed"],
  ["cars speed down Mulberry", "drivers go too fast on Mulberry"],
  ["we need more bus routes", "expand public transit"],
  ["potholes on Elm street", "road damage on Elm"],
  ["the crosswalk feels unsafe", "dangerous pedestrian crossing"],
];
// DIFFERENT = must stay distinct, including a hard near-miss (shared words, different intent).
const DIFFERENT = [
  ["shade at the park", "Dewey decimal numbers on this shelf"],
  ["trash pickup is late", "we need more bus routes"],
  ["park shade", "cars speed down Mulberry"],
  ["library hours", "library catalog codes"],          // hard near-miss
  ["potholes on Elm street", "is there shade at this park"],
];

const embed = await makeMiniLmEmbed();
const score = async ([a, b]) => cos(await embed(fewestVerbs(a)), await embed(fewestVerbs(b)));
const same = await Promise.all(SAME.map(score));
const diff = await Promise.all(DIFFERENT.map(score));

const stat = (xs) => ({ min: Math.min(...xs), mean: xs.reduce((s, x) => s + x, 0) / xs.length, max: Math.max(...xs) });
const r3 = (x) => Math.round(x * 1000) / 1000;
const S = stat(same), D = stat(diff);

console.log(`model: ${canonicalVersion()}  (dim ${(await embed("x")).length})\n`);
const dump = (label, pairs, xs) => {
  console.log(label);
  pairs.forEach(([a, b], i) => console.log(`  ${xs[i].toFixed(3)}  "${fewestVerbs(a)}"  ~  "${fewestVerbs(b)}"`));
};
dump("SAME (want high):", SAME, same);
console.log(`  → min ${r3(S.min)}  mean ${r3(S.mean)}  max ${r3(S.max)}\n`);
dump("DIFFERENT (want low):", DIFFERENT, diff);
console.log(`  → min ${r3(D.min)}  mean ${r3(D.mean)}  max ${r3(D.max)}\n`);

const margin = S.min - D.max;
let assignT, mergeT, note;
if (margin > 0.02) {
  // Clean separation: place both thresholds in the gap, mergeT stricter (folds only clear synonyms).
  assignT = r3(D.max + margin * 0.34);
  mergeT = r3(D.max + margin * 0.67);
  note = `clean separation (margin ${r3(margin)}): both thresholds sit between the classes.`;
} else {
  // Overlap: keep DIFFERENT-precision = 1 by sitting just above the worst false-friend, and
  // accept that the lowest-similarity true synonyms may not auto-collide (report the cost).
  assignT = r3(D.max + 0.01);
  mergeT = r3(D.max + 0.03);
  const missed = same.filter((x) => x < assignT).length;
  note = `OVERLAP (margin ${r3(margin)}): thresholds favor precision; ${missed}/${same.length} SAME pairs ` +
         `would NOT auto-collide — widen the dictionary or revisit fewest-verbs naming.`;
}

console.log("recommendation:");
console.log(`  ${note}`);
await setThresholds(assignT, mergeT);
console.log(`  wrote assignT=${assignT}, mergeT=${mergeT} into model.lock.json`);
console.log(`  (minilm.test.mjs and the MiniLM Reducer read these from the lock)`);
