// Unit: judgment (judgment.mjs) — the offline judge runner. Proves: the pure verdict matches the engine
// contract; assemble derives a self-contained case (verdict + predicates → held/unseen/unmet) and resolves
// nothing; a known-lattice case is decisive while a novel or unseen one summons a human; and the OFFLINE RUN
// is a real gesture — resolveByGesture folds proof-of-presence into a signed resolution that verifyResolution
// checks. The gesture path uses a node:crypto virtual authenticator (the browser path is drive-gesture.mjs).
// Run: node composer/judgment.test.mjs
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { generateIdentity, attest } from "./sign.mjs";
import { mintAgeIdentity } from "./age-mint.mjs";
import { makeClaim, witnessClaim } from "./presence.mjs";
import { mintMembership } from "./enroll.mjs";
import { judge, assemble, needsHuman, autoResolution, resolveByGesture, verifyResolution, JUDGMENT, RESOLUTION } from "./judgment.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const te = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString("base64");
const b64url = (u8) => b64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha256 = async (b) => new Uint8Array(await crypto.subtle.digest("SHA-256", b));

// A virtual platform authenticator: a P-256 keypair + an `assert` that produces a real WebAuthn-shaped,
// user-verified assertion gesture.mjs will accept. This is the offline gesture, emulated for node.
async function fakeAuthenticator({ rpId = "anecdote.channel", origin = "https://anecdote.channel" } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const spki = b64(new Uint8Array(publicKey.export({ type: "spki", format: "der" })));
  const cred = { credId: "cred-1", spki, alg: -7, rpId, origin };
  const assert = async (challenge) => {
    const clientDataJSON = te.encode(JSON.stringify({ type: "webauthn.get", challenge: b64url(challenge), origin }));
    const authData = new Uint8Array(37);
    authData.set(await sha256(te.encode(rpId)), 0);
    authData[32] = 0x05;                                   // UP | UV — the "make them do it" bits
    const signed = new Uint8Array([...authData, ...(await sha256(clientDataJSON))]);
    const signature = new Uint8Array(nodeSign("sha256", signed, { key: privateKey, dsaEncoding: "der" }));
    return { credId: cred.credId, authenticatorData: authData, clientDataJSON, signature };
  };
  return { cred, assert };
}

const A = "sha256:aaaa", DECLARED = "sha256:ssss", REFUSED = "sha256:rrrr";
const now = "2026-07-13T20:00:00.000Z";

// 1. the pure verdict is the engine contract.
{
  ok(judge({ answer: DECLARED, declared: DECLARED }) === "admit", "identical constitutions admit");
  ok(judge({ answer: A, declared: DECLARED, lattice: { permits: { [A]: [DECLARED] } } }) === "admit", "lattice permits → admit");
  ok(judge({ answer: REFUSED, declared: DECLARED, lattice: { refuses: { [REFUSED]: [DECLARED] } } }) === "refuse", "lattice refuses → refuse");
  ok(judge({ answer: A, declared: DECLARED }) === "queue", "an unknown pair queues");
  ok(judge({ answer: "", declared: DECLARED }) === "refuse" && judge({ answer: A, declared: "" }) === "refuse", "no constitution / no declaration → refuse");
}

// 2. a known-lattice case is decisive on its own — autoResolution, no human, no gesture.
{
  const c = await assemble({ parents: { answer: DECLARED, declared: DECLARED } }, { at: now });
  ok(c.schema === JUDGMENT && c.verdict === "admit", "assemble files an admit case for an identical pair");
  ok(!needsHuman(c), "a known-lattice admit with nothing unseen needs no human");
  const r = autoResolution(c);
  ok(r && r.schema === RESOLUTION && r.decision === "admit" && r.auto === true && r.case === c.id, "autoResolution decides it, bound to the case id");
  const signer = await generateIdentity();
  const v = await verifyResolution(await attest(r, signer));
  ok(v.ok && v.decision === "admit" && !v.gated, "a signed auto resolution verifies without a gesture");
}

// 3. a novel pair summons a human (queue), and autoResolution refuses to decide it.
{
  const c = await assemble({ parents: { answer: A, declared: DECLARED } }, { at: now });
  ok(c.verdict === "queue" && needsHuman(c), "a novel pair queues and needs a human");
  ok(c.opinion.leans === "hold", "the opinion leans hold, never admit, for a novel pair");
  ok(autoResolution(c) === null, "autoResolution will not decide a queued case");
}

// 4. metadata predicates resolve to held / unseen / unmet from REAL presence + enroll artifacts.
{
  const C = "boulder.watershed";
  const person = await generateIdentity();
  const witness = await generateIdentity();
  const claim = await makeClaim({ constituency: C, bisect: { method: "bisect", boundary: "b-1" }, at: now }, person);
  const witnessed = await witnessClaim(claim, { bisect: { method: "bisect", boundary: "b-1", constituency: C }, at: now }, witness);

  // held: a witnessed presence proof that matches the assertion, against an ALREADY-admitting pair, is decisive.
  const held = await assemble({ parents: { answer: DECLARED, declared: DECLARED },
    predicates: [{ kind: "presence", asserts: { constituency: C }, evidence: witnessed }] }, { at: now });
  ok(held.predicates[0].result === "held", "a matching witnessed presence predicate is HELD");
  ok(!needsHuman(held) && held.opinion.leans === "admit", "admit + every predicate held is decisive");

  // unseen: no evidence → the case HOLDS even though the lattice would admit ("I'd have to see that").
  const unseen = await assemble({ parents: { answer: DECLARED, declared: DECLARED },
    predicates: [{ kind: "presence", asserts: { constituency: C }, evidence: null }] }, { at: now });
  ok(unseen.predicates[0].result === "unseen" && unseen.needsToSee.length === 1, "a predicate with no evidence is UNSEEN and lands in needsToSee");
  ok(needsHuman(unseen) && unseen.opinion.leans === "hold", "an unseen predicate holds an otherwise-admitting case for a human");

  // unmet: evidence verifies but contradicts the assertion → the opinion leans refuse.
  const unmet = await assemble({ parents: { answer: DECLARED, declared: DECLARED },
    predicates: [{ kind: "presence", asserts: { constituency: "denver.council" }, evidence: witnessed }] }, { at: now });
  ok(unmet.predicates[0].result === "unmet" && unmet.opinion.leans === "refuse", "contradicting evidence is UNMET and leans refuse");

  // a membership predicate, held from a fresh atlas-signed membership.
  const atlas = await generateIdentity();
  const memberAge = await mintAgeIdentity();
  const membership = await mintMembership({ atlas: "boulder", constituency: C, recipient: memberAge.recipient, member: person.fingerprint }, atlas, { at: now, window: 60 * 60 * 1000 });
  const memCase = await assemble({ parents: { answer: DECLARED, declared: DECLARED },
    predicates: [{ kind: "membership", asserts: { atlas: "boulder", constituency: C }, evidence: membership }] }, { now: new Date(Date.parse(now) + 60000).toISOString(), at: now });
  ok(memCase.predicates[0].result === "held", "a fresh membership predicate is HELD");
}

// 5. THE OFFLINE RUN: resolveByGesture folds a real presence gesture into a signed resolution.
{
  const { cred, assert } = await fakeAuthenticator();
  const resolver = await generateIdentity();
  const c = await assemble({ parents: { answer: A, declared: DECLARED } }, { at: now });   // a queued case a human must rule

  const { signed, gesture } = await resolveByGesture(c, { decision: "admit", reason: "I stood there; I vouch it" }, resolver, cred, { assert, at: now });
  ok(signed.schema === RESOLUTION && signed.case === c.id && signed.decision === "admit" && !!gesture, "the resolution is gesture-signed and bound to the case");

  const v = await verifyResolution(signed, { spki: cred.spki, rpId: cred.rpId, origin: cred.origin });
  ok(v.ok && v.gated && v.decision === "admit" && v.by === resolver.fingerprint, "verifyResolution accepts a genuine gesture-signed resolution");

  // tamper the decision after signing → the attestation no longer holds.
  const forged = { ...signed, decision: "refuse" };
  const vf = await verifyResolution(forged, { spki: cred.spki, rpId: cred.rpId, origin: cred.origin });
  ok(!vf.ok, "flipping the decision after the gesture breaks verification");

  const holdRes = await resolveByGesture(c, { decision: "hold" }, resolver, cred, { assert, at: now });
  ok(holdRes.signed.decision === "hold", "a human may also HOLD (file it, decide later)");
}

// 6. end to end: a novel pair carrying a held presence proof → queued case → human gestures admit → verifies.
{
  const { cred, assert } = await fakeAuthenticator();
  const resolver = await generateIdentity();
  const C = "boulder.watershed";
  const person = await generateIdentity();
  const witness = await generateIdentity();
  const claim = await makeClaim({ constituency: C, bisect: { method: "bisect", boundary: "b-1" }, at: now }, person);
  const witnessed = await witnessClaim(claim, { bisect: { method: "bisect", boundary: "b-1", constituency: C }, at: now }, witness);

  const c = await assemble({ parents: { answer: A, declared: DECLARED },
    predicates: [{ kind: "presence", asserts: { constituency: C }, evidence: witnessed }] }, { at: now });
  ok(c.verdict === "queue" && c.predicates[0].result === "held" && needsHuman(c), "novel pair holds for a human even with a held predicate (the judge implies intelligence, not a rubber stamp)");

  const { signed } = await resolveByGesture(c, { decision: "admit", reason: "the meet is clean; presence checks out" }, resolver, cred, { assert, at: now });
  const v = await verifyResolution(signed, { spki: cred.spki, rpId: cred.rpId, origin: cred.origin });
  ok(v.ok && v.case === c.id, "the gesture resolves the exact filed case — the offline run stands in for the Action");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall judgment tests passed");
