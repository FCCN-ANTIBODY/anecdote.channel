// Tests for repo-detail (on-ice open) — cross-checked against a real git. Run: node viewer/repo-detail.test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { repo, looseFiles, refFiles } from "../git-enough/repo.mjs";
import { repoDetail, readFile } from "./repo-detail.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const author = { name: "You", email: "you@origin", epoch: 1700000000, tz: "+0000" };
const dirs = [];

try {
  const r = repo();
  await r.commitFiles([{ path: "index.html", content: "<h1>example.com</h1>\n" }], { author, message: "browse: example.com\n" });
  await r.commitFiles([
    { path: "index.html", content: "<h1>example.com</h1>\n" },
    { path: "a/note.txt", content: "a private note\n" },
  ], { author, message: "browse: example.com/a\n" });

  // 1. repoDetail: newest-first timeline + tree at tip.
  {
    const d = repoDetail(r);
    ok(d.commits.length === 2 && d.commits[0].message === "browse: example.com/a", "timeline newest-first");
    ok(d.commits[1].parents.length === 0 && d.commits[0].parents.length === 1, "root has no parent; child has one");
    ok(d.files.map((f) => f.path).join(",") === "a/note.txt,index.html", "tree at tip, sorted");
  }

  // 2. readFile pulls a document's bytes on ice.
  {
    const f = readFile(r, undefined, "a/note.txt");
    ok(f && new TextDecoder().decode(f.content) === "a private note\n" && f.size === 15, "readFile returns the document bytes");
    ok(readFile(r, undefined, "nope") === null, "missing file → null");
  }

  // 3. Cross-check the timeline against a real git log.
  {
    const d = mkdtempSync(join(tmpdir(), "viewer-detail-")); dirs.push(d);
    execFileSync("git", ["init", "-q", d]);
    for (const f of await looseFiles(r)) { const p = join(d, ".git", f.path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, Buffer.from(f.bytes)); }
    for (const f of refFiles(r)) { const p = join(d, ".git", f.path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, f.text); }
    const gitLog = execFileSync("git", ["-C", d, "log", "--format=%s"]).toString().trim().split("\n");
    const ourLog = repoDetail(r).commits.map((c) => c.message);
    ok(JSON.stringify(gitLog) === JSON.stringify(ourLog), "our timeline matches git log --format=%s");
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall repo-detail tests passed");
