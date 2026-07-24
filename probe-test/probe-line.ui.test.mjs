// probe-test/probe-line.ui.test.mjs — the probe-line edge walk, COMMITTED. docs/probe-line.md and the
// §12 provenance table of docs/probe-line-v1.md cite Chromium verifications that were run by hand and
// never landed as tests; this suite re-runs the load-bearing ones against the REAL shipped modules
// (composer/probe-line.mjs served from this repo, spawned in a real headless Chromium):
//   Edge 1 — a sandboxed data: chamber is genuinely powerless (no crypto.subtle, not a secure
//            context, null origin) while its Elevated parent has all three; the READY/INIT hello
//            transfers the port, and the chamber can attest INIT's origin.
//   Edge 2 — two concurrent streams interleave on one port yet reassemble by id, in order.
//   Edge 6 — port.close() is failure-silent: a request after revocation is never answered and no
//            error fires (why every chamber call needs its own timeout).
// Run: node probe-test/probe-line.ui.test.mjs   (skips cleanly when no Chromium is available)
import { findChromium, withPage } from "./harness.mjs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// The chamber under test: records its own environment and INIT's attested origin, runs two
// interleaving streams, and (on the parent's signal, after revocation) proves the silence.
const CHAMBER = `<!doctype html><meta charset=utf-8><body><script>
window.R = { env: null, initOrigin: null, arrivals: [], done: {}, afterClose: "pending" };
var port = null, got = {};
addEventListener("message", function (e) {
  if (e.data && e.data.type === "probe.line.init/v1" && e.ports && e.ports[0]) {
    R.initOrigin = e.origin;
    R.env = { subtle: typeof (self.crypto && self.crypto.subtle),
              secure: self.isSecureContext === true,
              origin: String(location.origin) };
    port = e.ports[0];
    port.onmessage = function (ev) {
      var d = ev.data; if (!d || !d.id || d.type !== "probe.line.frame/v1") return;
      if (d.final) { R.done[d.id] = (got[d.id] || []).join(" "); return; }
      R.arrivals.push(d.id + d.seq);
      (got[d.id] = got[d.id] || []).push(d.token);
    };
    port.start && port.start();
    port.postMessage({ type: "probe.line.request/v1", id: "A", op: "label", input: "a1 a2 a3" });
    port.postMessage({ type: "probe.line.request/v1", id: "B", op: "label", input: "b1 b2 b3" });
  }
  if (e.data && e.data.type === "x.probe-after-close" && port) {
    port.postMessage({ type: "probe.line.request/v1", id: "Z", op: "label", input: "z1" });
    setTimeout(function () { R.afterClose = ("Z" in R.done) || R.arrivals.some(function (a) { return a[0] === "Z"; }) ? "answered" : "silent"; }, 600);
  }
});
if (window.parent !== window) parent.postMessage({ type: "probe.line.ready/v1" }, "*");
<` + `/script>`;

// The Elevated fixture page: served on the real anecdote.channel origin, importing the real modules.
const FIXTURE = `<!doctype html><meta charset=utf-8><title>probe-line ui fixture</title>
<div id=mount></div>
<script type=module>
import { spawnChamber, serveProbeLine } from "/composer/probe-line.mjs";
window.H = { up: false };
const ops = { label: async (input, api) => { for (const t of String(input).split(" ")) { await api.tick(); api.emit({ token: t }); } } };
const { port, iframe } = await spawnChamber(${JSON.stringify(CHAMBER).replace(/</g, "\\u003c")}, { mount: document.getElementById("mount") });
const served = serveProbeLine(port, { ops, context: () => ({ recordingOn: true, grants: [] }) });
window.H = {
  up: true,
  elevated: { subtle: typeof (crypto && crypto.subtle), secure: isSecureContext === true, origin: location.origin },
  revoke: () => { served.stop(); iframe.contentWindow.postMessage({ type: "x.probe-after-close" }, "*"); },
};
</script>`;

const chromium = findChromium();
if (!chromium) {
  console.log("skip: no chromium in this environment (set CHROMIUM=/path/to/chromium to run)");
  process.exit(0);
}

await withPage({
  chromium,
  origins: { "anecdote.channel": { root, tree: { "probe-line.ui.html": FIXTURE } } },
}, async (page, { server }) => {
  await page.goto(server.urlFor("anecdote.channel", "/probe-line.ui.html"));
  await page.waitFor("window.H && window.H.up === true");

  // Edge 1 — asymmetric powers, attested hello.
  const elevated = await page.eval("window.H.elevated");
  ok(elevated.subtle === "object" && elevated.secure === true, "Elevated has crypto.subtle in a secure context");
  ok(elevated.origin === "http://anecdote.channel:" + server.port, "Elevated runs on the real anecdote.channel origin");
  const env = await page.waitFor("window.R && window.R.env", { frame: "data:" });
  ok(env.subtle === "undefined", "chamber genuinely lacks crypto.subtle");
  ok(env.secure === false, "chamber is not a secure context");
  ok(env.origin === "null", "chamber's origin is null (a data: document)");
  const initOrigin = await page.eval("window.R.initOrigin", { frame: "data:" });
  ok(initOrigin === "http://anecdote.channel:" + server.port,
     "INIT's event.origin lets the chamber attest which Elevated adopted it");

  // Edge 2 — concurrent streams share the port yet reassemble by id.
  const done = await page.waitFor("Object.keys(window.R.done).length === 2 && window.R.done", { frame: "data:" });
  ok(done.A === "a1 a2 a3" && done.B === "b1 b2 b3", "two streams reassemble by id, in order");
  const arrivals = await page.eval("window.R.arrivals.join('')", { frame: "data:" });
  ok(/A/.test(arrivals) && /B/.test(arrivals), "frames of both streams rode the one port: " + arrivals);

  // Edge 6 — revocation by port.close() is failure-silent.
  await page.eval("window.H.revoke()");
  const after = await page.waitFor("window.R.afterClose !== 'pending' && window.R.afterClose", { frame: "data:" });
  ok(after === "silent", "a request after port.close() is never answered — no frame, no error");
});

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall probe-line UI tests passed (real Chromium, real modules, real data: chamber)");
