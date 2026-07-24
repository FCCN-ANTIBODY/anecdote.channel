// Unit: grouping (grouping.mjs) — the late grouping pass over a node-map. Proves the on-stall path both ways:
// with a typifying namer, stalled group labels upgrade to types (genealogy reads "eggs › ingredients ›
// recipe") while structure and cursors are untouched; WITHOUT one, the subtractive labels stand unchanged
// (the degrade). Plus the capability plumbing: an absent probe yields a null namer, a present one drives it.
// Run: node reducer/grouping.test.mjs
import { nodemap, locate, slice } from "./doc-nodemap.mjs";
import { regroup, isStalled, namerFromCapability, resolveGroupingNamer } from "./grouping.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const DOC = `Grandma's Honey Cornbread

Ingredients
- one cup all purpose flour
- two large eggs
- three tablespoons honey

Method
- heat the oven to four hundred degrees
- pour into a greased pan and bake twenty minutes`;

// A stub typifying namer standing in for the model in the bottle: it TYPES a heterogeneous group by keyword,
// the union the subtractive namer can't do. (The real one is generative; this proves the wiring.)
const typify = async (text) => {
  const t = text.toLowerCase();
  if (/grandma/.test(t) && /cornbread/.test(t)) return "recipe";   // the title/gestalt dominates first
  if (/ingredient/.test(t)) return "ingredients";
  if (/method/.test(t)) return "method";
  return null; // unknown → leave the subtractive label (the namer is allowed to decline)
};

// 1. isStalled: a genuine group is stalled; a single term is not.
{
  const map = nodemap(DOC);
  ok(isStalled(map) === true, "the doc (many terms) is stalled");
  ok(isStalled(map.children[1]) === true, "the ingredients block (heterogeneous) is stalled");
  const term = map.children[1].children[1].children[0];
  ok(isStalled(term) === false, "a bare term is never stalled (it is already its own label)");
}

// 2. PRESENT: regroup with the typifying namer upgrades stalled labels; structure + cursors untouched.
{
  const map = nodemap(DOC);
  const before = map.children[1].label;                 // "ingredients one cup yellow cornmeal …" (subtractive)
  const eggsBefore = locate(map, "how many eggs");
  await regroup(map, DOC, { namer: typify });

  ok(map.children[1].label === "ingredients" && map.children[1].label !== before, "a stalled group re-labels to its TYPE (ingredients)");
  ok(map.children[2].label === "method", "the method block re-labels to its type too");
  ok(map.label === "recipe", "the whole doc types as 'recipe'");

  const eggsAfter = locate(map, "how many eggs");
  ok(/two large eggs/.test(slice(DOC, eggsAfter.read)), "the raw yank is unchanged — grouping fixed labels, not bytes");
  ok(eggsAfter.span.start === eggsBefore.span.start && eggsAfter.span.end === eggsBefore.span.end, "the cursor anchor is unchanged");
  const genealogy = eggsAfter.genealogy.map((g) => g.label);
  ok(genealogy.includes("recipe") && genealogy.includes("ingredients") && genealogy[genealogy.length - 1] === "eggs",
     "the genealogy now reads 'recipe › ingredients › … › eggs' — the typed path");
}

// 3. term leaves are never re-labelled (they stay their own word).
{
  const map = nodemap(DOC);
  await regroup(map, DOC, { namer: typify });
  const term = map.children[1].children[1].children[0];
  ok(term.kind === "term" && term.label === slice(DOC, term.span).toLowerCase(), "a term leaf keeps its verbatim word label");
}

// 4. ABSENT: regroup with a null namer leaves every subtractive label intact — the degrade.
{
  const map = nodemap(DOC);
  const before = map.children[1].label;
  const out = await regroup(map, DOC, { namer: null });
  ok(out === map && map.children[1].label === before, "no grouper held ⇒ the subtractive labels stand (still fully readable by cursor)");
}

// 5. namerFromCapability adapts a resolved capability's client (both op shapes) and refuses an absent one.
{
  ok(namerFromCapability({ present: false }) === null, "an absent capability yields no namer");
  const viaName = namerFromCapability({ present: true, client: { name: async (t) => "typed:" + t.length } });
  ok(typeof viaName === "function" && (await viaName("abc")) === "typed:3", "a client.name(text) capability adapts to a namer");
  const viaInvoke = namerFromCapability({ present: true, client: { invoke: async (op, { text }) => ({ label: op + ":" + text }) } });
  ok((await viaInvoke("z")) === "name:z", "a client.invoke('name',{text}) capability adapts too");
}

// 6. resolveGroupingNamer: an ABSENT probe degrades to a null namer; a PRESENT one drives regroup.
{
  const absent = await resolveGroupingNamer({ platformKey: "pk", embed: () => {}, resolve: async () => ({ present: false, reason: "no bottle" }) });
  ok(absent.present === false && absent.namer === null, "resolveGroupingNamer degrades to a null namer when the probe is absent");

  const present = await resolveGroupingNamer({ platformKey: "pk", embed: () => {}, resolve: async () => ({ present: true, client: { name: async () => "ingredients" }, teardown() {} }) });
  ok(present.present === true && typeof present.namer === "function", "a present namer capability yields a usable async namer");
  const map = nodemap(DOC);
  await regroup(map, DOC, { namer: present.namer });
  ok(map.children[1].label === "ingredients", "and regroup drives it end to end (stub-hub → typed label)");
  present.teardown();
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall grouping tests passed");
