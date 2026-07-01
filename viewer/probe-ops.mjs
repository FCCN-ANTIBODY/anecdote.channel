// viewer/probe-ops.mjs — the system viewer as probe-line capabilities (docs/system-viewer.md). The viewer
// is a main op and almost entirely Rung 0 (enumerate + read); the graded actions (push/discard/shred) hang
// off items via the git.* / consent ops. A chamber widget calls these and renders the result on ice.
//
// deps: { registry } — a viewer/repos.js repoRegistry. (Kept registry-shaped so raw-storage enumerators can
// feed the same surface later, showing what's on the device even when the repo registry is empty.)

import { repoListView } from "./repos.mjs";
import { repoDetail, readFile } from "./repo-detail.mjs";
import { parseAnecdoteUrl } from "./anecdote-url.mjs";
import { enumerateAll } from "./enumerators.mjs";
import { pollView } from "./poll.mjs";

export function viewerOps({ registry, storage } = {}) {
  if (!registry) throw new Error("viewer ops: need a repoRegistry");
  const resolve = (idOrLabel) => {
    const p = parseAnecdoteUrl(idOrLabel);
    return registry.get(p ? p.id : idOrLabel);
  };
  return {
    // Rung 0 — the account-page index of everything you host locally.
    "viewer.repos": async (_input, api) => { api.emit({ view: repoListView(registry) }); },

    // Rung 0 — what's ACTUALLY on the device: raw storage surfaces (localStorage / IndexedDB / caches /
    // OPFS) + the usage estimate. Shows existence even when the repo registry is empty. Runs Elevated
    // (the chamber's null origin has no storage); the listing is handed down.
    "viewer.storage": async (_input, api) => { api.emit({ storage: await enumerateAll(storage || {}) }); },

    // Rung 0 — open a repo on ice: its commit timeline + tree at a ref. (`repo` is the anecdote:// id;
    // never call a payload field `id` — that's the frame's correlation id.)
    "viewer.repo": async (input, api) => {
      const entry = resolve(input.id);
      if (!entry) return api.emit({ error: "no such repo", repo: input.id });
      api.emit({ repo: input.id, label: entry.label, kind: entry.kind, downstreams: entry.downstreams,
                 detail: repoDetail(entry.repo, { ref: input.ref, limit: input.limit }) });
    },

    // Rung 0 — open a poll pile as its data object: question + mini-constitution + options with a live
    // tally (from fetched-back deliveries) + the addressable Tell twin. The view is nested under `view` so
    // its `type` (multichoice/open) can't clobber the frame envelope's own `type`. (`repo` is the
    // anecdote:// id; input.now — epoch ms from the chamber — enables open/closed lifecycle state.)
    "viewer.poll": async (input, api) => {
      const entry = resolve(input.id);
      if (!entry) return api.emit({ error: "no such repo", repo: input.id });
      const view = pollView(entry, { ref: input.ref, now: input.now });
      if (view.error) return api.emit({ error: view.error, repo: input.id });
      api.emit({ repo: input.id, view });
    },

    // Rung 0 — a single file's contents at a ref (the on-ice document view; text-decoded).
    "viewer.file": async (input, api) => {
      const entry = resolve(input.id);
      if (!entry) return api.emit({ error: "no such repo", repo: input.id });
      const f = readFile(entry.repo, input.ref, input.path);
      api.emit(f ? { repo: input.id, path: input.path, content: new TextDecoder().decode(f.content), size: f.size }
                 : { error: "no such file", path: input.path });
    },
  };
}
