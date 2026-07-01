// git-enough/probe-ops.mjs — git-enough vended as probe-line capabilities (Milestone: Origin). Where the
// composer became a chamber client (composer/probe-ops.mjs), this makes the OFFLINE ORIGIN's git a set of
// probe-line ops, so a chamber can read history, commit, push, and clone — all mediated by the consent
// ladder + standing grants (composer/authorize.mjs) and surfaced in the grants panel.
//
// Rungs (declared in the OP_CATALOG, so a chamber can't raise them):
//   git.log / git.files  — Rung 0, read-only history inspection (no prompt).
//   git.commit           — Rung 1, persists a commit (the beat's unit; yield→check-cancel→commit).
//   git.push             — Rung 1, network egress to a downstream (send-pack) — consequential.
//   git.clone            — Rung 1, imports a downstream's history into our origin (the Castle).
// The staging beat is the Rung-2 STANDING behavior "git-enough:staging-beat": a grant over git.commit
// that the scheduler runs on your behalf (its cadence is Origin's open "privileged budget" question).
//
// `deps`: { repo, credential?, fetch?, inflate?, author? }. The Elevated app holds the repo, the PAT, and
// the network; the chamber only names what it wants. Compose with other ops: {...composerOps(), ...gitOps()}.

import { publish } from "./send-pack.mjs";
import { clone } from "./fetch-pack.mjs";
import { parseCommit, filesAt } from "./read.mjs";

export function gitOps(deps = {}) {
  if (!deps.repo) throw new Error("git probe-ops: need the origin's repo");
  const repo = deps.repo;

  return {
    // Rung 0 — walk the commit history from a ref (default HEAD). Read-only.
    "git.log": async (input, api) => {
      const ref = (input && input.ref) || repo.head();
      const limit = (input && input.limit) || 50;
      const out = [];
      let oid = repo.readRef(ref);
      while (oid && out.length < limit) {
        const obj = repo.objects.get(oid); if (!obj) break;
        const c = parseCommit(obj.content);
        out.push({ oid, message: c.message.trim(), author: c.author });
        oid = c.parents[0];
      }
      api.emit({ ref, log: out });
    },

    // Rung 0 — the file tree at a ref. Read-only.
    "git.files": async (input, api) => {
      const ref = (input && input.ref) || repo.head();
      const tip = repo.readRef(ref);
      api.emit({ ref, files: tip ? filesAt(repo.objects, tip).map((f) => ({ path: f.path, size: f.size })) : [] });
    },

    // Rung 1 — commit files (the beat's unit). yield→check-cancel BEFORE the persist, so a cancel abandons
    // the commit with nothing written.
    "git.commit": async (input, api) => {
      await api.tick();
      const author = input.author || deps.author;
      if (!author) throw new Error("git.commit: an author is required");
      const oid = await repo.commitFiles(input.files, {
        author, message: input.message, ref: input.ref, root: input.root,
      });
      api.emit({ commit: oid, ref: input.ref || "refs/heads/main" });
    },

    // Rung 1 — publish a ref to a downstream (send-pack). The credential lives Elevated; never in the chamber.
    "git.push": async (input, api) => {
      await api.tick();
      const { advertised, report, upToDate } = await publish(repo, {
        url: input.url, ref: input.ref, credential: deps.credential, fetch: deps.fetch,
      });
      api.emit({ pushed: !!(report && report.ok), upToDate: !!upToDate, report, advertised: Object.keys(advertised.refs) });
    },

    // Rung 1 — clone a downstream's full history into our origin (the Castle). Imports objects + refs.
    "git.clone": async (input, api) => {
      await api.tick();
      const { repo: got, refs } = await clone({
        url: input.url, ref: input.ref, credential: deps.credential, fetch: deps.fetch, inflate: deps.inflate,
      });
      for (const [id, o] of got.objects) repo.objects.set(id, o);
      for (const [name, oid] of got.refs) repo.updateRef(name, oid);
      api.emit({ imported: got.objects.size, refs: Object.keys(refs) });
    },
  };
}
