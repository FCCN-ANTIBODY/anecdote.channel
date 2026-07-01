// composer/grants-panel.mjs — the "running on my behalf" panel (probe-line consent, Edge 3 phase 4).
//
// The fine-grained sibling of the coarse recording toggle: the recording switch says "recorded, or not";
// this panel is the per-behavior breaker. Its whole job is LEGIBILITY — a standing behavior you cannot
// SEE running has no business running (docs/probe-line-consent.md, "legibility = legitimacy"). Revoking
// is one tap and is a signed act only you can make (consent.revokeGrant).
//
// Borrowing the civic-node poll-lifecycle idiom (.github/ISSUE_TEMPLATE/poll-lifecycle.md → "Proof of
// lifecycle: current state + the artifact that proves it"): every row states its STATE and the exact
// ARTIFACT that PROVES that state — the signed grant when live, the signed revocation when revoked, the
// expiry when expired. Nothing is asserted; each state points at what makes it true.
//
// Pure view-model core (testable in Node) + a thin DOM renderer at the bottom (browser-only), same shape
// as the rest of the channel.

import { listGrants, grantExpired } from "./consent.mjs";

const ORDER = { live: 0, expired: 1, revoked: 2 };

function sig8(signed) { return signed && signed.sig && signed.sig.signature ? signed.sig.signature.slice(0, 8) : "?"; }

// The state of one grant + the artifact that proves it. Revoked takes precedence over expired.
export function grantState(record, opts = {}) {
  if (record.status === "revoked")
    return { state: "revoked", provenBy: `signed revocation ${sig8(record.revocation)}` };
  if (grantExpired(record, opts))
    return { state: "expired", provenBy: `expiry ${record.signed.expiry}` };
  return { state: "live", provenBy: `signed grant ${sig8(record.signed)}` };
}

// Human-readable scope. Empty scope = "no specific scope" (behavior-level; least-authority — see the gate).
export function scopeText(scope = {}) {
  const dims = Object.entries(scope || {})
    .filter(([, v]) => Array.isArray(v) && v.length)
    .map(([k, v]) => `${k}: ${v.join(", ")}`);
  return dims.length ? dims.join("; ") : "no specific scope";
}

// One row of the panel — everything the surface needs to render a behavior legibly.
export function panelRow(record, opts = {}) {
  const st = grantState(record, opts);
  return {
    grant: record.grant,
    behavior: record.behavior,
    scope: scopeText(record.scope),
    state: st.state,
    provenBy: st.provenBy,                                  // the poll-lifecycle "Proven by" idiom
    grantedAt: record.signed.granted_at,
    lastActivity: record.last_activity || null,
    lastActivityText: record.last_activity || "never acted",
    basis: (record.signed.basis && record.signed.basis.shown) || null,
    canRevoke: st.state === "live",                         // only a live grant can be revoked (a tombstone can't)
  };
}

// The whole panel view model from a list of grant records. Live behaviors first (they need attention),
// then most-recently-active. `recordingOn` is the master switch shown above the per-behavior breakers.
export function buildPanel(grants, opts = {}) {
  const rows = (grants || []).map((r) => panelRow(r, opts));
  rows.sort((a, b) =>
    (ORDER[a.state] - ORDER[b.state]) ||
    String(b.lastActivity || "").localeCompare(String(a.lastActivity || "")));
  return {
    recordingOn: opts.recordingOn !== false,               // default on; incognito is the opt-in
    liveCount: rows.filter((r) => r.state === "live").length,
    total: rows.length,
    rows,
  };
}

// Async convenience: read the trove and build the panel.
export async function panelView(store, opts = {}) {
  return buildPanel(await listGrants(store), opts);
}

// ---- thin DOM renderer (browser-only; the view, not the logic) --------------------------------------

// Render the panel into `container`. `onRevoke(grant)` is invoked when a live row's Revoke is tapped
// (the caller wires it to consent.revokeGrant + the runtime's cancel/port.close). Returns nothing; call
// again with a fresh view to re-render.
export function renderPanel(container, view, { onRevoke, document: doc = globalThis.document } = {}) {
  container.textContent = "";
  const head = doc.createElement("header");
  head.className = "panel-head";
  head.textContent = `Running on your behalf — ${view.liveCount} live` +
    (view.total > view.liveCount ? ` (${view.total - view.liveCount} past)` : "");
  const rec = doc.createElement("span");
  rec.className = "recording " + (view.recordingOn ? "on" : "off");
  rec.textContent = view.recordingOn ? "recording: on" : "recording: off (incognito)";
  head.appendChild(rec);
  container.appendChild(head);

  if (!view.rows.length) {
    const empty = doc.createElement("p");
    empty.className = "empty";
    empty.textContent = "Nothing is running on your behalf.";
    container.appendChild(empty);
    return;
  }

  for (const row of view.rows) {
    const el = doc.createElement("article");
    el.className = "grant " + row.state;
    el.dataset.grant = row.grant;

    const title = doc.createElement("h3");
    title.textContent = row.behavior;
    const badge = doc.createElement("span");
    badge.className = "state " + row.state;
    badge.textContent = row.state;
    title.appendChild(badge);
    el.appendChild(title);

    const meta = doc.createElement("dl");
    const add = (k, v) => { const dt = doc.createElement("dt"); dt.textContent = k; const dd = doc.createElement("dd"); dd.textContent = v; meta.append(dt, dd); };
    add("scope", row.scope);
    add("granted", row.grantedAt);
    add("last activity", row.lastActivityText);
    if (row.basis) add("you were shown", row.basis);
    add("proven by", row.provenBy);       // the state points at the artifact that makes it true
    el.appendChild(meta);

    if (row.canRevoke) {
      const btn = doc.createElement("button");
      btn.className = "revoke";
      btn.textContent = "Revoke";
      btn.title = "A signed act only you can make — stops the behavior and withdraws the grant";
      btn.addEventListener("click", () => onRevoke && onRevoke(row.grant));
      el.appendChild(btn);
    }
    container.appendChild(el);
  }
}
