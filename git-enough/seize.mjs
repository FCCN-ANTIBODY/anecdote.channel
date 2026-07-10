// git-enough/seize.mjs — SEIZING A DOWNSTREAM (docs/seize.md; phase 3 of docs/actions-enough.md).
//
// A GitHub repo becomes a downstream client of the offline origin not by any GitHub setting but by
// CARRYING a signed origin-declaration — the seal-enough "held-since": "I am the origin of this repo,
// pinned to fingerprint X." Committing that declaration IS becoming ready; the push (send-pack) fast-
// forwards a branch to it. Verification is CLIENT-SIDE (here), never on GitHub, so GitHub stays dumb and
// never has to know the authority it cannot see. The lock is cryptographic trust, not a GitHub ACL:
// only the device-HELD origin key makes a valid (re-)declaration — a hostile push is detectable, not
// preventable, which is exactly the point (verify-from-anyone; trust decides action, not admission).
//
// Pure over composer/sign.mjs (the offline origin's Ed25519) + repo.mjs (the tree to push). Node + browser.

import { attest, verifyAttestation } from "../composer/sign.mjs";
import { repo } from "./repo.mjs";

export const ORIGIN_FILE = ".origin.json";
export const ORIGIN_SCHEMA = "anecdote.origin/v1";

// Seal a declaration with the origin's held key. `heldSince` is the T0 the sovereignty dates from.
export async function sealDeclaration({ repo: repoName, ref = "refs/heads/main", heldSince }, identity) {
  if (!repoName) throw new Error("seize: a declaration needs a repo");
  if (!heldSince) throw new Error("seize: a declaration needs a held_since (the date sovereignty starts)");
  return attest({ schema: ORIGIN_SCHEMA, repo: repoName, ref, held_since: heldSince, origin: identity.fingerprint }, identity);
}

// Verify a declaration: the signature holds AND it is signed by the very fingerprint it NAMES as origin
// (self-consistent — no naming an origin you are not). Then trust decides: if a `pin` is supplied, the
// declaration must be that pinned origin. Verify-from-anyone; the pin is the trust decision, not the gate.
export async function verifyDeclaration(decl, { pin } = {}) {
  if (!decl || decl.schema !== ORIGIN_SCHEMA) return { ok: false, reason: "not an origin declaration" };
  const v = await verifyAttestation(decl);
  if (!v.ok) return { ok: false, reason: "signature invalid" };
  if (decl.origin !== v.by) return { ok: false, reason: "names an origin it is not signed by" };
  if (pin && pin !== v.by) return { ok: false, reason: "not the pinned origin", by: v.by };
  return { ok: true, by: v.by };
}

// The lock's teeth: a re-declaration supersedes the current one ONLY if it is signed by the CURRENT
// origin (the pinned key) and is for the same repo. A new party cannot re-seize; only the held key can.
export async function supersedes(prev, next) {
  const vp = await verifyDeclaration(prev);
  if (!vp.ok) return false;
  const vn = await verifyDeclaration(next, { pin: vp.by });   // next must be signed by prev's origin
  return vn.ok && next.repo === prev.repo;
}

// Build the pushable seized tree: the signed declaration committed as .origin.json, plus any content,
// on a branch (default a non-destructive origin-held branch — the reversible first form). The push
// itself is send-pack.mjs/publish(); this makes the repo it pushes. `root:true` — a fresh lineage.
export async function seizeRepo({ declaration, files = [], author, ref = "refs/heads/origin-held",
  message = "seize: the offline origin claims this repo", root = true } = {}) {
  if (!declaration) throw new Error("seize: need a sealed declaration");
  if (!author) throw new Error("seize: a commit needs an author");
  const r = repo();
  const tree = [{ path: ORIGIN_FILE, content: JSON.stringify(declaration, null, 2) + "\n" }, ...files];
  const tip = await r.commitFiles(tree, { author, committer: author, message, ref, root });
  return { r, tip, ref };
}
