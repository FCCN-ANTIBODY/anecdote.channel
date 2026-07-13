// Unit: composer/bottle-uri.mjs — canonical bottle addressing + the storage-adapter routing primitive. The
// wildcard is on the sub-sub-domain (invented label) under a provisioned storage subdomain; a floor recognizes
// it was loaded as an adapter purely by the path /storage/.<adapter>. Run: node composer/bottle-uri.test.mjs
import { bottleUrl, parseBottleUrl, storageRequest, isSlug, APEX, STORAGE } from "./bottle-uri.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// 1. Build: bottle root (the floor) and the /storage/.<adapter> facet.
ok(bottleUrl({ label: "cd04-q1", storage: "tell" }) === "https://cd04-q1.tell.anecdote.channel/", "root url");
ok(bottleUrl({ label: "cd04-q1", storage: "tell", adapter: "git" }) === "https://cd04-q1.tell.anecdote.channel/storage/.git", "git facet url");
ok(bottleUrl({ label: "scratch7", storage: "bottles", adapter: "opfs" }) === "https://scratch7.bottles.anecdote.channel/storage/.opfs", "opfs facet on a bottles cubby");

// 2. Illegal parts are refused at build time.
for (const bad of [
  { label: "UPPER", storage: "tell" }, { label: "-lead", storage: "tell" }, { label: "x".repeat(64), storage: "tell" },
  { label: "ok", storage: "Tell" }, { label: "ok", storage: "tell", adapter: ".git" }, { label: "", storage: "tell" },
]) {
  let threw = false;
  try { bottleUrl(bad); } catch { threw = true; }
  ok(threw, "refused illegal parts: " + JSON.stringify(bad));
}

// 3. storageRequest — THE routing primitive, from a path alone.
ok(JSON.stringify(storageRequest("/storage/.git")) === JSON.stringify({ capability: STORAGE, adapter: "git" }), "storageRequest(/storage/.git) → git");
ok(storageRequest("/storage/.opfs").adapter === "opfs", "storageRequest(/storage/.opfs) → opfs");
for (const notStorage of [
  "/", "", "/storage/", "/storage/git", ".git", "/.git", "/storage/.git/extra", "/store/.git", "/storage/.Git", "/index.html", "/storage/.",
]) ok(storageRequest(notStorage) === null, "no path / wrong path → no adapter API: " + JSON.stringify(notStorage));

// 4. Parse: host → parts, and the facet adapter (via storageRequest).
{
  const p = parseBottleUrl("https://cd04-q1.tell.anecdote.channel/storage/.git");
  ok(p && p.label === "cd04-q1" && p.storage === "tell" && p.adapter === "git" && p.apex === APEX, "parsed label/storage/adapter: " + JSON.stringify(p));
}
ok(parseBottleUrl("https://cd04-q1.tell.anecdote.channel/").adapter === null, "bottle root parses with no adapter");
ok(parseBottleUrl("https://cd04-q1.tell.anecdote.channel/index.html").adapter === null, "a normal path is the root, not an adapter facet");

// 5. Round-trip: format ∘ parse is identity on the parts.
{
  const parts = { label: "scratch7", storage: "bottles", adapter: "git" };
  const p = parseBottleUrl(bottleUrl(parts));
  ok(p.label === parts.label && p.storage === parts.storage && p.adapter === parts.adapter, "round-trips");
}

// 6. Not-a-bottle: wrong protocol / apex / depth → null.
for (const notBottle of [
  "http://cd04-q1.tell.anecdote.channel/", "https://cd04-q1.tell.example.com/", "https://tell.anecdote.channel/",
  "https://a.b.tell.anecdote.channel/", "https://anecdote.channel/", "not a url",
]) ok(parseBottleUrl(notBottle) === null, "not a bottle → null: " + notBottle);

// 7. isSlug guard.
ok(isSlug("cd04-q1") && !isSlug("Cd04") && !isSlug("") && !isSlug("x".repeat(64)), "isSlug enforces DNS-label charset + length");

console.log(fails ? `\nFAILED (${fails})` : "\nok: bottle-uri — provisioned storage + invented label + /storage/.<adapter> routing");
process.exit(fails ? 1 : 0);
