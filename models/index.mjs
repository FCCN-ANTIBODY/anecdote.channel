// models/index.mjs — THE MODELS HUB: the first page that is NOT a bottle. A pure CLIENT that reaches canonical
// model bottles and probes them for a capability. It holds no key of its own, vends no port, and serves
// nothing — so being embedded by anyone confers NOTHING. The hub is a pure INITIATOR: it never registers a
// listener for, nor acts on, a message from its own parent. All power flows the other way — IT iframes
// bottles, and what runs inside a bottle is gated by the USER's operate-grant (composer/bottle-grant), never
// by who opened the hub. (embedBottle only ever reacts to ITS OWN bottle child, filtered by event.source, and
// drops that listener on READY; serveOnHello — the side that listens for a parent — is never called here.)
//
// The caller half only: probeEngine + a PREFERENCE LIST. The heavy model runtime lives in the BOTTLE (like
// git-enough's repo work); the hub drives thin clients over the probe and tears them down. Dual-use: import it
// (makeHub) to resolve capabilities from anywhere same-origin, or load it as the /models/ page (the inspector
// at the bottom auto-runs only when a #hub element is present).

import { probeEngine, resolveCapability } from "../composer/probe-engine.mjs";
import { engineBottleUrl } from "../composer/bottle-uri.mjs";
import { embedBottle } from "../git-enough/bottle.mjs"; // the generic iframe transport (browser-only lives here)

// The preference list: capability tag -> canonical model names to TRY, in order. This is NOT a registry —
// models are open-ended and homebrewable, so there is no list of "what exists"; you address by name and probe.
// Editing this map (or a service-worker-served local copy of it) is the gravel-appropriate way to homebrew
// which models a device reaches for. The names are DNS-legal slugs — each is a canonical bottle at
// <name>.bottles.anecdote.channel.
export const DEFAULT_PREFERENCES = {
  embedder:  ["all-minilm-l6-v2"],  // synonymy for matching (the MiniLM already vendored under /models/Xenova)
  namer:     ["flan-t5-namer"],     // the TYPIFYING grouper — fixes the stalled subtractive labels
  extractor: ["gas-sign-ocr"],      // media -> datum (the photo sink); absent on most devices, by design
};

// Make a hub bound to the pinned platform key. `resolve(tag)` walks the preference list for that capability and
// returns the first present model (with its teardown) or a single { present:false } to degrade on; `probe(name)`
// tests one canonical name. Neither throws for a model being unavailable — absence is a value, not a fault.
export function makeHub({ platformKey, preferences = DEFAULT_PREFERENCES, timeoutMs, embed = embedBottle } = {}) {
  if (!platformKey) throw new Error("models-hub: needs the pinned platform key (the firmware signer)");
  return {
    preferences,
    platformKey,
    probe: (name) => probeEngine(name, { platformKey, embed, timeoutMs }),
    resolve: (tag) => resolveCapability({ tag, names: preferences[tag] || [], platformKey, embed, timeoutMs }),
  };
}

// Source the platform key the SHELL already pinned at first firmware contact (sw.js pinSet("by", …)). The hub
// never mints or holds a key; it reads the one identity that signs the shell, so a model can only load if it
// is signed by that same identity. Returns the key string, or null if nothing is pinned yet.
export function pinnedPlatformKey() {
  return new Promise((resolve) => {
    let settle = (v) => { settle = () => {}; resolve(v); };
    try {
      const r = indexedDB.open("anecdote-firmware", 1);
      r.onupgradeneeded = () => { try { r.result.createObjectStore("pin"); } catch {} };
      r.onerror = () => settle(null);
      r.onsuccess = () => {
        try {
          const rq = r.result.transaction("pin").objectStore("pin").get("by");
          rq.onsuccess = () => settle(rq.result ?? null);
          rq.onerror = () => settle(null);
        } catch { settle(null); }
      };
    } catch { settle(null); }
  });
}

// ---- the /models/ page inspector (auto-runs only as the top document, when #hub exists) ------------------
// A live, honest diagnostic: source the pin, then probe every name in the preference list and show its verdict.
// Until any model bottle is deployed, every probe returns absent (its bottle never announces READY) — which is
// exactly the degradation path made visible. Kept out of the library path by the #hub guard.
async function runInspector(root) {
  const line = (html) => { const d = document.createElement("div"); d.className = "row"; d.innerHTML = html; root.appendChild(d); };
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  const key = await pinnedPlatformKey();
  if (!key) {
    line(`<b class="warn">No platform key pinned yet.</b> Visit the app so the shell pins its firmware signer, then reload — the hub can't probe a model without the pin it must verify against.`);
    line(`<span class="dim">Preference list (what this device would reach for):</span>`);
    for (const [tag, names] of Object.entries(DEFAULT_PREFERENCES)) line(`<code>${esc(tag)}</code> → ${esc(names.join(", "))}`);
    return;
  }

  const hub = makeHub({ platformKey: key, timeoutMs: 2500 });
  line(`<span class="dim">Pinned platform key <code>${esc(key.slice(0, 16))}…</code> — probing the preference list (no bottle deployed yet ⇒ all absent, the degrade path live):</span>`);

  for (const [tag, names] of Object.entries(hub.preferences)) {
    for (const name of names) {
      const url = engineBottleUrl(name);
      const id = "p_" + tag + "_" + name.replace(/[^a-z0-9]/g, "");
      line(`<code>${esc(tag)}</code> · <code>${esc(name)}</code> <span class="dim">${esc(url)}</span> — <span id="${id}" class="pending">probing…</span>`);
      hub.probe(name).then((r) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.className = r.present ? "ok" : "absent";
        el.textContent = r.present ? "present ✓" : "absent — " + (r.reason || "unavailable");
      });
    }
  }
}

if (typeof document !== "undefined" && document.getElementById && document.getElementById("hub")) {
  // Register the shell SW so /models/ is offline-capable on a direct visit (no inline script — CSP script-src 'self').
  if ("serviceWorker" in navigator) {
    addEventListener("load", () => { navigator.serviceWorker.register("/sw.js", { type: "module" }).catch(() => {}); });
  }
  runInspector(document.getElementById("hub"));
}
