// Unit: the Node-compat shim (node-compat.mjs) + the action runner (run-action.mjs) — actions-enough
// phase 1 (docs/actions-enough.md). Proves (A) the virtual fs is byte-exact, (B) it carries REAL git
// object bytes faithfully — a real `git` reads a history materialized THROUGH the shim, and the shim's
// store matches a node:fs materialization path-for-path, byte-for-byte, and (C) the runner seam is
// fs-backend-agnostic: one action, run against the virtual tree and against real node:fs, byte-identical
// output — the phase-2 promise (GitHub disk vs device tree) in miniature. Run: node git-enough/node-compat.test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import path from "node:path";
import { virtualFs, normalize, path as vpath } from "./node-compat.mjs";
import { runAction, diffTrees } from "./run-action.mjs";
import { repo, looseFiles, refFiles } from "./repo.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const enc = new TextEncoder();
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ===== A. the virtual fs is byte-exact =====
{
  const fs = virtualFs({ "_data/a.txt": "hello", "_data/sub/b.bin": new Uint8Array([0, 1, 255, 128]) });
  ok(fs.readFileSync("_data/a.txt", "utf8") === "hello", "read seeded text as utf8");
  ok(same(fs.readFileSync("_data/sub/b.bin"), new Uint8Array([0, 1, 255, 128])), "read seeded bytes exactly");
  ok(fs.existsSync("_data/a.txt") && fs.existsSync("_data") && fs.existsSync("_data/sub"), "files and their implied dirs exist");
  ok(!fs.existsSync("_data/nope"), "a missing path does not exist");
  fs.writeFileSync("out.json", "{}\n");
  ok(fs.readFileSync("out.json", "utf8") === "{}\n", "write then read round-trips");
  const bin = new Uint8Array(256); for (let i = 0; i < 256; i++) bin[i] = i;
  fs.writeFileSync("all.bin", bin);
  ok(same(fs.readFileSync("all.bin"), bin), "every byte value 0..255 survives write/read");
  ok(JSON.stringify(fs.readdirSync("_data")) === JSON.stringify(["a.txt", "sub"]), "readdir lists sorted immediate names");
  ok(fs.statSync("_data/a.txt").isFile() && fs.statSync("_data").isDirectory(), "stat distinguishes file vs dir");
  ok(fs.statSync("_data/a.txt").size === 5, "stat size is the byte length");
  let threw = false; try { fs.readFileSync("_data/missing"); } catch (e) { threw = e.code === "ENOENT"; }
  ok(threw, "reading a missing file throws ENOENT");
  fs.rmSync("_data", { recursive: true });
  ok(!fs.existsSync("_data/a.txt") && !fs.existsSync("_data/sub/b.bin"), "recursive rm removes the subtree");
  ok(fs.existsSync("out.json"), "rm leaves siblings alone");
  // path helpers agree with the fs keys
  ok(vpath.join("a", "b/c.txt") === "a/b/c.txt" && vpath.dirname("a/b/c.txt") === "a/b" && vpath.basename("a/b/c.txt", ".txt") === "c", "the posix path shim matches");
  ok(normalize("./x/../y/z") === "y/z", "normalize resolves . and ..");
}

// ===== B. the shim carries REAL git object bytes =====
{
  const author = { name: "Origin", email: "origin@example", epoch: 1700000000, tz: "+0000" };
  const r = repo();
  await r.commitFiles([{ path: "README.md", content: "# mine, since T0\n" }, { path: "src/x.txt", content: "x\n" }],
    { author, committer: author, message: "the king's leap", root: true });

  // materialize the loose objects + refs THROUGH the shim, into a virtual ".git"
  const fs = virtualFs();
  for (const f of await looseFiles(r)) fs.writeFileSync(".git/" + f.path, f.bytes);
  for (const f of refFiles(r)) fs.writeFileSync(".git/" + f.path, f.text);
  const shimTree = fs.snapshot();

  // a node:fs materialization of the SAME repo — the shim must match it path-for-path, byte-for-byte
  const dir = mkdtempSync(join(tmpdir(), "nodecompat-"));
  execFileSync("git", ["init", "-q", dir]);
  const nodeTree = {};
  const writeNode = (rel, buf) => { const p = join(dir, ".git", rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, buf); nodeTree[".git/" + rel] = new Uint8Array(buf); };
  for (const f of await looseFiles(r)) writeNode(f.path, Buffer.from(f.bytes));
  for (const f of refFiles(r)) writeNode(f.path, Buffer.from(enc.encode(f.text)));

  const d = diffTrees(shimTree, nodeTree);
  ok(!d.onlyA.length && !d.onlyB.length && !d.changed.length, "shim store == node:fs store, byte-for-byte: " + JSON.stringify(d));

  // and a REAL git reads the history the shim carried
  ok(execFileSync("git", ["-C", dir, "fsck", "--strict"]) !== undefined, "git fsck --strict accepts the shim-carried objects");
  ok(execFileSync("git", ["-C", dir, "log", "--format=%s"]).toString().trim() === "the king's leap", "git reads our commit message back");
  ok(/README\.md/.test(execFileSync("git", ["-C", dir, "ls-tree", "HEAD"]).toString()), "git sees the committed tree");
}

// ===== C. the runner seam is fs-backend-agnostic (virtual tree vs real disk, same action) =====
{
  // a real-shaped action: read a data file, transform deterministically, write an output. Uses only io.fs/io.path.
  const action = async (io) => {
    const items = JSON.parse(io.fs.readFileSync(io.path.join("_data", "items.json"), "utf8"));
    const summary = { count: items.length, ids: items.map((x) => x.id).sort() };
    io.fs.writeFileSync(io.path.join("out", "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  };
  const seed = { "_data/items.json": JSON.stringify([{ id: "b" }, { id: "a" }, { id: "c" }]) };

  // run against the virtual tree
  const { outputs } = await runAction(action, { files: seed });
  const virtualOut = outputs["out/summary.json"];
  ok(virtualOut && JSON.parse(new TextDecoder().decode(virtualOut)).count === 3, "runAction produced the output in the virtual tree");

  // run the SAME action against real node:fs in a temp dir
  const dir = mkdtempSync(join(tmpdir(), "nodecompat-run-"));
  mkdirSync(join(dir, "_data"), { recursive: true });
  writeFileSync(join(dir, "_data/items.json"), seed["_data/items.json"]);
  const nodeIo = {
    path,
    env: {}, argv: [],
    fs: {
      readFileSync: (p, o) => readFileSync(join(dir, p), o),
      writeFileSync: (p, d) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), d); },
      existsSync: (p) => existsSync(join(dir, p)),
      mkdirSync: (p, o) => mkdirSync(join(dir, p), o),
    },
  };
  await action(nodeIo);
  const nodeOut = new Uint8Array(readFileSync(join(dir, "out/summary.json")));
  ok(same(virtualOut, nodeOut), "one action, virtual tree vs real disk -> byte-identical output (the phase-2 promise)");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall node-compat tests passed");
