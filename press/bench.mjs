// press/bench.mjs — THE WRITE GESTURE: say a thing once, with an object attached, and strike a sheet.
//
// AGENTS.md: Anecdote is "the unsolicited half — the same building gesture with no prefab answers, where a
// statement (text or an object) just stands." This composes that gesture out of what is already built and
// adds no mechanism of its own:
//
//   route.prepare      the statement reduces to its fewest-verbs label; it is routed, never blocked
//   anecdote.build     body[0] is the statement; the object rides as a REF — hash + provenance, a receipt
//   sign.sign          signed on this device
//   transfer.pack      wrapped as a signed transfer of kind "anecdote" — the thing a carrier pours (D17:
//                      "any file rides inside a bottle"; the kind is readable before the member decodes)
//
// The content id is the join key (invariant #7): defaultHash(canonicalize(signed)). It names the sheet in
// the pile, and it is what a reply or an edit mask would later point at.
//
// A struck sheet is TWO files: the signed anecdote, and — when there is an object — its bytes under their
// own hash. The anecdote cites the object; the pile is what holds it. That is docs/anecdote-schema.md's
// "anecdote cites and proves, it does not host", with the citing and the holding both done by the person.

import { prepare } from "../composer/route.mjs";
import { build, defaultHash } from "../composer/anecdote.mjs";
import { sign, canonicalize } from "../composer/sign.mjs";
import { packTransfer } from "../composer/transfer.mjs";

const te = new TextEncoder();
const hex = (h) => h.replace(/^sha256:/, "");

// object: { name, mediaType, bytes: Uint8Array|string, source? } | null
// about:  { source, bytes, mediaType? } | null — WHAT THE STATEMENT IS ABOUT: the thing that was on the stage
//         when it was said. It rides as a second ref, so the statement points at a VERSION of its subject by
//         content hash (D13: "the date labels the witness; the content-id joins"). Its bytes are hashed and
//         NEVER KEPT: it is somebody else's page, and the templates' rule is "aggregate by reference, never
//         by copy". The receipt proves what was witnessed; the subject stays where it lives.
export async function strike({ text, object = null, about = null, pile, identity, nonce } = {}) {
  if (!pile || !pile.id) throw new Error("bench: name the pile this prints into");
  if (!identity) throw new Error("bench: signing happens on this device — an identity is required");
  const dest = { id: pile.id, kind: "pile", url: pile.url };
  const routed = prepare(text, dest);                                  // routed, never blocked: a pile of your own excludes nothing
  const attachments = object ? [{
    mediaType: object.mediaType || "application/octet-stream",
    bytes: object.bytes,
    source: object.source || ("attached on this device: " + (object.name || "unnamed")),
    pile: pile.id,
    include: false,                                                    // the pile holds the bytes; the anecdote carries the receipt
  }] : [];
  if (about && about.source && about.bytes != null) {
    attachments.push({ mediaType: about.mediaType || "text/plain", bytes: about.bytes, source: about.source, include: false });
  }
  const anecdote = await build(routed, attachments);
  const signed = await sign(anecdote, identity, nonce ? { nonce } : {});
  const canonical = canonicalize(signed);
  const id = await defaultHash(te.encode(canonical));

  const sheets = [{ path: "anecdotes/" + hex(id).slice(0, 16) + ".json", content: canonical + "\n" }];
  if (object) {
    const ref = anecdote.body[1];
    sheets.push({ path: "objects/" + hex(ref.hash), content: typeof object.bytes === "string" ? te.encode(object.bytes) : object.bytes });
  }
  const transfer = await packTransfer("anecdote", canonical, identity);
  return { id, label: anecdote.label, anecdote, signed, sheets, transfer };
}

// The pile's own front page: an index.md that lists what was printed, newest first. It is written INTO the
// pile, so opening the pile through the face resolver shows it — a pile reads like any other bottle, and
// the ladder's first rung is what a printing press would naturally keep current.
export function frontPage(pileId, entries) {
  const lines = ["# " + pileId, "", entries.length + (entries.length === 1 ? " sheet" : " sheets") + " printed on this device.", ""];
  for (const e of entries) lines.push("- [" + (e.label || e.text || "untitled").replace(/[\[\]]/g, "") + "](" + e.path + ")" + (e.object ? " — with " + e.object : ""));
  return lines.join("\n") + "\n";
}
