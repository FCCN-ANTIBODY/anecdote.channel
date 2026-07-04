// Tests for viewer/materialize.mjs — the path-keyed cache for files pulled out of a remote index.
// Run: node viewer/materialize.test.mjs
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryStore } from "../reducer/store.mjs";
import { materializedStore, hydrateFile, asText } from "./materialize.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

function inflate(bytes, offset) {
  const sub = Buffer.from(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
  const inf = zlib.createInflate();
  const out = inf._processChunk(sub, zlib.constants.Z_SYNC_FLUSH);
  return { content: new Uint8Array(out), consumed: inf.bytesWritten };
}

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
  const src = mkdtempSync(join(tmpdir(), "git-enough-materialize-")); dirs.push(src);
  const g = (args) => execFileSync("git", ["-C", src, ...args], { maxBuffer: 1 << 26 });
  execFileSync("git", ["init", "-q", "-b", "main", src]);
  g(["config", "user.name", "Src"]); g(["config", "user.email", "s@x"]);
  g(["config", "uploadpack.allowReachableSHA1InWant", "true"]);
  writeFileSync(join(src, "listing.json"), '{"v":1}\n');
  g(["add", "."]); g(["commit", "-qm", "v1"]);
  const tip1 = g(["rev-parse", "main"]).toString().trim();
  const tree1 = g(["rev-parse", "main^{tree}"]).toString().trim();
  const oid1 = g(["rev-parse", "main:listing.json"]).toString().trim();

  const url = "http://x/src", fetch = fetchFor(src);
  const materialized = materializedStore(memoryStore());

  // 1. A cold cache misses, fetches over the wire, and caches the result under the stable address.
  {
    const r = await hydrateFile(materialized, { url, fetch, inflate, label: "cd04-atlas", path: "listing.json", treeOid: tree1, current: { oid: oid1, tip: tip1 } });
    ok(r && !r.fromCache, "cold cache: fetched fresh, not served from cache");
    ok(asText(r) === '{"v":1}\n', "hydrateFile returns the real file content");
  }

  // 2. Re-hydrating with the SAME current oid hits the cache — no fetch() call at all.
  {
    let calls = 0;
    const countingFetch = async (...a) => { calls++; return fetch(...a); };
    const r = await hydrateFile(materialized, { url, fetch: countingFetch, inflate, label: "cd04-atlas", path: "listing.json", treeOid: tree1, current: { oid: oid1, tip: tip1 } });
    ok(r && r.fromCache, "same oid: served from cache");
    ok(calls === 0, "same oid: no network fetch happened at all");
  }

  // 3. Direct get(): the record is retrievable without going through hydrateFile again.
  {
    const r = await materialized.get("cd04-atlas", "listing.json");
    ok(r && r.oid === oid1 && asText(r) === '{"v":1}\n', "materializedStore.get reads back the cached record directly");
  }

  // 4. The checkout advances — a new commit changes listing.json's oid. hydrateFile with the NEW current
  // oid must miss the stale cache entry and refetch, overwriting the same stable address (no key churn).
  writeFileSync(join(src, "listing.json"), '{"v":2}\n');
  g(["add", "."]); g(["commit", "-qm", "v2"]);
  const tip2 = g(["rev-parse", "main"]).toString().trim();
  const tree2 = g(["rev-parse", "main^{tree}"]).toString().trim();
  const oid2 = g(["rev-parse", "main:listing.json"]).toString().trim();
  ok(oid2 !== oid1, "sanity: the new commit really did change the file's oid");
  {
    const r = await hydrateFile(materialized, { url, fetch, inflate, label: "cd04-atlas", path: "listing.json", treeOid: tree2, current: { oid: oid2, tip: tip2 } });
    ok(r && !r.fromCache, "checkout advanced: stale cache entry is not reused");
    ok(asText(r) === '{"v":2}\n', "the fresh fetch returns the new content");
    const stored = await materialized.get("cd04-atlas", "listing.json");
    ok(stored.oid === oid2 && stored.tip === tip2, "the SAME stable address now holds the new generation, in place");
  }

  // 5. Different pile labels never collide even at the same path.
  {
    const r = await hydrateFile(materialized, { url, fetch, inflate, label: "another-atlas", path: "listing.json", treeOid: tree2, current: { oid: oid2, tip: tip2 } });
    ok(r && !r.fromCache, "a different label is a cache miss even for the same path/oid");
    const a = await materialized.get("cd04-atlas", "listing.json");
    const b = await materialized.get("another-atlas", "listing.json");
    ok(a.oid === b.oid && a !== b, "two labels hold independent records that happen to agree on content");
  }

  // 6. delete() removes exactly one label's record.
  {
    await materialized.delete("cd04-atlas", "listing.json");
    ok((await materialized.get("cd04-atlas", "listing.json")) === null, "delete removes the record");
    ok((await materialized.get("another-atlas", "listing.json")) !== null, "delete doesn't touch a different label's record");
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall materialize tests passed");
