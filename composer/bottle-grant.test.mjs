// Unit: composer/bottle-grant.mjs — a bottle operates because the USER granted it. A real gesture-signed
// probe.grant/v1 (minted by the anecdote identity) carries a tool's tagged op with no per-op confirm;
// without it the op needs a fresh confirmation. Consent is per-bottle and per-adapter, additive, revocable.
// Run: node composer/bottle-grant.test.mjs
import { OPERATE, operateScope, operateTag, operateGrantSpec } from "./bottle-grant.mjs";
import { bottleUrl } from "./bottle-uri.mjs";
import { authorize, describeOp } from "./authorize.mjs";
import { mintGrant, liveGrants, revokeGrant, verifyGrant } from "./consent.mjs";
import { generateIdentity } from "./sign.mjs";
import { memoryStore } from "../reducer/store.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const decide = (op, tag, grants) => authorize(describeOp(op, tag), { grants });

async function run() {
  const B = bottleUrl({ label: "cd04-q1", storage: "tell" });       // the pile's git bottle
  const C = bottleUrl({ label: "scratch7", storage: "bottles" });   // a different bottle
  const store = memoryStore();
  const id = await generateIdentity();

  // 0. scope names bottle + adapter; a non-bottle target is refused.
  ok(JSON.stringify(operateScope(B, "git")) === JSON.stringify({ bottle: ["cd04-q1.tell"], adapter: ["git"] }), "operate scope names bottle + adapter");
  { let threw = false; try { operateScope("https://example.com/", "git"); } catch { threw = true; } ok(threw, "a non-bottle target is refused"); }

  // 1. the operate grant is a real, signed, re-verifiable probe.grant/v1 by the anecdote identity.
  const rec = await mintGrant(store, operateGrantSpec(B, "git", { basis: "let this pile's git commit for me" }), id);
  ok(rec.signed && rec.signed.schema === "probe.grant/v1" && rec.behavior === OPERATE, "the grant is a probe.grant/v1 with behavior bottle.operate");
  ok((await verifyGrant(rec)).ok, "the grant re-verifies (signed by the anecdote identity)");
  const grants = await liveGrants(store);

  // 2. a tool's tagged Rung-1 commit on B is carried by the grant — no per-op confirm (consent to operate).
  let d = decide("git.commit", operateTag(B, "git"), grants);
  ok(d.allow && !d.needsConfirm && d.grantId === rec.grant, "a tagged commit on the granted bottle runs under the grant (no confirm)");

  // 3. WITHOUT the grant, the same op needs a fresh confirmation.
  d = decide("git.commit", operateTag(B, "git"), []);
  ok(!d.allow && d.needsConfirm, "without the grant, the op needs a fresh confirmation");

  // 4. per-bottle isolation — B's grant does not cover the same op on a different bottle.
  d = decide("git.commit", operateTag(C, "git"), grants);
  ok(!d.allow && d.needsConfirm, "the grant is per-bottle: it does not cover a different bottle");

  // 5. per-adapter isolation — B's git grant does not cover B's opfs adapter.
  d = decide("git.commit", operateTag(B, "opfs"), grants);
  ok(!d.allow, "the grant is per-adapter: git consent does not cover opfs");

  // 6. additive — granting C adds authority without disturbing B's.
  await mintGrant(store, operateGrantSpec(C, "git"), id);
  const grants2 = await liveGrants(store);
  ok(decide("git.commit", operateTag(B, "git"), grants2).allow && decide("git.commit", operateTag(C, "git"), grants2).allow,
    "granting C adds authority; B stays covered (additive)");

  // 7. revocable — revoking B's grant withdraws its operate consent (only the granter can).
  await revokeGrant(store, rec.grant, id);
  const grants3 = await liveGrants(store);
  d = decide("git.commit", operateTag(B, "git"), grants3);
  ok(!d.allow && d.needsConfirm, "revoking the grant withdraws operate consent for B");
  ok(decide("git.commit", operateTag(C, "git"), grants3).allow, "…and C's grant is untouched by B's revocation");

  console.log(fails ? `\nFAILED (${fails})` : "\nok: bottle-grant — a bottle operates by the user's gesture-signed consent, per bottle + adapter");
  process.exit(fails ? 1 : 0);
}
run();
