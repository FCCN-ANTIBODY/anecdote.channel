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

// The site describes itself: its own <title> is the label unless config overrides it.
function titleOf(html) {
  const m = /<title[^>]*>([^<]*)<\/title>/i.exec(html || "");
  return m ? m[1].trim().replace(/\s+/g, " ").slice(0, 80) : "";
}

async function probe(host) {
  try {
    const res = await fetch(`https://${host}/`, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { "user-agent": "anecdote-directory (+https://anecdote.channel)" },
    });
    if (!res.ok) return { served: false, status: res.status };
    return { served: true, status: res.status, title: titleOf(await res.text()) };
  } catch (e) {
    return { served: false, status: 0, error: e.name === "TimeoutError" ? "timeout" : "unreachable" };
  }
}

// Only reached when the probe found nothing and the entry named a repo. Confirms the hostname the
// repo INTENDS to serve, so a configured-but-not-yet-live site can be validated before it exists.
async function confirmViaRepo(entry) {
  const [owner] = entry.repo.split("/");
  const token = process.env[tokenEnvFor(owner)] || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) return { checked: false };
  try {
    const res = await fetch(`https://api.github.com/repos/${entry.repo}/pages`, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`,
                 "user-agent": "anecdote-directory" },
    });
    if (!res.ok) return { checked: true, cname: null };
    const { cname } = await res.json();
    return { checked: true, cname: cname || null };
  } catch { return { checked: false }; }
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
    const site = {
      host: e.host,
      draft: e.draft,
      system: e.system,
      served: p.served,
      label: e.label || p.title || e.host.split(".")[0],
      note: "",
    };
    if (!p.served && e.repo) {
      const c = await confirmViaRepo(e);
      if (!c.checked) site.note = "not serving yet (no credential for a look-ahead)";
      else if (c.cname === e.host) site.note = "configured, not yet serving";
      else if (c.cname) site.note = `repo declares ${c.cname} — config says ${e.host}`;
      else site.note = "repo serves no hostname";
    } else if (!p.served) {
      site.note = p.error || `HTTP ${p.status}`;
    }
    sites.push(site);
  }
  sites.sort((a, b) => a.host.localeCompare(b.host));

  // Every listed host is checked for TLS coverage, draft included — the point is to catch it
  // BEFORE it goes public, not after a visitor hits a certificate error.
  const uncovered = sites.filter((s) => !coveredBy(s.host, san));

  for (const s of sites) {
    const mark = s.served ? "ok" : "—";
    const tail = [s.system ? "(system)" : "", s.draft ? "(draft)" : "", s.note].filter(Boolean).join("  ");
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
