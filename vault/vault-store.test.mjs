// Unit: vault/vault-store.mjs — the seekable shard VFS. Range reads span members; only touched members page
// in; the working set is bounded (LRU evicts); verified bytes accrue only when a member hash checks; a lying
// member is dropped, not served. Run: node vault/vault-store.test.mjs
import { vaultStore } from "./vault-store.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const bytes = (...xs) => Uint8Array.from(xs);
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// deterministic content hash (sync core + async wrapper injected as the store's digest)
const digCore = (b) => "sha256:" + Array.from(b).reduce((a, x) => (a * 31 + x) >>> 0, 7).toString(16);
const digest = async (b) => digCore(b);

const A = bytes(1, 2, 3, 4), B = bytes(5, 6, 7, 8), C = bytes(9, 10); // logical: A[0,4) B[4,8) C[8,10), total 10
const backendOf = (map) => ({ readMember: async (id, start, len) => map.get(id).subarray(start, start + len) });
const memMap = new Map([["A", A], ["B", B], ["C", C]]);

const manifest = (over = {}) => ({
  total: 10,
  members: [
    { id: "A", length: 4, hash: digCore(A) },
    { id: "B", length: 4, hash: digCore(B) },
    { id: "C", length: 2, hash: digCore(C) },
  ],
  ...over,
});

async function run() {
  // 1. whole-file read, in order
  {
    const s = vaultStore({ manifest: manifest(), backend: backendOf(memMap), workingSet: 1 << 20, digest });
    ok(eq(await s.read(0, 10), bytes(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)), "read(0,10) returns the whole payload in order");
  }
  // 2. a read that spans two members
  {
    const s = vaultStore({ manifest: manifest(), backend: backendOf(memMap), workingSet: 1 << 20, digest });
    ok(eq(await s.read(2, 4), bytes(3, 4, 5, 6)), "read(2,4) spans member A→B correctly");
    ok(eq(await s.read(3, 3), bytes(4, 5, 6)), "read(3,3) straddles the A/B boundary");
    ok(eq(await s.read(8, 2), bytes(9, 10)), "read(8,2) reads the last member");
    ok((await s.read(5, 0)).length === 0, "read(len 0) returns empty");
  }
  // 3. out-of-range refuses
  {
    const s = vaultStore({ manifest: manifest(), backend: backendOf(memMap), workingSet: 1 << 20, digest });
    let threw = false; try { await s.read(8, 5); } catch { threw = true; }
    ok(threw, "read past end throws");
  }
  // 4. verified bytes accrue on hash check; complete after verifyAll
  {
    const s = vaultStore({ manifest: manifest(), backend: backendOf(memMap), workingSet: 1 << 20, digest });
    ok(s.stat().verifiedBytes === 0, "nothing verified before any read");
    await s.read(0, 10);
    ok(s.stat().verifiedBytes === 10, "all members verified after reading them (allocate-against-verified)");
    ok(s.stat().complete === true, "stat.complete once every member hashed AND verified");
  }
  // 5. a null-hash member is served but never counts as verified (anonymous inert bytes)
  {
    const m = manifest(); m.members[2].hash = null; // C anonymous
    const s = vaultStore({ manifest: m, backend: backendOf(memMap), workingSet: 1 << 20, digest });
    ok(eq(await s.read(8, 2), bytes(9, 10)), "anonymous member still reads");
    await s.read(0, 8); // touch the two hashed members A,B so they verify
    ok(s.stat().verifiedBytes === 8 && s.stat().anonymousMembers === 1, "anonymous member excluded from verifiedBytes");
    ok(s.stat().complete === false, "not complete while a member is unverifiable");
  }
  // 6. a lying member is dropped, not served
  {
    const m = manifest(); m.members[1].hash = digCore(bytes(0, 0, 0, 0)); // B's hash won't match its bytes
    const s = vaultStore({ manifest: m, backend: backendOf(memMap), workingSet: 1 << 20, digest });
    let threw = false; try { await s.read(4, 4); } catch (e) { threw = /verification/.test(e.message); }
    ok(threw, "a member whose bytes fail its hash throws (dropped)");
  }
  // 7. the working set is bounded — LRU evicts; verified is durable across eviction
  {
    const s = vaultStore({ manifest: manifest(), backend: backendOf(memMap), workingSet: 5, digest }); // < two 4B members
    ok(eq(await s.read(0, 10), bytes(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)), "full read succeeds under a tight working set");
    ok(s.stat().residentBytes <= 5, "resident bytes never exceed the working set");
    ok(s.stat().residentBytes < 10 && s.stat().verifiedBytes === 10, "verified survives eviction though bytes don't stay resident");
  }
  // 8. a member wider than the whole budget is flagged and unreadable (manifest cut wrong for this device)
  {
    const s = vaultStore({ manifest: manifest(), backend: backendOf(memMap), workingSet: 3, digest });
    ok(s.stat().tooWideMembers.length === 2, "members wider than the working set are surfaced in stat");
    let threw = false; try { await s.read(0, 4); } catch (e) { threw = /working set/.test(e.message); }
    ok(threw, "reading a too-wide member throws with a cut-the-manifest hint");
  }
  // 9. manifest validation
  {
    let threw = false; try { vaultStore({ manifest: { members: [] }, backend: backendOf(memMap) }); } catch { threw = true; }
    ok(threw, "empty members[] is refused");
    threw = false; try { vaultStore({ manifest: manifest({ total: 99 }), backend: backendOf(memMap) }); } catch { threw = true; }
    ok(threw, "a declared total that disagrees with the members is refused");
  }

  console.log(`\n${fails ? "FAILED" : "all"} vault-store tests${fails ? "" : " passed"}`);
  if (fails) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
