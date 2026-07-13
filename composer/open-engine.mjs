// composer/open-engine.mjs — the CONSUMER bootstrap that closes the install loop. Given a connected probe
// client to a storage-engine bottle (composer/probe-line connectProbeLine, or git-enough embedBottle), it:
//   1. calls the engine's `install` op (composer/install-op) → the pre-minted, platform-signed manifest,
//   2. verifies it against the consumer's OWN pinned platform key (composer/install verifyInstall),
//   3. mounts + imports the entry (composer/install-loader loadInstall) — the glove,
//   4. WIRES the freshly-worn client back onto the SAME probe: the entry default-exports make(invoke), so the
//      delivered code drives the engine's domain ops (git.*) over the very port it arrived through.
// The result is a driven client the consumer never had to vendor: borrowed at runtime, dropped on reload.
//
// This is engine-agnostic. The only convention it fixes is the single entry's shape: `export default
// (invoke) => client` — the request-half factory (git-enough/git-client makeGitClient is exactly this). An
// engine that ships a different entry shape passes its own `wire`.
//
// verify/load/wire/import are injected (defaulting to the real modules) so the whole bootstrap is
// Node-testable end to end, down to the real git-client source, without a browser.

import { verifyInstall as defaultVerify } from "./install.mjs";
import { loadInstall as defaultLoad } from "./install-loader.mjs";
import { engineBottleUrl } from "./bottle-uri.mjs";

const firstFrame = (res) => (res && Array.isArray(res.frames) && res.frames.length ? res.frames[0] : null);

// client: a connected probe client exposing invoke(op, input, opts) => Promise<{ frames }>.
// opts: { platformKey (required — the consumer's pin), verify?, load?, wire?, loadOpts? }.
// Returns { client: <driven>, module, revoke, verified }. Throws (and revokes any mount) if install doesn't
// verify — an engine whose blobs aren't signed by the pin gets nothing loaded, exactly like the boot gate.
export async function openEngine(client, { platformKey, verify, load, wire, loadOpts } = {}) {
  if (!client || typeof client.invoke !== "function") throw new Error("open-engine: needs a connected probe client (invoke)");
  if (!platformKey) throw new Error("open-engine: needs the consumer's pinned platformKey");

  const manifest = firstFrame(await client.invoke("install", {})); // Rung 0: no confirmation to read blobs
  const verified = await (verify || defaultVerify)(manifest, { platformKey });
  if (!verified.ok) throw new Error("open-engine: install did not verify against the pin: " + (verified.reason || "unknown"));

  const loaded = await (load || defaultLoad)(verified, loadOpts || {});
  const wireFn = wire || ((module, invoke) => {
    const make = module && (module.default || module.make);
    if (typeof make !== "function") throw new Error("open-engine: the install entry must default-export make(invoke)");
    return make(invoke);
  });

  try {
    return { client: wireFn(loaded.module, client.invoke), module: loaded.module, revoke: loaded.revoke, verified };
  } catch (e) {
    loaded.revoke(); // a bad entry shape leaves no Blob URLs behind
    throw e;
  }
}

// The consumer's FRONT DOOR: resolve a storage adapter NAME to its canonical engine bottle (bottle-uri
// engineBottleUrl), embed it, and open it. `embed(url) => Promise<{ client, teardown }>` is injected
// (git-enough embedBottle in the browser), so composer stays free of the iframe transport — the tell floor's
// `open` seam is exactly this call with embedBottle passed in. Returns openEngine's result plus the resolved
// `url` and the embed's `teardown`. Throws (tearing the embed down) if the name resolves to no engine or the
// install doesn't verify.
export async function openEngineByName(adapter, { embed, platformKey, ...rest } = {}) {
  if (typeof embed !== "function") throw new Error("open-engine: openEngineByName needs an embed(url) transport");
  const url = engineBottleUrl(adapter);
  if (!url) throw new Error("open-engine: '" + adapter + "' is not a resolvable engine name");
  const embedded = await embed(url);
  try {
    const opened = await openEngine(embedded.client, { platformKey, ...rest });
    return { ...opened, url, teardown: embedded.teardown };
  } catch (e) {
    if (embedded && typeof embedded.teardown === "function") embedded.teardown();
    throw e;
  }
}

export default openEngine;
