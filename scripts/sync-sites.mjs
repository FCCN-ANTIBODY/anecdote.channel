// scripts/sync-sites.mjs — resolve the directory anecdote.channel publishes.
//
// PRIMITIVE ON PURPOSE. A site is a hostname that answers; how it is hosted is not this repo's
// business, and the directory must keep working when a site is not a GitHub repo at all. So the
// default path is an ordinary unauthenticated HTTPS request — the same one any visitor makes.
// No API, no credential, no substrate assumption.
//
// A token is an OPTIONAL ENHANCEMENT, never a requirement. It is consulted only for an entry the
// probe could not see AND which named a `repo:` hint — the window where a site is configured but
// not yet serving. Absent a token, that entry simply reports "not serving yet", which is honest.
// Credentials are per-owner, by naming convention (see tokenEnvFor in directory.mjs).
//
//   node scripts/sync-sites.mjs           # probe + write sites.json
//   node scripts/sync-sites.mjs --check   # probe + verify SAN coverage, write nothing
//
// Exits non-zero when a listed host is not covered by config/san-list.txt: an uncovered deep leaf
// is a TLS error for visitors, and nothing else in the pipeline catches it.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { parseSites, parseRoot, parsePlaces, parseSan, wildcardFor, coveredBy, claimStatus, aliasConflicts,
         treeUnder, rowsUnder, placeName, monikerOf, APEX, tokenEnvFor } from "../directory.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT = 15000;

// The site describes itself: its own <title> IS the name. Not a fallback — the source.
// Entities are decoded because a title is text, not markup, and Longmont's real one is
// "Longmont Public Media &#8211; Longmont&#039;s Public Access TV".
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—" };
function decodeEntities(t) {
  return t
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
function titleOf(html) {
  const m = /<title[^>]*>([^<]*)<\/title>/i.exec(html || "");
  return m ? decodeEntities(m[1]).trim().replace(/\s+/g, " ").slice(0, 90) : "";
}

// Whether a target permits being framed. Recorded, never acted on: absence of a header is not
// consent, and a site that happens to be frameable today can forbid it tomorrow without telling
// anyone. If framing is ever offered to a neighbour, the artifact that makes it real is THEIR
// header naming this origin — a grant they publish and can revoke by editing, the same shape as
// every other consent in the constellation.
// Who actually answers for a name. Read from the response, never guessed — and read HERE rather
// than in the page, because a browser cannot: a cross-origin fetch is opaque and exposes no
// headers at all (Longmont sends no access-control-allow-origin, so there is nothing to read even
// with permission). Printed for externals, where "who is this really served by" is honest
// information a directory owes a reader; our own nodes do not need announcing.
function providerOf(headers) {
  const server = (headers.get("server") || "").toLowerCase();
  const timing = (headers.get("server-timing") || "").toLowerCase();
  const edge = server.includes("cloudflare") ? "cloudflare" : server.split("/")[0] || "";
  // The edge is not always the origin: our own nodes are Cloudflare in front of GitHub Pages, and
  // saying only "cloudflare" would hide who is really holding the bytes.
  const origin =
    headers.get("x-github-request-id") ? "github" :
    headers.get("x-vercel-id") ? "vercel" :
    headers.get("x-nf-request-id") ? "netlify" :
    timing.includes("fastly") ? "fastly" : "";
  if (origin && edge && origin !== edge) return `${edge} → ${origin}`;
  return origin || edge || "unknown";
}

// WHAT A SITE IS, read from what it says it is. Each role in the constellation declares itself
// at a fetchable path — atlas.yml, tell.yml, antidote.yml, and now journal.yml. So this asks the
// site rather than inferring from markup, a URL shape, or a list somebody maintains here.
// "Declared, never computed" is the archivist's own rule; this is it applied to identity.
//
// Roles are NOT exclusive. A civic node self-hosting several answers for several, and reporting
// all of them is the honest description — antibody is an atlas AND an antidote AND a journal.
// An unrecognised site simply has no roles, which is a fact about it and not a failure.
const ROLES = ["journal", "tell", "atlas", "antidote"];

// A site's own claim about where it belongs: /NAME, one line, no scheme. Site-owned rather than
// engine-owned, so it is one fact in one place however many roles the node fills — and readable
// without knowing anything about the substrate underneath it.
//
// Deliberately not CNAME. A CNAME asserts one host is an alias of another; canonical here means a
// PROVEN COPY, not the only copy, so a branch mirrored to another apex is canonical at both.
async function nameOf(host) {
  try {
    const res = await fetch(`https://${host}/NAME`, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { "user-agent": "anecdote-directory (+https://anecdote.channel)" },
    });
    if (!res.ok) return "";
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("html")) return "";
    const body = (await res.text()).trim();
    if (!body || body.startsWith("<") || body.includes("\n")) return "";   // one line, or it is not NAME
    return body.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
  } catch { return ""; }
}

async function rolesOf(host) {
  const found = [];
  const claims = new Set();
  await Promise.all(ROLES.map(async (role) => {
    try {
      const res = await fetch(`https://${host}/${role}.yml`, {
        method: "GET",
        signal: AbortSignal.timeout(TIMEOUT),
        headers: { "user-agent": "anecdote-directory (+https://anecdote.channel)" },
      });
      if (!res.ok) return;
      // A site that answers everything with a soft 404 page would otherwise read as every role at
      // once. The declaration is YAML; an HTML page is a miss however it is dressed up.
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("html")) return;
      const body = (await res.text()).slice(0, 4000).trimStart();
      if (body.startsWith("<")) return;
      if (!/^\s*[a-z_][a-z0-9_-]*\s*:/mi.test(body)) return;   // must look like the declaration it claims to be
      found.push(role);
      // The declaration also carries the site's own claim about WHERE IT BELONGS. This is the
      // field that lets the directory stop asking a code host anything: a host API answer is an
      // accident of where the repo sits today, while this is the site speaking, at a path anyone
      // can fetch, on any substrate.
      const m = /^\s*url:\s*["']?([^"'\s#]+)/mi.exec(body);
      if (m && m[1]) claims.add(m[1].replace(/\/+$/, ""));
    } catch { /* unreachable or timed out — no claim, no role */ }
  }));
  return {
    roles: ROLES.filter((r) => found.includes(r)),   // stable order, not resolution order
    claim: [...claims][0] || "",
  };
}

function framePolicy(headers) {
  const xfo = (headers.get("x-frame-options") || "").trim().toLowerCase();
  const csp = headers.get("content-security-policy") || "";
  const fa = /frame-ancestors([^;]*)/i.exec(csp);
  if (xfo) return xfo;                                  // deny / sameorigin
  if (fa) return `frame-ancestors:${fa[1].trim()}`;
  return "unset";                                       // permitted by silence — NOT by agreement
}

// `where` is a full URL for a shell target (a project page lives at a PATH — probing only the
// hostname would report discoverywritten.github.io/ instead of the site itself) and a bare host
// for one of our own names.
async function probe(where) {
  const url = where.includes("://") ? where : `https://${where}/`;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { "user-agent": "anecdote-directory (+https://anecdote.channel)" },
    });
    // SHIELDED: live, but behind a bot challenge, so nothing about it can be read. This is not
    // "not answering" — the site is there and a person reaches it fine. Reporting it as absent
    // would be the directory lying about a neighbour because a robot was turned away, so it is
    // listed and marked, with the label supplied by config since the title cannot be read.
    if (res.status === 403 || res.status === 503) {
      const body = (await res.text()).slice(0, 600).toLowerCase();
      const cf = (res.headers.get("server") || "").toLowerCase().includes("cloudflare");
      if (cf && /just a moment|checking your browser|cf-browser-verification|challenge/.test(body)) {
        return { served: false, shielded: true, status: res.status, provider: providerOf(res.headers) };
      }
    }
    if (!res.ok) return { served: false, status: res.status };
    return { served: true, status: res.status, title: titleOf(await res.text()),
             frames: framePolicy(res.headers), provider: providerOf(res.headers) };
  } catch (e) {
    return { served: false, status: 0, error: e.name === "TimeoutError" ? "timeout" : "unreachable" };
  }
}

// Where a shell POINTS, resolved from the repository rather than typed here.
//
// Deliberately NOT the Pages API. A repo we list may be served from anywhere — FC Public Media's
// is on Cloudflare, not Pages — and hardcoding a URL in config invents a second truth that goes
// stale the day they move. The repo's own `homepage` field is the substrate-agnostic pointer: the
// owner controls it, it survives changing hosts, and on a public repo it reads with no credential.
//
// Order: the Pages cname when the repo actually serves from Pages (most precise), else `homepage`.
// A token is consulted only for a private repo, per owner (tokenEnvFor).
async function resolveFromRepo(repo) {
  const [owner] = repo.split("/");
  const token = process.env[tokenEnvFor(owner)] || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const headers = { accept: "application/vnd.github+json", "user-agent": "anecdote-directory" };
  if (token) headers.authorization = `Bearer ${token}`;
  const get = async (path) => {
    try {
      const res = await fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(TIMEOUT) });
      return res.ok ? await res.json() : null;
    } catch { return null; }
  };
  const meta = await get(`/repos/${repo}`);
  if (!meta) return { ok: false };
  if (meta.has_pages) {
    const pages = await get(`/repos/${repo}/pages`);
    if (pages?.cname) return { ok: true, url: `https://${pages.cname}/`, via: "pages cname" };
  }
  if (meta.homepage) return { ok: true, url: meta.homepage, via: "repo homepage" };
  return { ok: true, url: "", via: "repo names no homepage" };
}

async function main() {
  const check = process.argv.includes("--check");
  const cfg = readFileSync(join(ROOT, "config/sites.txt"), "utf8");
  const entries = parseSites(cfg);
  const root = parseRoot(cfg);
  const places = parsePlaces(cfg);
  const san = parseSan(readFileSync(join(ROOT, "config/san-list.txt"), "utf8"));

  // Reject a bad alias where the name is minted, not where it is read.
  const aliasProblems = aliasConflicts(entries);
  if (aliasProblems.length) {
    console.error("\nconfig/sites.txt — was: conflicts:");
    for (const p of aliasProblems) console.error(`  ${p}`);
    process.exit(1);
  }

  const sites = [];
  for (const e of entries) {
    const p = await probe(e.host);
    const decl = p.served ? await rolesOf(e.host) : { roles: [], claim: "" };
    const roles = decl.roles;
    // NAME is the address; a role file's url: is the transitional fallback for a site that has
    // not adopted it yet. One fact, one place — the role declarations are getting out of this
    // business entirely.
    const named = p.served ? await nameOf(e.host) : "";
    const claim = named || decl.claim;
    // A shell is judged by its TARGET: the canonical name may not exist yet, and the thing at the
    // end of it is not ours to keep alive either way. `repo:` resolves the target from the
    // repository; an explicit `to:` overrides it for something with no repo at all.
    let target = e.to;
    let via = e.to ? "config" : "";
    if (!target && e.repo) {
      const r = await resolveFromRepo(e.repo);
      if (r.ok && r.url) { target = r.url; via = r.via; }
      else if (r.ok) via = r.via;
    }
    const t = target ? await probe(target) : null;
    // A shell's target can declare the canonical name it is heading for. When it does, that
    // claim — not a code host's metadata — is what says it is ready to be mounted here.
    const tDecl = t?.served ? await rolesOf(new URL(target).hostname) : { roles: [], claim: "" };
    const site = {
      host: e.host,
      leaf: e.host.split(".")[0],           // the label at this level — a category with one thing in it
      roles,                                // what it says it is; [] is a fact, not a failure
      was: e.was,                           // former hosts, carried forward so a move is legible
      claim,                                // where it says it belongs
      claimFrom: named ? "NAME" : decl.claim ? "role url:" : "",
      claimStatus: claimStatus(claim, e.host),
      draft: e.draft,
      system: e.system,
      served: p.served,
      // THE NAME COMES FROM THE THING ITSELF. A config label is an override for something we
      // cannot read a title from — never a second copy of a name that already exists.
      // Order matters. Our own host's title always wins — that is the thing naming itself. A config
      // label comes next, because it is only ever written where the source is unusable, and it must
      // beat the very title it was written to replace. The target's own title is the default for a
      // shell; the leaf is the floor.
      label: p.title || e.label || t?.title || e.host.split(".")[0],
      labelFrom: p.title ? "its own title" : e.label ? "config" : t?.title ? "target title" : "leaf",
      note: "",
    };
    if (target) {
      site.to = target;
      site.via = via;
      site.leaves = true;                     // the renderer must say so, every time
      site.targetLive = Boolean(t && (t.served || t.shielded));
      site.targetShielded = Boolean(t?.shielded);
      site.targetFrames = t?.frames || "unknown";
      site.targetProvider = t?.provider || "unknown";
      site.targetRoles = tDecl.roles;
      site.targetClaim = tDecl.claim;
      // The site claiming the very name we list it under is the handshake: it says it belongs
      // here, we say it does, and neither of us had to ask GitHub.
      if (tDecl.claim) {
        const claimed = tDecl.claim.replace(/^https?:\/\//, "").replace(/\/+$/, "");
        site.claimsThisName = claimed === e.host;
        if (!site.claimsThisName) site.note = `declares ${claimed} — listed at ${e.host}`;
      }
      // Link the canonical name once it answers (it redirects out); until then, link the target
      // directly so the listing is useful before the DNS chain exists.
      site.href = p.served ? `https://${e.host}/` : target;
      if (t?.shielded) site.note = "shielded — live, but a challenge blocks reading it";
      else if (!t?.served) site.note = "target not answering";
      else if (!p.served) site.note = "no canonical name yet — links out directly";
    }
    if (!p.served && !target) {
      site.note = p.error || `HTTP ${p.status}`;
    }
    sites.push(site);
  }
  sites.sort((a, b) => a.host.localeCompare(b.host));

  // Every listed host is checked for TLS coverage, draft included — the point is to catch it
  // BEFORE it goes public, not after a visitor hits a certificate error.
  const uncovered = sites.filter((s) => !coveredBy(s.host, san));
  // A reserved place needs its wildcard the day it is claimed. Holding a name whose certificate
  // does not cover it is holding nothing.
  const uncoveredPlaces = places.filter((p) => !san.includes(`*.${p}`));

  for (const s of sites) {
    const mark = s.leaves ? (s.targetShielded ? "shd" : s.targetLive ? "out" : "—") : s.served ? "ok" : "—";
    const cl = s.claimStatus === "agrees" ? "✓claim" : s.claimStatus === "elsewhere" ? "!claim" : "";
    const tail = [s.system ? "(system)" : "", s.draft ? "(draft)" : "",
                  cl, s.via && s.via !== "config" ? `via ${s.via}` : "", s.note].filter(Boolean).join("  ");
    console.log(`  ${mark.padEnd(3)} ${s.host.padEnd(48)} ${s.label}${tail ? "   " + tail : ""}`);
  }

  if (uncoveredPlaces.length) {
    console.error(`\nReserved places with no wildcard — a name held without coverage is held in name only:`);
    for (const p of uncoveredPlaces) console.error(`  ${p}   add: *.${p}`);
    process.exit(1);
  }

  if (uncovered.length) {
    console.error(`\nNot covered by config/san-list.txt — visitors would get a TLS error:`);
    for (const s of uncovered) console.error(`  ${s.host}   add: ${wildcardFor(s.host)}`);
    process.exit(1);
  }

  if (check) { console.log("\ncheck only — nothing written"); return; }

  // No timestamp on purpose: an unchanged re-run must produce no diff, so the committing
  // workflow stays quiet (cadence, not chatter).
  // SHAPE IT HERE, RENDER IT IN LIQUID. Liquid has no recursion, so the tree walk cannot live in
  // the template — but it does not need to. The resolver already knows the shape; emitting it flat
  // means the page is nested `for` loops over data, which is what a Jekyll site would be and what a
  // crawler can read without executing anything.
  const published = sites.filter((s) => !s.draft && !s.system).filter((s) => !s.leaves || s.targetLive);
  const tree = treeUnder(root, published);
  const seen = new Set(tree.map((p) => p.host));
  const empty = places.filter((h) => !seen.has(h) && h.endsWith(`.${root}`))
    .map((h) => ({ host: h, site: null, children: [] }));
  const listing = [...tree, ...empty]
    .sort((a, b) => a.host.localeCompare(b.host))
    .map((place) => ({
      host: place.host,
      name: placeName(place.host),
      rows: rowsUnder(place).map((row) => ({
        category: row.category,
        entries: row.entries.map((e) => ({
          host: e.host,
          was: e.site.was || [],
          name: e.site.label || monikerOf(e.site, place.host),
          href: e.site.leaves ? e.site.href : `https://${e.host}/`,
          linked: Boolean(e.site.served || e.site.leaves),
          leaves: Boolean(e.site.leaves),
          shielded: Boolean(e.site.targetShielded),
          dest: e.site.leaves ? "://" + new URL(e.site.href).hostname : "",
          also: (e.site.roles || []).filter((r) => r !== row.category).join(" · "),
        })),
      })),
    }));

  const payload = { apex: APEX, root, places, sites, listing };
  // One file, fetched by the page at runtime. There is no build to feed.
  writeFileSync(join(ROOT, "sites.json"), JSON.stringify(payload, null, 2) + "\n");

  // What this actually costs, every run. Places are the unit that scales: one wildcard holds a
  // place whether it has one site or forty, and only a category that genuinely went plural adds
  // another. Printing it means the ceiling arrives as a number rather than as a surprise.
  const used = san.length;
  const placeSet = new Set(places);
  let placeWildcards = 0, categoryWildcards = 0;
  for (const h of san) {
    if (!h.startsWith("*.")) continue;
    const rest = h.slice(2);
    if (placeSet.has(rest)) placeWildcards++;                       // *.<place>
    else if (placeSet.has(rest.split(".").slice(1).join("."))) categoryWildcards++;  // *.<category>.<place>
  }
  const left = 50 - used;
  console.log(`\nwrote sites.json (${sites.length} entries across ${places.length} places)`);
  console.log(`SAN: ${used}/50 — ${placeWildcards} place, ${categoryWildcards} category, ` +
              `${used - placeWildcards - categoryWildcards} structural. ${left} left.`);
  console.log(`     a place costs 1 whether it holds one site or forty. A CATEGORY costs 1 per` +
              ` place it is used in — even with one occupant, because the five-part slot is`);
  console.log(`     reserved for civic nodes and an occupant is therefore always at six. That is` +
              ` the multiplicative term: places x categories-in-use.`);
  // Say where the ceiling actually is, in the shape it will arrive in, rather than leaving it to
  // be discovered when a wildcard silently cannot be added.
  const cats = new Set();
  for (const h of san) {
    if (!h.startsWith("*.")) continue;
    const rest = h.slice(2);
    if (!placeSet.has(rest) && placeSet.has(rest.split(".").slice(1).join("."))) cats.add(rest.split(".")[0]);
  }
  const k = Math.max(1, cats.size);
  console.log(`     at ${cats.size} distinct categor${cats.size === 1 ? "y" : "ies"} in use, ` +
              `~${Math.floor(left / (1 + k))} more places fit.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
