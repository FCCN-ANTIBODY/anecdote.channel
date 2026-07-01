// Tests for the git object layer — cross-checked against a REAL `git` (2.x). Proves our vendorless,
// browser-native encoder produces byte-identical objects that git reads back.
//   node git-enough/objects.test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { blob, tree, commit, oid, encodeTree, looseBytes, readLoose, loosePath, frame } from "./objects.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const repo = mkdtempSync(join(tmpdir(), "git-enough-"));
const git = (args, input) => execFileSync("git", ["-C", repo, ...args], { input, maxBuffer: 1 << 24 });
execFileSync("git", ["init", "-q", repo]);
execFileSync("git", ["-C", repo, "config", "user.name", "T"]);
execFileSync("git", ["-C", repo, "config", "user.email", "t@x"]);

try {
  // 1. blob id == git hash-object
  {
    const content = "The park needs more shade\n";
    const b = await blob(content);
    const g = git(["hash-object", "--stdin"], content).toString().trim();
    ok(b.oid === g, `blob oid matches git (${b.oid})`);
  }

  // 2. tree: our bytes hash to git's id, git accepts + lists it, and entries come out sorted regardless
  //    of input order.
  {
    const a = await blob("aaa\n"), z = await blob("zzz\n");
    for (const o of [a, z]) git(["hash-object", "-w", "--stdin"], o.content); // write blobs into the repo
    // give the entries OUT of order to prove we sort them:
    const t = await tree([
      { mode: "100644", name: "z.txt", oid: z.oid },
      { mode: "100644", name: "a.txt", oid: a.oid },
    ]);
    const gId = git(["hash-object", "-t", "tree", "--stdin"], Buffer.from(t.content)).toString().trim();
    ok(t.oid === gId, `tree oid matches git (${t.oid})`);

    const written = git(["hash-object", "-w", "-t", "tree", "--stdin"], Buffer.from(t.content)).toString().trim();
    const listed = git(["cat-file", "-p", written]).toString();
    ok(/a\.txt/.test(listed) && listed.indexOf("a.txt") < listed.indexOf("z.txt"),
       "git reads our tree back with entries sorted a.txt before z.txt");
  }

  // 3. commit: our bytes hash to git's id and git parses it.
  {
    const a = await blob("hello\n");
    git(["hash-object", "-w", "--stdin"], a.content);
    const t = await tree([{ mode: "100644", name: "f", oid: a.oid }]);
    git(["hash-object", "-w", "-t", "tree", "--stdin"], Buffer.from(t.content));
    const who = { name: "Jane Doe", email: "jane@example.com", epoch: 1700000000, tz: "+0000" };
    const c = await commit({ tree: t.oid, parents: [], author: who, committer: who, message: "first\n" });
    const gId = git(["hash-object", "-t", "commit", "--stdin"], Buffer.from(c.content)).toString().trim();
    ok(c.oid === gId, `commit oid matches git (${c.oid})`);
    const written = git(["hash-object", "-w", "-t", "commit", "--stdin"], Buffer.from(c.content)).toString().trim();
    const shown = git(["cat-file", "-p", written]).toString();
    ok(/^tree /.test(shown) && /author Jane Doe <jane@example\.com> 1700000000 \+0000/.test(shown),
       "git parses our commit (tree + author line intact)");

    // a commit with a parent still matches
    const c2 = await commit({ tree: t.oid, parents: [c.oid], author: who, committer: who, message: "second\n" });
    const gId2 = git(["hash-object", "-t", "commit", "--stdin"], Buffer.from(c2.content)).toString().trim();
    ok(c2.oid === gId2, "commit with a parent matches git");
  }

  // 4. loose on-disk format: our zlib bytes, dropped into .git/objects, are read by `git cat-file`.
  {
    const content = "loose object content\n";
    const b = await blob(content);
    const bytes = await looseBytes("blob", content);
    const p = join(repo, ".git", loosePath(b.oid));
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, Buffer.from(bytes));
    const shown = git(["cat-file", "-p", b.oid]).toString();
    ok(shown === content, "git cat-file reads our zlib-deflated loose object");
    ok((await git(["cat-file", "-t", b.oid]).toString().trim()) === "blob", "…and reports it as a blob");
  }

  // 5. loose round-trip in-process (inflate ∘ deflate == the framed object).
  {
    const b = await blob("round trip\n");
    const back = await readLoose(await looseBytes("blob", b.content));
    ok(back.type === "blob" && new TextDecoder().decode(back.content) === "round trip\n", "readLoose round-trips our loose bytes");
    ok(back.length === b.content.length, "loose header length is correct");
  }

  // 6. framing sanity: empty blob is git's well-known empty-blob id.
  {
    ok((await blob("")).oid === "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391", "empty blob has git's canonical id");
  }
} finally {
  rmSync(repo, { recursive: true, force: true });
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall git-enough object tests passed");
