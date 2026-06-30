// composer/tunnel.mjs — the runtime tunnel a host opens by iframing us and saying hello.
//
// The picture this completes: a Tell-as-a-service is just a poll sheet in someone's browser. When a
// response "goes out the door," that page does not hand-roll a submission — it EMBEDS anecdote.channel
// in an iframe and says HELLO. anecdote becomes the data-assisted intake: it canonical-labels the
// answer (the reducer), builds it into an anecdote/v1, signs it with a freshly minted revocable nonce,
// leaves the RECEIPT in its OWN trove (on the anecdote.channel origin — so a constituent's record of
// "all the nonsense" is one trove no matter whose page they were on), and hands the host the artifact
// to put WHERE IT BELONGS: a Tell for private/solicited (the issue-as-input seam), an Atlas for
// unsolicited/public.
//
// Why an iframe + postMessage: the trove and the signing key must live on the anecdote.channel origin
// (domain-scoped storage, §"Mobile LLM"/§"Aggregation"). A Tell page on its own origin cannot reach
// them — and must not. The tunnel is the only door between the two origins, and it is narrow on
// purpose: a typed handshake, origin-checked, and nothing signs or records except on an explicit
// intake (which is the user's confirmed "out the door"). Nothing phones home; nothing runs on a loop
// but the messages the host addresses to us.
//
// This module is the PURE protocol + guest orchestration (no window, testable in Node). The thin
// postMessage transport (browser-only) lives at the bottom, mirroring model-bus.mjs's worker RPC.

import { intentOf, verdict, prepare } from "./route.mjs";
import { build } from "./anecdote.mjs";
import { sign } from "./sign.mjs";
import { mintNonce, record } from "./consent.mjs";

export const HELLO = "anecdote.tunnel.hello/v1";       // host -> guest: open the tunnel, declare context
export const HELLO_ACK = "anecdote.tunnel.ack/v1";     // guest -> host: ready, who I am
export const INTAKE = "anecdote.tunnel.intake/v1";     // host -> guest: a confirmed answer going out the door
export const BUILT = "anecdote.tunnel.built/v1";       // guest -> host: signed anecdote + receipt + where it belongs
export const DECLINED = "anecdote.tunnel.declined/v1"; // guest -> host: not OFFERED here (never "blocked"), with the reason
export const ERROR = "anecdote.tunnel.error/v1";

// ---- host side: message builders -----------------------------------------------------------------

// Open the tunnel. `destination` is the host's own hub: { kind:"tell"|"atlas", id, url, excludes? }.
// `poll` carries the solicitation context (poll id, round, asker, the question) the Tell already
// knows — passed through onto the receipt, never invented by us. `token` is the Tell's poll
// capability (its server-minted HMAC `tok`); we carry it to the door for the Tell to verify — we
// never bind it under the user's signature, because it is the Tell's authority, not the user's words.
export function hello({ destination, poll = null, token = null } = {}) {
  if (!destination || !destination.id || !destination.kind) throw new Error("tunnel: hello needs a destination {id,kind}");
  return { type: HELLO, destination, poll, token };
}

// A confirmed answer going out the door. `attachments` are raw {mediaType,bytes,source,...} descriptors
// (become receipts per anecdote.mjs). Sending this IS the user's confirmed action.
export function intake({ text, attachments = [] } = {}) {
  return { type: INTAKE, text, attachments };
}

export const isAck = (m) => m && m.type === HELLO_ACK;
export const isBuilt = (m) => m && m.type === BUILT;
export const isDeclined = (m) => m && m.type === DECLINED;

// ---- guest side: a stateful session that answers messages purely --------------------------------

// deps:
//   identity     the constituent's device identity (sign.generateIdentity) — the signing key
//   store        domain-scoped trove store ({get,set,delete}) on the anecdote.channel origin
//   agent        { instrument, constitution } — the Mobile LLM co-signature (pinned id)
//   name         the reducer's namer (fewest-verbs); defaults to route's built-in
//   hash, randomBytes  optional seams for anecdote hashing / nonce entropy
//   allowOrigin  (origin) => boolean — which host origins may open a tunnel (transport supplies this)
export function guestSession(deps = {}) {
  if (!deps.identity) throw new Error("tunnel: guest needs an identity");
  if (!deps.store) throw new Error("tunnel: guest needs a trove store");
  const state = { ready: false, destination: null, poll: null, hostOrigin: null };

  async function handle(msg, ctx = {}) {
    try {
      if (!msg || typeof msg !== "object") return err("malformed message");

      if (msg.type === HELLO) {
        if (deps.allowOrigin && ctx.origin && !deps.allowOrigin(ctx.origin)) return err("origin not allowed", ctx.origin);
        if (!msg.destination || !msg.destination.id || !msg.destination.kind) return err("hello needs a destination");
        // Prove the host is who it says it is going to talk to — before we will sign anything to it.
        const bind = verifyDestination(msg.destination, ctx.origin, deps);
        if (!bind.ok) return err(bind.reason, ctx.origin);
        state.ready = true;
        state.destination = msg.destination;
        state.poll = msg.poll || null;
        state.token = msg.token || null;
        state.hostOrigin = ctx.origin || null;
        state.verified = bind.verified;
        return {
          type: HELLO_ACK,
          ready: true,
          verified: bind.verified,            // how we proved it: "origin" (served from the url) | "registry"
          instrument: (deps.agent && deps.agent.instrument) || null,
          constitution: (deps.agent && deps.agent.constitution) || null,
          // We tell the host what we will route here, but the host cannot make us sign anything but a
          // user intake.
          accepts: ["text", "ref"],
        };
      }

      if (msg.type === INTAKE) {
        if (!state.ready) return err("intake before hello");
        const dest = state.destination;
        const intent = intentOf(msg.text || "", deps.name);          // data-assisted canonical labeling
        const v = verdict(intent, dest, []);                          // offered here? (never "blocked")
        if (!v.eligible) {
          return { type: DECLINED, reason: v.reason, by: v.by, topic: v.topic, label: intent.label, destination: dest };
        }
        const routed = prepare(msg.text, dest, { name: deps.name });
        const anecdote = await build(routed, msg.attachments || [], { hash: deps.hash });
        // Bind the host's solicitation context (poll/round/asker) BEFORE signing, so the response is
        // cryptographically tied to the poll it answered — passed through from the Tell, never invented.
        if (state.poll) anecdote.poll = state.poll;
        const nonce = mintNonce({ randomBytes: deps.randomBytes });
        const signed = await sign(anecdote, deps.identity, { agent: deps.agent, nonce });
        const receipt = await record(deps.store, signed);            // the receipt stays in OUR trove
        return {
          type: BUILT,
          where: dest.kind === "tell" ? "private" : "unsolicited",   // a Tell for private, an Atlas for unsolicited
          verified: state.verified,                                  // how the destination proved itself at hello
          deliver: outTheDoor(dest, signed, state.poll, state.token), // the artifact the host submits
          receipt: { nonce: receipt.nonce, status: receipt.status, label: receipt.label, by: receipt.by },
          signed,
        };
      }

      return err(`unknown message type ${msg.type}`);
    } catch (e) {
      return err(e.message);
    }
  }

  return { handle, state };
}

// What "out the door" means per destination kind. A Tell receives the issue-as-input (private,
// solicited — the Tell's page posts it as a GitHub Issue carrying the signed anecdote, the seam
// CONTRACT.md → "Ingress: QR → authorized Issue → digest" already expects), with the poll `token`
// carried alongside so the Tell can verify the capability at its door (bin/authz) — NOT under our
// signature. An Atlas receives an unsolicited public submission. We hand the host the shape; the
// host owns the actual transmit.
function outTheDoor(dest, signed, poll, token) {
  if (dest.kind === "tell") {
    return { kind: "tell-issue", to: { id: dest.id, kind: dest.kind, url: dest.url }, poll, token: token || null, anecdote: signed };
  }
  return { kind: "atlas-public", to: { id: dest.id, kind: dest.kind, url: dest.url }, anecdote: signed };
}

// Prove the host is the destination it claims. Two honest ways, no secret in the browser:
//   - origin-bind: the embedding page must be SERVED FROM the destination's own url. The browser
//     attests event.origin and cannot be made to lie, so this proves domain control for free. This is
//     the rule for a Tell (private, listed nowhere — its url IS its identity).
//   - registry: an Atlas is public and in our OWN cache of registered Atlases, so we verify the claim
//     against what we already know (deps.knownAtlas), never trusting the host's word. Used when
//     present; otherwise an Atlas falls back to the same origin-bind.
// We never ask the host to prove anything about the USER — that one-directionality is the anonymity.
function verifyDestination(dest, origin, deps) {
  if (dest.kind === "atlas" && deps.knownAtlas) {
    return deps.knownAtlas(dest) ? { ok: true, verified: "registry" } : { ok: false, reason: `unknown atlas ${dest.id}` };
  }
  if (!origin) return { ok: false, reason: "no embedding origin to bind the destination to" };
  if (!dest.url) return { ok: false, reason: "destination has no url to bind" };
  let o;
  try { o = new URL(dest.url).origin; } catch { return { ok: false, reason: `destination url is not a url: ${dest.url}` }; }
  if (o !== origin) return { ok: false, reason: `destination ${o} is not the embedding origin ${origin}` };
  return { ok: true, verified: "origin" };
}

function err(message, origin) { return { type: ERROR, message, ...(origin ? { origin } : {}) }; }

// ---- the thin postMessage transport (browser-only; the view, not the logic) ----------------------

// Guest: serve the tunnel from inside the iframe. Validates event.origin against allowedOrigins,
// runs the pure session, and replies to the exact source/origin that asked. Like the rest of the
// channel, it answers only messages addressed to it — no event loop beyond that.
export function serveTunnel(deps = {}, { allowedOrigins = [], target = globalThis } = {}) {
  const allow = (origin) => allowedOrigins.includes("*") || allowedOrigins.includes(origin);
  const session = guestSession({ ...deps, allowOrigin: allow });
  const onMessage = async (event) => {
    if (!event || !event.data || typeof event.data.type !== "string") return;
    if (!event.data.type.startsWith("anecdote.tunnel.")) return;
    const reply = await session.handle(event.data, { origin: event.origin });
    if (event.source && event.source.postMessage) event.source.postMessage(reply, event.origin);
  };
  target.addEventListener("message", onMessage);
  return () => target.removeEventListener("message", onMessage); // unsubscribe
}

// Host: open a tunnel to an anecdote.channel iframe and get a fluent promise per round-trip. The host
// must pass the exact iframe window and the anecdote origin (targetOrigin) — never "*".
export function connectTunnel(iframeWindow, targetOrigin, { source = globalThis } = {}) {
  if (!targetOrigin || targetOrigin === "*") throw new Error("tunnel: connect needs an explicit anecdote origin");
  const send = (msg, accept) => new Promise((resolve, reject) => {
    const onMessage = (event) => {
      if (event.origin !== targetOrigin) return;
      if (!event.data || typeof event.data.type !== "string" || !event.data.type.startsWith("anecdote.tunnel.")) return;
      source.removeEventListener("message", onMessage);
      if (event.data.type === ERROR) reject(new Error(event.data.message));
      else resolve(event.data);
    };
    source.addEventListener("message", onMessage);
    iframeWindow.postMessage(msg, targetOrigin);
  });
  return {
    hello: (ctx) => send(hello(ctx)),
    intake: (ctx) => send(intake(ctx)),
  };
}
