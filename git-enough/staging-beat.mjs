// git-enough/staging-beat.mjs — the offline origin's steady beat (Milestone: Origin). The Rung-2 standing
// behavior that tees a session's ephemeral shelf onto the git stage, per the use case in
// docs/archive-browser.md. It decides WHAT (the .gitignore-filtered "documents" class — never the churn,
// never secrets) and WHEN (a session preference: instant / tempo / teardown-flush), under WHAT AUTHORITY
// (a live grant + recording on — else it no-ops, which is also the incognito behavior).
//
// This is why the git-commit thread stops here: commit is a *capability* (git-enough/probe-ops.mjs); the
// BEAT is the policy that drives it on your behalf, governed like any Rung-2 behavior. Pure & testable;
// the scheduler that calls tick() on a cadence is Origin's open "privileged budget" — injected, not owned.

// ---- a "git-enough" .gitignore matcher (a documented subset) ----------------------------------------
// Supports: comments (#), blank lines, negation (!, last match wins), globs (* within a segment, ** across,
// ?), leading "/" (root-anchored), leading "**/" (any depth), trailing "/" (dir + everything under it).
// A slash-bearing pattern is root-anchored; a slash-free pattern matches at any depth (git semantics).
export function compileGitignore(text) {
  const rules = [];
  for (let raw of (text || "").split("\n")) {
    raw = raw.replace(/\r$/, "").trim();
    if (!raw || raw.startsWith("#")) continue;
    let negate = false, s = raw;
    if (s.startsWith("!")) { negate = true; s = s.slice(1); }
    let dirOnly = false; if (s.endsWith("/")) { dirOnly = true; s = s.slice(0, -1); }
    let anyDepth = false; if (s.startsWith("**/")) { anyDepth = true; s = s.slice(3); }
    let anchored = false; if (s.startsWith("/")) { anchored = true; s = s.slice(1); }
    const hasSlash = s.includes("/");
    let body = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "*") { if (s[i + 1] === "*") { body += ".*"; i++; } else body += "[^/]*"; }
      else if (c === "?") body += "[^/]";
      else body += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
    const prefix = (anchored || (hasSlash && !anyDepth)) ? "^" : "(^|.*/)";
    rules.push({ re: new RegExp(prefix + body + (dirOnly ? "(/.*)?$" : "$")), negate });
  }
  return (path) => {
    let ignored = false;
    for (const r of rules) if (r.re.test(path)) ignored = !r.negate;   // last match wins
    return ignored;
  };
}

// ---- the beat ---------------------------------------------------------------------------------------
// deps:
//   repo      the origin's repo() (git-enough/repo.mjs)
//   author    the committer ident
//   ref       default "refs/heads/main"
//   ignore    a .gitignore text (compiled once)
//   mode      "instant" | "tempo" | "manual"  (default "tempo")
//   mayRun    () => boolean — the authority gate: grantLive(grant) && recordingOn (default: always).
//             When false, every commit path no-ops — which IS the incognito / revoked behavior.
export function stagingBeat(deps = {}) {
  if (!deps.repo) throw new Error("staging-beat: need a repo");
  if (!deps.author) throw new Error("staging-beat: need an author");
  const ref = deps.ref || "refs/heads/main";
  const ignored = compileGitignore(deps.ignore);
  const mode = deps.mode || "tempo";
  const mayRun = deps.mayRun || (() => true);

  const shelf = new Map();          // the working tree: path -> content (accumulates across commits)
  let committed = null;             // the last committed file set, for zero-diff detection

  const sameAsCommitted = () => {
    if (!committed || committed.size !== shelf.size) return false;
    for (const [k, v] of shelf) if (committed.get(k) !== v) return false;
    return true;
  };

  async function commit(message) {
    if (!mayRun()) return { committed: false, reason: "unauthorized" };   // revoked / incognito
    if (!shelf.size) return { committed: false, reason: "empty" };
    if (sameAsCommitted()) return { committed: false, reason: "no-change" };  // zero-diff revisit
    const files = [...shelf].map(([path, content]) => ({ path, content }));
    const oid = await deps.repo.commitFiles(files, { author: deps.author, message: message || "beat", ref });
    committed = new Map(shelf);
    return { committed: true, commit: oid, files: files.length };
  }

  return {
    isIgnored: ignored,
    shelf,

    // Add/update a file on the shelf. Ignorable churn is dropped here (class 1). In instant mode, commits
    // immediately.
    async stage(path, content) {
      if (ignored(path)) return { staged: false, ignored: true };
      shelf.set(path, content);
      if (mode === "instant") return { staged: true, ...(await commit(`stage ${path}`)) };
      return { staged: true };
    },

    unstage(path) { return shelf.delete(path); },

    // Stage-1 deletion: drop the shelf with nothing committed (the non-default "I don't want this").
    discard() { shelf.clear(); },

    // Tempo tick — the scheduler calls this on a cadence (no-op unless mode is "tempo").
    async tick() { return mode === "tempo" ? commit("beat") : { committed: false, reason: `mode ${mode}` }; },

    // Explicit commit (manual mode, or forced).
    async commitNow(message) { return commit(message); },

    // Flush whatever remains as the session's chamber is dismantled — the teardown commit. Respects the
    // same authority gate (a revoked beat does not flush).
    async teardownFlush() { return commit("session teardown flush"); },
  };
}
