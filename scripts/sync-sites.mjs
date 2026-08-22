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
import { parseSites, parseRoot, parseSan, wildcardFor, coveredBy, APEX, tokenEnvFor } from "../directory.mjs";

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

async function rolesOf(host) {
  const found = [];
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
    } catch { /* unreachable or timed out — no claim, no role */ }
  }));
  return ROLES.filter((r) => found.includes(r));   // stable order, not resolution order
}

function framePolicy(headers) {
  const xfo = (headers.get("x-frame-options") || "").trim().toLowerCase();
  const csp = headers.get("content-security-policy") || "";
  const fa = /frame-ancestors([^;]*)/i.exec(csp);
  if (xfo) return xfo;                                  // deny / sameorigin
  if (fa) return `frame-ancestors:${fa[1].trim()}`;
  return "unset";                                       // permitted by silence — NOT by agreement
}

async function probe(host) {
  try {
    const res = await fetch(`https://${host}/`, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { "user-agent": "anecdote-directory (+https://anecdote.channel)" },
    });
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
  const san = parseSan(readFileSync(join(ROOT, "config/san-list.txt"), "utf8"));

  const sites = [];
  for (const e of entries) {
    const p = await probe(e.host);
    const roles = p.served ? await rolesOf(e.host) : [];
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
    const t = target ? await probe(new URL(target).hostname) : null;
    const site = {
      host: e.host,
      leaf: e.host.split(".")[0],           // the label at this level — a category with one thing in it
      roles,                                // what it says it is; [] is a fact, not a failure
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
      site.targetLive = Boolean(t && t.served);
      site.targetFrames = t?.frames || "unknown";
      site.targetProvider = t?.provider || "unknown";
      // Link the canonical name once it answers (it redirects out); until then, link the target
      // directly so the listing is useful before the DNS chain exists.
      site.href = p.served ? `https://${e.host}/` : target;
      if (!t?.served) site.note = "target not answering";
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

  for (const s of sites) {
    const mark = s.leaves ? (s.targetLive ? "out" : "—") : s.served ? "ok" : "—";
    const tail = [s.system ? "(system)" : "", s.draft ? "(draft)" : "",
                  s.via && s.via !== "config" ? `via ${s.via}` : "", s.note].filter(Boolean).join("  ");
    console.log(`  ${mark.padEnd(3)} ${s.host.padEnd(48)} ${s.label}${tail ? "   " + tail : ""}`);
  }

  if (uncovered.length) {
    console.error(`\nNot covered by config/san-list.txt — visitors would get a TLS error:`);
    for (const s of uncovered) console.error(`  ${s.host}   add: ${wildcardFor(s.host)}`);
    process.exit(1);
  }

  if (check) { console.log("\ncheck only — nothing written"); return; }

  // No timestamp on purpose: an unchanged re-run must produce no diff, so the committing
  // workflow stays quiet (cadence, not chatter).
  writeFileSync(join(ROOT, "sites.json"), JSON.stringify({ apex: APEX, root, sites }, null, 2) + "\n");
  console.log(`\nwrote sites.json (${sites.length} entries)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
