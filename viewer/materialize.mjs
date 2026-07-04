// viewer/materialize.mjs — where git materializes its files here (#91). On a normal OS, `git checkout`
// writes blobs to real filesystem paths — "where" is free, because every repo owns its own directory root.
// We have no filesystem, and (until #92's per-pile storage lands) many repos can share one storage bucket,
// so the address has to be invented. It already exists: `anecdote://repo/<label>/<path>`
// (anecdote-url.mjs's id capture already allows the slashes) is exactly as DNS-agnostic as
// `anecdote://repo/<label>` alone — a flat, dot-free local name, unaffected by whatever real domain, if
// any, #92 ever hosts the pile at.
//
// A materialized file is cached under that address as { oid, tip, content, fetchedAt } in any store that
// speaks the same { get(key), set(key,value), delete(key) } contract already used everywhere else
// (reducer/store.mjs, composer/consent.mjs) — memoryStore() for tests, idbStore() on device. Staleness is
// judged by comparing the recorded `oid` to whatever the CALLER'S current listing says the path resolves
// to now (fetchFilesUnder / fetchFileAt's return value) — this module never re-derives that oid itself.

import { anecdoteUrl } from "./anecdote-url.mjs";
import { fetchFileAt } from "../git-enough/fetch-pack.mjs";

const dec = new TextDecoder();

// The path-keyed cache. `label` is the pile's own local name (viewer/repos.mjs's registry label);
// `path` is the file's path within that pile's tree.
export function materializedStore(store) {
  if (!store) throw new Error("materialize: need a {get,set,delete} store");
  const key = (label, path) => anecdoteUrl("repo", `${label}/${path}`);
  return {
    async get(label, path) { return (await store.get(key(label, path))) || null; },
    async put(label, path, { oid, tip, content }) {
      const record = { oid, tip: tip ?? null, content, fetchedAt: Date.now() };
      await store.set(key(label, path), record);
      return record;
    },
    async delete(label, path) { await store.delete(key(label, path)); },
  };
}

// Fetch-and-cache one file. `current` is { oid, tip? } from a listing the caller already ran (this
// module never fetches a listing itself — see docs/atlas-index.md's tier 2 / fetchFilesUnder for that).
// A cache hit whose recorded oid still matches `current.oid` is returned as-is, no network trip; anything
// else is fetched fresh over the sparse path walk and (re)cached under the same stable address.
export async function hydrateFile(materialized, { url, credential, label, path, treeOid, current, inflate, fetch } = {}) {
  if (!current || !current.oid) throw new Error("materialize: need the current oid from a listing");
  const cached = await materialized.get(label, path);
  if (cached && cached.oid === current.oid) return { ...cached, fromCache: true };

  const f = await fetchFileAt({ url, credential, treeOid, path, inflate, fetch });
  if (!f) return null;
  const record = await materialized.put(label, path, { oid: f.oid, tip: current.tip, content: f.content });
  return { ...record, fromCache: false };
}

// Convenience for the common case: decode a materialized record's content as text (a poll listing, a
// business directory page — the "desirable cache items" #91 is actually about).
export function asText(record) { return record ? dec.decode(record.content) : null; }
