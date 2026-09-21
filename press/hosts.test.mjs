// Unit: press/hosts.mjs — addresses <-> origins, worked out from where the press is standing, and the
// fragment that holds a view. Run: node press/hosts.test.mjs
import { apexOf, standing, normalizeAddress, originOf, bottleAddress, kindOf, viewToHash, hashToView, APEX, SHELF } from "./hosts.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const deployed = standing({ protocol: "https:", hostname: "anecdote.channel", port: "" });
const dev = standing({ protocol: "http:", hostname: "anecdote.localhost", port: "8137" });
const bare = standing({ protocol: "http:", hostname: "localhost", port: "8000" });

// 1. Where am I standing.
ok(apexOf("anecdote.channel") === APEX && apexOf("field-notes.library.anecdote.channel") === APEX, "deployed apex, at any depth");
ok(apexOf("journal.anecdote.localhost") === "anecdote.localhost", "a <name>.localhost dev apex");
ok(apexOf("localhost") === null && apexOf("127.0.0.1") === null && apexOf("evil-anecdote.channel") === null, "not standing in a constellation (and no suffix trick)");
ok(deployed.standing && dev.standing && !bare.standing, "standing flags");

// 2. Address -> origin, in each standing.
ok(originOf("", deployed) === "https://anecdote.channel", "the apex is the empty address");
ok(originOf("journal", deployed) === "https://journal.anecdote.channel", "a neighbour");
ok(originOf("journal", dev) === "http://journal.anecdote.localhost:8137", "the same neighbour on the dev server keeps scheme and port");
ok(originOf("journal", bare) === "https://journal.anecdote.channel", "from a bare localhost, neighbours are the DEPLOYED ones");
ok(originOf(bottleAddress("field-notes"), deployed) === "https://field-notes." + SHELF + ".anecdote.channel", "a bottle is shelved under the library (D18)");

// 3. Whatever a person pastes normalizes to the same address — or to null, never to a surprising host.
for (const [input, want] of [
  ["Journal", "journal"], ["https://journal.anecdote.channel/docs/x.md", "journal"], ["journal.anecdote.channel", "journal"],
  ["anecdote.channel", ""], ["  field-notes.library  ", "field-notes.library"], ["http://tell.anecdote.localhost:8137/", "tell"],
]) ok(normalizeAddress(input, dev) === want, `normalize ${JSON.stringify(input)} -> ${JSON.stringify(want)}`);
for (const bad of ["-lead", "has space", "under_score", "a..b", "x".repeat(64), "é"]) ok(normalizeAddress(bad) === null && originOf(bad, deployed) === null, "refused: " + JSON.stringify(bad));
ok(bottleAddress("Not A Label") === null, "a bottle label must be DNS-legal");

// 4. Kind is read off the shape — there is no registry to ask.
ok(kindOf("") === "apex" && kindOf("journal") === "neighbour" && kindOf("field-notes.library") === "bottle", "apex / neighbour / bottle");
ok(kindOf("parks-2026.tell") === "floor" && kindOf("example.you") === "mask" && kindOf("voices.north.colorado") === "place", "floor / mask / place");
ok(kindOf("bottles") === "neighbour" && kindOf("x.bottles") === "place", "`bottles` is a driver, not a shelf: nothing is shelved under it");

// 5. The view lives in the fragment and round-trips; a view never climbs out.
{
  const v = { address: "field-notes.library", path: "docs/origin.md" };
  ok(viewToHash(v) === "#/field-notes.library/docs/origin.md", "view -> hash");
  ok(JSON.stringify(hashToView(viewToHash(v))) === JSON.stringify(v), "hash -> view round-trips");
  ok(JSON.stringify(hashToView("#//README.md")) === JSON.stringify({ address: "", path: "README.md" }), "the apex's own README");
  ok(JSON.stringify(hashToView("#/journal/")) === JSON.stringify({ address: "journal", path: "" }), "a bare address is its root");
  ok(viewToHash({ pile: "field-notes", path: "index.md" }) === "#~field-notes/index.md", "a pile on this device is spelled #~, not like a hostname");
  ok(JSON.stringify(hashToView("#~field-notes/anecdotes/a.json")) === JSON.stringify({ pile: "field-notes", path: "anecdotes/a.json" }), "…and round-trips");
  ok(hashToView("#~Not_A_Label/x") === null && hashToView("#~p/../x") === null, "pile views are validated the same way");
  ok(hashToView("#/journal/../../x") === null && hashToView("#/bad_label/x") === null && hashToView("") === null, "refused: climbing, illegal label, empty");
}

if (fails) { console.error(`\n${fails} failed`); process.exit(1); }
console.log("\nhosts: all passed");
