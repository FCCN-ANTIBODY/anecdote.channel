// Unit: firmware pinning — build/sign/verify a shell manifest, the trust-on-first-contact decision (pin
// the day-one signer; refuse a foreign signer; refuse a rollback), and file-integrity. Run:
// node composer/firmware.test.mjs
import { generateIdentity } from "./sign.mjs";
import { buildManifest, signManifest, verifyManifest, pinDecision, verifyFiles, FIRMWARE } from "./firmware.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const enc = (s) => new TextEncoder().encode(s);

const A = await generateIdentity();   // the day-one signer
const B = await generateIdentity();   // a possessed server / impostor

const files = [
  { path: "/poll.html", bytes: enc("<poll/>") },
  { path: "/composer/poll-answer.mjs", bytes: enc("export const x=1") },
  { path: "/sw.js", bytes: enc("self.addEventListener") },
];

// 1. buildManifest — deterministic, sorted, content-hashed.
{
  const m = await buildManifest(files, { version: 1 });
  ok(m.schema === FIRMWARE && m.version === 1, "manifest carries schema + version");
  ok(m.files.map((f) => f.path).join(",") === "/composer/poll-answer.mjs,/poll.html,/sw.js", "files sorted by path");
  ok(m.files.every((f) => /^sha256:[0-9a-f]{64}$/.test(f.hash)), "each file content-hashed (sha256)");
  const m2 = await buildManifest([...files].reverse(), { version: 1 });
  ok(JSON.stringify(m.files) === JSON.stringify(m2.files), "manifest is deterministic regardless of input order");
}

// 2. sign + verify.
{
  const signed = await signManifest(await buildManifest(files, { version: 1 }), A);
  const v = await verifyManifest(signed);
  ok(v.ok && v.by === A.fingerprint && v.version === 1, "a signed manifest verifies; by = signer fingerprint");
  ok(!(await verifyManifest({ schema: "nope" })).ok, "a non-firmware object is rejected");
}

// 3. TOFU: first contact pins; same-key roll-forward accepted; foreign signer refused.
{
  const v1 = await signManifest(await buildManifest(files, { version: 1 }), A);
  const first = await pinDecision(v1, null, 0);
  ok(first.accept && first.firstContact && first.by === A.fingerprint, "first contact → accept + pin the signer");

  const v2 = await signManifest(await buildManifest(files, { version: 2 }), A);
  const fwd = await pinDecision(v2, A.fingerprint, 1);
  ok(fwd.accept && !fwd.firstContact, "same-key, higher version → accept the roll-forward");

  const evil = await signManifest(await buildManifest(files, { version: 99 }), B);
  const refused = await pinDecision(evil, A.fingerprint, 1);
  ok(!refused.accept && /signer ≠ pinned/.test(refused.reason), "a DIFFERENT signer is REFUSED even at a higher version (the possession guarantee)");
}

// 4. rollback / replay guard: a validly-signed OLD version is refused once you hold a newer one.
{
  const v1 = await signManifest(await buildManifest(files, { version: 1 }), A);
  ok(!(await pinDecision(v1, A.fingerprint, 3)).accept, "same-key but version ≤ held → refused (no downgrade)");
  ok((await pinDecision(v1, A.fingerprint, 0)).accept, "same-key, version > held → accepted");
}

// 5. tamper: editing a file hash after signing breaks the signature → refused.
{
  const signed = await signManifest(await buildManifest(files, { version: 1 }), A);
  signed.files[0].hash = "sha256:" + "0".repeat(64);
  ok(!(await pinDecision(signed, null, 0)).accept, "a tampered manifest fails its signature and is refused (even at first contact)");
}

// 6. file integrity: the served bytes must match the manifest hashes.
{
  const signed = await signManifest(await buildManifest(files, { version: 1 }), A);
  const byPath = Object.fromEntries(files.map((f) => [f.path, f.bytes]));
  ok((await verifyFiles(signed, async (p) => byPath[p] || null)).ok, "verifyFiles passes when bytes match");
  const bad = await verifyFiles(signed, async (p) => (p === "/sw.js" ? enc("SWAPPED") : byPath[p] || null));
  ok(!bad.ok && bad.bad[0].path === "/sw.js", "verifyFiles catches swapped bytes under a valid signature");
  const missing = await verifyFiles(signed, async () => null);
  ok(!missing.ok && missing.bad.length === 3, "verifyFiles reports missing files");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall firmware tests passed");
