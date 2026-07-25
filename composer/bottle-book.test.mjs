// Unit: composer/bottle-book.mjs — the device's own book of bottles: explicit save, merge-by-host,
// residue-free forget, and the emergent-subtype sift (signed kind filters; free text sifts descriptor
// content). Run: node composer/bottle-book.test.mjs
import { saveBottle, forgetBottle, readBook, siftBook, bookOps, BOOK_KEY } from "./bottle-book.mjs";
import { elevatedSession } from "./probe-line.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), _m: m };
};

// 1. the deliberate save, and merge-by-host on re-sighting.
{
  const s = mem();
  saveBottle(s, { host: "parks-2026.tell", kind: "data-pile", label: "the parks study" }, { now: "2026-07-01T00:00:00Z" });
  saveBottle(s, { host: "git.bottles", kind: "storage-engine" }, { now: "2026-07-02T00:00:00Z" });
  ok(readBook(s).length === 2, "two deliberate saves, two entries");
  const again = saveBottle(s, { host: "parks-2026.tell", descriptor: { schema: "anecdote.describe/v1", as_of: "2026-07-03T00:00:00Z", questions: [{ text: "flooding on the east bank?" }] } }, { now: "2026-07-03T00:00:00Z" });
  const e = again.find((x) => x.host === "parks-2026.tell");
  ok(again.length === 2 && e.kind === "data-pile" && e.label === "the parks study",
     "re-saving merges by host — kind and label survive a partial re-sighting");
  ok(e.saved_at === "2026-07-01T00:00:00Z" && e.seen_at === "2026-07-03T00:00:00Z",
     "saved_at keeps the first act; seen_at tracks the latest");
  // 2. the sift: signed kind filters; free text reaches the cached descriptor's content.
  ok(siftBook(s, { kind: "data-pile" }).length === 1, "kind sifts on the signed macro type");
  ok(siftBook(s, { q: "flooding" }).length === 1 && siftBook(s, { q: "flooding" })[0].host === "parks-2026.tell",
     "free text sifts the descriptor's own content — emergent subtypes, no enum");
  ok(siftBook(s, { q: "nonesuch" }).length === 0, "a miss is a miss");
}

// 3. a malformed host is refused; junk in storage is dropped, not repaired.
{
  const s = mem();
  let threw = false; try { saveBottle(s, { host: "not a host!" }); } catch { threw = true; }
  ok(threw, "a non-bottle host cannot be saved");
  s.setItem(BOOK_KEY, JSON.stringify([{ schema: "wrong" }, 42]));
  ok(readBook(s).length === 0, "unshaped storage reads as empty, never as entries");
}

// 4. forget is residue-free: the last forget leaves NO key behind (the blank state is real).
{
  const s = mem();
  saveBottle(s, { host: "parks-2026.tell" }, { now: "2026-07-01T00:00:00Z" });
  saveBottle(s, { host: "git.bottles" }, { now: "2026-07-01T00:00:00Z" });
  forgetBottle(s, "parks-2026.tell");
  ok(readBook(s).length === 1, "forget removes exactly the named entry");
  forgetBottle(s, "git.bottles");
  ok(s.getItem(BOOK_KEY) === null, "an emptied book leaves no storage residue at all");
}

// 5. the probe surface: list reads free (Rung 0); save/forget persist (Rung 1 — confirmation required).
{
  const s = mem();
  const frames = [];
  const sess = elevatedSession({ ops: bookOps({ storage: s }), emit: (f) => frames.push(f),
                                 yield_: () => Promise.resolve(), context: () => ({ recordingOn: true, grants: [] }) });
  await sess.handle({ type: "probe.line.request/v1", id: "b1", op: "bottles.save", input: { host: "parks-2026.tell", kind: "data-pile" } });
  ok(frames.some((f) => f.type === "probe.line.error/v1" && f.id === "b1" && f.needsConfirm),
     "an unconfirmed save is refused with needsConfirm — changing the operator's memory takes the operator");
  await sess.handle({ type: "probe.line.request/v1", id: "b2", op: "bottles.save", input: { host: "parks-2026.tell", kind: "data-pile" }, confirmed: true });
  await sess.handle({ type: "probe.line.request/v1", id: "b3", op: "bottles.list", input: { kind: "data-pile" } });
  const listed = frames.find((f) => f.id === "b3" && f.bottles);
  ok(!!listed && listed.bottles.length === 1, "a picker lists freely (Rung 0) once the operator has saved");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nok: bottle-book — an address book the operator fills, sifts, and can truly empty; never a registry");
