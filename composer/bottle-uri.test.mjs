// Unit: composer/bottle-uri.mjs — canonical bottle addressing. The wildcard is on the sub-sub-domain
// (invented label) under a provisioned storage subdomain; an optional /.<adapter> facet selects the probe.
// Run: node composer/bottle-uri.test.mjs
import { bottleUrl, parseBottleUrl, isSlug, APEX } from "./bottle-uri.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// 1. Build: bottle root (the floor) and an adapter facet.
ok(bottleUrl({ label: "cd04-q1", storage: "tell" }) === "https://cd04-q1.tell.anecdote.channel/", "root url");
ok(bottleUrl({ label: "cd04-q1", storage: "tell", adapter: "git" }) === "https://cd04-q1.tell.anecdote.channel/.git", "git facet url");
ok(bottleUrl({ label: "scratch7", storage: "bottles", adapter: "opfs" }) === "https://scratch7.bottles.anecdote.channel/.opfs", "opfs facet on a bottles-storage cubby");

// 2. Illegal parts are refused at build time (a bad part can never become a resolving URL).
for (const bad of [
  { label: "UPPER", storage: "tell" },                       // not a slug
  { label: "-lead", storage: "tell" },                       // leading dash
  { label: "x".repeat(64), storage: "tell" },                // > DNS label
  { label: "ok", storage: "Tell" },                          // storage not a slug
  { label: "ok", storage: "tell", adapter: ".git" },         // adapter must be a bare slug
  { label: "", storage: "tell" },
]) {
  let threw = false;
  try { bottleUrl(bad); } catch { threw = true; }
  ok(threw, "refused illegal parts: " + JSON.stringify(bad));
}

// 3. Parse: host → parts, and the /.<adapter> facet.
{
  const p = parseBottleUrl("https://cd04-q1.tell.anecdote.channel/.git");
  ok(p && p.label === "cd04-q1" && p.storage === "tell" && p.adapter === "git" && p.apex === APEX, "parsed label/storage/adapter: " + JSON.stringify(p));
}
{
  const p = parseBottleUrl("https://cd04-q1.tell.anecdote.channel/");
  ok(p && p.adapter === null, "bottle root parses with no adapter: " + JSON.stringify(p));
}

// 4. Round-trip: format ∘ parse is identity on the parts.
{
  const parts = { label: "scratch7", storage: "bottles", adapter: "git" };
  const p = parseBottleUrl(bottleUrl(parts));
  ok(p.label === parts.label && p.storage === parts.storage && p.adapter === parts.adapter, "round-trips");
}

// 5. Not-a-bottle: wrong protocol, wrong apex, wrong depth (bare subdomain, or too deep), all → null.
for (const notBottle of [
  "http://cd04-q1.tell.anecdote.channel/",                   // not https
  "https://cd04-q1.tell.example.com/",                       // wrong apex
  "https://tell.anecdote.channel/",                          // only a storage subdomain — no invented label
  "https://a.b.tell.anecdote.channel/",                      // two labels deep — the wildcard covers one
  "https://anecdote.channel/",                               // apex itself
  "not a url",
]) {
  ok(parseBottleUrl(notBottle) === null, "not a bottle → null: " + notBottle);
}

// 6. A non-facet first path segment is the bottle root, not an adapter (content lives under normal paths).
{
  const p = parseBottleUrl("https://cd04-q1.tell.anecdote.channel/index.html");
  ok(p && p.adapter === null, "a normal path segment is not an adapter facet: " + JSON.stringify(p));
}

// 7. isSlug guard.
ok(isSlug("cd04-q1") && !isSlug("Cd04") && !isSlug("") && !isSlug("x".repeat(64)), "isSlug enforces DNS-label charset + length");

console.log(fails ? `\nFAILED (${fails})` : "\nok: bottle-uri — provisioned storage + invented label + /.adapter facet");
process.exit(fails ? 1 : 0);
