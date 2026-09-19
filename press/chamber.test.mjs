// Unit: press/chamber.mjs — the sterile reading room's document. Every promise in its header is a string
// property, so every one is checked here without a browser. Run: node press/chamber.test.mjs
import { chamberFor, csp, freshNonce, FOLLOW_OP } from "./chamber.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const nonce = freshNonce();
ok(/^[A-Za-z0-9_-]{18}$/.test(nonce) && freshNonce() !== nonce, "a nonce is 18 url-safe chars and fresh each time");

// 1. The policy.
{
  const p = csp(nonce);
  ok(p.startsWith("default-src 'none'"), "default-src 'none' — no network at all");
  ok(p.includes(`script-src 'nonce-${nonce}'`) && !p.includes("'unsafe-inline'; script") && !/script-src[^;]*unsafe/.test(p), "scripts run only under the nonce");
  ok(p.includes("base-uri 'none'") && p.includes("form-action 'none'"), "no base rewrite, no form posts");
}

// 2. A fragment face is set in the reading page; the bottle's own script is inert markup beside ours.
{
  const face = { face: "README.md", title: "a <b>bottle</b>", fragment: true, gaps: [],
    html: "<h1>hi</h1><script>steal()</script><p><a href=\"docs/x.md\">x</a></p>" };
  const doc = chamberFor(face, { nonce, tokens: ":root{--ink:#000}" });
  ok(doc.indexOf("Content-Security-Policy") < doc.indexOf("<h1>hi</h1>"), "the policy is parsed before the content it governs");
  ok((doc.match(/<script nonce=/g) || []).length === 1 && doc.includes("<script>steal()</script>"), "exactly one nonce'd script; the bottle's script carries none, so it cannot run");
  ok(doc.includes(FOLLOW_OP) && doc.includes("preventDefault"), "a pressed link is ASKED about over the probe line, not followed");
  ok(doc.includes("<title>a &lt;b&gt;bottle&lt;/b&gt;</title>"), "the title is escaped");
  ok(doc.includes(":root{--ink:#000}"), "the tokens are inlined — styles match by construction");
  ok(!/https?:\/\//.test(doc.replace(face.html, "")), "the room itself names no URL anywhere");
}

// 3. Gaps are said at the foot, never hidden.
{
  const doc = chamberFor({ face: "source", title: "t", fragment: true, html: "<p>x</p>", gaps: ["missing _layouts/<gone>.html", "include _includes/a.html"] }, { nonce });
  ok(doc.includes("2 pieces not found") && doc.includes("missing _layouts/&lt;gone&gt;.html"), "the gap note names each missing piece, escaped");
  ok(!chamberFor({ face: "README.md", title: "t", fragment: true, html: "<p>x</p>", gaps: [] }, { nonce }).includes("not found"), "no gaps, no note");
}

// 4. A whole document keeps its shape, with the room's rules injected FIRST in its head.
{
  const whole = "<!doctype html><html><head><link rel=stylesheet href=/site.css><title>theirs</title></head><body><p>built by their layout</p></body></html>";
  const doc = chamberFor({ face: "source", title: "theirs", fragment: false, html: whole, gaps: ["include _includes/nav.html"] }, { nonce });
  ok(doc.indexOf("Content-Security-Policy") < doc.indexOf("site.css"), "policy precedes their stylesheet link");
  ok(doc.includes("<title>theirs</title>") && doc.includes("built by their layout"), "their document is intact");
  ok(doc.indexOf("1 piece not found") < doc.indexOf("</body>") && doc.indexOf("1 piece not found") > 0, "the gap note lands inside their body");
  const headless = chamberFor({ face: "html", title: "x", fragment: false, html: "<html><body>no head</body></html>", gaps: [] }, { nonce });
  ok(headless.includes("Content-Security-Policy") && headless.includes("no head"), "a document with no <head> still gets the rules");
}

// 5. Nothing here is a page too, not a blank.
{
  const doc = chamberFor({ face: "none", tried: ["index.md", "README.md", "index.html"], fragment: true, html: "", gaps: [] }, { nonce });
  ok(doc.includes("Nothing here yet.") && doc.includes("<code>README.md</code>"), "says what it looked for");
}

{
  const doc = chamberFor({ face: "none", unreachable: "https://nowhere.library.anecdote.channel", tried: [], fragment: true, html: "", gaps: [] }, { nonce });
  ok(doc.includes("did not answer") && !doc.includes("Nothing here yet"), "unreachable is said as unreachable, never as empty");
}

// 6. Fonts arrive as data: or not at all.
ok(chamberFor({ face: "text", title: "t", fragment: true, html: "", gaps: [] }, { nonce, fonts: { mono: "data:font/woff2;base64,AAAA" } }).includes("@font-face{font-family:'Space Mono'"), "a data: face is declared");
{
  let threw = false; try { chamberFor({ face: "text", fragment: true, html: "" }, {}); } catch { threw = true; }
  ok(threw, "no nonce, no chamber");
}

if (fails) { console.error(`\n${fails} failed`); process.exit(1); }
console.log("\nchamber: all passed");
