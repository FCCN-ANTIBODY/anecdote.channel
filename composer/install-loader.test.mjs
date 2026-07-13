// Unit: composer/install-loader.mjs — mount the verified client blobs and import the entry. The mount/import
// contract is exercised here with injected createURL/importer (the real Blob-URL import() is Chromium-
// verified); only a verified install may mount. Run: node composer/install-loader.test.mjs
import { mountInstall, loadInstall } from "./install-loader.mjs";
import { mintInstall, verifyInstall } from "./install.mjs";
import { generateIdentity } from "./sign.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const dec = new TextDecoder();

async function run() {
  const platform = await generateIdentity();
  const files = { "client.mjs": "export default (ctx) => 'hi ' + ctx.who;\n", "ops.mjs": "export const x = 1;\n" };
  const verified = await verifyInstall(await mintInstall(files, "client.mjs", platform), { platformKey: platform.fingerprint });
  ok(verified.ok, "precondition: the manifest verifies");

  // fake URL minting: url = "blob:" + name; track revocations.
  const revoked = [];
  const createURL = (bytes, name) => "blob:" + name + ":" + dec.decode(bytes).length;
  const revokeURL = (u) => revoked.push(u);

  // 1. mount: a url per file, entry points at the entry's url, revoke frees all.
  const mounted = mountInstall(verified, { createURL, revokeURL });
  ok(Object.keys(mounted.urls).length === 2 && mounted.urls["client.mjs"] && mounted.urls["ops.mjs"], "a url is minted for every blob");
  ok(mounted.entry === mounted.urls["client.mjs"], "entry resolves to the entry blob's url");
  mounted.revoke();
  ok(revoked.length === 2, "revoke frees every mounted url");

  // 2. mount refuses anything that isn't a verified install.
  { let threw = false; try { mountInstall({ ok: false }, { createURL }); } catch { threw = true; } ok(threw, "mount refuses an unverified install"); }

  // 3. loadInstall: imports the ENTRY url and hands back its live module + the sibling url map.
  const importer = (url) => {
    if (url === "blob:client.mjs:" + dec.decode(verified.files["client.mjs"]).length) return Promise.resolve({ default: (ctx) => "hi " + ctx.who });
    return Promise.reject(new Error("imported the wrong url: " + url));
  };
  const loaded = await loadInstall(verified, { createURL, revokeURL, importer });
  ok(typeof loaded.module.default === "function" && loaded.module.default({ who: "pile" }) === "hi pile", "loadInstall imports the entry and returns its live exports");
  ok(loaded.urls["ops.mjs"], "the sibling url map is handed back so the client can reach its own blobs");

  // 4. a throwing entry revokes the mounted urls before rethrowing (no leak on a bad entry).
  revoked.length = 0;
  let threw = false;
  try { await loadInstall(verified, { createURL, revokeURL, importer: () => Promise.reject(new Error("boom")) }); } catch { threw = true; }
  ok(threw && revoked.length === 2, "a failed import revokes the urls and rethrows");

  console.log(fails ? `\nFAILED (${fails})` : "\nok: install-loader — verified blobs mount as urls; the entry imports live; teardown revokes");
  process.exit(fails ? 1 : 0);
}
run();
