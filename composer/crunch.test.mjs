// Tests for the crunch ranking brain. Dependency-free (toy embedder), deterministic.
//   node composer/crunch.test.mjs
import { nearest, cosineSim } from "./crunch.mjs";
import { toyEmbed } from "../reducer/embedders.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const LABELS = ["park shade", "library hours", "trash pickup", "bus routes", "potholes"];
const dict = LABELS.map((label) => ({ label, vec: toyEmbed(label) }));

// 1. The query's nearest concept is the one it shares meaning/tokens with.
{
  const top = nearest(toyEmbed("is there shade at this park"), dict, 3);
  ok(top[0].label === "park shade", "nearest concept to a shade/park utterance is 'park shade'");
  ok(top.length === 3, "returns exactly n results");
  ok(top[0].score >= top[1].score && top[1].score >= top[2].score, "results are sorted descending by score");
}

// 2. A different intent ranks a different concept first. (Toy sees token overlap, so we share a
//    token; under MiniLM the synonym "garbage" would also reach "trash pickup" — that's the upgrade.)
{
  const top = nearest(toyEmbed("the trash was left on the curb"), dict, 1);
  ok(top[0].label === "trash pickup", "nearest concept to a trash utterance is 'trash pickup'");
}

// 3. Determinism: same query, same ranking every run.
{
  const a = JSON.stringify(nearest(toyEmbed("park shade today"), dict, 5));
  const b = JSON.stringify(nearest(toyEmbed("park shade today"), dict, 5));
  ok(a === b, "ranking is deterministic for a pinned embedder");
}

// 4. Edge cases: empty dict / empty query / n=0 are safe.
{
  ok(nearest(toyEmbed("x"), [], 3).length === 0, "empty dictionary yields no suggestions");
  ok(nearest(null, dict, 3).length === 0, "missing query vector yields no suggestions");
  ok(nearest(toyEmbed("x"), dict, 0).length === 0, "n=0 yields no suggestions");
}

// 5. cosineSim sanity.
ok(Math.abs(cosineSim(toyEmbed("park shade"), toyEmbed("shade park")) - 1) < 1e-9,
  "cosineSim of order-independent toy vectors is ~1");

console.log(fails ? `\n${fails} FAILED` : "\ncrunch: all tests passed");
process.exit(fails ? 1 : 0);
