// composer/bottle-uri.mjs — canonical addressing for BOTTLES (isolated sub-sub-domain origins) and the
// storage ADAPTER inside one. Replaces the made-up `anecdote://data/<name>` path scheme
// (viewer/anecdote-url.mjs) with a clear, provisioning-honest URL that names no invented middle segment.
//
//   Grammar:  <label> . <storage> . <apex>            + optional adapter facet:  /.<adapter>
//             └ sub-sub ┘ └ subdmn ┘                     e.g. /.git, /.opfs
//             invented    provisioned
//             (wildcard)  (fixed)
//
// The WILDCARD is on the SUB-SUB-DOMAIN: <storage> (the subdomain — "tell" for data-piles, "bottles" for
// arbitrary cubbies) is provisioned once (a real Cloudflare wildcard record + cert); <label> is the user's
// to invent, and every distinct <label> is its own isolated origin. A caller can't conjure a storage domain
// — only a cubby inside one that was provisioned. The adapter facet selects WHICH probe you talk to, since a
// bottle can carry several adapters (git did something, OPFS did something) and the host alone doesn't say.
//
// Pure: nothing here fetches — it only builds/parses the address a caller iframes. NOTE: the `/.<adapter>`
// facet form is a proposal (it mirrors the ".git / .opfs" shorthand); it is the one place a caller routes
// on, so it is easy to change in exactly this module if a different convention is chosen.

export const APEX = "anecdote.channel";
const SLUG = /^[a-z0-9][a-z0-9-]*$/; // DNS-label + adapter-name charset
const DNS_MAX = 63;

export function isSlug(s, max = DNS_MAX) { return typeof s === "string" && s.length > 0 && s.length <= max && SLUG.test(s); }

// Build the bottle address. adapter omitted → the bottle root (its floor / the constant page). Throws on any
// illegal part, so a bad label/storage/adapter can never become a URL that resolves somewhere unexpected.
export function bottleUrl({ label, storage, apex = APEX, adapter = null } = {}) {
  if (!isSlug(label)) throw new Error("bottle-uri: label (sub-sub-domain) must be a DNS-legal slug");
  if (!isSlug(storage)) throw new Error("bottle-uri: storage (subdomain) must be a slug");
  if (adapter !== null && !isSlug(adapter)) throw new Error("bottle-uri: adapter must be a slug");
  return `https://${label}.${storage}.${apex}${adapter ? "/." + adapter : "/"}`;
}

// Parse a bottle address into { label, storage, apex, adapter } — or null if it is not a bottle address
// (wrong protocol, wrong apex, wrong depth, or an illegal part). Exactly ONE invented label deep under one
// provisioned storage name; deeper hostnames are not bottles (the wildcard covers a single label).
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
  // The adapter facet is the first path segment IFF it is /.<adapter>; anything else is the bottle root.
  const seg = u.pathname.split("/").filter(Boolean)[0] || "";
  let adapter = null;
  if (seg.startsWith(".")) {
    const a = seg.slice(1);
    if (!isSlug(a)) return null;
    adapter = a;
  }
  return { label, storage, apex, adapter };
}
