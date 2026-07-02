// Unit: bringing the gravel home — a system module exports a VERIFIED SIGNED copy of itself and rides the
// carrier. THE test: composer/fountain.mjs carried BY the fountain it implements, byte-identical at the far
// end. Nothing installs or executes — a caught module is seeable, not privileged.
// Run: node composer/module-share.test.mjs
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { generateIdentity } from "./sign.mjs";
import { moduleAddress, exportModule, verifyModule, isModuleTransfer, KIND } from "./module-share.mjs";
import { fountainTransfer, carrierSession } from "./carrier.mjs";
import { packTransfer } from "./transfer.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const diskFetcher = async (p) => readFile(path.join(ROOT, p.slice(1)), "utf8");

const me = await generateIdentity();
const stranger = await generateIdentity();

// 1. addressing: same module, one address; traversal games are nobody's module.
{
  ok(moduleAddress("composer/fountain.mjs") === "/composer/fountain.mjs", "a bare path roots itself");
  ok(moduleAddress("/composer/fountain.mjs") === "/composer/fountain.mjs", "a rooted path stays put");
  let threw = 0;
  for (const bad of ["../secrets", "/a//b.mjs", "/etc/passwd\0", ""]) { try { moduleAddress(bad); } catch { threw++; } }
  ok(threw === 4, "traversal / doubled-slash / control chars / empty are refused");
}

// 2. self-export round-trip: the module's own source, signed, verified, byte-identical.
{
  const exp = await exportModule("composer/fountain.mjs", me, { fetcher: diskFetcher });
  ok(isModuleTransfer(exp.signed), "the export is a module-kind transfer");
  const v = await verifyModule(exp.signed, { friends: [me.fingerprint] });
  const disk = await diskFetcher("/composer/fountain.mjs");
  ok(v.ok && v.trusted && v.by === me.fingerprint, "the caught module verifies and is trusted (friend list)");
  ok(v.path === "/composer/fountain.mjs", "the module's ADDRESS rides inside the signed bytes");
  ok(v.source === disk, "the source is byte-identical to the module on disk");
  ok(v.sourceHash === exp.sourceHash, "source hash agrees end to end");
  const vStranger = await verifyModule(exp.signed, { friends: [] });
  ok(vStranger.ok && !vStranger.trusted, "with no friends it still VERIFIES (from anyone) but is not trusted");
}

// 3. tampering: a bent source, a re-kinded envelope, a non-module payload — all refused with reasons.
{
  const exp = await exportModule("composer/fountain.mjs", me, { fetcher: diskFetcher });
  const bent = JSON.parse(JSON.stringify(exp.signed));
  bent.bytes = bent.bytes.slice(0, -8) + (bent.bytes.slice(-8) === "AAAAAAA=" ? "BBBBBBB=" : "AAAAAAA=");
  ok(!(await verifyModule(bent, { friends: [me.fingerprint] })).ok, "a bent payload fails verification (hash/signature)");
  const notModule = await packTransfer("poll", "just text", me);
  const vk = await verifyModule(notModule, { friends: [me.fingerprint] });
  ok(!vk.ok && /kind/.test(vk.errors[0]), "a non-module transfer is refused by kind");
  const badBody = await packTransfer(KIND, JSON.stringify({ schema: "nope", path: "/x.mjs", source: "s" }), me);
  ok(!(await verifyModule(badBody, { friends: [me.fingerprint] })).ok, "a module-kind envelope with a foreign payload schema is refused");
  const badPath = await packTransfer(KIND, JSON.stringify({ schema: "anecdote.module/v1", path: "../up", source: "s" }), me);
  ok(!(await verifyModule(badPath, { friends: [me.fingerprint] })).ok, "an envelope smuggling a traversal path is refused");
}

// 4. THE GRAVEL HOME: fountain.mjs carried BY the fountain — poured as droplets, caught, verified, exact.
{
  const exp = await exportModule("composer/fountain.mjs", me, { fetcher: diskFetcher });
  const ft = await fountainTransfer(exp.signed, { blockSize: 256 });
  const session = carrierSession({ friends: [me.fingerprint] });
  const lost = (s) => ((Math.imul(s + 1, 2654435761) >>> 0) % 100) < 20;
  let snap = null, seed = 0;
  while ((!snap || !snap.complete) && seed < ft.K * 8 + 60) { const sd = seed++; if (lost(sd)) continue; snap = await session.feed(ft.frame(sd)); }
  ok(snap && snap.complete, `the module crossed the carrier (K=${ft.K}, ${seed} seeds, 20% loss)`);
  const r = await session.result();
  const caught = r.transfers[0].signed;
  ok(isModuleTransfer(caught), "the far end recognizes a module transfer");
  const v = await verifyModule(caught, { friends: [me.fingerprint] });
  const disk = await diskFetcher("/composer/fountain.mjs");
  ok(v.ok && v.trusted && v.source === disk, "fountain.mjs, carried by the fountain, verifies TRUSTED and byte-identical");
  const vs = await verifyModule((await exportModule("composer/fountain.mjs", stranger, { fetcher: diskFetcher })).signed, { friends: [me.fingerprint] });
  ok(vs.ok && !vs.trusted, "the same module signed by a STRANGER verifies but does not ride the friend list");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall module-share tests passed");
