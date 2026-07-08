// register-exchange: PR-consent as two signed halves over the transfer envelope (rework slice 4,
// civic-node#60). Proves the whole gesture end to end with real Ed25519 identities: OPEN → carrier
// (chunk/reassemble, i.e. QR-sized bricks) → read → MERGE → receipt back → the PAIR verifies —
// and that every dishonest variation (tamper, swapped receipt, wrong proposer, declined) fails
// loudly. Also the replay-to-mirror form: the YAML and branch the ordinary PR idiom expects.
import { generateIdentity } from "./sign.mjs";
import { chunk, reassemble } from "./transfer.mjs";
import {
  REGISTRIES, validateEntry, openRegistration, readRegistration, mergeRegistration,
  receiptEnvelope, openReceipt, verifyConsent, registryYaml, branchFor, registryPath, RECEIPT,
} from "./register-exchange.mjs";

let fails = 0;
function ok(c, m) { if (c) console.log("  ok: " + m); else { console.error("  FAIL: " + m); fails++; } }
const td = new TextDecoder();

const PROPOSER = await generateIdentity();
const ACCEPTOR = await generateIdentity();
const STRANGER = await generateIdentity();
const AT = "2026-07-03T00:00:00Z";

const PILE = { id: "cd04-q1", scope: "colorado", feed: "feed/colorado/cd04-q1",
               age_recipient: "age1586sf5fgqv0cxt2xgyyl4p2s6f7x4eaneg28rhkpaj4sm8e5x92qtqwy8l",
               repo_url: "https://github.com/acme/cd04-q1" };

// 1. entry validation — strict, per §B family member
{
  ok(validateEntry("piles", PILE).ok, "a well-formed piles entry validates");
  ok(!validateEntry("piles", { ...PILE, extra: "x" }).ok, "an unknown field is refused (a typo'd consent never gets signed)");
  ok(!validateEntry("piles", { id: "a" }).ok, "missing required fields are named");
  ok(!validateEntry("nope", PILE).ok, "an unknown registry is refused");
  ok(validateEntry("tells", { id: "t", name: "T", url: "https://t", scope: "s", signer: "SHA256:x" }).ok, "a tells entry validates");
  ok(validateEntry("atlases", { id: "a", url: "https://a", scope: "s", signer: "SHA256:y" }).ok, "an atlases entry validates");
  ok(validateEntry("needs", { id: "n", asker_repo: "o/r", scope: "s", topic: "civic", terms: "" }).ok,
     "an EMPTY optional terms is legal (empty terms = match needs the asker's consent — needs.yml's own rule)");
  ok(!validateEntry("needs", { id: "n", asker_repo: "o/r", scope: "s", topic: "" }).ok, "an empty REQUIRED string is refused");
  ok(validateEntry("needs", { id: "n", asker_repo: "o/r", scope: "s", topic: "civic" }).ok, "a needs entry validates without terms");
}

// 2. the happy path — open, travel as bricks, read, merge, receipt back, the pair verifies
{
  const envelope = await openRegistration("piles", PILE, PROPOSER);
  // the ask survives the carrier: QR-sized bricks reassemble to the same signed envelope
  const bricks = await chunk(envelope, 80);
  const back = await reassemble(bricks);
  ok(back.ok && bricks.length > 1, `the envelope travels as ${bricks.length} carrier bricks and reassembles`);
  const scanned = JSON.parse(td.decode(back.bytes));

  const r = await readRegistration(scanned, { friends: [] });
  ok(r.ok && r.registry === "piles" && r.entry.id === "cd04-q1", "the scanned proposal reads (verify-from-anyone)");
  ok(r.by === PROPOSER.fingerprint && r.trusted === false, "the proposer is named; trust waits on the local friend list");
  ok((await readRegistration(scanned, { friends: [PROPOSER.fingerprint] })).trusted, "a friended proposer is trusted");

  const m = await mergeRegistration(scanned, ACCEPTOR, { at: AT });
  ok(m.receipt.schema === RECEIPT && m.receipt.verdict === "merged" && m.receipt.proposer === PROPOSER.fingerprint,
     "the merge signs a receipt binding proposer + verdict");
  const rev = await receiptEnvelope(m.receipt, ACCEPTOR);
  const opened = await openReceipt(rev, {});
  ok(opened.ok && opened.receipt.entryId === m.receipt.entryId, "the receipt travels back in the same envelope grammar");

  const pair = await verifyConsent(scanned, opened.receipt, { friends: [ACCEPTOR.fingerprint] });
  ok(pair.ok && pair.verdict === "merged", "the PAIR verifies: consent stands, re-checkable by anyone, zero secrets");
  ok(pair.proposer === PROPOSER.fingerprint && pair.acceptor === ACCEPTOR.fingerprint, "both parties named");
  ok(pair.trusted.acceptor === true && pair.trusted.proposer === false, "trust reported per party, against YOUR list");
}

// 3. every dishonest variation fails loudly
{
  const envelope = await openRegistration("piles", PILE, PROPOSER);
  const { receipt } = await mergeRegistration(envelope, ACCEPTOR, { at: AT });

  const tampered = { ...envelope, bytes: envelope.bytes.slice(0, -4) + "AAA=" };
  ok(!(await readRegistration(tampered, {})).ok, "a tampered envelope does not read");
  ok(!(await verifyConsent(tampered, receipt, {})).ok, "…and its pair does not verify");

  const other = await openRegistration("piles", { ...PILE, id: "other" }, PROPOSER);
  const swapped = await verifyConsent(other, receipt, {});
  ok(!swapped.ok && swapped.errors.some((e) => /different envelope/.test(e)), "a receipt for a different envelope is caught");

  const forged = { ...receipt, proposer: STRANGER.fingerprint };
  ok(!(await verifyConsent(envelope, forged, {})).ok, "editing the receipt breaks its signature");

  const declined = await mergeRegistration(envelope, ACCEPTOR, { verdict: "declined", at: AT });
  const dp = await verifyConsent(envelope, declined.receipt, {});
  ok(!dp.ok && dp.verdict === "declined" && dp.errors.length === 0, "a coherent DECLINED pair is ok:false with the verdict visible");

  let threw = false;
  try { await mergeRegistration(tampered, ACCEPTOR, {}); } catch { threw = true; }
  ok(threw, "an invalid proposal is never receipted — a receipt is a decision about a real ask");
  threw = false;
  try { await openRegistration("piles", { ...PILE, extra: "x" }, PROPOSER); } catch { threw = true; }
  ok(threw, "an invalid entry is refused at open — before anything is signed");
}

// 4. replay to the mirror — the ordinary idiom, member by member
{
  const y = registryYaml("piles", PILE);
  ok(y.startsWith("- id: cd04-q1\n") && y.includes('  age_recipient: "age1586') && y.includes('  repo_url: "https://github.com/acme/cd04-q1"'),
     "piles entry replays as the handshake YAML shape");
  ok(branchFor("piles", PILE) === "handshake/cd04-q1", "piles branch follows handshake/<repo>");
  // the provisioner attestation rides the offline exchange too (spec-or-attested)
  const MANAGED = { ...PILE, provisioner: "acme/host", provisioner_spec: "data-pile/pile-new/v1" };
  ok(validateEntry("piles", MANAGED).ok, "a managed pile's attestation fields validate");
  const my = registryYaml("piles", MANAGED);
  ok(my.includes('  provisioner: "acme/host"') && my.includes('  provisioner_spec: "data-pile/pile-new/v1"'),
     "the attestation travels in the replayed entry");
  const TELL = { id: "my-tell", name: "N", url: "https://t", scope: "district", signer: "SHA256:x", reports: "reports/govern-*" };
  ok(branchFor("tells", TELL) === "tell/district/my-tell", "tells branch carries the ownership claim (tell/<scope>/<id>)");
  ok(registryYaml("tells", TELL).includes('  signer: "SHA256:x"'), "tells entry carries the signer anchor");
  ok(branchFor("atlases", { id: "a", url: "https://a", scope: "wy", signer: "SHA256:y" }) === "atlas/wy/a", "atlases branch is one tier up");
  ok(branchFor("needs", { id: "n1", asker_repo: "o/r", scope: "s", topic: "t" }) === "need/n1", "needs branch names the need");
  ok(registryPath("tells") === "_data/tells.yml" && registryPath("piles") === "_data/piles.yml", "each family names its registry file");
  ok(Object.keys(REGISTRIES).length === 4, "the §B family is covered member by member");
}

// 8. the stamp: `at` rides INSIDE the signed payload (the freshness atlas bin/admit orders by).
{
  const T = "2026-07-08T00:00:00Z";
  const stamped = await openRegistration("piles", PILE, PROPOSER, { at: T });
  const r = await readRegistration(stamped, {});
  ok(r.ok && r.at === T, "a stamped proposal reads back with its `at` — signed, never claimed at arrival");
  const tampered = JSON.parse(JSON.stringify(stamped));
  const payload = JSON.parse(td.decode(Uint8Array.from(atob(tampered.bytes), (c) => c.charCodeAt(0))));
  payload.at = "2027-01-01T00:00:00Z";
  tampered.bytes = btoa(JSON.stringify(payload));
  ok(!(await readRegistration(tampered, {})).ok, "a re-stamped payload no longer verifies — the stamp lives inside the signature");
  const plain = await openRegistration("piles", PILE, PROPOSER);
  const r2 = await readRegistration(plain, {});
  ok(r2.ok && r2.at === null, "omitting `at` keeps the payload byte-identical to before (existing receipts stay verifiable)");
  let threw = false;
  try { await openRegistration("piles", PILE, PROPOSER, { at: "not-a-date" }); } catch { threw = true; }
  ok(threw, "a stamp that does not parse is refused at signing — never a fake freshness");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall register-exchange tests passed");
