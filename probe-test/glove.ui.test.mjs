// probe-test/glove.ui.test.mjs — THE PLATFORM PIN, ALIVE. Until now every committed test proved only the
// glove's safe default (no pin → nothing mounts); the live path — a real bottle on its real sub-sub-domain
// origin, boot-gated by a domain-anchored attestation, vending a platform-SIGNED install that a consumer
// verifies against its pin, mounts, and WEARS — had never run outside prose. This suite runs it, end to end,
// in real Chromium over real https, and proves the three refusals that make the pin a boundary:
//
//   git.bottles   — everything right: boot gate passes, install verifies, the worn client stands a
//                   pile-shaped repo up INSIDE the bottle (git.init — the King's Leap) and reads it back.
//   dent.bottles  — right key, TAMPERED blob bytes: verifyInstall refuses; nothing mounts.
//   moth.bottles  — right attestation, install signed by a FOREIGN key: verifyInstall refuses the pin.
//   rogue.bottles — a STOLEN attestation (minted for git.bottles): the boot gate refuses and the bottle
//                   never says READY — silence, exactly as specified.
//
// The platform identity is minted IN THE TEST ENVIRONMENT (composer/sign generateIdentity) and the bottles
// are provisioned the honest way: the inception module (git-enough/bottle-inception.mjs, a committed null
// slot) is stamped in the SERVED copy — the D1 environment-fills-the-slot pattern, emulated at the edge the
// way a provision step would do it. Run: node probe-test/glove.ui.test.mjs  (skips without Chromium / 443).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { findChromium, withPage } from "./harness.mjs";
import { generateIdentity } from "../composer/sign.mjs";
import { mintBottleAttestation } from "../composer/bottle-attest.mjs";
import { mintInstall } from "../composer/install.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const chromium = findChromium();
if (!chromium) {
  console.log("skip: no chromium in this environment (set CHROMIUM=/path/to/chromium to run)");
  process.exit(0);
}

// ---- provision the bottles, node-side (the publish step) ----------------------------------------

const platform = await generateIdentity();          // the environment's platform identity (D1)
const forger = await generateIdentity();            // somebody else entirely
const NOW = "2026-07-24T00:00:00.000Z";

// The engine's client: the REAL shipped entry, byte-for-byte from the repo.
const clientSource = readFileSync(join(root, "git-enough", "git-client.mjs"), "utf8");
const goodManifest = await mintInstall({ "git-client.mjs": clientSource }, "git-client.mjs", platform);
const foreignManifest = await mintInstall({ "git-client.mjs": clientSource }, "git-client.mjs", forger);

// Tamper AFTER signing: alter the first blob's bytes so hash and signature no longer cover them.
const tampered = JSON.parse(JSON.stringify(goodManifest));
tampered.blobs[0].bytes = Buffer.from(clientSource + "\n// dent\n", "utf8").toString("base64");

const attest = (host) => mintBottleAttestation(`https://${host}.anecdote.channel/`, platform, { now: NOW });
const inception = (att, manifest) =>
  `// stamped by the provision step (test environment) — the served copy of the committed null slot\n` +
  `export const INCEPTION = ${JSON.stringify({ attestation: att, platformKey: platform.fingerprint, manifest }, null, 1)};\n` +
  `export default INCEPTION;\n`;

// Every bottle origin serves the repo (the module graph) with a root page + its own stamped inception.
const BOOT_PAGE = `<!doctype html><meta charset="utf-8"><title>bottle</title>
<script type="module">import { bootBottle } from "/git-enough/bottle-boot.mjs"; bootBottle();</script>`;
const bottleOrigin = (att, manifest) => ({
  root,
  tree: { "index.html": BOOT_PAGE, "git-enough/bottle-inception.mjs": inception(att, manifest) },
});

const origins = {
  "git.bottles.anecdote.channel": bottleOrigin(await attest("git.bottles"), goodManifest),
  "dent.bottles.anecdote.channel": bottleOrigin(await attest("dent.bottles"), tampered),
  "moth.bottles.anecdote.channel": bottleOrigin(await attest("moth.bottles"), foreignManifest),
  "rogue.bottles.anecdote.channel": bottleOrigin(await attest("git.bottles"), goodManifest), // stolen anchor
  "anecdote.channel": { root, tree: {} },   // consumer fixture installed once the pin is known
};

// ---- the consumer, browser-side ------------------------------------------------------------------

const FIXTURE = `<!doctype html><meta charset="utf-8"><title>glove consumer</title>
<script type="module">
import { embedBottle } from "/composer/bottle-embed.mjs";
import { openEngine, openEngineByName } from "/composer/open-engine.mjs";
window.R = { stage: "boot" };
const PIN = ${JSON.stringify(platform.fingerprint)};
const embed = (url) => embedBottle(url);
const refusal = (e) => String(e && e.message || e);
try {
  // git.bottles — the canonical resolve-by-name front door, then DRIVE the worn client.
  window.R.stage = "good";
  const good = await openEngineByName("git", { embed, platformKey: PIN });
  const init = await good.client.init(
    [{ path: "pile.yml", content: 'id: "parks-2026"\\nscope: "riverbend"\\n' },
     { path: "CONSTITUTION.md", content: "# the pile's law\\n" }],
    { message: "pile-new: parks-2026 (via the glove)\\n" });
  const log = await good.client.log();
  const files = await good.client.files();
  window.R.good = {
    url: good.url, entry: good.verified.entry,
    init: !!(init && init.init), tip: init && init.tip, objects: init && init.objects,
    message: log && log.log && log.log[0] && log.log[0].message,
    files: files && files.files ? files.files.map((f) => f.path).sort() : null,
  };
  good.teardown(); good.revoke();

  // dent.bottles — tampered bytes must refuse before anything mounts.
  window.R.stage = "dent";
  const dent = await embed("https://dent.bottles.anecdote.channel/");
  try { await openEngine(dent.client, { platformKey: PIN }); window.R.dent = { opened: true }; }
  catch (e) { window.R.dent = { refused: refusal(e) }; }
  dent.teardown();

  // moth.bottles — a foreign signer must refuse against the pin.
  window.R.stage = "moth";
  const moth = await embed("https://moth.bottles.anecdote.channel/");
  try { await openEngine(moth.client, { platformKey: PIN }); window.R.moth = { opened: true }; }
  catch (e) { window.R.moth = { refused: refusal(e) }; }
  moth.teardown();

  // rogue.bottles — the boot gate refuses a stolen anchor, so the hello NEVER comes (failure-silent):
  // the embed must still be pending after a generous wait.
  window.R.stage = "rogue";
  const pending = embedBottle("https://rogue.bottles.anecdote.channel/");
  const raced = await Promise.race([pending.then(() => "hello"), new Promise((r) => setTimeout(() => r("silence"), 4000))]);
  window.R.rogue = { outcome: raced };

  window.R.stage = "done";
} catch (e) {
  window.R = { stage: "error", error: refusal(e), at: window.R.stage };
}
</script>`;

const ran = await withPage({ chromium, tls: true, origins }, async (page, { server }) => {
  origins["anecdote.channel"].tree["glove-ui.html"] = FIXTURE;
  await page.goto("https://anecdote.channel/glove-ui.html");
  const R = await page.waitFor("window.R && (window.R.stage === 'done' || window.R.stage === 'error') && window.R", { timeout: 60000 });
  if (R.stage === "error") { ok(false, `consumer failed at stage '${R.at}': ${R.error}`); return; }

  // The live pin: boot gate → signed install → verify → wear → drive.
  ok(R.good.url === "https://git.bottles.anecdote.channel/", "the adapter name resolved to its canonical bottle");
  ok(R.good.entry === "git-client.mjs", "the platform-signed install verified against the live pin");
  ok(R.good.init === true && /^[0-9a-f]{40}$/.test(R.good.tip),
     "the WORN client stood a repo up inside the bottle (git.init, a real King's Leap root)");
  ok(R.good.message === "pile-new: parks-2026 (via the glove)", "…and read its own commit back (git.log)");
  ok(Array.isArray(R.good.files) && R.good.files.join("|") === "CONSTITUTION.md|pile.yml",
     "…holding the pile-shaped file-set (git.files) — the hosted-repo gesture, through the glove");

  // The three refusals that make the pin a boundary.
  ok(R.dent.refused && R.dent.refused.includes("do not match the signed hash"),
     "tampered blob bytes refuse: " + R.dent.refused);
  ok(R.moth.refused && R.moth.refused.includes("not signed by the platform key"),
     "a foreign signer refuses against the pin: " + R.moth.refused);
  ok(R.rogue.outcome === "silence", "a stolen domain anchor never says READY — the boot gate offers nothing");

  // And the refused bottle SAYS why, to its own operator: the boot outcome is observable in-page.
  const boot = await page.eval("window.__BOTTLE_BOOT__.then((b) => ({ ok: b.ok, reason: b.reason || null }))",
                               { frame: "rogue.bottles" });
  ok(boot.ok === false && /domain anchor mismatch/.test(boot.reason || ""),
     "the rogue bottle's own boot records the refusal: " + boot.reason);

  ok(server.foreign.length === 0, "no request escaped to any host the test did not stand up"
     + (server.foreign.length ? " — leaked: " + JSON.stringify(server.foreign) : ""));
});

if (!ran) { console.log("skip: could not bind 443 for the tls transport (root/CAP_NET_BIND_SERVICE, or sysctl net.ipv4.ip_unprivileged_port_start=443)"); process.exit(0); }
if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall glove UI tests passed (the pin is live: signed install worn, three refusals held)");
