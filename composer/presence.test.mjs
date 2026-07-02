// Unit: the witness primitive — presence claims, countersigning, and the both-directions reading (one
// record, two proofs; docs/presence.md). Includes the physical loop in CI: a signed claim rides ONE QR
// tile through the real encoder and the real lens. Run: node composer/presence.test.mjs
import { generateIdentity } from "./sign.mjs";
import { makeClaim, verifyClaim, witnessClaim, verifyWitness, presenceEvidence, presenceOps, CLAIM, WITNESS } from "./presence.mjs";
import { encodeQR } from "./qr-encode.mjs";
import { decodeMatrix } from "./qr-decode.mjs";
import { elevatedSession, request, FRAME, ERROR } from "./probe-line.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const alice = await generateIdentity();      // the claimant
const walker = await generateIdentity();     // literally anyone next to her
const T0 = "2026-07-02T18:00:00.000Z", T1 = "2026-07-02T18:02:00.000Z";

// 1. a claim signs, verifies, names its basis honestly, and doesn't link to its siblings.
{
  const c = await makeClaim({ constituency: "cd04", bisect: { method: "asserted" }, at: T0 }, alice);
  const v = await verifyClaim(c);
  ok(v.ok && v.by === alice.fingerprint && v.constituency === "cd04", "a claim verifies back to its claimant and place");
  ok(c.bisect.method === "asserted", "the basis is honest — 'asserted' until the boundary layer lands");
  const c2 = await makeClaim({ constituency: "cd04", at: T0 }, alice);
  ok(c.nonce !== c2.nonce, "two claims carry fresh, unlinkable nonces");
  const bent = JSON.parse(JSON.stringify(c)); bent.constituency = "cd99";
  ok(!(await verifyClaim(bent)).ok, "a bent claim fails");
}

// 2. witnessing: verify-first, sign the claim verbatim, carry the witness's OWN placement.
{
  const c = await makeClaim({ constituency: "cd04", at: T0 }, alice);
  const r = await witnessClaim(c, { bisect: { constituency: "cd04" }, at: T1 }, walker);
  ok(r.schema === WITNESS && JSON.stringify(r.claim) === JSON.stringify(c), "the witness signs EXACTLY what was shown (claim verbatim)");
  const v = await verifyWitness(r);
  ok(v.ok && v.witness === walker.fingerprint && v.claimant === alice.fingerprint, "the record verifies both signatures");
  ok(v.copresent === true && v.fresh === true, "two placements of the same place, two minutes apart → copresent + fresh");
  let threw = false;
  const bent = JSON.parse(JSON.stringify(c)); bent.at = "2020-01-01T00:00:00.000Z";
  try { await witnessClaim(bent, {}, walker); } catch { threw = true; }
  ok(threw, "a witness REFUSES an invalid claim — you don't witness garbage");
}

// 3. weaker encounters stay true but say so: elsewhere → not copresent; later → not fresh; self → refused.
{
  const c = await makeClaim({ constituency: "cd04", at: T0 }, alice);
  const elsewhere = await verifyWitness(await witnessClaim(c, { bisect: { constituency: "cd07" }, at: T1 }, walker));
  ok(elsewhere.ok && !elsewhere.copresent, "a witness placed ELSEWHERE is a true encounter, marked not copresent");
  const later = await verifyWitness(await witnessClaim(c, { bisect: { constituency: "cd04" }, at: "2026-07-02T19:00:00.000Z" }, walker));
  ok(later.ok && !later.fresh, "an hour-late countersign is marked not fresh");
  const selfie = await witnessClaim(c, { bisect: { constituency: "cd04" }, at: T1 }, alice);
  ok(!(await verifyWitness(selfie)).ok, "self-witnessing is refused — a witness is a second body");
}

// 4. ONE RECORD, TWO PROOFS: the both-directions reading, and the anonymous witness counts.
{
  const c = await makeClaim({ constituency: "cd04", at: T0 }, alice);
  const r = await witnessClaim(c, { bisect: { constituency: "cd04" }, at: T1 }, walker);
  const e = await presenceEvidence(r, { friends: [] });
  ok(e.ok && e.evidence.length === 2, "one witnessing yields evidence for BOTH parties");
  const [claimant, witness] = e.evidence;
  ok(claimant.who === alice.fingerprint && claimant.role === "claimant" && claimant.constituency === "cd04", "the claimant's proof: placed + countersigned");
  ok(witness.who === walker.fingerprint && witness.role === "witness" && witness.constituency === "cd04",
     "the witness's proof: their signature embeds a claim only scannable within camera range");
  const vAnon = await verifyWitness(r, { friends: [] });
  ok(vAnon.ok && !vAnon.witnessTrusted, "an ANONYMOUS witness still counts — a body demonstrably co-present, honestly ungraded");
}

// 5. THE PHYSICAL LOOP, IN CI: the claim rides one QR tile through the real encoder and the real lens.
{
  const c = await makeClaim({ constituency: "cd04", bisect: { method: "asserted" }, at: T0 }, alice);
  const wire = JSON.stringify(c);
  const q = encodeQR(wire, { ecLevel: "M" });
  ok(q.version <= 40, `a signed claim fits one QR (${wire.length} B → v${q.version})`);
  const read = decodeMatrix(q.modules);
  ok(read && read.text === wire, "…and the lens reads it back byte-exact");
  const r = await witnessClaim(JSON.parse(read.text), { bisect: { constituency: "cd04" }, at: T1 }, walker);
  ok((await verifyWitness(r)).ok, "a claim scanned OFF THE TILE countersigns cleanly — the face-to-face flow, end to end");
}

// 6. over the probe line: signing is a knowing act — Rung 1, one confirm each.
{
  const ops = presenceOps({ identity: alice });
  const run = async (op, input, confirmed) => {
    const frames = [];
    const s = elevatedSession({ ops, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
    await s.handle(request({ id: "x", op, input, confirmed }));
    return frames;
  };
  const refused = (await run("presence.claim", { constituency: "cd04" }, false)).find((f) => f.type === ERROR);
  ok(refused && refused.needsConfirm, "presence.claim without a confirm → refused");
  const claimed = (await run("presence.claim", { constituency: "cd04" }, true)).find((f) => f.type === FRAME && f.claim);
  ok(claimed && claimed.claim.schema === CLAIM, "presence.claim with a confirm signs");
  const wOps = presenceOps({ identity: walker });
  const frames = [];
  const s = elevatedSession({ ops: wOps, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
  await s.handle(request({ id: "w", op: "presence.witness", input: { claim: claimed.claim, observer: { bisect: { constituency: "cd04" } } }, confirmed: true }));
  const witnessed = frames.find((f) => f.type === FRAME && f.record);
  ok(witnessed && witnessed.evidence.length === 2, "presence.witness signs and returns the two-proofs reading");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall presence tests passed");
