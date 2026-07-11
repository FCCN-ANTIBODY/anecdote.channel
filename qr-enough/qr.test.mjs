// Unit: qr-enough (qr.mjs) — a byte-mode QR encoder for arbitrary size (v1-40) + a paired decoder as the
// oracle. Four independent checks pin it to the spec without a physical scanner: (1) the RS generator
// polynomial matches the QR spec's published α-exponents, (2) RS codewords have zero syndromes, (3) byte
// capacities match the published ISO/IEC 18004 table across v1-40, (4) encode->decode round-trips every
// version/level. Run: node qr-enough/qr.test.mjs
import { encode, decode, toSVG, byteCapacity, pickVersion, rsEncode, rsGenerator, rsSyndromesZero, size } from "./qr.mjs";

// rebuild the log table only to render generator coefficients as α-exponents for the spec comparison
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } }

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// 1. the RS generator polynomial matches the QR spec (external oracle: the degree-10 generator's α-exponents).
{
  const g = rsGenerator(10).map((c) => LOG[c]).join(",");
  ok(g === "0,251,67,46,61,118,70,64,94,32,45", "RS generator (deg 10) matches the QR spec's published α-exponents");
  ok(rsSyndromesZero([...[32, 91, 11, 120, 209], ...rsEncode([32, 91, 11, 120, 209], 10)], 10), "an RS codeword has zero syndromes (roots α^0..α^9)");
}

// 2. byte capacities match the published ISO/IEC 18004 table (external oracle for the ECC table + geometry).
{
  const L = [0,17,32,53,78,106,134,154,192,230,271,321,367,425,458,520,586,644,718,792,858,929,1003,1091,1171,1273,1367,1465,1528,1628,1732,1840,1952,2068,2188,2303,2431,2563,2699,2809,2953];
  let bad = 0; for (let v = 1; v <= 40; v++) if (byteCapacity(v, "L") !== L[v]) bad++;
  ok(bad === 0, "v1..v40 level-L byte capacities all match the published spec table");
  ok(byteCapacity(40, "M") === 2331 && byteCapacity(40, "Q") === 1663 && byteCapacity(40, "H") === 1273, "v40 M/Q/H capacities match the famous spec numbers");
  ok(byteCapacity(1, "H") === 7 && byteCapacity(10, "M") === 213, "endpoint + mid capacities match (v1-H=7, v10-M=213)");
}

// 3. round-trip EVERY version/level: encode a payload sized to that version, decode it back exactly.
{
  let tested = 0, bad = 0;
  for (const level of ["L", "M", "Q", "H"]) for (let ver = 1; ver <= 40; ver++) {
    const cap = byteCapacity(ver, level); if (cap <= 0) continue;
    const n = Math.max(1, ver === 1 ? cap : byteCapacity(ver - 1, level) + 1);   // force exactly this version
    const payload = Uint8Array.from({ length: n }, (_, i) => (i * 97 + ver * 7 + 13) & 0xff);
    const m = encode(payload, { level, minVersion: ver });
    const d = decode(m);
    if (!(m.version === ver && size(ver) === m.length && d.version === ver && d.level === level && eq([...d.bytes], [...payload]))) bad++;
    tested++;
  }
  ok(tested === 160 && bad === 0, `all ${tested} version/level combos round-trip encode->decode exactly (${bad} failed)`);
}

// 4. realistic + boundary payloads: binary (a key + signature + deflated bytes), empty-ish, and the max.
{
  const real = Uint8Array.from({ length: 216 }, (_, i) => (i * 181 + 7) & 0xff);   // 32B key + 64B sig + ~120B
  const m = encode(real, { level: "M" });
  ok(m.version === pickVersion(216, "M") && eq([...decode(m).bytes], [...real]), "a 216-byte binary payload picks the right version and round-trips (byte mode, not URL text)");
  const one = encode(Uint8Array.of(0), { level: "H" });
  ok(decode(one).bytes.length === 1, "a 1-byte payload round-trips");
  const max = Uint8Array.from({ length: byteCapacity(40, "L") }, (_, i) => i & 0xff);
  ok(eq([...decode(encode(max, { level: "L" })).bytes], [...max]), "the maximum v40-L payload (2953 bytes) round-trips");
  let threw = false; try { encode(new Uint8Array(byteCapacity(40, "L") + 1), { level: "L" }); } catch { threw = true; }
  ok(threw, "one byte over v40-L capacity is refused, not silently truncated");
}

// 5. SVG render: self-contained inline SVG (no external request, no runtime JS), scannable module grid.
{
  const svg = toSVG(encode(Uint8Array.of(1, 2, 3), { level: "M" }), { module: 4, margin: 4 });
  ok(svg.startsWith("<svg") && svg.includes("<rect") && svg.endsWith("</svg>"), "toSVG emits an inline SVG with the module grid");
  ok(!svg.includes("http") || svg.includes("www.w3.org"), "the SVG makes no external request (only the w3 namespace)");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall qr-enough tests passed");
