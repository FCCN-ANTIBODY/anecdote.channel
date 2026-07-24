// probe-test/submit.ui.test.mjs — THE SUBMIT LOOP LANDS: the one place a respondent's data crosses the
// network, driven through the REAL page and the REAL egress adapter to a fake backend the harness
// records. Until now the credentialed route was tested only as pure functions; here poll.html runs in
// real Chromium, the answer composes in the powerless chamber, and the confirmed tap posts a comment
// onto the poll's canonical issue — with the three-token discipline asserted on the recorded wire:
//
//   1. post= (direct credential): the POST hits /repos/<repo>/issues/<canonical>/comments on
//      api.github.com, the credential rides ONLY in the Authorization header, the fenced ```tell```
//      block parses and carries pile/poll/round/tok/answer, the block's qr provenance has post=
//      STRIPPED, and the chamber shows "reply sent" with the placement real.
//   2. submit= (the sealed-credential relay): the client posts {path, body} to the Tell's relay and
//      holds NO credential at all — no Authorization header anywhere on the wire.
//   3. a rejecting backend (401) → the reply is HELD, honestly, never lost.
//
// Run: node probe-test/submit.ui.test.mjs   (skips cleanly when no Chromium / 443 is available —
// api.github.com and the relay must answer on their real https addresses for the shipped adapter).
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

const CRED = "ghp_TESTCREDENTIALTESTCREDENTIAL0000";
const REPO = "FCCN-ANTIBODY/tell.anecdote.channel";   // the canonical mailbox the adapter defaults to
// A provenance-signed QR (sig= rides inside the canon; bin/qr appends post= AFTER the signature
// preimage) — signed is what makes the block CARRY its qr field, so the strip is observable.
const QRBASE = "pile=riverbend&poll=parks-2026&round=1&tok=TESTTOK"
  + "&q=" + encodeURIComponent("What should the north meadow become?")
  + "&opts=" + encodeURIComponent("a dog park,a wetland")
  + "&canonical=41&sig=TESTSIG";

const answerAndSend = async (page, answer) => {
  await page.waitFor("!!document.getElementById('ans')", { frame: "data:" });
  await page.eval(`{
    const t = document.getElementById('ans');
    t.value = ${JSON.stringify(answer)};
    t.dispatchEvent(new Event('input'));
    document.getElementById('go').click();
  }`, { frame: "data:" });
  return page.waitFor("((document.getElementById('out')||{}).textContent||'').trim()", { frame: "data:", timeout: 20000 });
};

let githubStatus = 201;
const origins = {
  "anecdote.channel": { root },
  "api.github.com": {
    api: ({ path }) => ({ status: githubStatus, json: githubStatus < 300
      ? { id: 9001, html_url: `https://github.com/${REPO}/issues/41#issuecomment-9001` }
      : { message: "Bad credentials" } }),
  },
  "gateway.example": {
    api: () => ({ status: 201, json: { id: 9002, html_url: `https://github.com/${REPO}/issues/41#issuecomment-9002` } }),
  },
};

const ran = await withPage({ chromium, tls: true, origins }, async (page, { server }) => {
  // ---- 1. the direct credential (post=) --------------------------------------------------------
  await page.goto(server.urlFor("anecdote.channel", "/poll.html?" + QRBASE + "&post=" + CRED));
  const sent = await answerAndSend(page, "rewild it, but keep the path");
  ok(sent.includes("reply sent"), "the chamber's confirmed tap SENT the reply: " + sent);

  const post = server.apiCalls.find((c) => c.host === "api.github.com");
  ok(!!post && post.method === "POST" && post.path === `/repos/${REPO}/issues/41/comments`,
     "the wire is a comment on the poll's canonical issue: " + (post && post.path));
  ok(post.authorization === "Bearer " + CRED, "the credential rides ONLY in the Authorization header");
  const body = JSON.parse(post.body).body;
  const block = JSON.parse(/```tell\n([\s\S]*?)\n```/.exec(body)[1]);
  ok(block.schema === "tell.submission/v1" && block.pile === "riverbend" && block.poll === "parks-2026"
     && block.round === "1" && block.tok === "TESTTOK",
     "the fenced tell block parses with the poll's identity and the tok the Tell will authorize");
  ok(block.answer === "rewild it, but keep the path", "the answer is the visitor's custom words, verbatim");
  ok(!JSON.stringify(block).includes(CRED) && !body.includes(CRED),
     "the credential appears NOWHERE in the body — header-only, the three-token discipline");
  ok(block.qr && !/post=/.test(block.qr) && /tok=TESTTOK/.test(block.qr),
     "the block's qr provenance carries the signed query with post= STRIPPED");

  // ---- 2. the sealed-credential relay (submit=) ------------------------------------------------
  await page.goto(server.urlFor("anecdote.channel", "/poll.html?" + QRBASE + "&submit=" + encodeURIComponent("https://gateway.example/relay")));
  const relayed = await answerAndSend(page, "a wetland, and a boardwalk through it");
  ok(relayed.includes("reply sent"), "the relay route SENT the reply: " + relayed);
  const relay = server.apiCalls.find((c) => c.host === "gateway.example");
  ok(!!relay && relay.path === "/relay" && relay.authorization === null,
     "the client posted to the Tell's relay holding NO credential at all");
  const relayed_ = JSON.parse(relay.body);
  ok(relayed_.path === `/repos/${REPO}/issues/41/comments` && /```tell\n/.test(relayed_.body.body),
     "the relay receives the exact GitHub-API shape — the block arrives byte-identical for injection");

  // ---- 3. a rejecting backend holds, honestly --------------------------------------------------
  githubStatus = 401;
  await page.goto(server.urlFor("anecdote.channel", "/poll.html?" + QRBASE + "&post=" + CRED));
  const held = await answerAndSend(page, "this one will be refused");
  ok(held.includes("Held") && held.includes("Bad credentials"),
     "a rejecting backend HOLDS the signed reply with the reason, never losing it: " + held.trim());

  // ---- the wire went only where the QR pointed --------------------------------------------------
  const hosts = [...new Set(page.requests.filter((r) => /^https?:/.test(r.url)).map((r) => new URL(r.url).hostname))];
  ok(hosts.every((h) => ["anecdote.channel", "api.github.com", "gateway.example"].includes(h)),
     "every request stayed on the page's origin and the QR-named backends: " + hosts.join(", "));
  ok(server.foreign.length === 0, "no request escaped to any host the test did not stand up"
     + (server.foreign.length ? " — leaked: " + JSON.stringify(server.foreign) : ""));
});

if (!ran) { console.log("skip: could not bind 443 for the tls transport (root/CAP_NET_BIND_SERVICE, or sysctl net.ipv4.ip_unprivileged_port_start=443)"); process.exit(0); }
if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall submit-loop UI tests passed (the reply lands, the credential never leaves the header)");
