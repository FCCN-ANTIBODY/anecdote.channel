// Tests for the raw-storage enumerators, with in-memory fakes mimicking each browser API's shape.
//   node viewer/enumerators.test.mjs
import { enumerateLocalStorage, enumerateIndexedDB, enumerateCaches, enumerateOPFS, storageEstimate, enumerateAll } from "./enumerators.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// --- fakes ---------------------------------------------------------------------------------------
function fakeLocalStorage(obj) {
  const keys = Object.keys(obj);
  return { get length() { return keys.length; }, key: (i) => keys[i], getItem: (k) => (k in obj ? obj[k] : null) };
}
const fakeIDB = {
  databases: async () => [{ name: "anecdote", version: 1 }, { name: "reducer-cache", version: 2 }],
  // open() is provided via opts in the test
};
const fakeCaches = {
  keys: async () => ["v1-assets", "onnx"],
  open: async (name) => ({ keys: async () => (name === "v1-assets" ? [{ url: "https://x/app.mjs" }, { url: "https://x/index.html" }] : [{ url: "https://x/model.onnx" }]) }),
};
function fakeOPFSRoot() {
  const file = (size) => ({ kind: "file", getFile: async () => ({ size }) });
  const dir = (map) => ({ kind: "directory", entries() { return (async function* () { for (const k of Object.keys(map)) yield [k, map[k]]; })(); } });
  return dir({ "a.txt": file(10), sub: dir({ "b.bin": file(20) }) });
}

// 1. localStorage.
{
  const s = enumerateLocalStorage(fakeLocalStorage({ "anecdote:trove": "xxxxx", "theme": "dark" }));
  ok(s.surface === "localStorage" && s.count === 2, "lists localStorage keys");
  ok(s.entries.find((e) => e.key === "anecdote:trove").size === 5, "records value sizes");
  ok(enumerateLocalStorage(undefined) === null, "absent localStorage → null");
}

// 2. IndexedDB (databases() + per-db object stores via injected open()).
{
  const open = async (name) => ({ objectStoreNames: name === "anecdote" ? ["dictionary", "grants"] : ["labels"], close() {} });
  const s = await enumerateIndexedDB(fakeIDB, { open });
  ok(s.surface === "indexedDB" && s.count === 2, "lists databases");
  ok(s.entries[0].stores.join(",") === "dictionary,grants" && s.entries[0].version === 1, "reads object-store names + version");
  ok((await enumerateIndexedDB({})) === null, "no databases() API → null");
}

// 3. Cache API.
{
  const s = await enumerateCaches(fakeCaches);
  ok(s.surface === "caches" && s.count === 2, "lists caches");
  ok(s.entries.find((e) => e.key === "v1-assets").urls.length === 2, "lists cached request URLs per cache");
}

// 4. OPFS walk (recursive; files with sizes).
{
  const s = await enumerateOPFS(() => fakeOPFSRoot());
  ok(s.surface === "opfs", "opfs surface");
  ok(s.entries.map((e) => e.key).sort().join(",") === "a.txt,sub/b.bin", "walks nested files");
  ok(s.entries.find((e) => e.key === "sub/b.bin").size === 20, "reports file sizes");
}

// 5. estimate.
{
  const s = await storageEstimate({ estimate: async () => ({ usage: 1234, quota: 999999 }) });
  ok(s.usage === 1234 && s.quota === 999999, "estimate usage/quota");
  ok((await storageEstimate(undefined)) === null, "no StorageManager → null");
}

// 6. enumerateAll gathers present surfaces and skips absent ones (the empty-registry "what's there" view).
{
  const all = await enumerateAll({
    localStorage: fakeLocalStorage({ k: "v" }),
    indexedDB: fakeIDB,
    caches: fakeCaches,
    getDirectory: () => fakeOPFSRoot(),
    storageManager: { estimate: async () => ({ usage: 1, quota: 2 }) },
  });
  ok(all.surfaces.map((s) => s.surface).sort().join(",") === "caches,indexedDB,localStorage,opfs", "enumerateAll gathers every present surface");
  ok(all.estimate.usage === 1, "enumerateAll includes the estimate");

  const empty = await enumerateAll({});   // nothing available (like a bare environment)
  ok(empty.surfaces.length === 0 && empty.estimate === null, "absent APIs are skipped gracefully");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall enumerators tests passed");
