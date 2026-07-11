// qr-enough — a byte-mode QR encoder for ARBITRARY size (versions 1-40), plus a paired decoder as the
// oracle. Byte mode only (we carry deflated bytes / keys / signed tokens, not URL text). Geometry is a
// FORMULA, not a table, so "any size" is the same code; the only transcribed data is the two ECC arrays.

// ---- GF(256) for Reed-Solomon (x^8 + x^4 + x^3 + x^2 + 1 = 0x11d) -----------------------------------
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

function rsGenerator(degree) {           // monic, HIGHEST degree first: g[0]=x^degree coef=1
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const ng = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= gmul(g[j], EXP[i]); }
    g = ng;
  }
  return g;
}
function rsEncode(data, ecLen) {          // remainder of data·x^ecLen mod gen, via synthetic division
  const gen = rsGenerator(ecLen), buf = [...data, ...new Array(ecLen).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = buf[i];
    if (coef !== 0) for (let j = 0; j < gen.length; j++) buf[i + j] ^= gmul(gen[j], coef);
  }
  return buf.slice(data.length);
}
// RS syndrome self-check: a valid codeword evaluates to 0 at α^0..α^(ecLen-1) (proves rsEncode is right).
function rsSyndromesZero(codewords, ecLen) {
  for (let s = 0; s < ecLen; s++) {
    let acc = 0; for (const c of codewords) acc = gmul(acc, EXP[s]) ^ c;
    if (acc !== 0) return false;
  }
  return true;
}

// ---- geometry (formulas, not tables) ---------------------------------------------------------------
const size = (ver) => ver * 4 + 17;
function rawDataModules(ver) {                 // # of data+ec modules (Nayuki's formula)
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) { const n = Math.floor(ver / 7) + 2; r -= (25 * n - 10) * n - 55; if (ver >= 7) r -= 36; }
  return r;
}
const totalCodewords = (ver) => Math.floor(rawDataModules(ver) / 8);
function alignPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const res = [6];
  for (let pos = size(ver) - 7; res.length < n; pos -= step) res.splice(1, 0, pos);
  return res;
}

// ---- the two transcribed ECC arrays (per level L,M,Q,H; index by version) ---------------------------
const LEVELS = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_PER_BLOCK = [
  [0, 7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [0,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
  [0,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [0,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
];
const NUM_BLOCKS = [
  [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
  [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
  [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
  [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81],
];
const dataCapacity = (ver, lvl) => totalCodewords(ver) - ECC_PER_BLOCK[LEVELS[lvl]][ver] * NUM_BLOCKS[LEVELS[lvl]][ver];
// byte-mode payload capacity in bytes: data codewords minus mode(4b)+count(8 or 16b) header, floored.
const byteCapacity = (ver, lvl) => dataCapacity(ver, lvl) - 2 - (ver >= 10 ? 1 : 0);

// pick the smallest version (>= minVersion) whose byte capacity fits n bytes at level lvl.
function pickVersion(n, lvl, minVersion = 1) {
  for (let v = Math.max(1, minVersion); v <= 40; v++) if (byteCapacity(v, lvl) >= n) return v;
  throw new Error(`qr: ${n} bytes exceeds byte-mode capacity of version 40-${lvl} (${byteCapacity(40, lvl)})`);
}

// ---- bitstream -------------------------------------------------------------------------------------
class Bits { constructor() { this.a = []; } push(val, len) { for (let i = len - 1; i >= 0; i--) this.a.push((val >>> i) & 1); } get length() { return this.a.length; } }
function toDataCodewords(bytes, ver, lvl) {
  const bits = new Bits();
  bits.push(0b0100, 4);                          // byte mode
  bits.push(bytes.length, ver >= 10 ? 16 : 8);   // char count
  for (const b of bytes) bits.push(b, 8);
  const cap = dataCapacity(ver, lvl) * 8;
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.a.push(0);   // terminator
  while (bits.length % 8 !== 0) bits.a.push(0);                       // byte-align
  const cw = [];
  for (let i = 0; i < bits.a.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits.a[i + j]; cw.push(v); }
  const pads = [0xec, 0x11];
  for (let i = 0; cw.length < dataCapacity(ver, lvl); i++) cw.push(pads[i % 2]);
  return cw;
}
// split into blocks, RS-encode each, then interleave (data cols, then ec cols) — the QR codeword stream.
function interleave(dataCw, ver, lvl) {
  const nb = NUM_BLOCKS[LEVELS[lvl]][ver], ecLen = ECC_PER_BLOCK[LEVELS[lvl]][ver], total = dataCw.length;
  const short = Math.floor(total / nb), numLong = total % nb;
  const blocks = []; let off = 0;
  for (let i = 0; i < nb; i++) { const len = short + (i >= nb - numLong ? 1 : 0); const d = dataCw.slice(off, off + len); off += len; blocks.push({ d, e: rsEncode(d, ecLen) }); }
  const out = [];
  const maxD = Math.max(...blocks.map((b) => b.d.length));
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.e[i]);
  return { stream: out, blocks, ecLen };
}

// ---- matrix build ----------------------------------------------------------------------------------
const FINDER = [[1,1,1,1,1,1,1],[1,0,0,0,0,0,1],[1,0,1,1,1,0,1],[1,0,1,1,1,0,1],[1,0,1,1,1,0,1],[1,0,0,0,0,0,1],[1,1,1,1,1,1,1]];
function newMatrix(ver) {
  const n = size(ver);
  const m = Array.from({ length: n }, () => new Array(n).fill(null));    // null = free (data), else 0/1 function
  const set = (r, c, v) => { if (r >= 0 && c >= 0 && r < n && c < n) m[r][c] = v; };
  const placeFinder = (r, c) => { for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) { const rr = r + i, cc = c + j; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue; m[rr][cc] = (i >= 0 && i < 7 && j >= 0 && j < 7) ? FINDER[i][j] : 0; } };
  placeFinder(0, 0); placeFinder(0, n - 7); placeFinder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { const b = (i % 2 === 0) ? 1 : 0; set(6, i, b); set(i, 6, b); }   // timing
  for (const r of alignPositions(ver)) for (const c of alignPositions(ver)) {                          // alignment
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 8) || (r >= n - 8 && c <= 8)) continue;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) set(r + i, c + j, (Math.max(Math.abs(i), Math.abs(j)) !== 1) ? 1 : 0);
  }
  set(n - 8, 8, 1);                                                     // dark module
  // reserve format (0s placeholder) so data placement skips them
  for (let i = 0; i <= 8; i++) { if (m[8][i] === null) m[8][i] = 0; if (m[i][8] === null) m[i][8] = 0; }
  for (let i = 0; i < 8; i++) { if (m[8][n - 1 - i] === null) m[8][n - 1 - i] = 0; if (m[n - 1 - i][8] === null) m[n - 1 - i][8] = 0; }
  if (ver >= 7) for (let i = 0; i < 18; i++) { const r = Math.floor(i / 3), c = i % 3; if (m[r][n - 11 + c] === null) m[r][n - 11 + c] = 0; if (m[n - 11 + c][r] === null) m[n - 11 + c][r] = 0; }
  return m;
}
// free-cell mask so decoder + placement agree on which modules carry data
function freeMask(ver) {
  const n = size(ver), m = newMatrix(ver), f = Array.from({ length: n }, () => new Array(n).fill(true));
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c] !== null) f[r][c] = false;
  return f;
}
function dataCells(ver) {                 // the zigzag order of free data modules
  const n = size(ver), free = freeMask(ver), cells = [];
  let upward = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;               // skip the timing column
    for (let k = 0; k < n; k++) {
      const row = upward ? n - 1 - k : k;
      for (const c of [col, col - 1]) if (free[row][c]) cells.push([row, c]);
    }
    upward = !upward;
  }
  return cells;
}

// ---- masking + format/version info -----------------------------------------------------------------
const MASKS = [
  (r, c) => (r + c) % 2 === 0, (r, c) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0, (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
];
function bch(data, gen, glen) { let d = data << (glen - 1); while ((Math.clz32(d) ^ 31) >= glen - 1 + (Math.clz32(d) ^ 31 >= 0 ? 0 : 0)) break; // placeholder
  return data; }
function formatBits(lvl, mask) {
  const lb = { L: 1, M: 0, Q: 3, H: 2 }[lvl];
  let data = (lb << 3) | mask, rem = data << 10;
  for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0b10100110111 << (i - 10);
  return ((data << 10) | rem) ^ 0b101010000010010;
}
function versionBits(ver) {
  let rem = ver << 12;
  for (let i = 17; i >= 12; i--) if ((rem >> i) & 1) rem ^= 0b1111100100101 << (i - 12);
  return (ver << 12) | rem;
}
function placeFormat(m, ver, lvl, mask) {
  const n = size(ver), bits = formatBits(lvl, mask);
  for (let i = 0; i < 15; i++) {
    const b = (bits >> i) & 1;
    // around top-left
    if (i < 6) m[8][i] = b; else if (i < 8) m[8][i + 1] = b; else if (i === 8) m[7][8] = b; else m[14 - i][8] = b;
    // around the other two corners
    if (i < 8) m[n - 1 - i][8] = b; else m[8][n - 15 + i] = b;
  }
  if (ver >= 7) { const vb = versionBits(ver); for (let i = 0; i < 18; i++) { const b = (vb >> i) & 1; const r = Math.floor(i / 3), c = i % 3; m[r][n - 11 + c] = b; m[n - 11 + c][r] = b; } }
}

// ---- penalty (pick the best mask) ------------------------------------------------------------------
function penalty(m) {
  const n = m.length; let p = 0;
  for (const line of [...m, ...m[0].map((_, c) => m.map((r) => r[c]))]) {
    let run = 1; for (let i = 1; i < n; i++) { if (line[i] === line[i - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r + 1][c] && m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c + 1]) p += 3;
  const pat = [1,0,1,1,1,0,1];
  const hasPat = (line, i) => pat.every((v, k) => line[i + k] === v);
  for (const line of [...m, ...m[0].map((_, c) => m.map((r) => r[c]))]) for (let i = 0; i + 11 <= n; i++) {
    if (hasPat(line, i) && line.slice(i + 7, i + 11).every((v) => v === 0)) p += 40;
    if (line.slice(i, i + 4).every((v) => v === 0) && hasPat(line, i + 4)) p += 40;
  }
  let dark = 0; for (const row of m) for (const v of row) dark += v; const pct = dark * 100 / (n * n);
  p += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return p;
}

// ---- encode ----------------------------------------------------------------------------------------
export function encode(bytes, { level = "M", minVersion = 1 } = {}) {
  bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const ver = pickVersion(bytes.length, level, minVersion);
  const dataCw = toDataCodewords([...bytes], ver, level);
  const { stream } = interleave(dataCw, ver, level);
  const cells = dataCells(ver), n = size(ver);
  const base = newMatrix(ver);
  // lay the codeword bitstream into the zigzag cells
  const bitAt = (idx) => (stream[idx >> 3] >> (7 - (idx & 7))) & 1;
  for (let i = 0; i < cells.length; i++) { const [r, c] = cells[i]; base[r][c] = i < stream.length * 8 ? bitAt(i) : 0; }
  // try all masks, keep the lowest penalty
  let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = base.map((row) => row.slice());
    for (const [r, c] of cells) if (MASKS[mask](r, c)) m[r][c] ^= 1;
    placeFormat(m, ver, level, mask);
    const p = penalty(m);
    if (p < bestP) { bestP = p; best = m; best.mask = mask; }
  }
  best.version = ver; best.level = level;
  return best;      // matrix of 0/1
}

// ---- decode (the oracle: read our own matrix back to bytes) ----------------------------------------
export function decode(m) {
  const n = m.length, ver = (n - 17) / 4;
  // read format info (top-left copy) to recover level + mask
  let fmt = 0;
  for (let i = 0; i < 15; i++) { let b; if (i < 6) b = m[8][i]; else if (i < 8) b = m[8][i + 1]; else if (i === 8) b = m[7][8]; else b = m[14 - i][8]; fmt = (fmt << 1) | b; }
  // (bits were read MSB..LSB above is reversed; recompute LSB-first to match encoder)
  fmt = 0; for (let i = 14; i >= 0; i--) { let b; if (i < 6) b = m[8][i]; else if (i < 8) b = m[8][i + 1]; else if (i === 8) b = m[7][8]; else b = m[14 - i][8]; fmt = (fmt << 1) | b; }
  fmt ^= 0b101010000010010;
  const data = fmt >> 10, mask = data & 7, lb = data >> 3;
  const level = { 1: "L", 0: "M", 3: "Q", 2: "H" }[lb];
  const cells = dataCells(ver);
  // unmask + read the codeword bits in zigzag order
  const bits = [];
  for (const [r, c] of cells) bits.push(m[r][c] ^ (MASKS[mask](r, c) ? 1 : 0));
  const cw = []; for (let i = 0; i + 8 <= bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; cw.push(v); }
  // de-interleave back into blocks, strip EC
  const nb = NUM_BLOCKS[LEVELS[level]][ver], ecLen = ECC_PER_BLOCK[LEVELS[level]][ver];
  const totalData = dataCapacity(ver, level), short = Math.floor(totalData / nb), numLong = totalData % nb;
  const blkLens = Array.from({ length: nb }, (_, i) => short + (i >= nb - numLong ? 1 : 0));
  const dataBlocks = blkLens.map((l) => new Array(l));
  let idx = 0; const maxD = Math.max(...blkLens);
  for (let i = 0; i < maxD; i++) for (let b = 0; b < nb; b++) if (i < blkLens[b]) dataBlocks[b][i] = cw[idx++];
  const dataCw = [].concat(...dataBlocks);
  // read the byte-mode header + payload
  const rbits = []; for (const d of dataCw) for (let j = 7; j >= 0; j--) rbits.push((d >> j) & 1);
  let p = 0; const take = (k) => { let v = 0; for (let i = 0; i < k; i++) v = (v << 1) | rbits[p++]; return v; };
  const mode = take(4); if (mode !== 0b0100) throw new Error("decode: not byte mode (" + mode + ")");
  const len = take(ver >= 10 ? 16 : 8);
  const out = new Uint8Array(len); for (let i = 0; i < len; i++) out[i] = take(8);
  return { bytes: out, version: ver, level, mask };
}

export { totalCodewords, byteCapacity, pickVersion, rsEncode, rsGenerator, rsSyndromesZero, size };

// ---- render: inline SVG (no external request, no runtime JS) — what bin/widget bakes ----------------
export function toSVG(m, { module = 4, margin = 4, dark = "#000", light = "#fff" } = {}) {
  const n = m.length, dim = (n + margin * 2) * module;
  let rects = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) rects += `<rect x="${(c + margin) * module}" y="${(r + margin) * module}" width="${module}" height="${module}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
    `<rect width="${dim}" height="${dim}" fill="${light}"/><g fill="${dark}">${rects}</g></svg>`;
}
