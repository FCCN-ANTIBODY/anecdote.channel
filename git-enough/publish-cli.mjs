// git-enough/publish-cli.mjs — the operator's trigger for a LIVE send-pack (Milestone: Origin, phase 3).
//
// The protocol is verified offline against a real `git receive-pack` (send-pack.test.mjs). This is the
// thin CLI that fires the one remaining live step — a real push to a downstream GitHub repo — under the
// operator's own hand, with the PAT read from the environment (never a flag, never logged).
//
//   OFFLINE_ORIGIN_PAT=<token> node git-enough/publish-cli.mjs <repo-url> [options]
//
// Options:
//   --ref <refs/heads/main>     ref to advance (default refs/heads/main)
//   --root                      commit a FRESH ROOT — the King's Leap (replaces downstream history;
//                               the downstream must allow force pushes)
//   --message "<msg>"           commit message (default a generic one)
//   --file <path>=<content>     add a file (repeatable); default is a single README.md
//   --user <name>               HTTP Basic username (default x-access-token; the token is the password)
//   --dry-run                   build + pack locally and print the plan; NO network, NO token needed
//
// Token scope: fine-grained PAT with Contents: Read and write on the target repo (+ Workflows: R/W only
// if a file is under .github/workflows/). For --root, enable force pushes on the branch.

import { repo } from "./repo.mjs";
import { packRepo } from "./pack.mjs";
import { publish } from "./send-pack.mjs";

// Build a one-commit repo from the given files. Pure — no network, no token. Returns { r, tip }.
export async function buildRepo({ files, root = false, message, ref = "refs/heads/main", author } = {}) {
  const r = repo();
  const tip = await r.commitFiles(files, { author, message, ref, root });
  return { r, tip };
}

function parseArgs(argv) {
  const o = { files: [], ref: "refs/heads/main", root: false, dryRun: false, user: "x-access-token" };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") o.root = true;
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--ref") o.ref = argv[++i];
    else if (a === "--message") o.message = argv[++i];
    else if (a === "--user") o.user = argv[++i];
    else if (a === "--file") { const s = argv[++i]; const eq = s.indexOf("="); o.files.push({ path: s.slice(0, eq), content: s.slice(eq + 1) }); }
    else rest.push(a);
  }
  o.url = rest[0];
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.url) { console.error("usage: OFFLINE_ORIGIN_PAT=… node git-enough/publish-cli.mjs <repo-url> [--root] [--file p=c] [--dry-run]"); process.exit(2); }
  if (!o.files.length) o.files = [{ path: "README.md", content: "# offline-origin\n\nPublished by git-enough send-pack.\n" }];
  if (!o.message) o.message = o.root ? "import: King's Leap\n" : "publish from offline origin\n";
  const author = { name: "offline-origin", email: "origin@local", epoch: Math.floor(Date.now() / 1000), tz: "+0000" };

  const { r, tip } = await buildRepo({ files: o.files, root: o.root, message: o.message, ref: o.ref, author });
  const pack = await packRepo(r);
  console.log(`plan: ${o.root ? "ROOT (King's Leap — replaces history)" : "advance"} ${o.ref} → ${tip}`);
  console.log(`      ${r.objects.size} objects, ${pack.length} pack bytes, ${o.files.length} file(s) → ${o.url}`);

  if (o.dryRun) { console.log("dry-run: not contacting the network."); return; }

  const token = process.env.OFFLINE_ORIGIN_PAT || process.env.GITHUB_TOKEN;
  if (!token) { console.error("no token: set OFFLINE_ORIGIN_PAT in the environment"); process.exit(2); }
  if (o.root) console.log("⚠ --root will REPLACE the downstream's history (needs force pushes enabled).");

  const { advertised, report, upToDate } = await publish(r, { url: o.url, ref: o.ref, credential: { username: o.user, token } });
  console.log("advertised refs:", Object.keys(advertised.refs).length ? advertised.refs : "(none — empty repo)");
  if (upToDate) { console.log("up to date — nothing to push."); return; }
  console.log("report:", JSON.stringify(report));
  if (!report.ok) { console.error("PUSH REJECTED"); process.exit(1); }
  console.log(`✓ pushed — ${o.url} ${o.ref} now at ${tip}`);
}

// Run only as a script (not when imported by a test).
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error("error:", e.message); process.exit(1); });
