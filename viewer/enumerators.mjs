// viewer/enumerators.mjs — read what's ACTUALLY on the device (docs/system-viewer.md). The registry types
// things; these reveal existence — so the viewer can show your storage even when the registry is empty.
//
// The "no list-all API" worry was too pessimistic: modern browsers DO offer per-API discovery —
// localStorage keys, indexedDB.databases(), caches.keys(), OPFS directory walking, StorageManager.estimate.
// Each adapter takes its API object (defaulting to the global) so it's feature-detected AND testable with a
// fake. All return a normalized surface: { surface, entries: [{ key, ... }], count } (or null if absent).

// localStorage — fully enumerable (length + key(i) + getItem).
export function enumerateLocalStorage(ls = globalThis.localStorage) {
  if (!ls || typeof ls.key !== "function") return null;
  const entries = [];
  for (let i = 0; i < ls.length; i++) {
    const key = ls.key(i);
    const v = ls.getItem(key);
    entries.push({ key, size: v == null ? 0 : v.length });
  }
  return { surface: "localStorage", entries, count: entries.length };
}

// IndexedDB — indexedDB.databases() lists DBs; open each to read its object-store names (best-effort).
export async function enumerateIndexedDB(idb = globalThis.indexedDB, { open } = {}) {
  if (!idb || typeof idb.databases !== "function") return null;
  const dbs = await idb.databases();
  const openDb = open || ((name) => new Promise((res, rej) => {
    const r = idb.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const entries = [];
  for (const { name, version } of dbs) {
    let stores = [];
    try { const db = await openDb(name); stores = [...db.objectStoreNames]; db.close && db.close(); } catch {}
    entries.push({ key: name, version, stores });
  }
  return { surface: "indexedDB", entries, count: entries.length };
}

// Cache API — caches.keys() lists caches; each cache's keys() lists the cached request URLs.
export async function enumerateCaches(cs = globalThis.caches) {
  if (!cs || typeof cs.keys !== "function") return null;
  const names = await cs.keys();
  const entries = [];
  for (const name of names) {
    let urls = [];
    try { const c = await cs.open(name); urls = (await c.keys()).map((r) => r.url); } catch {}
    entries.push({ key: name, urls, count: urls.length });
  }
  return { surface: "caches", entries, count: entries.length };
}

// OPFS — walk the origin-private file system tree (files with sizes).
export async function enumerateOPFS(getDirectory = () => globalThis.navigator?.storage?.getDirectory?.()) {
  const root = await (typeof getDirectory === "function" ? getDirectory() : getDirectory);
  if (!root || typeof root.entries !== "function") return null;
  const entries = [];
  async function walk(dir, prefix) {
    for await (const [name, handle] of dir.entries()) {
      const path = prefix + name;
      if (handle.kind === "directory") await walk(handle, path + "/");
      else { let size = null; try { size = (await handle.getFile()).size; } catch {} entries.push({ key: path, size }); }
    }
  }
  await walk(root, "");
  return { surface: "opfs", entries, count: entries.length };
}

// StorageManager.estimate — the usage/quota summary.
export async function storageEstimate(sm = globalThis.navigator?.storage) {
  if (!sm || typeof sm.estimate !== "function") return null;
  const { usage, quota } = await sm.estimate();
  return { surface: "estimate", usage, quota };
}

// Gather every available surface, gracefully skipping the ones this environment lacks. `deps` overrides
// each API (for tests); real callers get the globals.
export async function enumerateAll(deps = {}) {
  const surfaces = [];
  const ls = enumerateLocalStorage(deps.localStorage);
  if (ls) surfaces.push(ls);
  for (const fn of [
    () => enumerateIndexedDB(deps.indexedDB),
    () => enumerateCaches(deps.caches),
    () => enumerateOPFS(deps.getDirectory),
  ]) { try { const s = await fn(); if (s) surfaces.push(s); } catch {} }
  let estimate = null;
  try { estimate = await storageEstimate(deps.storageManager); } catch {}
  return { surfaces, estimate };
}
