// viewer/anecdote-url.mjs — the `anecdote://` URL scheme. Its whole job is to say, definitively, "this is
// something LOCAL" — a resource in your own offline origin's private registry, not a web URL. Where a
// downstream is `https://github.com/you/repo`, the same repo's *local canonical id* is
// `anecdote://repo/<label>`. Distinguishing the two is what lets the system viewer resolve "am I looking
// at my own thing, or a resolvable-web thing?" (docs/system-viewer.md).
//
//   anecdote://<kind>/<id>     e.g. anecdote://repo/my-session   ·   anecdote://pile.poll/budget-2026

export function anecdoteUrl(kind, id) {
  if (!kind || id == null) throw new Error("anecdote-url: need a kind and an id");
  return `anecdote://${kind}/${encodeURIComponent(id)}`;
}

export function parseAnecdoteUrl(url) {
  const m = /^anecdote:\/\/([^/]+)\/(.+)$/.exec(url || "");
  if (!m) return null;
  return { kind: m[1], id: decodeURIComponent(m[2]) };
}

export const isAnecdoteUrl = (u) => typeof u === "string" && u.startsWith("anecdote://");

// Is this a resolvable web address (a downstream), as opposed to a local anecdote:// id?
export const isWebUrl = (u) => typeof u === "string" && /^https?:\/\//.test(u);
