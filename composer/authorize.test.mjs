// Tests for the probe-line consent GATE (Edge 3, phase 2). Pure & deterministic.
//   node composer/authorize.test.mjs
import { authorize, describeOp, scopeCovers, grantCovers, OP_CATALOG } from "./authorize.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const T = "2026-07-01T00:00:00Z";
// A lightweight grant record shaped like consent.mjs's (the gate reads local trove records; it does not
// re-verify signatures — grantLive only inspects status + signed.expiry).
const grant = (o = {}) => ({
  grant: o.grant || "grant:abc", behavior: o.behavior || "git-enough:staging-beat",
  scope: o.scope || {}, status: o.status || "live", signed: { expiry: o.expiry || null },
});

// 1. Rung 0 is ambient/auto — allowed with no prompt, even in incognito.
{
  const a = authorize(describeOp("label"), {});
  ok(a.allow && a.rung === 0 && !a.needsConfirm, "label (Rung 0) auto-allows");
  ok(authorize(describeOp("trove.read"), { recordingOn: false }).allow, "read-only works in incognito");
}

// 2. Rung 1 needs a fresh confirm; confirmed lets it through.
{
  const op = describeOp("sign");
  const a = authorize(op, {});
  ok(!a.allow && a.needsConfirm && a.rung === 1, "sign (Rung 1) unconfirmed → needsConfirm");
  ok(authorize(op, { confirmed: true }).allow, "sign confirmed → allow");
}

// 3. Incognito refuses PERSISTING ops at any rung — even confirmed; non-persisting Rung 1 still passes.
{
  const seal = describeOp("seal");                        // persists
  const r = authorize(seal, { confirmed: true, recordingOn: false });
  ok(!r.allow && /incognito/.test(r.reason), "seal (persists) refused in incognito despite confirm");
  const sign = describeOp("sign");                        // does not persist
  ok(authorize(sign, { confirmed: true, recordingOn: false }).allow,
     "sign (non-persist) confirmed still allowed in incognito");
}

// 4. Rung 2 with no grant is refused (mint one, don't one-off confirm it).
{
  const beat = describeOp("git-enough:staging-beat");
  const r = authorize(beat, { confirmed: true });        // confirm doesn't help a standing behavior
  ok(!r.allow && !r.needsConfirm && /no standing grant/.test(r.reason),
     "Rung 2 without a grant → refused, needs a grant not a confirm");
}

// 5. Rung 2 with a live, in-scope grant → allowed, carrying the grant id.
{
  const beat = describeOp("git-enough:staging-beat", { behavior: "git-enough:staging-beat", scope: { piles: ["history"] } });
  const g = grant({ scope: { piles: ["history"] } });
  const r = authorize(beat, { grants: [g], now: T });
  ok(r.allow && r.grantId === "grant:abc" && !r.needsConfirm, "granted behavior in scope → allow + grantId");
}

// 6. Revoked / expired grants don't authorize.
{
  const beat = describeOp("git-enough:staging-beat", { behavior: "git-enough:staging-beat" });
  ok(!authorize(beat, { grants: [grant({ status: "revoked" })], now: T }).allow, "revoked grant does not authorize");
  ok(!authorize(beat, { grants: [grant({ expiry: "2026-06-30T00:00:00Z" })], now: T }).allow,
     "expired grant does not authorize");
}

// 7. Scope is least-authority: a grant for one pile doesn't cover another; "*" covers all.
{
  ok(scopeCovers({ piles: ["history"] }, { piles: ["history"] }), "scope covers the requested pile");
  ok(!scopeCovers({ piles: ["history"] }, { piles: ["secrets"] }), "scope does not cover an unlisted pile");
  ok(!scopeCovers({}, { piles: ["history"] }), "empty grant scope covers no requested resource");
  ok(scopeCovers({}, undefined), "an op requesting no scope is covered by behavior alone");
  ok(scopeCovers({ piles: ["*"] }, { piles: ["anything"] }), "a * wildcard covers any value in that dimension");

  const beat = describeOp("git-enough:staging-beat", { behavior: "git-enough:staging-beat", scope: { piles: ["secrets"] } });
  ok(!authorize(beat, { grants: [grant({ scope: { piles: ["history"] } })], now: T }).allow,
     "out-of-scope request is refused even under a live grant");
}

// 8. A live grant covers Rung 1 ops too — the staging beat's internal commits don't each prompt.
{
  const commit = describeOp("commit", { behavior: "git-enough:staging-beat", scope: { piles: ["history"] } });
  ok(!authorize(commit, {}).allow, "a bare commit still needs a confirm");
  const r = authorize(commit, { grants: [grant({ scope: { piles: ["history"] } })], now: T });
  ok(r.allow && r.grantId === "grant:abc" && !r.needsConfirm,
     "a commit under a covering grant auto-allows (no per-op prompt)");
}

// 9. grantCovers requires a behavior match and only applies to behavior-tagged ops.
{
  ok(!grantCovers(grant(), describeOp("commit")), "a behavior-less op is never grant-covered");
  ok(!grantCovers(grant({ behavior: "lm:index-history" }),
                  describeOp("commit", { behavior: "git-enough:staging-beat" })), "behavior mismatch not covered");
}

// 10. Unknown ops fail safe: treated as consequential + persisting.
{
  const u = describeOp("mystery.op");
  ok(u.rung === 1 && u.persists === true, "unknown op → consequential + persisting");
  ok(!authorize(u, { recordingOn: false }).allow, "unknown op refused in incognito (persists)");
  ok(OP_CATALOG.label.rung === 0, "catalog exposes known rungs");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall gate tests passed");
