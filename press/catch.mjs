// press/catch.mjs — THE READ GESTURE: catch an object, look at it sterile, and only then decide to keep it.
//
// civic-node OPEN-QUESTIONS §Z: "The gravel-catcher is the onboarding surface … catch droplets, reassemble,
// verify the capsule's signature and kind, open in the chamber, keep the seed, offer persist. Every side of
// it exists; the catcher is the composition." This is that composition, and only that: carrier.mjs does the
// catching, transfer.mjs the verifying, press/face.mjs + press/chamber.mjs the sterile opening, press/pile.mjs
// the keeping. Frames come from wherever they come from — a camera on a floor, a recording, the next tab.
//
// THE RULES IT KEEPS (docs/decisions.md D15):
//   1. ONLY BOTTLES ARE CAUGHT. A member whose kind is not a bottle kind is not caught — it is REPORTED, with
//      its kind, because a witness says what it saw (invariant #3) even when it will not pick it up.
//   2. VERIFY-FROM-ANYONE; TRUST DECIDES ACTION (invariant #2). A stranger's bottle verifies and opens. What
//      `trusted` changes is nothing here — opening is always sterile, so there is nothing for trust to gate.
//   3. LOADED IS NOT PERSISTED. `caught.seed` is the exact signed transfer that arrived; it lives in memory
//      until `slapDown` — a deliberate act — writes it into a pile, whole, as the thing that can be
//      re-verified and re-opened later: "this is the original, this is where I came from."

import { carrierSession } from "../composer/carrier.mjs";
import { verifyTransfer, transferId } from "../composer/transfer.mjs";
import { canonicalize } from "../composer/sign.mjs";

// The transfer kinds that ARE bottles today (D17: "poll", "anecdote" and "data-pile" are already in use).
// One free-string vocabulary, kept in one place until D15's "two kinds" collision is resolved upstream.
export const BOTTLE_KINDS = ["anecdote", "poll", "data-pile"];

const td = new TextDecoder();
const hex = (h) => String(h).replace(/^sha256:/, "");

export function catcher({ friends = [] } = {}) {
  const session = carrierSession({ friends });
  let done = null;

  // Feed one decoded frame string. Returns { progress, caught?, passed? }:
  //   progress  { have, total, damaged }   — the healing, visible
  //   caught    [...]                       — set once, when the stream completes
  //   passed    [{ kind, reason }]          — what arrived and was NOT picked up, and why
  async function feed(frame) {
    if (done) return done;
    const snap = await session.feed(frame);
    const m = snap.present[0];
    const progress = { have: m ? m.have : 0, total: m && m.total ? m.total : 0, damaged: snap.damaged };
    if (!snap.complete) return { progress };

    const r = await session.result();
    const caught = [], passed = [];
    for (const t of (r.transfers || [])) {
      const v = await verifyTransfer(t.signed, { friends });
      if (!v.ok) { passed.push({ kind: t.signed && t.signed.kind, reason: "did not verify: " + v.errors.join("; ") }); continue; }
      if (!BOTTLE_KINDS.includes(v.kind)) { passed.push({ kind: v.kind, reason: "not a bottle kind — seen, not caught" }); continue; }
      caught.push({ id: await transferId(t.signed), kind: v.kind, by: v.by, trusted: v.trusted, size: v.bytes.length,
                    seed: t.signed, bytes: v.bytes });
    }
    done = { progress: { ...progress, have: progress.total }, caught, passed };
    return done;
  }
  return { feed, isDone: () => !!done };
}

// What a caught bottle IS, as a path -> text reader the face resolver can open. An anecdote is one file;
// its statement is promoted to a small README so the ladder has a door to show (a one-file bottle is just
// the file — but a person should be greeted by the sentence, not by JSON).
export function openCaught(caught) {
  const text = td.decode(caught.bytes);
  const files = {};
  if (caught.kind === "anecdote") {
    let a = null; try { a = JSON.parse(text); } catch { /* shown as text below */ }
    files["anecdote.json"] = text;
    if (a && Array.isArray(a.body) && a.body[0]) {
      const refs = a.body.slice(1).filter((p) => p && p.kind === "ref");
      files["README.md"] = "# " + String(a.body[0].text).replace(/\n+/g, " ") + "\n\n" +
        (refs.length ? refs.map((p) => "- carries a receipt for `" + p.mediaType + "` — " + p.source + " (`" + hex(p.hash).slice(0, 12) + "…`)").join("\n") + "\n\n" : "") +
        "[the signed anecdote](anecdote.json)\n";
    }
  } else {
    files[caught.kind + ".txt"] = text;
    files["README.md"] = "# a " + caught.kind + "\n\n[the contents](" + caught.kind + ".txt)\n";
  }
  return async (path) => (path in files ? files[path] : null);
}

// The deliberate act. Writes the SEED — the exact signed transfer — into a pile under its own content id.
// Returns the sheet path. Nothing else in this module writes anything anywhere.
export async function slapDown(caught, pile, { author } = {}) {
  const path = "caught/" + hex(caught.id).slice(0, 16) + "." + caught.kind + ".json";
  await pile.strike([{ path, content: canonicalize(caught.seed) + "\n" }],
    { author, message: "caught: a " + caught.kind + " from " + (caught.by ? String(caught.by).slice(0, 19) : "an unsigned hand") });
  return path;
}
