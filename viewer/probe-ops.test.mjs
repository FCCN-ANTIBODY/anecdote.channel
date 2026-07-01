// Integration: the viewer's read ops through the probe-line session + consent gate. The account-page list,
// opening a repo on ice, and reading a file — all Rung 0 (no prompt). Run: node viewer/probe-ops.test.mjs
import { elevatedSession, request, FRAME } from "../composer/probe-line.mjs";
import { repo } from "../git-enough/repo.mjs";
import { repoRegistry } from "./repos.mjs";
import { viewerOps } from "./probe-ops.mjs";
import { authorPoll, recordDelivery } from "./poll.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const author = { name: "You", email: "you@origin", epoch: 1700000000, tz: "+0000" };

// A registry with a session pile and a Tell-twinned poll pile.
const session = repo();
await session.commitFiles([{ path: "index.html", content: "<h1>hi</h1>\n" }, { path: "a/note.txt", content: "note\n" }], { author, message: "browse\n" });
const poll = repo();
await authorPoll(poll, { pile: "cd04-q1", poll: "budget", type: "multichoice", text: "Cut or keep the library budget?", options: ["Cut", "Keep"], guidance: "One of the listed options.", tell: "https://tell.anecdote.channel" }, { author });
await recordDelivery(poll, "000000", [{ poll: "budget", answer: "Keep", governed: "accept" }, { poll: "budget", answer: "Cut", governed: "accept" }, { poll: "budget", answer: "Keep", governed: "accept" }], { author });
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

// 5. viewer.storage — raw device surfaces (Rung 0), shown even when the repo registry is empty.
{
  const fakeLS = (() => { const o = { "anecdote:trove": "xx" }; const k = Object.keys(o); return { get length() { return k.length; }, key: (i) => k[i], getItem: (x) => o[x] }; })();
  const storage = { localStorage: fakeLS };
  const empty = repoRegistry();   // NB: empty registry
  const frames = [];
  const s = elevatedSession({ ops: viewerOps({ registry: empty, storage }), emit: (f) => frames.push(f),
                              context: () => ({ recordingOn: true, grants: [] }) });
  await s.handle(request({ id: "S", op: "viewer.storage", input: {} }));
  const st = frames.find((f) => f.type === FRAME && f.storage)?.storage;
  ok(st && st.surfaces.find((x) => x.surface === "localStorage").count === 1, "viewer.storage lists raw surfaces even with an empty repo registry");
}

// 6. viewer.poll — a poll pile as its data object + live tally (Rung 0, no prompt).
{
  const { s, frames } = session_();
  await s.handle(request({ id: "P", op: "viewer.poll", input: { id: "anecdote://repo/budget", now: Date.parse("2026-06-01T00:00:00Z") } }));
  const v = frames.find((x) => x.type === FRAME && x.view)?.view;
  ok(v && v.text === "Cut or keep the library budget?" && v.type === "multichoice", "viewer.poll returns the question + type with no prompt");
  ok(v.results.total === 3 && v.results.tally.find((x) => x.answer === "Keep").count === 2, "viewer.poll folds fetched-back deliveries into a live tally");
  ok(v.tell === "https://tell.anecdote.channel", "viewer.poll carries the addressable Tell twin");
}

// 7. viewer.poll on a session pile → error frame, not a crash.
{
  const { s, frames } = session_();
  await s.handle(request({ id: "PN", op: "viewer.poll", input: { id: "browse-2026" } }));
  ok(frames.find((x) => x.type === FRAME && x.error === "not a poll pile"), "viewer.poll on a non-poll pile → error field");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall viewer probe-ops tests passed");
