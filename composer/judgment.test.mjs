// Unit: judgment (judgment.mjs) — the offline judge runner over the canonical {A, B, subject, guidance}
// envelope. Proves: the common is resolved through an injected seam (known → fast verdict, none → reject,
// pending → tabled); tabled defers only when not live; a known common still summons a human for a subject or
// an unseen predicate; and the OFFLINE RUN is a real gesture (a node:crypto virtual authenticator; browser
// path is probe-test/gesture.ui.test.mjs).
// Run: node composer/judgment.test.mjs
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { generateIdentity, attest } from "./sign.mjs";
import { mintAgeIdentity } from "./age-mint.mjs";
import { makeClaim, witnessClaim } from "./presence.mjs";
import { mintMembership } from "./enroll.mjs";
import { judge, defaultResolveCommon, assemble, needsHuman, autoResolution, resolveByGesture, verifyResolution, JUDGMENT, RESOLUTION } from "./judgment.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const te = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString("base64");
const b64url = (u8) => b64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha256 = async (b) => new Uint8Array(await crypto.subtle.digest("SHA-256", b));

async function fakeAuthenticator({ rpId = "anecdote.channel", origin = "https://anecdote.channel" } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const spki = b64(new Uint8Array(publicKey.export({ type: "spki", format: "der" })));
  const cred = { credId: "cred-1", spki, alg: -7, rpId, origin };
  const assert = async (challenge) => {
    const clientDataJSON = te.encode(JSON.stringify({ type: "webauthn.get", challenge: b64url(challenge), origin }));
    const authData = new Uint8Array(37);
    authData.set(await sha256(te.encode(rpId)), 0);
    authData[32] = 0x05;
    const signed = new Uint8Array([...authData, ...(await sha256(clientDataJSON))]);
    const signature = new Uint8Array(nodeSign("sha256", signed, { key: privateKey, dsaEncoding: "der" }));
    return { credId: cred.credId, authenticatorData: authData, clientDataJSON, signature };
  };
  return { cred, assert };
}

const A = "sha256:aaaa", B = "sha256:bbbb", R = "sha256:rrrr";
const now = "2026-07-13T20:00:00.000Z";

// 1. the lattice fast-path and defaultResolveCommon.
{
  ok(judge({ answer: B, declared: B }) === "accept", "identical → accept");
  ok(judge({ answer: A, declared: B, lattice: { permits: { [A]: [B] } } }) === "accept", "permits → accept");
  ok(judge({ answer: A, declared: B }) === "needs-judgment", "unknown → needs-judgment");
  ok(defaultResolveCommon(B, B).status === "known", "identical → known common");
  ok(defaultResolveCommon(A, B, { lattice: { permits: { [A]: [B] } } }).common === B, "permits → the shared floor is B");
  ok(defaultResolveCommon(R, B, { lattice: { refuses: { [R]: [B] } } }).status === "none", "refuses → none");
  ok(defaultResolveCommon(A, B).status === "pending", "unknown → pending (must lodge)");
}

// 2. assemble over the default seam: known/none/pending → verdict, tabled, deferrable.
{
  const acc = await assemble({ constitution_a: B, constitution_b: B }, { at: now });
  ok(acc.schema === JUDGMENT && acc.verdict === "accept" && !acc.tabled && !needsHuman(acc), "identical, no subject → accept, decisive");
  ok(acc.commonStatus === "known" && acc.common === B, "the case carries the known common");

  const rej = await assemble({ constitution_a: R, constitution_b: B }, { lattice: { refuses: { [R]: [B] } }, at: now });
  ok(rej.verdict === "reject" && !needsHuman(rej), "a refusing pair → reject, decisive");

  const pend = await assemble({ constitution_a: A, constitution_b: B }, { at: now });
  ok(pend.verdict === "needs-judgment" && pend.tabled && pend.deferrable && needsHuman(pend), "an unknown pair → needs-judgment, tabled, deferrable (not live)");

  const live = await assemble({ constitution_a: A, constitution_b: B }, { at: now, live: true });
  ok(live.tabled && !live.deferrable, "the same pending case in a LIVE exchange is tabled but NOT deferrable");
}

// 3. a known common whose subject still needs a human is RULE-NOW (needs-judgment, not tabled, not deferrable).
{
  const c = await assemble({ constitution_a: B, constitution_b: B, subject: "post my dog photo" }, { at: now });
  ok(c.verdict === "needs-judgment" && !c.tabled && !c.deferrable && needsHuman(c), "known common + subject → rule-now needs-judgment");
}

// 4. an injected resolveCommon seam models a cache hit / a lodge, out of the core.
{
  const cacheHit = async () => ({ status: "known", common: "sha256:meet" });
  const c1 = await assemble({ constitution_a: A, constitution_b: B }, { resolveCommon: cacheHit, at: now });
  ok(c1.verdict === "accept" && c1.common === "sha256:meet", "a seam cache-hit turns a novel pair into a fast accept");

  const lodged = async () => ({ status: "pending", reason: "lodged with antidote://boulder" });
  const c2 = await assemble({ constitution_a: A, constitution_b: B }, { resolveCommon: lodged, at: now });
  ok(c2.verdict === "needs-judgment" && c2.tabled && c2.opinion.reasons.some((r) => /antidote:\/\/boulder/.test(r)), "a seam pending lodges and tables with its reason");
}

// 5. predicates (the authorization layer) resolve to held / unseen / unmet from REAL presence + enroll.
{
  const C = "boulder.watershed";
  const person = await generateIdentity();
  const witness = await generateIdentity();
  const claim = await makeClaim({ constituency: C, bisect: { method: "bisect", boundary: "b-1" }, at: now }, person);
  const witnessed = await witnessClaim(claim, { bisect: { method: "bisect", boundary: "b-1", constituency: C }, at: now }, witness);

  const held = await assemble({ constitution_a: B, constitution_b: B,
    predicates: [{ kind: "presence", asserts: { constituency: C }, evidence: witnessed }] }, { at: now });
  ok(held.predicates[0].result === "held" && held.verdict === "accept", "known common + a held predicate + no subject → accept");

  const unseen = await assemble({ constitution_a: B, constitution_b: B,
    predicates: [{ kind: "presence", asserts: { constituency: C }, evidence: null }] }, { at: now });
  ok(unseen.predicates[0].result === "unseen" && unseen.verdict === "needs-judgment" && needsHuman(unseen), "an unseen predicate holds a known-common case for a human");

  const unmet = await assemble({ constitution_a: B, constitution_b: B,
    predicates: [{ kind: "presence", asserts: { constituency: "denver.council" }, evidence: witnessed }] }, { at: now });
  ok(unmet.predicates[0].result === "unmet" && unmet.verdict === "reject", "a contradicted predicate → reject");

  const atlas = await generateIdentity();
  const memberAge = await mintAgeIdentity();
  const membership = await mintMembership({ atlas: "boulder", constituency: C, recipient: memberAge.recipient, member: person.fingerprint }, atlas, { at: now, window: 60 * 60 * 1000 });
  const mem = await assemble({ constitution_a: B, constitution_b: B,
    predicates: [{ kind: "membership", asserts: { atlas: "boulder", constituency: C }, evidence: membership }] }, { now: new Date(Date.parse(now) + 60000).toISOString(), at: now });
  ok(mem.predicates[0].result === "held" && mem.verdict === "accept", "a fresh membership predicate is held → accept");
}

// 6. autoResolution decides only accept/reject; a signed auto resolution verifies without a gesture.
{
  const acc = await assemble({ constitution_a: B, constitution_b: B }, { at: now });
  const r = autoResolution(acc);
  ok(r && r.decision === "accept" && r.auto === true && r.case === acc.id, "autoResolution decides an accept case");
  const pend = await assemble({ constitution_a: A, constitution_b: B }, { at: now });
  ok(autoResolution(pend) === null, "autoResolution will not decide a needs-judgment case");
  const signer = await generateIdentity();
  const v = await verifyResolution(await attest(r, signer));
  ok(v.ok && v.decision === "accept" && !v.gated, "a signed auto resolution verifies without a gesture");
}

// 7. THE OFFLINE RUN + defer/live gating.
{
  const { cred, assert } = await fakeAuthenticator();
  const resolver = await generateIdentity();

  // rule-now case: the human gestures a decision now.
  const ruleNow = await assemble({ constitution_a: B, constitution_b: B, subject: "post it" }, { at: now });
  const { signed } = await resolveByGesture(ruleNow, { decision: "accept", reason: "vouched" }, resolver, cred, { assert, at: now });
  const v = await verifyResolution(signed, { spki: cred.spki, rpId: cred.rpId, origin: cred.origin });
  ok(v.ok && v.gated && v.decision === "accept" && v.by === resolver.fingerprint && !v.deferred, "a gesture resolves a rule-now case");

  const forged = { ...signed, decision: "reject" };
  ok(!(await verifyResolution(forged, { spki: cred.spki, rpId: cred.rpId, origin: cred.origin })).ok, "flipping the decision after the gesture breaks verification");

  // deferrable case: "I'll approve later" parks it as a deferred needs-judgment.
  const deferrable = await assemble({ constitution_a: A, constitution_b: B }, { at: now });
  const parked = await resolveByGesture(deferrable, { defer: true }, resolver, cred, { assert, at: now });
  const pv = await verifyResolution(parked.signed, { spki: cred.spki, rpId: cred.rpId, origin: cred.origin });
  ok(pv.ok && pv.decision === "needs-judgment" && pv.deferred, "defer on a deferrable case parks it (deferred needs-judgment), gesture-signed");

  // live pending: cannot defer — the receipt is needed now.
  const livePending = await assemble({ constitution_a: A, constitution_b: B }, { at: now, live: true });
  let threw = false;
  try { await resolveByGesture(livePending, { defer: true }, resolver, cred, { assert, at: now }); } catch (e) { threw = /cannot be deferred/.test(e.message); }
  ok(threw, "a LIVE exchange cannot table — deferring throws (the receipt is needed now)");

  // rule-now also cannot defer (nothing external is pending).
  let threw2 = false;
  try { await resolveByGesture(ruleNow, { defer: true }, resolver, cred, { assert, at: now }); } catch (e) { threw2 = /cannot be deferred/.test(e.message); }
  ok(threw2, "a rule-now case cannot be deferred either");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall judgment tests passed");
