// scripts/serve-constellation.mjs — the SUBDOMAIN WORLD on one port, for the press (press/README.md).
//
//   node scripts/serve-constellation.mjs          # then open http://anecdote.localhost:8137/press/
//   PORT=9000 node scripts/serve-constellation.mjs
//
// scripts/serve.mjs serves ONE origin, which is all the older demos needed. The press is an iframe onto
// other origins, so it needs the others to exist. Browsers resolve every `*.localhost` name to loopback by
// themselves (no /etc/hosts, no DNS), and each distinct hostname is a distinct ORIGIN with its own storage —
// so one server keyed by the Host header gives real same-origin walls between real hostnames:
//
//   anecdote.localhost                 this repo (the apex)
//   <name>.anecdote.localhost          the sibling checkout ../<name>.anecdote.channel, served AS COMMITTED —
//                                      no build. That is the point: the press reads source.
//   <label>.library.anecdote.localhost the library's shelf (docs/decisions.md D18). A label resolves to
//                                        press/fixtures/shelf/<label>/, else a sibling checkout by that name
//                                        (../<label> or ../<label>.anecdote.channel) — the thawed group,
//                                        shelved by label — else THE FLOOR.
//   <name>.tell.anecdote.localhost     Tell's own floor (../tell.anecdote.channel/floor) when it is there.
//
// THE FLOOR (docs/flooring.md): a label nobody shelved anything at still answers, with one identical tile.
// "A miss on the rack is an invitation rather than a 404." Here that tile is press/floor/, a STAND-IN for
// what the library will lay across *.library with the bottles driver mounted — it is not that floor.
//
// Dependency-free, read-only, loopback-only. Dotfiles are never served (a sibling checkout has a .git).

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const GROUP = join(ROOT, "..");                       // where sibling checkouts sit, when they sit anywhere
const PORT = Number(process.env.PORT) || 8137;
const APEX = "anecdote.localhost";
const FLOOR = join(ROOT, "press", "floor");
const SHELF = join(ROOT, "press", "fixtures", "shelf");

const MIME = {
  ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".md": "text/markdown; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8", ".yaml": "text/yaml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".wasm": "application/wasm", ".webmanifest": "application/manifest+json", ".map": "application/json; charset=utf-8",
};

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const dir = (p) => (existsSync(p) ? p : null);

// Which directory answers for a hostname: { root, floor } — floor true means "the tile, at every path".
// Pure apart from existence checks, and exported so the mapping is testable without binding a port.
export function rootFor(hostname, { group = GROUP, root = ROOT } = {}) {
  const h = String(hostname || "").toLowerCase();
  if (h === APEX) return { root, floor: false };
  if (!h.endsWith("." + APEX)) return null;
  const labels = h.slice(0, -(APEX.length + 1)).split(".");
  if (!labels.every((l) => LABEL.test(l))) return null;
  if (labels.length === 1) {
    const sib = dir(join(group, labels[0] + ".anecdote.channel"));
    return sib && sib !== root ? { root: sib, floor: false } : null;
  }
  if (labels.length === 2 && labels[1] === "library") {
    const at = dir(join(SHELF, labels[0])) || dir(join(group, labels[0] + ".anecdote.channel")) || dir(join(group, labels[0]));
    return at && at !== root ? { root: at, floor: false } : { root: FLOOR, floor: true };
  }
  if (labels.length === 2 && labels[1] === "tell") {
    const tell = dir(join(group, "tell.anecdote.channel", "floor"));
    return { root: tell || FLOOR, floor: true };
  }
  return null;
}

async function serve(req, res) {
  const host = String(req.headers.host || "").split(":")[0];
  const where = rootFor(host);
  const head = { "access-control-allow-origin": "*", "cache-control": "no-store" };   // deployed origins send ACAO * too
  if (!where) { res.writeHead(404, head).end("no such origin here: " + host); return; }
  let path;
  try { path = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400, head).end("bad path"); return; }
  if (path.split("/").some((seg) => seg.startsWith(".") && seg !== "." )) { res.writeHead(404, head).end("not found"); return; }
  if (path.endsWith("/")) path += "index.html";
  const abs = join(where.root, normalize(path));
  if (!abs.startsWith(where.root)) { res.writeHead(403, head).end("forbidden"); return; }
  const s = await stat(abs).catch(() => null);
  if (!s || !s.isFile()) { res.writeHead(404, head).end("not found"); return; }
  res.writeHead(200, { ...head, "content-type": MIME[extname(abs)] || "application/octet-stream" });
  res.end(await readFile(abs));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createServer((req, res) => serve(req, res).catch((e) => res.writeHead(500).end(String(e && e.message || e))))
    .listen(PORT, "127.0.0.1", () => {
      console.log(`the subdomain world, on loopback\n  http://${APEX}:${PORT}/press/\n\nsiblings found beside this checkout are served as committed; everything else under *.library is floor.`);
    });
}
