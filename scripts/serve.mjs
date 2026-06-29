// Tiny dependency-free static server for the worker-bus proof.
//   node scripts/serve.mjs            # serves the repo root on http://localhost:8000
//   PORT=8080 node scripts/serve.mjs
// Then open http://localhost:8000/composer/crunch.html
//
// Serves the whole repo so /composer/, /reducer/ (incl. node_modules for the optional MiniLM
// path), and /models/ all resolve from one origin with no CDN. Correct MIME for ES modules, wasm,
// and onnx is required for the browser to execute/instantiate them.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");   // repo root
const PORT = Number(process.env.PORT) || 8000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".onnx": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const abs = join(ROOT, normalize(path));
    if (!abs.startsWith(ROOT)) { res.writeHead(403).end("forbidden"); return; }   // no traversal
    const s = await stat(abs).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[extname(abs)] || "application/octet-stream" });
    // (The real-MiniLM threaded-wasm upgrade may add COOP/COEP for SharedArrayBuffer; the toy
    //  proof and single-threaded onnx do not need cross-origin isolation.)
    res.end(await readFile(abs));
  } catch (e) {
    res.writeHead(500).end(String(e?.message || e));
  }
}).listen(PORT, () => console.log(`serving ${ROOT}\n  http://localhost:${PORT}/composer/crunch.html`));
