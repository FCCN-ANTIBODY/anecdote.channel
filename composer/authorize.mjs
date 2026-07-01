// composer/authorize.mjs — the probe-line consent GATE (Edge 3, phase 2). A pure function: given an op
// and the current context (recording toggle + your live standing grants + whether this call carries a
// fresh confirmation), decide whether it may run. See docs/probe-line-consent.md.
//
// Three rungs, graded by the OP (declared by the admin-space tool that exposes it — Edge 4). A chamber
// can never RAISE an op's rung; it only requests what a tool already exposes, so the gate trusts op.rung
// as given. Consent here is about AUTHORITY and SURPRISE, not privacy-from-Elevated (Elevated is yours).

import { grantLive } from "./consent.mjs";

// Reference catalog of the enough-client ops and their rung/persist defaults. The AUTHORITATIVE grade is
// declared by the tool that exposes an op; this is the built-in starting set so a caller has sane
// descriptors. Unknown ops are treated as consequential+persisting (fail safe, not open).
export const OP_CATALOG = {
  "label":                   { rung: 0, persists: false },  // the "reading glasses" — perception, not persistence
  "trove.read":              { rung: 0, persists: false },
  "digest":                  { rung: 0, persists: false },
  "sign":                    { rung: 1, persists: false },  // makes an artifact but the RECORD is the persist
  "sign-anecdote":           { rung: 1, persists: true  },  // build + sign + record a receipt in the trove
  "seal":                    { rung: 1, persists: true  },
  "export":                  { rung: 1, persists: true  },
  "commit":                  { rung: 1, persists: true  },
  "pile.fabricate":          { rung: 1, persists: true  },
  "git-enough:staging-beat": { rung: 2, persists: true  },  // standing behaviors
  "lm:index-history":        { rung: 2, persists: true  },
  "git.log":                 { rung: 0, persists: false },  // git-enough vended over the probe line
  "git.files":               { rung: 0, persists: false },
  "git.commit":              { rung: 1, persists: true  },
  "git.push":                { rung: 1, persists: true  },  // network egress — consequential
  "git.clone":               { rung: 1, persists: true  },  // the Castle: imports history
  "viewer.repos":            { rung: 0, persists: false },  // the system viewer — enumerate + read only
  "viewer.repo":             { rung: 0, persists: false },
  "viewer.poll":             { rung: 0, persists: false },  // a poll pile as its data object + live tally
  "viewer.file":             { rung: 0, persists: false },
  "viewer.storage":          { rung: 0, persists: false },  // raw device storage surfaces
  "poll.view":               { rung: 0, persists: false },  // the poll-answer view (anecdote shaped by a QR)
  "poll.compose":            { rung: 0, persists: false },  // build the reply link — the submit is the user's click
  "poll.mint":               { rung: 1, persists: false },  // mint a poll's QR — a shareable authorization (secret stays Elevated)
  "poll.remember":           { rung: 1, persists: true  },  // remember a poll you answered (Elevated persistence)
  "poll.answered":           { rung: 0, persists: false },  // list the polls you've answered
};

// Build an op descriptor from the catalog (unknown → consequential+persisting). `extra` adds behavior/scope.
export function describeOp(name, extra = {}) {
  const base = OP_CATALOG[name] || { rung: 1, persists: true };
  return { name, rung: base.rung, persists: base.persists, ...extra };
}

// Does a grant's scope cover the op's requested resources? Least-authority: a dimension the op requests
// must be explicitly permitted by the grant (or by an explicit "*" wildcard). A dimension the grant
// doesn't list permits nothing on it. An op that requests no scope is covered by behavior alone.
export function scopeCovers(grantScope = {}, opScope) {
  if (!opScope) return true;
  for (const dim of Object.keys(opScope)) {
    const req = opScope[dim] || [];
    const allowed = grantScope[dim] || [];
    if (allowed.includes("*")) continue;
    for (const v of req) if (!allowed.includes(v)) return false;
  }
  return true;
}

// Does a grant record authorize this op? Behavior must match and scope must cover. Only behavior-tagged
// ops are grant-coverable (a bare, one-off Rung-1 op has no behavior, so it always needs its own confirm).
export function grantCovers(grant, op) {
  if (!op.behavior) return false;
  if (grant.behavior !== op.behavior) return false;
  return scopeCovers(grant.scope, op.scope);
}

// THE GATE. Pure. ctx = { recordingOn=true, grants=[], confirmed=false, now? }.
// Returns { allow, rung, needsConfirm, grantId?, reason? }.
export function authorize(op, ctx = {}) {
  const rung = op.rung ?? 1;                         // unknown grade → consequential
  const recordingOn = ctx.recordingOn !== false;    // default on; incognito is the opt-in
  const grants = ctx.grants || [];

  // Incognito refuses anything that would PERSIST, at any rung — the coarse recording toggle threading
  // through the ladder (Origin guarantee #1). Read-only ops sail through.
  if (op.persists && !recordingOn)
    return { allow: false, rung, needsConfirm: false, reason: "incognito: persistence is off" };

  // Rung 0 — ambient / auto. Read-only, no artifact; never prompts. Works even in incognito.
  if (rung <= 0) return { allow: true, rung: 0, needsConfirm: false };

  // A live, in-scope standing grant covers Rung 1 AND Rung 2 ops — this is why a granted behavior's
  // internal commits don't each prompt (the grant already carried the consent).
  const covering = grants.filter((g) => grantLive(g, { now: ctx.now })).find((g) => grantCovers(g, op));
  if (covering) return { allow: true, rung, needsConfirm: false, grantId: covering.grant };

  // Rung 2 with no covering grant — you can't one-off confirm a standing behavior; you mint a grant.
  if (rung >= 2)
    return { allow: false, rung, needsConfirm: false, reason: "no standing grant for this behavior" };

  // Rung 1 — confirmed. One op, one confirm.
  if (ctx.confirmed) return { allow: true, rung, needsConfirm: false };
  return { allow: false, rung, needsConfirm: true, reason: "needs a fresh confirmation" };
}
