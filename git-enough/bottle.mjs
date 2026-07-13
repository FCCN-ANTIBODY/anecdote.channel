// git-enough/bottle.mjs — THE GIT BOTTLE: git-enough served as a signed, headless probe. No UI. A tool
// iframes the bottle (a real, signed origin on its sub-sub-domain) and talks to its probe; the bottle vends
// git-enough's ops through the probe-line's consent gate (composer/authorize.mjs fixes each op's rung, so a
// caller can never raise it). This is the Elevated-side SESSION — transport-free and Node-testable; the
// served page, the cross-origin hello, and the caller-signature check are the thin browser layer on top.
//
// The bottle holds the repo (deps.repo) and any credential/network (deps.credential/fetch); a caller names
// only the op it wants — the probe-line's "the powerful side holds the power" rule. A git bottle vends git,
// and ONLY git: compose nothing else here.
import { elevatedSession, serveProbeLine } from "../composer/probe-line.mjs";
import { gitOps } from "./probe-ops.mjs";

// The headless session — drive it with probe-line REQUEST/CANCEL messages; frames go to `emit`. Pure, so a
// test and the eventual served page share one brain. `context` is read live per request (recording toggle +
// standing grants); default is recording-on with no grants, so Rung-1 ops need a fresh confirmation.
export function gitBottleSession({ repo, credential, fetch, inflate, author, emit, context, yield_, trace } = {}) {
  return elevatedSession({
    ops: gitOps({ repo, credential, fetch, inflate, author }),
    emit,
    context,
    yield_,
    trace,
  });
}

// Browser convenience: serve the git bottle over the MessagePort the iframing tool transferred in. Thin
// wrapper over serveProbeLine — the transport, not the logic. (The cross-origin hello that hands us the port,
// and the caller-signature check the bottle forces before serving, are the follow-on browser unit.)
export function serveGitBottle(port, { repo, credential, fetch, inflate, author, context } = {}) {
  return serveProbeLine(port, { ops: gitOps({ repo, credential, fetch, inflate, author }), context });
}
