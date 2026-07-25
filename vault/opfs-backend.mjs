// vault/opfs-backend.mjs — the first real backend behind the vault store (vault-store.mjs): the OPFS CONVEYOR.
// A completed member-shard spills here as its own file; the store's read() pulls member bytes back through
// `readMember`. This is bounded STAGING, not the resting place — the whale's durable home is the user's vault
// (Downloads / a picked handle); OPFS only ever holds the few shards in flight (docs/gravel-whale.md).
//
// House pattern: everything here is PURE over an injected directory handle that implements the OPFS subset we
// use (getFileHandle / removeEntry / entries / getFile+slice / createWritable). So it is Node-testable against a
// fake dir; the only browser-only thing is obtaining the real handle, isolated in the thin seam at the bottom
// (openOpfsVault / quota — verified in Chromium, not in the Node suite, like probe-line's spawnChamber).
//
// A range read is a real zero-full-load slice: getFile() → Blob.slice(start,end) → arrayBuffer() touches only
// the range, so the same backend serves a re-picked File handle later with no code change.

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/; // member ids are hashes/slugs; never a path
const SUFFIX = ".shard";

function fileNameFor(id, prefix) {
  if (typeof id !== "string" || id.length === 0 || id.length > 200 || !SAFE_ID.test(id))
    throw new Error("opfs-backend: unsafe member id (must be a slug/hash, never a path)");
  return prefix + id + SUFFIX;
}
const isNotFound = (e) => e && (e.name === "NotFoundError" || /not.?found/i.test(e.message || ""));

// Build a backend over an OPFS directory handle. `prefix` namespaces our files inside the dir so `list` /
// `bytesStaged` count only shards. Returns the store's `readMember` plus the conveyor's put/delete/list/size.
export function opfsBackend({ dir, prefix = "m-" } = {}) {
  if (!dir || typeof dir.getFileHandle !== "function")
    throw new Error("opfs-backend: needs an OPFS directory handle (navigator.storage.getDirectory())");

  // stage a completed shard (write-once). Returns bytes written. The member is already resident (≤ working set),
  // so writing it whole is correct — no within-member streaming needed.
  async function putMember(id, bytes) {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const fh = await dir.getFileHandle(fileNameFor(id, prefix), { create: true });
    const w = await fh.createWritable();
    await w.write(u);
    await w.close();
    return u.length;
  }

  // the store's backend contract: raw bytes [start, start+len) within one member. len omitted → to end.
  async function readMember(id, start = 0, len) {
    const fh = await dir.getFileHandle(fileNameFor(id, prefix)); // throws NotFound when absent
    const file = await fh.getFile();
    const end = len == null ? file.size : start + len;
    const blob = file.slice(start, end);
    return new Uint8Array(await blob.arrayBuffer());
  }

  // free a shard (after it promotes to the durable vault). true if it was there, false if already gone.
  async function deleteMember(id) {
    try { await dir.removeEntry(fileNameFor(id, prefix)); return true; }
    catch (e) { if (isNotFound(e)) return false; throw e; }
  }

  async function has(id) {
    try { await dir.getFileHandle(fileNameFor(id, prefix)); return true; }
    catch (e) { if (isNotFound(e)) return false; throw e; }
  }

  // the shard ids currently staged (our-prefixed files only).
  async function list() {
    const ids = [];
    for await (const [name] of dir.entries())
      if (name.startsWith(prefix) && name.endsWith(SUFFIX)) ids.push(name.slice(prefix.length, -SUFFIX.length));
    return ids;
  }

  // total bytes the conveyor is holding right now — the number that must stay bounded well under the origin's
  // shared quota group; the store's working set bounds RAM, this bounds the staging spill.
  async function bytesStaged() {
    let total = 0;
    for await (const [name, handle] of dir.entries())
      if (name.startsWith(prefix) && name.endsWith(SUFFIX)) total += (await handle.getFile()).size;
    return total;
  }

  return { readMember, putMember, deleteMember, has, list, bytesStaged };
}

// ---- thin browser seam (not unit-tested in Node — no navigator.storage; verified in Chromium) ----

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

// Open (or create) a dedicated OPFS subdir for a vault namespace and return a backend over it. One call for the
// browser side: openOpfsVault("<memberId-or-transfer>") → { readMember, putMember, … }. The namespace keeps one
// transfer's shards apart from another's inside the single receiver origin (transfers namespaced by id, one
// receiver bottle — docs/gravel-whale.md).
export async function openOpfsVault(name, { root, prefix } = {}) {
  if (!SLUG.test(String(name))) throw new Error("opfs-backend: vault namespace must be a slug");
  const base = root || (await navigator.storage.getDirectory());
  const dir = await base.getDirectoryHandle(name, { create: true });
  return opfsBackend({ dir, prefix });
}

// Quota headroom for the conveyor origin — the input to the admissibility budget and the working-set measure
// (the open knob in gravel-whale.md). Best-effort; browsers report coarse numbers.
export async function quota() {
  const est = (await navigator.storage.estimate()) || {};
  return { usage: est.usage || 0, quota: est.quota || 0, free: Math.max(0, (est.quota || 0) - (est.usage || 0)) };
}

export default opfsBackend;
