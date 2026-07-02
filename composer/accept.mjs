// composer/accept.mjs — whom you trust and what you keep (docs/anti-signature.md, docs/offline-transfer.md).
// Two ideas, one store, in the consent.mjs house style:
//
//   1. THE FRIEND LIST. `trusted` has been a demo array until now; this is where it becomes real. An
//      enrollment records a signer you decided to trust — fingerprint, your label for them, when, and how
//      you met (first-contact is the origin story; docs/origin.md). Enrolling is a knowing act (Rung 1 —
//      one friend, one confirm); the list is what verifyTransfer/verifyModule check `trusted` against.
//
//   2. THE ACCEPT. Catching a transfer makes it SEEABLE; accepting it makes it KEPT. Accept re-verifies the
//      envelope (never trust the caller), grades it on the ladder — MINE (my own signature came back to me),
//      FRIEND (an enrolled signer), ANONYMOUS (verifies as someone's, trusted by no one) — and commits the
//      exact caught bytes with a SIGNED encounter record: "I met this, thus dented, on this day." The
//      journey (dents healed, foreign tiles, the layout it claimed) rides inside my signature — the
//      attestation of an anti-attestation. Grade confers NO privilege; it is the honest label later
//      policy reads. An anonymous accept is a copy you chose to keep, nothing more.
//
// Pure core: takes a `store` ({get,set,delete}) and never reaches the network. The accept record is signed
// with the same primitive that signs anecdotes (sign.attest) — your encounter log is yours, verifiably.

import { attest, verifyAttestation } from "./sign.mjs";
import { verifyTransfer, transferId } from "./transfer.mjs";

export const FRIEND = "anecdote.friend/v1";
export const ACCEPT = "anecdote.accept/v1";
const FRIENDS_KEY = "anecdote:friends";
const ACCEPTED_KEY = "anecdote:accepted";

// ---- 1. the friend list -------------------------------------------------------------------------------

export function friendsList(store) {
  const load = async () => (await store.get(FRIENDS_KEY)) || [];
  return {
    async add(fingerprint, { label = "", how = "first-contact", now } = {}) {
      if (!fingerprint || typeof fingerprint !== "string") throw new Error("accept: a friend is a fingerprint");
      const all = await load();
      if (all.some((f) => f.fingerprint === fingerprint)) return { added: false, count: all.length };
      all.push({ schema: FRIEND, fingerprint, label, how, enrolledAt: now || new Date().toISOString() });
      await store.set(FRIENDS_KEY, all);
      return { added: true, count: all.length };
    },
    async remove(fingerprint) {
      const all = await load();
      const kept = all.filter((f) => f.fingerprint !== fingerprint);
      await store.set(FRIENDS_KEY, kept);
      return { removed: kept.length !== all.length, count: kept.length };
    },
    async has(fingerprint) { return (await load()).some((f) => f.fingerprint === fingerprint); },
    async list() { return load(); },
    async fingerprints() { return (await load()).map((f) => f.fingerprint); },
  };
}

// ---- 2. the accept ------------------------------------------------------------------------------------

// Grade a verified transfer on the ladder. (HEARSAY — a friend relaying someone else's — needs relay
// provenance the carrier doesn't attach yet; when it does, the grade slots in between.)
const gradeOf = (v, myFingerprint) => (v.by === myFingerprint ? "mine" : v.trusted ? "friend" : "anonymous");

// Accept a caught transfer into the trove. `journey` is what THIS receiver observed while catching —
// { dents, foreign, layout } from the carrier session's snapshot — embedded in MY signed record: it is my
// attestation of the encounter, not a claim about the sender. Returns { ok, grade, id, record } or
// { ok:false, errors } — an envelope that does not verify is never committed.
export async function accept(signed, journey, { identity, store, now } = {}) {
  if (!identity || !store) throw new Error("accept: needs an identity and a store");
  const friends = friendsList(store);
  const v = await verifyTransfer(signed, { friends: await friends.fingerprints() });
  if (!v.ok) return { ok: false, grade: null, id: null, record: null, errors: v.errors };
  const id = await transferId(signed);
  const all = (await store.get(ACCEPTED_KEY)) || [];
  if (all.some((a) => a.record.id === id)) return { ok: true, grade: all.find((a) => a.record.id === id).record.grade, id, record: null, duplicate: true };
  const record = await attest({
    schema: ACCEPT,
    id, kind: signed.kind, by: v.by,
    grade: gradeOf(v, identity.fingerprint),
    journey: { dents: journey?.dents ?? 0, foreign: journey?.foreign ?? 0, layout: journey?.layout ?? null },
    at: now || new Date().toISOString(),
  }, identity);
  all.push({ record, signed });                       // keep the exact caught bytes — the film
  await store.set(ACCEPTED_KEY, all);
  return { ok: true, grade: record.grade, id, record };
}

export async function acceptedList(store) { return (await store.get(ACCEPTED_KEY)) || []; }

// An accept record is itself verifiable — anyone holding your encounter log can check you really wrote it.
export async function verifyAccept(record) {
  const v = await verifyAttestation(record, {});
  return { ok: v.ok && record.schema === ACCEPT, by: v.by, errors: v.errors || [] };
}

// ---- probe-line capabilities ---------------------------------------------------------------------------
// friends.add and carrier.accept are Rung 1 + persist (one act, one confirm; incognito refuses them);
// friends.list is Rung 0. The chamber hands over a caught transfer + its observed journey; identity and
// the store stay Elevated.
export function acceptOps({ identity, store } = {}) {
  const friends = friendsList(store);
  return {
    "friends.add": async (input, api) => { api.emit(await friends.add((input || {}).fingerprint, input || {})); },
    "friends.list": async (_input, api) => { api.emit({ friends: await friends.list() }); },
    "carrier.accept": async (input, api) => {
      const r = await accept((input || {}).signed, (input || {}).journey, { identity, store });
      api.emit({ ok: r.ok, grade: r.grade, id: r.id, duplicate: !!r.duplicate, errors: r.errors || [] });
    },
  };
}
