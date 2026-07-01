// Integration test: the real composer pipeline vended as probe-line ops (Milestone: Origin).
// The reducer/sign/trove modules run behind the Elevated session; a chamber would drive this over a port.
//   node composer/probe-ops.test.mjs
import { memoryStore } from "../reducer/store.mjs";
import { generateIdentity, verifySignature } from "./sign.mjs";
import { get as troveGet } from "./consent.mjs";
import { elevatedSession, request, cancel, FRAME, ERROR, CANCELLED } from "./probe-line.mjs";
import { composerOps } from "./probe-ops.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const agent = { instrument: "minilm:sha256:deadbeef", constitution: "anecdote:sha256:cafe" };
const dest = { id: "foco", kind: "atlas", url: "https://foco.example", excludes: ["sale"] };

async function session(store, id, ctx = { recordingOn: true, grants: [] }, yield_) {
  const frames = [];
  const s = elevatedSession({ ops: composerOps({ identity: id, store, agent }), emit: (f) => frames.push(f),
                              context: () => ctx, yield_ });
  return { s, frames };
}

// 1. Rung 0 label — the chamber gets a canonical label without any prompt (the LM ran Elevated).
{
  const store = memoryStore(); const id = await generateIdentity();
  const { s, frames } = await session(store, id);
  await s.handle(request({ id: "A", op: "label", input: { text: "The park needs more shade" } }));
  const f = frames.find((x) => x.type === FRAME && !x.final);
  ok(f && typeof f.label === "string" && f.label.length > 0, "label returns a canonical label, no consent needed");
}

// 2. Rung 1 sign-anecdote is refused without a confirm, and nothing is signed or stored.
{
  const store = memoryStore(); const id = await generateIdentity();
  const { s, frames } = await session(store, id);
  await s.handle(request({ id: "A", op: "sign-anecdote", input: { text: "The park needs more shade", destination: dest } }));
  const e = frames.find((x) => x.type === ERROR);
  ok(e && e.needsConfirm, "unconfirmed sign-anecdote → needsConfirm");
}

// 3. Confirmed sign-anecdote builds + signs on the device key and keeps a verifiable receipt in the trove.
{
  const store = memoryStore(); const id = await generateIdentity();
  const { s, frames } = await session(store, id);
  await s.handle(request({ id: "A", op: "sign-anecdote", confirmed: true,
    input: { text: "The park needs more shade", destination: dest } }));
  const f = frames.find((x) => x.type === FRAME && !x.final);
  ok(f && f.receipt && /^nonce:/.test(f.receipt.nonce), "a receipt with a nonce comes back");
  ok(f.receipt.by === id.fingerprint, "the receipt is bound to the device identity");

  const stored = await troveGet(store, f.receipt.nonce);
  ok(stored && stored.status === "live", "the receipt is in the trove, live");
  const v = await verifySignature(stored.signed);
  ok(v.ok && v.by === id.fingerprint, "the stored anecdote is a valid on-device signature");
  ok(stored.signed.agent && stored.signed.agent.instrument === agent.instrument, "the Mobile-LLM co-signature is bound in");
}

// 4. Atomicity: cancelling before the commit leaves nothing signed and nothing in the trove.
{
  const store = memoryStore(); const id = await generateIdentity();
  const waiters = [];
  const yield_ = () => new Promise((r) => waiters.push(r));
  const step = async () => { const w = waiters.shift(); if (w) w(); await new Promise((r) => setTimeout(r, 0)); };
  const { s, frames } = await session(store, id, { recordingOn: true, grants: [] }, yield_);

  const done = s.handle(request({ id: "A", op: "sign-anecdote", confirmed: true,
    input: { text: "The park needs more shade", destination: dest } }));
  s.handle(cancel({ id: "A" }));   // revoke before the tick resolves → throws before build/sign/record
  await step();
  await done;

  ok(frames.some((x) => x.type === CANCELLED), "a CANCELLED frame is emitted");
  ok(!frames.some((x) => x.type === FRAME && !x.final), "no receipt frame — nothing was signed");
  const trove = await import("./consent.mjs").then((m) => m.list(store));
  ok(trove.length === 0, "the trove is empty — the send was abandoned atomically");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall probe-ops tests passed");
