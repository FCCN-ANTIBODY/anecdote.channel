// composer/firmware-cli.mjs — the operator's ceremony: build + sign the shell's firmware.json (Node).
// The possession guarantee is the OPERATOR's to arm — with THEIR key. This tool hashes the shell files,
// builds an anecdote.firmware/v1 manifest, and signs it with a firmware key you hold (never committed).
// The SW (slice 1b) pins that signer at a holder's first contact and thereafter refuses any manifest not
// signed by the same key. When no firmware.json is deployed, pinning is simply dormant (the SW falls back
// to its static shell), so this is opt-in: run it, hold the key, commit firmware.json, and pinning is live.
//
// Usage:
//   node composer/firmware-cli.mjs --key firmware.key.jwk --version 1 --out firmware.json <path...>
//     --key      Ed25519 private key as JWK. Created if the file doesn't exist (KEEP IT SAFE, don't commit).
//     --version  monotonic; the SW refuses a manifest whose version ≤ the one held (no downgrade).
//     --out      where to write the signed manifest (default: firmware.json at repo root).
//     <path...>  the shell files to pin, repo-relative (e.g. /poll.html /composer/poll-answer.mjs …).
//
// Paths in the manifest are the URL paths the SW serves (leading "/"); bytes are read from the repo root.

import fs from "node:fs";
import path from "node:path";
import { generateIdentity, fingerprint } from "./sign.mjs";
import { buildManifest, signManifest, verifyManifest } from "./firmware.mjs";

const REPO = path.resolve(new URL("..", import.meta.url).pathname);

function parseArgs(argv) {
  const o = { version: 1, out: "firmware.json", key: null, paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--key") o.key = argv[++i];
    else if (a === "--version") o.version = Number(argv[++i]);
    else if (a === "--out") o.out = argv[++i];
    else o.paths.push(a);
  }
  return o;
}

// Load an Ed25519 key from a JWK file, or generate + persist one (0600). Returns a sign.mjs identity.
async function loadOrGenKey(keyPath) {
  const subtle = globalThis.crypto.subtle;
  if (keyPath && fs.existsSync(keyPath)) {
    const jwk = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    const privateKey = await subtle.importKey("jwk", jwk, { name: "Ed25519" }, true, ["sign"]);
    const publicKey = await subtle.importKey("jwk", { kty: jwk.kty, crv: jwk.crv, x: jwk.x }, { name: "Ed25519" }, true, ["verify"]);
    const raw = new Uint8Array(await subtle.exportKey("raw", publicKey));
    return { privateKey, publicKey, raw, fingerprint: await fingerprint(raw) };
  }
  const id = await generateIdentity();
  if (keyPath) {
    fs.writeFileSync(keyPath, JSON.stringify(await subtle.exportKey("jwk", id.privateKey)), { mode: 0o600 });
    process.stderr.write(`firmware: generated a new firmware key at ${keyPath} — KEEP IT SAFE, do not commit it\n`);
  }
  return id;
}

export async function main(argv) {
  const o = parseArgs(argv);
  if (!o.paths.length) { process.stderr.write("firmware-cli: give the shell paths to pin (repo-relative)\n"); process.exit(2); }
  const identity = await loadOrGenKey(o.key);
  const files = o.paths.map((p) => {
    const rel = p.replace(/^\//, "");
    return { path: p.startsWith("/") ? p : "/" + p, bytes: fs.readFileSync(path.join(REPO, rel)) };
  });
  const manifest = await buildManifest(files, { version: o.version, created_at: 0 });
  const signed = await signManifest(manifest, identity);
  const check = await verifyManifest(signed);
  if (!check.ok) { process.stderr.write("firmware-cli: self-verify failed: " + check.errors.join("; ") + "\n"); process.exit(1); }
  fs.writeFileSync(path.resolve(REPO, o.out), JSON.stringify(signed, null, 2) + "\n");
  process.stderr.write(`firmware: wrote ${o.out} — v${signed.version}, ${signed.files.length} files, signer ${check.by}\n`);
  return signed;
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
