// scripts/constellation.mjs — the registrar's view of the constellation.
//
// Ported from a reader that lived downstream, at discoverywritten.com, and read the PUBLISHED
// sites.json because that is all an outside consumer can see. Being the registrar changes what the
// tool can know: config/sites.txt and config/san-list.txt are the source, so this checks the source
// against what is deployed and against what actually answers, rather than inferring the source from
// its output. Registering names is anecdote's job; the tool belongs where the names are minted.
//
//   node scripts/constellation.mjs --sites      what the registry holds
//   node scripts/constellation.mjs --moves      renames the registry remembers
//   node scripts/constellation.mjs --coverage   san-list against what config needs
//   node scripts/constellation.mjs --links      probe every listed name and target
//   node scripts/constellation.mjs --selftest   the reader, against a pinned fixture
//
// Exits non-zero when it finds a problem, so it can gate a pipeline.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { parseSites, parsePlaces, parseSan, parseRoot, coveredBy, wildcardFor,
         aliasConflicts, APEX } from "../directory.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT = 15000;

const readConfig = (dir = ROOT) => {
  const text = readFileSync(join(dir, "config/sites.txt"), "utf8");
  return {
    entries: parseSites(text),
    places: parsePlaces(text),
    root: parseRoot(text),
    san: parseSan(readFileSync(join(dir, "config/san-list.txt"), "utf8")),
  };
};

// ---- renames -----------------------------------------------------------------------------

// Every host an entry used to answer to, mapped to what it is now. `was` is cumulative rather
// than a single previous name, so a node that moved twice resolves both old hosts without any
// chain-walking. A Set per key means a name claimed by two entries surfaces as ambiguous instead
// of resolving to whichever was parsed last.
export function renameMap(entries) {
  const moves = new Map();
  for (const e of entries) {
    for (const old of e.was || []) {
      if (old === e.host) continue;                 // naming yourself is not a rename
      if (!moves.has(old)) moves.set(old, new Set());
      moves.get(old).add(e.host);
    }
  }
  return moves;
}

function cmdMoves({ entries }) {
  const moves = renameMap(entries);
  if (!moves.size) {
    console.log("No renames recorded.");
    console.log("(record one as `was:<host>` on the entry that moved.)");
    return 0;
  }
  const current = new Set(entries.map((e) => e.host));
  console.log("was".padEnd(54) + "is now");
  let problems = 0;
  for (const old of [...moves.keys()].sort()) {
    const now = [...moves.get(old)].sort();
    let flag = "";
    // sync-sites rejects both of these before they can be written, so a config this tool reads
    // should never contain one. Kept because a config can be hand-edited or mirrored, and a
    // check that only holds when the pipeline is trusted is not a check.
    if (now.length > 1) { flag = `  AMBIGUOUS — claimed by ${now.length} entries`; problems++; }
    else if (current.has(old)) { flag = "  REUSED — also a current host"; problems++; }
    console.log(old.slice(0, 54).padEnd(54) + now.join(", ") + flag);
  }
  console.log(`\n${moves.size} rename(s), ${problems} problem(s).`);
  return problems ? 1 : 0;
}

// ---- coverage ----------------------------------------------------------------------------

// The registrar can do what a downstream reader cannot: compare the SAN list it actually ships
// against the names config actually needs, in both directions. A missing wildcard is a TLS error
// waiting for a visitor; an unused one is a slot held against a 50-host ceiling.
function cmdCoverage({ entries, places, san }) {
  const needed = new Map();
  for (const h of [...entries.map((e) => e.host), ...places, APEX]) {
    const w = coveredBy(h, san) ? null : wildcardFor(h);
    if (w) needed.set(w, [...(needed.get(w) || []), h]);
  }
  const used = new Set();
  for (const h of [...entries.map((e) => e.host), ...places, APEX]) {
    if (san.includes(h)) used.add(h);
    const w = wildcardFor(h);
    if (w && san.includes(w)) used.add(w);
  }
  // A wildcard over a RESERVED place covers nothing listed and is not idle — the reservation is
  // the point, and the coverage has to exist the day someone arrives. Calling it unused would
  // invite deleting exactly the slot that makes a place claimable.
  const reserved = san.filter((h) => !used.has(h) && places.some((p) => h === `*.${p}`));
  const idle = san.filter((h) => !used.has(h) && !reserved.includes(h));

  console.log(`san-list: ${san.length}/50 entries, ${entries.length} sites across ${places.length} places\n`);
  if (needed.size) {
    console.log("MISSING — a listed name no wildcard covers (a TLS error for a visitor):");
    for (const [w, hosts] of needed) {
      console.log(`  ${w}`);
      for (const h of hosts) console.log(`       ${h}`);
    }
  } else {
    console.log("every listed name is covered.");
  }
  if (reserved.length) {
    console.log("\nheld for a reserved place — covers nothing yet, and should not:");
    for (const h of reserved) console.log(`  ${h}`);
  }
  if (idle.length) {
    console.log("\nIDLE — covers nothing listed and no reserved place. Either something is served");
    console.log("under it that config does not know about, or it is a slot to reclaim:");
    for (const h of idle) console.log(`  ${h}`);
  }
  console.log(`\n${50 - san.length} slot(s) left. A place costs 1; a category costs 1 per place it is used in.`);
  return needed.size ? 1 : 0;
}

// ---- what is deployed --------------------------------------------------------------------

function cmdSites({ entries, places, root, san }) {
  console.log(`apex ${APEX}   root ${root}   places ${places.length}   sites ${entries.length}\n`);
  console.log("host".padEnd(56) + "flags");
  for (const e of [...entries].sort((a, b) => a.host.localeCompare(b.host))) {
    const flags = [
      e.system ? "system" : "", e.draft ? "draft" : "",
      e.repo ? `repo:${e.repo}` : "", e.to ? `to:${e.to}` : "",
      (e.was || []).length ? `was:${e.was.join(",")}` : "",
      coveredBy(e.host, san) ? "" : "NO TLS",
    ].filter(Boolean);
    console.log(e.host.slice(0, 56).padEnd(56) + flags.join("  "));
  }
  return 0;
}

// ---- probing -----------------------------------------------------------------------------

async function probe(url) {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT),
                                   headers: { "user-agent": "anecdote-constellation" } });
    return { status: res.status, location: res.headers.get("location") || "" };
  } catch { return { status: 0, location: "" }; }
}

async function cmdLinks({ entries }) {
  const moves = renameMap(entries);
  const current = new Set(entries.map((e) => e.host));
  let problems = 0;

  console.log("name".padEnd(52) + "http   note");
  for (const e of [...entries].sort((a, b) => a.host.localeCompare(b.host))) {
    const { status } = await probe(`https://${e.host}/`);
    const note = [];
    if (!status) note.push(e.to || e.repo ? "does not resolve (pointer only)" : "does not answer");
    else if (status >= 400 && status !== 403) { note.push(`HTTP ${status}`); problems++; }
    else if (status === 403) note.push("403 — blocks robots; fine in a browser");
    console.log(e.host.slice(0, 52).padEnd(52) + String(status || "---").padEnd(6) + " " + note.join("; "));
  }

  // A superseded name that ANSWERS means one of two opposite things, and following the redirect
  // would collapse them: redirecting is the good end state, a move made into a non-event; serving
  // content under a name the registry says was given up means the old DNS came back, and a stale
  // link now lands a reader on the wrong site instead of visibly breaking.
  if (moves.size) {
    console.log("\nvacated names:");
    for (const [old, now] of moves) {
      const { status, location } = await probe(`https://${old}/`);
      let note;
      if (!status) note = `retired — links say RENAMED to ${[...now].join(", ")}`;
      else if (status >= 300 && status < 400 && location) note = `redirecting -> ${location}`;
      else { note = `ANSWERING under a vacated name — old DNS may have returned`; problems++; }
      console.log("  " + old.slice(0, 50).padEnd(52) + String(status || "---").padEnd(6) + " " + note);
      if (current.has(old)) { console.log("       REUSED — also a current host"); problems++; }
    }
  }
  console.log(`\n${problems} problem(s).`);
  return problems ? 1 : 0;
}

// ---- selftest ----------------------------------------------------------------------------

// Against a fixture, never against the deployment. The contract is the thing to test; a tool
// verified against live state passes only where that state happens to hold, which is how this
// repo's page test came to be green locally and red on every runner.
function selftest() {
  const fx = join(ROOT, "scripts/fixtures/constellation");
  const cfg = readConfig(fx);
  let n = 0;
  const t = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

  t("a rename resolves, cumulatively", () => {
    const m = renameMap(cfg.entries);
    assert(m.get("old-one.x.anecdote.channel")?.has("moved.x.anecdote.channel"), "first old name");
    assert(m.get("old-two.x.anecdote.channel")?.has("moved.x.anecdote.channel"), "second old name");
  });
  t("an entry naming itself is not a rename", () => {
    assert(!renameMap([{ host: "a.x", was: ["a.x"] }]).size, "self-reference ignored");
  });
  t("the fixture's conflicts are caught", () => {
    const bad = aliasConflicts([{ host: "a.x", was: ["b.x"] }, { host: "b.x", was: [] }]);
    assert(bad.length === 1 && /never be reused/.test(bad[0]), "reuse rejected");
  });
  t("coverage sees a missing wildcard", () => {
    const missing = cfg.entries.filter((e) => !coveredBy(e.host, cfg.san));
    assert(missing.length === 1, `expected one uncovered name, got ${missing.length}`);
  });
  console.log(`\n${n}/${n} passed`);
  return 0;
}
function assert(cond, msg) { if (!cond) { console.error(`  FAIL: ${msg}`); process.exit(1); } }

// ---- main --------------------------------------------------------------------------------

const arg = process.argv[2] || "--sites";
const cmds = { "--sites": cmdSites, "--moves": cmdMoves, "--coverage": cmdCoverage, "--links": cmdLinks };
if (arg === "--selftest") process.exit(selftest());
if (arg === "-h" || arg === "--help" || !cmds[arg]) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n")
    .filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  process.exit(cmds[arg] ? 0 : 2);
}
process.exit(await cmds[arg](readConfig()));
