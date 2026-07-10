// Unit: seizing a downstream (seize.mjs) — docs/seize.md, phase 3. The signed origin-declaration (the
// seal), the client-side verify (verify-from-anyone; the pin is the trust decision), the lock's teeth
// (only the held key re-declares), and the BRANCH form: a seized repo carries .origin.json on a branch a
// real `git` reads back, and the declaration verifies from that clone. Run: node git-enough/seize.test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { generateIdentity } from "../composer/sign.mjs";
import { sealDeclaration, verifyDeclaration, supersedes, seizeRepo, ORIGIN_FILE } from "./seize.mjs";
import { looseFiles, refFiles } from "./repo.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const origin = await generateIdentity();     // the offline origin's HELD key (the device)
const other = await generateIdentity();      // some other party with write access
const T0 = "2026-07-10T00:00:00Z";

// 1. seal + verify: the declaration is signed and NAMES the fingerprint it is signed by (self-consistent).
{
  const decl = await sealDeclaration({ repo: "fccn/example", ref: "refs/heads/main", heldSince: T0 }, origin);
  const v = await verifyDeclaration(decl);
  ok(v.ok && v.by === origin.fingerprint, "a sealed declaration verifies to the held origin key");
  ok(decl.origin === origin.fingerprint && decl.held_since === T0, "it carries the origin fingerprint + held_since");
}

// 2. tamper / mis-naming is rejected — the lock as a signature, not a permission.
{
  const decl = await sealDeclaration({ repo: "fccn/example", heldSince: T0 }, origin);
  ok(!(await verifyDeclaration({ ...decl, repo: "fccn/kidnapped" })).ok, "editing the sealed repo breaks the signature");
  ok(!(await verifyDeclaration({ ...decl, origin: other.fingerprint })).ok, "naming an origin it is not signed by is refused");
}

// 3. the pin is the trust decision: a valid declaration by an UNPINNED origin is refused for action.
{
  const mine = await sealDeclaration({ repo: "fccn/example", heldSince: T0 }, origin);
  const theirs = await sealDeclaration({ repo: "fccn/example", heldSince: T0 }, other);
  ok((await verifyDeclaration(theirs)).ok, "a stranger's declaration is internally valid (verify-from-anyone)");
  ok(!(await verifyDeclaration(theirs, { pin: origin.fingerprint })).ok, "...but is refused against the pinned origin (trust decides action)");
  ok((await verifyDeclaration(mine, { pin: origin.fingerprint })).ok, "the pinned origin's own declaration is accepted");
}

// 4. the lock's teeth: only the HELD key re-declares. A different key cannot re-seize.
{
  const prev = await sealDeclaration({ repo: "fccn/example", ref: "refs/heads/main", heldSince: T0 }, origin);
  const reseat = await sealDeclaration({ repo: "fccn/example", ref: "refs/heads/main", heldSince: "2026-08-01T00:00:00Z" }, origin);
  const hostile = await sealDeclaration({ repo: "fccn/example", heldSince: "2026-08-01T00:00:00Z" }, other);
  ok(await supersedes(prev, reseat), "a re-declaration by the SAME origin supersedes (reversible re-seize from the device)");
  ok(!(await supersedes(prev, hostile)), "a re-declaration by a DIFFERENT key does NOT supersede — the config switch is device-only");
}

// 5. the BRANCH form: a seized repo carries .origin.json on a branch a real git reads, and it verifies.
{
  const decl = await sealDeclaration({ repo: "fccn/example", ref: "refs/heads/origin-held", heldSince: T0 }, origin);
  const author = { name: "Origin", email: "origin@device", epoch: 1700000000, tz: "+0000" };
  const { r, ref } = await seizeRepo({ declaration: decl, files: [{ path: "README.md", content: "held since T0\n" }], author });
  ok(ref === "refs/heads/origin-held", "the seizure lands on a non-destructive branch, not main (reversible first form)");

  // materialize to a real .git and read the declaration back off the branch — the "clone" verification
  const dir = mkdtempSync(join(tmpdir(), "seize-"));
  execFileSync("git", ["init", "-q", dir]);
  const write = (rel, buf) => { const p = join(dir, ".git", rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, buf); };
  for (const f of await looseFiles(r)) write(f.path, Buffer.from(f.bytes));
  for (const f of refFiles(r)) write(f.path, f.text);
  ok(execFileSync("git", ["-C", dir, "fsck", "--strict"]) !== undefined, "a real git accepts the seized history");
  const back = execFileSync("git", ["-C", dir, "show", `origin-held:${ORIGIN_FILE}`]).toString();
  const readDecl = JSON.parse(back);
  const v = await verifyDeclaration(readDecl, { pin: origin.fingerprint });
  ok(v.ok && v.by === origin.fingerprint, "the declaration read from the branch (as a clone would) verifies to the pinned origin");
  ok(execFileSync("git", ["-C", dir, "branch"]).toString().includes("origin-held"), "the downstream carries the origin-held branch, main untouched — reverse = delete it");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall seize tests passed");
