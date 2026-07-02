// Unit: the portable pure bit of the gesture gate — DER→raw ECDSA conversion (WebAuthn ES256 assertions are
// DER; WebCrypto verify wants raw r||s). Validated end-to-end: sign with node:crypto (DER), convert, and
// confirm WebCrypto accepts it against the SPKI public key. The full WebAuthn enroll/assert/gate path is
// browser-only and is proven in probe-test/drive-gesture.mjs (Chromium virtual authenticator).
// Run: node composer/gesture.test.mjs
import { generateKeyPairSync, sign as nodeSign, createPublicKey } from "node:crypto";
import { derToRaw } from "./gesture.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// A P-256 keypair; node:crypto signs ECDSA as DER (what a WebAuthn assertion carries).
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const msg = new TextEncoder().encode("gesture-signed-data-abc");
const der = new Uint8Array(nodeSign("sha256", msg, { key: privateKey, dsaEncoding: "der" }));

// 1. derToRaw yields the 64-byte r||s WebCrypto expects, and WebCrypto verifies it.
{
  const raw = derToRaw(der);
  ok(raw.length === 64, "derToRaw produces a 64-byte r||s");
  const spki = new Uint8Array(publicKey.export({ type: "spki", format: "der" }));
  const key = await crypto.subtle.importKey("spki", spki, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const good = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, raw, msg);
  ok(good, "the converted signature verifies with WebCrypto (DER→raw is correct)");
  const bad = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, raw, new TextEncoder().encode("tampered"));
  ok(!bad, "a different message does not verify");
}

// 2. derToRaw left-pads short integers (a DER int with a stripped/short r or s still → 32 bytes each).
{
  // many random signatures to shake out short-integer (leading-zero) edge cases
  let allWellFormed = true;
  for (let i = 0; i < 30; i++) {
    const d = new Uint8Array(nodeSign("sha256", new TextEncoder().encode("m" + i), { key: privateKey, dsaEncoding: "der" }));
    if (derToRaw(d).length !== 64) allWellFormed = false;
  }
  ok(allWellFormed, "derToRaw is 64 bytes across many signatures (short-int padding holds)");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall gesture (derToRaw) tests passed");
