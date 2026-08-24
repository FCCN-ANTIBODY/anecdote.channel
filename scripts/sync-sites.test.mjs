// scripts/sync-sites.test.mjs — the pure core of the directory resolver. No network, no fs.
import assert from "node:assert/strict";
import { parseSites, parseRoot, parsePlaces, parseSan, wildcardFor, coveredBy, ancestorsOf, treeUnder, rowsUnder, placeName, categoryOf, monikerOf, ROLE_ORDER, claimStatus, entryParts, aliasConflicts, tokenEnvFor, APEX } from "../directory.mjs";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

t("parseSites reads hostnames, flags, repo hints and labels", () => {
  const got = parseSites("# hi\n@root x.anecdote.channel\n\na.anecdote.channel\nb.anecdote.channel draft repo:O/r = Voices  # trailing\n");
  assert.deepEqual(got, [
    { host: "a.anecdote.channel", draft: false, system: false, label: "", repo: "", to: "", was: [] },
    { host: "b.anecdote.channel", draft: true, system: false, label: "Voices", repo: "O/r", to: "", was: [] },
  ]);
});

t("@place reserves a place before anything is in it", () => {
  const cfg = "@root colorado.anecdote.channel\n@place wellington.colorado.anecdote.channel\n" +
              "@place loveland.colorado.anecdote.channel\nmedia.fort-collins.colorado.anecdote.channel\n";
  assert.deepEqual(parsePlaces(cfg),
    ["wellington.colorado.anecdote.channel", "loveland.colorado.anecdote.channel"]);
  // Directives are not sites, and a reserved place is not an entry — it is a level that renders
  // empty until someone arrives.
  assert.equal(parseSites(cfg).length, 1);
});

t("a @root directive is a directive, not a site", () => {
  assert.equal(parseRoot("@root colorado.anecdote.channel\n"), "colorado.anecdote.channel");
  assert.equal(parseRoot("# none here\n"), APEX, "defaults to the apex");
  assert.equal(parseSites("@root colorado.anecdote.channel\n").length, 0);
});

t("was: records a former host, repeatably, so a move is legible from outside", () => {
  const [moved] = parseSites(
    "north.voices.fort-collins.colorado.anecdote.channel was:voices.north.colorado.anecdote.channel\n");
  assert.deepEqual(moved.was, ["voices.north.colorado.anecdote.channel"]);

  const [twice] = parseSites("c.x.y was:a.x.y was:b.x.y\n");
  assert.deepEqual(twice.was, ["a.x.y", "b.x.y"], "a name can move more than once");

  const [never] = parseSites("a.x.y\n");
  assert.deepEqual(never.was, [], "no history is an empty list, not undefined");

  // The point of the field: from outside, a rename and a deletion are the same observation.
  // Only the alias distinguishes them, so a consumer can repair its own links.
  assert.ok(!moved.was.includes(moved.host), "an entry does not list itself as a former name");
});

t("a vacated name is retired, never recycled", () => {
  // The one with teeth: a stale link would resolve to the WRONG site instead of breaking, and
  // silently landing a reader somewhere else is worse than a dead link they can see.
  const reused = aliasConflicts([{ host: "a.x", was: ["b.x"] }, { host: "b.x", was: [] }]);
  assert.equal(reused.length, 1);
  assert.match(reused[0], /must never be reused/);
});

t("one former name cannot belong to two entries", () => {
  // A consumer could not say which entry a stale link should be repaired to, so it would have to
  // report ambiguity forever. Cheaper to forbid where the name is minted.
  const both = aliasConflicts([{ host: "a.x", was: ["old.x"] }, { host: "b.x", was: ["old.x"] }]);
  assert.equal(both.length, 1);
  assert.match(both[0], /BOTH a\.x and b\.x/);
});

t("the aliases actually in config are clean", () => {
  assert.deepEqual(
    aliasConflicts([{ host: "north.voices.fort-collins.colorado.anecdote.channel",
                     was: ["voices.north.colorado.anecdote.channel"] }]), []);
  assert.deepEqual(aliasConflicts([{ host: "a.x", was: [] }, { host: "b.x", was: [] }]), []);
});

t("a shell carries its target, and is never mistaken for something we host", () => {
  const [shell] = parseSites("media.longmont.colorado.anecdote.channel to:https://lpm.example = LPM\n");
  assert.equal(shell.to, "https://lpm.example");
  assert.equal(shell.label, "LPM");
  assert.equal(shell.system, false);
  assert.equal(shell.draft, false);
  const [ours] = parseSites("voices.north.colorado.anecdote.channel\n");
  assert.equal(ours.to, "", "a hosted entry has no target — that is the whole distinction");
});

t("a shell's canonical name still needs TLS coverage — it is served from this zone", () => {
  const san = parseSan("*.longmont.colorado.anecdote.channel\n");
  assert.equal(coveredBy("media.longmont.colorado.anecdote.channel", san), true);
  assert.equal(coveredBy("media.boulder.colorado.anecdote.channel", san), false);
});

t("NAME is one line, no scheme, and normalises to a bare host", () => {
  // The parse the reader applies, stated as the contract NAME has to meet.
  const norm = (b) => b.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
  assert.equal(norm("  Antibody.Fort-Collins.Colorado.Anecdote.Channel/\n"),
    "antibody.fort-collins.colorado.anecdote.channel");
  assert.equal(norm("https://tell.anecdote.channel"), "tell.anecdote.channel");
  // A canonical name is a PROVEN COPY, not the only copy: two hosts may hold the same NAME and
  // both be canonical, so nothing here treats a match as exclusive.
  const host = "mirror.example";
  assert.equal(claimStatus("https://antibody.fort-collins.colorado.anecdote.channel", host), "elsewhere",
    "a mirror declaring the original's name is reported, never rewritten or refused");
});

t("a site's own claim about where it belongs is checked, not assumed", () => {
  const host = "antibody.fort-collins.colorado.anecdote.channel";
  assert.equal(claimStatus(`https://${host}`, host), "agrees", "the handshake: it says it belongs here");
  assert.equal(claimStatus(`https://${host}/`, host), "agrees", "a trailing slash is not a disagreement");
  assert.equal(claimStatus("https://elsewhere.example", host), "elsewhere");
  // Unclaimed is a fact about a site, not a failure of one.
  assert.equal(claimStatus("", host), "unclaimed");
});

t("the category is a declared role, else the label adjacent to the place", () => {
  const P = "fort-collins.colorado.anecdote.channel";
  // A declared role beats position — this is what stops a moniker being read as a category.
  assert.equal(categoryOf({ host: `voices.north.colorado.anecdote.channel`, roles: ["journal"] },
    "north.colorado.anecdote.channel"), "journal");
  assert.equal(categoryOf({ host: `antibody.${P}`, roles: ["atlas", "antidote", "journal"] }, P), "journal",
    "a node running several files under the first in ROLE_ORDER");

  // Undeclared: the label sitting ON the place is the category, the one in front of it the moniker.
  assert.equal(categoryOf({ host: `fm.media.${P}`, roles: [] }, P), "media");
  assert.equal(monikerOf({ host: `fm.media.${P}` }, P), "fm");

  // One label is both — the canonical occupant, which is why it needs no moniker in front of it.
  assert.equal(categoryOf({ host: `media.${P}`, roles: [] }, P), "media");
  assert.equal(monikerOf({ host: `media.${P}` }, P), "media");
  assert.deepEqual(ROLE_ORDER, ["journal", "tell", "atlas", "antidote"]);
});

t("a place yields one row per category, names stacked beside it", () => {
  const P = "fort-collins.colorado.anecdote.channel";
  const sites = [
    { host: `antibody.${P}`, label: "ANTIBODY", leaf: "antibody", roles: ["journal"] },
    { host: `media.${P}`, label: "FCPM", leaf: "media", roles: [] },
    { host: `a.circus.${P}`, label: "One Of Those", leaf: "a", roles: [] },
    { host: `b.circus.${P}`, label: "Another Of Those", leaf: "b", roles: [] },
  ];
  const [colorado] = treeUnder(APEX, sites);
  const fc = colorado.children.find((c) => c.host.startsWith("fort-collins."));
  const rows = rowsUnder(fc);

  // Declared roles file first, in ROLE_ORDER; the rest follow alphabetically.
  assert.equal(rows[0].category, "journal");
  assert.equal(rows[0].entries[0].site.label, "ANTIBODY");

  // Two monikers under ONE category stack beside it, and the category does not move — the shelf
  // stays a shelf instead of scattering into a row per occupant.
  const circus = rows.find((r) => r.category === "circus");
  assert.equal(circus.entries.length, 2);
  assert.deepEqual(circus.entries.map((e) => e.site.label), ["One Of Those", "Another Of Those"]);

  // A canonical occupant is a category of one, with no moniker level in sight.
  const media = rows.find((r) => r.category === "media");
  assert.equal(media.entries.length, 1);
  assert.equal(monikerOf(media.entries[0].site, P), "media");
});

t("a place label reads as a place, not a DNS label", () => {
  assert.equal(placeName("fort-collins.colorado.anecdote.channel"), "Fort Collins");
  assert.equal(placeName("longmont.colorado.anecdote.channel"), "Longmont");
});

t("system marks machinery: validated, never a destination", () => {
  const [tell] = parseSites("tell.anecdote.channel system\n");
  assert.equal(tell.system, true);
  assert.equal(tell.draft, false, "system is not draft — it IS checked, just never advertised");
});

t("parseSites rejects something that is not a hostname", () => {
  assert.throws(() => parseSites("notahost\n"), /expected a hostname/);
});

t("a per-owner token env name is derived, never hand-listed in one blob", () => {
  assert.equal(tokenEnvFor("NCCV-OPINION"), "SITES_TOKEN_NCCV_OPINION");
  assert.equal(tokenEnvFor("FCCN-ANTIBODY"), "SITES_TOKEN_FCCN_ANTIBODY");
  assert.equal(tokenEnvFor("tiliv"), "SITES_TOKEN_TILIV");
});

t("parseSan lowercases, dedupes, drops comments", () => {
  const got = parseSan("# c\nA.com\n\na.com\n*.A.com\n");
  assert.deepEqual(got.sort(), ["*.a.com", "a.com"]);
});

t("a wildcard matches exactly one label", () => {
  assert.equal(wildcardFor("voices.north.colorado.anecdote.channel"), "*.north.colorado.anecdote.channel");
  const san = ["*.colorado.anecdote.channel"];
  assert.equal(coveredBy("north.colorado.anecdote.channel", san), true);   // one label under
  assert.equal(coveredBy("voices.north.colorado.anecdote.channel", san), false); // two — not covered
});

t("an exact host in the SAN list counts as covered", () => {
  assert.equal(coveredBy("anecdote.channel", ["anecdote.channel"]), true);
});

t("the real san-list covers the planned NCCV leaf", () => {
  const san = parseSan([
    "anecdote.channel", "*.anecdote.channel", "*.colorado.anecdote.channel",
    "*.fort-collins.colorado.anecdote.channel", "*.north.colorado.anecdote.channel",
  ].join("\n"));
  assert.equal(coveredBy("voices.north.colorado.anecdote.channel", san), true);
  assert.equal(coveredBy("antibody.fort-collins.colorado.anecdote.channel", san), true);
});

t("ancestorsOf walks up to the apex", () => {
  assert.deepEqual(ancestorsOf("voices.north.colorado.anecdote.channel"), [
    "north.colorado.anecdote.channel", "colorado.anecdote.channel", APEX,
  ]);
  assert.deepEqual(ancestorsOf(APEX), []);
});

t("treeUnder nests by hostname and keeps unserved levels as groupings", () => {
  const sites = [
    { host: "tell.anecdote.channel", label: "Tell" },
    { host: "voices.north.colorado.anecdote.channel", label: "Voices" },
    { host: "antibody.fort-collins.colorado.anecdote.channel", label: "Antibody" },
  ];
  const tree = treeUnder(APEX, sites);
  const labels = tree.map((n) => n.host);
  assert.deepEqual(labels, ["colorado.anecdote.channel", "tell.anecdote.channel"]);

  const colorado = tree.find((n) => n.host === "colorado.anecdote.channel");
  assert.equal(colorado.site, null, "nobody serves colorado.* — it is a category");
  assert.deepEqual(colorado.children.map((c) => c.host).sort(), [
    "fort-collins.colorado.anecdote.channel", "north.colorado.anecdote.channel",
  ]);

  const north = colorado.children.find((c) => c.host === "north.colorado.anecdote.channel");
  assert.equal(north.site, null);
  assert.equal(north.children[0].site.label, "Voices");   // the served leaf hangs off it
});

t("a served intermediate level is both a link and a parent", () => {
  const sites = [
    { host: "colorado.anecdote.channel", label: "Colorado" },
    { host: "antibody.fort-collins.colorado.anecdote.channel", label: "Antibody" },
  ];
  const [colorado] = treeUnder(APEX, sites);
  assert.equal(colorado.site.label, "Colorado");
  assert.equal(colorado.children.length, 1);
});

t("sites with no host at all are skipped by the tree", () => {
  assert.deepEqual(treeUnder(APEX, [{ host: null, label: "unserved" }]), []);
});

t("a linked entry never renders SOON, and an unlinked one has no link", () => {
  const linked = entryParts({ linked: true, leaves: true, also: "atlas" });
  assert.equal(linked.link, true);
  assert.equal(linked.soon, false, "a site that answers must never say SOON");
  assert.equal(linked.out, true);
  assert.equal(linked.also, true);

  const waiting = entryParts({ linked: false, leaves: false, also: "" });
  assert.equal(waiting.link, false, "nothing to click at a name that does not answer");
  assert.equal(waiting.soon, true);
  assert.equal(waiting.out, false);

  // The two are exclusive. Every listed entry is exactly one of them — the live bug was both at
  // once, because hiding is a suggestion a stylesheet can override and removal is not.
  for (const e of [{ linked: true }, { linked: false }, {}]) {
    const p = entryParts(e);
    assert.notEqual(p.link, p.soon, "link and soon are mutually exclusive, always");
  }
});

t("every entry the resolver publishes as served is renderable as a link", () => {
  // Guards the shape the renderer depends on: served or shell => linked, never SOON.
  const sample = [
    { linked: true, leaves: false }, { linked: true, leaves: true }, { linked: false, leaves: false },
  ];
  const soon = sample.filter((e) => entryParts(e).soon);
  assert.equal(soon.length, 1, "only the entry that does not answer says SOON");
});

console.log(`\n${n}/${n} passed`);
