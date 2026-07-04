// git-enough/fetch-pack.mjs — the Castle's inbound transport (Milestone: Origin, read-side). The mirror
// of send-pack: this FETCHES over smart-HTTP `git-upload-pack` (downstream → us). It is the one-time
// bootstrap that adopts a GitHub repo's FULL history into our offline origin — after which the relationship
// inverts and we push (send-pack). Not a standing upstream; a single kidnap.
//
//   1. discover — GET <repo>.git/info/refs?service=git-upload-pack  → their refs + tips
//   2. want     — POST <repo>.git/git-upload-pack  with  want <oid> … flush  done
//   3. receive  — strip the NAK/ACK acknowledgements, read the packfile (unpack.mjs), import into a repo()
//
// We request WITHOUT side-band-64k, so the pack follows the acknowledgements raw (no band de-muxing).
// The pack is deltified by the server; unpack.mjs resolves it. Same injectable `fetch` and `inflate`
// seams as the rest, so the whole path is tested offline against a real `git upload-pack --stateless-rpc`.
//
// Below the Castle sits the targeted counterpart named (not built) in docs/atlas-index.md's tier 4 and
// issue #91: fetch ONE already-known object, or walk a path down to its blob one tree level at a time —
// never the sibling blobs, never the ancestor history. `wants` was never restricted to ref tips (a `want`
// is just an oid), so this reuses fetchPack as-is; the new part is wanting a non-tip oid at all, which is
// a server-side opt-in (`uploadpack.allowReachableSHA1InWant` — on by default on github.com; see the test
// harness for the local-git equivalent).

import { pktLine, FLUSH, parseAdvertisement } from "./send-pack.mjs";
import { readPack } from "./unpack.mjs";
import { repo as newRepo } from "./repo.mjs";
import { parseCommit, parseTree, walkTree } from "./read.mjs";

const dec = new TextDecoder();
function concat(parts) {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function b64(s) { return typeof Buffer !== "undefined" ? Buffer.from(s, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(s))); }
function authHeaders(cred) {
  if (!cred) return {};
  return { authorization: "Basic " + b64(`${cred.username || "x-access-token"}:${cred.token || cred}`) };
}
function gitUrl(url) { return url.replace(/\/$/, "").replace(/\.git$/, "") + ".git"; }

// The upload-request: want-list (caps on the first) + flush + done. We ask for ofs-delta (which unpack
// resolves) and deliberately omit side-band-64k so the pack arrives raw after the NAK.
export function buildFetchRequest({ wants, capabilities = ["ofs-delta"] }) {
  if (!wants || !wants.length) throw new Error("fetch-pack: nothing to want");
  const parts = [];
  wants.forEach((w, i) => parts.push(pktLine(`want ${w}${i === 0 ? " " + capabilities.join(" ") : ""}\n`)));
  parts.push(FLUSH);
  parts.push(pktLine("done\n"));
  return concat(parts);
}

// Everything before the raw pack is pkt-line framed acknowledgements (NAK / ACK …). The pack begins at the
// first 4 bytes that are NOT a valid pkt-line length — i.e. "PACK", which parseInt(…,16) → NaN.
export function stripToPack(bytes) {
  let i = 0;
  while (i + 4 <= bytes.length) {
    const len = parseInt(dec.decode(bytes.subarray(i, i + 4)), 16);
    if (Number.isNaN(len)) break;      // reached the raw packfile
    if (len === 0) { i += 4; continue; } // flush
    i += len;                           // skip an ack line
  }
  return bytes.subarray(i);
}

export async function discoverFetch({ url, credential, fetch = globalThis.fetch } = {}) {
  const res = await fetch(`${gitUrl(url)}/info/refs?service=git-upload-pack`, { headers: authHeaders(credential) });
  if (!res.ok) throw new Error(`info/refs HTTP ${res.status}`);
  return parseAdvertisement(new Uint8Array(await res.arrayBuffer()));
}

// Fetch a pack for the given wants and return the parsed objects (Map oid → {type, content}).
export async function fetchPack({ url, credential, wants, capabilities, inflate, fetch = globalThis.fetch } = {}) {
  const res = await fetch(`${gitUrl(url)}/git-upload-pack`, {
    method: "POST",
    headers: { ...authHeaders(credential), "content-type": "application/x-git-upload-pack-request",
               accept: "application/x-git-upload-pack-result" },
    body: buildFetchRequest({ wants, capabilities }),
  });
  if (!res.ok) throw new Error(`git-upload-pack HTTP ${res.status}`);
  const pack = stripToPack(new Uint8Array(await res.arrayBuffer()));
  return readPack(pack, { inflate });
}

// THE CASTLE: clone a downstream's full history into a fresh offline-origin repo(). Discovers the tips,
// wants them all, imports the objects, and sets our refs to theirs (lineage preserved). `inflate` is the
// byte-accurate seam (Node/browser). Returns { repo, refs, head }.
export async function clone({ url, credential, inflate, fetch = globalThis.fetch, ref } = {}) {
  const adv = await discoverFetch({ url, credential, fetch });
  const names = ref ? [ref] : Object.keys(adv.refs);
  const wants = [...new Set(names.map((n) => adv.refs[n]).filter(Boolean))];
  if (!wants.length) throw new Error("clone: the remote advertised no refs to fetch");
  const { objects } = await fetchPack({ url, credential, wants, inflate, fetch });

  const r = newRepo();
  for (const [id, o] of objects) r.objects.set(id, o);          // import their objects as ours
  for (const n of names) if (adv.refs[n]) r.updateRef(n, adv.refs[n]);   // …and their refs/tips
  const head = names.includes("refs/heads/main") ? "refs/heads/main" : (names.find((n) => n.startsWith("refs/heads/")) || names[0]);
  if (head) r.setHead(head);
  return { repo: r, refs: adv.refs, head };
}

// THE TARGETED FETCH: pull exactly the already-known objects named by `oids`, no ref history, no
// siblings — WITH ONE CAVEAT worth being exact about. `want`ing a **blob** or **tree** oid really is
// minimal: neither carries a "parent" pointer, so the pack is just that object plus whatever it directly
// references (a tree's own entries; nothing, for a blob). `want`ing a **commit** oid is NOT minimal on its
// own — with no `have` lines to establish a common base, upload-pack has no way to know we already hold
// its ancestors, so it packs the WHOLE reachable history back to the root. That's the same "later degree"
// docs/atlas-index.md already named ("incremental fetch with `have`s (only what we lack)") — this function
// doesn't build it; callers who only need a commit's root tree should prefer resolving the tree oid via a
// prior tier-2 listing and skip wanting the commit at all (see fetchFileAt's `treeOid` option below).
// Returns the objects Map (oid → { type, content }), same shape fetchPack already returns.
export async function fetchObjects({ url, credential, oids, inflate, fetch = globalThis.fetch } = {}) {
  if (!oids || !oids.length) throw new Error("fetch-pack: nothing to want");
  const { objects } = await fetchPack({ url, credential, wants: [...new Set(oids)], inflate, fetch });
  return objects;
}

// Convenience: fetch one already-known oid. Returns { type, content } or null if the remote didn't
// actually have it (a stale index pointing at a since-rewritten oid).
export async function fetchObject({ url, credential, oid, inflate, fetch = globalThis.fetch } = {}) {
  const objects = await fetchObjects({ url, credential, oids: [oid], inflate, fetch });
  return objects.get(oid) || null;
}

// THE SPARSE PATH WALK: pick up an index and extract a single file out of it, fetching only the tree
// object at each path segment plus the final blob — never a sibling blob, never ancestor commits. Each
// level is its own small round trip: a `want` can only name an oid we already learned from the level
// above, so the walk is inherently sequential (N+1 fetches for an N-segment path from a known tree).
//
// Pass `treeOid` (the root tree, already known from a prior tier-2 listing) to stay fully minimal.
// Passing `commitOid` instead is supported for convenience, but costs the full-ancestry transfer described
// above on that one call — fine for a small/shallow history, worth avoiding once a real Atlas history has
// depth. Returns { path, oid, content, size } for a found file, or null if the path doesn't exist.
export async function fetchFileAt({ url, credential, commitOid, treeOid, path, inflate, fetch = globalThis.fetch } = {}) {
  if (!treeOid) {
    if (!commitOid) throw new Error("fetch-pack: need a commitOid or a treeOid");
    const commit = await fetchObject({ url, credential, oid: commitOid, inflate, fetch });
    if (!commit || commit.type !== "commit") throw new Error(`fetch-pack: ${commitOid} is not a commit`);
    treeOid = parseCommit(commit.content).tree;
  }
  const segments = path.split("/").filter(Boolean);
  if (!segments.length) throw new Error("fetch-pack: empty path");

  for (let i = 0; i < segments.length; i++) {
    const tree = await fetchObject({ url, credential, oid: treeOid, inflate, fetch });
    if (!tree || tree.type !== "tree") throw new Error(`fetch-pack: ${treeOid} is not a tree`);
    const entry = parseTree(tree.content).find((e) => e.name === segments[i]);
    if (!entry) return null;                              // the path doesn't exist at this commit

    if (i < segments.length - 1) {
      if (entry.mode !== "40000") return null;              // a file where a directory segment was expected
      treeOid = entry.oid;
      continue;
    }
    if (entry.mode === "40000") throw new Error(`fetch-pack: ${path} is a directory, not a file`);
    const blob = await fetchObject({ url, credential, oid: entry.oid, inflate, fetch });
    return blob ? { path, oid: entry.oid, content: blob.content, size: blob.content.length } : null;
  }
  return null;
}

// THE LISTING, NO BODIES (docs/atlas-index.md tier 2): recursively fetch just the TREE objects under a
// root tree — never a blob. One round trip per depth level (every subtree oid at a given level is already
// known from the level above, so they batch into a single fetchObjects call), not one per node. Returns an
// objects Map (oid → { type, content }) containing every tree reached; feed it straight to the existing
// `walkTree`/`filesAt` (git-enough/read.mjs) to enumerate paths — they already tolerate absent blobs
// (`size: null`), which is exactly this map's shape.
export async function fetchTree({ url, credential, treeOid, inflate, fetch = globalThis.fetch } = {}) {
  const objects = new Map();
  let frontier = [treeOid];
  while (frontier.length) {
    const unseen = [...new Set(frontier)].filter((oid) => !objects.has(oid));
    if (!unseen.length) break;
    const fetched = await fetchObjects({ url, credential, oids: unseen, inflate, fetch });
    frontier = [];
    for (const oid of unseen) {
      const tree = fetched.get(oid);
      if (!tree || tree.type !== "tree") throw new Error(`fetch-pack: ${oid} is not a tree`);
      objects.set(oid, tree);
      for (const e of parseTree(tree.content)) if (e.mode === "40000") frontier.push(e.oid);
    }
  }
  return objects;
}

// Pick up an index and pull out every file under a path prefix, many at a time: list the tree (no blobs),
// keep only entries whose path starts with `prefix` (an empty prefix keeps everything), then batch-fetch
// exactly those blobs in one request. Returns [{ path, oid, content, size }], newest listing order.
export async function fetchFilesUnder({ url, credential, treeOid, prefix = "", inflate, fetch = globalThis.fetch } = {}) {
  const treeObjects = await fetchTree({ url, credential, treeOid, inflate, fetch });
  const matches = [...walkTree(treeObjects, treeOid)].filter((f) => f.path.startsWith(prefix));
  if (!matches.length) return [];
  const blobs = await fetchObjects({ url, credential, oids: matches.map((f) => f.oid), inflate, fetch });
  return matches.map((f) => {
    const b = blobs.get(f.oid);
    return { path: f.path, oid: f.oid, content: b ? b.content : null, size: b ? b.content.length : f.size };
  });
}
