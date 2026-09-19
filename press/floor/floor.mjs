// press/floor/floor.mjs — the stand-in floor's one script (see index.html for what a floor is and is not).
//
// Two jobs: say which label this tile was reached at, and be a LENS. When embedded, it does the inverted
// hello (it is the capable child: it holds the camera) and serves two read-only ops up the port:
//
//   describe      { kind: "floor", label, empty: true, as_of }     D7: "empty is observable"
//   bottle.catch  streams { frame } for every carrier frame the lens reads, until the asker cancels
//
// It never parses a frame beyond "is this one of ours" (the AC1 magic), never reassembles, never verifies.

const labels = location.hostname.split(".");
const label = labels[0];
const apex = location.protocol + "//" + labels.slice(2).join(".") + (location.port ? ":" + location.port : "");
const $ = (id) => document.getElementById(id);

// The faces are the apex's, borrowed when it can be reached; the tile's own stacks stand in when it cannot.
document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href: apex + "/assets/ds/fonts.css" }));

$("label").textContent = label;
$("host").textContent = location.hostname;
document.title = label + " — a floor";

const say = (t) => { $("status").textContent = t; };
const MAGIC = "AC1|";

// Frames the lens has read and nobody has taken yet. `bottle.catch` drains it; with no asker it just fills
// and is capped, so a floor left open in a tab does not grow without bound.
const seen = [];
let lastText = null, reads = 0;
function read(text) {
  if (typeof text !== "string" || !text.startsWith(MAGIC) || text === lastText) return;
  lastText = text; reads++;
  if (seen.length < 4096) seen.push(text);
  say(reads + " frame" + (reads === 1 ? "" : "s") + " read");
}
// The headless seam: a test (or the page next door, by hand) can show the lens frames without optics.
globalThis.__floorFeed = (frames) => { for (const f of frames) read(f); return seen.length; };

$("recording").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const lines = (await file.text()).split(/\r?\n/);
  for (const l of lines) read(l.trim());
  if (!reads) say("No bottle frames in that file.");
});

$("camera").addEventListener("click", async () => {
  let decodeImage;
  try { ({ decodeImage } = await import(apex + "/composer/qr-decode.mjs")); }
  catch { say("The reader could not be loaded from " + apex + "."); return; }
  const video = $("cam"), canvas = $("work"), ctx = canvas.getContext("2d", { willReadFrequently: true });
  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
    video.style.display = "block";
    await video.play();
  } catch (err) { say("No camera: " + (err && err.name || err) + ". Bring a recording instead."); return; }
  say("Looking…");
  const tick = () => {
    if (video.readyState >= 2 && video.videoWidth) {
      const W = 640, H = Math.round((video.videoHeight / video.videoWidth) * 640) || 480;
      canvas.width = W; canvas.height = H;
      ctx.drawImage(video, 0, 0, W, H);
      const hit = decodeImage(ctx.getImageData(0, 0, W, H));
      if (hit) read(hit.text);
    }
    (video.requestVideoFrameCallback ? video.requestVideoFrameCallback.bind(video) : requestAnimationFrame)(tick);
  };
  tick();
});

if (window.parent !== window) {
  document.body.classList.add("embedded");
  const { serveProbeLine } = await import(apex + "/composer/probe-line.mjs");
  let served = false;
  addEventListener("message", (event) => {
    if (served || !event.data || event.data.type !== "probe.line.init/v1" || !event.ports || !event.ports[0]) return;
    served = true;
    serveProbeLine(event.ports[0], {
      ops: {
        "describe": async (_input, api) => { api.emit({ descriptor: { schema: "anecdote.describe/v1", kind: "floor", label, empty: true, as_of: new Date().toISOString() } }); },
        "bottle.catch": async (_input, api) => {
          for (;;) {                                   // runs until the asker cancels; tick() is the cancel point
            while (seen.length) api.emit({ frame: seen.shift() });
            await api.tick(120);
          }
        },
      },
      context: () => ({ recordingOn: true, grants: [] }),
    });
  });
  parent.postMessage({ type: "probe.line.ready/v1" }, "*");
}
