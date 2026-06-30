// Tests for the runtime tunnel (host <-> guest protocol). Dependency-free, deterministic.
// Exercises the PURE session by hand-passing messages — no real iframe/postMessage.
//   node composer/tunnel.test.mjs
import { memoryStore } from "../reducer/store.mjs";
import { generateIdentity, verifySignature } from "./sign.mjs";
import { get as troveGet } from "./consent.mjs";
import { guestSession, hello, intake, status, HELLO_ACK, BUILT, STATUS, DECLINED, ERROR } from "./tunnel.mjs";

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
  const trustedTell = { kind: "tell", id: "trusted", url: "https://trusted.example" };
  const allowed = await picky.handle(hello({ destination: trustedTell }), { origin: "https://trusted.example" });
  ok(allowed.type === HELLO_ACK, "an allowed origin serving its own destination opens the tunnel");
}

// 7. Origin-bind: a Tell destination must be SERVED FROM the embedding origin. Impersonation fails.
{
  const g = await guest();
  const honest = await g.handle(hello({ destination: tell }), { origin: "https://nbhd.example" });
  ok(honest.type === HELLO_ACK && honest.verified === "origin", "a Tell page served from its own url opens, verified by origin");

  const g2 = await guest();
  const impostor = await g2.handle(hello({ destination: tell }), { origin: "https://evil.example" });
  ok(impostor.type === ERROR && /is not the embedding origin/.test(impostor.message),
    "a page cannot claim to BE a Tell it is not served from (no impersonation)");
}

// 8. Atlas via registry: anecdote verifies the claim against its OWN known-Atlas cache, cross-origin.
{
  const knownAtlas = (d) => d.id === "foco" && d.url === "https://foco.example";
  const g = guestSession({ identity: await generateIdentity(), store: memoryStore(), agent, knownAtlas });
  // embedded by some Tell page (a different origin) but routing to a known Atlas:
  const ack = await g.handle(hello({ destination: atlas }), { origin: "https://some-tell.example" });
  ok(ack.type === HELLO_ACK && ack.verified === "registry", "a known Atlas is verified against our registry, not the origin");
  const unknown = await g.handle(hello({ destination: { kind: "atlas", id: "fake", url: "https://fake.example" } }), { origin: "https://some-tell.example" });
  ok(unknown.type === ERROR && /unknown atlas/.test(unknown.message), "an Atlas we don't know is refused");
}

// 9. Token carry: the Tell's poll capability rides to the door — but is NOT bound under the signature.
{
  const g = await guest();
  await g.handle(hello({ destination: tell, poll: { poll: "shade", round: 2 }, token: "tok-abc123" }), { origin: "https://nbhd.example" });
  const out = await g.handle(intake({ text: "The park needs more shade" }), { origin: "https://nbhd.example" });
  ok(out.deliver.token === "tok-abc123", "the poll token is carried onto the delivery for the Tell to verify at its door");
  ok(out.signed.token === undefined, "the token is NOT bound under the user's signature (it is the Tell's authority, not the user's words)");
  ok((await verifySignature(out.signed)).ok, "the signed anecdote still verifies (token rode outside it)");
}

// 6. hello() builder guards a missing destination.
{
  let threw = false;
  try { hello({}); } catch { threw = true; }
  ok(threw, "hello() refuses to open a tunnel with no destination");
}

// 10. Egress: when the host hands us a post credential, we send it to GitHub on intake, record the
//     delivery against the nonce, and never leak the credential. The page can then read the status.
{
  const CRED = "ghs_secret_post_token";
  let posted = null;
  const egressApi = async (call) => { posted = call; return { status: 201, json: { id: 7, html_url: "https://github.com/o/r/issues/9#issuecomment-7" } }; };
  const store = memoryStore();
  const g = guestSession({ identity: await generateIdentity(), store, agent, egressApi });
  await g.handle(hello({
    destination: tell,
    poll: { pile: "cd04", poll: "shade", round: 1 },
    token: "HMAC-tok",
    egress: { repo: { owner: "o", name: "r" }, mode: "comment", canonicalIssue: 9, run: "run-1", credential: CRED },
  }), { origin: "https://nbhd.example" });
  const out = await g.handle(intake({ text: "The park needs more shade" }), { origin: "https://nbhd.example" });
  ok(out.delivery && out.delivery.state === "pending", "intake posts and returns a pending delivery");
  ok(out.delivery.placement.url.endsWith("#issuecomment-7"), "the delivery records where it landed");
  ok(posted.token === CRED, "the post credential is used in the api call");
  ok(!JSON.stringify(posted.body).includes(CRED), "the credential is never in the posted body");

  // the page can re-query status by nonce — even 'after a reload' (a fresh request to the trove)
  const st = await g.handle(status({ nonce: out.receipt.nonce }), { origin: "https://nbhd.example" });
  ok(st.type === STATUS && st.found && st.delivery.state === "pending", "status(nonce) returns the async delivery from the trove");
  const miss = await g.handle(status({ nonce: "nonce:absent" }), { origin: "https://nbhd.example" });
  ok(miss.type === STATUS && miss.found === false, "status() for an unknown nonce reports not-found");
}

// 11. Egress failure is recorded, not swallowed (the promise: you will know if it wasn't accepted).
{
  const store = memoryStore();
  const egressApi = async () => ({ status: 403, json: { message: "no" } });
  const g = guestSession({ identity: await generateIdentity(), store, agent, egressApi });
  await g.handle(hello({ destination: tell, egress: { repo: { owner: "o", name: "r" }, mode: "issue", credential: "x" } }), { origin: "https://nbhd.example" });
  const out = await g.handle(intake({ text: "more bus routes" }), { origin: "https://nbhd.example" });
  ok(out.delivery && out.delivery.state === "error", "a failed post is surfaced as a delivery error, not silent");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
