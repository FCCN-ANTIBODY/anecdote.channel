// composer/sneakernet.mjs — THE SNEAKERNET (civic-node #72; docs/dark-mode.md "from polling pull to
// cascading push"). Everyone carries the last snapshots they saw — not even in agreement, but all
// signed, all stamped — and drops off whatever is NEWER THAN YOURS, in stacks: every Atlas they
// carry, offered as one gesture, to goddamn anybody. This module is the pure innards: it composes
// atlas.snapshot/v1 (the record an Atlas signs — atlas bin/snapshot, "real at one time") with
// transfer.mjs's three concerns, adding only the sneakernet's own law:
//
//   the STACK    — each carried snapshot rides as a carrier-signed transfer (kind "atlas.snapshot";
//                  the envelope's `by` is the drop-off provenance — who handed it over, never
//                  identity theater), and the whole set is layout-attested (packLayout), so an
//                  intruder tile or a missing one is caught by the set, not the eye.
//   the DROP-OFF — per canonical Atlas (id + the Atlas's own signer), take the newer stamp, keep
//                  yours where yours is newer, NEVER regress; a copy under a different signer never
//                  replaces the canon in hand (a new canon is a decision, not a drop-off).
//   the MASK     — delivering your whole set is possible but DELIBERATE; the ordinary offer is the
//                  constituency bisect's move: intersect what you both carry and offer the overlap.
//
// Chaos-tolerant by law (atlas CONSTITUTION "my record is one record, reachable or not"): the soup
// of stale-but-once-true dates converges because every copy is signed and stamped — verification is
// from anyone; the friend list gates action only. No new crypto; no clocks minted here (dates come
// stamped inside the snapshots; `now` for accepted_at is the caller's claim). One hop of carrying —
// what you took is now yours to offer, no transitive claims.

import { attest, verifyAttestation, canonicalize } from "./sign.mjs";
import { defaultHash } from "./anecdote.mjs";
import { packTransfer, verifyTransfer, packLayout, verifyLayout } from "./transfer.mjs";

export const SNAPSHOT_SCHEMA = "atlas.snapshot/v1";   // what an Atlas signs (atlas bin/snapshot)
export const KEPT_SCHEMA = "atlas.snapshot-kept/v1";  // what a device keeps (both dates, honest)
export const STACK_KIND = "atlas.snapshot";           // the transfer kind a carried snapshot rides as
const te = new TextEncoder(), td = new TextDecoder();

// ---- the record itself: verify-from-anyone (mirrors atlas bin/snapshot verifySnapshot) ----------------
export async function verifySnapshotRecord(snapshot, { signer = null } = {}) {
  if (!snapshot || snapshot.schema !== SNAPSHOT_SCHEMA) return { ok: false, trusted: false, errors: ["not an atlas.snapshot/v1"] };
  const att = await verifyAttestation(snapshot, {});
  if (!att.ok) return { ok: false, trusted: false, by: att.by, errors: att.errors };
  for (const f of snapshot.files || []) {
    if (await defaultHash(te.encode(f.content ?? "")) !== f.id)
      return { ok: false, trusted: false, by: att.by, errors: [`content-id mismatch at ${f.path}`] };
  }
  if (!snapshot.at || Number.isNaN(Date.parse(snapshot.at))) return { ok: false, trusted: false, by: att.by, errors: ["no verifiable date stamp"] };
  return { ok: true, trusted: !!signer && att.by === signer, by: att.by, at: snapshot.at, atlas: snapshot.atlas };
}

// two copies of ONE canon (same atlas, same signer) order by their stamped dates; anything else is
// two canons — never two dates of one.
export function newerOf(a, b) {
  if (a.atlas !== b.atlas || a.sig?.by !== b.sig?.by) return { comparable: false };
  const ta = Date.parse(a.at), tb = Date.parse(b.at);
  return { comparable: true, newer: tb > ta ? "b" : ta > tb ? "a" : "same" };
}

// ---- the mask: intersect memberships before offering; the full stack is a deliberate act --------------
export function maskCarried(snapshots, sharedAtlasIds) {
  const overlap = new Set(sharedAtlasIds || []);
  return (snapshots || []).filter((s) => overlap.has(s?.atlas));
}

// ---- the stack: verify -> dedup newest-per-canon -> carrier-signed tiles + a layout over the set -------
export async function packStack(snapshots, identity, { shape = {}, ...opts } = {}) {
  // a carrier attests only what verifies — never a freshness (or a record) someone else didn't stamp.
  const byCanon = new Map(); // atlas|signer -> newest verified snapshot
  const refused = [];
  for (const s of snapshots || []) {
    const v = await verifySnapshotRecord(s);
    if (!v.ok) { refused.push({ atlas: s?.atlas ?? null, why: v.errors.join("; ") }); continue; }
    const key = `${s.atlas}|${s.sig.by}`;
    const kept = byCanon.get(key);
    if (!kept || newerOf(kept, s).newer === "b") byCanon.set(key, s);
  }
  const members = [...byCanon.values()];
  const tiles = [];
  for (const s of members) tiles.push(await packTransfer(STACK_KIND, JSON.stringify(s), identity, opts));
  const layout = await packLayout(tiles, identity, { shape: { ...shape, atlases: members.map((s) => s.atlas).sort() }, ...opts });
  return { layout, tiles, carried: members.map((s) => s.atlas).sort(), refused };
}

// ---- the drop-off: merge a received stack into what you keep; newest per canon; never regress ----------
// kept: the device's kept copies (array of atlas.snapshot-kept/v1). Returns the new kept array plus
// the honest account of what happened to every tile — taken / already-newer / refused, all named.
export async function receiveStack({ layout, tiles }, kept = [], { now, friends = [], pins = {} } = {}) {
  if (!now) throw new Error("sneakernet: receiveStack needs `now` — accepted_at is the receiver's own claim");
  const lay = await verifyLayout(layout, tiles, { friends });
  if (!lay.ok) return { kept, taken: [], keptNewer: [], refused: [{ why: "layout: " + lay.errors.join("; ") }], layout: lay };
  // an incomplete or intruded set still yields its VALID members — the layout names what was off.

  const attested = new Set((layout.members || []).map((m) => m.hash));
  const keptBy = new Map(kept.map((k) => [k.atlas, k]));
  const taken = [], keptNewer = [], refused = [];
  for (const tile of tiles) {
    const t = await verifyTransfer(tile, { friends });
    if (!t.ok || t.kind !== STACK_KIND) { refused.push({ why: "tile: " + (t.errors?.join("; ") || "wrong kind") }); continue; }
    const id = await defaultHash(te.encode(canonicalize(tile)));
    if (!attested.has(id)) { refused.push({ why: "intruder tile — not an attested member of the layout" }); continue; }
    let snapshot;
    try { snapshot = JSON.parse(td.decode(t.bytes)); } catch { refused.push({ why: "tile payload is not JSON" }); continue; }
    const v = await verifySnapshotRecord(snapshot, { signer: pins[snapshot?.atlas] || null });
    if (!v.ok) { refused.push({ atlas: snapshot?.atlas ?? null, why: v.errors.join("; ") }); continue; }

    const have = keptBy.get(snapshot.atlas);
    if (!have) {
      // first contact: the pin (if the caller holds one) gates it; otherwise trust-on-first-contact.
      if (pins[snapshot.atlas] && !v.trusted) { refused.push({ atlas: snapshot.atlas, why: `signed by ${v.by}, not the pinned ${pins[snapshot.atlas]}` }); continue; }
    } else {
      if (have.snapshot?.sig?.by !== snapshot.sig?.by) { refused.push({ atlas: snapshot.atlas, why: "different signer than the kept canon — a new canon is a decision, not a drop-off" }); continue; }
      const c = newerOf(have.snapshot, snapshot);
      if (c.newer !== "b") { keptNewer.push({ atlas: snapshot.atlas, kept_at: have.stamped_at, offered_at: snapshot.at }); continue; }
    }
    const keptCopy = { schema: KEPT_SCHEMA, atlas: snapshot.atlas, stamped_at: snapshot.at, accepted_at: now,
      by: v.by, carried_by: t.by, snapshot };
    keptBy.set(snapshot.atlas, keptCopy);
    taken.push({ atlas: snapshot.atlas, stamped_at: snapshot.at, carried_by: t.by });
  }
  return { kept: [...keptBy.values()], taken, keptNewer, refused, layout: lay };
}

// convenience for the exchange gesture: what each side would OFFER the other under the mask — the
// atlases you both carry (the ordinary offer), with the full-set offer left a deliberate act.
export function overlapOf(mineCarried, theirsCarried) {
  const theirs = new Set(theirsCarried || []);
  return (mineCarried || []).filter((a) => theirs.has(a)).sort();
}
