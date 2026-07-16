// reducer/doc-nodemap-demo.mjs — study the POSITIONAL node-map + the visible subtractive STALL.
//   node reducer/doc-nodemap-demo.mjs
//
// Two documents, chosen to make one point. The RECIPE is the user's own metaphor: a bullet list of
// ingredients whose terms are so heterogeneous ("flour, sugar, eggs") that the subtractive reducer can
// never merge them — it names the group by concatenation ("flour sugar eggs …"), never by typifying it as
// "ingredients". That is the STALL, and this demo makes it visible. The AGENDA is the calmer case where
// blocks are already sentence-like, so the same subtractive namer reads acceptably.
//
// The STRUCTURE (blocks → lines → terms, every node cursor-anchored, each leaf's genealogy = where it
// lives) is correct in both. `locate` reduces a question to terms and yanks the raw text at the cursor —
// the answer comes from the bytes, never the labels. Where a typifying namer plugs in is marked below.

import { nodemap, locate, slice, printMap, subtractiveNamer } from "./doc-nodemap.mjs";

const RECIPE = `Grandma's Honey Cornbread

Ingredients
- one cup yellow cornmeal
- one cup all purpose flour
- three tablespoons honey
- two large eggs
- one cup buttermilk

Method
- heat the oven to four hundred degrees
- whisk the cornmeal flour and honey together
- beat in the eggs and buttermilk until smooth
- pour into a greased pan and bake twenty minutes`;

const AGENDA = `City Council Regular Meeting Agenda

Roll call. Mayor Arndt presiding. Councilmembers Peel, Ohlson, and Francis present.

Item 1. Ordinance amending the municipal code on water rights and raw water requirements for new development.

Item 2. Resolution adopting the parks and recreation budget, including trail maintenance and the splash pad.`;

const show = (title, text) => {
  const map = nodemap(text, { namer: subtractiveNamer });
  console.log(`\n============================================================`);
  console.log(`=== ${title}`);
  console.log(`============================================================`);
  printMap(map, text);
  return map;
};

const ask = (map, text, q) => {
  const r = locate(map, q);
  console.log(`\nQ: ${q}`);
  if (!r.found) { console.log(`   ↳ escape: ${r.reason}`); return; }
  const geneal = r.genealogy.map((g) => `${g.label}`).join(" › ");
  console.log(`   ↳ genealogy: ${geneal}`);
  console.log(`   ↳ matched terms: ${r.matched.join(", ")}`);
  console.log(`   ↳ anchor @ chars ${r.span.start}-${r.span.end}: "${slice(text, r.span)}"`);
  console.log(`   ↳ read @ chars ${r.read.start}-${r.read.end}: "${slice(text, r.read)}"`);
};

// --- the recipe: watch the group labels stall into concatenations ----------------------------------------
const recipe = show("RECIPE — the subtractive stall (bullet ingredients never union to 'ingredients')", RECIPE);
console.log(`\n--- reading the recipe by term, yanking raw text at the cursor ---`);
ask(recipe, RECIPE, "how many eggs");
ask(recipe, RECIPE, "what temperature is the oven");
ask(recipe, RECIPE, "how much honey");
ask(recipe, RECIPE, "does it use saffron");

console.log(`
NOTE THE STALL: the two block labels read as "ingredients cup yellow cornmeal …" and "method heat oven …"
— concatenations of their content words, because the subtractive namer cannot UNION heterogeneous terms
into a type. A typifying (generative) namer drops into the exact same \`namer\` seam and would instead label
those blocks "ingredients" and "method", making the genealogy read "eggs › ingredients › recipe". The
STRUCTURE and the cursor yanks are already correct; only the labels wait on the grouper.`);

// --- the agenda: the calmer case where subtractive names read acceptably ---------------------------------
const agenda = show("AGENDA — sentence-like blocks, where the subtractive namer already reads fine", AGENDA);
console.log(`\n--- reading the agenda by term ---`);
ask(agenda, AGENDA, "who is presiding");
ask(agenda, AGENDA, "what about water rights");
ask(agenda, AGENDA, "parks and recreation budget");
ask(agenda, AGENDA, "did a clown perform");
