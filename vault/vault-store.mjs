// vault/vault-store.mjs — the seekable shard VFS at the heart of the vault (cold-storage) engine. A whale
// (an oversized payload, see docs/gravel-whale.md) rests as a signed layout of MEMBER-shards; this store
// presents that set as ONE logical file with a `read(offset, length)` seek — pulling only the members a read
// touches, holding a BOUNDED working set in memory, and evicting least-recently-used. Pure and Node-testable:
// the OPFS-conveyor / Downloads / File-System-Access backends are injected, so this brain never touches a
// browser API. It is the read half; intake/admission is admit.mjs, the glove entry is vault-client.mjs.
//
// Two invariants carry the design's "sharding is a memory-loading problem" spine:
//   1. A MEMBER is the working-set unit. Touch any byte of a member → its WHOLE member pages in, is verified
//      against its hash, and is served in slices. So no single member may exceed the working-set budget — the
//      manifest's member cuts must be chosen for the loader (that constraint is checked here, not assumed).
//   2. ALLOCATE AGAINST VERIFIED BYTES. A member with a hash is served only if it hashes correctly (a lying or
//      corrupt shard throws — dropped, not served). A member with a null hash is served but counts as
//      UNVERIFIED (anonymous): readable inert bytes, never counted toward `verifiedBytes`.

// Default digest: SHA-256 → lowercase hex, via the platform WebCrypto (Node 22 + browsers both expose it).
// Tests inject a fake digest for determinism; production leaves this default.
async function sha256Hex(bytes) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Normalize a member hash for comparison: strip an optional "sha256:" prefix, lowercase. null → null.
function normHash(h) {
  if (h == null) return null;
  const s = String(h).toLowerCase();
  return s.startsWith("sha256:") ? s.slice(7) : s;
}

// Build the logical index from a manifest's contiguous members: cumulative offsets over member lengths.
// Throws on a malformed manifest (a store that can't trust its own map is useless). Returns the index plus
// the derived `total`; if the manifest declares a `total`, it must match the summed member lengths.
function indexManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.members) || !manifest.members.length)
    throw new Error("vault-store: manifest needs a non-empty members[]");
  const index = [];
  let start = 0;
  for (let i = 0; i < manifest.members.length; i++) {
    const m = manifest.members[i];
    if (!m || typeof m.id !== "string" || !m.id) throw new Error(`vault-store: member ${i} needs an id`);
    if (!Number.isInteger(m.length) || m.length < 0) throw new Error(`vault-store: member ${m.id} needs an integer length`);
    index.push({ id: m.id, start, end: start + m.length, length: m.length, hash: normHash(m.hash ?? null) });
    start += m.length;
  }
  if (manifest.total != null && manifest.total !== start)
    throw new Error(`vault-store: declared total ${manifest.total} != summed members ${start}`);
  return { index, total: start };
}

// Open a store over a manifest + a backend. `backend.readMember(id, start, len) => Promise<Uint8Array>` reads
// raw bytes WITHIN one member (the conveyor/vault/file backend's one job). `workingSet` bounds resident bytes;
// `digest` is injectable for tests. Returns the reader: read / stat / verifyAll / close.
export function vaultStore({ manifest, backend, workingSet = 256 * 1024 * 1024, digest = sha256Hex } = {}) {
  if (!backend || typeof backend.readMember !== "function")
    throw new Error("vault-store: needs a backend with readMember(id, start, len)");
  if (!Number.isFinite(workingSet) || workingSet <= 0) throw new Error("vault-store: workingSet must be > 0");
  const { index, total } = indexManifest(manifest);
  const byId = new Map(index.map((m) => [m.id, m]));

  // A member wider than the whole budget can never be resident — the manifest was cut wrong for this device.
  const tooWide = index.filter((m) => m.length > workingSet).map((m) => m.id);

  const resident = new Map(); // id -> { bytes, used }
  const verified = new Set(); // ids whose hash checked
  let residentBytes = 0;
  let clock = 0;

  function evictToFit(need) {
    if (need > workingSet) throw new Error(`vault-store: member needs ${need}B > working set ${workingSet}B (cut the manifest smaller)`);
    while (residentBytes + need > workingSet && resident.size) {
      let lru = null;
      for (const [id, e] of resident) if (!lru || e.used < resident.get(lru).used) lru = id;
      residentBytes -= resident.get(lru).bytes.length;
      resident.delete(lru);
    }
  }

  // Ensure a member's whole bytes are resident + verified; returns the resident buffer. Verifies on first load:
  // a hash mismatch THROWS (drop, don't serve); a null hash loads but never enters `verified`.
  async function ensureResident(m) {
    const hit = resident.get(m.id);
    if (hit) { hit.used = ++clock; return hit.bytes; }
    const bytes = await backend.readMember(m.id, 0, m.length);
    if (!(bytes instanceof Uint8Array) || bytes.length !== m.length)
      throw new Error(`vault-store: backend returned ${bytes && bytes.length}B for member ${m.id}, expected ${m.length}`);
    if (m.hash != null) {
      const got = normHash(await digest(bytes));
      if (got !== m.hash) throw new Error(`vault-store: member ${m.id} failed verification (dropped)`);
      verified.add(m.id);
    }
    evictToFit(m.length);
    resident.set(m.id, { bytes, used: ++clock });
    residentBytes += m.length;
    return bytes;
  }

  // The seek: a logical range read spanning members. Pulls only the members [offset, offset+length) touches.
  async function read(offset, length) {
    if (!Number.isInteger(offset) || offset < 0) throw new Error("vault-store: offset must be a non-negative integer");
    if (!Number.isInteger(length) || length < 0) throw new Error("vault-store: length must be a non-negative integer");
    const end = offset + length;
    if (end > total) throw new Error(`vault-store: read [${offset},${end}) past end ${total}`);
    const out = new Uint8Array(length);
    if (length === 0) return out;
    for (const m of index) {
      if (m.start >= end || m.end <= offset) continue; // no overlap
      const from = Math.max(offset, m.start) - m.start; // slice within the member
      const to = Math.min(end, m.end) - m.start;
      const bytes = await ensureResident(m);
      out.set(bytes.subarray(from, to), Math.max(offset, m.start) - offset);
    }
    return out;
  }

  // Page every member through once (bounded by the working set), verifying each — the intake→seal pass. After
  // it, `stat().complete` is true iff every hashed member verified and the set covers `total`.
  async function verifyAll() {
    for (const m of index) await ensureResident(m);
    return stat();
  }

  function stat() {
    let verifiedBytes = 0;
    for (const m of index) if (verified.has(m.id)) verifiedBytes += m.length;
    const hashed = index.filter((m) => m.hash != null);
    return {
      total,                                   // declared logical bytes (== summed members)
      members: index.length,
      workingSet,
      residentBytes,                           // currently held in memory (≤ workingSet)
      verifiedBytes,                           // bytes whose member hash has checked (allocate-against-verified)
      anonymousMembers: index.length - hashed.length, // null-hash members: served inert, never "verified"
      tooWideMembers: tooWide.slice(),         // members that cannot fit the budget — manifest cut wrong here
      complete: hashed.length === index.length && verifiedBytes === total, // every member hashed AND verified
    };
  }

  function close() { resident.clear(); verified.clear(); residentBytes = 0; }

  return { read, stat, verifyAll, close, has: (id) => byId.has(id) };
}

export default vaultStore;
