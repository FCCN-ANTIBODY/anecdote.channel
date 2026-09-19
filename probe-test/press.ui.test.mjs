// probe-test/press.ui.test.mjs — THE PRESS, IN A REAL BROWSER, ACROSS REAL ORIGINS.
//
// press/*.test.mjs prove the parts in Node. This proves the composition where it actually has to hold: a
// real Chromium, the true production hostnames, and genuine same-origin walls between them — the apex at
// anecdote.channel, bottles on the library's shelf at <label>.library.anecdote.channel, and a FLOOR that
// answers every path at every unclaimed label (the harness's `fallback`, i.e. a real wildcard mask).
//
// What it holds the press to:
//   - the halt fetches NOTHING from anywhere until a person acts (docs/single-attention.md)
//   - a README is shown as the index, in a data: chamber that cannot reach the network, and the bottle's own
//     <script> does not run in it (D15: viewing a bottle is always the sterile experience)
//   - a link pressed inside the chamber is ASKED about over the probe line and followed by the press;
//     a link out of the constellation moves nothing and is announced
//   - unbuilt Jekyll renders from source with its missing piece named; a miss on the shelf is the floor
//   - WRITE: a statement said over a page is signed, printed into a pile, and points at that page's version
//   - READ: a floor on ANOTHER ORIGIN holds the lens, the press does the catching, what arrives opens
//     sterile, and nothing is written until "Slap it down"
//   - one remembered view, restored on return
//
// Run: node probe-test/press.ui.test.mjs   (skips cleanly without a Chromium)
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { findChromium, withPage } from "./harness.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const chromium = findChromium();
if (!chromium) { console.log("skip: no chromium in this environment (set CHROMIUM=/path/to/chromium to run)"); process.exit(0); }

const shelf = (label) => ({ root: join(root, "press", "fixtures", "shelf", label) });
const floor = { root: join(root, "press", "floor"), fallback: "index.html" };   // every path answers with the tile
const origins = {
  "anecdote.channel": { root },
  "field-guide.library.anecdote.channel": shelf("field-guide"),
  "unbuilt.library.anecdote.channel": shelf("unbuilt"),
  "nobody-here.library.anecdote.channel": floor,
  "reader.library.anecdote.channel": floor,
  // A bottle that tries things. Its README carries a script and a link out of the constellation.
  "sly.library.anecdote.channel": { tree: { "README.md":
    "# sly\n\n<script>document.title = 'pwned'; parent.postMessage({ type: 'probe.line.ready/v1' }, '*');</script>\n\n[leave](https://example.com/elsewhere) and [stay](notes.md)\n",
    "notes.md": "# notes\n\nstill here\n" } },
};

const ran = await withPage({ origins, chromium }, async (page, { server: h }) => {
  const at = (host, path = "/") => h.urlFor(host, path);
  const info = () => page.eval("JSON.stringify(__press.info())").then(JSON.parse);
  const go = (view) => page.eval(`__press.go(${JSON.stringify(view)}).then(() => true)`);

  // ---- 1. the halt -------------------------------------------------------------------------------
  await page.goto(at("anecdote.channel", "/press/halt.html"));
  await page.waitFor("!!globalThis.__press");
  ok(await page.eval("!document.getElementById('nothing').hidden && document.getElementById('stage').hidden"), "the page opens on nothing, and says so");
  ok((await info()) === null, "info() is null at the halt — nothing is on purpose");
  ok(h.served.every((s) => s.host === "anecdote.channel") && h.foreign.length === 0, "arriving fetched nothing from any other origin");

  // ---- 2. README as the index, sterile -------------------------------------------------------------
  await go({ address: "field-guide.library", path: "" });
  await page.waitFor("!!document.querySelector('h1')", { frame: "data:" });
  let i = await info();
  ok(i.face.face === "README.md" && i.kind === "bottle" && i.exhibit.strip.length === 3 && i.exhibit.canon.length === 4, "the shelf bottle's README is its face; strip and canon read from it");
  ok(await page.eval("document.querySelector('h1').textContent", { frame: "data:" }) === "A field guide to shade", "rendered inside the data: chamber");
  ok(await page.eval("document.querySelectorAll('#strip a').length") === 8 && await page.eval("document.querySelector('#strip a[aria-current=page]').textContent") === "A field guide to shade", "the strip is drawn as tabs (door + 3 + 4 canon), the door current");
  ok(await page.eval(`fetch(${JSON.stringify(at("anecdote.channel", "/NAME"))}).then(() => "reached", () => "blocked")`, { frame: "data:" }) === "blocked", "the chamber cannot reach the network");
  ok(await page.eval("typeof (self.crypto && self.crypto.subtle)", { frame: "data:" }) === "undefined" && await page.eval("location.origin", { frame: "data:" }) === "null", "no WebCrypto, no origin: powerless");
  ok(await page.eval("getComputedStyle(document.body).getPropertyValue('--ink').trim()", { frame: "data:" }) === "#0A0A0A", "the design tokens crossed by construction, not inheritance");

  // ---- 3. a link pressed in the chamber is asked about, and the press follows it ---------------------
  await page.eval(`document.querySelector('a[href="docs/method.md"]').click()`, { frame: "data:" });
  await page.waitFor("__press.info() && __press.info().face.path === 'docs/method.md'");
  await page.waitFor("document.querySelector('h1') && document.querySelector('h1').textContent === 'Method'", { frame: "data:" });
  ok((await page.eval("location.hash")) === "#/field-guide.library/docs/method.md", "the view is a link: " + await page.eval("location.hash"));
  ok(await page.eval("document.querySelector('#strip a[aria-current=page]').textContent") === "Method", "the strip stayed put and moved its mark");
  ok(await page.eval("document.querySelector('ol li') ? document.querySelectorAll('ol li').length : 0", { frame: "data:" }) === 3, "a numbered list rendered (the README dialect, in front of markdown-enough)");

  // ---- 4. a sly bottle: its script is inert, and leaving is announced, never followed ----------------
  await go({ address: "sly.library", path: "" });
  await page.waitFor("document.querySelector('h1') && document.querySelector('h1').textContent === 'sly'", { frame: "data:" });
  ok(await page.eval("document.title", { frame: "data:" }) === "sly", "the bottle's <script> did not run (title is ours, not 'pwned')");
  await page.eval(`document.querySelector('a[href^="https://example.com"]').click()`, { frame: "data:" });
  await page.waitFor("!document.getElementById('leaving').hidden");
  ok((await page.eval("document.getElementById('leaving').textContent")).includes("https://example.com/elsewhere"), "a link out of the constellation is announced");
  ok((await info()).view.address === "sly.library" && !h.served.some((s) => /example\.com/.test(s.host)) && !h.foreign.some((f) => /example\.com/.test(f.host)), "…and nothing moved, and nothing was fetched from there");

  // ---- 5. unbuilt source; and a miss on the shelf ---------------------------------------------------
  await go({ address: "unbuilt.library", path: "" });
  i = await info();
  ok(i.face.face === "source" && i.face.gaps.length === 1 && /weather\.html/.test(i.face.gaps[0]), "unbuilt Jekyll rendered from source; the one missing include is named: " + i.face.gaps[0]);
  await page.waitFor("!!document.querySelector('.gaps')", { frame: "data:" });
  ok((await page.eval("document.body.textContent", { frame: "data:" })).includes("street sweeping, north side"), "layout + include + _data all made it into the face");

  await go({ address: "nobody-here.library", path: "" });
  i = await info();
  ok(i.view.mode === "live" && i.face.face === "live", "a wildcard floor answers every path with its tile — read as 'only a built page here', so it is framed live");
  await page.waitFor("document.getElementById('label') && document.getElementById('label').textContent === 'nobody-here'", { frame: "nobody-here.library" });
  ok(true, "a miss on the rack is the floor, and the floor knows the label it was reached at");

  // ---- 6. WRITE: said over a page, signed, printed, pointing at the version ---------------------------
  await go({ address: "field-guide.library", path: "docs/method.md" });
  await page.eval(`(() => { const s = document.getElementById("say"); s.value = "A bus shelter should only count when the bench is usable."; document.getElementById("line").requestSubmit(); })()`);
  await page.waitFor("__press.info() && __press.info().view.pile === 'notes'", { timeout: 20000 });
  const printed = JSON.parse(await page.eval(`(async () => { const p = await __press.pile("notes"); const f = p.files().find((x) => /^anecdotes\\//.test(x.path));
    const a = JSON.parse(await p.fetchText(f.path)); return JSON.stringify({ files: p.files().map((x) => x.path), log: p.history().map((c) => c.message), refs: a.body.slice(1), sig: !!a.sig, text: a.body[0].text }); })()`));
  ok(printed.sig && printed.text.startsWith("A bus shelter") && printed.log.length === 1 && printed.log[0].startsWith("print: "), "signed here and printed as one commit: " + printed.log[0]);
  ok(printed.refs.length === 1 && printed.refs[0].source === at("field-guide.library.anecdote.channel", "/docs/method.md") && /^sha256:/.test(printed.refs[0].hash) && !("bytes" in printed.refs[0]),
     "it points at the VERSION of the page it was said over — by hash, with none of the page copied");
  ok(printed.files.includes("index.md") && (await info()).face.face === "index.md", "the pile keeps its own front page, and that is its face");
  await page.waitFor("document.querySelector('.pour') && document.querySelector('.pour').dataset.recording === 'ready'");
  ok(await page.eval("document.querySelector('.pour canvas').width > 100"), "and it is already pouring as light");

  // ---- 7. READ: the lens is on another origin; the press does the catching ----------------------------
  const frames = await page.eval("__pressPour.recording(__pressPour.K * 4).trim().split('\\n')");
  await page.eval("document.getElementById('read').click()");
  await page.waitFor("!!globalThis.__floorFeed", { frame: "reader.library" });
  ok(await page.eval("document.querySelector('.floorframe iframe').getAttribute('allow')") === "camera", "the floor was embedded with the camera delegated, before it loaded");
  await page.waitFor("/holds the lens/.test(document.getElementById('side').textContent)");
  // Every third frame is dented on the way to the lens: the healing has to be real for this to pass.
  const dented = frames.map((f, n) => (n % 3 === 2 ? f.slice(0, -3) + (f.at(-3) === "A" ? "B" : "A") + f.slice(-2) : f));
  await page.eval(`__floorFeed(${JSON.stringify(dented)})`, { frame: "reader.library" });
  await page.waitFor("!!document.querySelector('[data-caught]')", { timeout: 30000 });
  ok((await page.eval("document.querySelector('[data-caught] .kind').textContent")) === "an anecdote", "caught across origins, through damage: " + await page.eval("document.querySelector('#side [role=status]').textContent"));
  const before = await page.eval(`__press.pile("notes").then((p) => p.files().length)`);
  await page.eval("document.querySelector('[data-caught] .chip').click()");            // look at it
  await page.waitFor("__press.info() && __press.info().kind === 'caught'");
  await page.waitFor("document.querySelector('h1') && /bus shelter/.test(document.querySelector('h1').textContent)", { frame: "data:" });
  ok(await page.eval(`__press.pile("notes").then((p) => p.files().length)`) === before, "looking wrote nothing: loaded is not persisted");
  ok(!(await page.eval("location.hash")).includes("caught"), "a bottle in hand is not a link — it is not kept, so there is nowhere for a link to point");
  await page.eval(`(() => { const c = document.querySelector('[data-caught]'); c.querySelector('.pilename').value = 'notes'; c.querySelector('.strikebtn').click(); })()`);
  await page.waitFor(`/Kept, whole/.test(document.querySelector('[data-caught]').textContent)`);
  const kept = JSON.parse(await page.eval(`__press.pile("notes").then(async (p) => { const f = p.files().find((x) => x.path.startsWith("caught/")); return JSON.stringify({ path: f.path, log: p.history()[0].message, schema: JSON.parse(await p.fetchText(f.path)).schema }); })`));
  ok(/^caught\/[0-9a-f]{16}\.anecdote\.json$/.test(kept.path) && kept.schema === "anecdote.transfer/v1" && kept.log.startsWith("caught: "), "slapped down: the SEED, whole, as its own commit — " + kept.path);

  // ---- 8. one remembered view ------------------------------------------------------------------------
  await go({ address: "field-guide.library", path: "OPEN.md" });
  const slot = JSON.parse(await page.eval("localStorage.getItem('anecdote.press.view/v1')"));
  ok(Object.keys(slot).length === 1 && slot.halt.path === "OPEN.md" && !Array.isArray(slot.halt), "one slot, the view you are on — no trail");
  await page.goto(at("anecdote.channel", "/press/halt.html"));
  await page.waitFor("__press && __press.info() && __press.info().face && __press.info().face.path === 'OPEN.md'");
  ok(true, "coming back is coming back to the same page");
  await page.eval("document.querySelector('.ribbon a.chip').click()");                     // stop
  await page.waitFor("!document.getElementById('nothing').hidden");
  ok(await page.eval("localStorage.getItem('anecdote.press.view/v1')") === null && (await page.eval("location.hash")) === "", "stop returns to nothing and forgets, leaving no key behind");

  // ---- 9. the other skins boot on the same engine ----------------------------------------------------
  for (const [skin, ready] of [["bench.html", "!!document.querySelector('#rack h3')"], ["counter.html", "!!document.getElementById('give')"], ["overlay.html", "__press.info() && __press.info().face.path === 'README.md'"]]) {
    await page.goto(at("anecdote.channel", "/press/" + skin));
    await page.waitFor("!!globalThis.__press");
    await page.waitFor(ready);
    ok(true, skin + " boots");
  }
  ok((await page.eval("document.querySelectorAll('#rack a').length")) > 0 && (await page.eval("[...document.querySelectorAll('#rack a')].some((a) => a.textContent.startsWith('notes'))")), "and the pile printed in one skin is on the rack in another");
  ok(h.foreign.length === 0, "no request escaped the constellation in the whole run: " + JSON.stringify(h.foreign.slice(0, 3)));
});

if (!ran) { console.log("skip: the harness could not start (no browser, or no TLS tooling)"); process.exit(0); }
if (fails) { console.error(`\n${fails} failed`); process.exit(1); }
console.log("\npress ui: all passed");
