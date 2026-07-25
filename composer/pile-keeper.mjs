// composer/pile-keeper.mjs — THE KEEPER (docs/decisions.md D8): the device's custody surface for pile
// identities. The trove-side keyring holds each pile's age identity (with the feed address and the
// Tell's signer line it was adopted with); the ops vend the CAPABILITY — pull, verify, decrypt, hand
// back plaintext frames for display — and NEVER the secret. The identity does not cross the port; the
// asking room holds no credential of any kind.
//
// ORIGIN-BOUND: the serving page binds the session to the embedding parent's browser-attested origin
// at the hello, and `pileForOrigin` derives the ONE pile that origin may ask about — the name-is-a-key
// property as the authorization anchor. CONSENT rides the standard ladder (composer/authorize):
// `pile.read` is Rung 1, covered by the keeper page's own in-origin allow (a session grant scoped
// {piles:[<name>]}) — a click the room cannot paint. EVERY VEND IS CHRONICLED: a hash-chained local
// log of {when, op, pile, origin, grant} — freshness-not-secrecy applied to key use; an act that
// skipped the ceremony isn't in the log.
//
// Pure like the house wants: storage/fetch/now injected; the crypto is the mirrored consumer core
// (composer/feed-open.mjs ← data-pile bin/, the source of truth).

import { verifyFeed, openFeed } from "./feed-open.mjs";
import { recipientOf } from "./age-mint.mjs";
import { verify as sshVerify, rawFromPublic } from "./ssh-sig.mjs";
import { defaultHash } from "./anecdote.mjs";
import { canonicalize } from "./sign.mjs";

const entryHash = (entry) => defaultHash(canonicalize(entry));   // the house join-key recipe, applied to the log

export const KEYRING_KEY = "anecdote.pile-keyring";
export const CHRONICLE_KEY = "anecdote.keeper-chronicle";
export const READ_BEHAVIOR = "pile-reader";

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

// The one pile an asking origin may speak for: https://<name>.tell.anecdote.channel → <name>.
// Anything else — another storage domain, a deeper label, a non-bottle origin — maps to NO pile.
export function pileForOrigin(origin, { base = "tell.anecdote.channel" } = {}) {
  const m = /^https:\/\/([^/]+)$/.exec(String(origin || ""));
  if (!m) return null;
  const host = m[1];
  if (!host.endsWith("." + base)) return null;
  const label = host.slice(0, -(base.length + 1));
  return !label.includes(".") && label.length <= 63 && SLUG.test(label) ? label : null;
}

// ---- the keyring: what this device holds, adopted deliberately --------------------------------

export function readKeyring(storage) {
  try {
    const raw = storage.getItem(KEYRING_KEY);
    const book = raw ? JSON.parse(raw) : {};
    return book && typeof book === "object" && !Array.isArray(book) ? book : {};
  } catch { return {}; }
}

// Adopt a pile's identity into the trove — provisioning records what it minted; a transfer records
// what arrived by the operator's own gesture. The record carries everything a read needs later: the
// identity (never leaves this origin), the feed address the keeper pulls from, the Tell signer line.
export function adoptPile(storage, { pile, identity, feed, signer = null } = {}, { now } = {}) {
  if (!pile || !SLUG.test(pile)) throw new Error("keeper: not a pile slug: " + pile);
  if (!identity || !identity.startsWith("AGE-SECRET-KEY-")) throw new Error("keeper: not an age identity");
  if (!feed || !/^https:\/\//.test(feed)) throw new Error("keeper: a pile record needs its https feed address");
  const book = readKeyring(storage);
  book[pile] = { identity, feed, signer, adopted_at: now || new Date().toISOString() };
  storage.setItem(KEYRING_KEY, JSON.stringify(book));
  return { pile, feed, signer, recipientPromise: null };
}

// The mild rung: the trove stops holding the identity, residue-free (the strong rung — wiping a
// room — is the floor's own teardown; forgetting HERE is what makes a pile unreadable on this device).
export function forgetPile(storage, pile) {
  const book = readKeyring(storage);
  delete book[pile];
  if (Object.keys(book).length) storage.setItem(KEYRING_KEY, JSON.stringify(book));
  else { try { storage.removeItem(KEYRING_KEY); } catch { /* already gone */ } }
}

// ---- the chronicle: every use of the identity, hash-chained, local ----------------------------

export async function appendChronicle(storage, { op, pile, origin, grantId = null }, { now } = {}) {
  let log = [];
  try { log = JSON.parse(storage.getItem(CHRONICLE_KEY) || "[]"); } catch { log = []; }
  const prev = log.length ? await entryHash(log[log.length - 1]) : null;
  const entry = { seq: log.length, prev, ts: now || new Date().toISOString(), op, pile, origin, grantId };
  log.push(entry);
  storage.setItem(CHRONICLE_KEY, JSON.stringify(log));
  return entry;
}

export function readChronicle(storage) {
  try { return JSON.parse(storage.getItem(CHRONICLE_KEY) || "[]"); } catch { return []; }
}

// Verify the chain: each entry's `prev` is the hash of the one before — an audit a tamperer can't
// quietly edit the middle of.
export async function verifyChronicle(log) {
  for (let i = 0; i < (log || []).length; i++) {
    const want = i === 0 ? null : await entryHash(log[i - 1]);
    if (log[i].prev !== want || log[i].seq !== i) return { ok: false, at: i };
  }
  return { ok: true, entries: (log || []).length };
}

// ---- the ops: the capability, vended -----------------------------------------------------------

// origin: the browser-attested embedding origin, bound at the hello by the serving page.
// storage: the keeper origin's own (trove-side). fetchImpl/now injected for tests.
export function keeperOps({ origin, storage, fetch: fetchImpl, now } = {}) {
  if (!storage) throw new Error("keeper: ops need the trove storage");
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  const bound = pileForOrigin(origin);

  const recordOrRefuse = () => {
    if (!bound) throw new Error("keeper: the asking origin (" + origin + ") speaks for no pile");
    const rec = readKeyring(storage)[bound];
    if (!rec) throw new Error("keeper: no identity held for '" + bound + "' on this device — adopt it here, or carry it over from the device that holds it");
    return rec;
  };

  return {
    // Rung 0 — the public half only: enough for a room to show "this pile can receive".
    "pile.recipient": async (_input, api) => {
      const rec = recordOrRefuse();
      api.emit({ pile: bound, recipient: await recipientOf(rec.identity) });
    },

    // Rung 1 — THE READ: keeper pulls the sealed feed from the address ITS OWN record names (the room
    // never shapes the request), verifies the signed chain, decrypts trove-side, and hands back
    // plaintext frames for display. The identity never crosses; the grant that covered it is
    // chronicled with the act.
    "pile.read": async (_input, api, meta = {}) => {
      const rec = recordOrRefuse();
      const base = rec.feed.endsWith("/") ? rec.feed : rec.feed + "/";
      const get = async (name, kind) => {
        const res = await doFetch(base + name);
        if (!res.ok) throw new Error("keeper: feed fetch failed: " + name + " (" + res.status + ")");
        return kind === "json" ? res.json() : new Uint8Array(await res.arrayBuffer());
      };
      const manifest = await get("manifest.json", "json");
      const blocks = {};
      for (const e of manifest.entries || []) blocks[e.block] = await get(e.block);
      const verifySignature = rec.signer
        ? ({ message, armored, namespace }) => sshVerify(message, armored, { namespace, rawPub: rawFromPublic(rec.signer) })
        : null;
      const v = await verifyFeed({ manifest, blocks, verifySignature, allowUnsigned: !rec.signer });
      if (!v.ok) throw new Error("keeper: the feed does not verify: " + v.reason);
      const seedAge = await get("seed.age");
      const { records } = await openFeed({ manifest, blocks, seedAge, identity: rec.identity });
      await appendChronicle(storage, { op: "pile.read", pile: bound, origin, grantId: meta.grantId || null }, { now });
      api.emit({
        pile: bound,
        verified: { entries: v.entries, signed: rec.signer ? true : "allowUnsigned (no signer adopted)" },
        records: records.map((r) => ({ seq: r.seq, text: r.text })),   // display frames — never the key, never the seed
      });
    },

    // Rung 1, persists — adoption FROM the bound room's flow (e.g. a provision handing custody home).
    // Only for the origin's own pile: a room cannot plant identities for other names.
    "pile.adopt": async (input, api) => {
      if (!bound) throw new Error("keeper: the asking origin (" + origin + ") speaks for no pile");
      if (!input || input.pile !== bound) throw new Error("keeper: '" + (input && input.pile) + "' is not this origin's pile ('" + bound + "')");
      adoptPile(storage, input, { now });
      await appendChronicle(storage, { op: "pile.adopt", pile: bound, origin }, { now });
      api.emit({ adopted: bound });
    },
  };
}
