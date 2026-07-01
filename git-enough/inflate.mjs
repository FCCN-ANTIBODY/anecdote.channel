// git-enough/inflate.mjs — byte-accurate zlib inflate, browser-native, closing the Castle's one gap.
//
// A packfile concatenates zlib members with no length prefix, so a pack reader must know how many
// COMPRESSED bytes each member consumed to find the next object. The browser's `DecompressionStream`
// won't report that — but it is strict in a way we can exploit: fed a prefix of the remaining pack it
// gives one of three monotonic outcomes —
//     too short  → rejects ("unexpected end of the compressed stream")
//     exact      → resolves (the whole member, and only the member)
//     too long   → rejects ("Trailing junk found after the end of the compressed stream")
// — so we GALLOP to bracket the boundary, then BINARY-SEARCH the single exact length. O(log n) inflate
// attempts, no vendored zlib. Works identically in the browser and in Node (both have DecompressionStream).

function concat(chunks) {
  let n = 0; for (const c of chunks) n += c.length;
  const out = new Uint8Array(n); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// Try to inflate exactly `slice` as one zlib member. → { ok:true, out } | { ok:false, kind:"short"|"long" }.
async function tryMember(slice) {
  try {
    const buf = await new Response(new Blob([slice]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer();
    return { ok: true, out: new Uint8Array(buf) };
  } catch (e) {
    const msg = String((e && e.message) || e);
    const long = /trailing/i.test(msg) || e?.code === "ERR_TRAILING_JUNK_AFTER_STREAM_END";
    return { ok: false, kind: long ? "long" : "short" };
  }
}

// Inflate the zlib member beginning at `offset`. Returns { content, consumed } — consumed is the exact
// compressed length of that member, so the caller advances to the next object.
export async function inflate(bytes, offset) {
  const rest = bytes.subarray(offset);
  if (!rest.length) throw new Error("inflate: nothing at offset");

  // Gallop: double the probe until it is exact (lucky) or overshoots (too long); track the last too-short.
  let lo = 1, hi = Math.min(32, rest.length);
  for (;;) {
    const r = await tryMember(rest.subarray(0, hi));
    if (r.ok) return { content: r.out, consumed: hi };
    if (r.kind === "long") break;                       // member length is < hi
    if (hi >= rest.length) throw new Error("inflate: stream did not terminate within the buffer");
    lo = hi + 1; hi = Math.min(hi * 2, rest.length);    // still too short → grow
  }

  // Binary-search [lo, hi] for the single exact length.
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = await tryMember(rest.subarray(0, mid));
    if (r.ok) return { content: r.out, consumed: mid };
    if (r.kind === "short") lo = mid + 1; else hi = mid - 1;
  }
  throw new Error("inflate: could not locate the zlib member boundary");
}
