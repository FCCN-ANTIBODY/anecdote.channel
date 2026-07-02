// Unit: the firmware-offer bridge — caught shell code faces the SAME pin gate as network updates. Two
// signatures, two meanings: the COURIER signs the offer (who handed it over); the AUTHOR signs the manifest
// (whose firmware it is); the pin decides on the AUTHOR. Run: node composer/firmware-offer.test.mjs
import { generateIdentity } from "./sign.mjs";
import { buildManifest, signManifest } from "./firmware.mjs";
import { packFirmwareOffer, verifyFirmwareOffer, offerDecision, KIND } from "./firmware-offer.mjs";
import { fountainTransfer, carrierSession } from "./carrier.mjs";
import { packTransfer } from "./transfer.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const te = new TextEncoder();

const author = await generateIdentity();     // the project key — what gets pinned
const courier = await generateIdentity();    // whoever carried it across the room
const impostor = await generateIdentity();

const FILES = [
  { path: "/index.html", bytes: te.encode("<!doctype html><title>v2</title>"), type: "text/html" },
  { path: "/composer/sign.mjs", bytes: te.encode("export const v = 2;"), type: "text/javascript" },
];
const manifest = await signManifest(await buildManifest(FILES, { version: 2 }), author);

// 1. pack refuses a partial offer; a full one round-trips with bytes intact.
{
  let threw = false;
  try { await packFirmwareOffer(manifest, FILES.slice(0, 1), courier); } catch { threw = true; }
  ok(threw, "an offer missing manifest files is refused at PACK time");
  const offer = await packFirmwareOffer(manifest, FILES, courier);
  ok(offer.kind === KIND, "the offer is a firmware-kind transfer");
  const v = await verifyFirmwareOffer(offer, { friends: [courier.fingerprint] });
  ok(v.ok && v.courier === courier.fingerprint && v.courierTrusted, "the courier envelope verifies and is trusted");
  ok(v.files.length === 2 && new TextDecoder().decode(v.readFile("/index.html")) === "<!doctype html><title>v2</title>", "offered bytes decode intact");
}

// 2. the pin decides on the AUTHOR: first contact pins; roll-forward accepts; foreign/downgrade refuse.
{
  const offer = await verifyFirmwareOffer(await packFirmwareOffer(manifest, FILES, courier));
  const first = await offerDecision(offer, null, 0);
  ok(first.accept && first.firstContact && first.by === author.fingerprint, "no pin yet → accept + first contact (pins the AUTHOR)");
  const forward = await offerDecision(offer, author.fingerprint, 1);
  ok(forward.accept && !forward.firstContact && forward.files.ok, "pinned author, v2 > held v1 → same-key roll-forward, files verified");
  const downgrade = await offerDecision(offer, author.fingerprint, 2);
  ok(!downgrade.accept && /roll-forward/.test(downgrade.reason), "v2 ≤ held v2 → refused (rollback guard)");
  const foreign = await offerDecision(offer, impostor.fingerprint, 1);
  ok(!foreign.accept && /pinned day-one/.test(foreign.reason), "signer ≠ pinned day-one key → refused (possession guarantee)");
}

// 3. two signatures, two meanings: a STRANGER couriering pinned-author firmware adopts; a FRIEND couriering
// foreign-authored firmware is refused. The door doesn't confer privilege; the pin does.
{
  const strangerCarried = await verifyFirmwareOffer(await packFirmwareOffer(manifest, FILES, impostor), { friends: [] });
  const d1 = await offerDecision(strangerCarried, author.fingerprint, 1);
  ok(!strangerCarried.courierTrusted && d1.accept, "an untrusted courier carrying the PINNED author's update still adopts");
  const foreignManifest = await signManifest(await buildManifest(FILES, { version: 9 }), impostor);
  const friendCarried = await verifyFirmwareOffer(await packFirmwareOffer(foreignManifest, FILES, courier), { friends: [courier.fingerprint] });
  const d2 = await offerDecision(friendCarried, author.fingerprint, 1);
  ok(friendCarried.courierTrusted && !d2.accept, "a trusted friend couriering FOREIGN-authored firmware is refused");
}

// 4. tampered bytes under a valid manifest: integrity refusal names the file.
{
  const bent = FILES.map((f) => ({ ...f, bytes: f.bytes.slice() }));
  bent[1].bytes[0] ^= 1;
  const offer = await verifyFirmwareOffer(await packFirmwareOffer(manifest, bent, courier));
  const d = await offerDecision(offer, author.fingerprint, 1);
  ok(!d.accept && /file integrity/.test(d.reason) && /sign\.mjs/.test(d.reason), "bent offered bytes → refused, the file named");
}

// 5. a non-offer transfer and a bent envelope are refused at the verify layer.
{
  const notOffer = await packTransfer("poll", "hi", courier);
  ok(!(await verifyFirmwareOffer(notOffer)).ok, "a non-firmware transfer is refused by kind");
  const offer = await packFirmwareOffer(manifest, FILES, courier);
  const bent = JSON.parse(JSON.stringify(offer));
  bent.bytes = bent.bytes.slice(0, -4) + (bent.bytes.slice(-4) === "AAA=" ? "BBB=" : "AAA=");
  ok(!(await verifyFirmwareOffer(bent)).ok, "a bent courier envelope is refused");
}

// 6. THE ARC: the offer crosses the carrier as droplets (20% loss) and the far end's pin gate adopts it.
{
  const offer = await packFirmwareOffer(manifest, FILES, courier);
  const ft = await fountainTransfer(offer, { blockSize: 256 });
  const session = carrierSession({ friends: [courier.fingerprint] });
  const lost = (s) => ((Math.imul(s + 1, 2654435761) >>> 0) % 100) < 20;
  let snap = null, seed = 0;
  while ((!snap || !snap.complete) && seed < ft.K * 8 + 60) { const sd = seed++; if (lost(sd)) continue; snap = await session.feed(ft.frame(sd)); }
  const r = await session.result();
  const caught = await verifyFirmwareOffer(r.transfers[0].signed, { friends: [courier.fingerprint] });
  const d = await offerDecision(caught, author.fingerprint, 1);
  ok(snap.complete && caught.ok && d.accept && d.version === 2,
     `firmware crossed the gravel (K=${ft.K}, 20% loss) and the pin gate says: ${d.reason} → v${d.version}`);
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall firmware-offer tests passed");
