// Timing-stats for the device benchmark. Pure (no DOM, no model), so it's Node-testable.
// Samples are millisecond durations; helpers summarize them for "how long does the work take."

export function percentile(samples, p) {
  if (!samples.length) return NaN;
  const s = [...samples].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

export function stats(samples) {
  if (!samples.length) return { n: 0 };
  const s = [...samples].sort((a, b) => a - b);
  const sum = s.reduce((a, x) => a + x, 0);
  return {
    n: s.length,
    min: s[0],
    median: percentile(s, 50),
    p95: percentile(s, 95),
    max: s[s.length - 1],
    mean: sum / s.length,
    perSec: sum > 0 ? (s.length / (sum / 1000)) : Infinity,   // throughput across the run
  };
}

export const ms = (x) => (x >= 1000 ? (x / 1000).toFixed(2) + " s" : Math.round(x) + " ms");
export const mb = (bytes) => (bytes / 1e6).toFixed(1) + " MB";
