// Unit: ChaCha20-Poly1305 (chacha20poly1305.mjs) against the RFC 8439 published test vectors — the
// primitive the age battery rides on, so it is pinned to the spec's own numbers before age-seal trusts
// it. Run: node composer/chacha20poly1305.test.mjs
import { seal, open, chacha20, poly1305, block } from "./chacha20poly1305.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s) => Uint8Array.from(s.match(/../g).map((h) => parseInt(h, 16)));

// RFC 8439 §2.4.2 — ChaCha20 encryption of the "Ladies and Gentlemen…" plaintext.
{
  const key = unhex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
  const nonce = unhex("000000000000004a00000000");
  const pt = new TextEncoder().encode("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.");
  const ct = chacha20(key, 1, nonce, pt);
  ok(hex(ct.subarray(0, 16)) === "6e2e359a2568f98041ba0728dd0d6981", "ChaCha20 keystream matches RFC 8439 §2.4.2");
}

// RFC 8439 §2.5.2 — Poly1305 MAC of "Cryptographic Forum Research Group".
{
  const key = unhex("85d6be7857556d337f4452fe42d506a80103808afb0db2fd4abff6af4149f51b");
  const msg = new TextEncoder().encode("Cryptographic Forum Research Group");
  ok(hex(poly1305(msg, key)) === "a8061dc1305136c6c22b8baf0c0127a9", "Poly1305 tag matches RFC 8439 §2.5.2");
}

// RFC 8439 §2.8.2 — the AEAD worked example: known key/nonce/aad/plaintext → known ct + tag.
{
  const key = unhex("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f");
  const nonce = unhex("070000004041424344454647");
  const aad = unhex("50515253c0c1c2c3c4c5c6c7");
  const pt = new TextEncoder().encode("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.");
  const sealed = seal(key, nonce, pt, aad);
  const ct = sealed.subarray(0, sealed.length - 16), tag = sealed.subarray(sealed.length - 16);
  ok(hex(ct).startsWith("d31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d6"), "AEAD ciphertext matches RFC 8439 §2.8.2");
  ok(hex(tag) === "1ae10b594f09e26a7e902ecbd0600691", "AEAD tag matches RFC 8439 §2.8.2");
}

// round-trip + tamper detection at a few sizes (incl. empty and >64B multi-block).
{
  const key = unhex("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff");
  const nonce = unhex("000000000000000000000001");
  for (const len of [0, 1, 16, 63, 64, 65, 200]) {
    const pt = Uint8Array.from({ length: len }, (_, i) => (i * 7 + 3) & 0xff);
    const sealed = seal(key, nonce, pt);
    const back = open(key, nonce, sealed);
    ok(back && hex(back) === hex(pt), `seal→open round-trips ${len} bytes`);
  }
  const sealed = seal(key, nonce, new TextEncoder().encode("secret"));
  const bad = Uint8Array.from(sealed); bad[0] ^= 1;
  ok(open(key, nonce, bad) === null, "a flipped ciphertext byte fails the tag (open returns null)");
  const badTag = Uint8Array.from(sealed); badTag[badTag.length - 1] ^= 1;
  ok(open(key, nonce, badTag) === null, "a flipped tag byte fails authentication");
}

// counter-0 block feeds the one-time Poly1305 key (sanity that block() is wired as the AEAD expects).
{
  const key = unhex("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f");
  const nonce = unhex("070000004041424344454647");
  ok(hex(block(key, 0, nonce).subarray(0, 8)) === "7bac2b252db447af", "counter-0 block matches RFC 8439 §2.8.2 one-time-key derivation");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall chacha20poly1305 tests passed");
