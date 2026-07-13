// Unit: enroll (enroll.mjs) — presence-gated membership. Proves the WIRING: a recipient is enrolled only by
// the body that proved presence (the binding), the strict policy costs a witness, membership DECAYS, and the
// fresh-recipient roster is exactly what age-seal seals to. Deterministic time throughout.
// Run: node composer/enroll.test.mjs
import { generateIdentity } from "./sign.mjs";
import { attest } from "./sign.mjs";
import { mintAgeIdentity, recipientOf } from "./age-mint.mjs";
import { makeClaim, witnessClaim } from "./presence.mjs";
import { encrypt, decrypt } from "./age-seal.mjs";
import {
  buildEnrollRequest, enroll, verifyEnrollRequest, meetsPolicy, STRICT_POLICY,
  mintMembership, verifyMembership, membershipId, freshRecipients,
} from "./enroll.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const td = new TextDecoder();

const ATLAS = "boulder";
const C = "boulder.watershed";

// The player keys: anecdote signing identities (device Ed25519) AND age recipients (X25519) — a member holds
// both, and enroll binds the second to a presence proof made with the first.
const member = await generateIdentity();
const witness = await generateIdentity();
const atlas = await generateIdentity();
const memberAge = await mintAgeIdentity();

// A witnessed presence proof for the member in C, with claim/witness moments close (fresh) and the witness
// co-present (their bisect names C).
async function witnessedProofFor(claimIdentity, { at = "2026-07-13T18:00:00.000Z", constituency = C } = {}) {
  const claim = await makeClaim({ constituency, bisect: { method: "bisect", boundary: "b-1" }, at }, claimIdentity);
  const witAt = new Date(Date.parse(at) + 1000).toISOString();
  return witnessClaim(claim, { bisect: { method: "bisect", boundary: "b-1", constituency }, at: witAt }, witness);
}
async function bareClaimFor(claimIdentity, { at = "2026-07-13T18:00:00.000Z", constituency = C } = {}) {
  return makeClaim({ constituency, bisect: { method: "asserted" }, at }, claimIdentity);
}

// 1. buildEnrollRequest refuses a non-recipient (can never name an unsealable key).
{
  let threw = false;
  try { buildEnrollRequest({ atlas: ATLAS, constituency: C, recipient: "not-an-age-key", presence: {} }); } catch { threw = true; }
  ok(threw, "buildEnrollRequest rejects a recipient that is not an age key");
}

// 2. a witnessed request verifies and BINDS the recipient to the proven-present body.
{
  const presence = await witnessedProofFor(member);
  const req = await enroll({ atlas: ATLAS, constituency: C, recipient: memberAge.recipient, presence }, member);
  const v = await verifyEnrollRequest(req, { atlasConstituency: C });
  ok(v.ok && v.member === member.fingerprint && v.recipient === memberAge.recipient, "witnessed request verifies and names the member + recipient");
  ok(v.grade.witnessed && v.grade.copresent && v.grade.fresh, "grade reflects witnessed, co-present, fresh");
}

// 3. THE BINDING: a request signed by someone OTHER than the proven-present body is refused.
{
  const presence = await witnessedProofFor(member);                 // proof places `member`
  const impostor = await generateIdentity();
  const unsigned = buildEnrollRequest({ atlas: ATLAS, constituency: C, recipient: memberAge.recipient, presence });
  const req = await attest(unsigned, impostor);                     // …but the impostor signs it
  const v = await verifyEnrollRequest(req, { atlasConstituency: C });
  ok(!v.ok && v.errors.some((e) => /places .*not the enroller/.test(e)), "a recipient cannot be enrolled by anyone but the body that stood there");
}

// 4. constituency must line up with the atlas.
{
  const presence = await witnessedProofFor(member, { constituency: "denver.council" });
  const req = await enroll({ atlas: ATLAS, constituency: "denver.council", recipient: memberAge.recipient, presence }, member);
  const v = await verifyEnrollRequest(req, { atlasConstituency: C });
  ok(!v.ok && v.errors.some((e) => /enrolls for/.test(e)), "an atlas refuses a request for a different constituency");
}

// 5. policy: STRICT needs a witness; a bare self-claim clears only a loosened bar.
{
  const bare = await bareClaimFor(member);
  const req = await enroll({ atlas: ATLAS, constituency: C, recipient: memberAge.recipient, presence: bare }, member);
  const v = await verifyEnrollRequest(req, { atlasConstituency: C });
  ok(v.ok, "a bare-claim request still VERIFIES (true and bound) …");
  ok(!meetsPolicy(v, STRICT_POLICY).ok, "… but fails STRICT policy (no witness / second body)");
  ok(meetsPolicy(v, { requireWitness: false }).ok, "… and clears a deliberately loosened policy");

  const presence = await witnessedProofFor(member);
  const wreq = await enroll({ atlas: ATLAS, constituency: C, recipient: memberAge.recipient, presence }, member);
  ok(meetsPolicy(await verifyEnrollRequest(wreq, { atlasConstituency: C }), STRICT_POLICY).ok, "a witnessed request clears STRICT policy");
}

// 6. membership decays: fresh inside the window, stale past it; the id binds the tuple; pinning holds.
{
  const at = "2026-07-13T18:05:00.000Z";
  const window = 60 * 60 * 1000;                                    // 1 hour
  const m = await mintMembership({ atlas: ATLAS, constituency: C, recipient: memberAge.recipient, member: member.fingerprint }, atlas, { at, window });

  const soon = new Date(Date.parse(at) + 10 * 60 * 1000).toISOString();   // +10 min
  const late = new Date(Date.parse(at) + 2 * 60 * 60 * 1000).toISOString(); // +2 h
  ok((await verifyMembership(m, { now: soon })).fresh, "membership is fresh inside its window");
  ok(!(await verifyMembership(m, { now: late })).fresh, "membership goes stale past its window (revoke-by-silence)");

  const pinned = await verifyMembership(m, { now: soon, atlasKey: atlas.fingerprint });
  ok(pinned.ok, "membership verifies against the pinned atlas key");
  const wrongPin = await verifyMembership(m, { now: soon, atlasKey: member.fingerprint });
  ok(!wrongPin.ok && wrongPin.errors.some((e) => /pinned atlas key/.test(e)), "a foreign-signed membership is refused when the atlas is pinned");

  const tampered = { ...m, recipient: (await mintAgeIdentity()).recipient };   // swap the recipient, keep the sig/id
  const vt = await verifyMembership(tampered, { now: soon });
  ok(!vt.ok, "swapping the recipient breaks the signature or the id binding");
}

// 7. the payoff: freshRecipients is exactly the currently-fresh members' recipients, deduped + filtered.
{
  const at = "2026-07-13T18:10:00.000Z";
  const now = new Date(Date.parse(at) + 5 * 60 * 1000).toISOString();
  const window = 60 * 60 * 1000;

  const other = await generateIdentity(); const otherAge = await mintAgeIdentity();
  const gone = await generateIdentity(); const goneAge = await mintAgeIdentity();
  const elsewhere = await generateIdentity(); const elsewhereAge = await mintAgeIdentity();

  const memberships = [
    await mintMembership({ atlas: ATLAS, constituency: C, recipient: memberAge.recipient, member: member.fingerprint }, atlas, { at, window }),
    await mintMembership({ atlas: ATLAS, constituency: C, recipient: otherAge.recipient, member: other.fingerprint }, atlas, { at, window }),
    // a renewal for `member` — must not double them in the roster
    await mintMembership({ atlas: ATLAS, constituency: C, recipient: memberAge.recipient, member: member.fingerprint }, atlas, { at: now, window }),
    // stale: minted long ago, past its window by `now`
    await mintMembership({ atlas: ATLAS, constituency: C, recipient: goneAge.recipient, member: gone.fingerprint }, atlas, { at: "2026-07-13T10:00:00.000Z", window }),
    // a different constituency — filtered out
    await mintMembership({ atlas: ATLAS, constituency: "denver.council", recipient: elsewhereAge.recipient, member: elsewhere.fingerprint }, atlas, { at, window }),
  ];

  const recips = await freshRecipients(memberships, { now, atlasKey: atlas.fingerprint, constituency: C });
  ok(recips.includes(memberAge.recipient) && recips.includes(otherAge.recipient), "fresh members are in the roster");
  ok(!recips.includes(goneAge.recipient), "a stale member drops out of the roster");
  ok(!recips.includes(elsewhereAge.recipient), "a different-constituency member is filtered out");
  ok(recips.filter((r) => r === memberAge.recipient).length === 1, "a renewed member appears exactly once");

  // and the roster is directly usable as an age-seal recipient list.
  const file = await encrypt(recips, "the atlas snapshot for fresh members");
  ok(td.decode(await decrypt(memberAge.identity, file)) === "the atlas snapshot for fresh members", "a fresh member opens what was sealed to the roster");
  const gone2 = goneAge; let noOpen = false;
  try { await decrypt(gone2.identity, file); } catch { noOpen = true; }
  ok(noOpen, "a dropped member cannot open the new snapshot");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall enroll tests passed");
