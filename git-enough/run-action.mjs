// git-enough/run-action.mjs — run a workflow step against the virtual repo (docs/actions-enough.md, phase 1).
//
// The seam every interpreted step lands on: give an `action` the Node-compat io (fs + path + env + argv),
// run it against an in-memory tree seeded from the repo, and hand back the tree it produced. On GitHub the
// same action would run against the runner's disk; here it runs against the device's held tree — the
// direction of bytes changes, the action does not. Phase 2 (the interpreter) points a bundled bin/*.mjs at
// this by aliasing node:fs -> node-compat; today it takes an action that accepts the io directly.

import { virtualFs, path as vpath } from "./node-compat.mjs";

// action: async (io) => void   where io = { fs, path, env, argv }.
// files: { "path": string|bytes } seeds the tree. Returns { outputs, fs } — outputs is a plain
// path -> bytes snapshot of the whole tree after the run (inputs + anything written).
export async function runAction(action, { files = {}, env = {}, argv = [] } = {}) {
  const fs = virtualFs(files);
  const io = { fs, path: vpath, env: { ...env }, argv: [...argv] };
  await action(io);
  return { outputs: fs.snapshot(), fs };
}

// Byte-diff two path->bytes snapshots: which paths only one side has, and which differ. Empty arrays === same.
export function diffTrees(a, b) {
  const same = (x, y) => x && y && x.length === y.length && x.every((v, i) => v === y[i]);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const onlyA = [], onlyB = [], changed = [];
  for (const k of keys) {
    if (!(k in b)) onlyA.push(k);
    else if (!(k in a)) onlyB.push(k);
    else if (!same(a[k], b[k])) changed.push(k);
  }
  return { onlyA: onlyA.sort(), onlyB: onlyB.sort(), changed: changed.sort() };
}
