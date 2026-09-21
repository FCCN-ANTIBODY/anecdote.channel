// press/view-state.mjs — WHERE YOU WERE, and nothing else.
//
// The press may remember its view so that coming back is coming back to the same page. It is ONE SLOT per
// skin — the view you are on — never a trail. D7 draws the line this follows: "a browsing history is
// creepy; a bookmarks shelf is consented." Remembering where you are standing is neither; remembering where
// you have been would be the first.
//
// It is also deliberately the cheap kind of storage. Nothing here calls navigator.storage.persist(): this is
// best-effort memory the browser may drop under pressure, and losing it costs a person one tap. What a
// person chose to KEEP lives in the bottle-book and their piles, by explicit act, not here.
//
// Pure model over an injected localStorage-shaped storage (the bottle-book / floor-vault pattern).

import { normalizeAddress, isLabel } from "./hosts.mjs";

export const VIEW_KEY = "anecdote.press.view/v1";
const MODES = ["ice", "live"];

function readAll(storage) {
  try { const v = JSON.parse(storage.getItem(VIEW_KEY) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  catch { return {}; }
}

// Remember the view `skin` is showing — a place ({ address, path, mode }) or a pile on this device
// ({ pile, path }). A view that does not validate is not remembered at all, so a bad write can never become
// a bad restore.
const clean = (v) => {
  if (!v || typeof v.path !== "string" || v.path.split("/").includes("..")) return null;
  if (v.pile != null) return isLabel(v.pile) ? { pile: v.pile, path: v.path } : null;
  const a = normalizeAddress(v.address == null ? "" : v.address);
  return a === null ? null : { address: a, path: v.path, mode: MODES.includes(v.mode) ? v.mode : "ice" };
};

export function remember(storage, skin, view = {}) {
  const v = clean({ path: "", ...view });
  if (!skin || !v) return false;
  const all = readAll(storage);
  all[skin] = v;
  try { storage.setItem(VIEW_KEY, JSON.stringify(all)); return true; } catch { return false; }   // quota / private mode: the session still works
}

export function recall(storage, skin) { return clean(readAll(storage)[skin]); }

// Forgetting leaves no residue: the last skin out removes the key itself.
export function forget(storage, skin) {
  const all = readAll(storage);
  delete all[skin];
  try { if (Object.keys(all).length) storage.setItem(VIEW_KEY, JSON.stringify(all)); else storage.removeItem(VIEW_KEY); } catch { /* already gone */ }
}
