// git-enough/run-node-live.mjs — the live runNode: bundle an unchanged bin/*.mjs and FIRE ITS main()
// against the held tree (actions-enough phase 2 finale). Phase 2a proved a bundled script's exported
// function runs on the virtual fs; this reproduces the CLI semantics GitHub uses — `node bin/x.mjs args`
// — by setting process.argv so the script's own `if (import.meta.url === pathToFileURL(argv[1]))` main
// guard fires. Node-only (it drives process.argv/env + dynamic import); a browser run shims process later.
//
//   const runNode = makeRunNode(bundleAction, sourceRoot);   // sourceRoot: where the bin/*.mjs SOURCE lives
//   await runNode("bin/attest-heartbeat.mjs", { fs, env, argv });   // runs against the ambient virtual fs

import { pathToFileURL } from "node:url";
import { join } from "node:path";

export function makeRunNode(bundleAction, sourceRoot, { outDir = "/tmp" } = {}) {
  let n = 0;
  return async function runNode(script, ctx = {}) {
    const out = join(outDir, `ae-bundle-${Date.now?.() ?? ""}-${++n}.mjs`);
    await bundleAction(join(sourceRoot, script), out, { fireMain: true });   // only THIS bin's main() fires

    const savedArgv = process.argv, savedEnv = process.env, savedFs = globalThis.__ACTION_FS__;
    try {
      globalThis.__ACTION_FS__ = ctx.fs;                          // the shim's ambient tree
      process.argv = [process.execPath, out, ...(ctx.argv || [])];// so the bin's main() guard fires
      process.env = { ...savedEnv, ...(ctx.env || {}) };
      await import(pathToFileURL(out).href);                      // executes the script: main() runs on the tree
    } finally {
      process.argv = savedArgv; process.env = savedEnv; globalThis.__ACTION_FS__ = savedFs;
    }
  };
}
