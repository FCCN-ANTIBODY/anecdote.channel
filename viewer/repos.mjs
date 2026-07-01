// viewer/repos.mjs — the first system-viewer type: your repositories (docs/system-viewer.md). The metaphor
// is your GitHub account page — every repo you host locally, public and private, with the metadata that
// makes it more than a Files app: its local `anecdote://` id, its **downstreams** (where the offline origin
// pushes — the mirrors it forces to match), its kind, and a **trust grade** for the on-screen meter.
//
// The offline origin hosts MANY repos (native session piles, Tell-twinned poll piles, the private
// keyring). This registry tracks them + their metadata; the git facts come from each git-enough repo().
// Pure view-model; a chamber widget renders it.

import { anecdoteUrl } from "./anecdote-url.mjs";
import { parseCommit } from "../git-enough/read.mjs";

// The registry of local repositories. `register` returns the repo's local anecdote:// id.
export function repoRegistry() {
  const entries = new Map();   // label -> { label, kind, repo, downstreams }
  return {
    register({ label, kind = "repo", repo, downstreams = [] }) {
      if (!label) throw new Error("repo-registry: a repo needs a label");
      if (!repo) throw new Error("repo-registry: a repo needs its repo()");
      entries.set(label, { label, kind, repo, downstreams: [...downstreams] });
      return anecdoteUrl("repo", label);
    },
    get(label) { return entries.get(label) || null; },
    list() { return [...entries.values()]; },
  };
}

// The trust grade behind the meter. Everything here is LOCAL (the anecdote:// scheme asserts that); the
// grade is about provenance/authority, not location:
//   private  — the keyring (most-private, its own probe line)
//   native   — created here, no upstream (a session pile is inherently yours)
//   mirrored — we push it to a downstream we force to match (a poll pile)
//   local    — anything else held locally
export function gradeRepo(entry) {
  const hasDownstreams = (entry.downstreams || []).length > 0;
  let grade;
  if (entry.kind === "keyring") grade = "private";
  else if (entry.kind === "pile.session") grade = "native";
  else if (hasDownstreams) grade = "mirrored";
  else grade = "local";
  return { grade, local: true, mirrored: hasDownstreams };
}

// One row of the "your repositories" list.
export function repoRow(entry) {
  const r = entry.repo;
  const head = r.head();
  const tip = r.readRef(head);
  let lastMessage = null;
  if (tip) { const c = r.objects.get(tip); if (c && c.type === "commit") { try { lastMessage = parseCommit(c.content).message.trim(); } catch {} } }
  return {
    id: anecdoteUrl("repo", entry.label),   // the LOCAL canonical address
    label: entry.label,
    kind: entry.kind,
    downstreams: entry.downstreams || [],   // the resolvable-web mirrors (empty for native/private)
    head,
    tip: tip || null,
    lastMessage,
    refs: [...r.refs.keys()],
    objects: r.objects.size,
    trust: gradeRepo(entry),
  };
}

// The "your repositories" view — the account-page index.
export function repoListView(registry) {
  const rows = registry.list().map(repoRow).sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  const byKind = {};
  for (const row of rows) byKind[row.kind] = (byKind[row.kind] || 0) + 1;
  return { rows, total: rows.length, byKind };
}
