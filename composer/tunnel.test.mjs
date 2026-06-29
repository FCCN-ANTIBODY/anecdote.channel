// Tests for the runtime tunnel (host <-> guest protocol). Dependency-free, deterministic.
// Exercises the PURE session by hand-passing messages — no real iframe/postMessage.
//   node composer/tunnel.test.mjs
import { memoryStore } from "../reducer/store.mjs";
import { generateIdentity, verifySignature } from "./sign.mjs";
import { get as troveGet } from "./consent.mjs";
import { guestSession, hello, intake, HELLO_ACK, BUILT, DECLINED, ERROR } from "./tunnel.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const agent = { instrument: "minilm:sha256:deadbeef", constitution: "anecdote:sha256:cafe" };
const tell = { kind: "tell", id: "neighbors", url: "https://nbhd.example", excludes: ["harassment"] };
const atlas = { kind: "atlas", id: "foco", url: "https://foco.example", excludes: ["sex"] };

async function guest(extra = {}) {
  return guestSession({ identity: await generateIdentity(), store: memoryStore(), agent, ...extra });
}

// 1. Handshake: hello -> ack, and the guest now knows where it belongs.
{
  const g = await guest();
  const ack = await g.handle(hello({ destination: tell, poll: { poll: "shade", round: 1, asker: "city" } }), { origin: "https://nbhd.example" });
  ok(ack.type === HELLO_ACK && ack.ready, "hello is acknowledged, ready");
  ok(ack.instrument === agent.instrument, "the ack names the pinned instrument (who will co-sign)");
  ok(g.state.destination.id === "neighbors", "the guest remembers the destination from hello");
}

// 2. Intake against a Tell: a confirmed answer goes out the door as a signed, recorded anecdote,
//    delivered as the issue-as-input, with the receipt left in OUR trove.
{
  const g = await guest();
  await g.handle(hello({ destination: tell, poll: { poll: "shade", round: 1, asker: "city" } }), { origin: "https://nbhd.example" });
  const out = await g.handle(intake({ text: "The park needs more shade" }), { origin: "https://nbhd.example" });
  ok(out.type === BUILT, "intake yields a BUILT anecdote");
  ok(out.where === "private", "a Tell destination is private/solicited");
  ok(out.deliver.kind === "tell-issue", "delivery is the issue-as-input seam for a Tell");
  ok(out.deliver.poll && out.deliver.poll.poll === "shade", "the Tell's solicitation context rides onto delivery");
  ok((await verifySignature(out.signed)).ok, "the delivered anecdote is validly signed");
  ok(out.signed.poll && out.signed.poll.asker === "city", "the poll context is carried on the signed anecdote");
  ok(out.receipt.status === "live" && /^nonce:/.test(out.receipt.nonce), "a live receipt with a nonce comes back");
}

// 2b. The receipt really landed in the guest's own trove (its domain-scoped store).
{
  const store = memoryStore();
  const g = guestSession({ identity: await generateIdentity(), store, agent });
  await g.handle(hello({ destination: tell }), { origin: "https://nbhd.example" });
  const out = await g.handle(intake({ text: "more bus routes" }), { origin: "https://nbhd.example" });
  const inTrove = await troveGet(store, out.receipt.nonce);
  ok(inTrove && inTrove.nonce === out.receipt.nonce, "the receipt is left in anecdote's own trove, not the host's");
}

// 3. Intake against an Atlas: unsolicited/public delivery.
{
  const g = await guest();
  await g.handle(hello({ destination: atlas }), { origin: "https://foco.example" });
  const out = await g.handle(intake({ text: "The park needs more shade" }), { origin: "https://foco.example" });
  ok(out.where === "unsolicited" && out.deliver.kind === "atlas-public", "an Atlas destination is unsolicited/public");
}

// 4. Never blocked, only routed: a statement the destination doesn't OFFER is DECLINED with a reason,
//    and nothing is signed or recorded.
{
  const store = memoryStore();
  const g = guestSession({ identity: await generateIdentity(), store, agent });
  await g.handle(hello({ destination: atlas }), { origin: "https://foco.example" });
  const out = await g.handle(intake({ text: "Looking for sex" }), { origin: "https://foco.example" });
  ok(out.type === DECLINED && /sex/.test(out.reason), "a not-offered statement is declined with the reason, not blocked");
  ok((await troveGet(store, "anything")) === null, "nothing was recorded for a declined intake");
}

// 5. Order + origin guards.
{
  const g = await guest();
  const early = await g.handle(intake({ text: "hi" }), { origin: "https://nbhd.example" });
  ok(early.type === ERROR && /before hello/.test(early.message), "intake before hello errors");

  const picky = guestSession({ identity: await generateIdentity(), store: memoryStore(), agent, allowOrigin: (o) => o === "https://trusted.example" });
  const blocked = await picky.handle(hello({ destination: tell }), { origin: "https://evil.example" });
  ok(blocked.type === ERROR && /origin not allowed/.test(blocked.message), "a disallowed origin cannot open the tunnel");
  const allowed = await picky.handle(hello({ destination: tell }), { origin: "https://trusted.example" });
  ok(allowed.type === HELLO_ACK, "an allowed origin opens the tunnel");
}

// 6. hello() builder guards a missing destination.
{
  let threw = false;
  try { hello({}); } catch { threw = true; }
  ok(threw, "hello() refuses to open a tunnel with no destination");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
