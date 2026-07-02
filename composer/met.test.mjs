// Unit: the met-record — a server's footprint, left by someone else's foot. A Tell-minted, Tell-SIGNED
// token, scanned by a body with a presence claim, bound under the body's signature — three signatures,
// ZERO secrets to re-verify. The operator's location never appears; the bodies are the proof.
// Run: node composer/met.test.mjs
import { generateIdentity } from "./sign.mjs";
import { mintQR } from "./qr-mint.mjs";
import { buildPoll } from "../viewer/poll.mjs";
import { makeClaim, witnessClaim, verifyWitness } from "./presence.mjs";
import { buildBoundary, signBoundary, placementsFor, boundaryId } from "./bisect.mjs";
import { verifySshSig, verifyMintedToken, metRecord, verifyMet, metOps, MET } from "./met.mjs";
import { elevatedSession, request, FRAME, ERROR } from "./probe-line.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const tell = await generateIdentity();       // the Tell's enrolled signer — mints the token
const alice = await generateIdentity();      // the body that mets the Tell
const walker = await generateIdentity();     // the second body
const hub = await generateIdentity();        // signs the boundary the bisect graduates against
const T0 = "2026-07-02T18:00:00.000Z", T1 = "2026-07-02T18:02:00.000Z";

const poll = buildPoll({ pile: "cd04-q1", poll: "park-budget", type: "multichoice",
  text: "Fund the neighborhood park this year?", options: ["Fund it", "Hold off"] });
const minted = await mintQR(poll, { secret: "demo-pile-secret", sign: { identity: tell } });
const city = await signBoundary(buildBoundary({ constituency: "cd04", polygons: [[[[0, 0], [10, 0], [10, 10], [0, 10]]]] }), hub);

// 1. the public anchor: a scanned minted URL verifies with NO secret; unsigned/bent tokens are refused.
{
  const t = await verifyMintedToken(minted.url);
  ok(t.ok && t.kid === minted.kid && t.pile === "cd04-q1", "a Tell-signed token verifies from the scanned URL alone (kid matches)");
  const unsigned = await mintQR(poll, { secret: "demo-pile-secret" });
  const u = await verifyMintedToken(unsigned.url);
  ok(!u.ok && /unsigned/.test(u.errors[0]), "an UNSIGNED token cannot anchor a met-record — refused with the reason");
  const bent = minted.url.replace(/tok=[0-9a-f]{8}/, (m) => "tok=" + (m.slice(4, 5) === "0" ? "1" : "0") + m.slice(5));
  ok(!(await verifyMintedToken(bent)).ok, "a bent token (canon changed under the signature) is refused");
  const sv = await verifySshSig(minted.sig, minted.canon);
  ok(sv.ok && sv.kid === minted.kid && sv.namespace === "tell-poll", "the SSHSIG verifier agrees with the signer byte-for-byte");
}

// 2. the met-record: bisect-graduated claim + scanned token, bound by the body — re-verified end to end.
{
  const placement = (await placementsFor([2, 2], [city]))[0];
  const claim = await makeClaim({ ...placement, at: T0 }, alice);
  const record = await metRecord({ scanned: minted.url, claim, at: T1 }, alice);
  ok(record.schema === MET && record.token.kid === minted.kid, "the record binds the token's kid under the body's signature");
  const v = await verifyMet(record);
  ok(v.ok && v.by === alice.fingerprint && v.kid === minted.kid, "three signatures verify — binder, Tell, claim — with zero secrets");
  ok(v.constituency === "cd04" && v.boundary === await boundaryId(city) && v.method === "bisect",
     "the facts surface: WHERE the token was exercised, against WHICH shape, by geometry not assertion");
  ok(v.fresh === true, "claim and binding two minutes apart → fresh");
}

// 3. nobody mets on someone else's feet; garbage binds to nothing.
{
  const claim = await makeClaim({ constituency: "cd04", at: T0 }, walker);
  let threw = false;
  try { await metRecord({ scanned: minted.url, claim, at: T1 }, alice); } catch { threw = true; }
  ok(threw, "binding SOMEONE ELSE'S claim is refused — nobody mets on someone else's feet");
  let threw2 = false;
  try { await metRecord({ scanned: "https://x.example/?pile=p", claim: await makeClaim({ constituency: "cd04", at: T0 }, alice), at: T1 }, alice); } catch { threw2 = true; }
  ok(threw2, "an unverifiable token refuses to bind");
  const good = await metRecord({ scanned: minted.url, claim: await makeClaim({ constituency: "cd04", at: T0 }, alice), at: T1 }, alice);
  const bent = JSON.parse(JSON.stringify(good)); bent.token.pile = "somewhere-else";
  ok(!(await verifyMet(bent)).ok, "a bent met-record fails the binder's signature");
}

// 4. THE FULL ARTIFACT: met + witnessed — the token, the body's geometry, and a second body, one moment.
{
  const placement = (await placementsFor([2, 2], [city]))[0];
  const claim = await makeClaim({ ...placement, at: T0 }, alice);
  const record = await metRecord({ scanned: minted.url, claim, at: T1 }, alice);
  const wPlace = (await placementsFor([3, 3], [city]))[0];
  const witnessed = await witnessClaim(record.claim, { bisect: { ...wPlace.bisect, constituency: wPlace.constituency }, at: T1 }, walker);
  const wv = await verifyWitness(witnessed);
  ok((await verifyMet(record)).ok && wv.ok && wv.copresent && wv.fresh,
     "met-record + co-bisected witness: the Tell's secret, exercised in place, corroborated by a second body");
}

// 5. over the probe line: binding is a knowing act.
{
  const ops = metOps({ identity: alice });
  const claim = await makeClaim({ constituency: "cd04", at: T0 }, alice);
  const frames = [];
  const s = elevatedSession({ ops, emit: (f) => frames.push(f), context: () => ({ recordingOn: true, grants: [] }) });
  await s.handle(request({ id: "m", op: "presence.met", input: { scanned: minted.url, claim, at: T1 } }));
  ok(frames.some((f) => f.type === ERROR && f.needsConfirm), "presence.met without a confirm → refused");
  await s.handle(request({ id: "m2", op: "presence.met", input: { scanned: minted.url, claim, at: T1 }, confirmed: true }));
  const done = frames.find((f) => f.type === FRAME && f.record);
  ok(done && done.facts.ok && done.facts.kid === minted.kid, "presence.met with a confirm binds and returns the facts");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall met tests passed");
