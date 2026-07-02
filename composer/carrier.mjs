// composer/carrier.mjs — the camera-fluent brain of offline transfer (docs/offline-transfer.md). This is the
// layer between the raw carrier (a QR/tile decoder) and the transfer innards (composer/transfer.mjs). It
// does NOT touch pixels or the camera — it takes DECODED frame strings (whatever a QR yields) and:
//   - learns the expected SHAPE from the earliest frame (any one tile names its set), so the app can put the
//     shape in front of the user for judgment BEFORE the whole thing finishes decoding;
//   - tolerates out-of-order and duplicate frames (a camera catches them however it catches them);
//   - flags a FOREIGN tile the moment the set's shape is known (an intruder QR on the side);
//   - completes into reassembled, ready-to-verify transfers.
// Decoder-agnostic on purpose (BarcodeDetector is absent on iOS/Linux — we bring our own decoder later; this
// brain is the same regardless of which decoder feeds it).
//
// Frame wire format (magic-prefixed so a decode is instantly recognizable as one of ours):
//   block:   AC1|b|<layoutShort|-|>|<memberId>|<i>|<n>|<base64 chunk>
//   layout:  AC1|L|<layoutShort>|<base64 of the signed layout JSON>   (the "physical checksum" tile)
// A `block` is one brick of a member transfer (from transfer.chunk); a `layout` tile carries the signed set
// manifest. `memberId` is the full transfer id (so reassembly re-checks the whole-payload checksum);
// `layoutShort` is a short grouping key (integrity is the layout's signature, not this key).

import { reassemble, verifyLayout, verifyTransfer, transferId, chunk, BLOCK } from "./transfer.mjs";

export const MAGIC = "AC1";
const td = new TextDecoder();

const short = (id) => String(id).replace(/^sha256:/, "").slice(0, 16);
const b64 = (u8) => (typeof Buffer !== "undefined" ? Buffer.from(u8).toString("base64") : btoa(String.fromCharCode(...u8)));

// ---- encode (render side): turn transfers into frame strings a carrier will draw ----------------------

// Frames for one (possibly chunked) transfer. `layoutShort` groups it into a set (omit for a standalone).
export async function frameTransfer(signed, capacity, { layoutShort = "-" } = {}) {
  const blocks = await chunk(signed, capacity);
  return blocks.map((bk) => [MAGIC, "b", layoutShort, bk.t, bk.i, bk.n, bk.b].join("|"));
}

// The layout tile — the signed set manifest, as a frame. Returns { frame, layoutShort }.
export async function frameLayout(layoutSigned) {
  const layoutShort = short(await transferId(layoutSigned));
  const payload = b64(new TextEncoder().encode(JSON.stringify(layoutSigned)));
  return { frame: [MAGIC, "L", layoutShort, payload].join("|"), layoutShort };
}

// ---- parse (scan side): one decoded string -> a structured frame, or null if not ours -----------------

export function parseFrame(str) {
  if (typeof str !== "string" || !str.startsWith(MAGIC + "|")) return null;
  const p = str.split("|");
  if (p[1] === "b" && p.length === 7) {
    const [, , layoutShort, memberId, i, n, b] = p;
    if (!/^\d+$/.test(i) || !/^\d+$/.test(n)) return null;
    return { type: "block", layoutShort: layoutShort === "-" ? null : layoutShort, block: { schema: BLOCK, t: memberId, i: +i, n: +n, b } };
  }
  if (p[1] === "L" && p.length === 4) {
    const [, , layoutShort, payload] = p;
    try { return { type: "layout", layoutShort, layout: JSON.parse(td.decode(unb64(payload))) }; }
    catch { return null; }
  }
  return null;
}

// ---- the accumulator: feed decoded frames, watch the shape emerge, complete + verify ------------------

export function carrierSession({ friends = [] } = {}) {
  let layout = null, layoutShort = null, expected = null;   // expected: { count, memberIds:Set } from the layout
  const members = new Map();   // memberId -> { total, chunks: Map<i,block>, done, bytes }
  const foreign = [];          // frames that don't belong: not ours, wrong set, or not an attested member

  const memberOf = (id) => { if (!members.has(id)) members.set(id, { total: null, chunks: new Map(), done: false, bytes: null }); return members.get(id); };
  const isForeignMember = (id) => expected && !expected.memberIds.has(id);

  function snapshot() {
    return {
      haveLayout: !!layout, layoutShort,
      expected: expected ? { count: expected.count } : null,        // the SHAPE, as soon as the layout tile lands
      present: [...members].map(([id, m]) => ({ id: short(id), have: m.chunks.size, total: m.total, done: m.done, foreign: isForeignMember(id) })),
      foreign: foreign.slice(),
      complete: isComplete(),
    };
  }

  function isComplete() {
    if (layout) {                                                    // a set: every attested member fully in
      if (![...expected.memberIds].every((id) => members.get(id)?.done)) return false;
      return true;
    }
    // standalone (no layout tile): complete when we have at least one member and all seen members are done
    return members.size > 0 && [...members.values()].every((m) => m.done);
  }

  async function tryFinishMember(id) {
    const m = members.get(id);
    if (m.done || m.total == null || m.chunks.size < m.total) return;
    const r = await reassemble([...m.chunks.values()]);
    if (r.ok) { m.done = true; m.bytes = r.bytes; } else if (r.corrupt) foreign.push({ reason: "corrupt member (checksum failed)", id: short(id) });
  }

  async function feed(frameStr) {
    const f = parseFrame(frameStr);
    if (!f) { foreign.push({ reason: "not a carrier frame" }); return snapshot(); }

    if (f.type === "layout") {
      if (layoutShort && f.layoutShort !== layoutShort) { foreign.push({ reason: "a different set's layout tile", id: f.layoutShort }); return snapshot(); }
      const v = await verifyLayout(f.layout, [], { friends });      // signature/shape now; members checked as they arrive
      if (!v.ok) { foreign.push({ reason: "layout tile signature invalid" }); return snapshot(); }
      layout = f.layout; layoutShort = f.layoutShort;
      expected = { count: (layout.members || []).length, memberIds: new Set((layout.members || []).map((mm) => mm.hash)) };
      // any members already collected that aren't attested are now provably interlopers
      for (const id of members.keys()) if (isForeignMember(id)) foreign.push({ reason: "interloper tile (not in the attested set)", id: short(id) });
      return snapshot();
    }

    // block
    if (f.layoutShort && layoutShort && f.layoutShort !== layoutShort) { foreign.push({ reason: "brick from a different set", id: short(f.block.t) }); return snapshot(); }
    if (isForeignMember(f.block.t)) { foreign.push({ reason: "interloper tile (not in the attested set)", id: short(f.block.t) }); return snapshot(); }
    if (!layoutShort && f.layoutShort) layoutShort = f.layoutShort;  // learn the grouping key from a brick before the layout tile
    const m = memberOf(f.block.t);
    m.total = f.block.n;
    m.chunks.set(f.block.i, f.block);
    await tryFinishMember(f.block.t);
    return snapshot();
  }

  // Once complete, verify: the layout (trusted signer? interlopers?) and each member transfer.
  async function result() {
    if (!isComplete()) return { ok: false, reason: "incomplete", snapshot: snapshot() };
    const transfers = [];
    for (const id of (expected ? expected.memberIds : members.keys())) {
      const m = members.get(id);
      const signed = JSON.parse(td.decode(m.bytes));
      transfers.push({ signed, verify: await verifyTransfer(signed, { friends }) });
    }
    const layoutCheck = layout ? await verifyLayout(layout, transfers.map((t) => t.signed), { friends }) : null;
    return { ok: true, layout: layoutCheck, transfers, foreign: foreign.slice() };
  }

  return { feed, snapshot, result };
}

function unb64(s) { if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(s, "base64")); const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
