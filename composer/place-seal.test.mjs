// Unit: place-seal (place-seal.mjs) — the presence-keyed live seal + the snapshot custody move. The oracle
// for the crypto is the same age battery age-seal.test.mjs verifies against the real `age` binary; here we
// prove the WIRING: a live payload opens ONLY with a fresh in-place beacon, a stale/foreign/absent beacon
// opens nothing, and a re-sealed snapshot is portable to its holder alone. Deterministic time throughout.
// Run: node composer/place-seal.test.mjs
import { mintAgeIdentity } from "./age-mint.mjs";
import { generateIdentity } from "./sign.mjs";
import {
  epochOf, deriveSeed, epochKeys, deriveEpoch, mintBeacon, verifyBeacon,
  sealLive, openLive, openWithSeed, toSnapshot, DEFAULT_WINDOW_MS,
} from "./place-seal.mjs";
import { decrypt } from "./age-seal.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const td = new TextDecoder();
const iso = (ms) => new Date(ms).toISOString();

const SECRET = "TELL_QR_SECRET-for-tests-only";
const PLACE = "boulder.watershed";
const W = DEFAULT_WINDOW_MS;

// A place operator identity (signs beacons) and a couple of would-be viewers.
const operator = await generateIdentity();

// 1. epochOf floors to the window; a whole window shares one epoch, the next tick rolls it.
{
  const base = 1_000_000 * W;                       // an exact epoch boundary
  ok(epochOf(iso(base), W) === 1_000_000, "epochOf floors a boundary to its integer epoch");
  ok(epochOf(iso(base + W - 1), W) === 1_000_000, "the whole window is one epoch");
  ok(epochOf(iso(base + W), W) === 1_000_001, "the next window is the next epoch");
}

// 2. the seed is DERIVED and deterministic, but only from the secret — and it round-trips to an age pair.
{
  const e = epochOf(iso(2_000_000 * W), W);
  const s1 = await deriveSeed(SECRET, PLACE, e);
  const s2 = await deriveSeed(SECRET, PLACE, e);
  ok(s1.length === 32 && s1.every((b, i) => b === s2[i]), "deriveSeed is deterministic, 32 bytes");
  const other = await deriveSeed("a-different-secret", PLACE, e);
  ok(!other.every((b, i) => b === s1[i]), "a different secret yields a different seed");
  const across = await deriveSeed(SECRET, "other.place", e);
  ok(!across.every((b, i) => b === s1[i]), "a different place yields a different seed (domain-separated)");
  const { identity, recipient } = await epochKeys(s1);
  ok(identity.startsWith("AGE-SECRET-KEY-1") && recipient.startsWith("age1"), "seed expands to a real age identity/recipient");
}

// 3. THE CORE: a live payload opens with a fresh beacon caught in-place, and NOT otherwise.
{
  const now = iso(3_000_000 * W + 5000);            // somewhere inside epoch 3,000,000
  const secretMsg = "the live atlas: who is proposing what, right now";
  const { file } = await sealLive(SECRET, PLACE, secretMsg, { at: now });
  const beacon = await mintBeacon(SECRET, PLACE, operator, { at: now });

  const opened = await openLive(beacon, file, { now });
  ok(td.decode(opened) === secretMsg, "a fresh in-place beacon opens the live payload");

  // a viewer WITHOUT the beacon holds only the ciphertext — their own age identity opens nothing.
  const stranger = await mintAgeIdentity();
  let noKey = false; try { await decrypt(stranger.identity, file); } catch { noKey = true; }
  ok(noKey, "a viewer with no beacon cannot open the live file with their own identity");
}

// 4. STALENESS: walk away, the epoch rotates, and the same beacon opens no NEW live payload.
{
  const t0 = iso(4_000_000 * W + 1000);
  const beacon = await mintBeacon(SECRET, PLACE, operator, { at: t0 });

  // much later (many epochs on), the place seals fresh live data; the old beacon is stale for it.
  const later = iso(4_000_050 * W + 1000);
  const { file } = await sealLive(SECRET, PLACE, "a later live frame", { at: later });
  let stale = false; try { await openLive(beacon, file, { now: later }); } catch (e) { stale = /stale/.test(e.message); }
  ok(stale, "a beacon from 50 epochs ago will not open a payload sealed now");

  // and the freshness report agrees, without throwing.
  const v = await verifyBeacon(beacon, { now: later });
  ok(v.ok && !v.fresh, "verifyBeacon: valid signature, but reported not-fresh");
}

// 5. GRACE: a payload sealed at a boundary still opens for a body one epoch behind (sealLive covers prev).
{
  const boundary = iso(5_000_001 * W);              // start of epoch 5,000,001
  const justBefore = iso(5_000_001 * W - 500);      // caught a beacon in epoch 5,000,000
  const beaconPrev = await mintBeacon(SECRET, PLACE, operator, { at: justBefore });
  const { file, epochs } = await sealLive(SECRET, PLACE, "straddle me", { at: boundary });
  ok(epochs.length === 2, "sealLive covers current + one grace epoch by default");
  const opened = await openLive(beaconPrev, file, { now: boundary });
  ok(td.decode(opened) === "straddle me", "a one-epoch-behind beacon still opens (grace)");
}

// 6. a DECOY beacon (right shape, wrong signer) is refused when the operator is pinned.
{
  const now = iso(6_000_000 * W + 100);
  const impostor = await generateIdentity();
  const decoy = await mintBeacon(SECRET, PLACE, impostor, { at: now });   // impostor knows nothing real, but suppose a leaked secret
  const { file } = await sealLive(SECRET, PLACE, "pinned-only", { at: now });
  let refused = false;
  try { await openLive(decoy, file, { now, placeKey: operator.fingerprint }); } catch (e) { refused = /pinned/.test(e.message); }
  ok(refused, "a beacon not signed by the pinned place key is refused");
  // without pinning, verify-from-anyone still opens it (the seed is real) — provenance is the caller's choice.
  const opened = await openLive(decoy, file, { now });
  ok(td.decode(opened) === "pinned-only", "unpinned, a well-formed beacon carrying a real seed still opens (verify-from-anyone)");
}

// 7. the live -> snapshot custody move: re-seal to yourself, carry it anywhere, and only you open it.
{
  const now = iso(7_000_000 * W + 100);
  const { file } = await sealLive(SECRET, PLACE, "carry this out of the shape", { at: now });
  const beacon = await mintBeacon(SECRET, PLACE, operator, { at: now });
  const live = await openLive(beacon, file, { now });

  const me = await mintAgeIdentity();
  const snap = await toSnapshot(live, me.recipient);
  ok(td.decode(await decrypt(me.identity, snap)) === "carry this out of the shape", "my snapshot opens with my identity, no beacon, anywhere");
  const someoneElse = await mintAgeIdentity();
  let nope = false; try { await decrypt(someoneElse.identity, snap); } catch { nope = true; }
  ok(nope, "a copy of my snapshot is useless to anyone else (sealed to me alone)");
}

// 8. openWithSeed is the low-level equivalent when you already hold the epoch seed directly.
{
  const now = iso(8_000_000 * W + 100);
  const { file } = await sealLive(SECRET, PLACE, "seed path", { at: now });
  const { seed } = await deriveEpoch(SECRET, PLACE, epochOf(now, W));
  ok(td.decode(await openWithSeed(seed, file)) === "seed path", "openWithSeed opens with a raw epoch seed");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall place-seal tests passed");
