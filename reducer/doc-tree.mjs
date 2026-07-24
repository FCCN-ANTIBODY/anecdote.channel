// reducer/doc-tree.mjs — the LABEL-REDUCER AS A DOCUMENT READER (a study demo, not a shipped feature).
//
// The label-reducer's other half: not just MAKING labels, but READING with them. This builds, from a
// document, a TREE OF REDUCED TERMS anchored to CURSOR POSITIONS in the raw text — a map of where
// information lives, NOT an outline (the tree is keyword-clusters, not the document's own headings). Then it
// answers a label-reduced question by descending that tree until it lands on a cursor, and yanks the raw
// text there. The reduction is a QUERY STUB; the answer always comes from the raw bytes at the cursor.
//
// It is built on the existing reducer with no new model: `assign` groups blocks under labels (the leaves,
// each carrying its blocks' cursors); agglomerating those labels' name-embeddings builds the levels up — the
// same merge-only convergence `ratchet` does, but RETAINED as a tree instead of flattened. Descent is the
// inverse: nearest-child by cosine, level by level, until the question's labels run out (land) or nothing
// clears the bar (an early escape hatch — the critical label isn't in the document).
//
// The embedder is injected (toyEmbed for a deterministic, dependency-free study; MiniLM drops in for real
// synonymy). Pure — segment/build/query take text and return data to inspect.

import { Reducer, cos } from "./reducer.mjs";
import { toyEmbed, fewestVerbs } from "./embedders.mjs";

// ---- segment: raw text -> blocks with cursors ----------------------------------------------------------
// Blocks are the atomic units the tree anchors to. Split on blank lines (a paragraph/agenda-item is a
// block); each keeps its char range + line so the answer can be yanked verbatim from the source.
export function segment(text) {
  const blocks = [];
  const re = /\n[ \t]*\n/g;
  let start = 0, m, id = 0;
  const push = (s, e) => {
    const raw = text.slice(s, e);
    const t = raw.trim();
    if (!t) return;
    const lead = raw.length - raw.trimStart().length;
    const s2 = s + lead;
    blocks.push({ id: id++, start: s2, end: s2 + t.length, line: text.slice(0, s2).split("\n").length, text: t });
  };
  while ((m = re.exec(text))) { push(start, m.index); start = re.lastIndex; }
  push(start, text.length);
  return blocks;
}

// ---- build: blocks -> reduced-term tree with cursor anchors --------------------------------------------
// Levels: assign every block to a label (the leaves), then agglomerate the labels' name-vectors at a
// LOOSENING threshold, level by level, so each parent groups the children that read as the same term. Every
// node carries the union of the cursors beneath it — so any node points back into the raw document.
export async function buildTree(text, { embed = toyEmbed, name = fewestVerbs, assignT = 0.5, levelTs = [0.62, 0.5, 0.38] } = {}) {
  const blocks = segment(text);
  const r = new Reducer({ embed, name, assignT });
  const byText = new Map(blocks.map((b) => [b.text, b]));
  for (const b of blocks) await r.assign(b.text);

  // Leaves: one node per label, carrying the cursors of the blocks that landed on it.
  let level = await Promise.all(r.labels.map(async (l) => ({
    name: l.name, vec: l.vec,
    cursors: [...new Set(l.members)].map((t) => byText.get(t)).filter(Boolean).map((b) => ({ id: b.id, start: b.start, end: b.end, line: b.line })),
    children: null,
  })));

  // Agglomerate up: at each (loosening) threshold, union-find nodes whose names embed within it; a group of
  // >1 becomes a parent (the earliest name is canonical, its vec anchors the parent); singletons pass through.
  const levels = [level];
  for (const t of levelTs) {
    const parent = new Array(level.length).fill(-1);
    const find = (i) => { while (parent[i] >= 0) i = parent[i]; return i; };
    for (let i = 0; i < level.length; i++) for (let j = i + 1; j < level.length; j++) {
      if (find(i) !== find(j) && cos(level[i].vec, level[j].vec) >= t) parent[find(j)] = find(i);
    }
    const groups = new Map();
    for (let i = 0; i < level.length; i++) { const root = find(i); (groups.get(root) || groups.set(root, []).get(root)).push(level[i]); }
    const next = [];
    for (const g of groups.values()) {
      if (g.length === 1) { next.push(g[0]); continue; }
      next.push({ name: g[0].name, vec: g[0].vec, cursors: dedupeCursors(g.flatMap((n) => n.cursors)), children: g });
    }
    levels.push(next);
    if (next.length <= 1) break;
  }

  const top = levels[levels.length - 1];
  const root = top.length === 1 ? top[0]
    : { name: "·document·", vec: null, cursors: dedupeCursors(top.flatMap((n) => n.cursors)), children: top };
  return { root, blocks, levels, reducerVersion: r.reducerVersion, embed };
}

function dedupeCursors(cs) { const seen = new Set(); return cs.filter((c) => (seen.has(c.id) ? false : seen.add(c.id))); }

// ---- query: a label-reduced question -> a cursor + the raw text there ----------------------------------
// Descend from the root: at each node, pick the child whose term is nearest the question's embedding; descend
// while it clears `descendT`. When we can descend no further (a leaf, or no child clears the bar) we have
// LANDED — return the cursors there and the raw text yanked from the document. If even the root's best child
// misses `floorT`, that's the early escape: the document has no term for this question.
export async function query(tree, question, { descendT = 0.3, floorT = 0.2 } = {}) {
  const qv = await tree.embed(question);
  const path = [];
  let node = tree.root, missedAtRoot = false;
  while (node.children && node.children.length) {
    let best = null, bestS = -1;
    for (const c of node.children) { const s = c.vec ? cos(qv, c.vec) : -1; if (s > bestS) { bestS = s; best = c; } }
    if (node === tree.root && bestS < floorT) { missedAtRoot = true; break; }
    if (bestS < descendT) break;             // can't sharpen further — land here
    path.push({ name: best.name, score: Number(bestS.toFixed(3)) });
    node = best;
  }
  if (missedAtRoot) return { found: false, reason: "no term in this document matches — critical label missing", path, cursors: [] };
  const cursors = node.cursors.map((c) => ({ ...c, text: sliceDoc(tree, c) }));
  return { found: true, landedOn: node.name, path, cursors };
}

function sliceDoc(tree, c) {
  // Recover the raw text at a cursor from the block it names (blocks carry the verbatim slice).
  const b = tree.blocks.find((x) => x.id === c.id);
  return b ? b.text : "";
}

// ---- a small inspector for studying the tree -----------------------------------------------------------
export function printTree(node, depth = 0) {
  const pad = "  ".repeat(depth);
  const where = node.cursors?.length ? ` [blocks ${node.cursors.map((c) => c.id).join(",")}]` : "";
  console.log(`${pad}• ${node.name}${where}`);
  for (const c of node.children || []) printTree(c, depth + 1);
}
