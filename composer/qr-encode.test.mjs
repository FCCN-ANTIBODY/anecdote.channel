// Unit: qr-enough byte-mode encoder. The output is verified scannable against real decoders (zbar) and a
// reference encoder (segno) out of band; these in-repo guards keep it honest without a camera: (1) the
// block-table INVARIANT (data + ec == the version's total — catches typo-prone ECC tables); (2) a SELF-DECODE
// round-trip through inverse placement + unmask + de-interleave (the DATA path); (3) an RS SYNDROME check
// (the EC path — self-decode trusts EC, so only this catches a bad generator/divisor, which a scanner would
// reject as "data irrecoverable"); (4) computed BCH/GF, no hand-typed magic. Run: node composer/qr-encode.test.mjs
import { encodeQR, decodeSelf, dataCodewords, chooseVersion, rsEncode, _gf } from "./qr-encode.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const TOTAL_CW = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085, 1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185, 2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706];

// 1. block-table invariant: data + ec == total codewords, for every version/level.
{
  let allOk = true;
  for (const level of ["L", "M"]) for (let v = 1; v <= 40; v++) {
    const { data, ec, blocks } = dataCodewords(v, level);
    if (data + blocks * ec !== TOTAL_CW[v]) { allOk = false; console.error(`   bad table ${level} v${v}: ${data}+${blocks}*${ec} != ${TOTAL_CW[v]}`); }
  }
  ok(allOk, "block tables satisfy data + ec == total codewords for all v1–40, L & M");
}

// 2. structural: size, finder patterns at three corners, quiet ring inside finder.
{
  const q = encodeQR("HELLO", { ecLevel: "M" });
  ok(q.size === 17 + 4 * q.version, "size = 17 + 4·version");
  const m = q.modules, s = q.size;
  const finderAt = (r, c) => m[r][c] && m[r][c + 6] && m[r + 6][c] && m[r + 6][c + 6] && m[r + 2][c + 2] && !m[r + 1][c + 1];
  ok(finderAt(0, 0) && finderAt(0, s - 7) && finderAt(s - 7, 0), "finder patterns present at all three corners");
}

// 3. SELF-DECODE round-trip across sizes + both ECC levels.
{
  const cases = [
    "hi",
    "https://anecdote.channel/poll.html?pile=cd04-q1&poll=budget&round=1&tok=abc123def456&type=multichoice&opts=Cut,Keep&q=Cut%20or%20keep%3F",
    "x".repeat(200),
    "z".repeat(800),   // ~ a real signed poll URL (sig + kid pushes it into the mid-teens versions)
  ];
  let allRound = true;
  for (const level of ["L", "M"]) for (const text of cases) {
    const q = encodeQR(text, { ecLevel: level });
    const back = decodeSelf(q.modules, q.version, q.ecLevel, q.mask);
    if (back !== text) { allRound = false; console.error(`   round-trip FAIL (${level}, v${q.version}): got ${back.slice(0, 40)}…`); }
  }
  ok(allRound, "self-decode round-trips every case at L and M (data path correct)");

  const url = cases[1];
  const q = encodeQR(url, { ecLevel: "M" });
  console.log(`     poll URL (${url.length} B) → version ${q.version}, ${q.size}×${q.size}, mask ${q.mask}`);
  ok(decodeSelf(q.modules, q.version, q.ecLevel, q.mask) === url, "the real poll URL round-trips");
}

// 3b. Reed–Solomon syndrome check: [data ‖ rsEncode(data)] must be a valid codeword — every syndrome
// (the codeword evaluated at α^0 … α^(ec-1)) is zero. Self-decode can't catch a bad generator because it
// trusts the EC bytes; a real scanner runs RS and rejects a nonzero syndrome ("data irrecoverable"). This
// guard is what actually pins the EC path.
{
  const { EXP, gfMul } = _gf;
  const evalAt = (cw, a) => cw.reduce((r, c) => gfMul(r, a) ^ c, 0);   // Horner, MSB-first
  let allZero = true;
  for (const ec of [7, 10, 15, 22, 26]) {
    const data = Array.from({ length: 20 }, (_, i) => (i * 31 + 5) & 0xff);
    const word = [...data, ...rsEncode(data, ec)];
    for (let j = 0; j < ec; j++) if (evalAt(word, EXP[j]) !== 0) { allZero = false; console.error(`   nonzero syndrome S${j} for ec=${ec}`); }
  }
  ok(allZero, "RS codewords have zero syndromes at α^0…α^(ec-1) (generator/divisor ordering correct)");
}

// 4. version selection + capacity ceiling.
{
  ok(chooseVersion(10, "M") === 1, "10 bytes fits version 1");
  ok(chooseVersion(200, "M") <= 10 && chooseVersion(200, "M") >= 8, "200 bytes picks a mid version");
  ok(chooseVersion(800, "M") >= 18 && chooseVersion(800, "M") <= 25, "800 bytes (a signed poll URL) picks a mid version");
  let threw = false; try { chooseVersion(4000, "M"); } catch { threw = true; }
  ok(threw, "beyond version-40 capacity throws (use a shorter URL / chunked carrier)");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall qr-encode tests passed");
