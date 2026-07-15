// composer/gate-tick.mjs — the GATE TICK as a CLI seam, the bridge the Atlas transport invokes.
//
// gate-queue.mjs is the pure operator core (enqueue / ingest / tick); this wraps one pass in a clean
// JSON-in / JSON-out contract, the same idiom as judgement/bin/judge, so a bash bin/ + a GitHub Actions
// workflow in atlas.anecdote.channel can run a tick without embedding any logic. The Atlas holds the queue
// file and its knobs; this reads them, folds in the newly-arrived resolutions, and reports what moved.
//
//   echo '{ "queue": [...], "items": [...], "resolutions": [...], "now": "<ISO>", "knobs": {...} }' | node composer/gate-tick.mjs
//   -> { "queue": [<still pending>], "admitted": [...], "expired": [...] }
//
// `items` are newly-filed items to enqueue this pass (each starts its decay clock at its own `at`);
// `resolutions` are the newly-filed proof-of-work votes to fold in; `queue` is the persisted pending set.
//
// It only VERIFIES and folds — no signing, no network, deterministic given `now`. The resolutions carry
// their own presence proofs, so the tick can check bound + in-boundary + recent without holding any secret.

import { enqueue, ingest, tick } from "./gate-queue.mjs";

// Enqueue newly-filed items, fold newly-arrived resolutions, and run one tick. `queue` is the persisted
// pending set; `items` are new arrivals to enqueue (each starts its decay clock at its own `at`, or `now`);
// `resolutions` are the newly-filed votes; `knobs` are the Atlas's dial (quorum / recencyWindowMs /
// decayWindowMs / atlasConstituency / friends). Returns { queue: <still pending>, admitted, expired }.
export async function runTick({ queue = [], items = [], resolutions = [], now, knobs = {} } = {}) {
  if (now == null) throw new Error("gate-tick: `now` (an ISO timestamp) is required");
  let q = queue;
  for (const it of items) q = await enqueue(q, it, { at: it?.at || now });
  const ingested = ingest(q, resolutions);
  const r = await tick(ingested, { now, ...knobs });
  return { queue: r.pending, admitted: r.admitted, expired: r.expired };
}

// ---- CLI: one JSON object on stdin -> the tick result JSON on stdout ------------------------------------
async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  let input;
  try { input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { console.error("gate-tick: malformed JSON on stdin"); process.exit(2); }
  if (!input.now) { console.error("gate-tick: input.now (ISO timestamp) is required"); process.exit(2); }
  const out = await runTick(input);
  process.stdout.write(JSON.stringify(out));
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
