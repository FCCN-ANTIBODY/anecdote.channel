// probe-test/poll-answer.ui.test.mjs — poll.html, the ANSWER RUNTIME, driven in real Chromium. This
// page is the constellation's one answer-time view (tell.anecdote.channel forwards to it; the Floor's
// per-question iframes land on the same layout via Tell's preview) — so proving it renders, offers
// options only as suggestions, always accepts a custom answer, and phones NOBODY is the ground the
// whole puppeted-viewer story stands on. Exercised against the real page + real composer modules over
// the real probe line into a real data: chamber:
//   1. a full QR query renders the question, its suggestions, and the forced terms pointer;
//   2. an option click is only a SUGGESTION — it fills the custom field, which stays editable;
//   3. with no public route configured the confirmed submit HOLDS (offline-honest), never errors;
//   4. the no-query and missing-param failures render their distinct diagnoses (observability);
//   5. the page reaches only its own origin — no foreign host, ever.
// Run: node probe-test/poll-answer.ui.test.mjs   (skips cleanly when no Chromium is available)
import { findChromium, withPage } from "./harness.mjs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const chromium = findChromium();
if (!chromium) {
  console.log("skip: no chromium in this environment (set CHROMIUM=/path/to/chromium to run)");
  process.exit(0);
}

const TERMS = "sha256:" + "ab".repeat(32);
const QR = "pile=riverbend&poll=parks-2026&round=1&tok=TESTTOK"
  + "&q=" + encodeURIComponent("What should the north meadow become?")
  + "&opts=" + encodeURIComponent("a dog park,a wetland,leave it wild")
  + "&guidance=" + encodeURIComponent("One idea per reply.")
  + "&constitution=" + TERMS;

await withPage({ chromium, origins: { "anecdote.channel": { root } } }, async (page, { server }) => {
  // 1 — the loaded view.
  await page.goto(server.urlFor("anecdote.channel", "/poll.html?" + QR));
  await page.waitFor("!!document.querySelector('h3')", { frame: "data:" });
  const question = await page.eval("document.querySelector('h3').textContent", { frame: "data:" });
  ok(question === "What should the north meadow become?", "the chamber renders the question");
  const opts = await page.eval("[...document.querySelectorAll('.opt')].map((b) => b.textContent)", { frame: "data:" });
  ok(opts.join("|") === "a dog park|a wetland|leave it wild", "the three options render as suggestions");
  const guide = await page.eval("(document.querySelector('.guide')||{}).textContent || ''", { frame: "data:" });
  ok(guide === "One idea per reply.", "guidance rides along");
  const fine = await page.eval("[...document.querySelectorAll('.fine')].map((n) => n.textContent).join(' ')", { frame: "data:" });
  ok(fine.includes(TERMS.slice(0, 23)), "the constitution pointer is shown — answers wear their terms");
  ok(await page.eval("document.getElementById('go').disabled", { frame: "data:" }) === true,
     "send is disabled until an answer exists");

  // 2 — options are suggestions; the answer stays the visitor's to write.
  await page.eval("document.querySelectorAll('.opt')[1].click()", { frame: "data:" });
  ok(await page.eval("document.getElementById('ans').value", { frame: "data:" }) === "a wetland",
     "clicking an option fills the custom field");
  ok(await page.eval("document.getElementById('go').disabled", { frame: "data:" }) === false,
     "a filled answer enables send");
  await page.eval("const t=document.getElementById('ans'); t.value='rewild it, but keep the path'; t.dispatchEvent(new Event('input'))", { frame: "data:" });
  ok(await page.eval("document.getElementById('ans').value", { frame: "data:" }) === "rewild it, but keep the path",
     "the custom answer overrides — always the visitor's words");

  // 3 — the confirmed submit with no public route HOLDS, honestly.
  await page.eval("document.getElementById('go').click()", { frame: "data:" });
  const outcome = await page.waitFor("(document.getElementById('out')||{}).textContent || ''", { frame: "data:" });
  ok(outcome.includes("Held"), "no route configured → the reply is HELD for the mesh, not errored: " + outcome.trim());

  // 5 — the network stayed home.
  const hosts = [...new Set(page.requests.filter((r) => /^https?:/.test(r.url)).map((r) => new URL(r.url).hostname))];
  ok(hosts.every((h) => h === "anecdote.channel"), "every request stayed on anecdote.channel: " + hosts.join(", "));
  ok(server.foreign.length === 0, "no request escaped to any host the test did not stand up");
});

// 4 — the two failure diagnoses are distinct (a second browser run, fresh page state).
await withPage({ chromium, origins: { "anecdote.channel": { root } } }, async (page, { server }) => {
  await page.goto(server.urlFor("anecdote.channel", "/poll.html"));
  const empty = await page.waitFor("(document.querySelector('.fine')||{}).textContent || ''", { frame: "data:" });
  ok(empty.includes("no query at all"), "no query → 'carried no query' diagnosis");

  await page.goto(server.urlFor("anecdote.channel", "/poll.html?pile=riverbend&poll=parks-2026&q=hello"));
  const missing = await page.waitFor("((document.querySelector('.fine')||{}).textContent || '').includes('missing') && document.querySelector('.fine').textContent", { frame: "data:" });
  ok(missing.includes("round") && missing.includes("tok"), "a partial query names exactly what is missing (round, tok)");
});

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall poll-answer UI tests passed (the real page, the real chamber, no network)");
