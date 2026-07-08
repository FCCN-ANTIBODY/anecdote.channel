// Unit: the offline Atlas (viewer/atlas-offline.mjs, civic-node#73). A carried snapshot lands as a
// history-keeping atlas.snapshot repo whose derived listings feed the existing aggregate index (oid
// dedup = corroboration by construction); the whole public surface renders offline; the SAME matcher
// contract runs for you on arrival — honest default matches nothing; a new snapshot surfaces new
// matches with zero fetch. Run: node viewer/atlas-offline.test.mjs
import { generateIdentity, attest } from "../composer/sign.mjs";
import { defaultHash } from "../composer/anecdote.mjs";
import { packStack, receiveStack } from "../composer/sneakernet.mjs";
import { repoRegistry, repoListView } from "./repos.mjs";
import { mergeAtlasIndex } from "./atlas-index.mjs";
import { landSnapshot, atlasView, matchOffline } from "./atlas-offline.mjs";
import { viewerOps } from "./probe-ops.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const te = new TextEncoder();
const T1 = "2026-07-01T00:00:00.000Z", T2 = "2026-07-08T00:00:00.000Z", NOW = "2026-07-09T00:00:00.000Z";

// an Atlas's signed record carrying a real public surface.
async function mkSnapshot(atlasId, at, identity, { piles = "", needs = "", tells = "", hearsay = "" } = {}) {
  const files = [];
  for (const [path, content] of [["_data/piles.yml", piles], ["_data/needs.yml", needs],
                                 ["_data/tells.yml", tells], ["_data/hearsay-piles.yml", hearsay]]) {
    if (content) files.push({ path, id: await defaultHash(te.encode(content)), content });
  }
  return attest({ schema: "atlas.snapshot/v1", atlas: atlasId, url: `https://${atlasId}.example.org`, at,
    files, absent: ["matches.json"] }, identity);
}
async function keptOf(snapshot, carrier) {
  const stack = await packStack([snapshot], carrier);
  return (await receiveStack(stack, [], { now: NOW })).kept[0];
}

const atlasX = await generateIdentity(), atlasY = await generateIdentity(), carrier = await generateIdentity();
const PILES = `- id: cd04-q1\n  name: "CD4 Q1"\n  scope: colorado\n  tell: tell\n`;
const TELLS = `- id: tell\n  scope: colorado\n  url: "https://tell.example.org"\n`;
const NEEDS = `- id: shelter-net\n  scope: colorado\n  asker_repo: acme/civic-node\n  terms: ""\n`;
const HEARSAY = `- id: orphan-hearsay\n  pile: "orphan"\n  poll: "budget"\n  scope: "colorado"\n  question: "Keep the library?"\n  status: live\n`;

// 1. landing: a kept copy becomes a registered atlas.snapshot repo; the account page grades it.
const registry = repoRegistry();
{
  const kept = await keptOf(await mkSnapshot("xenia", T1, atlasX, { piles: PILES, tells: TELLS, needs: NEEDS, hearsay: HEARSAY }), carrier);
  const r = await landSnapshot(kept, { registry });
  ok(!r.unchanged && registry.get("atlas:xenia"), "the kept copy lands as a registered repo");
  const row = repoListView(registry).rows.find((x) => x.label === "atlas:xenia");
  ok(row.kind === "atlas.snapshot" && row.trust.grade === "atlas" && row.source === "https://xenia.example.org" && row.downstreams.length === 0,
    "kind atlas.snapshot, trust grade 'atlas', source = the Atlas url, pushes nowhere");
  ok(/carried by/.test(row.lastMessage), "the commit narrates the provenance (carried by)");
}

// 2. the aggregate index reads the derived listings; byte-identical content corroborates by oid.
{
  const kept = await keptOf(await mkSnapshot("yampa", T1, atlasY, { piles: PILES }), carrier); // same pile bytes
  await landSnapshot(kept, { registry });
  const feed = mergeAtlasIndex(registry);
  const pileRow = feed.rows.find((x) => x.kind === "pile");
  ok(pileRow && pileRow.sources.length === 2, "two Atlases fronting byte-identical content collapse to ONE row with both sources — git's own content addressing is the dedup");
  ok(feed.rows.some((x) => x.kind === "hearsay" && x.title === "Keep the library?"),
    "a hearsay door's shadow question is on the feed, findable offline");
}

// 3. the whole public surface, offline, both dates riding.
{
  const view = atlasView(registry.get("atlas:xenia"));
  ok(view.piles.length === 1 && view.tells.length === 1 && view.needs.length === 1 && view.hearsay.length === 1,
    "tells + piles + needs + hearsay all render off the copy, no fetch");
  ok(view.stamped_at === T1 && view.accepted_at === NOW && view.carried_by === carrier.fingerprint,
    "staleness honest: the stamp, the acceptance, and who carried it all ride");
  ok(view.absent.includes("matches.json"), "what the snapshot lacked stays named");
}

// 4. the matcher runs for you: honest default matches nothing; a judge matches carried + own needs.
{
  const view = atlasView(registry.get("atlas:xenia"));
  const silent = await matchOffline(view);
  ok(silent.matches.length === 0 && silent.needsJudgment === 2, "no judge -> needs-judgment -> nothing matches (2 candidates seen)");
  const judge = async () => ({ verdict: "accept", reason: "fits" });
  const r = await matchOffline(view, { judge, needs: [{ id: "my-own-need", scope: "colorado", terms: "" }] });
  ok(r.matches.length === 4, "carried need + my own need each match the pile AND the hearsay door");
  const hearsayMatch = r.matches.find((m) => m.need_id === "my-own-need" && m.candidate.provisioner === "self");
  ok(hearsayMatch && hearsayMatch.candidate.question === "orphan/budget" && hearsayMatch.consent_required === true,
    "the mixed model rides offline: the door's question + self mark + consent flag");
}

// 5. a new snapshot ADVANCES the same repo (parent-linked) and surfaces new matches, zero fetch.
{
  const v2 = await mkSnapshot("xenia", T2, atlasX, { piles: PILES + `- id: water-q\n  name: "Bad water?"\n  scope: colorado\n  tell: tell\n`, tells: TELLS, needs: NEEDS, hearsay: HEARSAY });
  const entryBefore = registry.get("atlas:xenia");
  const tipBefore = entryBefore.repo.readRef(entryBefore.repo.head());
  const kept2 = await keptOf(v2, carrier);
  const r = await landSnapshot(kept2, { registry });
  ok(!r.unchanged && r.tip !== tipBefore, "a newer stamp advances the copy");
  const entry = registry.get("atlas:xenia");
  ok(entry.repo.objects.get(r.tip).content && new TextDecoder().decode(entry.repo.objects.get(r.tip).content).includes(`parent ${tipBefore}`),
    "history is parent-linked — the carried record keeps its own timeline");
  const rematch = await matchOffline(atlasView(entry), { judge: async () => ({ verdict: "accept", reason: "fits" }) });
  ok(rematch.matches.some((m) => m.candidate.pile_id === "water-q"),
    "the new snapshot re-runs into new matches without any fetch");
  const again = await landSnapshot(kept2, { registry });
  ok(again.unchanged === true, "re-landing the same stamp is a no-op (depth behind the sneakernet's own gate)");
}

// 6. the probe ops expose the face: atlas.view + atlas.match, judge from deps, honest default.
{
  const emitted = [];
  const api = { emit: (x) => emitted.push(x) };
  const ops = viewerOps({ registry });
  await ops["atlas.view"]({ id: "atlas:xenia" }, api);
  ok(emitted[0].view?.piles?.length === 2, "atlas.view emits the whole public surface");
  await ops["atlas.match"]({ id: "atlas:xenia" }, api);
  ok(emitted[1].result.matches.length === 0 && emitted[1].result.needsJudgment > 0, "atlas.match with no judge dep matches nothing, narrated");
  const opsJ = viewerOps({ registry, judge: async () => ({ verdict: "accept", reason: "fits" }) });
  await opsJ["atlas.match"]({ id: "atlas:xenia", needs: [{ id: "n2", scope: "colorado" }] }, api);
  ok(emitted[2].result.matches.length > 0, "a judge wired through deps matches — the §A seam, unchanged");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall atlas-offline tests passed");
