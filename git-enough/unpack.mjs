// git-enough/unpack.mjs — reading a packfile (Milestone: Origin, the Castle read-side). The INVERSE of
// pack.mjs, and it points the other way: send-pack pushes us→downstream; this ingests downstream→us, the
// one-time bootstrap fetch that adopts a GitHub repo's FULL history into our offline origin (The Castle).
//
// Real packs from GitHub are DELTIFIED, so unlike writing (where we emit base objects), reading must
// resolve OFS_DELTA (base by in-pack offset) and REF_DELTA (base by oid) and apply the copy/insert delta
// instructions. Every reconstructed object is checked: its SHA-1 must equal git's oid.
//
// Byte-accurate zlib: a pack concatenates zlib members with no length prefix, so the reader must know how
// many COMPRESSED bytes each member consumed to find the next object. The default `inflate` seam is
// ./inflate.mjs — browser-native (DecompressionStream + gallop/binary-search on the member boundary), so
// there is no vendored zlib and no runtime split. A faster inflate (e.g. Node's _processChunk) can still
// be injected via { inflate }.

import { oid } from "./objects.mjs";
import { inflate as nativeInflate } from "./inflate.mjs";

const TYPE_NAME = { 1: "commit", 2: "tree", 3: "blob", 4: "tag" };
const dec = new TextDecoder();

function hex(bytes) { return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join(""); }

// The per-object type+size varint (inverse of pack.objHeader): first byte [type in 6-4][size low 4],
// then 7-bit little-endian groups. Returns { type, size, off }.
export function readObjHeader(buf, off) {
  let c = buf[off++];
  const type = (c >> 4) & 7;
  let size = c & 0x0f, shift = 4;
  while (c & 0x80) { c = buf[off++]; size += (c & 0x7f) * 2 ** shift; shift += 7; }
  return { type, size, off };
}

// The OFS_DELTA base-offset varint (a different, self-incrementing encoding). base = objectStart - offset.
function readOfsBase(buf, off) {
  let c = buf[off++], offset = c & 0x7f;
  while (c & 0x80) { c = buf[off++]; offset = (offset + 1) * 128 + (c & 0x7f); }
  return { offset, off };
}

// Apply a git delta (as produced inside OFS/REF_DELTA) to a base buffer → the target buffer.
// Format: srcSize varint, dstSize varint, then ops — copy (MSB set: selective offset/size bytes) or
// insert (MSB clear: op is the literal length, followed by that many bytes).
export function applyDelta(base, delta) {
  let p = 0;
  const varint = () => { let x = 0, s = 0, c; do { c = delta[p++]; x += (c & 0x7f) * 2 ** s; s += 7; } while (c & 0x80); return x; };
  varint();                              // source size (unused beyond a sanity anchor)
  const dstSize = varint();
  const out = new Uint8Array(dstSize);
  let o = 0;
  while (p < delta.length) {
    const op = delta[p++];
    if (op & 0x80) {                     // copy from base
      let offset = 0, size = 0;
      if (op & 0x01) offset += delta[p++];
      if (op & 0x02) offset += delta[p++] * 256;
      if (op & 0x04) offset += delta[p++] * 65536;
      if (op & 0x08) offset += delta[p++] * 16777216;
      if (op & 0x10) size += delta[p++];
      if (op & 0x20) size += delta[p++] * 256;
      if (op & 0x40) size += delta[p++] * 65536;
      if (size === 0) size = 0x10000;
      out.set(base.subarray(offset, offset + size), o); o += size;
    } else if (op) {                     // insert literal
      out.set(delta.subarray(p, p + op), o); o += op; p += op;
    } else throw new Error("unpack: invalid delta opcode 0");
  }
  if (o !== dstSize) throw new Error(`unpack: delta produced ${o} bytes, expected ${dstSize}`);
  return out;
}

// Read a whole v2 packfile into a Map oid -> { type, content }. `inflate(bytes, offset)` must inflate the
// zlib member at `offset` and return { content, consumed }.
export async function readPack(bytes, { inflate = nativeInflate } = {}) {
  if (typeof inflate !== "function") throw new Error("unpack: inflate must be a function");
  if (dec.decode(bytes.subarray(0, 4)) !== "PACK") throw new Error("unpack: not a PACK file");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = dv.getUint32(4, false), count = dv.getUint32(8, false);
  if (version !== 2) throw new Error(`unpack: unsupported pack version ${version}`);

  // Pass 1: slurp raw entries (still zlib-inflated bodies; deltas unresolved), indexed by their offset.
  let off = 12;
  const entries = [];
  const byOffset = new Map();
  for (let i = 0; i < count; i++) {
    const start = off;
    const h = readObjHeader(bytes, off); off = h.off;
    let baseOff = null, baseRef = null;
    if (h.type === 6) { const b = readOfsBase(bytes, off); off = b.off; baseOff = start - b.offset; }
    else if (h.type === 7) { baseRef = hex(bytes.subarray(off, off + 20)); off += 20; }
    const { content, consumed } = await inflate(bytes, off);
    off += consumed;
    const e = { start, type: h.type, body: content, baseOff, baseRef, resolved: null };
    entries.push(e); byOffset.set(start, e);
  }

  // Pass 2: resolve. Bases: OFS by offset (an earlier entry), REF by oid (must already be known). Deltas
  // may chain, so resolveEntry recurses; a fixpoint loop mops up any REF whose base resolves later.
  const objects = new Map();
  const oidIndex = new Map();
  async function resolveEntry(e) {
    if (e.resolved) return e.resolved;
    let typeName, content;
    if (e.type <= 4) { typeName = TYPE_NAME[e.type]; content = e.body; }
    else {
      const base = e.type === 6 ? await resolveEntry(byOffset.get(e.baseOff))
                                : await resolveEntry(need(oidIndex.get(e.baseRef), e.baseRef));
      typeName = base.typeName; content = applyDelta(base.content, e.body);
    }
    const id = await oid(typeName, content);
    e.resolved = { typeName, content, oid: id };
    oidIndex.set(id, e); objects.set(id, { type: typeName, content });
    return e.resolved;
  }
  const need = (v, ref) => { if (!v) { const err = new Error("defer"); err.ref = ref; throw err; } return v; };

  // resolve everything that isn't a bare REF_DELTA first (populates oidIndex), then loop over REF_DELTAs.
  for (const e of entries) if (e.type !== 7) await resolveEntry(e);
  let pending = entries.filter((e) => !e.resolved);
  while (pending.length) {
    let progress = false;
    const still = [];
    for (const e of pending) {
      try { await resolveEntry(e); progress = true; }
      catch (err) { if (err.ref) still.push(e); else throw err; }
    }
    if (!progress) throw new Error(`unpack: unresolved REF_DELTA base(s) — thin pack? (${still.length} left)`);
    pending = still;
  }

  return { objects, count, version };
}
