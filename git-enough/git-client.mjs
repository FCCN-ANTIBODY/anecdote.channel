// git-enough/git-client.mjs — the streamlined git CLIENT: the "request half" an engine delivers over the
// install grammar (composer/install), which a consumer wears (the glove) to drive the engine's git ops over
// the probe. It wraps a probe-line invoke into a small git API and holds NOTHING — no repo, no keys. The
// engine (fed the consumer's bytes) does the signed-byte work; this side just asks. This module is what a git
// engine's `install` ships as its entry.
//
// `invoke(op, input, opts) => Promise<{ frames }>` is a connected probe client's invoke (composer/probe-line
// connectProbeLine). The consumer opened THIS engine on purpose, so a Rung-1 op carries confirmed:true; reads
// (Rung 0) need no confirmation. Each call resolves to the op's single data frame (or null).

const dataFrame = (res, key) => (res && res.frames ? res.frames.find((f) => f && f[key] !== undefined) || res.frames[0] || null : null);

export function makeGitClient(invoke) {
  if (typeof invoke !== "function") throw new Error("git-client: needs a probe invoke(op, input, opts)");
  const confirmed = (op, input) => invoke(op, input, { confirmed: true });
  return {
    // stand a newborn repo up from a file-set → { init, tip, bytes, refs, head } (bytes: the pile persists them)
    init: (files, opts = {}) => confirmed("git.init", { files, ...opts }).then((r) => dataFrame(r, "init")),
    // serialize the current repo → { bytes, refs, head } (re-persist after a change)
    export: () => invoke("git.export", {}).then((r) => dataFrame(r, "bytes")),
    // rehydrate from persisted bytes → { loaded, refs, head }
    load: (bytes, refs, head) => confirmed("git.load", { bytes, refs, head }).then((r) => dataFrame(r, "loaded")),
    // commit a file-set → { commit, ref }
    commit: (files, message, opts = {}) => confirmed("git.commit", { files, message, ...opts }).then((r) => dataFrame(r, "commit")),
    log: (ref) => invoke("git.log", ref ? { ref } : {}).then((r) => dataFrame(r, "log")),
    files: (ref) => invoke("git.files", ref ? { ref } : {}).then((r) => dataFrame(r, "files")),
    fastForward: (ref, to) => confirmed("git.fast-forward", { ref, to }).then((r) => dataFrame(r, "advanced")),
  };
}

export default makeGitClient;
