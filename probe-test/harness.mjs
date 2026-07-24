// probe-test/harness.mjs — REAL-CHROMIUM ground truth for the UI, committed. The docs carry years of
// "VERIFIED (Chromium, headless)" prose describing manual edge walks that never landed as runnable
// tests; this harness is where those claims become executable. It drives the actual browser over the
// Chrome DevTools Protocol with NOTHING vendored: Node 22's built-in WebSocket is the wire, node:http
// serves the origins, and the browser is whatever Chromium the environment already has (CHROMIUM env
// var, or a well-known binary on PATH). No browser found → suites SKIP cleanly, the same posture as
// data-pile's ssh-optional legs and the reducer's MiniLM skip. CI runners carry Chrome; a laptop
// without one still gets the full pure-Node suite.
//
// The constellation's real topology is cross-origin BY DESIGN — a made-up <name>.tell.anecdote.channel
// floor iframes tell.anecdote.channel, which forwards to anecdote.channel; bottles live on their own
// sub-sub-domains. So the harness serves MANY ORIGINS from one node:http server keyed by Host header,
// and launches Chromium with --host-resolver-rules mapping EVERY hostname to 127.0.0.1: the pages run
// on their true production hostnames, same-origin boundaries genuinely between them, while any request
// to a host the test did not stand up lands on this server (recorded, refused) instead of the network.
// Each origin is granted secure-context status (--unsafely-treat-insecure-origin-as-secure) so
// crypto.subtle is live exactly as it is in production — the signing suite runs for real.
//
// Site-isolation process-splitting is disabled so every frame's JS context is reachable from one CDP
// session (contexts are enumerated per frame; evaluate targets a frame by its URL). That switch moves
// frames into one PROCESS; the same-origin policy, postMessage origin attestation, and sandboxed
// data: chamber powerlessness are renderer semantics and stay fully enforced — they are what these
// tests exist to exercise.
//
// House shape: dependency-free ESM, everything injectable, one file. A UI suite composes:
//   const chromium = findChromium();            // null → log "skip" and exit 0
//   const server = await serveOrigins({ "anecdote.channel": { root: repoRoot } });
//   const browser = await launch({ server, chromium });
//   const page = await browser.page();
//   await page.goto("http://anecdote.channel:" + server.port + "/poll.html?...");
//   await page.waitFor("!!document.querySelector('h3')", { frame: "data:" });

import http from "node:http";
import https from "node:https";
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, statSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join, normalize, extname } from "node:path";
import os from "node:os";

// ---- finding the browser -------------------------------------------------------------------------

const CANDIDATES = [
  "chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "chrome",
];

// The Chromium to drive: $CHROMIUM wins (an explicit path), then well-known names on PATH. Returns
// null when the environment has none — the caller's cue to skip, never to fail.
export function findChromium(env = process.env) {
  if (env.CHROMIUM && existsSync(env.CHROMIUM)) return env.CHROMIUM;
  for (const name of CANDIDATES) {
    try {
      const p = execFileSync("which", [name], { encoding: "utf8" }).trim();
      if (p) return p;
    } catch { /* not on PATH — next candidate */ }
  }
  return null;
}

// ---- the multi-origin server ---------------------------------------------------------------------

const MIME = {
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".wasm": "application/wasm", ".webmanifest": "application/manifest+json",
  ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".yml": "text/plain; charset=utf-8", ".yaml": "text/plain; charset=utf-8",
};
const mimeOf = (p) => MIME[extname(p).toLowerCase()] || "application/octet-stream";

// Resolve a request path against one origin's config. An origin is served from a directory (`root`),
// an in-memory tree (`tree`: path → content, e.g. a jekyll-enough build), or both (tree wins). The
// `fallback` path (e.g. "index.html") answers any path that resolves to no file — the wildcard-mask
// edge behavior ("every wildcard path serves the one Floor template"), opted into per origin.
function lookup(origin, reqPath) {
  const clean = normalize(decodeURIComponent(reqPath.split("?")[0])).replace(/^\/+/, "");
  const tryPaths = clean === "" || clean.endsWith("/")
    ? [clean + "index.html"]
    : [clean, clean + "/index.html", clean + ".html"];
  for (const p of tryPaths) {
    if (p.includes("..")) return null;
    if (origin.tree) {
      const hit = origin.tree instanceof Map ? origin.tree.get(p) : origin.tree[p];
      if (hit !== undefined) return { path: p, content: hit };
    }
    if (origin.root) {
      const full = join(origin.root, p);
      try {
        if (statSync(full).isFile()) return { path: p, content: readFileSync(full) };
      } catch { /* not a file here — next candidate */ }
    }
  }
  if (origin.fallback) {
    const fb = lookup({ ...origin, fallback: null }, "/" + origin.fallback);
    if (fb) return fb;
  }
  return null;
}

// Serve a set of origins from one ephemeral 127.0.0.1 port, keyed by Host header. Every request is
// recorded on `served` (host, path, hit/miss) so a suite can assert exactly what the pages reached
// for — the floor's "no fetches at all" and the bottle-maker's "no network before the click" are
// assertable facts here, not prose. A host the map doesn't name gets a 404 and a `foreign` record:
// with the browser resolving every hostname to this server, a page phoning anywhere shows up.
//
// Two transports:
//   default    — plain http on an ephemeral port; pages address each other with the port stitched in.
//                Right for single-origin suites (portable: no privileges, no certs).
//   tls: true  — REAL https on 443 (self-signed via the openssl CLI; the browser launches with
//                --ignore-certificate-errors). This is for the cross-origin chains: shipped pages pin
//                absolute production URLs (the floor's stage on https://tell.anecdote.channel, Tell's
//                forward to https://anecdote.channel/poll.html), and only the true scheme+port lets
//                those bytes run UNMODIFIED. Needs the 443 bind (root, CAP_NET_BIND_SERVICE, or
//                `sysctl net.ipv4.ip_unprivileged_port_start=443` in CI); returns null when the
//                environment refuses — the suite's cue to skip, never to fail.
// The browser's own infrastructure phones home (spellcheck dictionaries, account state, autofill,
// component updates) even with the disable flags; with every hostname resolved to the harness those
// land here too. They are BROWSER traffic, not page traffic — recorded on `noise`, kept out of
// `foreign` so "no request escaped" stays an assertion about the pages under test.
const BROWSER_NOISE = /(^|\.)(gvt1\.com|google\.com|googleapis\.com|gstatic\.com|googleusercontent\.com|youtube\.com|cloudflare-dns\.com)$/;

export async function serveOrigins(origins, { tls = false } = {}) {
  const served = [];
  const foreign = [];
  const noise = [];
  const apiCalls = [];
  const handler = (req, res) => {
    const host = String(req.headers.host || "").split(":")[0];
    const origin = origins[host];
    if (!origin) {
      (BROWSER_NOISE.test(host) ? noise : foreign).push({ host, path: req.url });
      res.statusCode = 404;
      return res.end("harness: no such origin: " + host);
    }
    // Cross-origin POSTs preflight; answer for any origin so the real adapters' requests go through.
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-methods", "*");
      res.setHeader("access-control-allow-headers", "*");
      return res.end();
    }
    // An origin may declare an `api` handler — a stand-in for a JSON API (a fake api.github.com, a
    // submit relay) so pages can be driven through their REAL egress adapters with every request
    // RECORDED (method, path, auth header, body) on `server.apiCalls`. Non-GET requests route to it;
    // GETs still serve files, so one origin can be both a site and an API. The handler returns
    // { status, json } — the same contract the adapters' transports expect back.
    if (origin.api && req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", async () => {
        const call = { host, method: req.method, path: req.url, authorization: req.headers.authorization || null,
                       body: Buffer.concat(chunks).toString("utf8") };
        apiCalls.push(call);
        let out;
        try { out = await origin.api(call); } catch (e) { out = { status: 500, json: { message: String(e && e.message || e) } }; }
        res.statusCode = (out && out.status) || 200;
        res.setHeader("content-type", "application/json");
        res.setHeader("access-control-allow-origin", "*");
        res.end(JSON.stringify((out && out.json) || {}));
      });
      return;
    }
    const found = lookup(origin, req.url || "/");
    served.push({ host, path: req.url, hit: !!found });
    if (!found) { res.statusCode = 404; return res.end("harness: not found"); }
    res.setHeader("content-type", mimeOf(found.path));
    // GitHub Pages serves everything with a permissive ACAO — cross-origin module imports and
    // fetches between the constellation's origins behave in the harness as they do deployed.
    res.setHeader("access-control-allow-origin", "*");
    res.end(found.content);
  };

  let server;
  if (tls) {
    const dir = mkdtempSync(join(os.tmpdir(), "probe-test-tls-"));
    try {
      execFileSync("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256",
        "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"), "-days", "2", "-nodes",
        "-subj", "/CN=anecdote.channel"], { stdio: "ignore" });
    } catch { rmSync(dir, { recursive: true, force: true }); return null; }
    server = https.createServer({ key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) }, handler);
    rmSync(dir, { recursive: true, force: true });
    const bound = await new Promise((resolve) => {
      server.on("error", () => resolve(false));
      server.listen(443, "127.0.0.1", () => resolve(true));
    });
    if (!bound) return null;
  } else {
    server = http.createServer(handler);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
  }
  const port = server.address().port;
  return {
    port,
    tls,
    served,
    foreign,
    noise,
    apiCalls,
    hosts: Object.keys(origins),
    urlFor: (host, path = "/") => (tls ? `https://${host}${path}` : `http://${host}:${port}${path}`),
    close: () => new Promise((r) => server.close(r)),
  };
}

// ---- the browser over CDP ------------------------------------------------------------------------

// Launch headless Chromium aimed at the harness server and open a CDP connection. Every hostname
// resolves to 127.0.0.1 ("MAP * …"), each served origin is secure-context, and the profile is a
// throwaway tmp dir removed on close.
// The launch window is generous: on a busy CI runner Chrome can spend >20s in startup (blocking
// dbus connection attempts each eat seconds before the DevTools endpoint appears).
export async function launch({ server, chromium, timeout = 90000 } = {}) {
  const bin = chromium || findChromium();
  if (!bin) throw new Error("harness: no chromium (findChromium() first and skip)");
  const profile = mkdtempSync(join(os.tmpdir(), "probe-test-"));
  // On the plain-http transport the served origins are granted secure-context by name; on the tls
  // transport they are genuinely secure and only the self-signed cert needs waving through.
  const trust = server.tls
    ? ["--ignore-certificate-errors"]
    : [`--unsafely-treat-insecure-origin-as-secure=${server.hosts.map((h) => `http://${h}:${server.port}`).join(",")}`];
  const proc = spawn(bin, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--remote-debugging-port=0",
    "--no-proxy-server",             // ignore any ambient proxy env — every host resolves to the harness
    "--host-resolver-rules=MAP * 127.0.0.1",
    ...trust,
    "--disable-site-isolation-trials",
    "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
    "--disable-sync", "--disable-default-apps", "--disable-component-update", "--metrics-recording-only",
    "--mute-audio", "--disable-features=Translate,OptimizationHints,AutofillServerCommunication,MediaRouter",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  const wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error("harness: DevTools endpoint never appeared\n" + buf)), timeout);
    proc.stderr.on("data", (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on("exit", () => { clearTimeout(timer); reject(new Error("harness: chromium exited at launch\n" + buf)); });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("harness: CDP socket failed")); });

  let msgId = 0;
  const replies = new Map();          // id → resolve
  const listeners = new Map();        // sessionId|"" → (method, params) => void
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && replies.has(msg.id)) {
      const done = replies.get(msg.id);
      replies.delete(msg.id);
      done(msg);
    } else if (msg.method) {
      const fn = listeners.get(msg.sessionId || "");
      if (fn) fn(msg.method, msg.params);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++msgId;
    replies.set(id, (msg) => msg.error ? reject(new Error(`harness: ${method}: ${msg.error.message}`)) : resolve(msg.result));
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  const pages = [];
  const browser = {
    process: proc,
    async page() {
      const { targetId } = await send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      const p = await makePage({ send, listeners, sessionId, targetId });
      pages.push(p);
      return p;
    },
    async close() {
      try { ws.close(); } catch { /* already down */ }
      proc.kill();
      await new Promise((r) => { proc.on("exit", r); setTimeout(r, 2000); });
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* tmp reaper's problem */ }
    },
  };
  return browser;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One tab. Tracks every frame (by navigation events), every JS execution context (so evaluate can
// target ANY frame — the floor, the Tell it iframes, the data: chamber inside that), and every
// network request the page makes.
async function makePage({ send, listeners, sessionId, targetId }) {
  const frames = new Map();     // frameId → { url, parentId }
  const contexts = new Map();   // contextId → { frameId, origin, isDefault }
  const requests = [];          // { url, method, frameId }
  let mainFrameId = null;

  listeners.set(sessionId, (method, params) => {
    if (method === "Page.frameNavigated") {
      const f = params.frame;
      if (!f.parentId) {          // a main-frame navigation tears down every child frame with it
        mainFrameId = f.id;
        for (const id of [...frames.keys()]) if (id !== f.id) frames.delete(id);
      }
      frames.set(f.id, { url: f.url, parentId: f.parentId || null });
    } else if (method === "Page.frameDetached") {
      frames.delete(params.frameId);
    } else if (method === "Runtime.executionContextCreated") {
      const c = params.context;
      const aux = c.auxData || {};
      contexts.set(c.id, { frameId: aux.frameId, origin: c.origin, isDefault: !!aux.isDefault });
    } else if (method === "Runtime.executionContextDestroyed") {
      contexts.delete(params.executionContextId);
    } else if (method === "Runtime.executionContextsCleared") {
      contexts.clear();
    } else if (method === "Network.requestWillBeSent") {
      requests.push({ url: params.request.url, method: params.request.method, frameId: params.frameId });
    }
  });

  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Network.enable", {}, sessionId);
  const tree = await send("Page.getFrameTree", {}, sessionId);
  mainFrameId = tree.frameTree.frame.id;
  frames.set(mainFrameId, { url: tree.frameTree.frame.url, parentId: null });

  // frame selector → frameId. A string matches by substring of the frame's current URL; a function
  // gets ({ frameId, url }) and decides. Undefined → the main frame.
  const frameIdOf = (frame) => {
    if (frame === undefined || frame === null) return mainFrameId;
    for (const [id, f] of frames) {
      if (typeof frame === "function" ? frame({ frameId: id, url: f.url }) : String(f.url).includes(frame)) return id;
    }
    return null;
  };

  const page = {
    requests,
    frames: () => [...frames].map(([id, f]) => ({ frameId: id, url: f.url, parentId: f.parentId })),

    async goto(url, { timeout = 20000 } = {}) {
      const loaded = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("harness: navigation timeout: " + url)), timeout);
        const prev = listeners.get(sessionId);
        listeners.set(sessionId, (method, params) => {
          prev(method, params);
          if (method === "Page.loadEventFired") { clearTimeout(timer); listeners.set(sessionId, prev); resolve(); }
        });
      });
      await send("Page.navigate", { url }, sessionId);
      await loaded;
    },

    // Evaluate in a frame's own JS context (awaits promises; returns by value). `frame` targets an
    // iframe by URL substring — e.g. "data:" reaches the powerless chamber, "tell.anecdote.channel"
    // the iframed Tell — exactly the boundaries the constellation is made of.
    async eval(expression, { frame } = {}) {
      const fid = frameIdOf(frame);
      if (!fid) throw new Error("harness: no frame matching " + frame);
      let contextId;
      for (const [id, c] of contexts) if (c.frameId === fid && c.isDefault) contextId = id;
      if (!contextId) throw new Error("harness: no JS context yet in frame " + (frames.get(fid) || {}).url);
      const { result, exceptionDetails } = await send("Runtime.evaluate",
        { expression, contextId, awaitPromise: true, returnByValue: true }, sessionId);
      if (exceptionDetails) {
        const detail = (exceptionDetails.exception && exceptionDetails.exception.description) || exceptionDetails.text;
        throw new Error("harness: page threw: " + detail);
      }
      return result.value;
    },

    // Poll an expression until truthy (frames and contexts appear asynchronously — iframes boot,
    // chambers hello — so retry evaluate-level failures until the deadline, then surface the last).
    async waitFor(expression, { frame, timeout = 15000, every = 100 } = {}) {
      const deadline = Date.now() + timeout;
      let lastErr = null;
      while (Date.now() < deadline) {
        try {
          const v = await page.eval(expression, { frame });
          if (v) return v;
          lastErr = null;
        } catch (e) { lastErr = e; }
        await sleep(every);
      }
      throw new Error("harness: waitFor timed out: " + expression + (lastErr ? "\n  last: " + lastErr.message : ""));
    },

    async close() { try { await send("Target.closeTarget", { targetId }); } catch { /* browser going down */ } },
  };
  return page;
}

// ---- the one-call form ---------------------------------------------------------------------------

// Stand up origins + browser + one page, run the suite body, tear everything down whatever happens.
// Resolves false without running the body when the environment can't host the run (no Chromium; or
// tls requested and 443 refused) — the caller logs the skip:
//   if (!await withPage({ origins }, async (page, h) => { ... })) console.log("skipped");
export async function withPage({ origins, chromium = findChromium(), tls = false }, body) {
  if (!chromium) return false;
  const server = await serveOrigins(origins, { tls });
  if (!server) return false;
  const browser = await launch({ server, chromium });
  try {
    const page = await browser.page();
    await body(page, { server, browser });
    return true;
  } finally {
    await browser.close();
    await server.close();
  }
}
