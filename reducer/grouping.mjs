// reducer/grouping.mjs — the LATE GROUPING PASS: upgrade a node-map's STALLED labels with a typifying namer,
// IF one is available, and otherwise leave the subtractive labels exactly as they are. This is the on-stall
// path the whole model-tier arc was built for.
//
// doc-nodemap gives correct STRUCTURE with subtractive labels — a group of heterogeneous terms names as a
// concatenation ("ingredients one cup yellow cornmeal …"), never a type ("ingredients"). That is the stall.
// Grouping is a separate, model-dependent capability (a typifying namer, likely a generative model in a
// bottle), and NOT every device holds it. So this pass:
//   1. probes the models hub for a `namer` capability (resolveCapability — transport injected, no git drag),
//   2. if ABSENT, returns the map untouched — the subtractive labels stand, and the document is still fully
//      readable by cursor (the ~95% that needs no grouper),
//   3. if PRESENT, re-labels only the STALLED nodes (genuine groups: >1 distinct term) with the model's
//      typifying name over that node's raw text — fixing labels only, never the structure or the cursors.
//
// The trigger is the stall itself: a single-term leaf is already its own label and is never regrouped. The
// answer still always comes from the raw bytes at the cursor; grouping only makes the GENEALOGY read as
// "eggs › ingredients › recipe" instead of "eggs › ingredients one cup… › …".

import { resolveCapability } from "../composer/probe-engine.mjs";
import { collectTerms, slice } from "./doc-nodemap.mjs";

// A node is STALLED (worth regrouping) when it is not a term and its subtree holds MORE THAN ONE distinct
// content term — i.e., a genuine heterogeneous group whose subtractive label could only concatenate. A leaf
// term, or a node that reduces to a single term, needs no grouper.
export function isStalled(node) {
  return node && node.kind !== "term" && collectTerms(node).size > 1;
}

// Re-label the stalled nodes of a map with an async typifying `namer`. If `namer` is null/absent, the map is
// returned unchanged — the degrade. Mutates labels in place (a pass over the built structure) and returns the
// map. `onlyStalled=false` would re-name every non-term node (a full grouping pass); default is on-stall only.
export async function regroup(map, text, { namer, onlyStalled = true } = {}) {
  if (typeof namer !== "function") return map; // no grouper held → keep the subtractive labels
  const walk = async (node) => {
    if (!node || node.kind === "term") return;
    if (!onlyStalled || isStalled(node)) {
      const label = await namer(slice(text, node.span));
      if (label) node.label = String(label);
    }
    for (const c of node.children || []) await walk(c);
  };
  await walk(map);
  return map;
}

// The `namer` capability CONTRACT, made concrete: a resolved namer capability's client exposes a typifying
// name op — `client.name(text) => label`, or the probe-line form `client.invoke("name", { text })`. Adapt a
// resolved capability into the async `namer(text)` regroup expects. (No namer bottle exists yet; this fixes
// the shape a namer bottle must serve, so the day one ships, regroup drives it with no change here.)
export function namerFromCapability(cap) {
  if (!cap || !cap.present || !cap.client) return null;
  const c = cap.client;
  if (typeof c.name === "function") return async (text) => c.name(text);
  if (typeof c.invoke === "function") return async (text) => {
    const res = await c.invoke("name", { text });
    return res && (res.label ?? (Array.isArray(res.frames) ? res.frames[0] : res));
  };
  return null;
}

// Probe the models hub's preference list for a `namer` and return an async namer + its teardown, or a null
// namer to degrade on. `embed` is the injected transport (composer/bottle-embed embedBottle in the browser);
// `resolve` is injectable for tests. The caller regroups with the returned `namer`, then calls `teardown`.
export async function resolveGroupingNamer({ platformKey, embed, names = ["flan-t5-namer"], timeoutMs, resolve } = {}) {
  const cap = resolve
    ? await resolve({ tag: "namer", names, platformKey, embed, timeoutMs })
    : await resolveCapability({ tag: "namer", names, platformKey, embed, timeoutMs });
  const namer = namerFromCapability(cap);
  return {
    present: !!namer,
    namer,
    reason: namer ? undefined : (cap && cap.reason) || "no namer capability available",
    teardown: () => { try { cap && cap.teardown && cap.teardown(); } catch {} },
  };
}
