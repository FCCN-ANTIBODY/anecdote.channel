// git-enough/send-pack.mjs — smart-HTTP push to a downstream (Milestone: Origin, phase 3 — the headline).
//
// The inversion realized: the un-addressable offline origin PUSHES its already-built, signed history to an
// addressable GitHub repo, which fast-forwards to what we published (docs/git-enough.md). No PRs, no
// supplication. This is `git push` over smart-HTTP, hand-rolled:
//
//   1. discover — GET <repo>.git/info/refs?service=git-receive-pack  → the ref advertisement (old oids)
//   2. send     — POST <repo>.git/git-receive-pack  with  (ref-update commands ++ flush ++ packfile)
//   3. report   — parse the server's report-status (unpack ok / ok <ref> / ng <ref> <why>)
//
// Auth is HTTP Basic with the token as the password (the homebrew fine-grained PAT: Contents R/W). The
// wire framing is pkt-line; the pack is phase 2. The transport (`fetch`) is injectable, so the whole path
// is tested offline by pointing it at a real `git receive-pack --stateless-rpc` — the exact program
// GitHub's backend runs — and only the literal network call is exercised live.

import { packRepo } from "./pack.mjs";

const enc = new TextEncoder();
const dec = new TextDecoder();
const ZERO = "0".repeat(40);

function concat(parts) {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ---- pkt-line framing ----------------------------------------------------------------------------
// A pkt-line is a 4-hex-digit length (counting the 4 length bytes) + payload. "0000" is a flush-pkt.
export function pktLine(payload) {
  const bytes = typeof payload === "string" ? enc.encode(payload) : payload;
  const len = bytes.length + 4;
  if (len > 65524) throw new Error("pkt-line too long");
  return concat([enc.encode(len.toString(16).padStart(4, "0")), bytes]);
}
export const FLUSH = enc.encode("0000");

// Split a byte stream into pkt-lines. Returns [{ payload }] and { flush:true } markers; 0001/0002
// delimiter/response-end pkts are skipped.
export function parsePktLines(bytes) {
  const out = []; let i = 0;
  while (i + 4 <= bytes.length) {
    const len = parseInt(dec.decode(bytes.subarray(i, i + 4)), 16);
    if (Number.isNaN(len)) break;
    if (len === 0) { out.push({ flush: true }); i += 4; continue; }
    if (len < 4) { i += 4; continue; }               // delim / response-end — no payload
    out.push({ payload: bytes.subarray(i + 4, i + len) });
    i += len;
  }
  return out;
}

// ---- advertisement (server → us) -----------------------------------------------------------------
// Parse info/refs (or `git receive-pack --advertise-refs`). Handles the optional "# service=" http
// preamble and the empty-repo "capabilities^{}" sentinel. → { refs: {name: oid}, capabilities: [] }.
export function parseAdvertisement(bytes) {
  const refs = {}; let capabilities = [];
  for (const l of parsePktLines(bytes)) {
    if (l.flush) continue;
    let s = dec.decode(l.payload).replace(/\n$/, "");
    if (s.startsWith("# service=")) continue;
    const nul = s.indexOf("\0");
    if (nul !== -1) { capabilities = s.slice(nul + 1).split(" ").filter(Boolean); s = s.slice(0, nul); }
    const sp = s.indexOf(" ");
    if (sp === -1) continue;
    const oid = s.slice(0, sp), name = s.slice(sp + 1);
    if (name !== "capabilities^{}") refs[name] = oid;   // sentinel = empty repo, no refs
  }
  return { refs, capabilities };
}

// ---- the push request (us → server) --------------------------------------------------------------
// updates: [{ old, new, ref }] (old = ZERO to create). The first command carries the capability list.
export function buildReceivePackRequest({ updates, pack, capabilities = ["report-status"] }) {
  if (!updates || !updates.length) throw new Error("send-pack: no ref updates");
  const parts = [];
  updates.forEach((u, i) => {
    let line = `${u.old} ${u.new} ${u.ref}`;
    if (i === 0) line += "\0" + capabilities.join(" ");
    parts.push(pktLine(line + "\n"));
  });
  parts.push(FLUSH);
  if (pack) parts.push(pack);                          // a delete-only push carries no pack
  return concat(parts);
}

// ---- the report (server → us) --------------------------------------------------------------------
export function parseReportStatus(bytes) {
  let unpack = null; const refs = {};
  for (const l of parsePktLines(bytes)) {
    if (l.flush) continue;
    const s = dec.decode(l.payload).replace(/\n$/, "");
    if (s.startsWith("unpack ")) unpack = s.slice(7);
    else if (s.startsWith("ok ")) refs[s.slice(3)] = { ok: true };
    else if (s.startsWith("ng ")) {
      const rest = s.slice(3), sp = rest.indexOf(" ");
      refs[rest.slice(0, sp)] = { ok: false, error: rest.slice(sp + 1) };
    }
  }
  const ok = unpack === "ok" && Object.values(refs).every((r) => r.ok) && Object.keys(refs).length > 0;
  return { unpack, refs, ok };
}

// ---- HTTP transport (injectable fetch; live path uses global fetch through the proxy) --------------
function b64(s) {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "utf8").toString("base64");
  return btoa(unescape(encodeURIComponent(s)));
}
function authHeaders(credential) {
  if (!credential) return {};
  const user = credential.username || "x-access-token";
  const token = credential.token || credential;       // allow a bare token string
  return { authorization: "Basic " + b64(`${user}:${token}`) };
}
function gitUrl(url) { return url.replace(/\/$/, "").replace(/\.git$/, "") + ".git"; }

export async function discover({ url, credential, fetch = globalThis.fetch } = {}) {
  const res = await fetch(`${gitUrl(url)}/info/refs?service=git-receive-pack`, { headers: authHeaders(credential) });
  if (!res.ok) throw new Error(`info/refs HTTP ${res.status}`);
  return parseAdvertisement(new Uint8Array(await res.arrayBuffer()));
}

export async function sendPack({ url, credential, updates, pack, capabilities, fetch = globalThis.fetch } = {}) {
  const body = buildReceivePackRequest({ updates, pack, capabilities });
  const res = await fetch(`${gitUrl(url)}/git-receive-pack`, {
    method: "POST",
    headers: { ...authHeaders(credential), "content-type": "application/x-git-receive-pack-request",
               accept: "application/x-git-receive-pack-result" },
    body,
  });
  if (!res.ok) throw new Error(`git-receive-pack HTTP ${res.status}`);
  return parseReportStatus(new Uint8Array(await res.arrayBuffer()));
}

// Publish a repo's ref to a downstream: discover the current oid, pack, push. Uses the advertised old
// oid so the update is accepted (create, fast-forward, or — if the downstream allows force — a King's Leap
// replace). Returns { advertised, report, upToDate? }.
export async function publish(repo, { url, credential, ref = "refs/heads/main", fetch = globalThis.fetch, capabilities } = {}) {
  const newOid = repo.readRef(ref);
  if (!newOid) throw new Error(`publish: nothing at ${ref} to push`);
  const advertised = await discover({ url, credential, fetch });
  const oldOid = advertised.refs[ref] || ZERO;
  if (oldOid === newOid) return { advertised, report: { unpack: "ok", refs: {}, ok: true }, upToDate: true };
  const report = await sendPack({ url, credential, fetch, capabilities,
    updates: [{ old: oldOid, new: newOid, ref }], pack: await packRepo(repo) });
  return { advertised, report };
}
