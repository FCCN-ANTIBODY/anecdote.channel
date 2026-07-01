// sw.js — the offline APP SHELL for anecdote.channel, now PIN-ENFORCING (docs/origin.md, "lock the hatch
// on the way out"). Slice 1a shipped the machinery (composer/firmware.mjs); this wires the service worker to
// ENFORCE it: pin the firmware signer at first contact, and thereafter refuse any shell update not signed by
// the same key — a possessed origin can't silently swap what a holder keeps. A module SW so it can import
// the verify primitives.
//
// SCOPE OF THE RULE "not a service worker" (origin.md:268): that's about the powerless data:CHAMBER — never
// a SW. This is the served ELEVATED shell, which origin.md explicitly allows a SW. The chamber stays a
// puppeted data: tab over the probe line; git-enough stays a normal module; the pin protects the shell CODE
// the SW serves. (Residual, by design: the SW *script itself* is fetched from the origin on update — a
// possessed origin can ship a new sw.js. Pinning the SW script from the origin is the optical/QR firmware's
// job — origin.md's recursive-favicon fingerprint / code-QRs — anchored on this very trust root.)
//
// Two storage layers stay distinct: the Cache-API holds the shell CODE; IndexedDB holds the pin (here) and,
// elsewhere, the trove/blob store (your DATA). The SW never touches your data.

import { pinDecision, verifyFiles } from "/composer/firmware.mjs";

const VERSION = "anecdote-shell-v2";

// Fallback shell when NO firmware.json is deployed — pinning is dormant, static precache (slice 1a note:
// arming the guarantee is opt-in). Same set as before + the firmware verify graph so a signed manifest can
// be checked offline too.
const FALLBACK_SHELL = [
  "/", "/index.html", "/poll.html", "/manifest.webmanifest", "/icon.svg",
  "/composer/probe-line.mjs", "/composer/authorize.mjs", "/composer/consent.mjs",
  "/composer/sign.mjs", "/composer/anecdote.mjs", "/composer/poll-answer.mjs",
  "/composer/qr-mint.mjs", "/composer/qr-sign.mjs", "/composer/qr-mint-demo.html",
  "/composer/firmware.mjs", "/viewer/poll.mjs", "/git-enough/read.mjs",
];

// ---- a tiny IndexedDB for the pin (fingerprint + held version + last rejection) ----------------------
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("anecdote-firmware", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("pin");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function pinGet(k) {
  const db = await idb();
  return new Promise((res) => { const rq = db.transaction("pin").objectStore("pin").get(k); rq.onsuccess = () => res(rq.result ?? null); rq.onerror = () => res(null); });
}
async function pinSet(k, v) {
  const db = await idb();
  return new Promise((res) => { const t = db.transaction("pin", "readwrite"); t.objectStore("pin").put(v, k); t.oncomplete = () => res(); t.onerror = () => res(); });
}

// ---- the firmware check: fetch the manifest, decide, and precache ONLY if the pin accepts --------------
// SW-initiated fetch() does NOT re-enter our fetch handler, so these go straight to the network.
async function checkFirmware() {
  const cache = await caches.open(VERSION);
  let signed = null;
  try { const r = await fetch("/firmware.json", { cache: "no-store" }); if (r.ok) signed = await r.json(); } catch {}
  if (!signed) return { mode: "unpinned" };          // no manifest: pinning dormant (install held the shell)

  const pinnedBy = await pinGet("by");
  const held = (await pinGet("version")) || 0;
  const d = await pinDecision(signed, pinnedBy, held);
  if (!d.accept) {                                   // foreign signer / downgrade / bad sig — DO NOT adopt
    await pinSet("rejected", { by: d.by, reason: d.reason, at: Date.now() });
    return { mode: "refused", reason: d.reason, by: d.by };
  }

  // Accepted: fetch each file once, verify bytes match the manifest, THEN commit to cache (atomic-ish:
  // a failed integrity check aborts before any file is replaced).
  const grabbed = new Map();
  const grab = async (p) => {
    if (grabbed.has(p)) return grabbed.get(p);
    try { const r = await fetch(p, { cache: "no-store" }); if (!r.ok) { grabbed.set(p, null); return null; }
      const rec = { buf: new Uint8Array(await r.arrayBuffer()), type: r.headers.get("content-type") }; grabbed.set(p, rec); return rec; }
    catch { grabbed.set(p, null); return null; }
  };
  const vf = await verifyFiles(signed, async (p) => { const rec = await grab(p); return rec ? rec.buf : null; });
  if (!vf.ok) { await pinSet("rejected", { reason: "file integrity: " + JSON.stringify(vf.bad), at: Date.now() }); return { mode: "refused", reason: "file integrity" }; }

  for (const f of signed.files) {
    const rec = grabbed.get(f.path);
    if (rec) await cache.put(f.path, new Response(rec.buf, { headers: { "content-type": rec.type || "application/octet-stream" } }));
  }
  if (d.firstContact) await pinSet("by", d.by);
  await pinSet("version", d.version);
  await pinSet("rejected", null);
  return { mode: d.firstContact ? "pinned" : "rolled-forward", by: d.by, version: d.version };
}

async function precache(cache, list) {
  await Promise.all(list.map(async (u) => { try { const r = await fetch(u, { cache: "reload" }); if (r.ok) await cache.put(u, r); } catch {} }));
}

self.addEventListener("install", (e) => e.waitUntil((async () => {
  await precache(await caches.open(VERSION), FALLBACK_SHELL);   // hold the shell so boot survives a dead origin
  await checkFirmware().catch(() => {});                        // then pin + adopt a signed manifest if present
  await self.skipWaiting();
})()));

self.addEventListener("activate", (e) => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith("anecdote-shell-") && k !== VERSION).map((k) => caches.delete(k)));
  await self.clients.claim();
})()));

// A page (on load, or on demand) asks the SW to re-check for a signed roll-forward. Replies over the
// provided MessagePort with the decision so the UI can surface a refused (possessed) update.
self.addEventListener("message", (e) => {
  if (!e.data || e.data.type !== "firmware-check") return;
  const port = e.ports && e.ports[0];
  e.waitUntil((async () => { const r = await checkFirmware().catch((err) => ({ mode: "error", reason: String(err) })); if (port) port.postMessage(r); })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/firmware.json") return;         // control data — always fresh, never shell-cached
  e.respondWith(handle(req));
});

// Cache-first: a held (pinned) file wins, so a dead — or possessed — origin can't replace what's cached.
async function handle(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
    return res;
  } catch {
    if (req.mode === "navigate") return (await cache.match("/poll.html")) || (await cache.match("/index.html")) || Response.error();
    return Response.error();
  }
}
