// reducer/grouping-demo.mjs — the late grouping pass, both ways, over the recipe.
//   node reducer/grouping-demo.mjs
// Shows the on-stall path: the same node-map, read once with the subtractive labels (the stall), then again
// after a grouping pass with a typifying namer present (labels upgrade to types; cursors unchanged), and the
// degrade (no namer held → subtractive labels stand). The stub typifier stands in for a model in a bottle;
// in the real path resolveGroupingNamer probes the hub and returns null when no bottle answers.
import { nodemap, locate, slice } from "./doc-nodemap.mjs";
import { regroup } from "./grouping.mjs";

const RECIPE = `Grandma's Honey Cornbread

Ingredients
- one cup yellow cornmeal
- one cup all purpose flour
- three tablespoons honey
- two large eggs

Method
- heat the oven to four hundred degrees
- whisk the cornmeal flour and honey together
- pour into a greased pan and bake twenty minutes`;

const typify = async (text) => {
  const t = text.toLowerCase();
  if (/grandma/.test(t) && /cornbread/.test(t)) return "recipe";
  if (/ingredient/.test(t)) return "ingredients";
  if (/method/.test(t)) return "method";
  return null;
};

const genealogy = (map, q) => {
  const r = locate(map, q);
  if (!r.found) return `escape: ${r.reason}`;
  return `${r.genealogy.map((g) => g.label).join(" › ")}   ⇒ yank "${slice(RECIPE, r.read)}"`;
};

const Q = "how many eggs";

console.log("=== 1. subtractive (Tier 0 — no grouper) ===");
const subtractive = nodemap(RECIPE);
console.log("  block labels: " + subtractive.children.map((b) => `"${b.label}"`).join("  "));
console.log("  " + Q + "  →  " + genealogy(subtractive, Q));

console.log("\n=== 2. grouper PRESENT (late grouping pass) ===");
const grouped = nodemap(RECIPE);
await regroup(grouped, RECIPE, { namer: typify });
console.log("  block labels: " + grouped.children.map((b) => `"${b.label}"`).join("  "));
console.log("  " + Q + "  →  " + genealogy(grouped, Q));

console.log("\n=== 3. grouper ABSENT (the degrade) ===");
const degraded = nodemap(RECIPE);
await regroup(degraded, RECIPE, { namer: null }); // resolveGroupingNamer would return null here
console.log("  block labels: " + degraded.children.map((b) => `"${b.label}"`).join("  "));
console.log("  " + Q + "  →  " + genealogy(degraded, Q));

console.log(`
The structure and the cursor yank are identical in all three — only the LABELS move. With the grouper the
genealogy types ("recipe › ingredients › … › eggs"); without it the subtractive concatenations stand and the
document is still fully readable by cursor. The stall is the trigger; absence is a value, not a failure.`);
