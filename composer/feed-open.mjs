// composer/feed-open.mjs — VENDORED verbatim from data-pile/bin/feed-open.mjs (the source of truth; mirror discipline D5, drift-guarded by composer/pile-keeper.test.mjs).
// data-pile/bin/feed-open.mjs — OPEN A DELIVERED FEED IN THE ROOM: the pile's consumer core, ported to
// WebCrypto so the owner's device — the browser vault, no `age`, no `openssl`, no `jq` — can do what
// bin/verify + bin/decrypt do. BYTE-MIRRORS the bash semantics (bin/lib.sh is the source of truth; keep
// them in sync by hand, the constellation's mirror discipline):
//
//   entries digest:  sha256( jq -cS '.entries' )            — canonical sorted-keys compact JSON
//   head signature:  ssh-keygen -Y sign over the digest, namespace data-pile (drop: data-pile-drop),
//                    stored base64(armored) in head.sig
//   chain:           seq == index; prev_hash links this_hash; this_hash = sha256 of the block file
//   ratchet:         K_{n+1} = sha256("ratchet:" || K_n)     (hex-string keys, forward-only)
//   commitment:      ratchet_pub = sha256("pub:" || K_n)
//   block cipher:    aes-256-ctr, key = K_n (hex), iv = sha256("iv:" || K_n)[:32 hex]
//   channel 2:       an entry naming `key` carries its own age-wrapped per-block key — no seed involved
//
// Verify-from-anyone; trust decides ACTION: verifyFeed needs no secret and refuses loudly with a reason
// (never a silent pass). The SIGNATURE verifier is an injected seam — `verifySignature({ message,
// armored, namespace }) -> { ok, by?, reason? }` — so this module stays dependency-free while the room
// injects a real one (anecdote.channel composer/ssh-sig.mjs verify, the ssh-keygen-interoperable
// verifier) and a constrained box degrades exactly like DP_ALLOW_UNSIGNED. openFeed then unwraps the
// seed with the held identity (bin/age-open.mjs — WebCrypto, node + browser) and walks the ratchet,
// refusing any key that misses its published commitment. Node + browser; no deps.

import { decrypt as ageDecrypt } from "./age-open.mjs";

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtleOf = (opts = {}) => opts.subtle || (globalThis.crypto && globalThis.crypto.subtle)
  || (() => { throw new Error("feed-open: no WebCrypto"); })();

const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s) => Uint8Array.from(s.match(/../g).map((h) => parseInt(h, 16)));
async function sha256hex(subtle, data) {
  const bytes = typeof data === "string" ? enc.encode(data) : data;
  return hex(await subtle.digest("SHA-256", bytes));
}

// jq -cS: keys sorted recursively, compact output. The manifest's values are ASCII (hashes, names,
// timestamps), so JSON.stringify's escaping agrees with jq's.
export function canonicalEntries(entries) {
  const sort = (v) => Array.isArray(v) ? v.map(sort)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])]))
    : v;
  return JSON.stringify(sort(entries));
}

const RATCHET = { next: "ratchet:", pub: "pub:", iv: "iv:" };
export const ratchetNext = (subtle, k) => sha256hex(subtle, RATCHET.next + k);
export const ratchetPub = (subtle, k) => sha256hex(subtle, RATCHET.pub + k);

async function blockDecrypt(subtle, kHex, cipherBytes) {
  const iv = unhex((await sha256hex(subtle, RATCHET.iv + kHex)).slice(0, 32));
  const key = await subtle.importKey("raw", unhex(kHex), { name: "AES-CTR" }, false, ["decrypt"]);
  // openssl aes-256-ctr increments the whole 16-byte block; counter length 128 matches it.
  return new Uint8Array(await subtle.decrypt({ name: "AES-CTR", counter: iv, length: 128 }, key, cipherBytes));
}

const b64decode = (s) => typeof Buffer !== "undefined" ? new Uint8Array(Buffer.from(s, "base64"))
  : Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// ---- bin/verify, in the room ---------------------------------------------------------------------
// manifest: the parsed manifest.json. blocks: { name -> Uint8Array } (every file the entries name).
// verifySignature: the injected seam (required unless allowUnsigned — fail closed, like the bash).
// Returns { ok:true, digest, entries, signed } or { ok:false, reason } — never a silent pass.
export async function verifyFeed({ manifest, blocks, source = "tell", verifySignature = null, allowUnsigned = false } = {}, opts = {}) {
  const subtle = subtleOf(opts);
  if (!manifest || !Array.isArray(manifest.entries) || !manifest.head) return { ok: false, reason: "not a feed manifest" };

  const digest = await sha256hex(subtle, canonicalEntries(manifest.entries));
  if (digest !== manifest.head.digest) return { ok: false, reason: `manifest digest mismatch (head=${manifest.head.digest} computed=${digest})` };

  let signed = null;
  if (allowUnsigned) {
    signed = { skipped: true }; // the DP_ALLOW_UNSIGNED posture: explicit, never the default
  } else {
    if (typeof verifySignature !== "function") return { ok: false, reason: "no signature verifier injected (pass allowUnsigned to bypass, like DP_ALLOW_UNSIGNED=1)" };
    if (!manifest.head.sig) return { ok: false, reason: "manifest head carries no signature" };
    const namespace = source === "drop" ? "data-pile-drop" : "data-pile";
    const armored = dec.decode(b64decode(manifest.head.sig));
    const v = await verifySignature({ message: digest, armored, namespace });
    if (!v || !v.ok) return { ok: false, reason: "signature does NOT verify: " + ((v && v.reason) || "unknown") };
    signed = { by: v.by || null };
  }

  let prev = "null";
  for (let i = 0; i < manifest.entries.length; i++) {
    const e = manifest.entries[i];
    if (e.seq !== i) return { ok: false, reason: `entry ${i} out of order (seq=${e.seq})` };
    const ph = e.prev_hash == null ? "null" : String(e.prev_hash);
    if (ph !== prev) return { ok: false, reason: `broken chain at seq ${i} (prev_hash=${ph} expected=${prev})` };
    const bytes = blocks && blocks[e.block];
    if (!bytes) return { ok: false, reason: `missing block file ${e.block} at seq ${i}` };
    const got = "sha256:" + (await sha256hex(subtle, bytes));
    if (got !== e.this_hash) return { ok: false, reason: `block ${e.block} tampered at seq ${i} (${got} != ${e.this_hash})` };
    if (!/^sha256:[0-9a-f]{64}$/.test(e.ratchet_pub || "")) return { ok: false, reason: `bad ratchet_pub at seq ${i}` };
    if (source === "drop" && !e.key) return { ok: false, reason: `drop entry ${i} carries no key file (channel 2 requires one)` };
    prev = e.this_hash;
  }
  return { ok: true, digest, entries: manifest.entries.length, signed };
}

// ---- bin/decrypt, in the room --------------------------------------------------------------------
// Owner-only: needs the held identity. keyFiles: { name -> Uint8Array } for channel-2 entries naming a
// `key`; seedAge: the age-wrapped genesis seed (channel 1). The unwrapped key text is trimmed of
// trailing newlines exactly as bash command substitution would. Every derived/unwrapped key must match
// the entry's published commitment or the whole open refuses. Returns { records: [{ seq, block, bytes,
// text }] } or throws with the bash die's sentence.
export async function openFeed({ manifest, blocks, seedAge = null, keyFiles = {}, identity, seqs = null } = {}, opts = {}) {
  const subtle = subtleOf(opts);
  if (!identity) throw new Error("feed-open: no identity (the owner's age secret key)");
  const trim = (bytes) => dec.decode(bytes).replace(/\n+$/, "");

  let seedKey = null; // unwrapped lazily — a pure drop feed has no seed.age at all
  const seed = async () => {
    if (seedKey === null) {
      if (!seedAge) throw new Error("feed-open: no seed.age (genesis seed)");
      seedKey = trim(await ageDecrypt(identity, seedAge));
      if (!seedKey) throw new Error("feed-open: could not unwrap seed (wrong identity?)");
    }
    return seedKey;
  };

  const want = seqs === null ? manifest.entries.map((e) => e.seq) : seqs;
  const records = [];
  for (const s of want) {
    const e = manifest.entries[s];
    if (!e) throw new Error(`feed-open: no entry at seq ${s}`);
    let k;
    if (e.key) {
      const kf = keyFiles[e.key];
      if (!kf) throw new Error(`feed-open: missing key file ${e.key} at seq ${s}`);
      k = trim(await ageDecrypt(identity, kf));
    } else {
      k = await seed();
      for (let i = 0; i < s; i++) k = await ratchetNext(subtle, k);
    }
    const commit = "sha256:" + (await ratchetPub(subtle, k));
    if (commit !== e.ratchet_pub) throw new Error(`feed-open: key commitment mismatch at seq ${s}`);
    const bytes = await blockDecrypt(subtle, k, blocks[e.block]);
    records.push({ seq: s, block: e.block, bytes, text: dec.decode(bytes) });
  }
  return { records };
}
