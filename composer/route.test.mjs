// Tests for the composer routing core. Dependency-free, deterministic.
//   node composer/route.test.mjs
import { intentOf, verdict, plan, prepare } from "./route.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// A small local cache: two direct-address Tells and three public Atlases (one a neighbor
// suggestion), each with its constitution shorthand. The user has self-muted one topic.
const cache = {
  tells: [
    { id: "neighbors", name: "Neighborhood Tell", kind: "tell", url: "https://nbhd.example", excludes: ["harassment"] },
    { id: "mutualaid", name: "Mutual-Aid Tell", kind: "tell", url: "https://aid.example", excludes: [] },
  ],
  atlases: [
    { id: "foco", name: "Fort Collins Civic Atlas", kind: "atlas", scope: "fort-collins", excludes: ["sale", "spam"] },
    { id: "colorado", name: "Colorado State Atlas", kind: "atlas", scope: "colorado", excludes: ["sale", "harassment"] },
    { id: "larimer", name: "Larimer County Atlas", kind: "atlas", scope: "larimer", neighbor: true, excludes: ["sale"] },
  ],
  muted: { foco: ["politics"] },   // the user themselves muted "politics" on the Fort Collins Atlas
};

// 1. Intent reduction: the fewest-verbs kernel, not the surface sentence.
{
  const i = intentOf("Is there shade at this park?");
  ok(i.label === "shade park", "intent reduces to the fewest-verbs kernel ('shade park')");
  ok(i.tokens.includes("shade") && i.tokens.includes("park"), "intent carries its content tokens");
}

// 2. A civic statement routes everywhere — no exclusion touches it.
{
  const p = plan("The park needs more shade", cache);
  ok(p.routableCount === 5, "a civic statement is routable to all five destinations");
  ok(p.groups[0].kind === "tell" && p.groups[1].kind === "atlas",
    "Tells you address are grouped before public Atlases");
}

// 3. An everyday statement a public Atlas doesn't take — never blocked, but not OFFERED into the
//    Atlases whose constitutions exclude it; still routes to the open Tells. The general case.
{
  const p = plan("Bikes for sale", cache);
  const byId = Object.fromEntries(p.groups.flatMap((g) => g.dests).map((d) => [d.id, d]));
  ok(byId.foco.verdict.eligible === false && /excludes/.test(byId.foco.verdict.reason),
    "a public Atlas dims it with a constitution reason, naming the topic");
  ok(byId.foco.verdict.by === "constitution", "the block is attributed to the destination's constitution");
  ok(byId.colorado.verdict.eligible === false && byId.larimer.verdict.eligible === false,
    "every Atlas excluding 'sale' dims it");
  ok(byId.mutualaid.verdict.eligible === true && byId.neighbors.verdict.eligible === true,
    "both direct-address Tells still accept it — the private side stays open");
  ok(p.routableCount === 2, "only the two Tells remain routable; every public Atlas has dimmed");
}

// 4. Self-muted topics dim a destination too, and that explanation wins over a constitution one.
{
  const p = plan("a question about politics", cache);
  const foco = p.groups[1].dests.find((d) => d.id === "foco");
  ok(foco.verdict.eligible === false && foco.verdict.by === "you",
    "a topic you self-muted dims the destination, attributed to you");
  ok(/you muted/.test(foco.verdict.reason), "the reason says you muted it (the thing you can change)");
  // Same statement is fine on an Atlas where you didn't mute it.
  const colorado = p.groups[1].dests.find((d) => d.id === "colorado");
  ok(colorado.verdict.eligible === true, "the same statement still routes where you did not mute it");
}

// 5. Eligible destinations sort first within each group (open doors lead).
{
  const p = plan("Bikes for sale", cache);
  const atlasElig = p.groups[1].dests.map((d) => d.verdict.eligible);
  ok(JSON.stringify(atlasElig) === JSON.stringify([...atlasElig].sort((a, b) => (a === b ? 0 : a ? -1 : 1))),
    "within a group, routable destinations are listed before dimmed ones");
}

// 6. prepare() builds the hand-off only for a routable destination; refuses otherwise. It never
//    transmits — it just assembles {to, label, text}, the reduced label riding along as subject.
{
  const openTell = cache.tells.find((d) => d.id === "mutualaid");
  const a = prepare("Bikes for sale", openTell, cache);
  ok(a.to.id === "mutualaid" && a.label === "bikes sale" && a.text === "Bikes for sale",
    "prepare() assembles {to, label, text} for a routable destination");
  let threw = false;
  try { prepare("Bikes for sale", cache.atlases[0], cache); } catch { threw = true; }
  ok(threw, "prepare() refuses a destination this statement isn't offered into");
}

// 7. Empty input is inert and safe — no destination, no throw (the composer at rest).
{
  const p = plan("", cache);
  ok(p.intent.label === "" && typeof p.routableCount === "number", "empty input yields an inert plan, no crash");
}

console.log(fails ? `\n${fails} FAILED` : "\ncomposer routing: all tests passed");
process.exit(fails ? 1 : 0);
