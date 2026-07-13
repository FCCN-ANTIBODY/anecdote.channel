// Unit: composer/bottle-attest.mjs — a bottle's API self-guards with a platform-key signature anchored to
// its own domain: "signed to run for that bottle or not at all." Valid only for its own host and only when
// signed by the platform key; a different host, a different signer, or a tampered anchor all fail.
// Run: node composer/bottle-attest.test.mjs
import { mintBottleAttestation, verifyBottleAttestation, bottleHost, BOTTLE_ATTEST } from "./bottle-attest.mjs";
import { bottleUrl } from "./bottle-uri.mjs";
import { generateIdentity } from "./sign.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

async function run() {
  const B = bottleUrl({ label: "cd04-q1", storage: "tell" });   // host anchor "cd04-q1.tell"
  const platform = await generateIdentity();

  // 0. the anchor is the bare host; a non-bottle target is refused.
  ok(bottleHost(B) === "cd04-q1.tell", "the domain anchor is the bare host");
  { let threw = false; try { bottleHost("https://example.com/"); } catch { threw = true; } ok(threw, "a non-bottle target has no anchor"); }

  // 1. mint binds the schema + host.
  const att = await mintBottleAttestation(B, platform, { now: "2026-01-01T00:00:00Z" });
  ok(att.schema === BOTTLE_ATTEST && att.bottle === "cd04-q1.tell" && att.since === "2026-01-01T00:00:00Z", "attestation binds schema, host, since");

  // 2. valid for its own domain + the platform key.
  let v = await verifyBottleAttestation(att, { host: "cd04-q1.tell", platformKey: platform.fingerprint });
  ok(v.ok && v.by === platform.fingerprint, "verifies for its own domain, signed by the platform key");

  // 3. DOMAIN ANCHOR — the same attestation does not validate on a different bottle ("or not at all").
  v = await verifyBottleAttestation(att, { host: "scratch7.bottles", platformKey: platform.fingerprint });
  ok(!v.ok && /domain anchor mismatch/.test(v.reason), "the same attestation does NOT validate on another bottle");

  // 4. PLATFORM KEY — an attestation not signed by the platform key is rejected (an impostor can't self-issue).
  const impostor = await generateIdentity();
  const fake = await mintBottleAttestation(B, impostor, { now: "2026-01-01T00:00:00Z" });
  v = await verifyBottleAttestation(fake, { host: "cd04-q1.tell", platformKey: platform.fingerprint });
  ok(!v.ok && /not the platform key/.test(v.reason), "an attestation signed by another key is rejected under the pin");

  // 5. TAMPER — flipping the anchor after signing breaks the signature.
  const tampered = { ...att, bottle: "scratch7.bottles" };
  v = await verifyBottleAttestation(tampered, { host: "scratch7.bottles", platformKey: platform.fingerprint });
  ok(!v.ok && v.reason === "bad signature", "a tampered anchor fails to verify");

  // 6. not-an-attestation → refused before any crypto.
  ok((await verifyBottleAttestation({ schema: "nope" }, { host: "cd04-q1.tell" })).ok === false, "a non-attestation is refused");

  // 7. mint refuses a non-bottle target.
  { let threw = false; try { await mintBottleAttestation("https://example.com/", platform); } catch { threw = true; } ok(threw, "a non-bottle target can't be attested"); }

  console.log(fails ? `\nFAILED (${fails})` : "\nok: bottle-attest — the API is signed to run for its own bottle, or not at all");
  process.exit(fails ? 1 : 0);
}
run();
