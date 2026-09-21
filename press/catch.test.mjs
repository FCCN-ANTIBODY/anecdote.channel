// Unit: press/catch.mjs — the gravel-catcher as a composition. Run: node press/catch.test.mjs
import { catcher, openCaught, slapDown, BOTTLE_KINDS } from "./catch.mjs";
import { strike } from "./bench.mjs";
import { openPile } from "./pile.mjs";
import { resolveFace } from "./face.mjs";
import { generateIdentity } from "../composer/sign.mjs";
import { packTransfer, verifyTransfer } from "../composer/transfer.mjs";
import { fountainTransfer } from "../composer/carrier.mjs";
import { memoryStore } from "../reducer/store.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const author = { name: "you", email: "you@origin", epoch: 1789000000, tz: "+0000" };

const stranger = await generateIdentity();
const s = await strike({ text: "The water fountain by the library is broken again.", object: { name: "f.txt", mediaType: "text/plain", bytes: "drip" },
                         pile: { id: "their-pile" }, identity: stranger });

async function pour(transfer, into, { dentEvery = 0 } = {}) {
  const ft = await fountainTransfer(transfer, { blockSize: 128 });
  let out, seed = 0;
  do {
    let frame = ft.frame(seed++);
    if (dentEvery && seed % dentEvery === 0) { const i = frame.length - 3; frame = frame.slice(0, i) + (frame[i] === "A" ? "B" : "A") + frame.slice(i + 1); }
    out = await into.feed(frame);
  } while (!out.caught && seed < ft.K * 12);
  return { out, seed };
}

// 1. A stranger's bottle is caught: verified, not trusted, and that stops nothing.
const c = catcher();
const { out } = await pour(s.transfer, c, { dentEvery: 3 });
ok(out.caught && out.caught.length === 1, "caught through every-third-frame damage");
ok(out.progress.damaged > 0, "…and the healing was visible: " + out.progress.damaged + " dents absorbed");
const got = out.caught[0];
ok(got.kind === "anecdote" && got.by === stranger.fingerprint && got.trusted === false, "kind, signer, and honestly untrusted");
ok(c.isDone() && (await c.feed("anything")) === out, "the loop keeps looping; a full catcher stays full");

// 2. Only bottles are caught — anything else is SEEN and said, not picked up.
{
  const fw = await packTransfer("firmware", "not for the press", stranger);
  const r = (await pour(fw, catcher())).out;
  ok(r.caught.length === 0 && r.passed.length === 1 && r.passed[0].kind === "firmware" && /not a bottle kind/.test(r.passed[0].reason), "a non-bottle kind is reported, not caught");
  ok(BOTTLE_KINDS.includes("anecdote") && BOTTLE_KINDS.includes("poll") && BOTTLE_KINDS.includes("data-pile"), "the three kinds D17 names as in use");
}

// 3. Opening is the same sterile path as any bottle: the statement is the door.
{
  const face = await resolveFace(openCaught(got));
  ok(face.face === "README.md" && face.title.startsWith("The water fountain"), "the statement greets you, not the JSON");
  ok(face.html.includes("receipt for <code>text/plain</code>") && face.html.includes('href="anecdote.json"'), "the receipt is described and the signed original is one link away");
  ok((await resolveFace(openCaught(got), { path: "anecdote.json" })).html.includes("anecdote/v1"), "and it opens");
}

// 4. Loaded is not persisted — until the deliberate act, which keeps the SEED whole.
{
  const store = memoryStore();
  const mine = await openPile(store, "field-notes");
  ok(mine.files().length === 0, "catching and opening wrote nothing anywhere");
  const path = await slapDown(got, mine, { author });
  ok(/^caught\/[0-9a-f]{16}\.anecdote\.json$/.test(path) && mine.history()[0].message.startsWith("caught: a anecdote from "), "slapped down as one commit, named by its content id");
  const kept = JSON.parse(await mine.fetchText(path));
  const v = await verifyTransfer(kept);
  ok(v.ok && v.by === stranger.fingerprint, "what was kept is the original, and it still verifies from the pile");
}

if (fails) { console.error(`\n${fails} failed`); process.exit(1); }
console.log("\ncatch: all passed");
