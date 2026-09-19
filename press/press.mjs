// press/press.mjs — THE PRESS: one engine, several faces (the skins in this directory).
//
// It is the browser half of everything beside it, and it adds no mechanism of its own — it is the
// composition. A skin hands it a STAGE element and gets back the two gestures and the one verb:
//
//   go(view)          show a place. Either ON ICE — its source fetched, its face resolved (press/face.mjs),
//                     read in a sterile data: chamber (press/chamber.mjs) — or LIVE, the origin itself in a
//                     frame. The page feels like one place; under it you are going all over the subdomain
//                     world, and every hop is an iframe.
//   strike(...)       WRITE: a statement with an object attached, signed here, printed into a pile here.
//   startCatch(...)   READ: embed a floor, drink what its lens reads, open what arrives sterile, and keep it
//                     only if the person says to.
//
// WHAT IT WILL NOT DO, because decisions.md already said no:
//   - It never forwards a framed page's request to the keeper, or to anything (D8: no daisy chains). The only
//     thing a chamber can ask is `press.follow`, and the answer is a view, shown here, in these pixels.
//   - It never enumerates the device's bottles to anyone (D11). The rack a skin draws is this origin reading
//     its own book; no op here exposes it over any port.
//   - It keeps no trail (D7). One remembered view per skin (press/view-state.mjs), and no persist().
//   - It announces leaving. A link out of the constellation is never followed silently — the skin is told,
//     and a person chooses (config/sites.txt: "the listing says it leaves").

import { standing, originOf, normalizeAddress, kindOf, viewToHash, hashToView, isLabel, SHELF } from "./hosts.mjs";
import { resolveFace, resolveLink } from "./face.mjs";
import { exhibitOf } from "./exhibit.mjs";
import { chamberFor, freshNonce, FOLLOW_OP } from "./chamber.mjs";
import { remember, recall, forget } from "./view-state.mjs";
import { strike as strikeSheet, frontPage } from "./bench.mjs";
import { openPile } from "./pile.mjs";
import { catcher, openCaught, slapDown } from "./catch.mjs";
import { spawnChamber, serveProbeLine } from "../composer/probe-line.mjs";
import { embedBottle } from "../composer/bottle-embed.mjs";
import { generateIdentity } from "../composer/sign.mjs";
import { fountainTransfer } from "../composer/carrier.mjs";
import { encodeQR } from "../composer/qr-encode.mjs";
import { readBook, saveBottle, forgetBottle } from "../composer/bottle-book.mjs";
import { idbStore } from "../reducer/store.mjs";

// Where to go when you know no names yet. These are the constellation's own provisioned neighbours — facts
// of this repository's DNS, not a registry of anyone's bottles — and a seed for a demo, not a directory:
// the directory is Atlas's work (civic-node OPEN-QUESTIONS §U), and `atlas` is on this list so it can do it.
export const NEIGHBOURS = ["atlas", "tell", "journal", "library", "constellation", "advocate"];

const PILES_KEY = "anecdote.press.piles/v1";
const asset = (p) => new URL("../assets/" + p, import.meta.url).href;

async function dataUrl(url) {
  const r = await fetch(url); if (!r.ok) throw new Error("asset");
  const blob = await r.blob();
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
}

// The design system, as text and data: URLs, fetched once from this origin's own held shell. Best-effort by
// design: a chamber without the faces falls back to the token stacks, and without the tokens to its own
// fallbacks — it is never blocked on looking right.
let dressing = null;
function dress() {
  if (!dressing) dressing = (async () => {
    const text = (u) => fetch(u).then((r) => (r.ok ? r.text() : "")).catch(() => "");
    const [c, s, t] = await Promise.all(["ds/colors.css", "ds/spacing.css", "ds/typography.css"].map((p) => text(asset(p))));
    const [display, mono] = await Promise.all([dataUrl(asset("fonts/playfair-display.regular.ttf")).catch(() => null),
                                               dataUrl(asset("fonts/SpaceMono-Regular.woff2")).catch(() => null)]);
    return { tokens: c + s + t, fonts: { display, mono } };
  })();
  return dressing;
}

// A reader over HTTP for one origin: path -> text | null. It counts what came back so the press can tell
// "nothing there" from "did not answer" — two different facts about somebody's place.
function readerFor(origin) {
  const tally = { answered: 0, failed: 0 };
  const read = async (path) => {
    const url = origin + "/" + String(path).split("/").map(encodeURIComponent).join("/");
    try {
      const r = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-cache", signal: AbortSignal.timeout(9000) });
      tally.answered++;
      if (!r.ok) return null;
      const text = await r.text();
      // A floor, or a host with a catch-all, answers EVERY path with its one HTML page. That is not an
      // answer to "is there a README.md here", so a non-HTML name that comes back as a document is a miss.
      if (!/\.html?$/i.test(path) && /^\s*<!doctype html/i.test(text)) return null;
      return text;
    } catch { tally.failed++; return null; }
  };
  read.tally = tally;
  return read;
}

// `memory: false` is a skin that keeps no view between visits (the counter: you come back to the two verbs).
export async function createPress({ stage, skin = "press", storage = globalThis.localStorage, store = null, memory = true, on = {} } = {}) {
  if (!stage) throw new Error("press: a stage element is required");
  const where = standing();
  const tell = (name, detail) => { try { on[name] && on[name](detail); } catch (e) { console.error(e); } };
  const piles = new Map();
  const held = new Map();                     // caught this session, by id — loaded is not persisted
  let pileStore = store;
  let mounted = null;                         // { teardown }
  let seq = 0;
  let state = { view: null, face: null, exhibit: null, door: null };
  let identity = null;

  const stores = () => pileStore || (pileStore = idbStore("anecdote-press", "piles"));
  const me = async () => identity || (identity = await generateIdentity());
  const author = () => ({ name: "you", email: "you@" + where.apex, epoch: Math.floor(Date.now() / 1000), tz: "+0000" });

  // ---- showing -------------------------------------------------------------------------------------

  function unmount() { if (mounted) { try { mounted.teardown(); } catch {} mounted = null; } stage.textContent = ""; }

  async function readerOf(view) {
    if (view.caught) { const c = held.get(view.caught); return c ? { read: openCaught(c), key: "caught:" + view.caught } : null; }
    if (view.pile) return { read: (await pile(view.pile)).fetchText, key: "pile:" + view.pile };
    const origin = originOf(view.address, where);
    return origin ? { read: readerFor(origin), key: "at:" + view.address, origin } : null;
  }

  // The strip and the canon belong to the BOTTLE, not to the page inside it: they are read once from the
  // bottle's door (its README — EXHIBIT.md: "the README stays the door") and stay put while the panes change.
  async function doorOf(r) {
    if (state.door && state.door.key === r.key) return state.door;
    const src = await r.read("README.md");
    return { key: r.key, exhibit: src ? exhibitOf(src) : null };
  }

  async function go(next, { push = true, keep = true } = {}) {
    const my = ++seq;
    const view = next.pile ? { pile: next.pile, path: next.path || "" }
      : next.caught ? { caught: next.caught, path: next.path || "" }
      : { address: normalizeAddress(next.address == null ? "" : next.address, where), path: next.path || "", mode: next.mode === "live" ? "live" : "ice" };
    if (view.address === null) { tell("refused", { reason: "not an address: " + next.address }); return null; }
    const r = await readerOf(view);
    if (!r) { tell("refused", { reason: "nothing to read there" }); return null; }
    tell("going", { view });

    let face = null, mode = view.mode || "ice";
    if (mode === "ice") {
      face = await resolveFace(r.read, { path: view.path });
      if (my !== seq) return null;
      if (face.face === "none" && r.read.tally && r.read.tally.answered === 0 && r.read.tally.failed > 0) face.unreachable = r.origin;
      // Only a BUILT page answered: this place is a running site, and its face is itself.
      if (face.face === "live" && r.origin) mode = "live";
    }
    const door = await doorOf(r);
    if (my !== seq) return null;

    unmount();
    if (mode === "live") {
      const iframe = document.createElement("iframe");
      iframe.src = r.origin + "/" + view.path;
      iframe.title = (view.address || where.apex) + " — live";
      iframe.referrerPolicy = "no-referrer";
      stage.appendChild(iframe);
      mounted = { teardown: () => iframe.remove() };
    } else {
      const { tokens, fonts } = await dress();
      if (my !== seq) return null;
      const chamber = await spawnChamber(chamberFor(face, { nonce: freshNonce(), tokens, fonts }), { mount: stage });
      chamber.iframe.title = (face.title || view.address || view.pile || "a caught bottle") + " — on ice";
      const line = serveProbeLine(chamber.port, {
        ops: { [FOLLOW_OP]: async (input, api) => { api.emit({ ok: true }); follow(view, face, input || {}); } },
        context: () => ({ recordingOn: true, grants: [] }),
      });
      mounted = { teardown: () => { line.stop(); chamber.teardown(); } };
    }

    state = { view: { ...view, mode }, face, exhibit: door.exhibit, door };
    if (!view.caught) {
      if (keep && memory) remember(storage, skin, state.view);
      const hash = viewToHash(state.view);
      if (push && location.hash !== hash) history.pushState(null, "", hash);
    }
    tell("view", info());
    return info();
  }

  // Where a pressed link leads. Same bottle -> another pane. Inside the constellation -> that place. Out of
  // it -> the skin is TOLD, and nothing moves until a person says so.
  function follow(view, face, { href, text }) {
    const link = resolveLink(face ? face.path : view.path, href);
    if (!link) return tell("refused", { reason: "that link climbs out of this bottle" });
    if (link.where === "here") return go({ ...view, path: link.path });
    if (link.where === "anchor") return;
    let u; try { u = new URL(link.href, "https://x.invalid"); } catch { return; }
    const inside = u.hostname === where.apex || u.hostname.endsWith("." + where.apex) || u.hostname === "anecdote.channel" || u.hostname.endsWith(".anecdote.channel");
    if (inside && /^https?:$/.test(u.protocol)) return go({ address: normalizeAddress(u.hostname, where), path: u.pathname.replace(/^\/+/, "") });
    tell("leaving", { href: link.href, text: text || link.href });
  }

  // What is on the stage, for a skin to draw from. null is the halt: nothing is on purpose.
  function info() {
    if (!state.view) return null;
    const v = state.view;
    return {
      view: v, face: state.face ? { face: state.face.face, path: state.face.path, title: state.face.title, gaps: state.face.gaps, unreachable: state.face.unreachable || null } : null,
      exhibit: state.exhibit, kind: v.pile ? "pile" : v.caught ? "caught" : kindOf(v.address),
      origin: v.pile || v.caught ? null : originOf(v.address, where),
      // The NAME is what a person would say out loud — the labels, not the whole hostname. `host` is the
      // small true thing under it.
      name: v.pile ? v.pile : v.caught ? "a caught bottle" : (v.address || where.apex),
      host: v.pile ? "a pile on this device" : v.caught ? "in hand, not kept" : (v.address ? v.address + "." + where.apex : where.apex),
      canLive: !(v.pile || v.caught), canRemember: !!(v.address && /^[^.]+\.[^.]+$/.test(v.address)),
    };
  }

  function restore() {
    const from = hashToView(location.hash) || (memory ? recall(storage, skin) : null);
    return from ? go(from, { push: false }) : null;
  }
  addEventListener("popstate", () => { const v = hashToView(location.hash); if (v) go(v, { push: false }); else halt({ push: false }); });

  // THE HALT (docs/single-attention.md): nothing is happening, and the empty stage is in charge of the focus.
  function halt({ push = true } = {}) {
    ++seq; unmount(); state = { view: null, face: null, exhibit: null, door: null };
    forget(storage, skin);
    if (push && location.hash) history.pushState(null, "", location.pathname + location.search);
    tell("view", null);
  }

  // ---- writing -------------------------------------------------------------------------------------

  async function pile(id) {
    if (!piles.has(id)) piles.set(id, await openPile(stores(), id));
    return piles.get(id);
  }
  const pileNames = () => { try { const v = JSON.parse(storage.getItem(PILES_KEY) || "[]"); return Array.isArray(v) ? v.filter(isLabel) : []; } catch { return []; } };
  const notePile = (id) => { const all = [...new Set([...pileNames(), id])].sort(); try { storage.setItem(PILES_KEY, JSON.stringify(all)); } catch {} };

  // `about: true` says the statement is ABOUT what is on the stage. The face's source rides as a receipt —
  // hashed here, never kept (press/bench.mjs) — so the sheet points at the version that was being read.
  async function strike({ text, object = null, pileId, about = false }) {
    if (!isLabel(pileId)) throw new Error("name the pile with a plain label (letters, digits, hyphens)");
    const p = await pile(pileId);
    const i = about && state.view && state.face && state.face.source != null && !state.view.caught ? info() : null;
    const subject = i ? { source: (i.origin || "pile:" + i.name) + "/" + state.face.path, bytes: state.face.source,
                          mediaType: /\.(md|markdown)$/i.test(state.face.path) ? "text/markdown" : "text/plain" } : null;
    const sheet = await strikeSheet({ text, object, about: subject, pile: { id: pileId }, identity: await me() });
    const path = sheet.sheets[0].path;
    const line = (a, fp) => {
      const refs = a.body.slice(1);
      const held = refs.find((r) => r.pile), seen = refs.find((r) => !r.pile);
      return { label: String(a.body[0].text).replace(/\s+/g, " ").slice(0, 80), path: fp,
               object: [held ? held.source.replace(/^attached on this device: /, "") : null, seen ? "a receipt for " + seen.source : null].filter(Boolean).join(", and ") || null };
    };
    const earlier = p.files().filter((f) => /^anecdotes\/[0-9a-f]+\.json$/.test(f.path)).map((f) => f.path).reverse();
    const entries = [line(sheet.anecdote, path)];
    for (const fp of earlier) { try { entries.push(line(JSON.parse(await p.fetchText(fp)), fp)); } catch { entries.push({ label: fp, path: fp }); } }
    await p.strike([...sheet.sheets, { path: "index.md", content: frontPage(pileId, entries) }], { author: author(), message: "print: " + (sheet.label || text.slice(0, 50)) });
    notePile(pileId);
    const out = { pile: pileId, path, id: sheet.id, label: sheet.label, transfer: sheet.transfer, about: subject ? subject.source : null };
    tell("struck", out);
    return out;
  }

  // A pour: the fountain over a struck transfer. frame(seed) is endless; recording(n) is n frames as text —
  // a recording is a first-class artifact (a slower path to the same bytes), and it is how two tabs with no
  // camera between them can still hand a bottle across.
  async function pour(transfer, { blockSize = 128 } = {}) {
    const ft = await fountainTransfer(transfer, { blockSize });
    return { K: ft.K, frame: (s) => ft.frame(s), recording: (n = ft.K * 3) => Array.from({ length: n }, (_, i) => ft.frame(i)).join("\n") + "\n" };
  }

  // ---- reading -------------------------------------------------------------------------------------

  // Embed a floor and drink what its lens reads. The floor is the capable child (it holds the camera); this
  // is the client. Returns { stop }. Resolves nothing by itself — `on.progress` / `on.caught` / `on.passed`.
  async function startCatch({ mount, label = "reader", timeout = 12000 } = {}) {
    const address = label + "." + SHELF, origin = originOf(address, where);
    let stopped = false, embed = null;
    const stop = () => { stopped = true; if (embed) { try { embed.client.cancel("catch"); } catch {} embed.teardown(); embed = null; } };
    const timer = setTimeout(() => { if (!embed && !stopped) { stopped = true; tell("catchUnavailable", { origin }); } }, timeout);
    embedBottle(origin + "/", { mount, allow: "camera", expectOrigin: origin, title: "a floor: the bottle reader" }).then((e) => {
      clearTimeout(timer);
      if (stopped) return e.teardown();
      embed = e;
      const c = catcher();
      let chain = Promise.resolve();
      e.client.invoke("bottle.catch", null, { id: "catch", onFrame: (d) => {
        chain = chain.then(async () => {
          if (stopped || !d.frame) return;
          const r = await c.feed(d.frame);
          tell("progress", r.progress);
          if (!r.caught) return;
          for (const got of r.caught) held.set(got.id, got);
          if (r.passed.length) tell("passed", r.passed);
          if (r.caught.length) tell("caught", r.caught.map(({ id, kind, by, trusted, size }) => ({ id, kind, by, trusted, size })));
          stop();
        });
      } }).catch(() => {});
      tell("catching", { origin });
    });
    return { stop, origin };
  }

  // The deliberate act: keep a caught bottle's SEED in a pile.
  async function keep(id, pileId) {
    const got = held.get(id); if (!got) throw new Error("that bottle is no longer in hand");
    const p = await pile(pileId);
    const path = await slapDown(got, p, { author: author() });
    notePile(pileId);
    tell("kept", { pile: pileId, path });
    return { pile: pileId, path };
  }

  return {
    where, go, halt, restore, info, follow: (input) => follow(state.view || {}, state.face, input),
    strike, pour, pile, pileNames,
    startCatch, keep, held: (id) => held.get(id) || null,
    book: { list: () => readBook(storage), save: (address, label) => saveBottle(storage, { host: address, label }), forget: (address) => forgetBottle(storage, address) },
  };
}

// Draw one carrier frame as a QR. 4-module quiet zone: this rendering is for a CAMERA (bottles README calls
// it "projected"); the stored rendering, which no camera reads, is the driver's and is not drawn here.
export function drawFrame(canvas, frame, { scale = 4 } = {}) {
  const q = encodeQR(frame, { ecLevel: "M" });
  const quiet = 4, n = q.size, W = (n + 2 * quiet) * scale;
  canvas.width = W; canvas.height = W;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, W);
  ctx.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.modules[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
  return q.version;
}
