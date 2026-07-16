// composer/probe-engine.mjs — probeEngine: the PRESENCE-AND-DEGRADE sibling of open-engine.
//
// openEngine/openEngineByName are built for a REQUIRED capability — a data-pile's storage adapter. They
// assume the bottle is there and THROW if it isn't, or if its install doesn't verify: a missing adapter is a
// genuine fault, and that is correct for storage. Models are the opposite. They are TIERED and optional — a
// device legitimately may not hold the grouper or the photo extractor — and the whole degradation ladder
// depends on absence being a PLANNED BRANCH, not a crash. So a caller that wants a model must PROBE, not
// assume.
//
// probeEngine reaches a canonical model bottle exactly as a consumer would (resolve name -> engine bottle,
// iframe it, wait for READY, install, verify against the pinned platform key, load) — but every way that can
// fail collapses into ONE first-class value: { present:false, reason }. Three failures, one branch, because
// the caller degrades identically for all three (it keeps the human's declaration / the subtractive label):
//   1. ABSENT       — the bottle's boot gate offered nothing, so READY never comes: the embed never resolves,
//                     and we time out.  (bottle.mjs serveOnHello announces no READY when its self-attestation
//                     doesn't verify for its host — "offers nothing" is a real, silent signal.)
//   2. INAUTHENTIC  — install doesn't verify against the pin (openEngine throws; it also tears the embed down).
//   3. INCAPACITY   — the weights fail to LOAD (the mobile-memory edge): loadInstall throws, openEngine tears
//                     the embed down. This is why capacity is only known after the load, not after the hello.
//
// Pure: the `openByName` seam (default openEngineByName) and the `embed` transport (default embedBottle) are
// injected, so the whole thing is Node-testable against a stub, like the gate's stub-engine test. Run-time
// incapacity (an OOM DURING an inference call, after a clean load) is the caller's concern — it treats a
// rejected op the same way, degrading to the declaration.
//
// Browser follow-up (tracked, not hidden): on a TIMEOUT the iframe was created inside embedBottle, which only
// returns its teardown on READY — so a handshake that never completes can leak the frame. We capture the
// embed handle here and tear it down if it arrives LATE (after we've given up); a bottle that never resolves
// at all still can't be reclaimed until embedBottle exposes the frame before READY. Noted for the real wiring.

import { embedBottle } from "../git-enough/bottle.mjs";
import { openEngineByName } from "./open-engine.mjs";

export const DEFAULT_TIMEOUT_MS = 8000;

const TIMED_OUT = Symbol("probe-engine.timeout");

// Race a pending promise against a timeout that RESOLVES (never rejects) to a sentinel, so a bottle that
// never announces READY reads as absent instead of hanging the caller forever. A real rejection still
// propagates (that is the inauthentic/incapacity path).
function raceTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(TIMED_OUT), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

// Probe for a model capability by canonical name. Returns:
//   { present:true,  name, url, client, module, verified, teardown }  — usable; caller MUST teardown when done
//   { present:false, name, reason }                                   — absent / inauthentic / no capacity
// Throws only for a programmer error (a missing pin) — never for the model being unavailable.
export async function probeEngine(name, { platformKey, timeoutMs = DEFAULT_TIMEOUT_MS, embed = embedBottle, openByName = openEngineByName, ...rest } = {}) {
  if (!platformKey) throw new Error("probe-engine: needs the consumer's pinned platformKey");

  let captured = null;
  const capturingEmbed = async (url) => { const h = await embed(url); captured = h; return h; };
  const attempt = openByName(name, { embed: capturingEmbed, platformKey, ...rest });

  try {
    const result = await raceTimeout(attempt, timeoutMs);
    if (result === TIMED_OUT) {
      // Give up now; if the embed lands late, reclaim its frame so a slow handshake doesn't leak.
      Promise.resolve().then(async () => {
        try { await attempt; } catch {}
        if (captured && typeof captured.teardown === "function") { try { captured.teardown(); } catch {} }
      });
      return { present: false, name, reason: `no READY within ${timeoutMs}ms — the bottle offered nothing` };
    }
    return {
      present: true, name, url: result.url,
      client: result.client, module: result.module, verified: result.verified,
      teardown: result.teardown,
    };
  } catch (e) {
    // openEngineByName already tore the embed down on throw. Inauthentic install or a failed load land here.
    return { present: false, name, reason: "install/load failed: " + ((e && e.message) || String(e)) };
  }
}

// Walk a PREFERENCE LIST of canonical names for a capability tag and return the first that probes present —
// the "grouped probe talking to each model directly." This is NOT a registry lookup (models are open-ended,
// homebrewable, un-enumerable): you address by name and probe, in order. Returns the usable capability (with
// its teardown) or { present:false } for the caller to degrade on. `probe` is injected for tests.
export async function resolveCapability({ tag, names = [], platformKey, timeoutMs, probe } = {}) {
  const tryOne = probe || ((name) => probeEngine(name, { platformKey, timeoutMs }));
  const attempts = [];
  for (const name of names) {
    const r = await tryOne(name, tag);
    attempts.push({ name, present: !!(r && r.present), reason: r && r.reason });
    if (r && r.present) return { ...r, tag, attempts };
  }
  return { present: false, tag, attempts, reason: names.length ? `no listed ${tag} model is available` : "no candidate names" };
}
