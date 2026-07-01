// viewer/repo-detail.mjs — open a repo "on ice": its commit timeline + the tree at a ref + a file's
// contents. Pure view-model built on the git-enough read layer; the on-ice chamber widget renders it, and
// the viewer.* probe ops (viewer/probe-ops.mjs) hand it over the probe line. (docs/system-viewer.md)

import { parseCommit, filesAt } from "../git-enough/read.mjs";

// The commit timeline from a ref (newest first) + the file tree at the tip.
export function repoDetail(repo, { ref, limit = 100 } = {}) {
  const head = ref || repo.head();
  const tip = repo.readRef(head);
  const commits = [];
  let oid = tip;
  while (oid && commits.length < limit) {
    const o = repo.objects.get(oid);
    if (!o || o.type !== "commit") break;
    const c = parseCommit(o.content);
    commits.push({ oid, message: c.message.trim(), author: c.author, parents: c.parents });
    oid = c.parents[0];
  }
  const files = tip ? filesAt(repo.objects, tip).map((f) => ({ path: f.path, size: f.size, oid: f.oid })) : [];
  return { ref: head, tip: tip || null, commits, files };
}

// A single file's bytes at a ref (for the on-ice document view). Returns { path, content, size } or null.
export function readFile(repo, ref, path) {
  const tip = repo.readRef(ref || repo.head());
  if (!tip) return null;
  const f = filesAt(repo.objects, tip).find((x) => x.path === path);
  if (!f) return null;
  const b = repo.objects.get(f.oid);
  return b ? { path, content: b.content, size: b.content.length } : null;
}
