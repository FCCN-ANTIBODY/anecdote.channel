// scripts/bundle-action.mjs — bundle an unchanged bin/*.mjs so it runs against the virtual repo
// (docs/actions-enough.md, phase 2). esbuild aliases the node: builtins the scripts use to the
// git-enough shims: node:fs -> the ambient virtual fs, node:path/url/os -> the pure posix shims. The
// script's own imports (its module graph) are bundled in; nothing is rewritten. WebCrypto (subtle) and
// process are left to the host (real in Node; a browser run shims process/argv/env — a later phase).
// node:crypto (createHash) and node:fs/promises are deliberately EXTERNAL — a named gap that throws if a
// script needs them, rather than a silent wrong answer.
//
//   bundleAction("<abs path to bin/x.mjs>", "<out.mjs>")   # -> the servable, fs-virtualized bundle

import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "reducer", "package.json"));   // esbuild rides in reducer/'s devDeps
const esbuild = require("esbuild");
const ge = (f) => join(ROOT, "git-enough", f);

// The repo's uniform CLI main-guard. In a bundle esbuild collapses `import.meta.url` to the OUTPUT file,
// so EVERY bundled script's guard would fire at once. This plugin neutralizes it per-module: with
// fireMain, ONLY the entry's guard survives (its main runs, GitHub's `node bin/x.mjs` semantics); every
// imported sibling's guard is forced false so a dependency's CLI never runs. Without fireMain, all are
// false (phase 2a: the caller invokes an exported function, no main side effects on import).
const GUARD = /import\.meta\.url\s*===\s*pathToFileURL\(process\.argv\[1\]\)\.href/g;
const guardPlugin = (entryAbs, fireMain) => ({
  name: "main-guard",
  setup(build) {
    build.onLoad({ filter: /\.mjs$/ }, async (args) => {
      const src = await readFile(args.path, "utf8");
      if (!GUARD.test(src)) return null;
      GUARD.lastIndex = 0;
      const survives = fireMain && resolve(args.path) === entryAbs;
      return { contents: src.replace(GUARD, survives ? "true" : "false"), loader: "js" };
    });
  },
});

export async function bundleAction(entry, outfile, { fireMain = false } = {}) {
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",                 // keep process/WebCrypto real; the alias below still wins for node:fs
    target: "es2022",
    legalComments: "none",
    alias: {
      "node:fs": ge("shim-fs.mjs"),
      "node:path": ge("shim-path.mjs"),
      "node:url": ge("shim-url.mjs"),
      "node:os": ge("shim-os.mjs"),
    },
    external: ["node:crypto", "node:fs/promises", "node:zlib", "node:buffer", "node:child_process"],
    plugins: [guardPlugin(resolve(entry), fireMain)],
  });
  return outfile;
}
