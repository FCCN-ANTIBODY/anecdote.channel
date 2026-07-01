// Tests for the "your repositories" view — the first system-viewer type. Run: node viewer/repos.test.mjs
import { repo } from "../git-enough/repo.mjs";
import { repoRegistry, repoRow, repoListView, gradeRepo } from "./repos.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const author = { name: "You", email: "you@origin", epoch: 1700000000, tz: "+0000" };

// Build a few of the offline origin's repos: a native session pile, a Tell-twinned poll pile, the keyring.
async function fixtures() {
  const session = repo();
  await session.commitFiles([{ path: "index.html", content: "<h1>hi</h1>\n" }], { author, message: "browse: example.com\n" });
  const poll = repo();
  await poll.commitFiles([{ path: "question.json", content: "{}\n" }], { author, message: "poll: budget\n" });
  const keyring = repo();
  await keyring.commitFiles([{ path: "rotations.json", content: "[]\n" }], { author, message: "keyring init\n" });
  return { session, poll, keyring };
}

const { session, poll, keyring } = await fixtures();

// 1. register returns the local anecdote:// id; list holds them all.
{
  const reg = repoRegistry();
  const id = reg.register({ label: "browse-2026", kind: "pile.session", repo: session });
  ok(id === "anecdote://repo/browse-2026", "register returns the local anecdote:// id");
  reg.register({ label: "budget", kind: "pile.poll", repo: poll, downstreams: ["https://github.com/tiliv/tell-budget"] });
  reg.register({ label: "keyring", kind: "keyring", repo: keyring });
  ok(reg.list().length === 3, "the registry lists all hosted repos");
}

// 2. A row carries the account-page metadata: local id, kind, downstreams, head, last message, trust.
{
  const reg = repoRegistry();
  reg.register({ label: "budget", kind: "pile.poll", repo: poll, downstreams: ["https://github.com/tiliv/tell-budget"] });
  const row = repoRow(reg.get("budget"));
  ok(row.id === "anecdote://repo/budget", "row: local anecdote:// id");
  ok(row.kind === "pile.poll", "row: kind");
  ok(row.downstreams[0] === "https://github.com/tiliv/tell-budget", "row: downstreams (the web mirror)");
  ok(row.head === "refs/heads/main" && row.tip && row.objects >= 3, "row: git facts (head/tip/objects)");
  ok(row.lastMessage === "poll: budget", "row: last commit message");
  ok(row.trust.grade === "mirrored" && row.trust.local === true, "row: trust grade (mirrored, local)");
}

// 3. Trust grades by kind/downstream.
{
  ok(gradeRepo({ kind: "pile.session", downstreams: [] }).grade === "native", "session pile → native");
  ok(gradeRepo({ kind: "pile.poll", downstreams: ["x"] }).grade === "mirrored", "poll pile with a downstream → mirrored");
  ok(gradeRepo({ kind: "pile.poll", downstreams: [] }).grade === "local", "a pile with no downstream → local");
  ok(gradeRepo({ kind: "keyring", downstreams: [] }).grade === "private", "keyring → private");
}

// 4. The account-page view: rows sorted by label, counts by kind.
{
  const reg = repoRegistry();
  reg.register({ label: "zebra", kind: "pile.session", repo: session });
  reg.register({ label: "alpha", kind: "pile.session", repo: session });
  reg.register({ label: "budget", kind: "pile.poll", repo: poll, downstreams: ["https://x"] });
  const view = repoListView(reg);
  ok(view.rows.map((r) => r.label).join(",") === "alpha,budget,zebra", "rows sorted by label");
  ok(view.total === 3 && view.byKind["pile.session"] === 2 && view.byKind["pile.poll"] === 1, "counts by kind");
  ok(view.rows.every((r) => r.id.startsWith("anecdote://repo/")), "every row has a local id");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall repos view tests passed");
