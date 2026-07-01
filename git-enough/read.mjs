// git-enough/read.mjs — parse commit + tree objects and walk a tree. The human/inspection side of the
// object store (and what the LM-as-historian will use to walk history). Pure, browser-native.

const dec = new TextDecoder();

// Parse a commit object's content → { tree, parents[], author, committer, message }.
export function parseCommit(content) {
  const text = dec.decode(content);
  const split = text.indexOf("\n\n");
  const header = split === -1 ? text : text.slice(0, split);
  const message = split === -1 ? "" : text.slice(split + 2);
  const out = { parents: [], message };
  for (const line of header.split("\n")) {
    const sp = line.indexOf(" "); if (sp === -1) continue;
    const k = line.slice(0, sp), v = line.slice(sp + 1);
    if (k === "tree") out.tree = v;
    else if (k === "parent") out.parents.push(v);
    else if (k === "author") out.author = v;
    else if (k === "committer") out.committer = v;
  }
  return out;
}

// Parse a tree object's content → [{ mode, name, oid }] (binary: "<mode> <name>\0" + 20 raw sha bytes).
export function parseTree(content) {
  const out = [];
  let i = 0;
  while (i < content.length) {
    let sp = i; while (content[sp] !== 0x20) sp++;
    const mode = dec.decode(content.subarray(i, sp));
    let nul = sp + 1; while (content[nul] !== 0) nul++;
    const name = dec.decode(content.subarray(sp + 1, nul));
    const oid = [...content.subarray(nul + 1, nul + 21)].map((x) => x.toString(16).padStart(2, "0")).join("");
    out.push({ mode, name, oid });
    i = nul + 21;
  }
  return out;
}

// Walk a tree recursively over an objects Map (oid → {type, content}), yielding every blob as
// { path, mode, oid, size }. Directories (mode 40000) recurse; sizes are null if the blob is absent.
export function* walkTree(objects, treeOid, prefix = "") {
  const t = objects.get(treeOid);
  if (!t || t.type !== "tree") return;
  for (const e of parseTree(t.content)) {
    const path = prefix + e.name;
    if (e.mode === "40000") yield* walkTree(objects, e.oid, path + "/");
    else { const blob = objects.get(e.oid); yield { path, mode: e.mode, oid: e.oid, size: blob ? blob.content.length : null }; }
  }
}

// Convenience: the file list at a commit, sorted by path.
export function filesAt(objects, commitOid) {
  const c = objects.get(commitOid);
  if (!c || c.type !== "commit") throw new Error("read: not a commit " + commitOid);
  const { tree } = parseCommit(c.content);
  return [...walkTree(objects, tree)].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
