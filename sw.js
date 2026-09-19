// sw.js — the offline APP SHELL for anecdote.channel. TWO SLOTS, PIN-ENFORCING, and it never refuses
// to show you something (docs/origin.md, "lock the hatch on the way out"). A module SW so it can import
// the verify primitives.
//
// THE TWO SLOTS, AND WHY THERE ARE TWO.
//
// There used to be one cache, keyed by a VERSION constant, holding the shell AND every runtime response
// at once — told apart only by whether a path happened to be in the shell list. That made "go forward"
// inexpressible: you could not move what was held without moving all of it, and activate() deleting the
// non-matching key took the runtime copy with it. Worse, it deleted the OLD shell the moment a new
// worker activated, so a network that died mid-install left a half-filled new cache and no floor. That
// was a real way to lock a holder out of their own copy, which is the one thing this system exists to
// prevent.
//
//   HELD    — the floor. Proven-whole, boots with the origin dead, moves only on a deliberate PROMOTE.
//   ROLLING — what you run. Always accumulating, may be partial, overwritten freely.
//   RUNTIME — everything that is not shell: network-first with a cached floor.
//
// The names are NOT versioned. A cache key that carries the version is what stranded installs before;
// here the contents are versioned and the slot names are stable, so a generation change is a merge
// rather than a discard. PROMOTION IS A MERGE, never a swap: rolling's bytes for every path it has,
// held's for every path it lacks, so the floor is whole by construction and can never acquire a hole.
//
// THE THREE MODES — one axis, monotone in how much motion is allowed:
//
//   free  — run rolling, fall back to held, revalidate in the background, promote when whole. Default.
//   hold  — run held; do not revalidate. Rolling still accumulates, so releasing the latch lands you
//           on current immediately.
//   guard — hold, plus the firmware pin is enforced and refusals are recorded. Promotion wants a
//           signed manifest rather than a raw refetch.
//
// NOTHING HERE EVER BLANKS THE SCREEN. Every read is layered — rolling, held, network, navigate
// fallback — and every mode leaves all of them reachable. The modes govern what may REPLACE what you
// hold; they never govern what you may SEE. A branch in this file that ends in "so we don't show it"
// is a bug regardless of how good its reason sounds.
//
// STILLNESS IS A FEATURE. There is no skipWaiting() here on purpose: a new worker waits until every
// tab closes, the way firmware should sit still. The holder can pull a waiting worker forward on
// demand from /shell.html — their gesture, not ours.
//
// SCOPE OF THE RULE "not a service worker" (origin.md:268): that is about the powerless data:CHAMBER —
// never a SW. This is the served ELEVATED shell, which origin.md explicitly allows a SW. The chamber
// stays a puppeted data: tab over the probe line; git-enough stays a normal module.
//
// Two storage layers stay distinct: the Cache-API holds the shell CODE; IndexedDB holds the pin and the
// mode (here) and, elsewhere, the trove/blob store (your DATA). The SW never touches your data, and no
// verification result is ever an input to whether your data renders.

import { pinDecision, verifyFiles } from "/composer/firmware.mjs";

// The generation LABEL for the shell list. It no longer names a cache key — it is what the control page
// shows you and what scripts/sw.test.mjs pins a digest against, so a changed list is a deliberate,
// recorded act rather than a silent one. Bump it when FALLBACK_SHELL changes.
const SHELL_VERSION = "v8";

const HELD = "anecdote-held";            // the floor
const ROLLING = "anecdote-rolling";      // what you run
const RUNTIME = "anecdote-runtime";      // not-shell, network-first
const LEGACY = /^anecdote-shell-/;       // the single pre-two-slot cache, adopted then retired

const FALLBACK_SHELL = [
  "/", "/index.html", "/poll.html", "/manifest.webmanifest", "/icon.svg",
  "/shell.html",                                // the control page — legible when the origin is gone (docs/origin.md)
  "/directory.mjs",                             // the directory renders offline like everything else
  "/assets/ds/colors.css", "/assets/ds/spacing.css", "/assets/ds/typography.css",
  "/assets/ds/fonts.css",                       // the design system is vendored, so it boots dark-origin too
  "/assets/fonts/playfair-display.regular.ttf", "/assets/fonts/SpaceMono-Regular.woff2",
  "/assets/fonts/SpaceMono-Bold.woff2", "/assets/fonts/SpaceMono-Italic.woff2",
  "/composer/probe-line.mjs", "/composer/authorize.mjs", "/composer/consent.mjs",
  "/composer/sign.mjs", "/composer/anecdote.mjs",
  "/composer/qr-mint.mjs", "/composer/qr-sign.mjs", "/composer/qr-mint-demo.html",
  "/composer/qr-encode.mjs",                                    // the mint demo imports it — must ride along
  "/composer/transfer.mjs", "/composer/fountain.mjs", "/composer/carrier.mjs",
  "/composer/qr-decode.mjs",                                    // the bigger lens — the catch reads by it
  "/composer/module-share.mjs",                                 // the system can export itself from a dead room
  "/composer/firmware-offer.mjs",                               // …and caught firmware knocks on the pin gate
  "/composer/bisect.mjs", "/composer/presence.mjs", "/composer/constituency.mjs",
  "/composer/constituency-demo.html",                           // find your constituencies in a dead room, no watchers
  "/composer/carrier-loop-demo.html", "/composer/carrier-catch-demo.html",   // both ends of the room, offline
  "/composer/firmware.mjs", "/viewer/poll.mjs", "/git-enough/read.mjs",
  // The MODELS HUB (/models/) — the non-bottle client that probes canonical model bottles. Its full import
  // closure so a direct, OFFLINE visit boots and can probe. Light by design: probe-engine is transport-agnostic
  // and embedBottle is the generic transport (composer/bottle-embed), so no git-enough client rides along.
  "/models/", "/models/index.html", "/models/index.mjs",
  "/composer/probe-engine.mjs", "/composer/open-engine.mjs", "/composer/install.mjs",
  "/composer/install-loader.mjs", "/composer/bottle-uri.mjs", "/composer/platform-key.mjs",
  "/composer/bottle-embed.mjs",
];
// ---- a tiny IndexedDB for the pin (fingerprint + held version + last rejection) and the MODE --------
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

const MODES = ["free", "hold", "guard"];
// A mode we do not recognise reads as `free`, the most permissive: an unreadable setting must not be
// able to lock anybody down. Failing open is the rule even when the failure is our own.
async function getMode() {
  const m = await pinGet("mode");
  return MODES.includes(m) ? m : "free";
}

// ---- slot helpers ----------------------------------------------------------------------------------
const missingFrom = async (cache) => {
  const out = [];
  for (const p of FALLBACK_SHELL) if (!(await cache.match(p))) out.push(p);
  return out;
};

// Copy shell paths from `src` into `dst`. `overwrite: false` FILLS GAPS ONLY — the seeding/migration
// case, where an existing floor entry is never disturbed. `overwrite: true` is promotion.
async function copyShell(src, dst, { overwrite }) {
  const moved = [];
  for (const p of FALLBACK_SHELL) {
    if (!overwrite && (await dst.match(p))) continue;
    const hit = await src.match(p);
    if (!hit) continue;
    await dst.put(p, hit.clone());
    moved.push(p);
  }
  return moved;
}

// PRECACHE HAS TO SURVIVE A REDIRECTING HOST, AND HAS TO SAY WHEN IT DOES NOT.
//
// The host serves every `.html` path as a 308 to its extensionless form, so several entries come back
// REDIRECTED. Storing a redirected response is at best fragile, and a bare `catch {}` would swallow a
// refusal without a sound — the shell would simply be missing those files the next time the origin was
// gone, which is the one moment nobody can debug it. So the bytes are re-wrapped into a plain 200
// stored under the path the shell actually asks for, and failures are counted and returned.
async function precache(cache, list) {
  const failed = [];
  await Promise.all(list.map(async (u) => {
    try {
      const r = await fetch(u, { cache: "reload" });
      if (!r.ok) { failed.push(u + " (HTTP " + r.status + ")"); return; }
      await cache.put(u, new Response(await r.blob(), { status: 200, headers: r.headers }));
    } catch (e) {
      failed.push(u + " (" + ((e && e.message) || e) + ")");
    }
  }));
  return failed;
}

// SEED THE FLOOR WITHOUT EVER DISTURBING IT.
//
// Gaps in HELD are filled from ROLLING and from any legacy single-cache shell, in that order. Existing
// held entries are left exactly as they are — this is the only way a first install (or an upgrade from
// the one-cache worker) acquires a floor, and it cannot take one away. A PARTIAL floor beats no floor:
// there is nothing to lose by adopting what we have.
async function seedHeld() {
  const held = await caches.open(HELD);
  const filled = [];
  filled.push(...(await copyShell(await caches.open(ROLLING), held, { overwrite: false })));
  for (const name of (await caches.keys()).filter((k) => LEGACY.test(k))) {
    filled.push(...(await copyShell(await caches.open(name), held, { overwrite: false })));
  }
  return filled;
}

// RETIRE THE OLD SINGLE CACHE — BUT ONLY ONCE THE FLOOR STANDS WITHOUT IT.
//
// This is the lockout bug, inverted. The old activate() deleted every non-matching shell cache the
// moment a new worker took over, so a network that died mid-install destroyed the only complete copy.
// Deletion is now a CONSEQUENCE OF A PROVEN FLOOR, never of activation: if HELD is not whole, the
// legacy cache stays exactly where it is, for as long as it takes.
async function retireLegacy() {
  const held = await caches.open(HELD);
  if ((await missingFrom(held)).length) return { retired: [], why: "held is not whole — keeping the old cache" };
  const names = (await caches.keys()).filter((k) => LEGACY.test(k));
  for (const n of names) await caches.delete(n);
  return { retired: names, why: names.length ? "held is whole" : "nothing to retire" };
}

// PROMOTION IS A MERGE. Rolling's bytes where it has them, held's where it does not — so the floor is
// whole by construction and a partial rolling can never punch a hole in it. That is why completeness is
// a STATUS on this page and not a veto anywhere: there is nothing for it to veto.
async function promote() {
  const mode = await getMode();
  const pinnedBy = await pinGet("by");
  if (mode === "guard" && pinnedBy) {
    return { mode: "refused", reason: "guarded and pinned — move the floor with a signed manifest, not a raw promote", by: pinnedBy };
  }
  const rolling = await caches.open(ROLLING);
  const held = await caches.open(HELD);
  const moved = await copyShell(rolling, held, { overwrite: true });
  const missing = await missingFrom(held);
  await pinSet("held_generation", SHELL_VERSION);
  await pinSet("promoted_at", Date.now());
  // Retiring is a consequence of the floor standing, and the floor can come to stand at any promote —
  // not only at activation. An upgrade that arrived on a bad network keeps the old cache for as long as
  // it takes, then lets it go the moment a later refresh completes the floor. Tying this to activate()
  // alone left it lingering forever once the moment had passed.
  const retired = await retireLegacy();
  return { mode: "promoted", moved: moved.length, missing, generation: SHELL_VERSION, retired: retired.retired };
}

// ---- the firmware check: fetch the manifest, decide, and precache ONLY if the pin accepts ------------
// SW-initiated fetch() does NOT re-enter our fetch handler, so these go straight to the network.
async function checkFirmware() {
  let signed = null;
  try { const r = await fetch("/firmware.json", { cache: "no-store" }); if (r.ok) signed = await r.json(); } catch {}
  if (!signed) return { mode: "unpinned" };          // no manifest: pinning dormant

  const pinnedBy = await pinGet("by");
  const held = (await pinGet("version")) || 0;
  const d = await pinDecision(signed, pinnedBy, held);
  if (!d.accept) {                                   // foreign signer / downgrade / bad sig — DO NOT adopt
    await pinSet("rejected", { by: d.by, reason: d.reason, at: Date.now() });
    return { mode: "refused", reason: d.reason, by: d.by };
  }

  const grabbed = new Map();
  const grab = async (p) => {
    if (grabbed.has(p)) return grabbed.get(p);
    try { const r = await fetch(p, { cache: "no-store" }); if (!r.ok) { grabbed.set(p, null); return null; }
      const rec = { buf: new Uint8Array(await r.arrayBuffer()), type: r.headers.get("content-type") }; grabbed.set(p, rec); return rec; }
    catch { grabbed.set(p, null); return null; }
  };
  const vf = await verifyFiles(signed, async (p) => { const rec = await grab(p); return rec ? rec.buf : null; });
  if (!vf.ok) { await pinSet("rejected", { reason: "file integrity: " + JSON.stringify(vf.bad), at: Date.now() }); return { mode: "refused", reason: "file integrity" }; }

  // Signed bytes land in ROLLING like every other update. They become the floor on a promote, which in
  // `free` happens immediately below and in `hold`/`guard` waits for the holder.
  const rolling = await caches.open(ROLLING);
  for (const f of signed.files) {
    const rec = grabbed.get(f.path);
    if (rec) await rolling.put(f.path, new Response(rec.buf, { headers: { "content-type": rec.type || "application/octet-stream" } }));
  }
  if (d.firstContact) await pinSet("by", d.by);
  await pinSet("version", d.version);
  await pinSet("rejected", null);
  if ((await getMode()) === "free") await promote();
  return { mode: d.firstContact ? "pinned" : "rolled-forward", by: d.by, version: d.version };
}

// A caught firmware offer (composer/firmware-offer.mjs) knocks on the SAME pin gate network updates
// face. The page hands over the AUTHOR-signed manifest + the offered bytes; the SW RE-DECIDES with its
// own pin — never trust the page — then verifies every offered byte before committing.
async function adoptOffer(manifest, offered) {
  const byPath = new Map((offered || []).map((f) => [f.path, { buf: new Uint8Array(f.buf), type: f.type || null }]));
  const pinnedBy = await pinGet("by");
  const held = (await pinGet("version")) || 0;
  const d = await pinDecision(manifest, pinnedBy, held);
  if (!d.accept) { await pinSet("rejected", { by: d.by, reason: d.reason, at: Date.now() }); return { mode: "refused", reason: d.reason, by: d.by }; }
  const vf = await verifyFiles(manifest, async (p) => { const rec = byPath.get(p); return rec ? rec.buf : null; });
  if (!vf.ok) { await pinSet("rejected", { reason: "offer file integrity: " + JSON.stringify(vf.bad), at: Date.now() }); return { mode: "refused", reason: "file integrity" }; }
  const rolling = await caches.open(ROLLING);
  for (const f of manifest.files) {
    const rec = byPath.get(f.path);
    if (rec) await rolling.put(f.path, new Response(rec.buf, { headers: { "content-type": rec.type || "application/octet-stream" } }));
  }
  if (d.firstContact) await pinSet("by", d.by);
  await pinSet("version", d.version);
  await pinSet("rejected", null);
  if ((await getMode()) === "free") await promote();
  return { mode: d.firstContact ? "pinned" : "rolled-forward", by: d.by, version: d.version, source: "offer" };
}

// ---- lifecycle --------------------------------------------------------------------------------------
self.addEventListener("install", (e) => e.waitUntil((async () => {
  await precache(await caches.open(ROLLING), FALLBACK_SHELL);   // the newest copy we can get
  await seedHeld();                                             // ...and a floor, if there wasn't one
  await checkFirmware().catch(() => {});
  // Deliberately NO skipWaiting(): a new worker waits for every tab to close. /shell.html can pull it
  // forward when the holder asks.
})()));

self.addEventListener("activate", (e) => e.waitUntil((async () => {
  await seedHeld();        // an upgrade from the one-cache worker adopts its shell as the floor here
  await retireLegacy();    // ...and only then is the old cache allowed to go
  await self.clients.claim();
})()));

// ---- messages ----------------------------------------------------------------------------------------
self.addEventListener("message", (e) => {
  if (!e.data) return;
  const port = e.ports && e.ports[0];
  const reply = (p) => e.waitUntil((async () => { const r = await p.catch((err) => ({ mode: "error", reason: String(err) })); if (port) port.postMessage(r); })());

  if (e.data.type === "firmware-check") reply(checkFirmware());
  else if (e.data.type === "firmware-offer") reply(adoptOffer(e.data.manifest, e.data.files));
  else if (e.data.type === "shell-status") reply(shellStatus());
  else if (e.data.type === "shell-refresh") reply(shellRefresh());
  else if (e.data.type === "shell-promote") reply(promote());
  else if (e.data.type === "shell-mode") reply(setMode(e.data.mode));
  // The holder pulling a waiting worker forward. There is no skipWaiting() in install() on purpose;
  // this is the same act, asked for rather than taken.
  else if (e.data.type === "take-waiting") { self.skipWaiting(); if (port) port.postMessage({ mode: "taking" }); }
});

async function setMode(mode) {
  if (!MODES.includes(mode)) return { mode: "error", reason: "unknown mode: " + mode };
  await pinSet("mode", mode);
  // Moving to `free` should feel immediate: adopt whatever rolling already holds rather than making
  // the holder ask twice.
  if (mode === "free") await promote();
  return { mode: "set", to: mode };
}

// WHAT THE SHELL ACTUALLY HOLDS — the read /shell.html renders.
//
// FALLBACK_SHELL lives here and nowhere else, so the page cannot be handed a stale copy of the list: it
// asks the worker actually serving it. Both slots are reported live against the caches rather than from
// a stored install report, so the numbers stay true after an eviction nobody witnessed. precache() has
// always counted its failures; this is where that count finally reaches a person.
async function shellStatus() {
  const held = await caches.open(HELD), rolling = await caches.open(ROLLING);
  const heldMissing = await missingFrom(held), rollingMissing = await missingFrom(rolling);
  let runtime = 0;
  try { runtime = (await (await caches.open(RUNTIME)).keys()).length; } catch {}
  return {
    generation: SHELL_VERSION,
    total: FALLBACK_SHELL.length,
    mode: await getMode(),
    held: { missing: heldMissing, complete: heldMissing.length === 0 },
    rolling: { missing: rollingMissing, complete: rollingMissing.length === 0 },
    runtime,
    legacy: (await caches.keys()).filter((k) => LEGACY.test(k)),
    heldGeneration: await pinGet("held_generation"),
    promotedAt: await pinGet("promoted_at"),
    pin: { by: await pinGet("by"), held: (await pinGet("version")) || 0, rejected: await pinGet("rejected") },
  };
}

// ASK THE CACHE TO GO FORWARD. Refills ROLLING from the network — never the floor, so this is safe in
// every mode and needs no permission: rolling is not what catches you. In `free` the fresh copy is
// promoted straight away; in `hold`/`guard` it waits for the holder to promote it, which is the whole
// point of those modes. Nothing is unregistered and the trove is never opened.
async function shellRefresh() {
  const rolling = await caches.open(ROLLING);
  const failed = await precache(rolling, FALLBACK_SHELL);
  await seedHeld();                                   // a first-ever fill also lays the floor
  let promoted = null;
  if ((await getMode()) === "free") promoted = await promote();
  return { mode: failed.length ? "partial" : "refreshed", generation: SHELL_VERSION, total: FALLBACK_SHELL.length, failed, promoted };
}

// ---- fetch --------------------------------------------------------------------------------------------
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/firmware.json") return;         // control data — always fresh, never shell-cached
  if (url.pathname === "/sites.json") return e.respondWith(fresh(req));  // directory data — see fresh()
  e.respondWith(handle(e));
});

const SHELL = new Set(FALLBACK_SHELL);
const isShell = (req) => {
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return false;
  return SHELL.has(u.pathname) || (req.mode === "navigate" && SHELL.has(u.pathname.replace(/\/$/, "/index.html")));
};

// Network-first with a cached floor, for DATA. The directory would freeze at whatever a visitor saw
// once under cache-first, and the daily sync would never reach anybody. Offline, the last good copy
// still renders — the origin being unreachable is the normal case here.
async function fresh(req) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await fetch(req);
    if (res && res.ok) { cache.put(req, res.clone()); return res; }
  } catch {}
  return (await cache.match(req)) || Response.error();
}

// Pull a fresh copy into ROLLING behind an already-served response. Only runs in `free`.
async function revalidate(path) {
  try {
    const r = await fetch(path, { cache: "reload" });
    if (!r.ok) return;
    await (await caches.open(ROLLING)).put(path, new Response(await r.blob(), { status: 200, headers: r.headers }));
  } catch {}
}

// THE LAYERED READ. Every mode reaches every slot; the mode only decides the ORDER and whether we
// revalidate behind the response. There is no arrangement of state here that returns nothing when
// something is held.
async function handle(e) {
  const req = e.request;
  if (!isShell(req)) return runtime(req);

  const mode = await getMode();
  const opts = { ignoreSearch: req.mode === "navigate" };
  const held = await caches.open(HELD), rolling = await caches.open(ROLLING);
  const order = mode === "free" ? [rolling, held] : [held, rolling];

  for (const c of order) {
    const hit = await c.match(req, opts);
    if (hit) {
      if (mode === "free") e.waitUntil(revalidate(new URL(req.url).pathname));
      return hit;
    }
  }
  // Nothing held for this path in either slot — go get it, and keep it.
  try {
    const res = await fetch(req);
    if (res && res.ok) rolling.put(new URL(req.url).pathname, res.clone()).catch(() => {});
    return res;
  } catch {}
  return (await navFallback(req, opts)) || Response.error();
}

async function runtime(req) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
    if (hit) return hit;
    return (await navFallback(req, { ignoreSearch: true })) || Response.error();
  }
}

// A navigation with nothing of its own left still lands somewhere real rather than on a browser error
// page: whatever shell entry point either slot still holds.
async function navFallback(req, opts) {
  if (req.mode !== "navigate") return null;
  for (const name of [HELD, ROLLING]) {
    const c = await caches.open(name);
    for (const p of ["/poll.html", "/index.html", "/shell.html", "/"]) {
      const hit = await c.match(p, opts);
      if (hit) return hit;
    }
  }
  return null;
}
