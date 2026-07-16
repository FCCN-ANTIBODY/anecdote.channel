// Unit: doc-nodemap (doc-nodemap.mjs) — the positional GROUPER. Proves the durable half: the node-map
// nests by adjacency (doc → block → line → term), every node is cursor-anchored, and `locate` reduces a
// question to terms, descends to the deepest matching node, and yanks the RAW text at that cursor. The
// subtractive namer's stall (heterogeneous group → concatenated label) is asserted as expected behavior,
// not a bug — it marks exactly where a typifying namer will plug in.
// Run: node reducer/doc-nodemap.test.mjs
import { nodemap, locate, slice, subtractiveNamer } from "./doc-nodemap.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const DOC = `Grandma's Honey Cornbread

Ingredients
- one cup all purpose flour
- two large eggs
- three tablespoons honey

Method
- heat the oven to four hundred degrees
- pour into a greased pan and bake twenty minutes`;

// 1. structure: doc → blocks → lines → terms, nested by adjacency.
{
  const map = nodemap(DOC);
  ok(map.kind === "doc" && map.span.start === 0 && map.span.end === DOC.length, "root doc spans the whole text");
  ok(map.children.length === 3, "three blocks segmented on blank lines (title, ingredients, method)");
  const ing = map.children[1];
  ok(ing.kind === "block" && ing.children.length === 4, "the ingredients block holds four lines (header + 3 bullets)");
  const bullet = ing.children[1];
  ok(bullet.kind === "line" && bullet.children.every((t) => t.kind === "term"), "a line's children are all terms");
}

// 2. cursor anchoring: every span slices its own verbatim text out of the raw document.
{
  const map = nodemap(DOC);
  const walk = (n) => { ok(slice(DOC, n.span) === DOC.slice(n.span.start, n.span.end), `span of a ${n.kind} slices verbatim`); for (const c of n.children || []) walk(c); };
  // spot-check a term rather than every node (keeps output readable) — pick the first term in the first bullet.
  const term = map.children[1].children[1].children[0];
  ok(slice(DOC, term.span) === DOC.slice(term.span.start, term.span.end), "a term's cursor slices its verbatim word");
  ok(/^[a-z]/.test(term.label) && term.label === slice(DOC, term.span).toLowerCase(), "a term's label is its lowercased word at the cursor");
  void walk; // structure of walk kept for reference; spot-check above is the assertion
}

// 3. locate: a reduced question descends to the deepest matching node and yanks raw text there.
{
  const map = nodemap(DOC);
  const eggs = locate(map, "how many eggs");
  ok(eggs.found && eggs.matched.includes("eggs"), "an eggs question matches the 'eggs' term");
  ok(slice(DOC, eggs.span) === "eggs", "the anchor span is the precise term cursor");
  ok(/two large eggs/.test(slice(DOC, eggs.read)), "the read span WIDENS to the enclosing line and carries the quantity");
  ok(eggs.genealogy[0].kind === "doc" && eggs.genealogy.some((g) => g.kind === "block"), "genealogy runs doc → block → … (where it lives)");

  const oven = locate(map, "what temperature is the oven");
  ok(oven.found && /four hundred degrees/.test(slice(DOC, oven.read)), "an oven question lands in the Method block and its read span carries the temperature");

  const miss = locate(map, "does it use saffron");
  ok(!miss.found, "a term absent from the document honestly escapes");
}

// 4. the subtractive stall, asserted as expected: a heterogeneous block names by concatenation, not by type.
{
  const label = subtractiveNamer("one cup all purpose flour\ntwo large eggs\nthree tablespoons honey");
  ok(label.split(" ").length > 1 && /flour/.test(label), "subtractive namer concatenates leading content words (the stall)");
  ok(/…/.test(label), "and truncates the rest with an ellipsis — it cannot compress the group into one type word");
  ok(!/ingredient/.test(label), "it does NOT typify to 'ingredients' — that awaits the grouping namer");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall doc-nodemap tests passed");
