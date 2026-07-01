// git-enough/objects.mjs — the git object layer, in vendorless browser-native JS (Milestone: Origin).
//
// The offline origin needs to speak git UNDERNEATH so a public GitHub repo can be a CLIENT of it — the
// origin builds real git history locally and later PUSHES it out to the addressable downstream (see
// docs/git-enough.md). "Compatible with git underneath, not a boy-scout about feature-completeness": this
// file is phase 0 — the content-addressed object store (blob / tree / commit) with byte-identical object
// ids, plus the on-disk loose encoding. Everything is native:
//   - object ids are SHA-1 over "<type> <len>\0<content>" → crypto.subtle.digest('SHA-1')
//   - loose objects are zlib-deflated → CompressionStream('deflate') (RFC 1950, exactly git's format)
// No vendored zlib, no vendored sha. Runs identically in the browser and in Node; the tests cross-check
// every id and byte against a real `git`.

const enc = new TextEncoder();

export async function sha1hex(bytes) {
  const d = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function concatBytes(parts) {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function hexToBytes(hex) {
  const u = new Uint8Array(hex.length / 2);
  for (let i = 0; i < u.length; i++) u[i] = parseInt(hex.substr(i * 2, 2), 16);
  return u;
}
function asBytes(x) { return typeof x === "string" ? enc.encode(x) : x; }

// The framed object git actually hashes: "<type> <len>\0" ++ content. `len` is the byte length.
export function frame(type, content) {
  content = asBytes(content);
  return concatBytes([enc.encode(`${type} ${content.length}\0`), content]);
}

// The object id (SHA-1 of the framed object) — identical to `git hash-object`.
export async function oid(type, content) { return sha1hex(frame(type, content)); }

export async function blob(content) {
  content = asBytes(content);
  return { type: "blob", content, oid: await oid("blob", content) };
}

// ---- trees ---------------------------------------------------------------------------------------
// A tree entry is "<mode> <name>\0" ++ 20 raw sha bytes. Entries MUST be sorted the way git sorts them:
// by name bytes, but a tree (mode 40000) sorts as if its name ended in "/". Modes: 100644 file,
// 100755 exec, 120000 symlink, 40000 dir, 160000 gitlink.
function treeSortKey(e) { return enc.encode(e.name + (e.mode === "40000" ? "/" : "")); }
function byteLess(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { if (a[i] !== b[i]) return a[i] < b[i]; }
  return a.length < b.length;
}
export function encodeTree(entries) {
  const withKey = entries.map((e) => ({ e, k: treeSortKey(e) }));
  withKey.sort((x, y) => (byteLess(x.k, y.k) ? -1 : byteLess(y.k, x.k) ? 1 : 0));
  return concatBytes(withKey.flatMap(({ e }) => [enc.encode(`${e.mode} ${e.name}\0`), hexToBytes(e.oid)]));
}
export async function tree(entries) {
  const content = encodeTree(entries);
  return { type: "tree", content, oid: await oid("tree", content) };
}

// ---- commits -------------------------------------------------------------------------------------
// "tree <hex>\n" ("parent <hex>\n")* "author <ident>\n" "committer <ident>\n" "\n" <message>.
// An ident is "<name> <<email>> <epoch> <tz>", e.g. "Jane <j@x> 1700000000 +0000".
function ident(who) { return `${who.name} <${who.email}> ${who.epoch} ${who.tz}`; }
export function encodeCommit({ tree, parents = [], author, committer, message }) {
  const lines = [`tree ${tree}`];
  for (const p of parents) lines.push(`parent ${p}`);
  lines.push(`author ${ident(author)}`, `committer ${ident(committer || author)}`, "", message);
  return enc.encode(lines.join("\n"));
}
export async function commit(fields) {
  const content = encodeCommit(fields);
  return { type: "commit", content, oid: await oid("commit", content) };
}

// ---- loose on-disk encoding (zlib) ----------------------------------------------------------------
async function pipe(bytes, Transform) {
  const t = new Transform();
  const w = t.writable.getWriter(); w.write(bytes); w.close();
  const chunks = []; const r = t.readable.getReader();
  for (;;) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
  return concatBytes(chunks);
}
export const deflate = (bytes) => pipe(asBytes(bytes), CompressionStream.bind(null, "deflate"));
export const inflate = (bytes) => pipe(bytes, DecompressionStream.bind(null, "deflate"));

// The exact bytes git stores at .git/objects/xx/yyy… : the framed object, zlib-deflated.
export async function looseBytes(type, content) { return deflate(frame(type, content)); }

// Read a loose object back: inflate, split on the first NUL, parse the "<type> <len>" header.
export async function readLoose(bytes) {
  const framed = await inflate(bytes);
  let i = 0; while (framed[i] !== 0) i++;
  const header = new TextDecoder().decode(framed.subarray(0, i));
  const sp = header.indexOf(" ");
  return { type: header.slice(0, sp), length: Number(header.slice(sp + 1)), content: framed.subarray(i + 1) };
}

// The on-disk path for an oid: objects/<first 2 hex>/<rest>.
export function loosePath(id) { return `objects/${id.slice(0, 2)}/${id.slice(2)}`; }
