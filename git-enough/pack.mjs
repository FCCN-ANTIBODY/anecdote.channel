// git-enough/pack.mjs — v2 packfiles (Milestone: Origin, phase 2). The storage-and-push prerequisite:
// a set of objects serialized into the one format git transfers over the wire.
//
// We emit BASE objects only (no delta compression). A packfile of all-base objects is fully valid — git
// `index-pack`/`unpack-objects`/`verify-pack` accept it; deltas are only a size optimization we can add
// later. Everything native: the object bodies are zlib via CompressionStream (reused from objects.mjs),
// the trailer is SHA-1 via crypto.subtle.
//
// v2 layout:  "PACK" | u32 version(2) | u32 count | (objHeader ++ zlib(content))* | 20-byte SHA-1(all-prior)
//   objHeader: varint where the FIRST byte is [msb=more][3 bits type][4 bits size-low], then 7-bit LE
//              groups for the rest of the (uncompressed) size. Types: commit 1, tree 2, blob 3, tag 4.

import { deflate } from "./objects.mjs";

const TYPE = { commit: 1, tree: 2, blob: 3, tag: 4 };
const enc = new TextEncoder();

function concat(parts) {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// The per-object type+size varint. size is the UNCOMPRESSED content length. Division (not >>) so sizes
// beyond 2^31 stay correct.
export function objHeader(type, size) {
  const out = [];
  let b = (type << 4) | (size & 0x0f);
  size = Math.floor(size / 16);
  while (size > 0) { out.push(b | 0x80); b = size & 0x7f; size = Math.floor(size / 128); }
  out.push(b);
  return Uint8Array.from(out);
}

// Serialize objects ([{ type, content }], content = raw object bytes, NOT framed) into a v2 packfile.
export async function packObjects(objects) {
  const header = new Uint8Array(12);
  header.set(enc.encode("PACK"), 0);
  const dv = new DataView(header.buffer);
  dv.setUint32(4, 2, false);              // version 2 (big-endian)
  dv.setUint32(8, objects.length, false); // object count
  const parts = [header];
  for (const o of objects) {
    if (!(o.type in TYPE)) throw new Error(`pack: unknown object type ${o.type}`);
    parts.push(objHeader(TYPE[o.type], o.content.length));
    parts.push(await deflate(o.content));  // zlib(content); the header already carried type+size
  }
  const body = concat(parts);
  const sha = new Uint8Array(await crypto.subtle.digest("SHA-1", body));
  return concat([body, sha]);             // trailer = SHA-1 of everything before it
}

// Pack every object a repo holds (any order is fine for base objects).
export async function packRepo(repo) {
  return packObjects([...repo.objects.values()]);
}

// The pack's own checksum (its git name), as hex — the last 20 bytes of the pack.
export function packChecksum(pack) {
  return [...pack.subarray(pack.length - 20)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
