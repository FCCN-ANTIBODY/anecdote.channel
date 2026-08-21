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
    const flags = parts.filter((p) => !p.startsWith("repo:"));
    out.push({
      host: host.toLowerCase(),
      draft: flags.includes("draft"),       // held back entirely
      system: flags.includes("system"),     // validated, never published — infrastructure, not a destination
      label: label || "",
      repo,
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
