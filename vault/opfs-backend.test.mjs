// Unit: vault/opfs-backend.mjs — the OPFS conveyor. put/read/delete/list over an injected directory handle,
// range reads that touch only the range, path-safety refusal, and — the point — the vault-store reading real
// (fake-OPFS) shard files end to end. A fake dir implements the OPFS subset the backend uses.
// Run: node vault/opfs-backend.test.mjs
import { opfsBackend } from "./opfs-backend.mjs";
import { vaultStore } from "./vault-store.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const bytes = (...xs) => Uint8Array.from(xs);
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---- a fake OPFS directory handle (the browser-only bits the backend leans on) ----
function fakeBlob(u) { return { size: u.length, async arrayBuffer() { return u.slice().buffer; } }; }
function fakeFileHandle(files, name) {
  return {
    kind: "file", name,
    async getFile() {
      const u = files.get(name);
      return { size: u.length, slice(s = 0, e = u.length) { return fakeBlob(u.subarray(s, e)); }, async arrayBuffer() { return u.slice().buffer; } };
    },
    async createWritable() {
      const chunks = [];
      return {
        async write(d) { chunks.push(d instanceof Uint8Array ? d : new Uint8Array(d)); },
        async close() { const t = chunks.reduce((a, c) => a + c.length, 0); const o = new Uint8Array(t); let p = 0; for (const c of chunks) { o.set(c, p); p += c.length; } files.set(name, o); },
      };
    },
  };
}
function fakeDir() {
  const files = new Map();
  return {
    _files: files,
    async getFileHandle(name, opts = {}) {
      if (!files.has(name)) { if (!opts.create) { const e = new Error("NotFound"); e.name = "NotFoundError"; throw e; } files.set(name, new Uint8Array(0)); }
      return fakeFileHandle(files, name);
    },
    async removeEntry(name) { if (!files.has(name)) { const e = new Error("NotFound"); e.name = "NotFoundError"; throw e; } files.delete(name); },
    async *entries() { for (const [n] of files) yield [n, fakeFileHandle(files, n)]; },
    async *values() { for (const [n] of files) yield fakeFileHandle(files, n); },
  };
}

// deterministic content hash matching the store's digest injection
const digCore = (b) => "sha256:" + Array.from(b).reduce((a, x) => (a * 31 + x) >>> 0, 7).toString(16);
const digest = async (b) => digCore(b);

async function run() {
  // 1. put → read whole → range read
  {
    const be = opfsBackend({ dir: fakeDir() });
    await be.putMember("A", bytes(1, 2, 3, 4, 5, 6, 7, 8));
    ok(eq(await be.readMember("A", 0, 8), bytes(1, 2, 3, 4, 5, 6, 7, 8)), "readMember returns the whole shard");
    ok(eq(await be.readMember("A", 2, 3), bytes(3, 4, 5)), "readMember returns just the requested range (slice, no full load)");
    ok(eq(await be.readMember("A", 6), bytes(7, 8)), "readMember with no len reads to end");
  }
  // 2. absent shard → NotFound; has() reflects presence
  {
    const be = opfsBackend({ dir: fakeDir() });
    let threw = false; try { await be.readMember("nope", 0, 1); } catch { threw = true; }
    ok(threw, "reading an absent shard throws NotFound");
    ok((await be.has("nope")) === false, "has() is false for an absent shard");
    await be.putMember("here", bytes(9));
    ok((await be.has("here")) === true, "has() is true once staged");
  }
  // 3. delete frees it (idempotent)
  {
    const be = opfsBackend({ dir: fakeDir() });
    await be.putMember("A", bytes(1, 2));
    ok((await be.deleteMember("A")) === true, "deleteMember returns true when it removed a shard");
    ok((await be.deleteMember("A")) === false, "deleteMember returns false when already gone");
    ok((await be.has("A")) === false, "the shard is gone after delete");
  }
  // 4. list + bytesStaged count only our shards
  {
    const dir = fakeDir();
    const be = opfsBackend({ dir });
    await be.putMember("A", bytes(1, 2, 3));
    await be.putMember("B", bytes(4, 5));
    // a foreign file in the same dir must be ignored by list/bytesStaged
    const fh = await dir.getFileHandle("not-ours.txt", { create: true }); const w = await fh.createWritable(); await w.write(bytes(0, 0, 0, 0)); await w.close();
    const ids = (await be.list()).sort();
    ok(ids.length === 2 && ids[0] === "A" && ids[1] === "B", "list returns only our shard ids");
    ok((await be.bytesStaged()) === 5, "bytesStaged sums only our shards (foreign file ignored)");
  }
  // 5. path safety — an id that could escape the dir is refused
  {
    const be = opfsBackend({ dir: fakeDir() });
    for (const bad of ["../evil", "a/b", "", "x".repeat(201)]) {
      let threw = false; try { await be.readMember(bad, 0, 1); } catch { threw = true; }
      ok(threw, `unsafe member id refused: ${JSON.stringify(bad).slice(0, 20)}`);
    }
  }
  // 6. END TO END: the vault store reads a whale out of OPFS shards
  {
    const dir = fakeDir();
    const be = opfsBackend({ dir });
    const A = bytes(1, 2, 3, 4), B = bytes(5, 6, 7, 8), C = bytes(9, 10); // total 10
    await be.putMember("A", A); await be.putMember("B", B); await be.putMember("C", C);
    const manifest = { total: 10, members: [
      { id: "A", length: 4, hash: digCore(A) },
      { id: "B", length: 4, hash: digCore(B) },
      { id: "C", length: 2, hash: digCore(C) },
    ] };
    const s = vaultStore({ manifest, backend: be, workingSet: 6, digest });
    ok(eq(await s.read(0, 10), bytes(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)), "store reads the whole payload through the OPFS backend");
    ok(eq(await s.read(2, 4), bytes(3, 4, 5, 6)), "store seeks across a member boundary through OPFS");
    ok(s.stat().verifiedBytes === 10 && s.stat().residentBytes <= 6, "verified end to end, working set stayed bounded over OPFS");
  }

  console.log(`\n${fails ? "FAILED" : "all"} opfs-backend tests${fails ? "" : " passed"}`);
  if (fails) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
