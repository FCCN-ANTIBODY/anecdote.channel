// Unit: composer/pile-keeper.mjs — the D8 keeper: keyring adoption/forget (residue-free), the
// hash-chained chronicle, the origin→pile binding, and the vended capability (pull/verify/decrypt
// trove-side, display frames out, the identity never crossing) — driven through a real elevatedSession
// against a fixture feed produced with the mirrored consumer core's own primitives. Also the D5 drift
// guard: the composer mirrors of feed-open/age-open must stay byte-identical to data-pile's bin (the
// source of truth), checked when the sibling checkout is present.
// Run: node composer/pile-keeper.test.mjs
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { createHash, randomBytes, createCipheriv } from "node:crypto";
import { pileForOrigin, readKeyring, adoptPile, forgetPile, appendChronicle, readChronicle, verifyChronicle,
         keeperOps, KEYRING_KEY, CHRONICLE_KEY } from "./pile-keeper.mjs";
import { mintAgeIdentity } from "./age-mint.mjs";
import { encrypt as ageEncrypt } from "./age-seal.mjs";
import { elevatedSession } from "./probe-line.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

// 1. the origin→pile binding: the name is the key, everything else is nobody.
ok(pileForOrigin("https://parks-2026.tell.anecdote.channel") === "parks-2026", "a room origin binds to its own name");
for (const bad of ["https://parks-2026.bottles.anecdote.channel", "https://a.b.tell.anecdote.channel",
                   "http://parks-2026.tell.anecdote.channel", "https://tell.anecdote.channel", "https://evil.example", null]) {
  ok(pileForOrigin(bad) === null, "no pile for " + bad);
}

// 2. the keyring: deliberate adoption, residue-free forget.
{
  const s = mem();
  let threw = false; try { adoptPile(s, { pile: "p", identity: "nope", feed: "https://x/" }); } catch { threw = true; }
  ok(threw, "a non-identity cannot be adopted");
  adoptPile(s, { pile: "parks-2026", identity: "AGE-SECRET-KEY-1TEST", feed: "https://tell.anecdote.channel/piles/parks-2026/feed/" }, { now: "2026-07-25T00:00:00Z" });
  ok(readKeyring(s)["parks-2026"].adopted_at === "2026-07-25T00:00:00Z", "adoption is recorded, dated");
  forgetPile(s, "parks-2026");
  ok(s.getItem(KEYRING_KEY) === null, "the emptied keyring leaves no storage residue");
}

// 3. the chronicle: hash-chained; an edited middle is caught.
{
  const s = mem();
  await appendChronicle(s, { op: "pile.read", pile: "a", origin: "https://a.tell.anecdote.channel" }, { now: "t1" });
  await appendChronicle(s, { op: "pile.read", pile: "a", origin: "https://a.tell.anecdote.channel", grantId: "grant:x" }, { now: "t2" });
  await appendChronicle(s, { op: "pile.adopt", pile: "a", origin: "https://a.tell.anecdote.channel" }, { now: "t3" });
  const log = readChronicle(s);
  ok((await verifyChronicle(log)).ok && log.length === 3 && log[1].grantId === "grant:x",
     "three acts chained, the covering grant recorded");
  const doctored = JSON.parse(JSON.stringify(log));
  doctored[1].pile = "b";
  ok((await verifyChronicle(doctored)).ok === false, "an edited middle breaks the chain — the audit holds");
}

// 4. the vended capability, end to end against a real fixture feed (lib.sh semantics in node:crypto).
{
  const sha = (s) => createHash("sha256").update(s).digest("hex");
  const K0 = randomBytes(32).toString("hex");
  const owner = await mintAgeIdentity();
  const enc = (kHex, plain) => {
    const iv = Buffer.from(sha("iv:" + kHex).slice(0, 32), "hex");
    const c = createCipheriv("aes-256-ctr", Buffer.from(kHex, "hex"), iv);
    return Buffer.concat([c.update(plain), c.final()]);
  };
  const texts = ["sealed answer one\n", "sealed answer two\n"];
  let k = K0; const entries = []; const files = {}; let prev = null;
  for (let i = 0; i < texts.length; i++) {
    const block = String(i).padStart(6, "0") + ".enc";
    files[block] = enc(k, Buffer.from(texts[i]));
    entries.push({ seq: i, created_at: "2026-07-25T0" + i + ":00:00Z", source: "tell", block,
                   this_hash: "sha256:" + sha(files[block]), prev_hash: prev, ratchet_pub: "sha256:" + sha("pub:" + k) });
    prev = "sha256:" + sha(files[block]);
    k = sha("ratchet:" + k);
  }
  const canon = JSON.stringify(entries.map((e) => Object.fromEntries(Object.entries(e).sort(([a], [b]) => (a < b ? -1 : 1)))));
  const manifest = { version: 1, source: "tell", entries, head: { seq: 1, digest: sha(canon), sig: null } };
  files["seed.age"] = Buffer.from(await ageEncrypt([owner.recipient], Buffer.from(K0)));
  files["manifest.json"] = Buffer.from(JSON.stringify(manifest));

  const trove = mem();
  adoptPile(trove, { pile: "parks-2026", identity: owner.identity, feed: "https://tell.anecdote.channel/piles/parks-2026/feed/" }, { now: "t0" });
  const fetched = [];
  const fakeFetch = async (url) => {
    fetched.push(url);
    const name = url.split("/").pop();
    if (!files[name]) return { ok: false, status: 404 };
    return { ok: true, json: async () => JSON.parse(files[name].toString()), arrayBuffer: async () => files[name] };
  };
  const run = async (origin, msg) => {
    const frames = [];
    const session = elevatedSession({ ops: keeperOps({ origin, storage: trove, fetch: fakeFetch, now: "tR" }),
                                      emit: (f) => frames.push(f), yield_: () => Promise.resolve(),
                                      context: () => ({ recordingOn: true, grants: [] }) });
    await session.handle({ type: "probe.line.request/v1", ...msg });
    return frames;
  };

  // the room's own origin, confirmed → plaintext frames arrive; the secret does not.
  const good = await run("https://parks-2026.tell.anecdote.channel", { id: "r1", op: "pile.read", confirmed: true });
  const data = good.find((f) => f.records);
  ok(!!data && data.records.map((r) => r.text).join("|") === texts.join("|"),
     "the capability vends: pulled, verified, decrypted trove-side, display frames out");
  ok(!JSON.stringify(good).includes(owner.identity) && !JSON.stringify(good).includes(K0),
     "NEITHER the identity NOR the seed ever crosses the port");
  ok(fetched.every((u) => u.startsWith("https://tell.anecdote.channel/piles/parks-2026/feed/")),
     "the keeper pulled only from the address ITS OWN record names");
  ok(readChronicle(trove).some((e) => e.op === "pile.read" && e.pile === "parks-2026"), "the vend is chronicled");

  // unconfirmed → the ladder refuses with needsConfirm; nothing decrypts, nothing is logged.
  const cold = await run("https://parks-2026.tell.anecdote.channel", { id: "r2", op: "pile.read" });
  ok(cold.some((f) => f.type === "probe.line.error/v1" && f.needsConfirm), "no consent → needsConfirm, nothing vends");
  ok(readChronicle(trove).filter((e) => e.op === "pile.read").length === 1, "a refused act is not in the log");

  // a FOREIGN room asking about this pile → bound to ITS name, which holds nothing.
  const foreign = await run("https://quiet-creek.tell.anecdote.channel", { id: "r3", op: "pile.read", confirmed: true });
  ok(foreign.some((f) => f.type === "probe.line.error/v1" && /no identity held for 'quiet-creek'/.test(f.reason)),
     "another room gets ITS OWN empty scope, never this pile's: " + foreign.find((f) => f.reason).reason);

  // a non-room origin speaks for no pile at all.
  const nowhere = await run("https://evil.example", { id: "r4", op: "pile.read", confirmed: true });
  ok(nowhere.some((f) => f.type === "probe.line.error/v1" && /speaks for no pile/.test(f.reason)),
     "an origin outside the name grammar is refused outright");

  // adoption is origin-locked too: a room cannot plant identities under another name.
  const plant = await run("https://quiet-creek.tell.anecdote.channel",
    { id: "r5", op: "pile.adopt", confirmed: true, input: { pile: "parks-2026", identity: owner.identity, feed: "https://x/" } });
  ok(plant.some((f) => f.type === "probe.line.error/v1" && /not this origin's pile/.test(f.reason)),
     "a room cannot adopt for another name");
}

// 5. the D5 drift guard: the composer mirrors match data-pile's bin byte-for-byte (minus the one
// provenance line), when the sibling checkout is present.
{
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const dp = process.env.DP_REPO || join(root, "..", "data-pile");
  if (existsSync(join(dp, "bin", "feed-open.mjs"))) {
    for (const f of ["feed-open.mjs", "age-open.mjs"]) {
      const mirror = readFileSync(join(root, "composer", f), "utf8").split("\n").slice(1).join("\n");
      const truth = readFileSync(join(dp, "bin", f), "utf8");
      ok(mirror === truth, `composer/${f} is byte-identical to data-pile/bin/${f} (after the provenance line)`);
    }
  } else {
    console.log("  note: mirror drift guard skipped (no data-pile checkout; set DP_REPO)");
  }
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nok: pile-keeper — the capability vends, the secret stays, every act is in the chain");
