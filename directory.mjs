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
    // Names this entry USED to answer at. From outside, a rename and a deletion are the same
    // observation — the host stops answering — so without this every downstream link rots
    // silently on each move and the directory cannot tell anyone why.
    const was = parts.filter((p) => p.startsWith("was:")).map((p) => p.slice(4).toLowerCase());
    const flags = parts.filter((p) => !/^(repo|to):/.test(p));
    out.push({
      host: host.toLowerCase(),
      draft: flags.includes("draft"),       // held back entirely
      system: flags.includes("system"),     // validated, never published — infrastructure, not a destination
      label: label || "",
      repo,
      to,                                   // a SHELL: we assert the name, it points somewhere we do not run
      was,                                  // former hosts; a consumer can say "renamed to X", not "dead"
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

// A host under a place carries at most two meaningful labels: <moniker>.<category>.<place>…
// The label ADJACENT TO THE PLACE is the category; the one in front of it is the moniker. Where
// only one label is present it is both — the canonical occupant, which is why media.fort-collins…
// reads as "the public media here" and needs no moniker in front of it.
//
// This is why the extra level only appears where plurality actually arrives: a category with one
// occupant costs nothing, and the day a second shows up the first keeps its short canonical name
// while the newcomers take monikers beneath it.
//
// A DECLARED ROLE STILL WINS over position. A thing that says what it is beats a guess from where
// it sits, which is what keeps a moniker from being mistaken for a category.
export function categoryOf(site, placeHost = "") {
  const roles = site?.roles || [];
  for (const r of ROLE_ORDER) if (roles.includes(r)) return r;
  const host = site?.host || "";
  if (placeHost && host.endsWith(`.${placeHost}`)) {
    const below = host.slice(0, -(placeHost.length + 1)).split(".");
    return below[below.length - 1];          // the label sitting on the place
  }
  return site?.leaf || "";
}

// The name a thing goes by inside its category — the label furthest from the place. Equal to the
// category when the thing is that category's canonical occupant.
export function monikerOf(site, placeHost = "") {
  const host = site?.host || "";
  if (placeHost && host.endsWith(`.${placeHost}`)) {
    return host.slice(0, -(placeHost.length + 1)).split(".")[0];
  }
  return site?.leaf || "";
}

export function rowsUnder(placeNode) {
  const entries = [];
  for (const child of placeNode.children) entries.push(...flatten(child));
  const byCategory = new Map();
  for (const e of entries) {
    const c = categoryOf(e.site, placeNode.host);
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

// `@place <host>` — a place RESERVED before anything is in it. A wildcard nobody can see is not a
// reservation; the point of holding a name is that someone can be shown it. So a reserved place
// renders, empty, and its TLS coverage is checked exactly like an occupied one — the cost of
// standing somewhere up is paid the day it is claimed, not the day someone finally arrives.
export function parsePlaces(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^@place\s+(\S+)$/.exec(line);
    if (m) out.push(m[1].toLowerCase());
  }
  return out;
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

// WHICH PARTS OF AN ENTRY EXIST. Pure, so it can be tested without a browser — the "everything
// says SOON" bug was a CSS rule (`display: inline-block` on .place/.soon) beating the UA's
// [hidden] { display: none }, which resurrected elements the script had hidden. The renderer now
// REMOVES what does not apply instead of hiding it, and this decides what applies.
export function entryParts(e) {
  const linked = Boolean(e && e.linked);
  return {
    link: linked,
    soon: !linked,
    also: Boolean(e && e.also),
    out: Boolean(e && e.leaves),
  };
}

// WHAT `was:` MUST NEVER BE ALLOWED TO SAY. Both of these are cheap to forbid where names are
// minted and expensive to debug downstream, so they are rejected here rather than surfaced to a
// consumer as ambiguity.
//
// A vacated name is retired, not recycled. That is the rule `was:` being permanent implies, stated
// so it can be enforced.
export function aliasConflicts(entries) {
  const problems = [];
  const current = new Set(entries.map((e) => e.host));
  const claimedBy = new Map();

  for (const e of entries) {
    for (const old of e.was || []) {
      // 1. The same former name claimed by two entries. A consumer cannot say which one a stale
      //    link should be repaired to, so it would have to report ambiguity forever.
      if (claimedBy.has(old) && claimedBy.get(old) !== e.host) {
        problems.push(`${old} is listed as a former name of BOTH ${claimedBy.get(old)} and ${e.host}`);
      }
      claimedBy.set(old, e.host);

      // 2. A former name that someone is using NOW. This is the one with teeth: a stale link
      //    resolves to the WRONG site instead of breaking, and silently landing a reader
      //    somewhere else is worse than a dead link they can see.
      if (current.has(old)) {
        problems.push(`${old} is a former name of ${e.host} AND a current host — a vacated name must never be reused`);
      }

      // 3. Naming yourself. Harmless but meaningless, and it makes --moves report a rename that
      //    never happened.
      if (old === e.host) problems.push(`${e.host} lists itself as a former name`);
    }
  }
  return problems;
}
