// Integration: the viewer's read ops through the probe-line session + consent gate. The account-page list,
// opening a repo on ice, and reading a file — all Rung 0 (no prompt). Run: node viewer/probe-ops.test.mjs
import { elevatedSession, request, FRAME } from "../composer/probe-line.mjs";
import { repo } from "../git-enough/repo.mjs";
import { repoRegistry } from "./repos.mjs";
import { viewerOps } from "./probe-ops.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const author = { name: "You", email: "you@origin", epoch: 1700000000, tz: "+0000" };

// A registry with a session pile and a Tell-twinned poll pile.
const session = repo();
await session.commitFiles([{ path: "index.html", content: "<h1>hi</h1>\n" }, { path: "a/note.txt", content: "note\n" }], { author, message: "browse\n" });
const poll = repo();
await poll.commitFiles([{ path: "question.json", content: "{}\n" }], { author, message: "poll: budget\n" });
const registry = repoRegistry();
registry.register({ label: "browse-2026", kind: "pile.session", repo: session });
registry.register({ label: "budget", kind: "pile.poll", repo: poll, downstreams: ["https://github.com/tiliv/tell-budget"] });

function session_() {
  const frames = [];
  const s = elevatedSession({ ops: viewerOps({ registry }), emit: (f) => frames.push(f),
                              context: () => ({ recordingOn: true, grants: [] }) });
  return { s, frames };
}

// 1. viewer.repos — the account-page index, Rung 0 (no confirm).
{
  const { s, frames } = session_();
  await s.handle(request({ id: "L", op: "viewer.repos", input: {} }));
  const view = frames.find((f) => f.type === FRAME && f.view)?.view;
  ok(view && view.total === 2, "viewer.repos returns the account-page index with no prompt");
  ok(view.rows.find((r) => r.label === "budget").downstreams[0] === "https://github.com/tiliv/tell-budget", "rows carry downstreams");
  ok(view.rows.find((r) => r.label === "browse-2026").trust.grade === "native", "session pile graded native");
}

// 2. viewer.repo — open a repo on ice (by its anecdote:// id).
{
  const { s, frames } = session_();
  await s.handle(request({ id: "O", op: "viewer.repo", input: { id: "anecdote://repo/browse-2026" } }));
  const f = frames.find((x) => x.type === FRAME && x.detail);
  ok(f && f.detail.commits[0].message === "browse" && f.detail.files.length === 2, "viewer.repo opens the timeline + tree");
  ok(f.kind === "pile.session", "the opened repo carries its kind");
}

// 3. viewer.file — a document on ice.
{
  const { s, frames } = session_();
  await s.handle(request({ id: "F", op: "viewer.file", input: { id: "browse-2026", path: "a/note.txt" } }));
  const f = frames.find((x) => x.type === FRAME && x.content !== undefined);
  ok(f && f.content === "note\n", "viewer.file returns the document contents (id by bare label too)");
}

// 4. Unknown repo → a correlated error frame, not a crash.
{
  const { s, frames } = session_();
  await s.handle(request({ id: "X", op: "viewer.repo", input: { id: "anecdote://repo/ghost" } }));
  ok(frames.find((x) => x.type === FRAME && x.error === "no such repo"), "unknown repo → error field");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall viewer probe-ops tests passed");
