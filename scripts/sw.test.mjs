// scripts/sw.test.mjs — the service worker's PROSE INVARIANTS, made executable.
//
// sw.js carries three rules in comments that nothing enforced. Each has a failure mode that is silent
// on the machine that introduces it and total on somebody else's phone a month later, which is the
// worst shape a bug can have here:
//
//   1. "BUMP THIS whenever FALLBACK_SHELL changes" (sw.js). activate() only deletes caches whose key
//      DIFFERS from VERSION, and handle() is strict cache-first over the shell — so editing the list
//      without bumping the key strands every existing install on the old copy, and no edge purge
//      reaches them because the request never leaves the browser. Enforced here by pinning a digest of
//      the list: change the list, the digest moves, and this test demands the bump in the same commit.
//   2. Every shell path must EXIST. A typo'd entry cannot be fetched, so it is simply absent from the
//      offline shell — precache counts it and warns to a console nobody is reading.
//   3. destruct.html must stay OUT of the shell and shell.html must stay IN it. That split is the
//      whole verb distinction: looking has to work with the origin dead, destroying must not.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sw = readFileSync(join(ROOT, "sw.js"), "utf8");

// ---- parse, rather than import: sw.js is a worker module and touches self/caches at load ----------
const version = sw.match(/const SHELL_VERSION = "([^"]+)"/)?.[1];
assert.ok(version, "sw.js: could not find SHELL_VERSION");
assert.match(version, /^v\d+$/, "sw.js: SHELL_VERSION is not shaped v<n>");

const listSrc = sw.match(/const FALLBACK_SHELL = \[([\s\S]*?)\n\];/)?.[1];
assert.ok(listSrc, "sw.js: could not find FALLBACK_SHELL");
const shell = [...listSrc.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
assert.ok(shell.length > 10, `sw.js: FALLBACK_SHELL parsed as only ${shell.length} entries — the parse is wrong`);

// ---- 1. the list and the cache key move together --------------------------------------------------
//
// When this fails it is almost always correct to bump VERSION and paste the new digest here, in the
// same commit that changed the list. Updating the digest WITHOUT bumping VERSION is the one thing this
// test exists to stop, so do not do that quietly.
// The digests below are LITERALS on purpose. Computing the expected value from the same list the test
// just parsed would compare a number to itself and pass forever — which is exactly the kind of green
// check this file exists to prevent.
const PINNED = {
  "v8": "sha256:54149854117e1582ec14099267bca9353bf533bad0ead7156c222aefaf711654",
  "v9": "sha256:0920fd20b045aadc91c427a548c11b9aebc31f6c8cdcc58fb1f9cc513c6d90ef",   // + the press (/press/), its eager import closure, and the broadcast target
};
const EXPECTED_SHELL_DIGEST = "sha256:" + createHash("sha256").update(shell.join("\n")).digest("hex");
assert.ok(
  PINNED[version],
  `sw.js: SHELL_VERSION is ${version} but scripts/sw.test.mjs pins no digest for it — add one when you bump.`,
);
assert.equal(
  EXPECTED_SHELL_DIGEST,
  PINNED[version],
  `FALLBACK_SHELL changed without a SHELL_VERSION bump. The generation label is what the control\n` +
  `page shows and what makes a list change a recorded act. Bump SHELL_VERSION in sw.js and pin the\n` +
  `new digest here.`,
);

// ---- 2. every shell path resolves to a real file ---------------------------------------------------
const onDisk = (p) => {
  const rel = p.replace(/^\//, "");
  if (p.endsWith("/")) return existsSync(join(ROOT, rel, "index.html"));
  return existsSync(join(ROOT, rel));
};
const absent = shell.filter((p) => !onDisk(p));
assert.deepEqual(
  absent,
  [],
  `FALLBACK_SHELL names ${absent.length} path(s) that do not exist. They cannot be precached, so the\n` +
  `offline shell is quietly incomplete:\n  ${absent.join("\n  ")}`,
);

// ---- 3. the verb split ------------------------------------------------------------------------------
assert.ok(
  shell.includes("/shell.html"),
  "/shell.html must be in FALLBACK_SHELL — the control page is what you need when the origin is gone.",
);
assert.ok(
  !shell.includes("/destruct.html"),
  "/destruct.html must NOT be in FALLBACK_SHELL — the hatch always comes from the network so you cannot\n" +
  "destroy your only copy while the origin is dead.",
);

// ---- the control page's wiring exists on both ends ---------------------------------------------------
for (const t of ["shell-status", "shell-refresh", "shell-promote", "shell-mode", "firmware-check"]) {
  assert.ok(sw.includes(`"${t}"`), `sw.js: no handler for the "${t}" message the control page sends`);
}
const page = readFileSync(join(ROOT, "shell.html"), "utf8");
for (const t of ["shell-status", "shell-refresh", "shell-promote", "shell-mode", "firmware-check"]) {
  assert.ok(page.includes(t), `shell.html: never sends "${t}"`);
}
// The refusal path is the one that must not be silent: a pinned shell declines a raw refetch, and the
// page has to render that reason rather than looking like nothing happened.
assert.ok(/mode: "refused"/.test(sw), "sw.js: shellRefresh must be able to refuse under a live pin");
assert.ok(/REFUSED/.test(page), "shell.html: a refusal must be rendered, not swallowed");

// ---- the two-slot decisions, as assertions ----------------------------------------------------------
//
// These are the conclusions of a long design conversation. Each is cheap to re-break by accident and
// expensive to notice, so each gets a line here.

// STILLNESS. A new worker waits for every tab to close rather than seizing control; the holder pulls it
// forward from /shell.html when they want it. skipWaiting() belongs only in that user-directed path.
// Comments are stripped first: the install handler explains in prose that it deliberately does NOT
// call skipWaiting, and a naive search would match that sentence and fail on the correct code.
const decomment = (s) => s.replace(/\/\/[^\n]*/g, "");
const install = decomment(sw.match(/addEventListener\("install"[\s\S]*?\}\)\(\)\)\);/)?.[0] ?? "");
assert.ok(install, "sw.js: could not find the install handler");
assert.ok(
  !/skipWaiting/.test(install),
  "sw.js: install() calls skipWaiting(). The worker is meant to sit still like firmware — a new one\n" +
  "waits until every tab closes, and /shell.html's take-waiting is the only way to hurry it.",
);
assert.ok(/take-waiting/.test(sw), "sw.js: no take-waiting handler — the holder has no way to pull a waiting worker forward");

// DELETION FOLLOWS A PROVEN FLOOR, NEVER ACTIVATION. The old worker deleted the previous shell on
// activate, so a network that died mid-install destroyed the only complete copy. Cache deletion now
// lives in retireLegacy() alone, behind a completeness check.
const activate = decomment(sw.match(/addEventListener\("activate"[\s\S]*?\}\)\(\)\)\);/)?.[0] ?? "");
assert.ok(activate, "sw.js: could not find the activate handler");
assert.ok(
  !/caches\.delete/.test(activate),
  "sw.js: activate() deletes a cache directly. That is the lockout bug: kill the network mid-install\n" +
  "and the previous floor is gone. Deletion belongs in retireLegacy(), behind a whole-floor check.",
);
assert.ok(
  /async function retireLegacy[\s\S]*?missingFrom\(held\)\)\.length\) return/.test(sw),
  "sw.js: retireLegacy() must refuse to delete while the floor is incomplete",
);

// PROMOTION IS A MERGE, so a partial rolling can never punch a hole in the floor.
assert.ok(/copyShell\(rolling, held, \{ overwrite: true \}\)/.test(sw), "sw.js: promote() must merge rolling into held");
assert.ok(/overwrite \? /.test(sw) || /!overwrite &&/.test(sw), "sw.js: copyShell must support gap-filling without overwrite");

// THE SWITCH IS ONE AXIS WITH THREE STOPS, and the page offers all three.
const modes = sw.match(/const MODES = \[([^\]]+)\]/)?.[1] ?? "";
assert.deepEqual(
  [...modes.matchAll(/"([^"]+)"/g)].map((m) => m[1]),
  ["free", "hold", "guard"],
  "sw.js: MODES must be exactly free, hold, guard — ordered least to most restrictive",
);
for (const m of ["free", "hold", "guard"]) {
  assert.ok(page.includes('id="m-' + m + '"'), `shell.html: no ${m} button on the switch`);
}

// AN UNREADABLE MODE MUST FAIL OPEN. A setting we cannot parse must not be able to lock anybody down.
assert.ok(
  /MODES\.includes\(m\) \? m : "free"/.test(sw),
  'sw.js: getMode() must fall back to "free" — an unrecognised mode must never be more restrictive',
);

console.log(`sw.test: ok — ${version}, ${shell.length} shell paths, all present`);
