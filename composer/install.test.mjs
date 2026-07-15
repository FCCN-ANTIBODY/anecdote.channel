// Unit: composer/install.mjs — the signed install manifest a storage engine hands a consumer. Every blob is
// platform-signed and hash-bound; the consumer verifies against the pin before it would mount/import. A
// tampered blob, a wrong signer, or a missing entry all fail. Run: node composer/install.test.mjs
import { mintInstall, verifyInstall, INSTALL, BLOB } from "./install.mjs";
import { generateIdentity } from "./sign.mjs";
import { PLATFORM_KEY } from "./platform-key.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const dec = new TextDecoder();

async function run() {
  const platform = await generateIdentity();
  const files = {
    "git-client.mjs": "export const hello = 'git client';\n",
    "ops.mjs": "export const ops = ['init', 'commit'];\n",
  };

  // 1. mint a signed manifest naming one entry.
  const man = await mintInstall(files, "git-client.mjs", platform);
  ok(man.schema === INSTALL && man.entry === "git-client.mjs" && man.blobs.length === 2, "manifest names schema, entry, and both blobs");
  ok(man.blobs.every((b) => b.attestation.schema === BLOB), "each blob carries an anecdote.blob/v1 attestation");

  // 2. verify against the platform key → the exact bytes come back, keyed by name.
  let v = await verifyInstall(man, { platformKey: platform.fingerprint });
  ok(v.ok && v.entry === "git-client.mjs", "verifies under the pinned platform key");
  ok(dec.decode(v.files["git-client.mjs"]) === files["git-client.mjs"], "the entry bytes round-trip exactly");
  ok(dec.decode(v.files["ops.mjs"]) === files["ops.mjs"], "the sibling blob bytes round-trip exactly");

  // 3. wrong platform key → rejected (an impostor engine can't get its code loaded under the pin).
  const impostor = await generateIdentity();
  ok(!(await verifyInstall(man, { platformKey: impostor.fingerprint })).ok, "a manifest not signed by the pin is rejected");

  // 4. tampered bytes → rejected (the signed hash no longer matches).
  {
    const tampered = JSON.parse(JSON.stringify(man));
    tampered.blobs[0].bytes = Buffer.from("export const hello = 'evil';\n").toString("base64");
    v = await verifyInstall(tampered, { platformKey: platform.fingerprint });
    ok(!v.ok && /do not match the signed hash/.test(v.reason), "tampered blob bytes are rejected: " + v.reason);
  }

  // 5. renamed blob → rejected (name is bound into the signed attestation).
  {
    const renamed = JSON.parse(JSON.stringify(man));
    renamed.blobs[1].name = "ops-evil.mjs";
    ok(!(await verifyInstall(renamed, { platformKey: platform.fingerprint })).ok, "a renamed blob is rejected (name is signed)");
  }

  // 6. entry not among the blobs → rejected; and mint refuses an entry that isn't a file.
  {
    const noEntry = JSON.parse(JSON.stringify(man));
    noEntry.entry = "missing.mjs";
    ok(!(await verifyInstall(noEntry, { platformKey: platform.fingerprint })).ok, "a manifest whose entry isn't present is rejected");
    let threw = false;
    try { await mintInstall(files, "nope.mjs", platform); } catch { threw = true; }
    ok(threw, "mint refuses an entry that is not one of the files");
  }

  // 7. not-a-manifest → rejected before any crypto.
  ok((await verifyInstall({ schema: "nope" }, { platformKey: platform.fingerprint })).ok === false, "a non-manifest is rejected");

  // 8. platformKey defaults to the canonical PLATFORM_KEY (composer/platform-key.mjs) — the single source of
  // truth, an environment-sourced slot (ANECDOTE_PLATFORM_KEY, or null when the environment hasn't provided
  // it). Null → self-consistency (no signer enforced); a set value → enforced by default; an explicit
  // fingerprint always overrides.
  ok(PLATFORM_KEY === (process.env.ANECDOTE_PLATFORM_KEY || null), "the platform key is the environment-sourced slot (ANECDOTE_PLATFORM_KEY, or null)");
  if (PLATFORM_KEY === null) ok((await verifyInstall(man)).ok, "with no env pin, verifyInstall defaults to self-consistency only");
  ok(!(await verifyInstall(man, { platformKey: impostor.fingerprint })).ok, "an explicit fingerprint always overrides the default");

  console.log(fails ? `\nFAILED (${fails})` : "\nok: install — signed client blobs, verified against the pin before they could ever run");
  process.exit(fails ? 1 : 0);
}
run();
