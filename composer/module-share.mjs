// composer/module-share.mjs — BRINGING THE GRAVEL HOME: a system module addresses itself and exports a
// VERIFIED SIGNED COPY of its own source over the carrier (docs/offline-transfer.md, docs/anti-signature.md
// "acquire-by-doing"). Getting the source is as easy as getting it however we want — the point is what we
// hand over: not an arbitrary payload but a signed envelope, so the person who catches composer/fountain.mjs
// off a looping screen holds a copy that VERIFIES (from anyone) and can be TRUSTED (friend list) — the same
// trust grades as every other transfer. The doors into the system are many; the door doesn't confer
// privilege — the signature does. Catching a module makes it SEEABLE, not privileged: nothing here installs
// or executes anything. Save it, read it, verify it; adopting it into a running system is a separate,
// consent-gated edge (the firmware pin's territory).
//
// The payload is anecdote.module/v1: { schema, path, source } — the module's ADDRESS rides inside the
// signed bytes, so a verified catch knows exactly which piece of the system it holds, on whose word.

import { packTransfer, verifyTransfer } from "./transfer.mjs";
import { defaultHash } from "./anecdote.mjs";

export const MODULE = "anecdote.module/v1";
export const KIND = "module";

// Normalize a module address: repo-relative, rooted, no traversal games ("composer/fountain.mjs" and
// "/composer/fountain.mjs" are the same module; "../secrets" is nobody's module).
export function moduleAddress(path) {
  const p = "/" + String(path || "").replace(/^\/+/, "");
  if (p.includes("..") || p.includes("//") || !/^\/[A-Za-z0-9._/-]+$/.test(p)) throw new Error(`module-share: not a module address: ${path}`);
  return p;
}

// The system module EXPORTS ITSELF: address it, fetch its own source (the served origin, or the offline
// shell cache — fetch() falls through the service worker, so this works in a dead room), sign the copy.
// `fetcher` is injectable: (path) => Promise<string> (Node tests read the file straight off disk).
export async function exportModule(path, identity, { fetcher } = {}) {
  const addr = moduleAddress(path);
  const read = fetcher || (async (p) => { const r = await fetch(p); if (!r.ok) throw new Error(`module-share: ${p} → ${r.status}`); return r.text(); });
  const source = await read(addr);
  if (!source || !source.length) throw new Error(`module-share: ${addr} came back empty`);
  const payload = JSON.stringify({ schema: MODULE, path: addr, source });
  const signed = await packTransfer(KIND, payload, identity);
  return { signed, path: addr, size: source.length, sourceHash: await defaultHash(new TextEncoder().encode(source)) };
}

// Verify a caught module: the envelope (signature + payload hash, verify-from-anyone + trust-locally),
// then the module shape. Returns { ok, trusted, by, path, source, sourceHash, errors }.
export async function verifyModule(signed, { friends = [] } = {}) {
  const v = await verifyTransfer(signed, { friends });
  if (!v.ok) return { ok: false, trusted: false, by: v.by, path: null, source: null, sourceHash: null, errors: v.errors };
  if (v.kind !== KIND) return { ok: false, trusted: false, by: v.by, path: null, source: null, sourceHash: null, errors: [`kind is ${v.kind}, not ${KIND}`] };
  let body = null;
  try { body = JSON.parse(new TextDecoder().decode(v.bytes)); } catch { return { ok: false, trusted: false, by: v.by, path: null, source: null, sourceHash: null, errors: ["module payload is not JSON"] }; }
  if (!body || body.schema !== MODULE || typeof body.path !== "string" || typeof body.source !== "string" || !body.source.length)
    return { ok: false, trusted: false, by: v.by, path: null, source: null, sourceHash: null, errors: ["not an anecdote.module/v1 payload"] };
  let addr;
  try { addr = moduleAddress(body.path); } catch { return { ok: false, trusted: false, by: v.by, path: null, source: null, sourceHash: null, errors: ["module path fails addressing rules"] }; }
  return { ok: true, trusted: v.trusted, by: v.by, path: addr, source: body.source,
           sourceHash: await defaultHash(new TextEncoder().encode(body.source)), errors: [] };
}

// Is a completed carrier transfer a module? (The catch side asks this to render the right card.)
export function isModuleTransfer(signed) { return !!signed && signed.kind === KIND; }
