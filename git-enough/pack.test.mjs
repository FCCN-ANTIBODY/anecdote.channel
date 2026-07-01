// Tests for v2 packfiles (phase 2) — our pack INGESTED by a real `git`. Proves index-pack accepts it,
// its checksum matches, verify-pack lists our objects, and cat-file reads them back after install.
//   node git-enough/pack.test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repo } from "./repo.mjs";
import { packObjects, packRepo, packChecksum, objHeader } from "./pack.mjs";
import { blob } from "./objects.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const you = { name: "You", email: "you@origin", epoch: 1700000000, tz: "+0000" };
const dirs = [];
function tmpRepo() { const d = mkdtempSync(join(tmpdir(), "git-enough-pack-")); execFileSync("git", ["init", "-q", d]); dirs.push(d); return d; }
const gitIn = (d, args, input) => execFileSync("git", ["-C", d, ...args], { input, maxBuffer: 1 << 24 });

try {
  // 1. objHeader varint: known encodings (type in bits 6-4, size split 4 then 7-bit groups).
  {
    ok([...objHeader(3, 0)].join() === String(0x30), "blob size 0 → single byte 0x30");
    ok([...objHeader(3, 15)].join() === String(0x3f), "blob size 15 → 0x3f (fits the low nibble)");
    // size 16 = 0b10000 → low nibble 0, then 1 → [0x30|0x80, 0x01]
    ok([...objHeader(3, 16)].join() === [0xb0, 0x01].join(), "blob size 16 → continuation + 0x01");
  }

  // 2. A full closure (blobs + tree + commit) packs, and `git index-pack --stdin` installs it; our
  //    computed checksum equals git's reported pack sha.
  {
    const r = repo();
    const commitOid = await r.commitFiles([
      { path: "a.txt", content: "alpha\n" },
      { path: "dir/b.txt", content: "beta\n" },
    ], { author: you, message: "pack me\n" });
    const pack = await packRepo(r);

    const d = tmpRepo();
    // `git index-pack --stdin` prints "pack\t<sha>" on success
    const reported = gitIn(d, ["index-pack", "--stdin"], Buffer.from(pack)).toString().trim().split(/\s+/).pop();
    ok(/^[0-9a-f]{40}$/.test(reported), "git index-pack accepted our pack and returned a sha");
    ok(reported === packChecksum(pack), "git's pack sha equals our trailer checksum");

    // the objects are now installed — read them back
    ok(gitIn(d, ["cat-file", "-p", `${commitOid}:a.txt`]).toString() === "alpha\n", "installed pack: a.txt reads back");
    ok(gitIn(d, ["cat-file", "-p", `${commitOid}:dir/b.txt`]).toString() === "beta\n", "installed pack: nested dir/b.txt reads back");
    ok(gitIn(d, ["cat-file", "-t", commitOid]).toString().trim() === "commit", "the commit object is a commit");

    // verify-pack lists our objects by oid
    const idx = readdirSync(join(d, ".git", "objects", "pack")).find((f) => f.endsWith(".idx"));
    const listed = gitIn(d, ["verify-pack", "-v", join(d, ".git", "objects", "pack", idx)]).toString();
    ok(listed.includes(commitOid), "verify-pack lists our commit oid");
  }

  // 3. A single-blob pack round-trips via unpack-objects.
  {
    const b = await blob("just one blob\n");
    const pack = await packObjects([{ type: b.type, content: b.content }]);
    const d = tmpRepo();
    gitIn(d, ["unpack-objects"], Buffer.from(pack));   // explode into loose objects
    ok(gitIn(d, ["cat-file", "-p", b.oid]).toString() === "just one blob\n", "unpack-objects restores the blob content");
    ok(gitIn(d, ["cat-file", "-t", b.oid]).toString().trim() === "blob", "…as a blob");
  }

  // 4. The header advertises the right object count.
  {
    const r = repo();
    await r.commitFiles([{ path: "f", content: "x\n" }], { author: you, message: "m\n" });
    const pack = await packRepo(r);   // blob + tree + commit = 3 objects
    const magic = new TextDecoder().decode(pack.subarray(0, 4));
    const count = new DataView(pack.buffer, pack.byteOffset, pack.byteLength).getUint32(8, false);
    ok(magic === "PACK", "header magic is 'PACK'");
    ok(count === 3, "header object count is 3 (blob + tree + commit)");
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall git-enough pack tests passed");
