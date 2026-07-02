// Unit: whom you trust and what you keep — the friend list becomes real, and accepting a caught transfer
// commits the exact bytes with a SIGNED encounter record ("I met this, thus dented, on this day" — the
// attestation of an anti-attestation, docs/anti-signature.md). Grade confers no privilege; it is the honest
// label. Run: node composer/accept.test.mjs
import { memoryStore } from "../reducer/store.mjs";
import { generateIdentity } from "./sign.mjs";
import { packTransfer } from "./transfer.mjs";
import { fountainTransfer, carrierSession } from "./carrier.mjs";
import { friendsList, accept, acceptedList, verifyAccept, acceptOps, FRIEND, ACCEPT } from "./accept.mjs";
import { elevatedSession, request, FRAME, ERROR } from "./probe-line.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const me = await generateIdentity();
const friend = await generateIdentity();
const stranger = await generateIdentity();

// 1. the friend list: enroll, dedupe, list, remove — a real store, not a demo array.
{
  const store = memoryStore();
  const f = friendsList(store);
  ok((await f.add(friend.fingerprint, { label: "the neighbor" })).added, "a friend enrolls");
  ok(!(await f.add(friend.fingerprint)).added, "enrolling twice is once");
  ok(await f.has(friend.fingerprint) && !(await f.has(stranger.fingerprint)), "has() answers by fingerprint");
  const [rec] = await f.list();
  ok(rec.schema === FRIEND && rec.label === "the neighbor" && rec.how === "first-contact" && rec.enrolledAt, "the enrollment records who/when/how");
  ok((await f.remove(friend.fingerprint)).removed && (await f.fingerprints()).length === 0, "removal is clean");
}

// 2. the grades: mine / friend / anonymous — labels, not privileges.
{
  const store = memoryStore();
  await friendsList(store).add(friend.fingerprint);
  const mine = await accept(await packTransfer("poll", "my own words", me), {}, { identity: me, store });
  const theirs = await accept(await packTransfer("poll", "a friend's word", friend), {}, { identity: me, store });
  const unknown = await accept(await packTransfer("poll", "someone's word", stranger), {}, { identity: me, store });
  ok(mine.ok && mine.grade === "mine", "my own signature come back to me → MINE");
  ok(theirs.ok && theirs.grade === "friend", "an enrolled signer → FRIEND");
  ok(unknown.ok && unknown.grade === "anonymous", "verifies-as-someone's, trusted by no one → ANONYMOUS (kept, not privileged)");
  ok((await acceptedList(store)).length === 3, "all three kept — grade is the label, not the gate");
}

// 3. the signed encounter record: journey inside my signature; the record itself verifies; dupes are once.
{
  const store = memoryStore();
  await friendsList(store).add(friend.fingerprint);
  const signed = await packTransfer("data-pile", "came through a dented loop", friend);
  const r = await accept(signed, { dents: 5, foreign: 1, layout: "abc123" }, { identity: me, store });
  ok(r.ok && r.record.schema === ACCEPT && r.record.journey.dents === 5 && r.record.journey.foreign === 1,
     "the journey (dents, foreign, layout) rides inside the record");
  const v = await verifyAccept(r.record);
  ok(v.ok && v.by === me.fingerprint, "the encounter record is SIGNED BY ME and verifies — sign your damage");
  const dup = await accept(signed, { dents: 9 }, { identity: me, store });
  ok(dup.ok && dup.duplicate && (await acceptedList(store)).length === 1, "accepting the same transfer twice keeps it once");
  const kept = (await acceptedList(store))[0];
  ok(kept.signed.bytes === signed.bytes, "the exact caught bytes are kept — the film");
}

// 4. a bent envelope is never committed.
{
  const store = memoryStore();
  const signed = await packTransfer("poll", "soon to be bent", friend);
  const bent = JSON.parse(JSON.stringify(signed));
  bent.bytes = bent.bytes.slice(0, -4) + (bent.bytes.slice(-4) === "AAA=" ? "BBB=" : "AAA=");
  const r = await accept(bent, {}, { identity: me, store });
  ok(!r.ok && (await acceptedList(store)).length === 0, "an envelope that does not verify is refused, nothing stored");
}

// 5. THE ARC: a dented fountain crossing → snapshot journey → accept → the dents live in my signed record.
{
  const store = memoryStore();
  await friendsList(store).add(friend.fingerprint);
  const signed = await packTransfer("data-pile", "z".repeat(600), friend);
  const ft = await fountainTransfer(signed, { blockSize: 128 });
  const session = carrierSession({ friends: [friend.fingerprint] });
  const dent = (f) => { const i = f.length - 3; const c = f[i] === "A" ? "B" : "A"; return f.slice(0, i) + c + f.slice(i + 1); };
  let snap = null, seed = 0;
  while ((!snap || !snap.complete) && seed < ft.K * 8 + 40) {
    const sd = seed++;
    snap = await session.feed(sd % 3 === 1 ? dent(ft.frame(sd)) : ft.frame(sd));
  }
  const result = await session.result();
  const r = await accept(result.transfers[0].signed, { dents: snap.damaged, foreign: snap.foreign.length, layout: snap.layoutShort },
                         { identity: me, store });
  ok(snap.damaged > 0 && r.ok && r.grade === "friend" && r.record.journey.dents === snap.damaged,
     `caught through ${snap.damaged} dents → accepted as FRIEND with the dents in my signed encounter record`);
}

// 6. over the probe line: the gate holds — friends.add needs a confirm; carrier.accept refuses in incognito.
{
  const store = memoryStore();
  const ops = acceptOps({ identity: me, store });
  const run = async (op, input, ctx, confirmed = false) => {
    const frames = [];
    const s = elevatedSession({ ops, emit: (f) => frames.push(f), context: () => ctx });
    await s.handle(request({ id: "x", op, input, confirmed }));
    return frames;
  };
  const live = { recordingOn: true, grants: [] };
  const refused = (await run("friends.add", { fingerprint: friend.fingerprint }, live, false)).find((f) => f.type === ERROR);
  ok(refused && refused.needsConfirm, "friends.add without a confirm → refused, needs a fresh confirmation");
  const added = (await run("friends.add", { fingerprint: friend.fingerprint, label: "yes them" }, live, true)).find((f) => f.type === FRAME && f.added);
  ok(!!added, "friends.add WITH a confirm enrolls");
  const signed = await packTransfer("poll", "kept over the line", friend);
  const incog = (await run("carrier.accept", { signed, journey: { dents: 0 } }, { recordingOn: false, grants: [] }, true)).find((f) => f.type === ERROR);
  ok(incog && /incognito/.test(incog.reason), "carrier.accept in incognito → refused (persistence is off)");
  const kept = (await run("carrier.accept", { signed, journey: { dents: 2 } }, live, true)).find((f) => f.type === FRAME && f.ok);
  ok(kept && kept.grade === "friend", "carrier.accept with a confirm keeps it, graded FRIEND");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall accept tests passed");
