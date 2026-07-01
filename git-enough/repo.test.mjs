// Tests for refs + index + working commits (phase 1) — history built by our code, READ BACK by a real
// `git`. Covers the greenfield beat (multi-commit, multi-author, nested dirs) and the King's Leap import
// (a fresh-root photocopy). Run: node git-enough/repo.test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { repo, looseFiles, refFiles } from "./repo.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const sys = { name: "scaffold", email: "system@origin", epoch: 1700000000, tz: "+0000" };
const you = { name: "You", email: "you@origin", epoch: 1700000100, tz: "+0000" };

// Materialize a repo into a fresh `git init` dir and return a git runner bound to it.
async function gitFor(r) {
  const dir = mkdtempSync(join(tmpdir(), "git-enough-repo-"));
  execFileSync("git", ["init", "-q", dir]);
  const write = (rel, buf) => { const p = join(dir, ".git", rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, buf); };
  for (const f of await looseFiles(r)) write(f.path, Buffer.from(f.bytes));
  for (const f of refFiles(r)) write(f.path, f.text);
  return { dir, git: (args, input) => execFileSync("git", ["-C", dir, ...args], { input, maxBuffer: 1 << 24 }).toString() };
}

const dirs = [];
try {
  // 1. The greenfield beat: a scaffold root commit, then a user commit on top; nested dir; multi-author.
  {
    const r = repo();
    await r.commitFiles([
      { path: "README.md", content: "# scaffold\n" },
      { path: "src/app.js", content: "export const x = 1\n" },
    ], { author: sys, message: "scaffold: init workspace\n" });
    await r.commitFiles([
      { path: "README.md", content: "# scaffold\n" },
      { path: "src/app.js", content: "export const x = 2\n" },
      { path: "notes.txt", content: "mine\n" },
    ], { author: you, message: "you: bump x, add notes\n" });

    const { dir, git } = await gitFor(r); dirs.push(dir);
    ok(git(["fsck", "--strict"]) !== undefined, "git fsck --strict accepts our history");
    ok(git(["rev-list", "--count", "HEAD"]).trim() === "2", "two commits on the beat");
    ok(git(["cat-file", "-p", "HEAD:src/app.js"]) === "export const x = 2\n", "nested file content reads back (HEAD)");
    ok(/src/.test(git(["ls-tree", "HEAD"])), "git sees the nested 'src' tree");
    ok(git(["cat-file", "-p", "HEAD~1:src/app.js"]) === "export const x = 1\n", "the parent commit's version is intact");
    const authors = git(["log", "--format=%an"]).trim().split("\n");
    ok(authors[0] === "You" && authors[1] === "scaffold", "multi-author: You on top, scaffold at the root");
  }

  // 2. The King's Leap: photocopy a foreign tree and commit it as a FRESH ROOT under your identity.
  {
    const photocopied = [   // "downloaded" from some github repo — we just stage the files
      { path: "index.html", content: "<h1>theirs, now yours</h1>\n" },
      { path: "lib/util.js", content: "export const util = () => 42\n" },
    ];
    const r = repo();
    await r.commitFiles(photocopied, { author: you, message: "import: adopt origin (King's Leap)\n", root: true });

    const { dir, git } = await gitFor(r); dirs.push(dir);
    ok(git(["fsck", "--strict"]) !== undefined, "git fsck accepts the imported root");
    ok(git(["rev-list", "--count", "HEAD"]).trim() === "1", "a single commit — a clean break, no carried lineage");
    ok(git(["log", "--format=%P"]).trim() === "", "it is a ROOT commit (no parent) — the hard break in ownership history");
    ok(git(["log", "--format=%an"]).trim() === "You", "authored by you (the first-contact signer), not the old owner");
    ok(git(["cat-file", "-p", "HEAD:lib/util.js"]) === "export const util = () => 42\n", "the photocopied content is present");
  }

  // 3. A ref other than main, and readRef/resolveHead plumbing.
  {
    const r = repo();
    const c = await r.commitFiles([{ path: "f", content: "x\n" }], { author: sys, message: "m\n", ref: "refs/heads/dev" });
    ok(r.readRef("refs/heads/dev") === c, "commitFiles advanced the named ref");
    ok(r.resolveHead() === null, "HEAD (main) is still unborn — dev didn't move it");
    r.setHead("refs/heads/dev");
    ok(r.resolveHead() === c, "setHead re-points HEAD and resolves to the dev tip");
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall git-enough repo tests passed");
