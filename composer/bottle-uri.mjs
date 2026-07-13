// composer/bottle-uri.mjs — canonical addressing for BOTTLES (isolated sub-sub-domain origins) and the
// storage ADAPTER inside one. Replaces the made-up `anecdote://data/<name>` path scheme
// (viewer/anecdote-url.mjs) with a clear, provisioning-honest URL that names no invented middle segment.
//
//   Grammar:  <label> . <storage> . <apex>            + optional storage facet:  /storage/.<adapter>
//             └ sub-sub ┘ └ subdmn ┘                     e.g. /storage/.git, /storage/.opfs
//             invented    provisioned
//             (wildcard)  (fixed)
//
// The WILDCARD is on the SUB-SUB-DOMAIN: <storage> (the subdomain — "tell" for data-piles, "bottles" for
// arbitrary cubbies) is provisioned once (a real Cloudflare wildcard record + cert); <label> is the user's
// to invent, and every distinct <label> is its own isolated origin. A caller can't conjure a storage domain
// — only a cubby inside one that was provisioned.
//
// A floor recognizes it has been loaded AS a storage adapter PURELY BY ITS PATH — `/storage/.<adapter>` — a
// constant, unmodifiable load condition. No path → no adapter API (the floor serves only the basics). The
// floor never ENUMERATES its adapters (that would solicit "which apps do you have" — a leak); it only answers
// "give me THIS one," so the caller must already know the path. `storage` is the capability tag (one of a
// plural, open set — the door stays open for other tags); `.<adapter>` names the specific adapter.
//
// Pure: nothing here fetches — it only builds / parses / recognizes the address a caller iframes.

export const APEX = "anecdote.channel";
export const STORAGE = "storage"; // the capability tag; the door stays open for other tags later
export const BOTTLES = "bottles"; // the provisioned subdomain that arbitrary cubbies (and engines) live under
const SLUG = /^[a-z0-9][a-z0-9-]*$/; // DNS-label + adapter-name charset
const DNS_MAX = 63;

export function isSlug(s, max = DNS_MAX) { return typeof s === "string" && s.length > 0 && s.length <= max && SLUG.test(s); }

// THE routing primitive: recognize a storage-adapter request from a path alone. `/storage/.<adapter>` →
// { capability, adapter }, anything else → null. The floor calls this on location.pathname to learn it was
// loaded as an adapter (and which one); bottleUrl builds the matching path. No path → null → no adapter API.
export function storageRequest(pathname) {
  const segs = String(pathname == null ? "" : pathname).split("/").filter(Boolean);
  if (segs.length !== 2 || segs[0] !== STORAGE || !segs[1].startsWith(".")) return null;
  const adapter = segs[1].slice(1);
  return isSlug(adapter) ? { capability: STORAGE, adapter } : null;
}

// Build the bottle address. adapter omitted → the bottle root (its floor / the constant page). Throws on any
// illegal part, so a bad label/storage/adapter can never become a URL that resolves somewhere unexpected.
export function bottleUrl({ label, storage, apex = APEX, adapter = null } = {}) {
  if (!isSlug(label)) throw new Error("bottle-uri: label (sub-sub-domain) must be a DNS-legal slug");
  if (!isSlug(storage)) throw new Error("bottle-uri: storage (subdomain) must be a slug");
  if (adapter !== null && !isSlug(adapter)) throw new Error("bottle-uri: adapter must be a slug");
  return `https://${label}.${storage}.${apex}${adapter ? "/" + STORAGE + "/." + adapter : "/"}`;
}

// The canonical ENGINE bottle for a storage adapter. Canonical names, NO registry: a `/storage/.<adapter>`
// facet names the engine, and that engine is its OWN provisioned origin at <adapter>.bottles.<apex> — the
// engine name IS the sub-sub-domain label. openEngine's consumer iframes this to run the install handshake;
// the tell floor mirrors it (floor.mjs engineBottleUrl) so both sides resolve an adapter to one address.
// Returns null (never throws) for a non-slug name, so a bad facet resolves to no engine rather than a URL
// that lands somewhere unexpected.
export function engineBottleUrl(adapter, { apex = APEX } = {}) {
  return isSlug(adapter) ? bottleUrl({ label: adapter, storage: BOTTLES, apex }) : null;
}

// Parse a bottle address into { label, storage, apex, adapter } — or null if it is not a bottle address
// (wrong protocol, wrong apex, wrong depth, or an illegal part). Exactly ONE invented label deep under one
// provisioned storage name; deeper hostnames are not bottles (the wildcard covers a single label). The
// adapter is read from the /storage/.<adapter> facet; any other path is the bottle root (adapter null).
export function parseBottleUrl(url, { apex = APEX } = {}) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "https:") return null;
  if (u.hostname !== apex && !u.hostname.endsWith("." + apex)) return null;
  const head = u.hostname === apex ? "" : u.hostname.slice(0, -(apex.length + 1)); // "<label>.<storage>"
  const parts = head ? head.split(".") : [];
  if (parts.length !== 2) return null; // one label deep under one storage name — nothing shallower/deeper is a bottle
  const [label, storage] = parts;
  if (!isSlug(label) || !isSlug(storage)) return null;
  const facet = storageRequest(u.pathname); // /storage/.<adapter> or null
  return { label, storage, apex, adapter: facet ? facet.adapter : null };
}
