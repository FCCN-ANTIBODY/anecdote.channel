// Tests for reading packfiles (the Castle read-side). Round-trips our own pack, and — the real proof —
// reads a DELTIFIED pack produced by a real `git`, reconstructing every object with an oid + content that
// matches `git cat-file`. Node supplies the byte-accurate inflate seam. Run: node git-enough/unpack.test.mjs
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repo } from "./repo.mjs";
import { packRepo } from "./pack.mjs";
import { readPack, readObjHeader, applyDelta } from "./unpack.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const eqBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Byte-accurate inflate via Node: _processChunk reports consumed input as bytesWritten (probed earlier).
function inflate(bytes, offset) {
  const sub = Buffer.from(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
  const inf = zlib.createInflate();
  const out = inf._processChunk(sub, zlib.constants.Z_SYNC_FLUSH);
  return { content: new Uint8Array(out), consumed: inf.bytesWritten };
}

const dirs = [];
try {
  // 1. Round-trip: our own (base-only) pack reads back to exactly the objects we packed.
  {
    const r = repo();
    await r.commitFiles([{ path: "a.txt", content: "alpha\n" }, { path: "dir/b.txt", content: "beta\n" }],
      { author: { name: "You", email: "you@o", epoch: 1700000000, tz: "+0000" }, message: "m\n" });
    const { objects, count } = await readPack(await packRepo(r), { inflate });
    ok(count === r.objects.size && objects.size === r.objects.size, "read back the same object count");
    let allMatch = true;
    for (const [id, o] of r.objects) {
      const got = objects.get(id);
      if (!got || got.type !== o.type || !eqBytes(got.content, o.content)) allMatch = false;
    }
    ok(allMatch, "every packed object round-trips (oid + type + content)");
  }

  // 2. applyDelta: a hand-built copy+insert delta reconstructs the target.
  {
    const base = new Uint8Array([...Buffer.from("Hello, world!")]);          // 13 bytes
    // delta: srcSize=13, dstSize=18; copy base[0..5] ("Hello,"), insert " there", copy base[6..7] (" w")… keep simple:
    // target = "Hello," + " git!" = copy[0..6] + insert " git!"
    const delta = new Uint8Array([13, 11, 0x90, 6, 5, 0x20, 0x67, 0x69, 0x74, 0x21]);
    // ^ src=13, dst=11; copy op 0x90 (offset byte + size byte) offset=0 size=6 → "Hello,"; insert op 5 → " git!"
    const out = applyDelta(base, delta);
    ok(Buffer.from(out).toString() === "Hello, git!", "applyDelta copy+insert reconstructs the target");
  }

  // 3. readObjHeader parses a known type/size varint (blob, size 16 → bytes b0 01).
  {
    const h = readObjHeader(new Uint8Array([0xb0, 0x01, 0xff]), 0);
    ok(h.type === 3 && h.size === 16 && h.off === 2, "readObjHeader: blob, size 16, 2-byte header");
  }

  // 4. THE REAL PROOF: read a deltified pack from a real git repo and match every object to `git cat-file`.
  {
    const d = mkdtempSync(join(tmpdir(), "git-enough-unpack-")); dirs.push(d);
    const git = (args, input) => execFileSync("git", ["-C", d, ...args], { input, maxBuffer: 1 << 26 });
    execFileSync("git", ["init", "-q", d]);
    git(["config", "user.name", "T"]); git(["config", "user.email", "t@x"]);
    let v1 = ""; for (let i = 0; i < 3000; i++) v1 += `line ${i}: the park needs more shade\n`;
    writeFileSync(join(d, "big.txt"), v1); git(["add", "."]); git(["commit", "-qm", "v1"]);
    writeFileSync(join(d, "big.txt"), v1 + "one more line at the very end\n"); git(["add", "."]); git(["commit", "-qm", "v2"]);
    git(["repack", "-adq"]);   // pack everything into one deltified pack

    const packDir = join(d, ".git", "objects", "pack");
    const packName = readdirSync(packDir).find((f) => f.endsWith(".pack"));
    const idxName = readdirSync(packDir).find((f) => f.endsWith(".idx"));
    const verify = execFileSync("git", ["verify-pack", "-v", join(packDir, idxName)], { maxBuffer: 1 << 26 }).toString();
    const hasDelta = verify.split("\n").some((l) => (l.match(/\b[0-9a-f]{40}\b/g) || []).length >= 2);
    ok(hasDelta, "the git pack actually contains at least one delta (so we're testing delta resolution)");

    const packBytes = new Uint8Array(execFileSync("cat", [join(packDir, packName)], { maxBuffer: 1 << 26 }));
    const { objects } = await readPack(packBytes, { inflate });

    // enumerate every object git knows and compare oid → (type, raw content)
    const listed = git(["cat-file", "--batch-all-objects", "--batch-check=%(objectname) %(objecttype)"])
      .toString().trim().split("\n").filter(Boolean);
    ok(objects.size === listed.length, `reconstructed all ${listed.length} objects from the pack`);
    let allOk = true, checkedBlob = false;
    for (const line of listed) {
      const [id, type] = line.split(" ");
      const got = objects.get(id);
      const want = new Uint8Array(git(["cat-file", type, id]));
      if (!got || got.type !== type || !eqBytes(got.content, want)) { allOk = false; console.error("  mismatch:", id, type); }
      if (type === "blob") checkedBlob = true;
    }
    ok(allOk, "every object matches git cat-file (type + exact content) — deltas resolved correctly");
    ok(checkedBlob, "…including the deltified blob(s)");
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall git-enough unpack tests passed");
