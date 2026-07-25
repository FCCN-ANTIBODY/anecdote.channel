// composer/bottle-book.mjs — THE DEVICE'S OWN BOOK OF BOTTLES: the picker's data source, and the answer
// to "anything you create needs to be remembered somewhere" that does NOT become a registry. A public
// index of made-up names would break the name-is-a-key property (the network put nothing at either
// address); this book is the OPERATOR'S address book — Elevated memory, held on this device, synced
// nowhere by default, read by tools (the journal's pile picker, antidote's shelf) over the probe like
// any other Elevated capability.
//
// EXPLICIT SAVE, on purpose: entries enter only by a deliberate act — provisioning a bottle (antidote
// records what it made) or a one-tap "remember this pile on this device" in the room. Never ambient
// visit-tracking: a browsing history is creepy; a bookmarks shelf is consented. And FORGET mirrors save:
// removing an entry is the mild rung of deletion (the book stops knowing the name); the strong rung —
// wiping the name-origin's storages so it might not be a data-pile anymore — is the room's own teardown
// gesture, out of scope here. Both must be COMPLETE for their scope: this module's forget leaves no
// residue in the book's storage.
//
// An entry remembers what a picker needs to sift without connecting: the host (the address), the SIGNED
// kind if the bottle's inception attested one (trustable), a free label, and — cached, clearly a
// self-report — the last descriptor snapshot seen. Pure model over an injected storage (localStorage-
// shaped), the floor-vault pattern; probe ops ride on top via bookOps.

export const BOOK_KEY = "anecdote.bottle-book";
export const ENTRY = "anecdote.bottle-entry/v1";

// A bottle host: <label>.<storage> — one label deep on each side (the bottle-uri grammar's anchor).
const HOST = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/;

export function isEntry(e) {
  return !!e && e.schema === ENTRY && typeof e.host === "string" && HOST.test(e.host)
    && typeof e.saved_at === "string" && e.saved_at.length > 0;
}

export function readBook(storage) {
  try {
    const raw = storage.getItem(BOOK_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(isEntry) : [];
  } catch { return []; }
}

function writeBook(storage, entries) {
  try { storage.setItem(BOOK_KEY, JSON.stringify(entries)); return true; }
  catch { return false; } // quota/private mode: the session still works, persistence doesn't
}

// The deliberate act: remember a bottle. Merge by host (re-saving refreshes label/kind/descriptor —
// the newest sighting wins; saved_at keeps the FIRST save, seen_at the latest). `now` injected for
// deterministic tests. Returns the updated book.
export function saveBottle(storage, { host, kind = null, label = "", descriptor = null } = {}, { now } = {}) {
  if (!host || !HOST.test(host)) throw new Error("bottle-book: not a bottle host: " + host);
  const at = now || new Date().toISOString();
  const book = readBook(storage);
  const prior = book.find((e) => e.host === host);
  const entry = {
    schema: ENTRY, host,
    kind: kind || (prior && prior.kind) || null,        // the SIGNED kind, when the caller verified one
    label: label || (prior && prior.label) || "",
    descriptor: descriptor || (prior && prior.descriptor) || null,  // last SELF-REPORT seen (cache, not truth)
    saved_at: (prior && prior.saved_at) || at,
    seen_at: at,
  };
  const next = [...book.filter((e) => e.host !== host), entry].sort((a, b) => a.host.localeCompare(b.host));
  writeBook(storage, next);
  return next;
}

// The mild rung of deletion: the book stops knowing the name, with no residue in this storage.
export function forgetBottle(storage, host) {
  const next = readBook(storage).filter((e) => e.host !== host);
  if (next.length) writeBook(storage, next);
  else { try { storage.removeItem(BOOK_KEY); } catch { /* already gone */ } }  // an empty book leaves NO key behind
  return next;
}

// Sift the book. `kind` filters on the signed macro kind; `q` is a free substring over host, label, and
// the cached descriptor's own text — the emergent-subtype sift: content is the taxonomy.
export function siftBook(storage, { kind = null, q = null } = {}) {
  let list = readBook(storage);
  if (kind) list = list.filter((e) => e.kind === kind);
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter((e) =>
      e.host.includes(needle) || (e.label || "").toLowerCase().includes(needle)
      || (e.descriptor ? JSON.stringify(e.descriptor).toLowerCase().includes(needle) : false));
  }
  return list;
}

// The probe surface: how a chamber-side tool (the journal's picker) reads the book. Reads are Rung 0;
// saving and forgetting PERSIST, so they are Rung-1 catalog ops — a picker can list freely, but changing
// the operator's memory takes the operator's confirmation.
export function bookOps({ storage } = {}) {
  if (!storage) throw new Error("bottle-book: bookOps needs the Elevated storage");
  return {
    "bottles.list": async (input, api) => { api.emit({ bottles: siftBook(storage, input || {}) }); },
    "bottles.save": async (input, api) => { api.emit({ bottles: saveBottle(storage, input || {}) }); },
    "bottles.forget": async (input, api) => { api.emit({ bottles: forgetBottle(storage, input && input.host) }); },
  };
}
