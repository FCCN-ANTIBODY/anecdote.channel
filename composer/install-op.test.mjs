// Unit: composer/install-op.mjs — the engine's `install` op hands back its pre-minted manifest verbatim, and
// the full grammar round-trips: mint (publish) → install op (serve) → verifyInstall (pin) → loadInstall
// (mount+import). The op holds no key and serves static bytes. Run: node composer/install-op.test.mjs
import { installOps } from "./install-op.mjs";
import { mintInstall, verifyInstall } from "./install.mjs";
import { loadInstall } from "./install-loader.mjs";
import { generateIdentity } from "./sign.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const dec = new TextDecoder();

async function run() {
  const platform = await generateIdentity();
  const files = { "client.mjs": "export default (ctx) => 'hi ' + ctx.who;\n", "ops.mjs": "export const x = 1;\n" };
  const manifest = await mintInstall(files, "client.mjs", platform); // the engine's publish step, done offline

  // the engine bottle wires the pre-minted manifest as data — no key present at runtime.
  const ops = installOps({ manifest });
  ok(typeof ops.install === "function" && Object.keys(ops).length === 1, "vends exactly one op: install");

  // serve it: the op emits the whole manifest through a fake api.emit.
  const frames = [];
  await ops.install({}, { emit: (f) => frames.push(f) });
  ok(frames.length === 1 && frames[0] === manifest, "install emits the pre-minted manifest verbatim");

  // the consumer takes what came over the wire and verifies it against ITS pin, then loads.
  const verified = await verifyInstall(frames[0], { platformKey: platform.fingerprint });
  ok(verified.ok && verified.entry === "client.mjs", "the served manifest verifies under the pinned platform key");

  const importer = (url) => Promise.resolve({ default: (ctx) => "hi " + ctx.who, __url: url });
  const loaded = await loadInstall(verified, { createURL: (b, n) => "blob:" + n, revokeURL: () => {}, importer });
  ok(loaded.module.default({ who: "engine" }) === "hi engine", "the served-then-verified entry loads and runs");
  ok(dec.decode(verified.files["ops.mjs"]) === files["ops.mjs"], "the sibling blob crossed intact");

  // wiring guards: a non-manifest is refused at compose time (fail loud at boot, not at a consumer).
  for (const bad of [undefined, {}, { schema: "install/v1" }, { schema: "anecdote.install/v1", entry: "x" }])
    { let threw = false; try { installOps({ manifest: bad }); } catch { threw = true; } ok(threw, "refuses a non-manifest at wiring: " + JSON.stringify(bad)); }

  console.log(fails ? `\nFAILED (${fails})` : "\nok: install-op — the engine serves its signed blobs static; the consumer verifies against its own pin, then wears them");
  process.exit(fails ? 1 : 0);
}
run();
