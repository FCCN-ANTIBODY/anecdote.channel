// Tests for the revocable nonce + the local trove. Dependency-free, deterministic.
//   node composer/consent.test.mjs
import { memoryStore } from "../reducer/store.mjs";
import { prepare } from "./route.mjs";
import { build } from "./anecdote.mjs";
import { generateIdentity, sign, canonicalize } from "./sign.mjs";
import { mintNonce, film, record, list, get, revoke, verifyRevocation, forget, recordPlacements, RECEIPT, REVOCATION } from "./consent.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const cache = { atlases: [{ id: "foco", kind: "atlas", url: "https://foco.example", excludes: ["sale"] }] };
const agent = { instrument: "minilm:sha256:deadbeef", constitution: "anecdote:sha256:cafe" };

async function send(store, id, text = "The park needs more shade") {
  const routed = prepare(text, cache.atlases[0], cache);
  const a = await build(routed);
  const nonce = mintNonce();
  const signed = await sign(a, id, { agent, nonce });
  const receipt = await record(store, signed);
  return { signed, nonce, receipt };
}

// 1. The nonce is an unlinkable, random handle.
{
  ok(/^nonce:[A-Za-z0-9_-]{22}$/.test(mintNonce()), "mintNonce is a url-safe random handle");
  ok(mintNonce() !== mintNonce(), "two nonces differ (unlinkable)");
}

// 2. Sending records the whole thing in the trove — the exact bytes you transmitted.
{
  const store = memoryStore();
  const id = await generateIdentity();
  const { signed, nonce } = await send(store, id);
  const r = await get(store, nonce);
  ok(r && r.schema === RECEIPT, "the contribution is in the trove as a receipt");
  ok(r.status === "live", "it starts live — offered and earning");
  ok(r.film === canonicalize(signed), "the trove keeps the exact transmitted bytes (the reproducible QR)");
  ok(r.by === signed.sig.by, "the receipt is bound to the pseudonymous signer");
}

// 3. "The exact QR you saw, forever" — the film is a pure function of the signed bytes, so it survives
//    a store reload and re-derives identically (no pixels needed).
{
  const store = memoryStore();
  const id = await generateIdentity();
  const { nonce } = await send(store, id);
  const r1 = await get(store, nonce);
  const reloaded = await get(store, nonce);          // re-read from the store
  ok(r1.film === reloaded.film, "the film is stable across reads");
  ok(film(reloaded.signed) === reloaded.film, "and re-derives exactly from the kept signed anecdote");
}

// 4. View what you've already said — the prominent surface.
{
  const store = memoryStore();
  const id = await generateIdentity();
  await send(store, id, "more bus routes");
  await send(store, id, "shade at the park");
  const all = await list(store);
  ok(all.length === 2, "list() returns everything you've said");
}

// 5. Revocation withdraws consent: a SIGNED instrument, and the local status flips.
{
  const store = memoryStore();
  const id = await generateIdentity();
  const { nonce } = await send(store, id);
  const rev = await revoke(store, nonce, id);
  ok(rev.schema === REVOCATION && rev.nonce === nonce, "revoke() yields a signed revocation for that nonce");
  ok((await get(store, nonce)).status === "revoked", "the trove marks the contribution revoked");
  const v = await verifyRevocation(await get(store, nonce), rev);
  ok(v.ok && v.by === id.fingerprint, "the revocation verifies and is by the original signer");
}

// 6. Only the original signer can revoke — your power over your data is yours alone.
{
  const store = memoryStore();
  const me = await generateIdentity();
  const someoneElse = await generateIdentity();
  const { nonce } = await send(store, me);
  let threw = false;
  try { await revoke(store, nonce, someoneElse); } catch { threw = true; }
  ok(threw, "a different identity cannot revoke your contribution");

  // even a hand-forged revocation by another key is rejected on verify (bound-by mismatch)
  const { attest } = await import("./sign.mjs");
  const forged = await attest({ schema: REVOCATION, nonce }, someoneElse);
  const v = await verifyRevocation(await get(store, nonce), forged);
  ok(!v.ok, "a revocation signed by the wrong key is rejected");
}

// 7. Keep vs forget: forgetting is a hard local delete, distinct from withdrawing consent.
{
  const store = memoryStore();
  const id = await generateIdentity();
  const { nonce } = await send(store, id);
  await forget(store, nonce);
  ok((await get(store, nonce)) === null, "forget() removes the local receipt entirely");
}

// 8. "Where your data is now and what it has earned" — the placements surface exists for the platform.
{
  const store = memoryStore();
  const id = await generateIdentity();
  const { nonce } = await send(store, id);
  const r = await recordPlacements(store, nonce, [{ dataset: "fort-collins/2026-q3", buyer: "City of Fort Collins", earned: "0.12 USD" }]);
  ok(r.placements.length === 1 && r.placements[0].earned === "0.12 USD", "placements/earnings can be attached to a receipt");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
