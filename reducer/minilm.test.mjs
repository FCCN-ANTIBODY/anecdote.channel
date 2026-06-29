// Integration test for the REAL instrument (all-MiniLM-L6-v2). Unlike test.mjs (dependency-free,
// always runs), this needs the @xenova/transformers package AND the vendored, verified weights.
// It SKIPS cleanly (exit 0) when either is absent, so a plain checkout and CI stay green.
//
//   cd reducer && npm i
//   node reducer/weights.mjs fetch
//   node reducer/minilm.test.mjs
//
// The headline assertion is the one the toy CANNOT pass: synonyms with no shared tokens
// ("library catalog codes" / "Dewey numbers") collide onto one label.

import { Reducer, cos } from "./reducer.mjs";
import { fewestVerbs, toyEmbed, makeMiniLmEmbed } from "./embedders.mjs";
import { present, canonicalVersion } from "./weights.mjs";

try { await import("@xenova/transformers"); }
catch { console.log("minilm.test: @xenova/transformers not installed — `npm i` in reducer/; skipping."); process.exit(0); }
if (!(await present())) {
  console.log("minilm.test: vendored MiniLM weights absent/unverified — `node reducer/weights.mjs fetch`; skipping.");
  process.exit(0);
}

// Calibrated thresholds — replace with the numbers `node reducer/calibrate.mjs` prints at
// bootstrap. Provisional defaults until then.
const assignT = 0.45, mergeT = 0.55;

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const embed = await makeMiniLmEmbed();
const mk = () => new Reducer({ embed, name: fewestVerbs, reducerVersion: embed.reducerVersion, assignT, mergeT });
async function reduce(r, us) { for (const u of us) await r.assign(u); return r; }

// 1. Shape: 384-dim, unit length.
{
  const v = await embed("is there shade at this park");
  ok(v.length === 384, "embedding is 384-dimensional");
  ok(Math.abs(cos(v, v) - 1) < 1e-6, "embedding is unit length (self-cosine ≈ 1)");
}

// 2. Determinism: same text, same vector (fixed weights, cold-load).
{
  const a = await embed("park shade"), b = await embed("park shade");
  ok(a.every((x, i) => Math.abs(x - b[i]) < 1e-9), "embedding is deterministic for fixed weights");
}

// 3. THE point: synonymy with no shared tokens now collides. This is the demo's honest miss.
{
  const A = await reduce(mk(), ["Dewey decimal numbers on this shelf"]);
  const B = await reduce(mk(), ["the library catalog codes here"]);
  const U = mk();
  U.labels = [...A.labels.map((l) => ({ ...l })), ...B.labels.map((l) => ({ ...l }))];
  ok(U.labels.length === 2, "the two synonym labels start distinct (independently minted)");
  U.ratchet();
  ok(U.labels.length === 1, "ratchet folds 'library catalog codes' into the Dewey label — the toy's honest miss, resolved");
  ok(U.labels[0].aliases.length >= 1, "the folded synonym is recorded as an alias");
}

// 4. Distinct meanings still stay distinct (no over-merging).
{
  const r = await reduce(mk(), ["shade at the park", "Dewey decimal numbers on this shelf"]);
  ok(r.labels.length === 2, "unrelated utterances stay on separate labels");
  ok(r.ratchet() === 0, "and the ratchet does not merge them");
}

// 5. reducerVersion guard: MiniLM and toy vectors never silently mix in either direction.
{
  const r = await reduce(mk(), ["shade at the park"]);
  const snap = r.toJSON();
  ok(snap.reducerVersion === canonicalVersion(), "snapshot is stamped with the weights-pinned version");
  let toyRefused = false;
  try { await Reducer.from(snap, { embed: toyEmbed, name: fewestVerbs, reducerVersion: "toy/v0" }); } catch { toyRefused = true; }
  ok(toyRefused, "a MiniLM snapshot is refused when loaded under the toy embedder");
  // and a toy snapshot is refused under MiniLM
  const toyR = new Reducer({ embed: toyEmbed, name: fewestVerbs });
  await toyR.assign("shade at the park");
  let miniRefused = false;
  try { await Reducer.from(toyR.toJSON(), { embed, name: fewestVerbs, reducerVersion: embed.reducerVersion }); } catch { miniRefused = true; }
  ok(miniRefused, "a toy snapshot is refused when loaded under MiniLM");
}

console.log(fails ? `\n${fails} FAILED` : `\nminilm: all tests passed (${canonicalVersion()})`);
process.exit(fails ? 1 : 0);
