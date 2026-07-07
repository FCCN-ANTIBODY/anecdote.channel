// Unit: the freshness lease — anecdote.lease/v1. A dated "still live" receipt that decays; non-renewal
// is the revoke. Build/sign/verify, the window freshness check, and supersession by the newest
// same-source word. Run: node composer/lease.test.mjs
import { generateIdentity } from "./sign.mjs";
import { buildLease, signLease, verifyLease, isLease, leaseFresh, supersedes, freshest,
         LEASE_SCHEMA } from "./lease.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const keeper = await generateIdentity();
const other = await generateIdentity();
const DAY = 86400000;
const SUBJECT = "sha256:" + "a".repeat(64); // a content-id (ballotId/atlasPollId/husk id shape)

// 1. build: required fields + window validation.
{
  const l = buildLease({ subject: SUBJECT, at: "2026-07-06T00:00:00Z", window: 30 * DAY });
  ok(l.schema === LEASE_SCHEMA && l.subject === SUBJECT && l.window === 30 * DAY, "builds a windowed lease");
  for (const bad of [{ at: "2026-07-06T00:00:00Z" }, { subject: SUBJECT }, { subject: SUBJECT, at: "x", window: -1 }, { subject: SUBJECT, at: "x", window: 0 }]) {
    let threw = false; try { buildLease(bad); } catch { threw = true; }
    ok(threw, "refused a malformed spec: " + JSON.stringify(bad));
  }
}

// 2. sign + verify-from-anyone; tamper fails.
{
  const signed = await signLease(buildLease({ subject: SUBJECT, at: "2026-07-06T00:00:00Z" }), keeper);
  ok(isLease(signed), "signed lease keeps its shape");
  const v = await verifyLease(signed);
  ok(v.ok && v.by === keeper.fingerprint, "verifies to the keeper");
  ok(!(await verifyLease({ ...signed, at: "2026-08-01T00:00:00Z" })).ok, "a bumped date without re-signing fails the signature");
}

// 3. the whole point: fresh inside the window, STALE past it (still verifies — staleness is not tampering).
{
  const signed = await signLease(buildLease({ subject: SUBJECT, at: "2026-07-06T00:00:00Z", window: 30 * DAY }), keeper);
  const inside = await leaseFresh(signed, { now: "2026-07-20T00:00:00Z" });
  ok(inside.ok && inside.fresh && inside.windowed, "within window -> fresh");
  const past = await leaseFresh(signed, { now: "2026-09-01T00:00:00Z" });
  ok(past.ok && !past.fresh, "past window -> verifies (ok) but NOT fresh — this is 'revoke = stop re-signing'");
}

// 4. window precedence: explicit opts.window overrides the lease's own; no window anywhere -> forever.
{
  const signed = await signLease(buildLease({ subject: SUBJECT, at: "2026-07-06T00:00:00Z", window: 365 * DAY }), keeper);
  const tight = await leaseFresh(signed, { now: "2026-08-15T00:00:00Z", window: 7 * DAY });
  ok(tight.ok && !tight.fresh, "explicit verifier window overrides the lease's generous one");
  const bare = await signLease(buildLease({ subject: SUBJECT, at: "2026-07-06T00:00:00Z" }), keeper);
  const forever = await leaseFresh(bare, { now: "2030-01-01T00:00:00Z" });
  ok(forever.ok && forever.fresh && !forever.windowed, "no window anywhere -> verifies-forever, flagged windowed:false");
}

// 5. supersession: the newest same-subject, same-keeper lease wins; different keeper/subject does not.
{
  const older = await signLease(buildLease({ subject: SUBJECT, at: "2026-07-01T00:00:00Z" }), keeper);
  const newer = await signLease(buildLease({ subject: SUBJECT, at: "2026-07-08T00:00:00Z" }), keeper);
  ok(supersedes(newer, older) && !supersedes(older, newer), "newer same-source lease supersedes the older");
  const rival = await signLease(buildLease({ subject: SUBJECT, at: "2026-07-09T00:00:00Z" }), other);
  ok(!supersedes(rival, older), "a different keeper's lease does not supersede ours (same-source only)");
  const otherSubject = await signLease(buildLease({ subject: "sha256:" + "b".repeat(64), at: "2026-07-09T00:00:00Z" }), keeper);
  ok(!supersedes(otherSubject, older), "a different subject does not supersede");
}

// 6. freshest picks the newest of a keeper's leases for a subject.
{
  const a = await signLease(buildLease({ subject: SUBJECT, at: "2026-07-01T00:00:00Z" }), keeper);
  const b = await signLease(buildLease({ subject: SUBJECT, at: "2026-07-08T00:00:00Z" }), keeper);
  const c = await signLease(buildLease({ subject: SUBJECT, at: "2026-07-05T00:00:00Z" }), keeper);
  const pick = freshest([a, b, c], { subject: SUBJECT, by: keeper.fingerprint });
  ok(pick && pick.at === "2026-07-08T00:00:00Z", "freshest returns the newest same-subject same-keeper lease");
}

process.exit(fails ? 1 : 0);
