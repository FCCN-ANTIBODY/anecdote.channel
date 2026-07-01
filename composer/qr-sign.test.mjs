// Unit: the QR provenance signature. The GOLD check is that the Tell's exact verifier — `ssh-keygen -Y
// verify -n tell-poll -I tell -f <accepted signers> -s <sig>` (what bin/authz runs) — ACCEPTS anecdote's
// signature, and that a minted signed QR verifies end-to-end the way bin/authz recomputes it (split on &,
// drop sig/kid/post, sort). If ssh-keygen isn't installed, the ssh cross-checks skip (structural checks
// still run). Run: node composer/qr-sign.test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateIdentity } from "./sign.mjs";
import { signCanon, sshFingerprint, allowedSignersLine } from "./qr-sign.mjs";
import { mintQR, qrCanon } from "./qr-mint.mjs";
import { buildPoll } from "../viewer/poll.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const haveSSH = spawnSync("ssh-keygen", ["-Q", "-t", "ed25519"], { stdio: "ignore" }).status !== null
             || spawnSync("bash", ["-c", "command -v ssh-keygen"], { stdio: "ignore" }).status === 0;

const id = await generateIdentity();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qrsig-"));
const write = (name, data) => { const p = path.join(tmp, name); fs.writeFileSync(p, data); return p; };

// verify a (message, armored-sig) against an accepted-signers file using the REAL ssh-keygen, as bin/authz.
function sshVerify(message, armored, principal = "tell", namespace = "tell-poll") {
  const signers = write("allowed_signers", allowedSignersLine(id, { principal }) + "\n");
  const sigfile = write("msg.sig", armored);
  const r = spawnSync("ssh-keygen", ["-Y", "verify", "-n", namespace, "-I", principal, "-f", signers, "-s", sigfile],
                      { input: message });
  return r.status === 0;
}

// 1. structural: kid is an SSH SHA256 fingerprint; the armored blob is a well-formed SSHSIG PEM.
{
  const { armored, kid, sig } = await signCanon("pile=p\npoll=q\nround=1\ntok=t", id);
  ok(/^SHA256:[A-Za-z0-9+/]{43}$/.test(kid), "kid is an unpadded SHA256 SSH fingerprint");
  ok(armored.startsWith("-----BEGIN SSH SIGNATURE-----\n") && armored.trimEnd().endsWith("-----END SSH SIGNATURE-----"),
     "armored output is a BEGIN/END SSH SIGNATURE PEM");
  ok(Buffer.from(sig, "base64").toString("utf8") === armored, "sig is base64 of the armored PEM (bin/qr's -w0 form)");
}

// 2. GOLD: ssh-keygen -Y verify accepts anecdote's signature over the exact message (canon + newline).
if (haveSSH) {
  const canon = "guidance=Pick%20one.\npile=cd04-q1\npoll=budget\nround=1\ntok=abc123\ntype=multichoice";
  const { armored } = await signCanon(canon, id);
  ok(sshVerify(canon + "\n", armored), "ssh-keygen -Y verify ACCEPTS the signature (the Tell's exact check)");
  ok(!sshVerify("tampered=1\n" + canon + "\n", armored), "a tampered message is REJECTED");

  // the kid matches ssh-keygen -lf on the same public key
  const pub = write("id.pub", "ssh-ed25519 " + allowedSignersLine(id).split(" ")[2] + " anecdote\n");
  const fp = execFileSync("ssh-keygen", ["-lf", pub], { encoding: "utf8" }).split(/\s+/)[1];
  ok(fp === (await sshFingerprint(id)), "kid === ssh-keygen -lf fingerprint");
} else {
  console.log("  skip: ssh-keygen cross-checks (ssh-keygen not installed)");
}

// 3. END-TO-END: a minted SIGNED QR verifies the way bin/authz recomputes it (from the URL query).
{
  const poll = buildPoll({ pile: "cd04-q1", poll: "budget", type: "multichoice", text: "Cut or keep?",
    options: ["Cut", "Keep"], guidance: "One of the listed options." });
  const r = await mintQR(poll, { secret: "s3cret", sign: { identity: id } });
  ok(r.url.includes("&sig=") && r.url.includes("&kid=") && r.sig && r.kid, "a signed mint appends sig + kid to the QR");

  // recompute canon from the QR query exactly like bin/authz: split on &, drop sig/kid/post, sort, join \n.
  const query = r.url.split("?")[1];
  const recomputed = qrCanon(query.split("&"));
  ok(recomputed === r.canon, "canon recomputed from the emitted query equals the signed preimage");

  if (haveSSH) {
    const armored = Buffer.from(r.sig, "base64").toString("utf8");   // as authz does: base64 -d → armored
    ok(sshVerify(recomputed + "\n", armored), "the minted signed QR verifies end-to-end (mint → authz path)");
  }
  // unsigned mint carries no sig/kid
  const plain = await mintQR(poll, { secret: "s3cret" });
  ok(!plain.url.includes("sig=") && !plain.sig, "an unsigned mint carries no signature");
}

fs.rmSync(tmp, { recursive: true, force: true });
if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall qr-sign tests passed");
