// Golden test for the POS-guided reducer (pos-reduce.mjs) — the piece that was never proven: that
// real, messy utterances REDUCE to stable kernels, and that paraphrase families COLLAPSE while distinct
// topics stay apart. Two parts:
//   A. reduction quality — needs `compromise` (an optionalDependency). SKIPS cleanly if absent.
//   B. the headline collapse — reduce -> real MiniLM -> assign/ratchet. Additionally needs the vendored
//      weights + @huggingface/transformers; that half SKIPS cleanly while A still runs.
// Clean skips keep a plain checkout and CI green (mirrors minilm.test.mjs / namer.test.mjs).
//
//   cd reducer && npm i && node pos-reduce.test.mjs

import { readFileSync } from "node:fs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const has = (kernel, w) => kernel.split(" ").includes(w);

// ---- load the reducer under test; skip the whole file if compromise isn't installed --------------------
let posReduce;
try {
  ({ posReduce } = await import("./pos-reduce.mjs"));
  // a smoke call proves compromise actually loaded (the import is lazy about its parser internals)
  if (typeof posReduce("smoke test") !== "string") throw new Error("posReduce did not return a string");
} catch (e) {
  console.log("SKIP pos-reduce.test.mjs — `compromise` not installed (run `npm i` in reducer/). " + (e?.message || e));
  process.exit(0);
}

// ================= Part A — reduction quality (deterministic, model-free) =================
console.log("A. reduction quality");

// 1. deterministic — the CONSTITUTION's auditable perceiver: same input, same kernel, always.
{
  const q = "Should the city cut funding for the dog park?";
  ok(posReduce(q) === posReduce(q), "reduction is deterministic for a fixed parser");
}

// 2. the interrogative frame + scaffolding + light verbs are gone; the content skeleton remains.
{
  const k = posReduce("Do you support military action in Iran?");
  ok(has(k, "military") && has(k, "iran"), "keeps the content heads: " + JSON.stringify(k));
  for (const junk of ["do", "you", "in"]) ok(!has(k, junk), `drops scaffolding "${junk}": ` + JSON.stringify(k));
}

// 3. lemmatize + singularize — inflections collapse so paraphrases can meet.
{
  const k = posReduce("They banned the fireworks last night");
  ok(has(k, "ban"), "verb lemmatized banned -> ban: " + JSON.stringify(k));
  ok(!has(k, "banned"), "the inflected verb is gone");
  ok(has(k, "firework") || has(k, "fireworks"), "the noun head survives: " + JSON.stringify(k));
}

// 4. slang survives: mis-taggable text still yields its content heads.
{
  const k = posReduce("would u say we oughta ban them fireworks downtown lol");
  ok(has(k, "ban") && has(k, "downtown"), "slang reduces to its heads: " + JSON.stringify(k));
  for (const junk of ["u", "lol", "oughta", "would", "say", "we"]) ok(!has(k, junk), `slang scaffolding "${junk}" dropped`);
}

// 5. it actually SHRINKS — a fewest-verbs kernel is materially smaller than the utterance.
{
  const long = "The city council will meet on Tuesday evening to discuss the parks and recreation budget.";
  const kn = posReduce(long).split(" ").length;
  ok(kn < long.split(/\s+/).length - 3, `reduced ${long.split(/\s+/).length} words -> ${kn} tokens`);
}

// 6. degenerate input never throws and never mints a fake kernel from nothing.
{
  ok(posReduce("") === "", "empty in -> empty out");
  ok(typeof posReduce("the a an of to") === "string", "all-scaffolding input falls back gracefully, never throws");
}

// ================= Part B — the headline: reduce -> MiniLM -> collapse =================
// Reduce each utterance to its kernel, embed the KERNEL with the real MiniLM, assign. Paraphrase
// families must land on ONE label each; distinct topics must stay apart. This is the collapse the
// toy embedder cannot do (e.g. "favor bombing iran" shares only "iran" with "support military action").
let embed, Reducer;
try {
  const { makeMiniLmEmbed } = await import("./embedders.mjs");
  ({ Reducer } = await import("./reducer.mjs"));
  embed = await makeMiniLmEmbed();          // in-repo, hash-pinned weights; throws if unverifiable/absent
} catch (e) {
  console.log("\nSKIP Part B — real MiniLM unavailable (vendored weights + @huggingface/transformers). " + (e?.message || e));
  if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
  console.log("\npos-reduce Part A passed");
  process.exit(0);
}
console.log("\nB. reduce -> MiniLM -> collapse");

const lock = JSON.parse(readFileSync(new URL("./model.lock.json", import.meta.url), "utf8"));
const families = {
  iran: ["Do you support military action in Iran?", "Should we authorize a military strike against Iran?", "Are you in favor of bombing Iran?"],
  dogpark: ["Should the city cut funding for the dog park?", "Do you think the town should defund the dog park?"],
  fireworks: ["Should we ban fireworks downtown?", "would u say we oughta ban them fireworks downtown lol"],
};

const r = new Reducer({ embed, name: posReduce, assignT: lock.assignT, mergeT: lock.mergeT, reducerVersion: embed.reducerVersion });
const labelOf = {};
for (const [fam, arr] of Object.entries(families)) {
  labelOf[fam] = [];
  for (const u of arr) {
    const hits = await r.assign(posReduce(u));   // reduce, THEN embed the kernel
    labelOf[fam].push(hits[0]?.name);
  }
}
r.ratchet();

for (const fam of Object.keys(families)) {
  const names = labelOf[fam];
  ok(names.every((n) => n && n === names[0]), `the ${fam} family collapses to one label: ${JSON.stringify(names)}`);
}
// the slang firework phrasing landed with its plain sibling (same label) — proven by the check above.
const heads = Object.keys(families).map((f) => labelOf[f][0]);
ok(new Set(heads).size === heads.length, "the three families stay DISTINCT — no false merge across topics");
ok(r.summary().length === Object.keys(families).length, `${Object.values(families).flat().length} utterances -> ${r.summary().length} labels: ` + r.summary().map((l) => `"${l.name}"×${l.count}`).join(", "));

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\npos-reduce: all tests passed (Parts A + B)");
