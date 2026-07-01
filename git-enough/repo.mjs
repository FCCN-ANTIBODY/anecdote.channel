// git-enough/repo.mjs — refs, a staging index, and working commits (Milestone: Origin, phase 1).
//
// Phase 0 gave us objects; this turns them into HISTORY. It is the shared floor under BOTH repo-init
// entry points (docs/git-enough.md → "Two repo-init entry points"):
//   - GREENFIELD: the scaffold factory inits, then commits flow from several hands (system, you,
//     side-effects) — author/committer are just parameters, so "who committed" needs no extra machinery.
//   - IMPORT (the King's Leap): photocopy a tree and commit it as a FRESH ROOT under your identity —
//     literally `commitFiles(files, { parents: [] })`. (The Castle — full-lineage object import — needs a
//     later pack-read phase; the Leap needs only this.)
//
// Everything is in-memory + browser-native (built on objects.mjs). Serialization to a real .git layout is
// via looseFiles()/refFiles() (pure — returns paths + bytes; the caller writes them wherever storage
// lives). The tests write them to disk and let a real `git` read the history back.

import { blob, tree, commit, looseBytes, loosePath } from "./objects.mjs";

export function repo() {
  const objects = new Map();        // oid -> { type, content }
  const refs = new Map();           // "refs/heads/main" -> oid
  let headRef = "refs/heads/main";  // symbolic HEAD

  const put = (obj) => { objects.set(obj.oid, { type: obj.type, content: obj.content }); return obj.oid; };

  async function addBlob(content) { return put(await blob(content)); }

  // Build a tree (with nested directories) from a flat index of { path, oid, mode }. Subtrees are written
  // as their own objects; returns the root tree oid.
  async function writeTree(index) {
    const build = async (items) => {
      const files = [];                 // { mode, name, oid }
      const dirs = new Map();           // dirname -> [items with first segment stripped]
      for (const it of items) {
        const slash = it.path.indexOf("/");
        if (slash === -1) { files.push({ mode: it.mode || "100644", name: it.path, oid: it.oid }); continue; }
        const d = it.path.slice(0, slash), rest = it.path.slice(slash + 1);
        if (!dirs.has(d)) dirs.set(d, []);
        dirs.get(d).push({ ...it, path: rest });
      }
      const entries = [...files];
      for (const [d, sub] of dirs) entries.push({ mode: "40000", name: d, oid: await build(sub) });
      return put(await tree(entries));
    };
    return build(index);
  }

  async function commitTree({ tree: treeOid, parents = [], author, committer, message }) {
    return put(await commit({ tree: treeOid, parents, author, committer, message }));
  }

  // The steady beat, and the King's Leap, in one call: stage `files` into a tree and commit it onto `ref`.
  // With no existing ref (or parents:[] forced) this is a ROOT commit — a fresh lineage. `files` is
  // [{ path, content, mode? }]. Returns the new commit oid and advances the ref.
  async function commitFiles(files, { author, committer, message, ref = "refs/heads/main", root = false } = {}) {
    if (!author) throw new Error("git-enough: a commit needs an author");
    const index = [];
    for (const f of files) index.push({ path: f.path, oid: await addBlob(f.content), mode: f.mode });
    const treeOid = await writeTree(index);
    const parent = root ? null : refs.get(ref);
    const oid = await commitTree({ tree: treeOid, parents: parent ? [parent] : [], author, committer, message });
    refs.set(ref, oid);
    return oid;
  }

  return {
    objects, refs,
    put, addBlob, writeTree, commitTree, commitFiles,
    updateRef: (name, oid) => refs.set(name, oid),
    readRef: (name) => refs.get(name) || null,
    setHead: (name) => { headRef = name; },
    head: () => headRef,
    resolveHead: () => refs.get(headRef) || null,
  };
}

// ---- serialization to a real .git layout (pure: paths + bytes; caller writes them) ------------------

// The loose object files: { path: "objects/xx/rest…", bytes }. Write these under .git/ and any real git
// reads the objects.
export async function looseFiles(r) {
  const out = [];
  for (const [id, o] of r.objects) out.push({ path: loosePath(id), bytes: await looseBytes(o.type, o.content) });
  return out;
}

// The ref files: HEAD (symbolic) + each ref. Text files, one oid per line. Write these under .git/.
export function refFiles(r) {
  const out = [{ path: "HEAD", text: `ref: ${r.head()}\n` }];
  for (const [name, id] of r.refs) out.push({ path: name, text: id + "\n" });
  return out;
}
