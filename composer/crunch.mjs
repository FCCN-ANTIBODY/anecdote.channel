// Crunch — the ranking brain for the "chase your meaning" proof. Pure: no DOM, no worker, no
// network, so it is Node-testable. The view (crunch.html) feeds it vectors from the worker bus
// and renders the result.
//
// Given the embedding of what you're typing and a dictionary of label embeddings, return the
// nearest concepts by cosine — the live snippets that surface behind your cursor.

import { cos } from "../reducer/reducer.mjs";

export { cos as cosineSim };

// dict: [{ label, vec }] (all vectors from the SAME embedder/backend as queryVec). Returns the
// top-n [{ label, score }] sorted by descending cosine, stable on ties (original order).
export function nearest(queryVec, dict, n = 5) {
  if (!queryVec || !dict?.length) return [];
  return dict
    .map((d, i) => ({ label: d.label, score: cos(queryVec, d.vec), i }))
    .sort((a, b) => (b.score - a.score) || (a.i - b.i))
    .slice(0, Math.max(0, n))
    .map(({ label, score }) => ({ label, score }));
}

// Trailing debounce — the crunch fires after you pause, "chasing" not racing every keystroke.
export function debounce(fn, ms = 180) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
