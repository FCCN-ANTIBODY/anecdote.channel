// Unit: pos-tag (pos-tag.mjs) — the pure-rule UPOS tagger + focal selection. Proves the load-bearing claims:
// closed-class function words are reliably identified (so the DROP set is trustworthy even where fine tags are
// not), numbers survive as a focal class (the stopword strip's blind spot), spans are verbatim cursors, and
// focal selection keeps content heads while dropping particles. Also pins the honest limits as expectations.
// Run: node reducer/pos-tag.test.mjs
import { tag, focal, posNamer, tables } from "./pos-tag.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const tagOf = (tokens, w) => tokens.find((t) => t.lower === w)?.tag;

// 1. closed-class words tag as function words (the reliable drop set).
{
  const t = tag("the cat is on a mat and it ran to the shop");
  ok(tagOf(t, "the") === "DET" && tagOf(t, "a") === "DET", "determiners tag DET");
  ok(tagOf(t, "is") === "AUX", "'is' tags AUX");
  ok(tagOf(t, "on") === "ADP" && tagOf(t, "to") === "PART", "prepositions/particles tag as function words");
  ok(tagOf(t, "and") === "CCONJ" && tagOf(t, "it") === "PRON", "conjunction and pronoun tag closed-class");
}

// 2. numbers survive as a focal class — the stopword strip's blind spot.
{
  const t = tag("two large eggs and four hundred degrees at $2.18");
  ok(tagOf(t, "two") === "NUM" && tagOf(t, "four") === "NUM" && tagOf(t, "hundred") === "NUM", "number words tag NUM");
  ok(t.some((x) => x.word === "$2.18" && x.tag === "NUM"), "a currency token stays one NUM token ('$2.18' is not split)");
}

// 3. cursor spans are verbatim.
{
  const src = "Mayor Arndt presiding over Council";
  const t = tag(src);
  ok(t.every((x) => src.slice(x.span.start, x.span.end) === x.word), "every token's span slices its verbatim word");
  ok(tagOf(t, "arndt") === "PROPN", "a mid-sentence capitalized word tags PROPN (a name)");
}

// 4. focal selection keeps content heads, drops particles.
{
  const f = focal("the clerk records the quorum for the council").map((x) => x.lower);
  ok(f.includes("clerk") && f.includes("records") && f.includes("quorum") && f.includes("council"), "content heads are kept");
  ok(!f.includes("the") && !f.includes("for"), "determiners and prepositions are dropped");
}

// 5. focal selection beats the stopword strip on a quantity question (keeps the number).
{
  const f = focal("bake for twenty minutes").map((x) => x.lower);
  ok(f.includes("twenty") && f.includes("minutes") && f.includes("bake"), "a quantity is kept as focal (twenty)");
  ok(!f.includes("for"), "the preposition is dropped");
}

// 6. posNamer selects grammatically but STILL cannot type a group — the same grouper wall.
{
  const label = posNamer("one cup all purpose flour\ntwo large eggs\nthree tablespoons honey");
  ok(/\s/.test(label) && /flour|eggs|honey|cup/.test(label), "posNamer concatenates focal words (cleaner selection, same stall)");
  ok(!/^ingredients$/.test(label), "it does NOT coin the type 'ingredients' — grammar selects, it does not generate");
}

// 7. the footprint claim: the reviewable tables are small.
{
  const s = tables();
  ok(s.closedClassWords > 100 && s.closedClassWords < 400, `closed-class table is small and near-exhaustive (${s.closedClassWords} words)`);
  ok(s.tagset.startsWith("UPOS"), "tags to the universal (UD) tagset");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall pos-tag tests passed");
