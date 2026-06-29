// Tests for on-device anecdote signing. Dependency-free, deterministic (WebCrypto Ed25519).
//   node composer/sign.test.mjs
import { prepare } from "./route.mjs";
import { build } from "./anecdote.mjs";
import { generateIdentity, fingerprint, sign, verifySignature, canonicalize, exportPublic, importPublic, SIG_ALG } from "./sign.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const cache = { atlases: [{ id: "foco", kind: "atlas", url: "https://foco.example", excludes: ["sex"] }] };
const agent = { instrument: "minilm:sha256:deadbeef", constitution: "anecdote:sha256:cafe" };

async function freshSigned(opts = {}) {
  const geo = JSON.stringify({ type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] });
  const routed = prepare("The park needs more shade", cache.atlases[0], cache);
  const a = await build(routed, [{ mediaType: "application/geo+json", bytes: geo, source: "drawn by me", pile: "refs://mine" }]);
  const id = await generateIdentity();
  const signed = await sign(a, id, { agent, nonce: "nonce-123", ...opts });
  return { a, id, signed };
}

// 1. Identity: a fingerprint is a content-addressed key id.
{
  const id = await generateIdentity();
  ok(/^key:sha256:[0-9a-f]{64}$/.test(id.fingerprint), "identity fingerprint is key:sha256:<hex>");
  ok(id.raw.length === 32, "Ed25519 public key is 32 bytes");
  const id2 = await generateIdentity();
  ok(id.fingerprint !== id2.fingerprint, "distinct identities have distinct fingerprints");
}

// 2. A signed anecdote carries agent + nonce + sig, and verifies.
{
  const { signed } = await freshSigned();
  ok(signed.sig && signed.sig.alg === SIG_ALG, "signed anecdote carries an ed25519 sig");
  ok(signed.agent && signed.agent.instrument === agent.instrument, "the Mobile LLM co-signature (pinned instrument) is present");
  ok(signed.nonce === "nonce-123", "the revocable nonce is carried");
  const v = await verifySignature(signed);
  ok(v.ok && v.by === signed.sig.by, "a freshly signed anecdote verifies, reporting who signed");
}

// 3. Tamper detection — the signature covers the WHOLE envelope.
{
  // (a) the statement
  const { signed } = await freshSigned();
  const t1 = JSON.parse(JSON.stringify(signed)); t1.body[0].text = "something else";
  ok(!(await verifySignature(t1)).ok, "tampering with the statement breaks the signature");

  // (b) a receipt — "signed to say you have it" really covers the receipts
  const { signed: s2 } = await freshSigned();
  const t2 = JSON.parse(JSON.stringify(s2)); t2.body[1].hash = "sha256:" + "0".repeat(64); t2.body[1].receipt.hash = t2.body[1].hash;
  ok(!(await verifySignature(t2)).ok, "tampering with an attachment's receipt breaks the signature");

  // (c) the agent block — the co-signature is bound, not decorative
  const { signed: s3 } = await freshSigned();
  const t3 = JSON.parse(JSON.stringify(s3)); t3.agent.instrument = "minilm:sha256:00000000";
  ok(!(await verifySignature(t3)).ok, "swapping the co-signing instrument breaks the signature");

  // (d) the nonce
  const { signed: s4 } = await freshSigned();
  const t4 = JSON.parse(JSON.stringify(s4)); t4.nonce = "nonce-999";
  ok(!(await verifySignature(t4)).ok, "swapping the revocable nonce breaks the signature");
}

// 4. Key substitution fails: re-pointing sig.key/by to another identity (without re-signing) is caught.
{
  const { signed } = await freshSigned();
  const other = await generateIdentity();
  const forged = JSON.parse(JSON.stringify(signed));
  forged.sig.key = exportPublic(other); forged.sig.by = other.fingerprint; // keep original signature
  const v = await verifySignature(forged);
  ok(!v.ok, "substituting the public key (keeping the old signature) fails verification");
}

// 5. Canonicalization is order-independent (so the same logical anecdote always signs identically).
{
  const x = canonicalize({ b: 1, a: [3, { y: 2, x: 1 }], c: null });
  const y = canonicalize({ c: null, a: [3, { x: 1, y: 2 }], b: 1 });
  ok(x === y, "canonicalize is independent of key insertion order");
  ok(x === '{"a":[3,{"x":1,"y":2}],"b":1,"c":null}', "canonical form is sorted + minimal");
}

// 6. Public key export/import round-trips for verification.
{
  const { signed, id } = await freshSigned();
  const reimported = await importPublic(exportPublic(id));
  ok((await fingerprint(id.raw)) === id.fingerprint, "the exported key fingerprints back to the identity");
  ok(reimported && (await verifySignature(signed)).ok, "exported public key re-imports and the anecdote still verifies");
}

// 7. sign() refuses a malformed anecdote.
{
  const id = await generateIdentity();
  let threw = false;
  try { await sign({ schema: "anecdote/v1", to: { id: "x", kind: "atlas" }, label: "", body: [] }, id); } catch { threw = true; }
  ok(threw, "sign() refuses to sign an invalid anecdote");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
