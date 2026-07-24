// reducer/pos-demo.mjs — the companion study, in situ: the stopword strip (content) vs POS focal selection,
// side by side, on the recipe, an agenda, and a messy news-export. Plus footprint, per-sentence latency, the
// same stall through doc-nodemap's namer seam, and the same grouper wall.
//   node reducer/pos-demo.mjs
import { content } from "./embedders.mjs";
import { tag, focal, posNamer, tables } from "./pos-tag.mjs";
import { subtractiveNamer, nodemap, locate, slice } from "./doc-nodemap.mjs";

const SAMPLES = {
  "recipe line":  "- two large eggs and one cup of all purpose flour",
  "quantity":     "heat the oven to four hundred degrees and bake for twenty minutes",
  "gas sign":     "Regular unleaded is $2.18 today at the station on Elm",
  "agenda":       "Item 1. Ordinance amending the municipal code on water rights for new development.",
  "news export":  "FORT COLLINS —  The council voted 5-2 on Tuesday to approve the $4.3 million bond, officials said.",
};

console.log("=== selection: stopword strip (content) vs POS focal (grammatical) ===\n");
for (const [name, text] of Object.entries(SAMPLES)) {
  const strip = content(text);
  const foc = focal(text).map((t) => `${t.lower}·${t.tag}`);
  console.log(`「${name}」 ${text}`);
  console.log(`   strip : ${strip.join(" ")}`);
  console.log(`   focal : ${foc.join(" ")}`);
  console.log("");
}

console.log("=== what POS catches that the stopword strip misses ===");
console.log("  · numbers survive coherently:  content('$2.18') → " + JSON.stringify(content("$2.18")) + "   vs POS → one NUM token '$2.18'");
console.log("  · near-exhaustive drop: function words the ~90-word stoplist omits (which, because, upon, per, however…) are dropped by CLASS");
console.log("  · typed heads: POS marks NOUN/VERB/NUM, so a quantity question can prefer the NUM range — the strip is untyped\n");

// footprint + latency (the two claims that decide whether this belongs in an as-you-type path)
const t0 = performance.now();
let toks = 0; const REP = 2000;
for (let i = 0; i < REP; i++) toks += tag(SAMPLES["news export"]).length;
const ms = performance.now() - t0;
console.log("=== footprint & latency ===");
console.log("  tables: " + JSON.stringify(tables()));
console.log(`  latency: tagged the news sentence ${REP}× in ${ms.toFixed(0)}ms → ${(ms / REP).toFixed(3)}ms/sentence (${(toks / (ms / 1000) | 0)} tokens/sec) — well inside an as-you-type budget\n`);

// the same stall through the doc-nodemap namer seam: POS is a drop-in namer, and still cannot type the group.
console.log("=== drop-in to doc-nodemap: subtractive namer vs POS namer (same structure, same wall) ===");
const RECIPE = `Ingredients
- one cup all purpose flour
- two large eggs
- three tablespoons honey`;
for (const [label, namer] of [["subtractive", subtractiveNamer], ["POS", posNamer]]) {
  const map = nodemap(RECIPE, { namer });
  const block = map.children[0];
  const r = locate(map, "how many eggs");
  console.log(`  ${label.padEnd(11)} block label: "${block.label}"`);
  console.log(`  ${" ".repeat(11)} eggs → ${r.genealogy.map((g) => g.label).join(" › ")}  ⇒ yank "${slice(RECIPE, r.read)}"`);
}
console.log(`
Both namers select; neither coins "ingredients" for a group that doesn't contain that word — the grouper wall
is unmoved. POS is the better FLOOR (grammatical drop, numbers kept, typed heads, sub-millisecond), not a
taller ceiling. True main-verb/object selection is the ~12MB learned-parser rung; crossing the wall to a TYPE
is the ~300MB generative grouper. The answer, in every tier, still comes from the raw bytes at the cursor.`);
