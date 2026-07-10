// git-enough/node-compat.mjs — the Node-compat layer for actions-enough (docs/actions-enough.md, phase 1).
//
// A virtual fs + path + env over an IN-MEMORY tree (a Map of posix-path -> bytes), so a workflow step's
// file operations run on the DEVICE against the git-enough working tree instead of a hosted runner's disk.
// This is the scarce core the plan names: the repo's bin/*.mjs are fs + path + WebCrypto, so this shim is
// most of what "run the workflow locally" needs. Browser-native and pure — the same code Node uses in the
// tests. The remaining builtins a script might touch (node:crypto createHash, node:zlib) are named gaps
// added when a real step needs them; WebCrypto (subtle) already works in both Node and the browser.

const enc = new TextEncoder();
const dec = new TextDecoder();

// Posix-normalize to a virtual-root-relative key: drop leading "/" and "./", collapse "//", resolve "."/"..".
// Every fs key is relative to one virtual root, so an absolute path and its relative twin land on one entry.
export function normalize(p) {
  const raw = String(p == null ? "" : p).replace(/\\/g, "/");
  const parts = [];
  for (const seg of raw.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") { if (parts.length && parts[parts.length - 1] !== "..") parts.pop(); else parts.push(".."); }
    else parts.push(seg);
  }
  return parts.join("/");
}

const toBytes = (data) => typeof data === "string" ? enc.encode(data)
  : data instanceof Uint8Array ? data : new Uint8Array(data);
const enoent = (p) => { const e = new Error(`ENOENT: no such file or directory, '${p}'`); e.code = "ENOENT"; return e; };

// The virtual fs: the sync surface the bin scripts actually use. `seed` is { "path": string|bytes }.
export function virtualFs(seed = {}) {
  const files = new Map();
  for (const [k, v] of Object.entries(seed)) files.set(normalize(k), toBytes(v));

  const hasDir = (p) => { const pre = p ? p + "/" : ""; for (const k of files.keys()) if (p === "" || k.startsWith(pre)) return true; return false; };

  return {
    existsSync(p) { p = normalize(p); return files.has(p) || hasDir(p); },
    readFileSync(p, opt) {
      const b = files.get(normalize(p));
      if (!b) throw enoent(p);
      const utf8 = opt === "utf8" || opt === "utf-8" || (opt && opt.encoding && /^utf-?8$/.test(opt.encoding));
      return utf8 ? dec.decode(b) : b;
    },
    writeFileSync(p, data) { files.set(normalize(p), toBytes(data)); },
    mkdirSync(_p, _opt) { /* directories are implicit in the path keys — nothing to create */ },
    readdirSync(p) {
      p = normalize(p);
      const pre = p ? p + "/" : "";
      const names = new Set();
      for (const k of files.keys()) if (k.startsWith(pre)) { const rest = k.slice(pre.length); if (rest) names.add(rest.split("/")[0]); }
      return [...names].sort();
    },
    statSync(p) {
      p = normalize(p);
      const isFile = files.has(p);
      const isDir = !isFile && hasDir(p);
      if (!isFile && !isDir) throw enoent(p);
      return { isFile: () => isFile, isDirectory: () => isDir, size: isFile ? files.get(p).length : 0 };
    },
    rmSync(p, opt = {}) {
      p = normalize(p);
      files.delete(p);
      if (opt.recursive) { const pre = p + "/"; for (const k of [...files.keys()]) if (k.startsWith(pre)) files.delete(k); }
    },
    // Non-Node helpers, for the runner and diffing: the raw store + a plain-object snapshot.
    _files: files,
    snapshot() { const o = {}; for (const [k, v] of files) o[k] = v; return o; },
  };
}

// A tiny posix `path` — the pure subset the scripts use. Browser-safe (node:path can't be bare-imported
// in a worker); returns virtual-root-relative results consistent with virtualFs keys.
export const path = {
  sep: "/",
  join(...ps) { return normalize(ps.filter((x) => x != null && x !== "").join("/")); },
  resolve(...ps) { return normalize(ps.join("/")); },
  dirname(p) { const n = normalize(p); const i = n.lastIndexOf("/"); return i < 0 ? "." : n.slice(0, i) || "."; },
  basename(p, ext) { const n = normalize(p); let b = n.slice(n.lastIndexOf("/") + 1); if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length); return b; },
  extname(p) { const b = path.basename(p); const i = b.lastIndexOf("."); return i > 0 ? b.slice(i) : ""; },
};
