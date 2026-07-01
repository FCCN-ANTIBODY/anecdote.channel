// Tests for commit/tree parsing + walking — cross-checked against a real `git`. Run: node git-enough/read.test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repo } from "./repo.mjs";
import { parseCommit, parseTree, walkTree, filesAt } from "./read.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const you = { name: "You", email: "you@origin", epoch: 1700000000, tz: "+0000" };
const dirs = [];
try {
  // 1. parseCommit / parseTree on objects we built, and filesAt walks nested dirs.
  {
    const r = repo();
    const c1 = await r.commitFiles([{ path: "a.txt", content: "alpha\n" }], { author: you, message: "first\n" });
    const c2 = await r.commitFiles([
      { path: "a.txt", content: "alpha2\n" }, { path: "d/b.txt", content: "beta\n" }, { path: "d/e/c.txt", content: "cee\n" },
    ], { author: you, message: "second\n" });

    const commit = parseCommit(r.objects.get(c2).content);
    ok(commit.tree && commit.parents[0] === c1, "parseCommit: tree + parent");
    ok(/^You <you@origin> 1700000000 \+0000$/.test(commit.author) && commit.message === "second\n", "parseCommit: author + message");

    const tree = parseTree(r.objects.get(commit.tree).content);
    ok(tree.some((e) => e.name === "a.txt" && e.mode === "100644") && tree.some((e) => e.name === "d" && e.mode === "40000"),
       "parseTree: file + subdir entries with modes");

    const files = filesAt(r.objects, c2).map((f) => `${f.path}:${f.size}`);
    ok(files.join(",") === "a.txt:7,d/b.txt:5,d/e/c.txt:4", "filesAt walks nested dirs with sizes: " + files.join(","));
  }

  // 2. walkTree matches `git ls-tree -r` for the same history.
  {
    const r = repo();
    const c = await r.commitFiles([{ path: "x", content: "1\n" }, { path: "sub/y", content: "22\n" }], { author: you, message: "m\n" });

    const d = mkdtempSync(join(tmpdir(), "git-enough-read-")); dirs.push(d);
    execFileSync("git", ["init", "-q", d]);
    const { looseFiles, refFiles } = await import("./repo.mjs");
    const { dirname } = await import("node:path");
    for (const f of await looseFiles(r)) { const p = join(d, ".git", f.path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, Buffer.from(f.bytes)); }
    for (const f of refFiles(r)) { const p = join(d, ".git", f.path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, f.text); }

    const gitPaths = execFileSync("git", ["-C", d, "ls-tree", "-r", "--name-only", c]).toString().trim().split("\n").sort();
    const ourPaths = filesAt(r.objects, c).map((f) => f.path).sort();
    ok(JSON.stringify(gitPaths) === JSON.stringify(ourPaths), "walkTree paths match git ls-tree -r: " + ourPaths.join(","));
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall git-enough read tests passed");
