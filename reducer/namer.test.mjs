// Integration test for the generative fewest-verbs namer (v1). Like minilm.test.mjs it needs the
// package AND a vendored, verified namer model — both currently DEFERRED — so it SKIPS cleanly
// (exit 0) until one is committed. test.mjs stays dependency-free and always runs.
//
//   cd reducer && npm i
//   node reducer/weights.mjs record-namer   # once Xenova/flan-t5-small is under models/
//   node reducer/namer.test.mjs

import { cos } from "./reducer.mjs";
import { fewestVerbs, makeNamer, makeMiniLmEmbed } from "./embedders.mjs";
import { namerPresent, namerVersion, present } from "./weights.mjs";

try { await import("@huggingface/transformers"); }
catch { console.log("namer.test: @huggingface/transformers not installed — `npm i` in reducer/; skipping."); process.exit(0); }
if (!(await namerPresent())) {
  console.log("namer.test: namer model absent/unpinned (deferred) — `node reducer/weights.mjs record-namer`; skipping.");
  process.exit(0);
}

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const name = await makeNamer();

// 1. Produces a non-empty, short, lowercase fewest-verbs phrase.
{
  const n = await name("Is there shade at this park?");
  ok(typeof n === "string" && n.length > 0, "namer returns a non-empty string");
  ok(n === n.toLowerCase(), "name is lowercased");
  ok(n.split(/\s+/).length <= 6, "name is short (fewest-verbs, <= 6 tokens)");
}

// 2. Deterministic: greedy decode, same input -> same name twice.
{
  const a = await name("the library catalog codes here");
  const b = await name("the library catalog codes here");
  ok(a === b, "namer is deterministic for a fixed model (greedy decode)");
}

// 3. Naming HELPS: for a synonym pair, the generated names embed at least as close as the raw
//    utterances do — the point of v1 (better names -> better collision). Tolerant by a small
//    margin; if a model regresses this, it's worth knowing.
if (await present()) {
  const embed = await makeMiniLmEmbed();
  const A = "Dewey decimal numbers on this shelf", B = "the library catalog codes here";
  const raw = cos(await embed(A), await embed(B));
  const named = cos(await embed(await name(A)), await embed(await name(B)));
  console.log(`  (synonym cos: raw ${raw.toFixed(3)} -> named ${named.toFixed(3)})`);
  ok(named >= raw - 0.02, "generative names embed at least as close as raw text for a synonym pair");
} else {
  console.log("  (embedder weights absent — skipping the 'naming helps' comparison)");
}

console.log(fails ? `\n${fails} FAILED` : `\nnamer: all tests passed (${namerVersion()})`);
process.exit(fails ? 1 : 0);
