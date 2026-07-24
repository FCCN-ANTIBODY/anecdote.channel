// Unit: doc-tree (doc-tree.mjs) — the label-reducer as a document reader. Proves the core loop with the
// deterministic toy embedder: segment -> assign -> tree with cursor anchors, and a reduced question descends
// to the right block and yanks the raw text there. (A study baseline; the tree HIERARCHY is thin under the
// toy embedder by design — MiniLM is the drop-in — so this asserts retrieval + anchoring, not depth.)
// Run: node reducer/doc-tree.test.mjs
import { segment, buildTree, query } from "./doc-tree.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const DOC = `Council Meeting Agenda

Roll call. Mayor presiding. Councilmembers present. Clerk records the quorum.

Item 1. Ordinance on water rights and raw water requirements for new development.

Item 2. Resolution adopting the parks and recreation budget and trail maintenance.`;

// 1. segment yields blocks with verbatim cursor slices.
{
  const b = segment(DOC);
  ok(b.length === 4, "four blocks segmented on blank lines");
  ok(DOC.slice(b[2].start, b[2].end) === b[2].text && /water rights/.test(b[2].text), "a block's cursor slices its verbatim text");
}

// 2. build a tree with cursor anchors and query it.
{
  const tree = await buildTree(DOC);
  ok(tree.root && Array.isArray(tree.levels) && tree.blocks.length === 4, "buildTree returns a rooted tree over the blocks");

  const w = await query(tree, "water rights raw water ordinance");
  ok(w.found && /water rights/.test(w.cursors[0].text), "a water question lands on the water-rights block and yanks its raw text");

  const p = await query(tree, "parks recreation budget trail");
  ok(p.found && /parks and recreation/.test(p.cursors[0].text), "a parks question lands on the parks-budget block");

  const r = await query(tree, "presiding mayor roll call quorum");
  ok(r.found && /Roll call/.test(r.cursors[0].text), "a roll-call question lands on the roll-call block");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall doc-tree tests passed");
