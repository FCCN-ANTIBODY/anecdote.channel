// Unit: age-seal (age-seal.mjs) — the age v1 encrypt/decrypt battery. The oracle is the REAL `age` binary
// when present (the strongest check: our ciphertext must open under `age -d`, and `age -r … -e` must open
// under ours); an always-on self round-trip covers environments without it. Run: node composer/age-seal.test.mjs
import { spawnSync } from "node:child_process";
import { mintAgeIdentity } from "./age-mint.mjs";
import { encrypt, decrypt } from "./age-seal.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const td = new TextDecoder();
const haveAge = spawnSync("age", ["--version"], { encoding: "utf8" }).status === 0
             && spawnSync("age-keygen", ["--version"], { encoding: "utf8" }).status === 0;

// A fresh device identity for every check (mintAgeIdentity is the on-device keygen).
const id = await mintAgeIdentity();

// 1. self round-trip across sizes, incl. empty and the >64KiB multi-chunk STREAM boundary.
for (const len of [0, 1, 100, 65535, 65536, 65537, 200000]) {
  const pt = Uint8Array.from({ length: len }, (_, i) => (i * 131 + 7) & 0xff);
  const file = await encrypt(id.recipient, pt);
  const back = await decrypt(id.identity, file);
  ok(back.length === len && back.every((b, i) => b === pt[i]), `self round-trip at ${len} bytes (STREAM chunking)`);
}

// 2. it produces a real age file: version line + an X25519 stanza + the MAC line.
{
  const file = await encrypt(id.recipient, "hello");
  const head = td.decode(file.subarray(0, 200));
  ok(head.startsWith("age-encryption.org/v1\n"), "header opens with the age v1 version line");
  ok(/\n-> X25519 \S+\n\S+\n--- \S+\n/.test(head), "an X25519 stanza + '--- <mac>' header terminator");
}

// 3. wrong identity cannot open; a tampered payload fails authentication.
{
  const other = await mintAgeIdentity();
  const file = await encrypt(id.recipient, "secret");
  let threw = false; try { await decrypt(other.identity, file); } catch { threw = true; }
  ok(threw, "a different identity cannot open the file (no stanza unwraps the file key)");
  const bad = Uint8Array.from(file); bad[bad.length - 1] ^= 1;
  let tamper = false; try { await decrypt(id.identity, bad); } catch { tamper = true; }
  ok(tamper, "flipping a payload byte fails chunk authentication");
}

// 4. multi-recipient: either identity opens it.
{
  const two = await mintAgeIdentity();
  const file = await encrypt([id.recipient, two.recipient], "shared");
  ok(td.decode(await decrypt(id.identity, file)) === "shared", "recipient A opens a two-recipient file");
  ok(td.decode(await decrypt(two.identity, file)) === "shared", "recipient B opens the same file");
}

// 5. LIVE interop with the real `age` binary, both directions — the true oracle.
if (haveAge) {
  const msg = "the offline origin encrypts, the real age decrypts\n";
  const fs = await import("node:fs"); const os = await import("node:os"); const path = await import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "age-seal-"));
  const idFile = path.join(dir, "id.txt"); fs.writeFileSync(idFile, id.identity + "\n");

  // ours -> real age -d
  {
    const file = await encrypt(id.recipient, msg);
    const cf = path.join(dir, "ours.age"); fs.writeFileSync(cf, file);
    const r = spawnSync("age", ["-d", "-i", idFile, cf], { encoding: "buffer", maxBuffer: 1 << 24 });
    ok(r.status === 0 && r.stdout.toString() === msg, "real `age -d` decrypts what age-seal encrypted");
  }
  // real age -e -> ours
  {
    const r = spawnSync("age", ["-e", "-r", id.recipient, "-o", "-"], { input: Buffer.from(msg), encoding: "buffer", maxBuffer: 1 << 24 });
    ok(r.status === 0, "real `age -e` produced a file");
    const back = await decrypt(id.identity, new Uint8Array(r.stdout));
    ok(td.decode(back) === msg, "age-seal decrypts what real `age -e` encrypted");
  }
  fs.rmSync(dir, { recursive: true, force: true });
} else {
  console.log("  (skip: `age` not on PATH — live interop skipped; self round-trip + format checks covered it)");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall age-seal tests passed");
