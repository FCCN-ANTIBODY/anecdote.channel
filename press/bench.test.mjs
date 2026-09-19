// Unit: press/bench.mjs + press/pile.mjs + press/view-state.mjs — the write gesture end to end: a statement
// with an object is struck, signed, printed into a pile as a commit, read back through the SAME face
// resolver that reads a neighbour, and poured/caught over the carrier. Run: node press/bench.test.mjs
import { strike, frontPage } from "./bench.mjs";
import { openPile, dropPile } from "./pile.mjs";
import { remember, recall, forget, VIEW_KEY } from "./view-state.mjs";
import { resolveFace } from "./face.mjs";
import { generateIdentity, verifySignature } from "../composer/sign.mjs";
import { verifyTransfer } from "../composer/transfer.mjs";
import { fountainTransfer, carrierSession } from "../composer/carrier.mjs";
import { verify as verifyAnecdote } from "../composer/anecdote.mjs";
import { memoryStore } from "../reducer/store.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const author = { name: "you", email: "you@origin", epoch: 1789000000, tz: "+0000" };

const me = await generateIdentity();
const store = memoryStore();

// 1. Strike: a statement with an object attached.
const photo = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
const s = await strike({ text: "There is shade at this park in the afternoon.", object: { name: "bench.png", mediaType: "image/png", bytes: photo },
                         pile: { id: "field-notes" }, identity: me });
ok(s.anecdote.schema === "anecdote/v1" && s.anecdote.body[0].kind === "text" && s.anecdote.body[1].kind === "ref", "body[0] is the statement, the object rides as a ref");
ok(s.anecdote.body[1].bytes === undefined && s.anecdote.body[1].pile === "field-notes", "the anecdote carries the receipt; the pile holds the bytes");
ok((await verifySignature(s.signed)).ok, "signed on-device and verifies");
ok(/^sha256:[0-9a-f]{64}$/.test(s.id) && s.sheets[0].path === "anecdotes/" + s.id.slice(7, 23) + ".json", "the content id names the sheet");
ok(s.sheets.length === 2 && s.sheets[1].path === "objects/" + s.anecdote.body[1].hash.slice(7), "the object is a second sheet, under its own hash");
ok(typeof s.label === "string", "a fewest-verbs label rode along: " + JSON.stringify(s.label));

// 2. Never blocked: no object is fine; only an EMPTY statement cannot be struck.
ok((await strike({ text: "no stupid statements", pile: { id: "field-notes" }, identity: me })).sheets.length === 1, "a bare statement strikes one sheet");
{ let threw = false; try { await strike({ text: "   ", pile: { id: "field-notes" }, identity: me }); } catch { threw = true; } ok(threw, "an empty statement is not a statement"); }

// 2b. A statement ABOUT something points at a version of it, by hash, and keeps none of its bytes.
{
  const page = "# Their README\n\nAs it read when I looked.\n";
  const a = await strike({ text: "This method skips winter.", about: { source: "https://field-guide.library.anecdote.channel/docs/method.md", bytes: page, mediaType: "text/markdown" },
                           pile: { id: "field-notes" }, identity: me });
  const ref = a.anecdote.body[1];
  ok(ref.kind === "ref" && ref.source.endsWith("/docs/method.md") && /^sha256:/.test(ref.hash) && ref.pile === undefined, "the subject rides as a receipt: where, and which version");
  ok(a.sheets.length === 1 && !JSON.stringify(a.signed).includes("As it read when I looked"), "by reference, never by copy: none of their bytes are kept or carried");
}

// 3. Print into a pile: a commit; history accrues; earlier sheets are carried forward.
const pile = await openPile(store, "field-notes");
await pile.strike(s.sheets, { author, message: "print: " + s.label });
const s2 = await strike({ text: "The crosswalk signal on Mason is too short.", pile: { id: "field-notes" }, identity: me });
await pile.strike([...s2.sheets, { path: "index.md", content: frontPage("field-notes", [
  { label: s2.label, path: s2.sheets[0].path }, { label: s.label, path: s.sheets[0].path, object: "bench.png" }]) }], { author, message: "print: " + s2.label });
ok(pile.history().length === 2 && pile.history()[0].message.startsWith("print: "), "two strikes, two commits, newest first");
ok(pile.files().length === 4, "both anecdotes + the object + the front page are in the tip: " + pile.files().map((f) => f.path).join(", "));

// 4. A pile reads like any other bottle: the SAME face resolver, fed the pile instead of HTTP.
{
  const f = await resolveFace(pile.fetchText);
  ok(f.face === "index.md" && f.html.includes("<li><a href=\"" + s.sheets[0].path + "\">"), "the pile's front page is its face, with the sheets as links");
  const sheet = await resolveFace(pile.fetchText, { path: s.sheets[0].path });
  ok(sheet.face === "text" && sheet.html.includes("anecdote/v1"), "a sheet opens as the text it is");
}

// 5. It survives the tab: reopen from the store and the history is the same history.
{
  const again = await openPile(store, "field-notes");
  ok(again.tip() === pile.tip() && again.history().length === 2, "reopened pile has the same tip and history");
  await dropPile(store, "field-notes");
  ok((await openPile(store, "field-notes")).tip() === null, "a dropped pile is gone, back to mint condition");
  let threw = false; try { await openPile(store, "Not A Label"); } catch { threw = true; }
  ok(threw, "a pile's name is a label — it is also its address");
}

// 6. Pour and catch: the struck transfer goes through the fountain and comes out verified, kind intact.
{
  const ft = await fountainTransfer(s.transfer, { blockSize: 128 });
  const rx = carrierSession({ friends: [me.fingerprint] });
  let snap, seed = 0;
  do { snap = await rx.feed(ft.frame(seed++)); } while (!snap.complete && seed < ft.K * 6);
  ok(snap.complete, `caught in ${seed} droplets (K=${ft.K})`);
  const r = await rx.result();
  const v = await verifyTransfer(r.transfers[0].signed, { friends: [me.fingerprint] });
  ok(v.ok && v.trusted && v.kind === "anecdote", "the caught transfer verifies, is trusted, and says it is an anecdote");
  const caught = JSON.parse(new TextDecoder().decode(v.bytes));
  ok((await verifySignature(caught)).ok && caught.body[0].text.startsWith("There is shade"), "and inside it, the signed anecdote is intact");
  ok((await verifyAnecdote(caught)).ok, "its receipts hold");
}

// 7. View memory: one slot per skin, validated both ways, no residue.
{
  const ls = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; })();
  ok(recall(ls, "halt") === null, "nothing remembered yet");
  ok(remember(ls, "halt", { address: "Journal", path: "docs/x.md", mode: "live" }), "remember");
  ok(JSON.stringify(recall(ls, "halt")) === JSON.stringify({ address: "journal", path: "docs/x.md", mode: "live" }), "recall, address normalized");
  remember(ls, "halt", { address: "tell", path: "" });
  ok(recall(ls, "halt").address === "tell" && Object.keys(JSON.parse(ls.getItem(VIEW_KEY))).length === 1, "ONE slot: the new view replaces the old, no trail");
  ok(!remember(ls, "halt", { address: "bad_label" }) && !remember(ls, "halt", { address: "x", path: "../y" }), "an invalid view is never written");
  ls.setItem(VIEW_KEY, JSON.stringify({ halt: { address: "x", path: "../../y" } }));
  ok(recall(ls, "halt") === null, "a tampered slot is never restored");
  ok(remember(ls, "halt", { pile: "field-notes", path: "index.md" }) && recall(ls, "halt").pile === "field-notes", "a pile view is remembered as a pile view");
  ok(!remember(ls, "halt", { pile: "Not A Label" }), "…and validated like one");
  ls.setItem(VIEW_KEY, "{not json"); ok(recall(ls, "halt") === null, "garbage recalls as nothing");
  remember(ls, "a", { address: "tell" }); forget(ls, "a"); forget(ls, "halt");
  ok(ls.getItem(VIEW_KEY) === null, "forgetting the last skin removes the key itself");
}

if (fails) { console.error(`\n${fails} failed`); process.exit(1); }
console.log("\nbench: all passed");
