// Local cache for the reducer's label dictionary (CONSTITUTION §"Mobile LLM").
//
// The CONSTITUTION is emphatic: "No persistent backend exists that is not just a connected
// service to turn gears and leave auditable evidence and signatures." So the dictionary is
// cached LOCALLY, in DOMAIN-SCOPED storage on the constituent's own device — never a backend.
// The instrument stays private and in memory while it runs; the cache only lets it cold-load
// the same dictionary next visit instead of re-reducing from scratch.
//
// A store is a tiny async key/value contract — nothing more — so the reducer never knows or
// cares where its bytes rest:
//
//   { get(key) -> Promise<string|null>, set(key, value) -> Promise<void>, delete(key) -> Promise<void> }
//
// Two implementations:
//   memoryStore() — ephemeral, dependency-free; the default and what the tests exercise.
//   idbStore()    — browser IndexedDB, automatically scoped to the page's origin (its domain).

// In-memory store. Private to the process, gone when it exits — "in memory" by construction.
export function memoryStore() {
  const m = new Map();
  return {
    async get(key) { return m.has(key) ? m.get(key) : null; },
    async set(key, value) { m.set(key, value); },
    async delete(key) { m.delete(key); },
  };
}

// Browser IndexedDB store. IndexedDB is partitioned per-origin by the browser, so this is the
// domain-scoped local cache the CONSTITUTION describes: a constituent's dictionary for
// anecdote.channel cannot be read from any other origin. Node has no indexedDB global, so this
// is browser-only by design; the reducer core stays runnable and testable in Node via
// memoryStore().
export function idbStore(dbName = "anecdote", storeName = "dictionary") {
  if (typeof indexedDB === "undefined") {
    throw new Error("idbStore() requires a browser IndexedDB; use memoryStore() outside the browser.");
  }
  const open = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(storeName);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = async (mode, fn) => {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const os = t.objectStore(storeName);
        const out = fn(os);
        t.oncomplete = () => resolve(out._result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      });
    } finally {
      db.close();
    }
  };
  const wrap = (req) => { const box = {}; req.onsuccess = () => { box._result = req.result; }; return box; };
  return {
    async get(key) { return (await tx("readonly", (os) => wrap(os.get(key)))) ?? null; },
    async set(key, value) { await tx("readwrite", (os) => wrap(os.put(value, key))); },
    async delete(key) { await tx("readwrite", (os) => wrap(os.delete(key))); },
  };
}
