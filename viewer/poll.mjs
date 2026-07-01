// viewer/poll.mjs — the `pile.poll` type for the system viewer (docs/system-viewer.md, "Poll-piles,
// reconciled offline"). A poll is a DATA OBJECT you author offline; the Tell is the addressable face it
// publishes to. This module is the offline origin's side: the official declaration of that object as a
// git-enough pile, a reader that renders it, and the author helper (the create-a-data-object act).
//
// The object shape (`anecdote.poll/v1`) is the Tell's per-poll constitution VERBATIM
// (_data/constitutions/<pile>/<poll>.json in tell.anecdote.channel: type/text/options/accept_writein/
// guidance/lifecycle) plus one field — `tell` — naming the addressable Tell it answers through. Authoring
// this object is exactly what makes tell.anecdote.channel the poll-authoring app; publishing writes the
// constitution + mints the QR on the Tell, while the origin keeps the hosting copy and fetches deliveries
// back. Deliveries land as files under deliveries/ and become the widget's LIVE RESULTS.

import { filesAt } from "../git-enough/read.mjs";

export const POLL_SCHEMA = "anecdote.poll/v1";
const dec = new TextDecoder();

// ---- reading -------------------------------------------------------------------------------------------

// Read a JSON file's parsed contents at a ref, or null if absent/unparseable.
function readJson(repo, ref, path) {
  const tip = repo.readRef(ref || repo.head());
  if (!tip) return null;
  const f = filesAt(repo.objects, tip).find((x) => x.path === path);
  if (!f) return null;
  const b = repo.objects.get(f.oid);
  if (!b) return null;
  try { return JSON.parse(dec.decode(b.content)); } catch { return null; }
}

// Minimal shape check — enough to trust it's our object, not enough to be a boy-scout about it.
export function isPoll(obj) {
  return !!obj && obj.schema === POLL_SCHEMA && typeof obj.poll === "string" && typeof obj.text === "string";
}

// The poll data object at a ref (poll.json), or null if this repo doesn't carry one.
export function parsePoll(repo, { ref } = {}) {
  const obj = readJson(repo, ref, "poll.json");
  return isPoll(obj) ? obj : null;
}

// Every fetched-back delivery record. Deliveries live under deliveries/ as JSON — each file is either a
// single record or a sealed digest ({records:[...]}, the tell.digest/v1 shape the origin fetches + decrypts).
// We flatten to the individual records so the tally doesn't care which the origin wrote.
export function deliveryRecords(repo, { ref } = {}) {
  const tip = repo.readRef(ref || repo.head());
  if (!tip) return [];
  const out = [];
  for (const f of filesAt(repo.objects, tip)) {
    if (!f.path.startsWith("deliveries/") || !f.path.endsWith(".json")) continue;
    const b = repo.objects.get(f.oid);
    if (!b) continue;
    let doc; try { doc = JSON.parse(dec.decode(b.content)); } catch { continue; }
    if (Array.isArray(doc)) out.push(...doc);
    else if (Array.isArray(doc.records)) out.push(...doc.records);
    else out.push(doc);
  }
  return out;
}

// Tally deliveries into live results. Only ACCEPTED records count toward the answer tally (the Tell's
// governed verdict, if present, is authoritative; a record with no verdict is treated as accepted, since a
// bare delivery the origin chose to keep is a delivered answer). Records for other polls are ignored when a
// `poll` slug is available to filter on.
export function tallyDeliveries(records, { poll, options = [] } = {}) {
  const listed = new Set(options);
  const counts = new Map();
  let total = 0, pending = 0, rejected = 0;
  for (const r of records) {
    if (!r || typeof r.answer !== "string") continue;
    if (poll && r.poll && r.poll !== poll) continue;
    const v = r.governed;                     // accept | needs-judgment | held | reject | undefined
    if (v === "reject") { rejected++; continue; }
    if (v === "needs-judgment" || v === "held") { pending++; continue; }
    counts.set(r.answer, (counts.get(r.answer) || 0) + 1);
    total++;
  }
  // Seed listed options at 0 so the widget shows every choice even before anyone picks it.
  for (const o of options) if (!counts.has(o)) counts.set(o, 0);
  const tally = [...counts.entries()]
    .map(([answer, count]) => ({ answer, count, listed: listed.has(answer) }))
    .sort((a, b) => b.count - a.count || (a.answer < b.answer ? -1 : 1));
  return { total, pending, rejected, tally };
}

// Lifecycle state at a moment. Pure: caller passes `now` (epoch ms) — no clock in here. Without a `now`,
// state is "unknown" (we still report the window). opens_at/closes_at are ISO strings (Tell convention).
export function pollState(lifecycle = {}, now) {
  const win = { round: lifecycle.round ?? null, opens_at: lifecycle.opens_at || null, closes_at: lifecycle.closes_at || null };
  if (now == null) return { state: "unknown", ...win };
  const opens = win.opens_at ? Date.parse(win.opens_at) : null;
  const closes = win.closes_at ? Date.parse(win.closes_at) : null;
  let state = "open";
  if (opens != null && now < opens) state = "scheduled";
  else if (closes != null && now >= closes) state = "closed";
  return { state, ...win };
}

// The full poll view-model a chamber widget renders: the question + mini-constitution + options with a live
// tally + the addressable Tell twin + the "proven by" artifact (the tip commit). `entry` is the registry
// entry ({ label, kind, repo, downstreams }); opts.now (epoch ms) enables open/closed state.
export function pollView(entry, { ref, now } = {}) {
  const repo = entry.repo;
  const poll = parsePoll(repo, { ref });
  if (!poll) return { error: "not a poll pile", label: entry.label };
  const records = deliveryRecords(repo, { ref });
  const results = tallyDeliveries(records, { poll: poll.poll, options: poll.options || [] });
  const tip = repo.readRef(ref || repo.head());
  return {
    schema: poll.schema, pile: poll.pile, poll: poll.poll, type: poll.type,
    text: poll.text, options: poll.options || [], accept_writein: !!poll.accept_writein,
    guidance: poll.guidance || "", lifecycle: poll.lifecycle || {},
    tell: poll.tell || (entry.downstreams || [])[0] || null,   // the addressable face
    results,
    lifecycleState: pollState(poll.lifecycle || {}, now),
    provenBy: tip || null,      // the commit oid that proves this state — the "Proven by" idiom
  };
}

// ---- authoring (the create-a-data-object act) ----------------------------------------------------------

// Normalize + validate a spec into a well-formed anecdote.poll/v1 object. Defaults mirror the Tell: `type`
// defaults to "open", write-ins default on for open polls / off for multichoice, lifecycle carries round 1.
export function buildPoll(spec = {}) {
  if (!spec.poll) throw new Error("authorPoll: a poll needs a `poll` slug");
  if (!spec.text) throw new Error("authorPoll: a poll needs `text` (the question)");
  const type = spec.type || "open";
  const options = spec.options || [];
  if (type === "multichoice" && options.length === 0)
    throw new Error("authorPoll: a multichoice poll needs `options`");
  return {
    schema: POLL_SCHEMA,
    pile: spec.pile || spec.poll,
    poll: spec.poll,
    type,
    text: spec.text,
    options,
    accept_writein: spec.accept_writein ?? (type !== "multichoice"),
    guidance: spec.guidance || "",
    lifecycle: { round: 1, ...(spec.lifecycle || {}) },
    ...(spec.tell ? { tell: spec.tell } : {}),
  };
}

// Author a poll into a repo: commit the poll.json data object. This is the offline origin authoring the
// object the Tell will host — `commitFiles` makes it a real git-enough pile you can push downstream.
export async function authorPoll(repo, spec, { author, message, ref } = {}) {
  const poll = buildPoll(spec);
  await repo.commitFiles([{ path: "poll.json", content: JSON.stringify(poll, null, 2) + "\n" }],
                         { author, message: message || `poll: ${poll.poll}`, ref });
  return poll;
}

// The files at a ref as [{ path, content }] — so an incremental commit can carry the whole tree forward.
// (git-enough's commitFiles builds the tree from ONLY the files it's given; it doesn't merge the parent
// tree, so an append has to re-stage what's already there.)
function currentFiles(repo, ref) {
  const tip = repo.readRef(ref || repo.head());
  if (!tip) return [];
  return filesAt(repo.objects, tip).map((f) => ({ path: f.path, content: repo.objects.get(f.oid).content }));
}

// Record a fetched-back delivery into the pile (deliveries/<name>.json). The origin calls this after
// pulling + decrypting a Tell manifest; the widget's live results pick it up on the next read. Carries the
// existing tree forward so poll.json and prior deliveries survive the append.
export async function recordDelivery(repo, name, record, { author, message, ref } = {}) {
  const path = `deliveries/${name}.json`;
  const files = currentFiles(repo, ref).filter((f) => f.path !== path);
  files.push({ path, content: JSON.stringify(record, null, 2) + "\n" });
  await repo.commitFiles(files, { author, message: message || `deliver: ${name}`, ref });
  return record;
}
