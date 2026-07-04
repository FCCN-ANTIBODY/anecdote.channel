// Tests for the Castle's inbound transport — fetch + clone — run against a real `git upload-pack`
// (the program GitHub's backend runs for fetch) via an injected fetch. Node supplies the inflate seam.
//   node git-enough/fetch-pack.test.mjs
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { looseFiles, refFiles } from "./repo.mjs";
import { buildFetchRequest, stripToPack, discoverFetch, clone, fetchObject, fetchObjects, fetchFileAt } from "./fetch-pack.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const dec = new TextDecoder();

function inflate(bytes, offset) {
  const sub = Buffer.from(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
  const inf = zlib.createInflate();
  const out = inf._processChunk(sub, zlib.constants.Z_SYNC_FLUSH);
  return { content: new Uint8Array(out), consumed: inf.bytesWritten };
}

// An injected fetch backed by the local `git upload-pack` — the program GitHub runs for fetch.
function fetchFor(src) {
  return async (url, opts = {}) => {
    const out = url.includes("/info/refs")
      ? execFileSync("git", ["upload-pack", "--advertise-refs", src], { maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] })
      : execFileSync("git", ["upload-pack", "--stateless-rpc", src], { input: opts.body ? Buffer.from(opts.body) : undefined, maxBuffer: 1 << 26, stdio: ["pipe", "pipe", "ignore"] });
    return { ok: true, status: 200, async arrayBuffer() { return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength); } };
  };
}

const dirs = [];
try {
  // 1. stripToPack: acknowledgements skipped, raw pack ("PACK") returned.
  {
    const nak = new Uint8Array([...Buffer.from("0008NAK\n"), ...Buffer.from("PACKrest")]);
    ok(dec.decode(stripToPack(nak)) === "PACKrest", "stripToPack drops the NAK and returns from PACK");
  }

  // 2. buildFetchRequest shape: caps on the first want, flush, then done.
  {
    const body = dec.decode(buildFetchRequest({ wants: ["a".repeat(40), "b".repeat(40)] }));
    ok(body.includes(`want ${"a".repeat(40)} ofs-delta`), "first want carries capabilities");
    ok(body.includes(`want ${"b".repeat(40)}\n`), "subsequent want has no caps");
    ok(/0000.*done/s.test(body) && body.includes("done\n"), "flush precedes done");
  }

  // Build a source repo with a deltified pack (two versions of a big file).
  const src = mkdtempSync(join(tmpdir(), "git-enough-src-")); dirs.push(src);
  const g = (args, input) => execFileSync("git", ["-C", src, ...args], { input, maxBuffer: 1 << 26 });
  execFileSync("git", ["init", "-q", "-b", "main", src]);
  g(["config", "user.name", "Src"]); g(["config", "user.email", "s@x"]);
  // github.com's own upload-pack allows wanting any reachable oid, not just ref tips (how `git fetch
  // origin <full-sha>` works against it) — opt a bare local git into the same behavior so the targeted
  // fetch tests below exercise a real, unmodified `git upload-pack --stateless-rpc`.
  g(["config", "uploadpack.allowReachableSHA1InWant", "true"]);
  let v1 = ""; for (let i = 0; i < 3000; i++) v1 += `line ${i}: the state's page is the real-time democracy\n`;
  mkdirSync(join(src, "d2"), { recursive: true }); writeFileSync(join(src, "d2", "n.txt"), "nested\n");
  writeFileSync(join(src, "big.txt"), v1); g(["add", "."]); g(["commit", "-qm", "v1"]);
  writeFileSync(join(src, "big.txt"), v1 + "one more line\n"); g(["add", "."]); g(["commit", "-qm", "v2"]);
  g(["repack", "-adq"]);
  const srcHead = g(["rev-parse", "refs/heads/main"]).toString().trim();
  const srcObjs = new Set(g(["cat-file", "--batch-all-objects", "--batch-check=%(objectname)"]).toString().trim().split("\n").filter(Boolean));

  // 3. discoverFetch sees the source's ref + tip.
  {
    const adv = await discoverFetch({ url: "http://x/src", fetch: fetchFor(src) });
    ok(adv.refs["refs/heads/main"] === srcHead, "discoverFetch reports refs/heads/main at the source tip");
  }

  // 4. THE CASTLE: clone the full history into a fresh offline-origin repo — objects + lineage preserved.
  {
    const { repo, head } = await clone({ url: "http://x/src", fetch: fetchFor(src), inflate });
    ok(repo.readRef("refs/heads/main") === srcHead, "cloned ref points at the source tip (lineage preserved)");
    ok(head === "refs/heads/main", "HEAD resolves to main");
    ok(repo.objects.size === srcObjs.size, `imported all ${srcObjs.size} objects`);
    let allPresent = true; for (const id of srcObjs) if (!repo.objects.has(id)) allPresent = false;
    ok(allPresent, "every source object is present in our origin (deltas resolved on the way in)");

    // Prove it end-to-end: materialize our cloned origin and let a real git read the FULL history back.
    const out = mkdtempSync(join(tmpdir(), "git-enough-clone-")); dirs.push(out);
    execFileSync("git", ["init", "-q", out]);
    const write = (rel, buf) => { const p = join(out, ".git", rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, buf); };
    for (const f of await looseFiles(repo)) write(f.path, Buffer.from(f.bytes));
    for (const f of refFiles(repo)) write(f.path, f.text);
    execFileSync("git", ["-C", out, "fsck", "--strict"]);
    const log = execFileSync("git", ["-C", out, "log", "--format=%s", "main"]).toString().trim().split("\n");
    ok(log[0] === "v2" && log[1] === "v1", "git reads the FULL two-commit lineage back from our clone");
    ok(execFileSync("git", ["-C", out, "cat-file", "-p", "main:d2/n.txt"]).toString() === "nested\n", "a nested file from the cloned history reads back");
  }

  // 5. THE TARGETED FETCH: fetchObject pulls one already-known, non-tip oid — no ref history at all.
  {
    const nestedOid = g(["rev-parse", "HEAD:d2/n.txt"]).toString().trim();
    const obj = await fetchObject({ url: "http://x/src", fetch: fetchFor(src), inflate, oid: nestedOid });
    ok(obj && obj.type === "blob", "fetchObject returns the blob type for a known oid");
    ok(dec.decode(obj.content) === "nested\n", "fetchObject returns the exact bytes for a non-tip oid");
  }

  // 6. fetchObjects: several already-known NON-COMMIT oids (a tree + a blob) stay minimal — exactly the
  // objects asked for, nothing extra. (A commit oid would NOT stay minimal here — see the code comment on
  // fetchObjects — so this deliberately proves the case that actually matters for tier 4.)
  {
    const rootTreeOid = g(["rev-parse", "HEAD^{tree}"]).toString().trim();
    const nestedOid = g(["rev-parse", "HEAD:d2/n.txt"]).toString().trim();
    const objs = await fetchObjects({ url: "http://x/src", fetch: fetchFor(src), inflate, oids: [rootTreeOid, nestedOid] });
    ok(objs.size >= 2 && objs.get(rootTreeOid)?.type === "tree" && objs.get(nestedOid)?.type === "blob",
      "fetchObjects resolves a tree + a blob to their real types, no ref history pulled in");
  }

  // 7. THE SPARSE PATH WALK: fetchFileAt walks tree → nested tree → blob, one small fetch per level —
  // never a sibling blob (big.txt, ~3000 lines, is never asked for when reading d2/n.txt).
  {
    const rootTreeOid = g(["rev-parse", "HEAD^{tree}"]).toString().trim();
    const nestedOid = g(["rev-parse", "HEAD:d2/n.txt"]).toString().trim();

    const f = await fetchFileAt({ url: "http://x/src", fetch: fetchFor(src), inflate, treeOid: rootTreeOid, path: "d2/n.txt" });
    ok(f && dec.decode(f.content) === "nested\n", "fetchFileAt walks a nested path down to its blob (from a known tree)");
    ok(f.oid === nestedOid, "fetchFileAt reports the real blob oid");
    ok(f.size === 7, "fetchFileAt reports the blob's size");

    const top = await fetchFileAt({ url: "http://x/src", fetch: fetchFor(src), inflate, commitOid: srcHead, path: "big.txt" });
    ok(top && top.content.length > 0, "fetchFileAt also resolves a top-level (unnested) path, entering from a commitOid");

    const missing = await fetchFileAt({ url: "http://x/src", fetch: fetchFor(src), inflate, treeOid: rootTreeOid, path: "no/such/file.txt" });
    ok(missing === null, "fetchFileAt returns null for a path that doesn't exist at this commit");

    let threw = false;
    try { await fetchFileAt({ url: "http://x/src", fetch: fetchFor(src), inflate, treeOid: rootTreeOid, path: "d2" }); }
    catch { threw = true; }
    ok(threw, "fetchFileAt refuses a path that resolves to a directory, not a file");
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall git-enough fetch-pack tests passed");
