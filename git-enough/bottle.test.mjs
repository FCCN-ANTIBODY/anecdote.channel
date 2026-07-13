// Unit: git-enough/bottle.mjs — the git bottle vends git-enough over the probe line, gated by the consent
// ladder. Rung-0 reads flow with no prompt; a Rung-1 commit needs a fresh confirmation, persists, and the
// log/files read it back; an unconfirmed Rung-1 op and an unknown op are refused (and write nothing).
// Run: node git-enough/bottle.test.mjs
import { gitBottleSession, serveOnHello } from "./bottle.mjs";
import { repo } from "./repo.mjs";
import { request } from "../composer/probe-line.mjs";
import { mintBottleAttestation } from "../composer/bottle-attest.mjs";
import { bottleUrl } from "../composer/bottle-uri.mjs";
import { generateIdentity } from "../composer/sign.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const AUTHOR = { name: "tester", email: "t@example", epoch: 1700000000, tz: "+0000" };

async function run() {
  const r = repo();
  const frames = [];
  const session = gitBottleSession({ repo: r, author: AUTHOR, emit: (f) => frames.push(f) });
  const drive = async (msg) => { frames.length = 0; await session.handle(msg); return frames.slice(); };

  // 1. Rung-1 commit with a fresh confirmation persists and returns the oid.
  let out = await drive(request({ id: "c1", op: "git.commit", confirmed: true,
    input: { files: [{ path: "a.txt", content: "hi\n" }], message: "first\n", ref: "refs/heads/main", root: true } }));
  const final1 = out.find((f) => f.final);
  ok(final1 && !final1.reason, "git.commit (confirmed) ran to a clean final frame");
  const committed = out.find((f) => f.commit);
  ok(committed && /^[0-9a-f]{40}$/.test(committed.commit), "git.commit emitted a commit oid: " + (committed && committed.commit));

  // 2. Rung-0 git.log reads the commit back with no confirmation, no prompt.
  out = await drive(request({ id: "l1", op: "git.log" }));
  const logFrame = out.find((f) => f.log);
  ok(logFrame && logFrame.log.length === 1 && logFrame.log[0].message === "first", "git.log returns the one commit: " + JSON.stringify(logFrame && logFrame.log));

  // 3. Rung-0 git.files lists the tree at HEAD.
  out = await drive(request({ id: "f1", op: "git.files" }));
  const filesFrame = out.find((f) => f.files);
  ok(filesFrame && filesFrame.files.some((x) => x.path === "a.txt"), "git.files lists a.txt: " + JSON.stringify(filesFrame && filesFrame.files));

  // 4. A Rung-1 commit WITHOUT a confirmation (and no standing grant) is refused — and writes nothing.
  out = await drive(request({ id: "c2", op: "git.commit",
    input: { files: [{ path: "b.txt", content: "no\n" }], message: "second\n", ref: "refs/heads/main" } }));
  const refused = out.find((f) => f.reason);
  ok(refused && refused.needsConfirm, "unconfirmed git.commit is refused (needsConfirm): " + JSON.stringify(refused));
  out = await drive(request({ id: "l2", op: "git.log" }));
  ok(out.find((f) => f.log).log.length === 1, "the refused commit persisted nothing (log still one)");

  // 5. An unknown op is refused (fail-safe: no such op).
  out = await drive(request({ id: "u1", op: "git.nope", confirmed: true }));
  ok(out.some((f) => f.reason && /no such op/.test(f.reason)), "unknown op refused: " + JSON.stringify(out.map((f) => f.reason).filter(Boolean)));

  // 6. THE BOOT GATE — serveOnHello proves the bottle's own domain-anchored attestation before it offers
  //    anything. Valid for its own host + the pinned key → READY announced; wrong host / wrong key / no
  //    attestation → it offers nothing (no READY ever posted).
  const READY = "probe.line.ready/v1";
  const fakeWin = (hostFull) => {
    const win = { location: { host: hostFull }, posted: [], _l: [] };
    win.parent = { postMessage: (m) => win.posted.push(m) };
    win.addEventListener = (t, fn) => { if (t === "message") win._l.push(fn); };
    win.removeEventListener = () => {};
    return win;
  };
  const readyPosted = (win) => win.posted.some((m) => m && m.type === READY);
  {
    const platform = await generateIdentity();
    const B = bottleUrl({ label: "cd04-q1", storage: "tell" }); // → host "cd04-q1.tell.anecdote.channel"
    const att = await mintBottleAttestation(B, platform, { now: "2026-01-01T00:00:00Z" });

    let win = fakeWin("cd04-q1.tell.anecdote.channel");
    let res = await serveOnHello({ repo: repo(), author: AUTHOR, attestation: att, platformKey: platform.fingerprint, self: win });
    ok(res.ok && readyPosted(win), "boot gate opens for a valid attestation on its own host — READY announced");

    win = fakeWin("scratch7.bottles.anecdote.channel");
    res = await serveOnHello({ repo: repo(), author: AUTHOR, attestation: att, platformKey: platform.fingerprint, self: win });
    ok(!res.ok && /domain anchor/.test(res.reason) && !readyPosted(win), "served on the wrong host → offers nothing (no READY)");

    const impostor = await generateIdentity();
    win = fakeWin("cd04-q1.tell.anecdote.channel");
    res = await serveOnHello({ repo: repo(), author: AUTHOR, attestation: att, platformKey: impostor.fingerprint, self: win });
    ok(!res.ok && !readyPosted(win), "attestation not under the pinned platform key → offers nothing");

    win = fakeWin("cd04-q1.tell.anecdote.channel");
    res = await serveOnHello({ repo: repo(), author: AUTHOR, attestation: null, platformKey: platform.fingerprint, self: win });
    ok(!res.ok && !readyPosted(win), "unprovisioned (no attestation) → offers nothing");
  }

  console.log(fails ? `\nFAILED (${fails})` : "\nok: git bottle — git-enough vended over the probe, consent-gated, boot-gated, headless");
  process.exit(fails ? 1 : 0);
}
run();
