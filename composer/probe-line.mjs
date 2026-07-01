// composer/probe-line.mjs — the probe line: the ingress tunnel INVERTED (Milestone: Origin, Edge 3
// phase 3). Where the tunnel lets a privileged HOST (a Tell) summon the anecdote guest and trusts it by
// ORIGIN, the probe line lets the privileged ELEVATED anecdote app (keys, subtle, trove, the LM) be
// summoned by a powerless `data:` CHAMBER and trusts it by CAPABILITY — a transferred MessagePort, since
// a `data:` origin is null (verified: docs/probe-line.md Edges 1/2/6).
//
// This is the keystone that joins the two halves we built and verified:
//   - TRANSPORT (Edges 1/2/6, Chromium-verified): a port carries the capability; one request fans out to
//     many seq-ordered frames disambiguated by a correlation id; `cancel` stops a stream cooperatively;
//     `port.close()` revokes unilaterally and silently.
//   - CONSENT (Edge 3 phases 1-2): the three-rung ladder — the `authorize()` gate over standing grants
//     (the behavior-shaped cousin of the nonce).
//
// The load-bearing rule the two halves meet on: THE COMMIT IS THE ATOMIC REVOCATION UNIT. A cancel lands
// BETWEEN commits, never inside one — so the yield-per-frame point Edge 2 forced on us is ALSO the only
// safe place to honor a cancel. An op that persists does: await api.tick()  →  (throws if cancelled)  →
// commit. Cancelled mid-op means the commit never happened; no half-written artifact.
//
// Like tunnel.mjs this is the PURE protocol + Elevated orchestration (no window/MessagePort, testable in
// Node). The thin postMessage/port transport (browser-only) lives at the bottom.

import { authorize, describeOp } from "./authorize.mjs";

// Handshake (over window.postMessage, before the port exists — the inverted hello, Edge 6):
export const READY = "probe.line.ready/v1";       // chamber -> Elevated: booted, awaiting my port
export const INIT  = "probe.line.init/v1";        // Elevated -> chamber: here is your port (transferred)
// Over the transferred port (after the handshake):
export const REQUEST   = "probe.line.request/v1";   // chamber -> Elevated: invoke an op
export const FRAME     = "probe.line.frame/v1";     // Elevated -> chamber: a stream frame {id, seq, final}
export const CANCEL    = "probe.line.cancel/v1";    // chamber -> Elevated: stop a request mid-stream
export const CANCELLED = "probe.line.cancelled/v1"; // Elevated -> chamber: acknowledged; stopped cleanly
export const ERROR     = "probe.line.error/v1";     // Elevated -> chamber: refused / failed (correlated by id)

// ---- chamber side: request builders (a chamber is inline HTML; these document the wire shape) --------

// Ask Elevated to run an op. `op` is a catalog name (its rung/persist is fixed by the ADMIN side — a
// chamber can never raise it). `behavior`/`scope` (optional) let a request ride a standing grant.
// `confirmed` marks that this call already carries a fresh user confirmation (for a one-off Rung-1 op).
export function request({ id, op, input = null, behavior, scope, confirmed = false } = {}) {
  if (!id) throw new Error("probe-line: a request needs a correlation id");
  if (!op) throw new Error("probe-line: a request needs an op");
  return { type: REQUEST, id, op, input, behavior, scope, confirmed };
}
export function cancel({ id } = {}) {
  if (!id) throw new Error("probe-line: cancel needs the request id");
  return { type: CANCEL, id };
}

export const isFrame = (m) => m && m.type === FRAME;
export const isCancelled = (m) => m && m.type === CANCELLED;
export const isError = (m) => m && m.type === ERROR;

// ---- Elevated side: a stateful session that vends capabilities over the port --------------------------
//
// deps:
//   ops        { [name]: async (input, api) => void } — the capability handlers. `api` gives:
//                api.emit(data)   -> send a stream frame {type:FRAME, id, seq++, final:false, ...data}
//                api.tick(ms?)    -> the yield→check-cancel point: awaits a real turn, then THROWS
//                                    Cancelled if a cancel arrived. Call it right before a commit.
//                api.cancelled()  -> peek the cancel flag without throwing
//   context    () => ({ recordingOn, grants, now }) — read live each request (the recording toggle + your
//              standing grants, e.g. from consent.liveGrants). The gate decides against this.
//   emit       (frame) => void — the sink every frame goes to (the transport wires it to the port).
//   yield_     optional (ms) => Promise — the turn primitive tick() awaits (default a real setTimeout);
//              a test can inject a synchronous-ish yield.
export function elevatedSession(deps = {}) {
  if (!deps.ops) throw new Error("probe-line: Elevated needs an ops map");
  if (typeof deps.emit !== "function") throw new Error("probe-line: Elevated needs an emit sink");
  const context = deps.context || (() => ({ recordingOn: true, grants: [] }));
  const turn = deps.yield_ || ((ms = 0) => new Promise((r) => setTimeout(r, ms)));
  const inflight = new Map(); // id -> { cancelled }

  class Cancelled extends Error {}

  async function runRequest(msg) {
    const { id } = msg;
    if (inflight.has(id)) return deps.emit({ type: ERROR, id, reason: "duplicate request id" });

    // The gate first — the chamber declares op+behavior+scope; the CATALOG (admin) fixes rung/persist.
    const op = describeOp(msg.op, { behavior: msg.behavior, scope: msg.scope });
    const decision = authorize(op, { ...context(), confirmed: !!msg.confirmed });
    if (!decision.allow) {
      return deps.emit({ type: ERROR, id, reason: decision.reason, rung: decision.rung,
                         needsConfirm: !!decision.needsConfirm });
    }
    const handler = deps.ops[msg.op];
    if (!handler) return deps.emit({ type: ERROR, id, reason: `no such op ${msg.op}` });

    const s = { cancelled: false };
    inflight.set(id, s);
    let seq = 0;
    const api = {
      emit: (data = {}) => deps.emit({ type: FRAME, id, seq: seq++, final: false, ...data }),
      cancelled: () => s.cancelled,
      tick: async (ms = 0) => { await turn(ms); if (s.cancelled) throw new Cancelled(); },
    };
    try {
      await handler(msg.input, api);
      if (s.cancelled) deps.emit({ type: CANCELLED, id, seq });
      else deps.emit({ type: FRAME, id, seq, final: true, grantId: decision.grantId });
    } catch (e) {
      if (e instanceof Cancelled) deps.emit({ type: CANCELLED, id, seq });
      else deps.emit({ type: ERROR, id, reason: e.message });
    } finally {
      inflight.delete(id);
    }
  }

  // Process one inbound port message. A REQUEST starts a (background) streaming handler; a CANCEL flips
  // the flag its tick() will observe. Returns the request's promise for REQUEST (so tests can await it),
  // undefined otherwise.
  function handle(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === REQUEST) return runRequest(msg);
    if (msg.type === CANCEL) { const s = inflight.get(msg.id); if (s) s.cancelled = true; return; }
    // unknown/foreign messages are ignored (the transport already filters by prefix)
  }

  return { handle, inflight };
}

// ---- the thin transport (browser-only; the view, not the logic) --------------------------------------

// ELEVATED: spawn a `data:` chamber in a sandboxed iframe, do the inverted hello (Edge 6), and hand it a
// private MessagePort (the capability, Edge 1). Returns { port, teardown }. `chamberHtml` is the full
// chamber document; it must postMessage {type:READY} to its parent on boot and then talk only down the
// port. `expectOrigin` (the Elevated origin) lets the chamber authorize us back (Edge 1 bonus: mutual
// auth). Teardown closes the port (revokes every capability at once — Edge 6) and removes the iframe.
export function spawnChamber(chamberHtml, { sandbox = "allow-scripts", document: doc = globalThis.document,
                                            targetWindow = globalThis } = {}) {
  const iframe = doc.createElement("iframe");
  if (sandbox) iframe.setAttribute("sandbox", sandbox);
  iframe.src = "data:text/html," + encodeURIComponent(chamberHtml);
  doc.body.appendChild(iframe);
  const channel = new MessageChannel();
  return new Promise((resolve) => {
    const onReady = (event) => {
      if (event.source !== iframe.contentWindow) return;
      if (!event.data || event.data.type !== READY) return;
      targetWindow.removeEventListener("message", onReady);
      iframe.contentWindow.postMessage({ type: INIT }, "*", [channel.port2]); // transfer the capability
      const teardown = () => { try { channel.port1.close(); } catch {} iframe.remove(); };
      resolve({ port: channel.port1, iframe, teardown });
    };
    targetWindow.addEventListener("message", onReady);
  });
}

// ELEVATED: serve a session over the port. Wires port messages -> session.handle and session frames ->
// port.postMessage. Returns a stop() that closes the port (the unilateral, silent revocation).
export function serveProbeLine(port, deps = {}) {
  const session = elevatedSession({ ...deps, emit: (frame) => port.postMessage(frame) });
  port.onmessage = (event) => {
    const d = event.data;
    if (!d || typeof d.type !== "string" || !d.type.startsWith("probe.line.")) return;
    session.handle(d);
  };
  port.start && port.start();
  return { session, stop: () => { try { port.close(); } catch {} } };
}

// CHAMBER: a fluent client over the port the chamber received on {type:INIT}. Correlates frames back to
// their request by id and streams them to onFrame; resolves when the final frame lands, rejects on error.
export function connectProbeLine(port, { newId } = {}) {
  const streams = new Map();
  let counter = 0;
  const mkId = newId || (() => "r" + (++counter));
  port.onmessage = (event) => {
    const d = event.data; if (!d || !d.id) return;
    const st = streams.get(d.id); if (!st) return;
    if (d.type === FRAME && d.final) { streams.delete(d.id); st.resolve({ frames: st.frames, grantId: d.grantId }); }
    else if (d.type === FRAME) { st.frames.push(d); st.onFrame && st.onFrame(d); }
    else if (d.type === CANCELLED) { streams.delete(d.id); st.resolve({ frames: st.frames, cancelled: true }); }
    else if (d.type === ERROR) { streams.delete(d.id); st.reject(Object.assign(new Error(d.reason), { needsConfirm: d.needsConfirm, rung: d.rung })); }
  };
  port.start && port.start();
  function invoke(op, input, opts = {}) {
    const id = opts.id || mkId();
    return new Promise((resolve, reject) => {
      streams.set(id, { frames: [], onFrame: opts.onFrame, resolve, reject });
      port.postMessage(request({ id, op, input, behavior: opts.behavior, scope: opts.scope, confirmed: opts.confirmed }));
    });
  }
  const abort = (id) => port.postMessage(cancel({ id }));
  return { invoke, cancel: abort };
}
