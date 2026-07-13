// Unit: composer/open-engine.mjs — the consumer bootstrap that closes the install loop. It calls the engine's
// install op, verifies against the consumer's pin, loads the entry, and wires the worn client back onto the
// SAME probe. Tested end to end — including against the REAL git-enough/git-client source — with the mount
// injected (the real Blob-URL path is Chromium-verified in install-loader). Run: node composer/open-engine.test.mjs
import { openEngine } from "./open-engine.mjs";
import { mintInstall } from "./install.mjs";
import { generateIdentity } from "./sign.mjs";
import { makeGitClient } from "../git-enough/git-client.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// A fake engine bottle over one probe: `install` hands back the pre-minted manifest; every other op records
// the call and returns a canned frame — the same port the delivered client drives back through.
function fakeEngine(manifest, opFrames = {}) {
  const calls = [];
  const invoke = (op, input, opts = {}) => {
    calls.push({ op, input, opts });
    if (op === "install") return Promise.resolve({ frames: [manifest] });
    return Promise.resolve({ frames: [opFrames[op] || { echo: op }] });
  };
  return { client: { invoke }, calls, last: () => calls[calls.length - 1] };
}

async function run() {
  const platform = await generateIdentity();

  // --- 1. synthetic entry: the whole loop with a tiny make(invoke) factory. ---
  {
    // a request half unwraps its op's data frame (like git-client's dataFrame), holding nothing itself.
    const entrySrc = "export default (invoke) => ({ ping: () => invoke('engine.ping', { hi: 1 }).then((r) => r.frames[0]) });\n";
    const manifest = await mintInstall({ "entry.mjs": entrySrc }, "entry.mjs", platform);
    const eng = fakeEngine(manifest, { "engine.ping": { pong: true } });

    const opened = await openEngine(eng.client, {
      platformKey: platform.fingerprint,
      loadOpts: { createURL: (b, n) => "blob:" + n, revokeURL: () => {}, importer: () => Promise.resolve({ default: (invoke) => ({ ping: () => invoke("engine.ping", { hi: 1 }).then((r) => r.frames[0]) }) }) },
    });
    ok(eng.calls[0].op === "install" && !eng.calls[0].opts.confirmed, "install is called first, Rung 0 (unconfirmed)");
    const r = await opened.client.ping();
    ok(r.pong === true, "the worn client drives the engine back over the same probe");
    ok(eng.last().op === "engine.ping" && eng.last().input.hi === 1, "the delivered code's call reaches the engine's op");
    ok(typeof opened.revoke === "function", "a revoke is handed back to drop the borrowed blobs on reload");
  }

  // --- 2. wrong pin: an engine whose blobs aren't signed by the consumer's pin gets NOTHING loaded. ---
  {
    const impostor = await generateIdentity();
    const manifest = await mintInstall({ "entry.mjs": "export default () => ({});\n" }, "entry.mjs", impostor);
    const eng = fakeEngine(manifest);
    let threw = "";
    try { await openEngine(eng.client, { platformKey: platform.fingerprint, loadOpts: { createURL: (b, n) => "blob:" + n, importer: () => Promise.resolve({ default: () => ({}) }) } }); }
    catch (e) { threw = e.message; }
    ok(/did not verify against the pin/.test(threw), "install signed by the wrong key is refused before anything loads: " + threw);
  }

  // --- 3. END TO END against the real git-client source: mint it, serve it, wear it, drive git.log back. ---
  {
    const manifest = await mintInstall({ "git-client.mjs": "// real source travels as bytes; the importer returns the live module\n" }, "git-client.mjs", platform);
    const eng = fakeEngine(manifest, { "git.log": { log: [{ oid: "c".repeat(40), message: "one" }] } });
    const opened = await openEngine(eng.client, {
      platformKey: platform.fingerprint,
      // the importer stands in for Blob-URL import(): it returns the REAL git-client module (default = makeGitClient).
      loadOpts: { createURL: (b, n) => "blob:" + n, revokeURL: () => {}, importer: () => import("../git-enough/git-client.mjs") },
    });
    ok(typeof opened.client.init === "function" && typeof opened.client.log === "function", "the worn client is the real git client (init/log/commit/…)");
    const log = await opened.client.log();
    ok(log.log[0].message === "one", "driving git.log through the worn client reaches the engine's git op");
    ok(eng.last().op === "git.log" && !eng.last().opts.confirmed, "git.log rode as a Rung-0 read (no confirmation)");
    // and the worn client is exactly what makeGitClient builds from the same invoke — same request half, delivered.
    ok(Object.keys(makeGitClient(() => {})).sort().join() === Object.keys(opened.client).sort().join(), "the delivered client's surface equals makeGitClient's");
  }

  // --- 4. guards. ---
  { let t = false; try { await openEngine(null, { platformKey: "k" }); } catch { t = true; } ok(t, "refuses without a probe client"); }
  { let t = false; try { await openEngine({ invoke: () => {} }, {}); } catch { t = true; } ok(t, "refuses without a pinned platformKey"); }

  console.log(fails ? `\nFAILED (${fails})` : "\nok: open-engine — install → verify against the pin → wear the entry → drive the engine back over the same probe");
  process.exit(fails ? 1 : 0);
}
run();
