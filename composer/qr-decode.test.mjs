// Unit: the bigger lens — QR decoding from clean matrices AND from pixels, with real Reed–Solomon error
// CORRECTION (the piece self-decode never had: it trusted the EC bytes; the lens spends them). Layers:
// (1) rsDecode corrects up to ⌊ec/2⌋ byte errors exactly and REFUSES beyond (honest, never garbage);
// (2) decodeMatrix reads every level L/M/Q/H and every mask our encoder emits, heals dented matrices,
//     and reads a FOREIGN encoder's output (a baked segno fixture — alphanumeric mode, which our encoder
//     never writes); (3) decodeImage locates + samples from raw pixels through scale/rotation/mirror/
//     noise/shear; (4) the gravel closes: droplet frames → QR → pixels → OUR lens → carrierSession →
//     a verified transfer. Run: node composer/qr-decode.test.mjs
import { encodeQR, rsEncode } from "./qr-encode.mjs";
import { rsDecode, decodeMatrix, decodeImage } from "./qr-decode.mjs";
import { generateIdentity } from "./sign.mjs";
import { packTransfer } from "./transfer.mjs";
import { fountainTransfer, carrierSession } from "./carrier.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const rnd = (s) => () => (s = (Math.imul(s, 48271) >>> 0)) / 4294967296;

// 1. Reed–Solomon: exact correction within capacity, honest refusal beyond.
{
  let good = 0, total = 0;
  for (const ec of [7, 16, 30]) for (let t = 0; t < 10; t++) {
    const r = rnd(ec * 100 + t + 1);
    const data = Array.from({ length: 30 }, () => (r() * 256) | 0);
    const word = [...data, ...rsEncode(data, ec)];
    const orig = word.slice();
    const nerr = 1 + ((r() * (ec >> 1)) | 0);
    const pos = new Set(); while (pos.size < nerr) pos.add((r() * word.length) | 0);
    for (const p of pos) word[p] ^= 1 + ((r() * 255) | 0);
    const res = rsDecode(word, ec);
    total++; if (res.ok && res.corrected === nerr && word.every((x, i) => x === orig[i])) good++;
  }
  ok(good === total, `rsDecode corrects exactly, ${good}/${total} randomized trials (ec 7/16/30)`);
  const r = rnd(99);
  const data = Array.from({ length: 30 }, () => (r() * 256) | 0);
  const word = [...data, ...rsEncode(data, 10)];
  const pos = new Set(); while (pos.size < 7) pos.add((r() * word.length) | 0);
  for (const p of pos) word[p] ^= 1 + ((r() * 255) | 0);
  ok(rsDecode(word, 10).ok === false, "beyond capacity → refuses (never hands back garbage)");
}

// 2. matrices: every level, forced masks, our whole frame vocabulary — and healed dents.
{
  let pass = 0, total = 0;
  const texts = ["HELLO", "https://anecdote.channel/poll.html?pile=p&tok=t", "AC1|d|-|sha256:ab|6|128|723|41|deadbeef|" + "QUJD".repeat(30)];
  for (const level of ["L", "M", "Q", "H"]) for (const text of texts) for (const mask of [null, 0, 5]) {
    const q = encodeQR(text, { ecLevel: level, mask });
    const r = decodeMatrix(q.modules);
    total++; if (r && r.text === text && r.ecLevel === level && r.mask === q.mask) pass++;
  }
  ok(pass === total, `decodeMatrix reads all four levels × masks, ${pass}/${total}`);

  let dp = 0, dt = 0;
  for (const level of ["M", "H"]) for (let t = 0; t < 5; t++) {
    const text = "the dent test payload, trial " + t;   // long enough for a version with room to dent
    const q = encodeQR(text, { ecLevel: level });
    const m = q.modules.map((row) => row.slice());
    const r0 = rnd(t * 31 + level.charCodeAt(0));
    const cells = new Set();
    while (cells.size < (level === "M" ? 8 : 14)) {      // DISTINCT cells — a double flip is no dent at all
      const rr = 9 + ((r0() * (q.size - 18)) | 0), cc = 9 + ((r0() * (q.size - 18)) | 0);
      cells.add(rr * q.size + cc);
    }
    for (const cell of cells) m[(cell / q.size) | 0][cell % q.size] ^= 1;
    const r = decodeMatrix(m);
    dt++; if (r && r.text === text && r.corrected > 0) dp++;
  }
  ok(dp === dt, `a dented matrix still speaks (RS pays for it), ${dp}/${dt}`);
}

// 3. a FOREIGN encoder's matrix: segno's alphanumeric-mode "HELLO WORLD 123" at level Q (baked fixture —
// our encoder never writes alnum, so this pins the mode-segment parser against the outside world).
{
  const rows = [
    "111111100010001111111",
    "100000100100001000001",
    "101110100101001011101",
    "101110101000101011101",
    "101110100010001011101",
    "100000101111001000001",
    "111111101010101111111",
    "000000001010100000000",
    "011000100111001101000",
    "111011000010011001011",
    "011001111001101010010",
    "010011011000101000100",
    "011101111111010011111",
    "000000001100100101111",
    "111111100000111000110",
    "100000100111001000011",
    "101110100010100010101",
    "101110100100011001000",
    "101110101101111000011",
    "100000101110000100001",
    "111111100101100001011",
  ];
  const m = rows.map((s) => s.split("").map(Number));
  const r = decodeMatrix(m);
  ok(r && r.text === "HELLO WORLD 123" && r.ecLevel === "Q", "a segno-made ALPHANUMERIC matrix decodes (foreign encoder, foreign mode)");
}

// 4. pixels: the rasterizer torture row — scale, rotation, mirror, noise, shear.
{
  function raster(modules, { scale = 4, quiet = 4, rot = 0, mirror = false, noise = 0, shear = 0, seed = 1 } = {}) {
    const n = modules.length, W0 = (n + 2 * quiet) * scale;
    let img = new Uint8Array(W0 * W0).fill(230), W = W0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (modules[r][c])
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) img[((r + quiet) * scale + dy) * W0 + (c + quiet) * scale + dx] = 25;
    for (let k = 0; k < rot / 90; k++) { const o = new Uint8Array(W * W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) o[x * W + (W - 1 - y)] = img[y * W + x]; img = o; }
    if (mirror) { const o = new Uint8Array(W * W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) o[y * W + (W - 1 - x)] = img[y * W + x]; img = o; }
    let width = W;
    if (shear) { const W2 = W + Math.ceil(shear * W); const o = new Uint8Array(W2 * W).fill(230); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const nx = x + Math.round(shear * y); if (nx < W2) o[y * W2 + nx] = img[y * W + x]; } img = o; width = W2; }
    if (noise) { let s = seed; const rr = () => (s = (Math.imul(s, 48271) >>> 0)) / 4294967296; for (let i = 0; i < img.length; i++) img[i] = Math.max(0, Math.min(255, img[i] + (rr() - 0.5) * 2 * noise)); }
    return { data: img, width, height: W };
  }
  const text = "HELLO GRAVEL";
  const q = encodeQR(text, { ecLevel: "M" });
  const cases = [
    ["scale 2", { scale: 2 }], ["scale 6", { scale: 6 }],
    ["rot 90", { rot: 90 }], ["rot 180", { rot: 180 }], ["rot 270", { rot: 270 }],
    ["mirrored", { mirror: true }], ["noise ±40", { noise: 40 }], ["shear 8%", { shear: 0.08 }],
  ];
  let pass = 0;
  for (const [label, opts] of cases) { const r = decodeImage(raster(q.modules, opts)); if (r && r.text === text) pass++; else console.error(`   pixel case failed: ${label}`); }
  ok(pass === cases.length, `decodeImage survives the torture row (${pass}/${cases.length}: scale/rot/mirror/noise/shear)`);
  const mir = decodeImage(raster(q.modules, { mirror: true }));
  ok(mir && mir.mirrored === true, "…and says so when the world was mirrored");

  // 5. THE GRAVEL CLOSES: droplets → QR → pixels → OUR lens → carrier → verified transfer, through dents.
  const me = await generateIdentity();
  const payload = "read by our own lens ".repeat(12);
  const signed = await packTransfer("data-pile", payload, me);
  const ft = await fountainTransfer(signed, { blockSize: 128 });
  const session = carrierSession({ friends: [me.fingerprint] });
  const lost = (s, pct) => ((Math.imul(s + 1, 2654435761) >>> 0) % 100) < pct;
  const dented = (s, pct) => ((Math.imul(s + 7, 40503) >>> 0) % 100) < pct;
  const dent = (f) => { const i = f.length - 3; const c = f[i] === "A" ? "B" : "A"; return f.slice(0, i) + c + f.slice(i + 1); };
  let snap = null, seed = 0, misses = 0;
  while ((!snap || !snap.complete) && seed < ft.K * 10 + 80) {
    const sd = seed++;
    if (lost(sd, 20)) continue;
    let frame = ft.frame(sd);
    if (dented(sd, 30)) frame = dent(frame);
    const read = decodeImage(raster(encodeQR(frame, { ecLevel: "M" }).modules, { scale: 3 }));
    if (!read) { misses++; continue; }
    snap = await session.feed(read.text);
  }
  ok(snap && snap.complete && misses === 0 && snap.damaged > 0,
     `the loop drinks through OUR lens: complete, 0 lens misses, dents healed (K=${ft.K}, ${seed} seeds, dents seen: ${snap ? snap.damaged : "?"})`);
  const r = await session.result();
  const rt = r.ok ? new TextDecoder().decode(Uint8Array.from(atob(r.transfers[0].signed.bytes), (c) => c.charCodeAt(0))) : "";
  ok(r.ok && r.transfers[0].verify.trusted && rt === payload, "…and the transfer verifies TRUSTED with the exact payload");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall qr-decode tests passed");
