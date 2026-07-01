// Tests for the browser-native byte-accurate inflate. Proves it finds exact member boundaries and that
// the Castle reads a real deltified git pack with NO inflate seam injected (the browser path — run here
// in Node, where DecompressionStream is the same primitive). Run: node git-enough/inflate.test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflate } from "./inflate.mjs";
import { readPack } from "./unpack.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const eqBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

async function deflate(bytes) {
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer();
  return new Uint8Array(buf);
}

const dirs = [];
try {
  // 1. Exact member length + content, even with trailing bytes after the member.
  {
    const src = new Uint8Array([...Buffer.from("the state's page is the real-time democracy\n".repeat(20))]);
    const member = await deflate(src);
    const withTrailer = new Uint8Array([...member, 7, 7, 7, 7, 7]);   // next object's bytes
    const { content, consumed } = await inflate(withTrailer, 0);
    ok(eqBytes(content, src), "inflate returns the exact member content");
    ok(consumed === member.length, `consumed == member length (${consumed}), trailing bytes ignored`);
  }

  // 2. Works at a non-zero offset (a member preceded by other bytes).
  {
    const src = new Uint8Array([...Buffer.from("hello\n")]);
    const member = await deflate(src);
    const buf = new Uint8Array([9, 9, 9, ...member, 1, 2]);
    const { content, consumed } = await inflate(buf, 3);
    ok(eqBytes(content, src) && consumed === member.length, "inflate honours the offset and boundary");
  }

  // 3. Tiny and larger members both resolve (gallop + binary-search paths).
  {
    for (const s of ["x", "y".repeat(5000)]) {
      const src = new Uint8Array([...Buffer.from(s)]);
      const member = await deflate(src);
      const { content, consumed } = await inflate(new Uint8Array([...member, 0, 0]), 0);
      ok(eqBytes(content, src) && consumed === member.length, `member of ${s.length} byte(s) resolves`);
    }
  }

  // 4. THE POINT: read a real DELTIFIED git pack with the native inflate as the default (no seam passed).
  {
    const d = mkdtempSync(join(tmpdir(), "git-enough-inflate-")); dirs.push(d);
    const git = (args) => execFileSync("git", ["-C", d, ...args], { maxBuffer: 1 << 26 });
    execFileSync("git", ["init", "-q", d]);
    git(["config", "user.name", "T"]); git(["config", "user.email", "t@x"]);
    let v1 = ""; for (let i = 0; i < 3000; i++) v1 += `line ${i}: reading glasses for the city\n`;
    writeFileSync(join(d, "big.txt"), v1); git(["add", "."]); git(["commit", "-qm", "v1"]);
    writeFileSync(join(d, "big.txt"), v1 + "one more\n"); git(["add", "."]); git(["commit", "-qm", "v2"]);
    git(["repack", "-adq"]);
    const packDir = join(d, ".git", "objects", "pack");
    const packBytes = new Uint8Array(execFileSync("cat", [join(packDir, readdirSync(packDir).find((f) => f.endsWith(".pack")))], { maxBuffer: 1 << 26 }));

    const { objects } = await readPack(packBytes);   // <-- no { inflate } — uses the native default
    const listed = git(["cat-file", "--batch-all-objects", "--batch-check=%(objectname) %(objecttype)"]).toString().trim().split("\n").filter(Boolean);
    ok(objects.size === listed.length, `native inflate read all ${listed.length} objects`);
    let allOk = true;
    for (const line of listed) {
      const [id, type] = line.split(" ");
      const got = objects.get(id);
      const want = new Uint8Array(execFileSync("git", ["-C", d, "cat-file", type, id], { maxBuffer: 1 << 26 }));
      if (!got || got.type !== type || !eqBytes(got.content, want)) allOk = false;
    }
    ok(allOk, "every object matches git cat-file — deltas resolved with the browser-native inflate");
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall git-enough inflate tests passed");
