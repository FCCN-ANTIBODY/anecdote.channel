// scripts/sync-sites.test.mjs — the pure core of the directory resolver. No network, no fs.
import assert from "node:assert/strict";
import { parseSites, parseRoot, parseSan, wildcardFor, coveredBy, ancestorsOf, treeUnder, collapse, tokenEnvFor, APEX } from "../directory.mjs";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

t("parseSites reads hostnames, flags, repo hints and labels", () => {
  const got = parseSites("# hi\n@root x.anecdote.channel\n\na.anecdote.channel\nb.anecdote.channel draft repo:O/r = Voices  # trailing\n");
  assert.deepEqual(got, [
    { host: "a.anecdote.channel", draft: false, system: false, label: "", repo: "", to: "", kind: "" },
    { host: "b.anecdote.channel", draft: true, system: false, label: "Voices", repo: "O/r", to: "", kind: "" },
  ]);
});

t("a @root directive is a directive, not a site", () => {
  assert.equal(parseRoot("@root colorado.anecdote.channel\n"), "colorado.anecdote.channel");
  assert.equal(parseRoot("# none here\n"), APEX, "defaults to the apex");
  assert.equal(parseSites("@root colorado.anecdote.channel\n").length, 0);
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

t("type: marks what a thing is, and is optional", () => {
  const [j] = parseSites("antibody.fort-collins.colorado.anecdote.channel type:journal\n");
  assert.equal(j.kind, "journal");
  assert.equal(j.label, "", "a name is read from the thing, not written here");
  const [plain] = parseSites("media.fort-collins.colorado.anecdote.channel\n");
  assert.equal(plain.kind, "", "a platformed site is just a site");
});

t("a category of one collapses; a category of several does not", () => {
  const sites = [
    { host: "voices.north.colorado.anecdote.channel", label: "Voices" },
    { host: "antibody.fort-collins.colorado.anecdote.channel", label: "ANTIBODY" },
    { host: "media.fort-collins.colorado.anecdote.channel", label: "FCPM" },
  ];
  const [colorado] = treeUnder(APEX, sites);
  const north = colorado.children.find((c) => c.host.startsWith("north."));
  const fc = colorado.children.find((c) => c.host.startsWith("fort-collins."));

  const one = collapse(north);
  assert.equal(one.tail.site.label, "Voices", "nothing to choose between — folds to the entry");
  assert.equal(one.chain.length, 2);

  const many = collapse(fc);
  assert.equal(many.tail, fc, "two entries is a real choice — stays a category");
  assert.equal(many.chain.length, 1);
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

console.log(`\n${n}/${n} passed`);
