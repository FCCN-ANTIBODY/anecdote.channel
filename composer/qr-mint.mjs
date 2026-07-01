// composer/qr-mint.mjs — the "project" face: mint a poll's QR from an anecdote.poll/v1 object (the mirror
// of tell.anecdote.channel's bin/qr). The offline origin, WHEN IT HOLDS the pile's QR secret (i.e. you run
// your own Tell), can derive the same authorization token bin/qr does and assemble a byte-identical QR — so
// anecdote is self-sufficient for the whole poll lifecycle: author → MINT → answer → host → tally, with the
// Tell minting nothing. (docs/system-viewer.md, the poll object's "project" face.)
//
// Token — tell-lib.sh tl_token, byte-for-byte:
//   k_pile = HMAC-SHA256(secret,  "qr:"+pile)                        -> lowercase hex (64 chars)
//   tok    = HMAC-SHA256(k_pile,  "tok:"+pile+":"+poll+":"+round)    -> hex
// The second HMAC keys on the hex STRING (not the raw digest) — openssl -hmac takes the key as a string, so
// we do too. The secret stays Elevated; a powerless data: chamber can REQUEST a mint but never sees it.
//
// Signature (sig/kid) is the orthogonal, optional provenance half — an SSHSIG/Ed25519 signature over the
// canonical preimage. bin/authz verifies it only-if-present, so a token-bearing QR is fully working WITHOUT
// it; producing the signature is the deferred slice (docs/qr-provenance.md, "raw-signature tooling"). We
// build the canonical preimage here (qrCanon) so signing can drop straight in later.

const te = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

// crypto.subtle is Elevated-only (a data: chamber's null origin has none) — same stance as git-enough SHA-1.
function subtle() {
  const s = globalThis.crypto && globalThis.crypto.subtle;
  if (!s) throw new Error("qr-mint: needs crypto.subtle (runs Elevated, never in a data: chamber)");
  return s;
}

// HMAC-SHA256(keyStr, msgStr) -> lowercase hex. keyStr is used as raw UTF-8 bytes (matches openssl -hmac).
export async function hmacHex(keyStr, msgStr) {
  const key = await subtle().importKey("raw", te.encode(keyStr), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await subtle().sign("HMAC", key, te.encode(msgStr)));
}

// The authorization token, byte-identical to tl_token. The intermediate per-pile key is a hex string and is
// used verbatim as the key for the second HMAC.
export async function mintToken(secret, pile, poll, round) {
  const kPile = await hmacHex(secret, "qr:" + pile);
  return hmacHex(kPile, `tok:${pile}:${poll}:${round}`);
}

// RFC 3986 unreserved-only percent-encoding, matching jq @uri (encodeURIComponent leaves !'()* alone, so we
// encode those too). Uppercase hex, space -> %20. This is how every value rides in the URL.
const enc = (s) => encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

// The canonical signing preimage (tl_qr_canon): drop sig/kid/post, then C-locale sort the whole "k=v"
// lines. JS default sort is code-unit order, which equals C-locale byte order for the ASCII we emit.
export function qrCanon(pairs) {
  return pairs.filter((p) => !/^(sig|kid|post)=/.test(p)).slice().sort().join("\n");
}

// Assemble the QR URL from an anecdote.poll/v1 object, byte-compatible with bin/qr. Param order matches
// bin/qr exactly: pile, poll, round, tok, type, mode, run, then canonical?, asker?, q?, opts?, guidance?,
// repo?, then sig?, kid? (appended after the signed preimage, exactly as bin/qr does). Pass `sign` =
// { identity, namespace? } (the device identity from sign.mjs) to add a provenance signature over the
// canonical preimage. Returns { url, tok, round, run, canon, pairs, sig?, kid? }.
export async function mintQR(poll, { secret, domain = "https://tell.anecdote.channel", repo, asker = "",
                                     mode = "issue", canonical = "", run, sign } = {}) {
  if (!secret) throw new Error("qr-mint: minting needs the pile's TELL_QR_SECRET (you run the Tell)");
  if (!poll || !poll.pile || !poll.poll) throw new Error("qr-mint: need a poll object with pile + poll");
  const round = String((poll.lifecycle && poll.lifecycle.round) ?? 1);
  const tok = await mintToken(secret, poll.pile, poll.poll, round);
  const runId = run || tok.slice(0, 12);       // default run tag: stable per (pile,poll,round), like bin/qr
  const pairs = [
    `pile=${enc(poll.pile)}`, `poll=${enc(poll.poll)}`, `round=${enc(round)}`, `tok=${tok}`,
    `type=${enc(poll.type || "open")}`, `mode=${enc(mode)}`, `run=${enc(runId)}`,
  ];
  if (canonical) pairs.push(`canonical=${enc(canonical)}`);
  if (asker) pairs.push(`asker=${enc(asker)}`);
  if (poll.text) pairs.push(`q=${enc(poll.text)}`);
  if (poll.options && poll.options.length) pairs.push(`opts=${enc(poll.options.join(","))}`);
  if (poll.guidance) pairs.push(`guidance=${enc(poll.guidance)}`);
  if (repo) pairs.push(`repo=${enc(repo)}`);
  const canon = qrCanon(pairs);                // the preimage — over the base pairs, before sig/kid
  const out = { tok, round, run: runId, canon };
  if (sign && sign.identity) {
    const { signCanon } = await import("./qr-sign.mjs");
    const s = await signCanon(canon, sign.identity, { namespace: sign.namespace });
    pairs.push(`sig=${enc(s.sig)}`, `kid=${enc(s.kid)}`);   // appended after the preimage, like bin/qr
    out.sig = s.sig; out.kid = s.kid;
  }
  out.pairs = pairs;
  out.url = `${domain}/?${pairs.join("&")}`;
  return out;
}

// Mint as a probe-line capability. Rung 1 (one confirm per mint — a QR is a shareable authorization). The
// SECRET is held here, Elevated; the chamber hands only the poll object + routing and gets back the URL, so
// the secret never crosses the probe line into the powerless chamber.
export function qrMintOps({ secret, domain, repo, identity, namespace } = {}) {
  if (!secret) throw new Error("qr-mint ops: need the pile's QR secret (Elevated-held)");
  const sign = identity ? { identity, namespace } : undefined;   // sign QRs with the device key if given
  return {
    "poll.mint": async (input, api) => {
      const r = await mintQR((input && input.poll) || {}, { secret, domain, repo, sign,
        asker: input && input.asker, mode: input && input.mode, canonical: input && input.canonical, run: input && input.run });
      api.emit({ url: r.url, tok: r.tok, round: r.round, run: r.run, kid: r.kid || null });
    },
  };
}
