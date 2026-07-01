// Integration: git-enough vended over the probe line, mediated by the consent gate. Read ops (Rung 0)
// auto-run; commit/push/clone (Rung 1) need a confirm (or a covering grant); a cancel abandons a commit
// atomically. push/clone go through a real local `git` via an injected fetch. Run: node git-enough/probe-ops.test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { elevatedSession, request, cancel, FRAME, ERROR, CANCELLED } from "../composer/probe-line.mjs";
import { repo } from "./repo.mjs";
import { gitOps } from "./probe-ops.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const author = { name: "You", email: "you@origin", epoch: 1700000000, tz: "+0000" };
const CTX = { recordingOn: true, grants: [] };
const dirs = [];
const bare = () => { const d = mkdtempSync(join(tmpdir(), "git-po-bare-")); execFileSync("git", ["init", "-q", "--bare", d]); dirs.push(d); return d; };
const gitq = (d, a, input) => execFileSync("git", ["-C", d, ...a], { input, maxBuffer: 1 << 26, stdio: ["pipe", "pipe", "ignore"] });

// Injected fetch backed by local git (receive-pack for push, upload-pack for clone).
function fetchTo(dir, service) {
  const prog = service === "receive" ? "receive-pack" : "upload-pack";
  return async (url, opts = {}) => {
    const out = url.includes("/info/refs")
      ? execFileSync("git", [prog, "--advertise-refs", dir], { maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] })
      : execFileSync("git", [prog, "--stateless-rpc", dir], { input: opts.body ? Buffer.from(opts.body) : undefined, maxBuffer: 1 << 26, stdio: ["pipe", "pipe", "ignore"] });
    return { ok: true, status: 200, async arrayBuffer() { return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength); } };
  };
}
function session(origin, deps = {}, yield_) {
  const frames = [];
  const s = elevatedSession({ ops: gitOps({ repo: origin, author, ...deps }), emit: (f) => frames.push(f), context: () => (deps.ctx || CTX), yield_ });
  return { s, frames };
}
const immediate = () => Promise.resolve();

try {
  // 1. Rung 0 — read ops auto-run, no confirm.
  {
    const origin = repo();
    await origin.commitFiles([{ path: "a.txt", content: "alpha\n" }, { path: "d/b.txt", content: "beta\n" }], { author, message: "first\n" });
    const { s, frames } = session(origin, {}, immediate);
    await s.handle(request({ id: "L", op: "git.log", input: {} }));
    await s.handle(request({ id: "F", op: "git.files", input: {} }));
    const log = frames.find((f) => f.type === FRAME && f.id === "L" && f.log);
    const files = frames.find((f) => f.type === FRAME && f.id === "F" && f.files);
    ok(log && log.log[0].message === "first", "git.log (Rung 0) returns history with no consent prompt");
    ok(files && files.files.map((x) => x.path).join(",") === "a.txt,d/b.txt", "git.files (Rung 0) lists the tree");
  }

  // 2. Rung 1 — git.commit refused without a confirm; confirmed it persists.
  {
    const origin = repo();
    const { s, frames } = session(origin, {}, immediate);
    await s.handle(request({ id: "C", op: "git.commit", input: { files: [{ path: "x", content: "1\n" }], message: "m\n" } }));
    ok(frames.find((f) => f.type === ERROR && f.needsConfirm), "unconfirmed git.commit → needsConfirm");
    ok(!origin.readRef("refs/heads/main"), "…nothing committed");

    await s.handle(request({ id: "C2", op: "git.commit", confirmed: true, input: { files: [{ path: "x", content: "1\n" }], message: "m\n" } }));
    const done = frames.find((f) => f.type === FRAME && f.id === "C2" && f.commit);
    ok(done && origin.readRef("refs/heads/main") === done.commit, "confirmed git.commit persists and advances the ref");
  }

  // 3. Atomicity — cancel before the commit's yield leaves nothing written.
  {
    const origin = repo();
    const waiters = []; const yield_ = () => new Promise((r) => waiters.push(r));
    const step = async () => { const w = waiters.shift(); if (w) w(); await new Promise((r) => setTimeout(r, 0)); };
    const { s, frames } = session(origin, {}, yield_);
    const p = s.handle(request({ id: "C", op: "git.commit", confirmed: true, input: { files: [{ path: "x", content: "1\n" }], message: "m\n" } }));
    s.handle(cancel({ id: "C" }));
    await step(); await p;
    ok(frames.some((f) => f.type === CANCELLED), "git.commit cancelled emits CANCELLED");
    ok(origin.objects.size === 0 && !origin.readRef("refs/heads/main"), "…and nothing was written (atomic)");
  }

  // 4. Rung 1 — git.push publishes to a downstream (real local git receive-pack via injected fetch).
  {
    const origin = repo();
    const tip = await origin.commitFiles([{ path: "readme", content: "hi\n" }], { author, message: "pub\n" });
    const target = bare();
    const { s, frames } = session(origin, { fetch: fetchTo(target, "receive") }, immediate);
    await s.handle(request({ id: "P", op: "git.push", confirmed: true, input: { url: "http://x/repo" } }));
    const rep = frames.find((f) => f.type === FRAME && f.id === "P");
    ok(rep && rep.pushed, "git.push reports pushed:true");
    ok(gitq(target, ["rev-parse", "refs/heads/main"]).toString().trim() === tip, "the downstream ref advanced to our tip");
  }

  // 5. Rung 1 — git.clone imports a downstream's history into our origin (the Castle).
  {
    const src = mkdtempSync(join(tmpdir(), "git-po-src-")); dirs.push(src);
    execFileSync("git", ["init", "-q", "-b", "main", src]);
    gitq(src, ["config", "user.name", "S"]); gitq(src, ["config", "user.email", "s@x"]);
    writeFileSync(join(src, "hello.txt"), "from the source\n"); gitq(src, ["add", "."]); gitq(src, ["commit", "-qm", "seed"]);
    const srcTip = gitq(src, ["rev-parse", "refs/heads/main"]).toString().trim();

    const origin = repo();
    const { s, frames } = session(origin, { fetch: fetchTo(src, "upload") }, immediate);
    await s.handle(request({ id: "K", op: "git.clone", confirmed: true, input: { url: "http://x/src" } }));
    const rep = frames.find((f) => f.type === FRAME && f.id === "K");
    ok(rep && rep.imported >= 3, "git.clone reports objects imported");
    ok(origin.readRef("refs/heads/main") === srcTip, "our origin's ref now points at the cloned source tip");
  }
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall git probe-ops tests passed");
