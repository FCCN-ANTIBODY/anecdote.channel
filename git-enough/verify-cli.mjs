// git-enough/verify-cli.mjs — eyes-on verification of a downstream. Uses the Castle read-side to CLONE a
// GitHub repo back and print a legible summary: the ref/tip, the commit, and the file tree. This both
// makes push results human-readable and exercises the Castle against real GitHub (fetch → unpack → walk).
//
//   OFFLINE_ORIGIN_PAT=<token> node git-enough/verify-cli.mjs <repo-url> [--ref refs/heads/main]
//   (the token is only needed for a private repo; public repos verify without it)

import { clone } from "./fetch-pack.mjs";
import { parseCommit, filesAt } from "./read.mjs";

function human(n) {
  if (n == null) return "?";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
const webUrl = (url) => url.replace(/\/$/, "").replace(/\.git$/, "");

async function main() {
  const argv = process.argv.slice(2);
  let ref = null; const rest = [];
  for (let i = 0; i < argv.length; i++) { if (argv[i] === "--ref") ref = argv[++i]; else rest.push(argv[i]); }
  const url = rest[0];
  if (!url) { console.error("usage: node git-enough/verify-cli.mjs <repo-url> [--ref refs/heads/main]"); process.exit(2); }

  const token = process.env.OFFLINE_ORIGIN_PAT || process.env.GITHUB_TOKEN;
  const credential = token ? { token } : undefined;

  const { repo, refs, head } = await clone({ url, credential, ref: ref || undefined });
  const web = webUrl(url);
  console.log(`\n${web}`);
  console.log(`  imported ${repo.objects.size} objects · refs: ${Object.keys(refs).length ? Object.keys(refs).join(", ") : "(none)"}`);

  const tipRef = ref || head;
  const tip = repo.readRef(tipRef);
  if (!tip) { console.log(`  ${tipRef}: (unborn / not found)`); return; }
  console.log(`  ${tipRef} → ${tip}`);
  console.log(`  browse: ${web}/commit/${tip}`);

  const commit = parseCommit(repo.objects.get(tip).content);
  console.log(`  commit: ${JSON.stringify(commit.message.trim())}  —  ${commit.author}`);
  if (commit.parents.length) console.log(`  parents: ${commit.parents.join(", ")}`);
  else console.log(`  parents: (none — a root commit)`);

  const files = filesAt(repo.objects, tip);
  console.log(`  tree (${files.length} file${files.length === 1 ? "" : "s"}):`);
  for (const f of files) console.log(`    ${f.path.padEnd(40)} ${human(f.size).padStart(8)}`);
  console.log("");
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error("error:", e.message); process.exit(1); });
