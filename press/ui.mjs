// press/ui.mjs — the parts every skin is made of. Plain DOM, no framework, nothing held that the engine
// does not already hold: each part draws from `press.info()` and asks the press to act. A skin is a layout
// and a sentence; these are the nouns.
//
// Everything that navigates is a real <a href="#/…">. With the script gone they are still links to the
// right fragment — the same promise EXHIBIT.md makes of the strip: the fallback IS the source.

import { viewToHash, hashToView, isLabel, SHELF } from "./hosts.mjs";
import { resolveLink } from "./face.mjs";
import { NEIGHBOURS, drawFrame } from "./press.mjs";

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

// Links written as fragments are followed by the press, not the browser's scroll.
export function wire(root, press) {
  root.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href^='#']");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const view = hashToView(a.getAttribute("href"));
    if (view) { e.preventDefault(); press.go(view); }
  });
}

const HOW = { "index.md": "its own front page", "README.md": "its README, as the index", source: "rendered from unbuilt source",
  markdown: "a page, on ice", html: "markup, inert", text: "a file, as text", none: "nothing here yet", live: "live" };

// WHERE YOU ARE. update(info) — info null is the halt.
export function ribbon(el, press, { halted = "an empty pile", onHalt = null } = {}) {
  const name = h("h1", { class: "name" });
  const how = h("span", { class: "how" });
  const ice = h("button", { type: "button", text: "on ice", onclick: () => flip("ice") });
  const live = h("button", { type: "button", text: "live", onclick: () => flip("live") });
  const toggle = h("span", { class: "toggle", role: "group", "aria-label": "how this place is shown" }, ice, live);
  const keep = h("button", { type: "button", class: "chip", text: "remember this bottle", onclick: () => { const i = press.info(); if (i) { press.book.save(i.view.address, ""); update(i); } } });
  const out = h("a", { class: "chip", text: "stop", href: location.pathname, title: "back to the empty pile", onclick: (e) => { e.preventDefault(); press.halt(); onHalt && onHalt(); } });
  el.append(name, how, h("span", { class: "spacer" }), keep, toggle, out);
  const flip = (mode) => { const i = press.info(); if (i && i.canLive && i.view.mode !== mode) press.go({ ...i.view, mode }); };

  function update(info) {
    const v = info && info.view;
    name.textContent = v ? info.name : halted;
    toggle.hidden = out.hidden = !v;
    keep.hidden = !(v && info.canRemember);
    if (!v) { how.textContent = "nothing is happening"; return; }
    const known = info.canRemember && press.book.list().some((b) => b.host === v.address);
    keep.textContent = known ? "remembered" : "remember this bottle"; keep.disabled = known;
    ice.setAttribute("aria-pressed", String(v.mode !== "live")); live.setAttribute("aria-pressed", String(v.mode === "live"));
    live.disabled = !info.canLive;
    const f = info.face;
    how.textContent = info.host + " · " + (v.mode === "live" ? "live · theirs, as they serve it" : f && f.unreachable ? "did not answer"
      : (HOW[f ? f.face : "none"] || "on ice") + (f && f.gaps && f.gaps.length ? " · " + f.gaps.length + " missing" : "") + (v.path && f && f.face !== "none" ? " · " + f.path : ""));
  }
  update(press.info());
  return { update };
}

// THE STRIP: the door's first link list as tabs, and its canon as buttons. Hidden when a bottle has neither.
export function strip(el, press) {
  el.classList.add("strip");
  function update(info) {
    el.textContent = "";
    const ex = info && info.exhibit, v = info && info.view;
    if (!v || !ex || (!ex.strip.length && !ex.canon.length)) { el.hidden = true; return; }
    el.hidden = false;
    const at = (path) => viewToHash(v.pile ? { pile: v.pile, path } : { address: v.address, path });
    const here = info.face ? info.face.path : v.path;
    const tab = (label, href, cls) => {
      const link = resolveLink("README.md", href);
      if (!link || link.where !== "here") return h("a", { class: cls, href, target: "_blank", rel: "noopener noreferrer", text: label + " ↗" });
      return h("a", { class: cls, href: at(link.path), "aria-current": link.path === here ? "page" : null, text: label });
    };
    el.append(h("a", { href: at(""), "aria-current": here === "README.md" || here === "index.md" ? "page" : null, text: ex.title || "README" }));
    for (const s of ex.strip) el.append(tab(s.label, s.href));
    if (ex.canon.length) el.append(h("span", { class: "gap" }));
    for (const c of ex.canon) el.append(tab(c.key, c.path, "canon"));
  }
  update(press.info());
  return { update };
}

// LEAVING IS SAID. A link out of the constellation is shown here and waits for a person.
export function leaving(el) {
  el.hidden = true;
  return {
    show({ href, text }) {
      el.textContent = ""; el.className = "notice"; el.hidden = false;
      el.append(h("span", { text: "This leaves anecdote.channel:" }), h("b", { text: href }), h("span", { class: "spacer" }),
        h("a", { href, target: "_blank", rel: "noopener noreferrer", text: "open it in a new tab", onclick: () => { el.hidden = true; } }),
        h("button", { type: "button", text: "stay", onclick: () => { el.hidden = true; } }));
    },
    say(text) { el.textContent = ""; el.className = "notice"; el.hidden = false;
      el.append(h("span", { text }), h("span", { class: "spacer" }), h("button", { type: "button", text: "ok", onclick: () => { el.hidden = true; } })); },
    hide() { el.hidden = true; },
  };
}

// THE BED: a statement, an object, a pile, a verb. `about` offers "this is about what I am looking at".
export function bed(el, press, { pile = "field-notes", placeholder = "Say a thing once.", about = false, verb = "Print it", onStruck = null } = {}) {
  el.classList.add("bed");
  let object = null;
  const text = h("textarea", { placeholder, "aria-label": "your statement", rows: 4 });
  const file = h("input", { type: "file", "aria-label": "attach an object" });
  const slot = h("label", { class: "object" }, h("span", { text: "Attach an object — drop it here, or tap to choose. A photo, a file, anything." }), file);
  const name = h("input", { class: "pilename", value: pile, "aria-label": "pile name", spellcheck: false, autocapitalize: "off" });
  const aboutBox = about ? h("input", { type: "checkbox", checked: true, id: "about-" + Math.random().toString(36).slice(2) }) : null;
  const go = h("button", { type: "button", class: "strikebtn", text: verb });
  const status = h("p", { class: "note", role: "status" });

  const take = async (f) => {
    if (!f) return;
    object = { name: f.name, mediaType: f.type || "application/octet-stream", bytes: new Uint8Array(await f.arrayBuffer()) };
    slot.classList.add("has"); slot.firstChild.textContent = f.name + " · " + object.bytes.length.toLocaleString() + " bytes — it rides as a receipt; your pile keeps the bytes";
  };
  file.addEventListener("change", () => take(file.files[0]));
  for (const ev of ["dragenter", "dragover"]) slot.addEventListener(ev, (e) => { e.preventDefault(); slot.classList.add("over"); });
  for (const ev of ["dragleave", "drop"]) slot.addEventListener(ev, (e) => { e.preventDefault(); slot.classList.remove("over"); });
  slot.addEventListener("drop", (e) => take(e.dataTransfer.files[0]));

  go.addEventListener("click", async () => {
    const pileId = name.value.trim().toLowerCase();
    if (!text.value.trim()) { status.textContent = "There is nothing to print yet."; text.focus(); return; }
    if (!isLabel(pileId)) { status.textContent = "A pile's name is plain: letters, digits and hyphens."; name.focus(); return; }
    go.disabled = true; status.textContent = "Signing on this device…";
    try {
      const struck = await press.strike({ text: text.value.trim(), object, pileId, about: !!(aboutBox && aboutBox.checked) });
      status.textContent = "Printed into " + pileId + (struck.about ? ", pointing at the version you were reading." : ".");
      text.value = ""; object = null; file.value = ""; slot.classList.remove("has");
      slot.firstChild.textContent = "Attach an object — drop it here, or tap to choose. A photo, a file, anything.";
      onStruck && onStruck(struck);
    } catch (e) { status.textContent = String(e && e.message || e); }
    go.disabled = false;
  });

  el.append(text, slot,
    h("div", { class: "row" }, h("span", { class: "note", style: "margin:0", text: "into the pile" }), name,
      aboutBox && h("label", { class: "note", style: "margin:0", for: aboutBox.id }, aboutBox, " about what is on the page"),
      h("span", { style: "flex:1" }), go),
    status);
  return { focus: () => text.focus(), setAbout: (on) => { if (aboutBox) { aboutBox.checked = on; aboutBox.disabled = !on; } } };
}

// THE POUR: a struck sheet leaving as light, on a loop, healing. show(struck) starts it; stop() ends it.
export function pourPanel(el, press) {
  el.classList.add("pour");
  let timer = null, url = null;
  const canvas = h("canvas", { role: "img", "aria-label": "a looping bottle: point another device's reader at it" });
  const line = h("p", { class: "eyebrow" });
  const save = h("a", { class: "chip", text: "save a recording", download: "bottle.recording.txt" });
  el.hidden = true;
  el.append(canvas, line, h("p", { class: "note", text: "It loops for as long as it is open. Any sufficient handful of frames rebuilds it; a damaged frame costs nothing." }), save);
  function stop() { if (timer) clearInterval(timer); timer = null; if (url) URL.revokeObjectURL(url); url = null; el.hidden = true; }
  async function show(struck, { fps = 8 } = {}) {
    stop();
    const p = await press.pour(struck.transfer);
    url = URL.createObjectURL(new Blob([p.recording()], { type: "text/plain" })); save.href = url;
    let seed = 0;
    const tick = () => { const v = drawFrame(canvas, p.frame(seed)); line.textContent = "pouring · " + p.K + " blocks · frame " + seed + " · v" + v; seed++; };
    tick(); timer = setInterval(tick, 1000 / fps); el.hidden = false;
    el.dataset.recording = "ready";
    globalThis.__pressPour = p;                           // the headless seam (probe-test/press.ui.test.mjs)
  }
  return { show, stop };
}

// THE CATCH: a floor embedded, its lens drunk from, what arrives held in hand — then kept, or not.
export function catchPanel(el, press, { pile = "field-notes", label = "reader" } = {}) {
  let session = null;
  const frame = h("div", { class: "floorframe" });
  const meter = h("div", { class: "meter", role: "progressbar", "aria-label": "bottle caught so far" }, h("i"));
  const status = h("p", { class: "note", role: "status" });
  const hand = h("div");
  el.append(frame, meter, status, hand);

  function start() {
    stop(); hand.textContent = ""; meter.firstChild.style.width = "0";
    status.textContent = "Opening a floor to read with…";
    press.startCatch({ mount: frame, label }).then((s) => { session = s; });
  }
  function stop() { if (session) session.stop(); session = null; frame.textContent = ""; }
  const on = {
    catching: ({ origin }) => { status.textContent = "Reading at " + origin.replace(/^https?:\/\//, "") + " — that page holds the lens; this one does the catching."; },
    catchUnavailable: ({ origin }) => { status.textContent = origin.replace(/^https?:\/\//, "") + " did not answer, so there is no floor to read on from here. Run scripts/serve-constellation.mjs, or wait for *." + SHELF + " to be laid."; },
    progress: (p) => { if (p.total) meter.firstChild.style.width = Math.round((100 * p.have) / p.total) + "%";
      status.textContent = p.total ? p.have + " of " + p.total + " blocks" + (p.damaged ? " · " + p.damaged + " damaged frames healed around" : "") : "Waiting for a first frame…"; },
    passed: (list) => { status.textContent = "Seen and not caught: " + list.map((x) => (x.kind || "something") + " (" + x.reason + ")").join("; "); },
    caught: (list) => {
      frame.textContent = ""; status.textContent = "In hand. Nothing has been written anywhere.";
      for (const c of list) {
        const name = h("input", { class: "pilename", value: pile, "aria-label": "pile to keep it in" });
        const kept = h("p", { class: "note" });
        hand.append(h("div", { class: "caught", "data-caught": c.id },
          h("div", { class: "kind", text: "a" + (/^[aeiou]/.test(c.kind) ? "n " : " ") + c.kind }),
          h("p", { class: "note", style: "margin:0", text: c.size.toLocaleString() + " bytes · signed by " + String(c.by || "nobody").slice(0, 23) + "… · " +
            (c.trusted ? "someone you trust" : "a stranger — it verifies; whether to act on it is yours") }),
          h("div", { class: "bed" }, h("div", { class: "row" },
            h("button", { type: "button", class: "chip", text: "look at it", onclick: () => press.go({ caught: c.id }) }),
            h("span", { style: "flex:1" }), h("span", { class: "note", style: "margin:0", text: "keep it in" }), name,
            h("button", { type: "button", class: "strikebtn", text: "Slap it down", onclick: async (e) => {
              const id = name.value.trim().toLowerCase();
              if (!isLabel(id)) { kept.textContent = "A pile's name is plain: letters, digits and hyphens."; return; }
              e.target.disabled = true;
              try { const k = await press.keep(c.id, id); kept.textContent = ""; kept.append("Kept, whole, as it arrived: ", h("a", { href: viewToHash({ pile: k.pile, path: k.path }), text: k.pile + "/" + k.path })); }
              catch (err) { kept.textContent = String(err && err.message || err); e.target.disabled = false; }
            } }))), kept));
      }
    },
  };
  return { start, stop, on };
}

// THE RACK: what is within reach — your piles, the bottles you chose to remember, the neighbours, a name.
export function rack(el, press) {
  el.classList.add("rack");
  function update() {
    el.textContent = "";
    const piles = press.pileNames(), book = press.book.list();
    const input = h("input", { placeholder: "a-name", "aria-label": "a bottle's label", spellcheck: false, autocapitalize: "off" });
    const form = h("form", { class: "addr", onsubmit: (e) => { e.preventDefault(); const l = input.value.trim().toLowerCase(); if (isLabel(l)) press.go({ address: l + "." + SHELF, path: "" }); } },
      input, h("span", { text: "." + SHELF + "." + press.where.apex }), h("button", { text: "open" }));
    el.append(
      h("h3", { text: "your piles" }),
      piles.length ? h("ul", {}, piles.map((p) => h("li", {}, h("a", { href: viewToHash({ pile: p, path: "" }), text: p }, h("small", { text: "on this device" })))))
        : h("p", { class: "empty", text: "None yet. Print something and one exists." }),
      h("h3", { text: "bottles you remembered" }),
      book.length ? h("ul", {}, book.map((b) => h("li", {}, h("a", { href: viewToHash({ address: b.host, path: "" }), text: b.label || b.host.split(".")[0] }, h("small", { text: b.host })))))
        : h("p", { class: "empty", text: "None. Nothing is remembered unless you say so." }),
      h("h3", { text: "any name on the shelf" }), form,
      h("p", { class: "note", text: "Every name answers. A name nobody has used is a floor — an invitation, not an error." }),
      h("h3", { text: "neighbours" }),
      h("ul", {}, NEIGHBOURS.map((n) => h("li", {}, h("a", { href: viewToHash({ address: n, path: "" }), text: n }, h("small", { text: n + "." + press.where.apex }))))));
  }
  update();
  return { update };
}
