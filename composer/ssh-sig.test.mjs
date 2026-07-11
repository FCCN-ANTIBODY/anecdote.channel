// Unit: ssh-sig (ssh-sig.mjs) — the SSHSIG battery. Oracle is the real `ssh-keygen` when present (our
// signature must pass `ssh-keygen -Y verify`, and `ssh-keygen -Y sign` output must pass ours; our
// fingerprint + public line must match `-lf` / `.pub`). Self checks always run. Run: node composer/ssh-sig.test.mjs
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateIdentity, sign, verify, fingerprint, publicKeyLine, rawFromPublic } from "./ssh-sig.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const haveSsh = spawnSync("ssh-keygen", ["--help"], { encoding: "utf8" }).stderr?.includes("-Y");
const NS = "data-pile-drop";
const MSG = "the offline origin signs its own provenance\n";

// 1. self: sign -> verify round-trips; namespace + signer pin are enforced.
{
  const id = await generateIdentity();
  const sig = await sign(MSG, { namespace: NS, privateKey: id.privateKey, rawPub: id.rawPub });
  const v = await verify(MSG, sig, { namespace: NS });
  ok(v.ok && v.by === id.fingerprint, "sign -> verify round-trips to the signer's fingerprint");
  ok((await verify("tampered\n", sig, { namespace: NS })).ok === false, "a changed message fails verification");
  ok((await verify(MSG, sig, { namespace: "other" })).ok === false, "a wrong namespace is refused");
  ok((await verify(MSG, sig, { rawPub: id.rawPub })).ok === true, "the pinned signer is accepted");
  const other = await generateIdentity();
  ok((await verify(MSG, sig, { rawPub: other.rawPub })).ok === false, "a different pinned signer is refused (trust decides)");
}

// 2. self: fingerprint + public line are internally consistent (rawFromPublic round-trips the blob).
{
  const id = await generateIdentity();
  ok(id.fingerprint.startsWith("SHA256:") && !id.fingerprint.includes("="), "fingerprint is SHA256: + unpadded base64");
  const line = publicKeyLine(id.rawPub, "device");
  ok(line.startsWith("ssh-ed25519 AAAA"), "public line is an ssh-ed25519 one-liner");
  ok(rawFromPublic(line).every((b, i) => b === id.rawPub[i]), "rawFromPublic recovers the 32-byte key from the line");
}

// 3-5. LIVE interop with the real ssh-keygen — the true oracle.
if (haveSsh) {
  const dir = mkdtempSync(join(tmpdir(), "sshsig-"));
  const msgFile = join(dir, "msg"); writeFileSync(msgFile, MSG);

  // 3. ours -> real `ssh-keygen -Y verify`
  {
    const id = await generateIdentity();
    const sig = await sign(MSG, { namespace: NS, privateKey: id.privateKey, rawPub: id.rawPub });
    const sigFile = join(dir, "ours.sig"); writeFileSync(sigFile, sig);
    const principal = "origin@device";
    writeFileSync(join(dir, "allowed"), `${principal} ${publicKeyLine(id.rawPub)}\n`);
    const r = spawnSync("ssh-keygen", ["-Y", "verify", "-f", join(dir, "allowed"), "-I", principal, "-n", NS, "-s", sigFile], { input: MSG, encoding: "utf8" });
    ok(r.status === 0, "real `ssh-keygen -Y verify` accepts an ssh-sig signature");
  }

  // 4. real `ssh-keygen -Y sign` -> ours; and 5. fingerprint / pub match the real tool
  {
    const key = join(dir, "id_ed25519");
    spawnSync("ssh-keygen", ["-t", "ed25519", "-N", "", "-C", "k", "-f", key], { encoding: "utf8" });
    const r = spawnSync("ssh-keygen", ["-Y", "sign", "-n", NS, "-f", key], { input: MSG, encoding: "utf8" });
    ok(r.status === 0 && r.stdout.includes("BEGIN SSH SIGNATURE"), "real `ssh-keygen -Y sign` produced an armored signature");
    const v = await verify(MSG, r.stdout, { namespace: NS });
    ok(v.ok, "ssh-sig verifies what real `ssh-keygen -Y sign` produced");

    const pub = readFileSync(key + ".pub", "utf8");
    const rawPub = rawFromPublic(pub);
    const theirFpr = spawnSync("ssh-keygen", ["-lf", key + ".pub"], { encoding: "utf8" }).stdout.split(/\s+/)[1];
    ok((await fingerprint(rawPub)) === theirFpr, "our fingerprint matches `ssh-keygen -lf`");
    ok(v.by === theirFpr, "the verified signer's fingerprint equals the real key's fingerprint");
  }
  rmSync(dir, { recursive: true, force: true });
} else {
  console.log("  (skip: `ssh-keygen -Y` not available — live interop skipped; self checks covered the format)");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall ssh-sig tests passed");
