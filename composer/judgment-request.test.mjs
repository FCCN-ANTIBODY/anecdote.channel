// Unit: judgment-request (judgment-request.mjs) — the authorization envelope. Proves: the asker signs the
// request; each proof is BOUND to the asker (a lifted proof is refused); a policy over the established facts
// decides authorization; the per-parent allowlist refuses boards it doesn't name; and the verified request
// feeds judgment.assemble. Real presence + enroll artifacts throughout.
// Run: node composer/judgment-request.test.mjs
import { generateIdentity, attest } from "./sign.mjs";
import { mintAgeIdentity } from "./age-mint.mjs";
import { makeClaim, witnessClaim } from "./presence.mjs";
import { mintMembership } from "./enroll.mjs";
import { assemble } from "./judgment.mjs";
import {
  REQUEST, buildRequest, lodge, establish, verifyRequest,
  requires, allowlistPolicy, REQUIRE_SIGNED,
} from "./judgment-request.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const A = "sha256:aaaa", B = "sha256:bbbb";
const C = "boulder.watershed";
const now = "2026-07-14T18:00:00.000Z";

const asker = await generateIdentity();
const witness = await generateIdentity();
const atlas = await generateIdentity();
const askerAge = await mintAgeIdentity();

// Helpers to mint the asker's standing.
async function witnessedPresence(id = asker, constituency = C) {
  const claim = await makeClaim({ constituency, bisect: { method: "bisect", boundary: "b-1" }, at: now }, id);
  return witnessClaim(claim, { bisect: { method: "bisect", boundary: "b-1", constituency }, at: now }, witness);
}
async function membershipFor(member = asker, recipient = askerAge.recipient) {
  return mintMembership({ atlas: "boulder", constituency: C, recipient, member: member.fingerprint }, atlas, { at: now, window: 60 * 60 * 1000 });
}

// 1. buildRequest validates.
{
  let threw = false;
  try { buildRequest({ constitution_a: A }); } catch { threw = true; }
  ok(threw, "buildRequest requires both constitutions");
}

// 2. lodge + establish: bound proofs become facts, signed by the asker.
{
  const env = await lodge({ constitution_a: A, constitution_b: B, subject: "post my report", proofs: [await witnessedPresence(), await membershipFor()] }, asker);
  ok(env.schema === REQUEST && env.sig, "lodge signs the envelope");
  const e = await establish(env, { now });
  ok(e.ok && e.asker === asker.fingerprint, "establish verifies the envelope and names the asker");
  ok(e.facts.some((f) => f.kind === "presence" && f.constituency === C && f.witnessed), "a witnessed presence proof becomes a fact");
  ok(e.facts.some((f) => f.kind === "membership" && f.constituency === C && f.fresh), "a fresh membership proof becomes a fact");
}

// 3. THE BINDING: a proof that names someone else is refused, not counted.
{
  const someoneElse = await generateIdentity();
  const lifted = await witnessedPresence(someoneElse);          // a real proof — but of a different body
  const env = await lodge({ constitution_a: A, constitution_b: B, proofs: [lifted] }, asker);
  const e = await establish(env, { now });
  ok(e.facts.length === 0 && e.unbound.length === 1, "a proof lifted from someone else is unbound, never a fact");
}

// 4. invalid proof is flagged, not counted.
{
  const claim = await makeClaim({ constituency: C, bisect: { method: "bisect", boundary: "b-1" }, at: now }, asker);
  const tampered = { ...claim, constituency: "denver.council" };  // break the signature
  const env = await lodge({ constitution_a: A, constitution_b: B, proofs: [tampered] }, asker);
  const e = await establish(env, { now });
  ok(e.facts.length === 0 && e.invalid.length === 1, "a proof whose signature is broken is invalid, not a fact");
}

// 5. requires(): a policy over facts.
{
  const env = await lodge({ constitution_a: A, constitution_b: B, proofs: [await witnessedPresence()] }, asker);
  const facts = (await establish(env, { now })).facts;
  ok(requires({ presence: C })( env.request, facts).ok, "presence requirement met");
  ok(!requires({ presence: "denver.council" })(env.request, facts).ok, "presence-elsewhere requirement not met");
  ok(requires({ presence: C, witnessed: true })(env.request, facts).ok, "witnessed requirement met by a witnessed proof");

  const bareEnv = await lodge({ constitution_a: A, constitution_b: B, proofs: [await makeClaim({ constituency: C, bisect: { method: "asserted" }, at: now }, asker)] }, asker);
  const bareFacts = (await establish(bareEnv, { now })).facts;
  ok(!requires({ presence: C, witnessed: true })(bareEnv.request, bareFacts).ok, "a bare claim fails a witnessed requirement");

  const memEnv = await lodge({ constitution_a: A, constitution_b: B, proofs: [await membershipFor()] }, asker);
  const memFacts = (await establish(memEnv, { now })).facts;
  ok(requires({ membership: { atlas: "boulder", constituency: C } })(memEnv.request, memFacts).ok, "membership requirement met");
}

// 6. allowlistPolicy: refuses a board it does not name; checks the requirement for one it does.
{
  const env = await lodge({ constitution_a: A, constitution_b: B, proofs: [await witnessedPresence()] }, asker);
  const onList = allowlistPolicy({ [B]: { presence: C } });
  const offList = allowlistPolicy({ "sha256:other": { presence: C } });
  const r1 = await verifyRequest(env, { policy: onList, now });
  ok(r1.ok && r1.authorized, "a board on the allowlist, requirement met → authorized");
  const r2 = await verifyRequest(env, { policy: offList, now });
  ok(r2.ok && !r2.authorized && r2.reasons.some((x) => /not on the allowlist/.test(x)), "a board not on the allowlist → refused, never open-by-omission");
}

// 7. verifyRequest end to end: authorized only when the proofs meet the policy.
{
  const good = await lodge({ constitution_a: A, constitution_b: B, subject: "post it", proofs: [await witnessedPresence(), await membershipFor()] }, asker);
  const strict = allowlistPolicy({ [B]: { presence: C, witnessed: true, membership: { atlas: "boulder", constituency: C } } });
  const rg = await verifyRequest(good, { policy: strict, now });
  ok(rg.authorized && rg.asker === asker.fingerprint, "a request carrying witnessed presence + fresh membership clears a strict board");

  const weak = await lodge({ constitution_a: A, constitution_b: B, subject: "post it", proofs: [await makeClaim({ constituency: C, bisect: { method: "asserted" }, at: now }, asker)] }, asker);
  const rw = await verifyRequest(weak, { policy: strict, now });
  ok(!rw.authorized && rw.reasons.some((x) => /witnessed/.test(x) || /membership/.test(x)), "a bare-claim request fails the strict board with reasons");

  ok((await verifyRequest(weak, { policy: REQUIRE_SIGNED, now })).authorized, "the same request clears a signed-only board (open is a choice)");
}

// 8. a tampered envelope fails the signature.
{
  const env = await lodge({ constitution_a: A, constitution_b: B, proofs: [] }, asker);
  const forged = { ...env, request: { ...env.request, subject: "smuggled" } };
  const e = await establish(forged, { now });
  ok(!e.ok, "tampering the request after signing breaks the envelope signature");
}

// 9. the seam to the judge: an authorized request feeds judgment.assemble unchanged.
{
  const env = await lodge({ constitution_a: B, constitution_b: B, subject: "", proofs: [await witnessedPresence()] }, asker);
  const r = await verifyRequest(env, { policy: allowlistPolicy({ [B]: { presence: C } }), now });
  ok(r.authorized, "request authorized");
  const c = await assemble(r.request, { at: now });                 // identical pair, no subject → accept
  ok(c.verdict === "accept", "the authorized request's {A,B,subject,guidance} passes straight into assemble → accept");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall judgment-request tests passed");
