// Tests for STANDING GRANTS — the behavior-shaped cousin of the nonce (probe-line Edge 3, Rung 2).
// Dependency-free, deterministic (a fixed clock via opts.now). Run: node composer/grants.test.mjs
import { memoryStore } from "../reducer/store.mjs";
import { generateIdentity, attest } from "./sign.mjs";
import {
  mintGrant, listGrants, getGrant, liveGrants, grantLive, grantExpired,
  touchGrant, revokeGrant, verifyGrant, verifyGrantRevocation, forgetGrant,
  mintNonce, record as recordReceipt, GRANT, GRANT_RECORD, GRANT_REVOCATION,
} from "./consent.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const T0 = "2026-07-01T00:00:00Z";
const spec = { behavior: "git-enough:staging-beat", scope: { piles: ["history"] }, cadence: "on-change",
               basis: { shown: "Keep a running history of this session" } };

// 1. Minting a grant is a signed, live authorization with a random handle.
{
  const store = memoryStore();
  const id = await generateIdentity();
  const g = await mintGrant(store, spec, id, { now: T0 });
  ok(g.schema === GRANT_RECORD, "returns a grant record");
  ok(/^grant:[A-Za-z0-9_-]{22}$/.test(g.grant), "grant id is a url-safe random handle");
  ok(g.signed.schema === GRANT, "the nested, signed grant is a probe.grant/v1");
  ok(g.status === "live" && g.by === id.fingerprint, "starts live, bound to the pseudonymous granter");
  ok(g.signed.granted_at === T0, "granted_at uses the injected clock");
  const g2 = await mintGrant(store, spec, id, { now: T0 });
  ok(g.grant !== g2.grant, "two grants for the same behavior get distinct handles");
}

// 2. The grant verifies; tampering breaks it (content or key).
{
  const store = memoryStore();
  const id = await generateIdentity();
  const g = await mintGrant(store, spec, id, { now: T0 });
  ok((await verifyGrant(g)).ok, "a fresh grant verifies");

  const tampered = { ...g, signed: { ...g.signed, behavior: "git-enough:something-else" } };
  ok(!(await verifyGrant(tampered)).ok, "changing the signed behavior fails verification");

  const other = await generateIdentity();
  const swapped = { ...g, signed: { ...g.signed, sig: { ...g.signed.sig, by: other.fingerprint } } };
  ok(!(await verifyGrant(swapped)).ok, "swapping sig.by fails the fingerprint check");
}

// 3. Listing, fetching, and the live/expired predicates.
{
  const store = memoryStore();
  const id = await generateIdentity();
  const live = await mintGrant(store, spec, id, { now: T0 });
  const soon = await mintGrant(store, { ...spec, expiry: "2026-07-02T00:00:00Z" }, id, { now: T0 });

  ok((await listGrants(store)).length === 2, "listGrants returns the full ledger");
  ok((await getGrant(store, live.grant)).grant === live.grant, "getGrant fetches by id");

  ok(grantLive(soon, { now: T0 }), "unexpired grant is live before expiry");
  ok(grantExpired(soon, { now: "2026-07-03T00:00:00Z" }), "past its expiry it is expired");
  ok(!grantLive(soon, { now: "2026-07-03T00:00:00Z" }), "…and therefore not live");
  ok((await liveGrants(store, { now: "2026-07-03T00:00:00Z" })).length === 1,
     "liveGrants drops the expired one (only the no-expiry grant remains)");
}

// 4. touchGrant records activity without disturbing the signature.
{
  const store = memoryStore();
  const id = await generateIdentity();
  const g = await mintGrant(store, spec, id, { now: T0 });
  const t = await touchGrant(store, g.grant, { now: "2026-07-01T00:05:00Z" });
  ok(t.last_activity === "2026-07-01T00:05:00Z", "last_activity is stamped");
  ok((await verifyGrant(await getGrant(store, g.grant))).ok, "the signed grant still verifies after a touch");
}

// 5. Only the original granter may revoke; a revocation is signed and leaves a tombstone.
{
  const store = memoryStore();
  const id = await generateIdentity();
  const stranger = await generateIdentity();
  const g = await mintGrant(store, spec, id, { now: T0 });

  let threw = false;
  try { await revokeGrant(store, g.grant, stranger); } catch { threw = true; }
  ok(threw, "a different identity cannot revoke the grant");

  const rev = await revokeGrant(store, g.grant, id);
  ok(rev.schema === GRANT_REVOCATION && rev.grant === g.grant, "revocation names the grant it withdraws");
  ok(rev.sig.by === id.fingerprint, "the revocation is signed by the original granter");

  const after = await getGrant(store, g.grant);
  ok(after.status === "revoked" && after.revocation, "the record is a revoked tombstone, kept");
  ok(!grantLive(after, { now: T0 }), "a revoked grant is not live (so the runtime won't re-honor it)");
  ok((await liveGrants(store, { now: T0 })).length === 0, "revoked grants drop out of liveGrants");
}

// 6. A revocation forged by someone other than the granter is detectable.
{
  const store = memoryStore();
  const id = await generateIdentity();
  const forger = await generateIdentity();
  const g = await mintGrant(store, spec, id, { now: T0 });
  const forged = await attest({ schema: GRANT_REVOCATION, grant: g.grant, target: g.signed.sig.signature }, forger);
  const v = await verifyGrantRevocation(g, forged);
  ok(!v.ok, "a revocation signed by a non-granter fails verifyGrantRevocation");

  const real = await revokeGrant(store, g.grant, id);
  ok((await verifyGrantRevocation(g, real)).ok, "the genuine revocation verifies against the grant");
}

// 7. Grants and nonces are siblings, not colliding: they share the trove but not the same slots.
{
  const store = memoryStore();
  const id = await generateIdentity();
  await mintGrant(store, spec, id, { now: T0 });
  // a bare signed object standing in for a recorded anecdote (record() only needs sig + nonce)
  const nonce = mintNonce();
  await recordReceipt(store, { schema: "anecdote/v1", to: "t", label: "l", nonce,
                               sig: { alg: "ed25519", by: id.fingerprint, key: "k", signature: "s" } });
  const grants = await listGrants(store);
  ok(grants.length === 1 && grants[0].schema === GRANT_RECORD,
     "listGrants sees only grants, not the recorded receipt (separate store keys)");
}

// 8. forgetGrant hard-deletes.
{
  const store = memoryStore();
  const id = await generateIdentity();
  const g = await mintGrant(store, spec, id, { now: T0 });
  await forgetGrant(store, g.grant);
  ok((await getGrant(store, g.grant)) === null, "forgetGrant removes the record entirely");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall grant tests passed");
