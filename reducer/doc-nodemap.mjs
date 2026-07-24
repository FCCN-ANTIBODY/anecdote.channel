// reducer/doc-nodemap.mjs — the positional GROUPER: a generic nested node-map of a document (study demo).
//
// The study's finding: the reducer is SUBTRACTIVE (strip to fewest words), not ASSOCIATIVE (union many into a
// typifying label). Heterogeneous neighbors — a recipe's "flour, sugar, eggs" — never merge, so both block-
// and term-level reduction stall early. The missing move is a LABEL GROUPER: a many-to-one that TYPIFIES a
// side-by-side set (two neighbors is its base case). That is a different operation, and probably a generative
// namer's job — not the subtractive one.
//
// This module builds the half we CAN solve cleanly and durably: the STRUCTURE. Group by discoverable POSITION
// (blocks → lines → terms — robust to mangled formatting, since it groups by adjacency, not by parsing tags),
// anchor every node to a cursor SPAN, and expose each leaf's GENEALOGY (the path of ancestor labels) as the
// "where does this live" signal. The NAMER is an injected seam: run it with `subtractiveNamer` (the reducer's
// current behavior) and the group labels come out as CONCATENATIONS — the stall, made visible — and a
// typifying/generative namer drops into the exact same slot to fix only the labels, never the structure.

import { content } from "./embedders.mjs";

// The subtractive namer (v0): what the reducer does today — the content words of the combined text, capped.
// It cannot union meanings, so a heterogeneous group names as "flour sugar eggs", never "ingredients". This
// is the visible stall; a typifying namer replaces exactly this function.
export function subtractiveNamer(text, cap = 6) {
  const toks = [...new Set(content(text))];
  return toks.slice(0, cap).join(" ") + (toks.length > cap ? " …" : "");
}

// ---- build the positional node-map ---------------------------------------------------------------------
// doc → blocks (blank-line runs) → lines (newline) → terms (content words). Every node carries a cursor
// SPAN {start,end} into the raw text and a label from the namer over its own text. Pure; deterministic.
export function nodemap(text, { namer = subtractiveNamer } = {}) {
  const termsIn = (s, e) => {                                   // content words in [s,e), each with a cursor
    const seg = text.slice(s, e), out = [], re = /[A-Za-z][A-Za-z'-]+/g; let m;
    while ((m = re.exec(seg))) {
      const w = m[0];
      if (content(w).length) out.push({ kind: "term", label: w.toLowerCase(), span: { start: s + m.index, end: s + m.index + w.length } });
    }
    return out;
  };
  const lineNodes = (s, e) => {                                 // split a block into non-blank lines
    const out = []; let ls = s;
    for (const piece of text.slice(s, e).split("\n")) {
      const le = ls + piece.length;
      if (piece.trim()) {
        const a = ls + (piece.length - piece.trimStart().length), b = a + piece.trim().length;
        out.push({ kind: "line", label: namer(text.slice(a, b)), span: { start: a, end: b }, children: termsIn(a, b) });
      }
      ls = le + 1;                                              // +1 for the consumed "\n"
    }
    return out;
  };
  // blocks: runs separated by a blank line.
  const blocks = []; const re = /\n[ \t]*\n/g; let start = 0, m;
  const pushBlock = (s, e) => {
    const raw = text.slice(s, e); if (!raw.trim()) return;
    const a = s + (raw.length - raw.trimStart().length), b = a + raw.trim().length;
    blocks.push({ kind: "block", label: namer(text.slice(a, b)), span: { start: a, end: b }, children: lineNodes(a, b) });
  };
  while ((m = re.exec(text))) { pushBlock(start, m.index); start = re.lastIndex; }
  pushBlock(start, text.length);

  return { kind: "doc", label: namer(text.slice(0, Math.min(text.length, 400))), span: { start: 0, end: text.length }, children: blocks };
}

// ---- locate: a reduced question -> a cursor + its GENEALOGY + the raw text to read ----------------------
// Reduce the question to content terms; walk the node-map for the deepest node whose own term(s) match the
// most question terms. The matched node is the ANCHOR (`span`) — precise, possibly a bare term. But a bare
// term ("eggs") is a poor thing to READ, so the yank WIDENS to the enclosing line ("two large eggs"): the
// `read` span is the nearest line/block ancestor that actually carries the quantity. The genealogy is the
// ancestor labels that say WHERE it lives. (Retrieval is term-overlap here; a typifying namer would make the
// genealogy read "eggs › ingredients › recipe". Structure and the widened yank are right either way.
// A single term that appears in several places is disambiguated only positionally for now — the honest
// limit: real disambiguation is the embedder/NLI's job, not the structure's.)
export function locate(map, question) {
  const q = new Set(content(question));
  let best = null, bestScore = 0, bestPath = [];
  const walk = (node, path) => {
    const here = [...path, node];
    const termSet = collectTerms(node);
    const score = [...termSet].filter((t) => q.has(t)).length;
    if (score > bestScore || (score === bestScore && score > 0 && here.length > bestPath.length)) {
      best = node; bestScore = score; bestPath = here;
    }
    for (const c of node.children || []) walk(c, here);
  };
  walk(map, []);
  if (!best || bestScore === 0) return { found: false, reason: "no term in this document matches the question" };
  // Widen the yank: if we landed on a term, read the nearest line (or block) ancestor instead of the word.
  let read = best;
  if (best.kind === "term") {
    for (let i = bestPath.length - 1; i >= 0; i--) {
      if (bestPath[i].kind === "line" || bestPath[i].kind === "block") { read = bestPath[i]; break; }
    }
  }
  return {
    found: true,
    span: best.span,          // the precise anchor cursor (may be a bare term)
    read: read.span,          // the span to yank raw text from (widened to the enclosing line/block)
    genealogy: bestPath.map((n) => ({ kind: n.kind, label: n.label })),
    matched: [...collectTerms(best)].filter((t) => q.has(t)),
  };
}

export function collectTerms(node) {
  const out = new Set();
  const go = (n) => { if (n.kind === "term") out.add(n.label); for (const c of n.children || []) go(c); };
  go(node); return out;
}

// yank the raw text at a span (the answer always comes from the bytes, never the labels).
export function slice(text, span) { return text.slice(span.start, span.end); }

// ---- a small inspector -------------------------------------------------------------------------------
export function printMap(node, text, depth = 0) {
  const pad = "  ".repeat(depth);
  const peek = node.kind === "term" ? "" : `  «${text.slice(node.span.start, node.span.start + 40).replace(/\n/g, " ")}${node.span.end - node.span.start > 40 ? "…" : ""}»`;
  console.log(`${pad}${node.kind}: ${node.label}${peek}`);
  if (node.kind !== "term") for (const c of node.children || []) printMap(c, text, depth + 1);
}
