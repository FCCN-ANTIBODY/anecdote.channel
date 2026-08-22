// directory.mjs — the shape of the directory anecdote.channel publishes.
//
// THE HOSTNAME IS THE STRUCTURE. `voices.north.colorado.anecdote.channel` is not a flat entry: it
// sits under `north.colorado…`, under `colorado…`, under the apex. An intermediate level may or may
// not be served — either way it is a real node. Unserved levels render as CATEGORIES; serving one
// later turns the same grouping into a listing without changing this file.
//
// Imported by BOTH `scripts/sync-sites.mjs` (Node, resolves + validates) and `index.html` (browser,
// renders). One implementation on purpose — a second copy is a second truth that can drift.

export const APEX = "anecdote.channel";

// --- pure core (importable by the tests; no network, no fs) -------------------------------

// One hostname per line, optional flags, optional `= label`. Blank lines and `#` comments ignored.
export function parseSites(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line || line.startsWith("@")) continue;          // `@directive` lines are not sites
    const [lhs, ...labelParts] = line.split("=");
    const label = labelParts.join("=").trim();
    const parts = lhs.trim().split(/\s+/);
    const host = parts.shift();
    if (!host.includes(".")) throw new Error(`sites.txt: expected a hostname, got "${host}"`);
    const repo = (parts.find((p) => p.startsWith("repo:")) || "").slice(5);
    const to = (parts.find((p) => p.startsWith("to:")) || "").slice(3);
    const flags = parts.filter((p) => !/^(repo|to):/.test(p));
    out.push({
      host: host.toLowerCase(),
      draft: flags.includes("draft"),       // held back entirely
      system: flags.includes("system"),     // validated, never published — infrastructure, not a destination
      label: label || "",
      repo,
      to,                                   // a SHELL: we assert the name, it points somewhere we do not run
    });
  }
  return out;
}

// One hostname per line; comments/blanks ignored; lowercased and de-duplicated.
export function parseSan(text) {
  const out = new Set();
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim().toLowerCase();
    if (line) out.add(line);
  }
  return [...out];
}

// A TLS wildcard matches EXACTLY ONE label: *.a.b covers x.a.b but never x.y.a.b.
export function wildcardFor(host) {
  const parent = host.split(".").slice(1).join(".");
  return parent ? `*.${parent}` : null;
}

export function coveredBy(host, san) {
  const h = host.toLowerCase();
  if (san.includes(h)) return true;
  const w = wildcardFor(h);
  return w ? san.includes(w) : false;
}

// Every ancestor of a host up to (and including) the apex — the levels the directory can have.
export function ancestorsOf(host, apex = APEX) {
  const out = [];
  let cur = host;
  while (cur && cur !== apex && cur.endsWith(`.${apex}`)) {
    cur = cur.split(".").slice(1).join(".");
    out.push(cur);
  }
  return out;
}

// Build the tree beneath `root` from a flat host list. Intermediate levels appear whether or not
// anything serves them — an unserved level is a grouping, and arranging a host for it later turns
// the same grouping into a listing.
export function treeUnder(root, sites) {
  const served = new Map(sites.filter((s) => s.host).map((s) => [s.host, s]));
  const suffix = `.${root}`;
  const children = new Map();
  for (const s of sites) {
    if (!s.host || s.host === root || !s.host.endsWith(suffix)) continue;
    const rest = s.host.slice(0, -suffix.length);          // labels below root
    const label = rest.split(".").pop();                   // the ONE hop down
    const childHost = `${label}${suffix}`;
    if (!children.has(childHost)) children.set(childHost, []);
    children.get(childHost).push(s);
  }
  return [...children.keys()].sort().map((host) => ({
    host,
    site: served.get(host) || null,        // null => a grouping level nobody serves (yet)
    children: treeUnder(host, sites),
  }));
}

// THREE KINDS OF ENTRY, and the difference is who runs the thing at the end of the name.
//
//   hosted   we serve it. The name is ours and so is what answers.
//   shell    we assert a canonical name in the chain (`to:`), and it leads somewhere we do not
//            run. The name is the claim: putting media.longmont.colorado… in the same predictable
//            place as media.fort-collins.colorado… says the directory is a directory ON PURPOSE,
//            not a list of things we happen to own. Naming someone is not hosting them, and it
//            must never read as though it were.
//   external the same, before any name in the chain exists yet — it just links out.
//
// A shell always announces that it leaves. Someone following a name in this namespace should
// never discover afterwards that they left it; being handed off is fine, being handed off
// silently is not.

// HOW A LISTING IS LAID OUT. A place heading sits flush left; beneath it every CATEGORY occupies
// a fixed left column and never moves, and the names it holds occupy the column beside it. A
// category with one name reads as a straight row across; a category with several stacks them in
// the right column while the category itself stays put. Nothing is ever folded away or indented
// out of line — the left column is the same left column on every row, which is the whole point of
// having one.
//
//   Fort Collins
//   ANTIBODY   ANTIBODY
//   CIRCUS     One Of Those
//              Another Of Those
//   MEDIA      FC Public Media
//
// So a node under a place yields one row: its leaf on the left, and on the right either its own
// name (it is a site) or the names of what it holds (it is a grouping).
// The category is WHAT A THING IS, and a thing says what it is: each role in the constellation
// declares itself at a fetchable path, so `journal` is read off the site rather than off the DNS
// label or a word typed into config. A moniker — some code or name a misc site goes by — is not a
// category, so where nothing is declared the DNS label stands in and the row is honest about
// being uncategorised rather than inventing a type for it.
//
// Roles are not exclusive. A node running several declares several; the first in ROLE_ORDER is the
// one it files under, and the rest travel with the entry so nothing is hidden.
export const ROLE_ORDER = ["journal", "tell", "atlas", "antidote"];

export function categoryOf(site) {
  const roles = site?.roles || [];
  for (const r of ROLE_ORDER) if (roles.includes(r)) return r;
  return site?.leaf || "";
}

export function rowsUnder(placeNode) {
  const entries = [];
  for (const child of placeNode.children) entries.push(...flatten(child));
  const byCategory = new Map();
  for (const e of entries) {
    const c = categoryOf(e.site);
    if (!byCategory.has(c)) byCategory.set(c, []);
    byCategory.get(c).push(e);
  }
  return [...byCategory.entries()]
    .sort((a, b) => {
      // Declared roles first, in their own order; everything uncategorised after, alphabetically.
      const ra = ROLE_ORDER.indexOf(a[0]), rb = ROLE_ORDER.indexOf(b[0]);
      if (ra !== -1 || rb !== -1) return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
      return a[0].localeCompare(b[0]);
    })
    .map(([category, es]) => ({ category, entries: es }));
}

function flatten(node) {
  const out = node.site ? [node] : [];
  for (const c of node.children) out.push(...flatten(c));
  return out;
}

// A place label as a person writes it: `fort-collins` is a DNS label, "Fort Collins" is a place.
export function placeName(host) {
  return host.split(".")[0].split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// `@root <host>` — which level the APEX lists. The apex is the name people can remember and say
// out loud, so it should show the places worth going, not the top of the tree. Today everything
// lives under one state; when that stops being true, change this line and the apex widens.
export function parseRoot(text, apex = APEX) {
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^@root\s+(\S+)$/.exec(line);
    if (m) return m[1].toLowerCase();
  }
  return apex;
}

// Per-owner credential lookup. One secret PER OWNER, named by convention — never one blob holding
// `OWNER=token` lines. A blob is unparsed text with no schema: one bad line breaks every owner, and
// rotating one token means rewriting the whole secret. Named secrets rotate independently, fail
// independently, and adding an owner is adding a secret rather than editing existing text.
//
//   NCCV-OPINION  ->  SITES_TOKEN_NCCV_OPINION
export function tokenEnvFor(owner) {
  return "SITES_TOKEN_" + owner.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

// A site's claim about where it belongs, compared with where we list it. The claim is the site
// speaking at a fetchable path — not a code host's metadata, which is an accident of where the
// repo sits today. Agreement is the whole handshake: it says it belongs here, we say it does,
// and neither of us had to ask any particular vendor.
//
// Disagreement is INFORMATION, not an error. A site can legitimately be reached at a name it does
// not consider canonical, and a claim we do not honour is still worth surfacing rather than
// silently overriding — the directory is a witness before it is a judge.
export function claimStatus(claim, host) {
  if (!claim) return "unclaimed";
  const c = claim.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
  return c === host.toLowerCase() ? "agrees" : "elsewhere";
}
