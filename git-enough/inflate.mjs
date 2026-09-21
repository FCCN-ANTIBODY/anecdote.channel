// git-enough/inflate.mjs — byte-accurate zlib inflate, browser-native, closing the Castle's one gap.
//
// A packfile concatenates zlib members with no length prefix, so a pack reader must know how many
// COMPRESSED bytes each member consumed to find the next object. The browser's `DecompressionStream`
// won't report that — but it is strict in a way we can exploit: fed a prefix of the remaining pack it
// gives one of three monotonic outcomes —
//     too short  → rejects ("unexpected end of the compressed stream")
//     exact      → resolves (the whole member, and only the member)
//     too long   → rejects ("Trailing junk found after the end of the compressed stream")
// — which was the whole method until 2026-09-21, when it met Chrome: read through `Response`, Chrome
// says "Failed to fetch" for BOTH failures, so every overshoot read as too-short and the gallop ran off the
// end of the pack. The boundary is now found from the member's own Adler-32 trailer (below), with the
// engine's wording -- read through a reader, where it survives -- only as a fallback. No vendored zlib.

function concat(chunks) {
  let n = 0; for (const c of chunks) n += c.length;
  const out = new Uint8Array(n); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// Probe one candidate member. Reads the decompressed stream with a READER rather than through
// `new Response(...).arrayBuffer()`: the Response path collapses every failure into "Failed to fetch" in
// Chrome (measured, Chrome 153) and discards whatever was already produced. The reader keeps both --
// the output so far, and the engine's real error. → { ok, out, msg }.
async function probe(slice) {
  const reader = new Blob([slice]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  const chunks = []; let msg = null;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); } }
  catch (e) { msg = String((e && (e.code || e.name)) || "") + " " + String((e && e.message) || e); }
  return { ok: msg === null, out: concat(chunks), msg };
}

// A zlib member ends with the Adler-32 of its uncompressed bytes, big-endian. That is a boundary marker
// the engine cannot mis-report: however a probe fails, the bytes it produced tell us where the member
// ends if it ended inside the probe at all.
function adler32(bytes) {
  let a = 1, b = 0;
  for (let i = 0; i < bytes.length; i++) { a = (a + bytes[i]) % 65521; b = (b + a) % 65521; }
  return [(b >>> 8) & 255, b & 255, (a >>> 8) & 255, a & 255];
}
function lastIndexOf4(hay, [x0, x1, x2, x3]) {
  for (let i = hay.length - 4; i >= 0; i--) if (hay[i] === x0 && hay[i + 1] === x1 && hay[i + 2] === x2 && hay[i + 3] === x3) return i;
  return -1;
}

// The engine's own words, where it has any. Node says Z_BUF_ERROR / ERR_TRAILING_JUNK_AFTER_STREAM_END;
// Chrome (via a reader) says "Compressed input was truncated." / "Junk found after end of compressed
// data." Used only as a fallback when the Adler-32 route did not settle it.
const LONG = /trailing|junk|after (the )?end|extra bytes/i;
const SHORT = /truncated|unexpected end|Z_BUF_ERROR|incomplete/i;

// Inflate the zlib member beginning at `offset`. Returns { content, consumed } -- consumed is the exact
// compressed length of that member, so the caller advances to the next object.
//
// Measured before this was written (2026-09-21): Chrome and Node both flush the WHOLE output of a member
// before raising either error, so once a probe reaches past the member the Adler-32 of what came out is
// sitting in the slice, and the boundary is that index + 4. The candidate is confirmed by probing exactly
// that length, which must resolve cleanly -- a chance 4-byte collision earlier in the stream fails that
// check and the search continues.
export async function inflate(bytes, offset) {
  const rest = bytes.subarray(offset);
  if (!rest.length) throw new Error("inflate: nothing at offset");

  let lo = 1, hi = Math.min(32, rest.length);
  for (;;) {
    const r = await probe(rest.subarray(0, hi));
    if (r.ok) return { content: r.out, consumed: hi };
    if (r.out.length) {
      const at = lastIndexOf4(rest.subarray(0, hi), adler32(r.out));
      if (at >= 0) {
        const exact = at + 4;
        const c = await probe(rest.subarray(0, exact));
        if (c.ok) return { content: c.out, consumed: exact };
      }
    }
    if (LONG.test(r.msg)) break;                          // the member ended inside hi; bracket it below
    if (hi >= rest.length) throw new Error("inflate: stream did not terminate within the buffer (" + r.msg.trim() + ")");
    lo = hi + 1; hi = Math.min(hi * 2, rest.length);      // short, or unclassifiable: grow
  }

  // Fallback: binary-search [lo, hi] on the engine's wording alone.
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = await probe(rest.subarray(0, mid));
    if (r.ok) return { content: r.out, consumed: mid };
    if (LONG.test(r.msg)) hi = mid - 1; else if (SHORT.test(r.msg)) lo = mid + 1;
    else throw new Error("inflate: cannot classify this engine's error: " + r.msg.trim());
  }
  throw new Error("inflate: could not locate the zlib member boundary");
}
