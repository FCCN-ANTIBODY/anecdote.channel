// press/hosts.mjs — where the press's neighbours live, worked out from WHERE THE PRESS IS STANDING.
//
// The press is one page that feels like one place, and under it every view is an iframe onto some other
// origin in the subdomain world. So the first thing it needs is a way to turn a short ADDRESS — the labels
// a person would say, left of the apex — into an origin, and back.
//
//   address            origin (deployed)                          what it is
//   ""                 https://anecdote.channel                   the apex: this press
//   "journal"          https://journal.anecdote.channel           a provisioned neighbour
//   "field-notes.library"  https://field-notes.library.anecdote.channel   a BOTTLE on the library's shelf
//
// THE LIBRARY IS THE WILDCARD HOST; BOTTLES IS A DRIVER (docs/decisions.md D18). A bottle is what we
// transit; the library is who labels and shelves it, at <label>.library.<apex>. `bottles` names the engine
// that mints, reads and plays them — mounted by whoever holds what is moving — never a place one is served from.
//
// STANDING SOMEWHERE ELSE. The apex is read off the current hostname, so the same page works deployed, on
// the multi-origin dev server (`*.anecdote.localhost`, which browsers resolve to loopback by themselves), and
// under the probe-test harness (true production names). On a bare `localhost` there are no siblings to
// stand beside, so neighbours resolve to the DEPLOYED constellation — a page that reaches less, never one
// that invents hosts.
//
// Pure: nothing here fetches or touches the DOM. `loc` is location-shaped ({ protocol, hostname, port }).

export const APEX = "anecdote.channel";
export const SHELF = "library";           // the provisioned wildcard host bottles are shelved under (D18)
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export const isLabel = (s) => typeof s === "string" && LABEL.test(s);

// The apex this hostname stands under: the deployed one, a `<name>.localhost` dev apex, or null when the
// page is not standing in any constellation (bare localhost, an IP, a file).
export function apexOf(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (h === APEX || h.endsWith("." + APEX)) return APEX;
  const m = /(?:^|\.)([a-z0-9-]+\.localhost)$/.exec(h);
  return m ? m[1] : null;
}

// Where the press is standing: { apex, scheme, port, standing }. `standing` false means the neighbours
// below are the deployed ones, reached over https, because nothing local stands beside this page.
export function standing(loc = globalThis.location) {
  const apex = apexOf(loc && loc.hostname);
  if (!apex) return { apex: APEX, scheme: "https:", port: "", standing: false };
  return { apex, scheme: loc.protocol || "https:", port: loc.port || "", standing: true };
}

// An address is dot-joined labels, leftmost first — exactly the hostname with the apex taken off. Returns
// the normalized address, or null if any label is not DNS-legal. "" is the apex.
export function normalizeAddress(input, where = standing()) {
  let s = String(input == null ? "" : input).trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "");
  for (const apex of [where.apex, APEX]) {
    if (s === apex) return "";
    if (s.endsWith("." + apex)) { s = s.slice(0, -(apex.length + 1)); break; }
  }
  if (s === "") return "";
  const labels = s.split(".");
  return labels.every(isLabel) ? labels.join(".") : null;
}

export function originOf(address, where = standing()) {
  const a = normalizeAddress(address, where);
  if (a === null) return null;
  const host = a ? a + "." + where.apex : where.apex;
  return where.scheme + "//" + host + (where.port ? ":" + where.port : "");
}

// A bottle on the library's shelf, by the label its holder gave it.
export const bottleAddress = (label) => (isLabel(label) ? label + "." + SHELF : null);

// What KIND of place an address names, from its shape alone — no lookup, because there is no registry to
// look in (D7). One label is a provisioned neighbour; `<label>.library` is a shelved bottle; `<name>.tell`
// is a pile floor; anything else is a place in the directory (a city, a region).
export function kindOf(address) {
  const a = normalizeAddress(address);
  if (a === null) return null;
  if (a === "") return "apex";
  const labels = a.split(".");
  if (labels.length === 1) return "neighbour";
  if (labels.length === 2 && labels[1] === SHELF) return "bottle";
  if (labels.length === 2 && labels[1] === "tell") return "floor";
  if (labels.length === 2 && labels[1] === "you") return "mask";
  return "place";
}

// The press keeps its view in the fragment, so a view is a link and Back works, and nothing is sent to any
// server to remember it (a fragment never leaves the device):
//
//   #/<address>/<path>     a place in the subdomain world      ( #//README.md is the apex's own README )
//   #~<pile>/<path>        a pile held on THIS device — not a hostname, so it is not spelled like one
export function viewToHash({ address = "", path = "", pile = null } = {}) {
  const p = String(path).replace(/^\/+/, "");
  return pile ? "#~" + pile + "/" + p : "#/" + address + "/" + p;
}
export function hashToView(hash) {
  const h = String(hash || "");
  const local = /^#~([^/]+)\/?(.*)$/.exec(h);
  const m = local || /^#\/([^/]*)\/?(.*)$/.exec(h);
  if (!m) return null;
  let path;
  try { path = decodeURIComponent(m[2]); } catch { return null; }
  if (path.split("/").includes("..")) return null;            // a view never climbs out of its bottle
  if (local) return isLabel(m[1]) ? { pile: m[1], path } : null;
  const address = normalizeAddress(m[1]);
  return address === null ? null : { address, path };
}
