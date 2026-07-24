// reducer/doc-tree-demo.mjs — study the label-reducer as a document reader over a dummy agenda.
//   node reducer/doc-tree-demo.mjs
// Uses the dependency-free toy embedder (word-overlap cosine): it proves the INDEX + DESCENT logic and
// clusters by shared vocabulary; it cannot see synonymy (MiniLM's job). Watch which questions land on the
// right block by cursor, and which honestly escape.
import { buildTree, query, printTree } from "./doc-tree.mjs";

// A dummy document shaped like a Fort Collins-style council agenda: linear blocks, plain vocabulary, the kind
// of "massacred plain-text export" the real target looks like. Blank lines separate blocks (agenda items).
const DOC = `City Council Regular Meeting Agenda

The regular meeting of the City Council convenes on Tuesday, March 4, at 6:00 PM in Council Chambers, 300 Laporte Avenue.

Roll call. Mayor Arndt presiding. Councilmembers Peel, Ohlson, and Francis present. Clerk records the quorum.

Item 1. Ordinance amending the municipal code on water rights and raw water requirements for new development. Staff presentation by the Water Utilities director, followed by council discussion of the raw water dedication formula.

Item 2. Resolution adopting the parks and recreation budget for the coming fiscal year, including trail maintenance and the community park splash pad.

Item 3. Public comment. Residents may address the council on any matter not on the agenda. Three minutes per speaker.

Adjournment. The meeting adjourned at 8:42 PM. The next regular meeting is scheduled for Tuesday, March 18.`;

const tree = await buildTree(DOC);

console.log("=== the reduced-term tree (a MAP, not an outline) ===");
printTree(tree.root);
console.log(`\nlevels: ${tree.levels.map((l) => l.length).join(" -> ")} nodes   (blocks: ${tree.blocks.length})`);

const ask = async (q) => {
  const r = await query(tree, q);
  console.log(`\nQ: ${q}`);
  if (!r.found) { console.log(`   ↳ escape: ${r.reason}  (path: ${r.path.map((p) => p.name).join(" › ") || "—"})`); return; }
  console.log(`   ↳ path: ${r.path.map((p) => `${p.name}(${p.score})`).join(" › ") || "(root)"}`);
  console.log(`   ↳ landed on "${r.landedOn}" @ block ${r.cursors.map((c) => `#${c.id} line ${c.line}`).join(", ")}`);
  for (const c of r.cursors) console.log(`     » chars ${c.start}-${c.end}: ${c.text.slice(0, 90)}${c.text.length > 90 ? "…" : ""}`);
};

console.log("\n=== label-matched queries (question reduced, descended, yanked from raw text) ===");
await ask("water rights raw water ordinance");
await ask("parks recreation budget trail");
await ask("when is the next regular meeting scheduled");
await ask("who is presiding mayor roll call quorum");
await ask("did a clown sing at the meeting");

console.log("\n(toy embedder: matches on shared words, no synonymy — the miss on synonyms is honest; MiniLM is the drop-in.)");
