// Tests for the staging beat + the git-enough .gitignore subset. History verified by a real `git`.
//   node git-enough/staging-beat.test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { repo, looseFiles, refFiles } from "./repo.mjs";
import { stagingBeat, compileGitignore } from "./staging-beat.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const author = { name: "beat", email: "beat@origin", epoch: 1700000000, tz: "+0000" };
const dirs = [];

// materialize a repo and return a git runner
function gitFor(r) {
  const d = mkdtempSync(join(tmpdir(), "git-beat-")); dirs.push(d);
  execFileSync("git", ["init", "-q", d]);
  const w = (rel, buf) => { const p = join(d, ".git", rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, buf); };
  return (async () => {
    for (const f of await looseFiles(r)) w(f.path, Buffer.from(f.bytes));
    for (const f of refFiles(r)) w(f.path, f.text);
    return (args) => execFileSync("git", ["-C", d, ...args], { maxBuffer: 1 << 26 }).toString();
  })();
}

try {
  // 1. .gitignore subset — the documented cases.
  {
    const ig = compileGitignore(`
      # churn
      *.css
      node_modules/
      /root-only.txt
      assets/*.js
      **/tmp/
      !keep.css
    `.split("\n").map((l) => l.trim()).join("\n"));
    ok(ig("a.css") && ig("deep/b.css"), "*.css ignored at any depth");
    ok(!ig("keep.css"), "!keep.css negation un-ignores (last match wins)");
    ok(ig("node_modules/x") && ig("a/node_modules/y") && !ig("node.js"), "node_modules/ dir at any depth");
    ok(ig("root-only.txt") && !ig("sub/root-only.txt"), "/root-only.txt is root-anchored");
    ok(ig("assets/app.js") && !ig("assets/deep/app.js"), "assets/*.js does not cross a slash");
    ok(ig("tmp/x") && ig("a/tmp/y"), "**/tmp/ matches at any depth");
  }

  // 2. Instant mode commits on each stage; churn is dropped; git reads the history.
  {
    const r = repo();
    const beat = stagingBeat({ repo: r, author, mode: "instant", ignore: "*.css\n" });
    const s1 = await beat.stage("index.html", "<h1>hi</h1>\n");
    ok(s1.staged && s1.committed, "instant: staging a doc commits it");
    const s2 = await beat.stage("style.css", "body{}\n");
    ok(!s2.staged && s2.ignored, "instant: churn (*.css) is not staged");
    const git = await gitFor(r);
    ok(git(["cat-file", "-p", "HEAD:index.html"]) === "<h1>hi</h1>\n", "git reads the committed doc");
    ok(!/style\.css/.test(git(["ls-tree", "-r", "--name-only", "HEAD"])), "the css never entered the tree");
  }

  // 3. Tempo mode: many stages, one commit per tick; a second tick with no change is a zero-diff no-op.
  {
    const r = repo();
    const beat = stagingBeat({ repo: r, author, mode: "tempo" });
    await beat.stage("a.txt", "1\n");
    await beat.stage("b.txt", "2\n");
    const t1 = await beat.tick();
    ok(t1.committed && t1.files === 2, "tempo tick commits the whole shelf at once");
    const t2 = await beat.tick();
    ok(!t2.committed && t2.reason === "no-change", "a second tick with no change is a zero-diff no-op");
    // a change → a new commit; the working tree accumulates
    await beat.stage("a.txt", "1-updated\n");
    const t3 = await beat.tick();
    ok(t3.committed, "a real change commits again");
    const git = await gitFor(r);
    ok(git(["rev-list", "--count", "HEAD"]).trim() === "2", "two commits total (no zero-diff commit)");
    ok(git(["cat-file", "-p", "HEAD:b.txt"]) === "2\n", "the working tree accumulated (b.txt still present)");
  }

  // 4. Authority gate: mayRun() false (revoked / incognito) → every commit path no-ops, nothing written.
  {
    const r = repo();
    let live = false;
    const beat = stagingBeat({ repo: r, author, mode: "tempo", mayRun: () => live });
    await beat.stage("x", "1\n");
    ok(!(await beat.tick()).committed, "tick no-ops while unauthorized");
    ok(!(await beat.teardownFlush()).committed && r.objects.size === 0, "teardown-flush no-ops too — nothing persisted (incognito/revoked)");
    live = true;
    ok((await beat.teardownFlush()).committed, "once authorized, teardown-flush commits the shelf");
  }

  // 5. Discard: stage-1 deletion drops the shelf; a later flush writes nothing.
  {
    const r = repo();
    const beat = stagingBeat({ repo: r, author, mode: "manual" });
    await beat.stage("draft", "secret-ish\n");
    beat.discard();
    ok(!(await beat.teardownFlush()).committed && r.objects.size === 0, "discard() means nothing is ever committed");
  }

  // 6. Teardown-flush is the session-close commit.
  {
    const r = repo();
    const beat = stagingBeat({ repo: r, author, mode: "manual" });
    await beat.stage("notes.md", "kept\n");
    const f = await beat.teardownFlush();
    ok(f.committed, "teardown-flush commits what's on the shelf at session close");
    const git = await gitFor(r);
    ok(/session teardown flush/.test(git(["log", "--format=%s", "-1"])), "the teardown commit is labelled");
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall staging-beat tests passed");
