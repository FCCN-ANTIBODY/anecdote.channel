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

import { pktLine, FLUSH, parseAdvertisement } from "./send-pack.mjs";
import { readPack } from "./unpack.mjs";
import { repo as newRepo } from "./repo.mjs";

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
