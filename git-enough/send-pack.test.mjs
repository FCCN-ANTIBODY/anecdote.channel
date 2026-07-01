// Tests for smart-HTTP send-pack (phase 3). The FULL push path — discover, pack, send, parse report — is
// run against a real `git receive-pack` (the exact program GitHub's HTTP backend runs) via an injected
// fetch; only the literal network socket is left for a live push. Run: node git-enough/send-pack.test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repo } from "./repo.mjs";
import { pktLine, FLUSH, parsePktLines, parseAdvertisement, parseReportStatus, buildReceivePackRequest, discover, publish } from "./send-pack.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const dec = new TextDecoder();

const you = { name: "You", email: "you@origin", epoch: 1700000000, tz: "+0000" };
const dirs = [];
function bareRepo() { const d = mkdtempSync(join(tmpdir(), "git-enough-remote-")); execFileSync("git", ["init", "-q", "--bare", d]); dirs.push(d); return d; }
const revParse = (bare, ref) => { try { return execFileSync("git", ["--git-dir", bare, "rev-parse", ref], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return null; } };

// An injected fetch backed by the local `git receive-pack` — the same program GitHub runs behind the
// smart-HTTP endpoints. GET → advertise-refs; POST → process the request from stdin.
function fetchFor(bare) {
  return async (url, opts = {}) => {
    const out = url.includes("/info/refs")
      ? execFileSync("git", ["receive-pack", "--advertise-refs", bare], { maxBuffer: 1 << 24 })
      : execFileSync("git", ["receive-pack", "--stateless-rpc", bare], { input: opts.body ? Buffer.from(opts.body) : undefined, maxBuffer: 1 << 24 });
    return { ok: true, status: 200, async arrayBuffer() { return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength); } };
  };
}

try {
  // 1. pkt-line framing: known vectors + round-trip + flush.
  {
    ok(dec.decode(pktLine("a")) === "0005a", "pktLine('a') → 0005a");
    ok(dec.decode(pktLine("hi\n")) === "0007hi\n", "pktLine('hi\\n') → 0007hi\\n");
    ok(dec.decode(FLUSH) === "0000", "flush-pkt is 0000");
    const parsed = parsePktLines(new Uint8Array([...pktLine("one\n"), ...pktLine("two\n"), ...FLUSH]));
    ok(parsed.length === 3 && dec.decode(parsed[0].payload) === "one\n" && parsed[2].flush, "parsePktLines round-trips two lines + flush");
  }

  // 2. An empty bare repo advertises no refs; discover() sees that.
  {
    const bare = bareRepo();
    const adv = await discover({ url: "http://x/repo", fetch: fetchFor(bare) });
    ok(Object.keys(adv.refs).length === 0, "empty repo: no refs advertised");
    ok(adv.capabilities.length > 0, "…but capabilities are advertised (report-status etc.)");
  }

  // 3. CREATE: publish into an empty repo; the ref is created at our tip.
  {
    const bare = bareRepo();
    const r = repo();
    const tip = await r.commitFiles([{ path: "a.txt", content: "alpha\n" }, { path: "dir/b.txt", content: "beta\n" }],
      { author: you, message: "publish: create\n" });
    const { report } = await publish(r, { url: "http://x/repo", fetch: fetchFor(bare) });
    ok(report.ok && report.unpack === "ok", "create push reported unpack ok + ref ok");
    ok(revParse(bare, "refs/heads/main") === tip, "the downstream ref now points at our commit");
    ok(execFileSync("git", ["--git-dir", bare, "cat-file", "-p", `${tip}:dir/b.txt`]).toString() === "beta\n",
       "the downstream serves our nested file content");
  }

  // 4. FAST-FORWARD: a second commit on top; publish advances the downstream ref.
  {
    const bare = bareRepo();
    const r = repo();
    await r.commitFiles([{ path: "a.txt", content: "one\n" }], { author: you, message: "c1\n" });
    await publish(r, { url: "http://x/repo", fetch: fetchFor(bare) });
    const tip2 = await r.commitFiles([{ path: "a.txt", content: "two\n" }], { author: you, message: "c2\n" });
    const { report } = await publish(r, { url: "http://x/repo", fetch: fetchFor(bare) });
    ok(report.ok, "fast-forward push reported ok");
    ok(revParse(bare, "refs/heads/main") === tip2, "downstream fast-forwarded to the new tip");
  }

  // 5. THE KING'S LEAP: replace the downstream's history with a fresh, unrelated root (non-fast-forward).
  {
    const bare = bareRepo();
    const original = repo();
    await original.commitFiles([{ path: "old.txt", content: "the old kingdom\n" }], { author: you, message: "old\n" });
    await publish(original, { url: "http://x/repo", fetch: fetchFor(bare) });

    const leap = repo();
    const root = await leap.commitFiles([{ path: "index.html", content: "<h1>new ground</h1>\n" }],
      { author: you, message: "import: King's Leap\n", root: true });
    const { report } = await publish(leap, { url: "http://x/repo", fetch: fetchFor(bare) });
    ok(report.ok, "the non-fast-forward replace was accepted (downstream allows force)");
    ok(revParse(bare, "refs/heads/main") === root, "downstream now points at the fresh root — history replaced");
    ok(execFileSync("git", ["--git-dir", bare, "rev-list", "--count", "main"]).toString().trim() === "1",
       "downstream carries a single commit — the leap, not the old lineage");
  }

  // 6. buildReceivePackRequest shape: create command carries caps after a NUL; body ends with flush+pack.
  {
    const body = buildReceivePackRequest({ updates: [{ old: "0".repeat(40), new: "f".repeat(40), ref: "refs/heads/main" }],
      pack: new Uint8Array([80, 65, 67, 75]), capabilities: ["report-status"] });
    const text = dec.decode(body);
    ok(text.includes("refs/heads/main\0report-status"), "first command carries capabilities after a NUL");
    ok(text.includes("0000PACK"), "flush-pkt precedes the packfile");
  }

  // 7. parseReportStatus on a hand-built report.
  {
    const report = new Uint8Array([...pktLine("unpack ok\n"), ...pktLine("ok refs/heads/main\n"), ...FLUSH]);
    const r = parseReportStatus(report);
    ok(r.ok && r.unpack === "ok" && r.refs["refs/heads/main"].ok, "parseReportStatus reads unpack ok + ref ok");
    const ng = parseReportStatus(new Uint8Array([...pktLine("unpack ok\n"), ...pktLine("ng refs/heads/main non-fast-forward\n"), ...FLUSH]));
    ok(!ng.ok && ng.refs["refs/heads/main"].error === "non-fast-forward", "parseReportStatus captures an ng rejection + reason");
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall git-enough send-pack tests passed");
