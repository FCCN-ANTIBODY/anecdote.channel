// sw.js — the offline APP SHELL for anecdote.channel (docs/origin.md, "an offline-first web app that loads
// with no connection"). This is the piece that makes the offline origin actually offline: once a holder has
// visited (consented), the shell is cached, so anecdote boots even when anecdote.channel is unreachable —
// no DNS, no CDN, no app store. If DNS + Cloudflare + everything broke, a holder still has the app.
//
// SCOPE OF THE RULE "not a service worker" (origin.md:268): that invariant is about the powerless
// data:CHAMBER — a puppeted data: tab that must never be a registered worker. It does NOT bar the served
// ELEVATED shell from using one; origin.md:299-302 explicitly leaves that open ("the served origin may be a
// SW … name the two load paths"). This file resolves it:
//   - the SHELL (this SW) is cache-first held code — so it survives a dead origin;
//   - the CHAMBER stays a data: tab spawned over the probe line — never controlled by, never a, SW;
//   - git-enough stays a normal module the shell loads — never registered as the worker (origin.md:82-92).
//
// Two storage layers, kept distinct: this Cache-API precache holds the CODE (the shell); the trove and git
// objects live in IndexedDB (consent.mjs's store / the blob shelving). This SW never touches your data.

const VERSION = "anecdote-shell-v1";

// The minimal shell: the small files that must be HELD to boot the core offline flows — answer a poll
// (poll.html), mint + sign a QR (qr-mint-demo.html), and their module graphs. The heavy on-device model
// (~48 MB under runtime/ + models/) is deliberately NOT precached; it is cached on-demand on first use
// (below), so install stays fast and the origin-eclipse promise still holds for the core flows.
const SHELL = [
  "/", "/index.html", "/poll.html", "/manifest.webmanifest", "/icon.svg",
  // answer runtime (poll.html → probe line → consent → sign → anecdote; poll-answer is self-contained)
  "/composer/probe-line.mjs", "/composer/authorize.mjs", "/composer/consent.mjs",
  "/composer/sign.mjs", "/composer/anecdote.mjs", "/composer/poll-answer.mjs",
  // mint + sign (the Tell-side minting, offline): qr-mint.mjs dynamically imports qr-sign.mjs
  "/composer/qr-mint.mjs", "/composer/qr-sign.mjs", "/composer/qr-mint-demo.html",
  "/viewer/poll.mjs", "/git-enough/read.mjs",
];

self.addEventListener("install", (e) => {
  // Fetch each shell file individually so one 404 can't abort the whole precache (addAll is all-or-nothing).
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map(async (u) => {
      try { const r = await fetch(u, { cache: "reload" }); if (r.ok) await cache.put(u, r); } catch {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // Drop older shell caches (version bump = the roll-forward; the holder's update lever, later, gates this).
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("anecdote-shell-") && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                         // never intercept writes
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // only our own origin (never proxy elsewhere)
  e.respondWith(handle(req));
});

// Cache-first: a held file wins (so a dead origin still boots). On a miss, go to the network and hold the
// response for next time (this is what caches the heavy model on first online use). Offline + not held: a
// navigation falls back to a held shell page rather than a browser error.
async function handle(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
    return res;
  } catch {
    if (req.mode === "navigate") {
      return (await cache.match("/poll.html")) || (await cache.match("/index.html")) || Response.error();
    }
    return Response.error();
  }
}
