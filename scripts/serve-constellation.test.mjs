// Unit: scripts/serve-constellation.mjs — which directory answers for which hostname. No port is bound.
// Run: node scripts/serve-constellation.test.mjs
import { rootFor } from "./serve-constellation.mjs";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const root = join(fileURLToPath(import.meta.url), "..", "..");
const group = mkdtempSync(join(os.tmpdir(), "constellation-"));
for (const d of ["journal.anecdote.channel", "judgement", "tell.anecdote.channel/floor"]) mkdirSync(join(group, d), { recursive: true });
const at = (h) => rootFor(h, { group, root });

try {
  ok(at("anecdote.localhost").root === root && !at("anecdote.localhost").floor, "the apex is this repo");
  ok(at("journal.anecdote.localhost").root === join(group, "journal.anecdote.channel"), "a neighbour is its sibling checkout");
  ok(at("nobody.anecdote.localhost") === null, "a neighbour with no checkout does not answer (it is provisioned, never floored)");
  ok(at("field-guide.library.anecdote.localhost").root.endsWith("press/fixtures/shelf/field-guide"), "a shelved fixture answers at its label");
  ok(at("judgement.library.anecdote.localhost").root === join(group, "judgement"), "the thawed group is shelved by label");
  ok(at("journal.library.anecdote.localhost").root === join(group, "journal.anecdote.channel"), "…under either spelling of its directory");
  const miss = at("anything-you-type.library.anecdote.localhost");
  ok(miss.floor && miss.root.endsWith("press/floor"), "a miss on the rack is the floor, not a 404");
  ok(at("parks-2026.tell.anecdote.localhost").floor && at("parks-2026.tell.anecdote.localhost").root === join(group, "tell.anecdote.channel", "floor"), "*.tell is Tell's own floor when it is beside us");
  ok(at("a.b.library.anecdote.localhost") === null, "a wildcard covers exactly ONE label");
  ok(at("evil.example") === null && at("x.bottles.anecdote.localhost") === null, "foreign hosts, and `bottles` (a driver, not a shelf), do not answer");
  ok(at("UPPER_case.library.anecdote.localhost") === null, "an illegal label does not answer");
} finally { rmSync(group, { recursive: true, force: true }); }

if (fails) { console.error(`\n${fails} failed`); process.exit(1); }
console.log("\nserve-constellation: all passed");
