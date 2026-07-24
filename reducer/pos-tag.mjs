// reducer/pos-tag.mjs — a PURE-RULE English part-of-speech tagger + focal-range SELECTION (companion study).
//
// The thesis of this study: the whole reduction FLOOR is SELECTION, not generation — and selection can be a
// small, deterministic, PEER-REVIEWABLE algorithm with a near-zero footprint, no weights, no GPU, offline,
// and fast enough to run per-keystroke. This is the grammatical version of the content-word strip: instead of
// a hand-picked stopword list (reducer/embedders.mjs `content`), it drops words by their GRAMMATICAL CLASS and
// keeps the content heads — and, unlike a stopword list, it keeps NUMBERS as a typed focal class (quantities:
// "two eggs", "$2.18", "four hundred degrees") and can tell a verb from a noun.
//
// It tags to UNIVERSAL POS (UPOS, the Universal Dependencies tagset) so the scheme is language-neutral even
// though this lexicon is English — the door to other languages is a different lexicon behind the same tags.
//
// HONESTY about the ceiling (this is the whole point of the study): a hand table + suffix rules is ~85–92% on
// clean English, NOT the ~97% of a trained tagger, and it does NOT parse DEPENDENCIES — so it selects content
// HEADS by class, but it cannot reliably pick "the MAIN verb" or "the direct object" (that needs the ~12MB
// learned-parser rung). Crucially, focal selection is ROBUST to the tagger's weak spots: every ambiguous
// closed-class word (to = ADP/PART, that = DET/SCONJ) is NON-FOCAL whichever way it lands, so the drop set is
// reliable even where the fine tag is not. And like the subtractive namer, it hits the SAME grouper wall — it
// can surface the focal words but cannot COIN a type ("ingredients") for a group that doesn't contain it.
//
// It NEVER rewrites: it emits cursor SPANS into the raw text (the answer still comes from the bytes). That is
// what keeps an opinionated reducer honest — opinionated SELECTION is transparent and reversible; opinionated
// rewriting is not.

// ---- UPOS closed-class lexicon: near-exhaustive small tables (the load-bearing, reviewable part) ----------
// Closed classes barely grow, so a few hundred words cover the overwhelming majority of function-word tokens.
const CLOSED = [
  ["PRON", "i you he she it we they me him her us them who whom whose mine yours ours theirs myself yourself himself herself itself ourselves themselves someone anyone everyone nobody somebody anybody everybody something anything everything nothing"],
  ["DET",  "a an the this that these those my your his its our their some any no every each all both few many much several which what whose another either neither"],
  ["ADP",  "of in for with on at by from about into over under above below near off through during without before between against among around upon within along across behind beyond per than unto onto toward towards despite besides"],
  ["AUX",  "is am are was were be been being have has had do does did will would shall should can could may might must ought"],
  ["PART", "not to"],
  ["SCONJ","if because although though while whereas unless until since when whenever wherever whether"],
  ["CCONJ","and or but nor yet so plus"],
  ["ADV",  "very too also then now here there well just only even still again ever never always often sometimes usually quite rather almost already soon later once twice however therefore thus indeed perhaps maybe"],
];
const NUMWORDS = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion trillion dozen";

// Build one word -> tag map. Earlier entries win, so the precedence above resolves the few overlaps (e.g. a
// number word is claimed by NUM below, not by any closed class). Kept as data so the whole vocabulary is
// auditable at a glance.
const LEX = new Map();
for (const [tag, words] of CLOSED) for (const w of words.split(" ")) if (!LEX.has(w)) LEX.set(w, tag);
const NUM = new Set(NUMWORDS.split(" "));

// ---- suffix / shape rules for OPEN-class words not in the lexicon --------------------------------------
// Ordered; first match wins. The default is NOUN — the single best guess for an unknown open-class word.
const SUFFIX = [
  [/(?:tion|sion|ment|ness|ity|ance|ence|ship|hood|ism|ist|er|or|age)$/, "NOUN"],
  [/(?:ize|ise|ate|ify|en)$/, "VERB"],
  [/(?:ous|ful|less|ive|able|ible|ical|ic|ish|ary|ent|ant|ese|ian)$/, "ADJ"],
  [/ly$/, "ADV"],
  [/ing$/, "VERB"],
  [/ed$/, "VERB"],
];

const WORD = /[A-Za-z]+(?:['’-][A-Za-z]+)*/y;            // a word, with internal apostrophe/hyphen
const NUMTOK = /\$?\d[\d.,:%]*/y;                              // a number/currency/percent token
const SKIP = /[^A-Za-z0-9$]+/y;                                // run of separators/punctuation to skip

// Tag `text` to UPOS. Returns [{ word, lower, tag, span:{start,end} }] over word/number tokens (punctuation is
// not emitted). Cursor-anchored: text.slice(span.start, span.end) === word, always.
export function tag(text) {
  const out = [];
  let i = 0, sentenceStart = true;
  while (i < text.length) {
    NUMTOK.lastIndex = i; const nm = NUMTOK.exec(text);
    if (nm && nm.index === i) {
      let s = nm[0];                                             // don't let a number swallow trailing punctuation:
      while (s.length > 1 && !/[0-9%]$/.test(s)) s = s.slice(0, -1); // "1." → "1", and the "." becomes a sentence break
      out.push({ word: s, lower: s.toLowerCase(), tag: "NUM", span: { start: i, end: i + s.length } });
      i += s.length; sentenceStart = false; continue;
    }
    WORD.lastIndex = i; const wm = WORD.exec(text);
    if (wm && wm.index === i) {
      const w = wm[0], lower = w.toLowerCase();
      out.push({ word: w, lower, tag: tagWord(lower, w, sentenceStart), span: { start: i, end: i + w.length } });
      i += w.length; sentenceStart = false; continue;
    }
    SKIP.lastIndex = i; const sk = SKIP.exec(text);
    const chunk = sk && sk.index === i ? sk[0] : text[i];
    if (/[.!?]/.test(chunk)) sentenceStart = true;              // next word begins a sentence
    i += chunk.length;
  }
  return out;
}

// Tag a single lowercased word (with the original for capitalization) by lexicon, then number, then shape.
function tagWord(lower, orig, sentenceStart) {
  if (NUM.has(lower)) return "NUM";
  const lex = LEX.get(lower);
  if (lex) return lex;
  // A capitalized word NOT at a sentence start is a proper noun (mid-sentence capitals are names).
  if (!sentenceStart && /^[A-Z]/.test(orig)) return "PROPN";
  for (const [re, t] of SUFFIX) if (re.test(lower)) return t;
  return "NOUN";
}

// ---- focal selection: keep the content HEADS, drop particles and (by default) modifiers ------------------
// The policy, stated plainly so it is reviewable: keep NOUN, PROPN, VERB, NUM (the content heads and the
// quantities); drop everything else (function words always; ADJ/ADV unless keepAdj). Returns the kept tokens
// with their cursor spans — the ranges of the sentence that carry the load.
const FOCAL = new Set(["NOUN", "PROPN", "VERB", "NUM"]);
export function focal(text, { keepAdj = false } = {}) {
  const keep = keepAdj ? new Set([...FOCAL, "ADJ"]) : FOCAL;
  return tag(text).filter((t) => keep.has(t.tag));
}

// A grammatical namer: the focal words, deduped and capped — a drop-in for doc-nodemap's `namer` seam and the
// POS counterpart of subtractiveNamer. It selects BETTER than the stopword strip (near-exhaustive drop, keeps
// numbers) but it STILL cannot type a group — the same grouper wall. Emits "…" when it truncates, like the
// subtractive namer, so a stall is visible the same way.
export function posNamer(text, { cap = 6, keepAdj = false } = {}) {
  const seen = new Set(), words = [];
  for (const t of focal(text, { keepAdj })) if (!seen.has(t.lower)) { seen.add(t.lower); words.push(t.lower); }
  return words.slice(0, cap).join(" ") + (words.length > cap ? " …" : "");
}

// Small stats for the study's footprint claim: how big the reviewable tables actually are.
export function tables() {
  return { closedClassWords: LEX.size, numberWords: NUM.size, suffixRules: SUFFIX.length, tagset: "UPOS (Universal Dependencies)" };
}
