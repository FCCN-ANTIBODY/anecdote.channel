// Tests for the anecdote/v1 payload core. Dependency-free, deterministic.
//   node composer/anecdote.test.mjs
import { prepare } from "./route.mjs";
import { SCHEMA, build, reference, validate, verify, defaultHash } from "./anecdote.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const cache = {
  tells: [{ id: "neighbors", kind: "tell", url: "https://nbhd.example", excludes: ["harassment"] }],
  atlases: [{ id: "foco", kind: "atlas", scope: "fort-collins", excludes: ["sale"] }],
};

// 1. A plain text statement: route.prepare → anecdote.build. body[0] is the verbatim statement,
//    reduced label rides along, and it validates.
{
  const routed = prepare("The park needs more shade", cache.atlases[0], cache);
  const a = await build(routed);
  ok(a.schema === SCHEMA, "carries schema anecdote/v1");
  ok(a.to.id === "foco" && a.to.kind === "atlas", "keeps route.prepare's destination");
  ok(a.body.length === 1 && a.body[0].kind === "text", "body[0] is the text statement");
  ok(a.body[0].text === "The park needs more shade", "statement text is verbatim, never rewritten");
  ok(a.body[0].label === routed.label && a.body[0].label !== "", "the reduced label rides along on the text part");
  ok(validate(a).ok, "a text-only anecdote validates");
}

// 2. The boundary case made general: a GeoJSON attachment is a REFERENCE (receipt), not a hosted
//    file. Receipt-only by default — bytes live in your references pile.
{
  const geo = JSON.stringify({ type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] });
  const routed = prepare("This is the neighborhood I mean", cache.tells[0], cache);
  const a = await build(routed, [
    { mediaType: "application/geo+json", bytes: geo, source: "drawn by me", pile: "refs://mine" },
  ]);
  const ref = a.body[1];
  ok(ref.kind === "ref", "an attachment becomes a reference part");
  ok(/^sha256:[0-9a-f]{64}$/.test(ref.hash), "the reference carries a content hash (the 'you have it' proof)");
  ok(ref.source === "drawn by me", "the reference carries provenance ('came from here')");
  ok(ref.pile === "refs://mine", "the reference points at your local references pile");
  ok(ref.bytes === undefined, "receipt-only by default: the bytes are NOT hosted in the anecdote");
  ok(ref.receipt && ref.receipt.hash === ref.hash && ref.receipt.source === ref.source,
    "the receipt binds the bytes (hash) to their origin (source) — the thing a signer signs");
  ok(validate(a).ok, "an anecdote with a receipt-only reference validates");
}

// 3. "Optionally include": carrying an inline copy still produces a receipt, and verify() confirms
//    the carried bytes hash to what the receipt promises.
{
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]); // not a real PNG; bytes are bytes
  const routed = prepare("Pothole on Mountain Ave", cache.tells[0], cache);
  const a = await build(routed, [
    { mediaType: "image/png", bytes: png, source: "camera", include: true },
  ]);
  ok(a.body[1].bytes !== undefined, "include:true carries an inline copy alongside the receipt");
  const v = await verify(a);
  ok(v.ok && v.checked === 1, "verify() recomputes the inline copy's hash and it matches the receipt");

  // tamper with the inline bytes → verify must fail while the receipt is unchanged
  const tampered = JSON.parse(JSON.stringify(a));
  tampered.body[1].bytes = Buffer.from([9, 9, 9, 9]).toString("base64");
  const v2 = await verify(tampered);
  ok(!v2.ok && v2.checked === 1, "verify() catches inline bytes that don't match the receipt");
}

// 4. INLINE_MAX: a large attachment that asked to be included drops the inline copy but KEEPS the
//    receipt — the bytes stay in the pile, the anecdote never bloats into a file host.
{
  const big = new Uint8Array(200 * 1024); // > INLINE_MAX (64 KiB)
  const part = await reference(
    { mediaType: "application/octet-stream", bytes: big, source: "scanner", pile: "refs://mine", include: true },
    { inlineMax: 64 * 1024 },
  );
  ok(part.bytes === undefined, "an over-size attachment carries no inline copy");
  ok(part.dropped_inline && part.dropped_inline.bytes_len === 200 * 1024, "and says why it dropped the inline copy");
  ok(part.receipt.hash === part.hash, "but the receipt (hash + source) still travels");
}

// 5. validate() rejects malformed anecdotes the platform might receive.
{
  ok(!validate({}).ok, "empty object is rejected");
  ok(!validate({ schema: "anecdote/v1", to: { id: "x", kind: "atlas" }, label: "", body: [] }).ok,
    "empty body is rejected");
  const noStatement = { schema: SCHEMA, to: { id: "x", kind: "atlas" }, label: "", body: [{ kind: "ref", mediaType: "image/png", hash: "sha256:" + "0".repeat(64), source: "x", receipt: { hash: "sha256:" + "0".repeat(64), source: "x" } }] };
  ok(!validate(noStatement).ok, "an anecdote whose first part isn't the statement is rejected");
  const badReceipt = { schema: SCHEMA, to: { id: "x", kind: "atlas" }, label: "", body: [
    { kind: "text", text: "hi" },
    { kind: "ref", mediaType: "image/png", hash: "sha256:" + "a".repeat(64), source: "here", receipt: { hash: "sha256:" + "b".repeat(64), source: "here" } },
  ] };
  ok(!validate(badReceipt).ok, "a receipt that doesn't cover its part's hash is rejected");
}

// 6. The hash seam is real SHA-256 and stable across calls (same bytes → same digest).
{
  const h1 = await defaultHash("identical");
  const h2 = await defaultHash("identical");
  ok(h1 === h2 && /^sha256:[0-9a-f]{64}$/.test(h1), "defaultHash is deterministic sha256");
  ok((await defaultHash("a")) !== (await defaultHash("b")), "distinct bytes hash distinctly");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
