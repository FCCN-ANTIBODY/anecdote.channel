// press/broadcast.mjs — HOW A BOTTLE IS CUT UP TO BE SHOWN, and what each way costs.
//
// A bottle has to leave the device as light. There is more than one way to cut it, they are not ranked, and
// which one is right depends on the payload and on the two phones in the room. This module names the three,
// builds the frames for each, and — the point of it — reports the FLOOR: the fewest screen-reads a perfect
// camera would need. Two phones pointed at each other produce an observed number; observed ÷ floor is the
// yield, and that is the integration datum worth collecting (docs/preview-paradigm.md).
//
//   still     ONE QR, all the bytes, no loop and no playhead. A glance, not a transfer. Only possible while
//             the payload fits a single code — and WHERE that ceiling falls is itself a finding, so a still
//             that does not fit is reported with the overshoot rather than thrown away.
//   collage   n codes on screen AT ONCE. Redundancy in SPACE: one read of the screen catches n pieces, so a
//             camera that only ever gets one good frame can still finish. Costs modules — n codes share the
//             screen, so each is smaller, so each needs the camera closer or better.
//   stream    ONE code at a time, endless. Redundancy in TIME: the fountain is rateless, so frame 300,000 is
//             exactly as valid as frame 0 and a late arrival is never late. Costs the viewer's patience.
//
// AND THE CUT IS A SECOND AXIS, orthogonal to all three (`cut`):
//   droplets  rateless XOR combinations. ANY sufficient subset rebuilds it; a missed piece costs nothing
//             because the next one is equally good. This is the default and it is why a loop can heal.
//   blocks    a fixed set, each piece needed exactly once. Fewer total pieces to show, but a miss means
//             waiting for that exact piece to come round again. The literal reading of "n chunks".
//
// Nothing here draws anything or touches a clock: a plan is data, so the same numbers come out in a test,
// in Node, and on a phone. press/ui.mjs and press/broadcast.html do the drawing.

import { canonicalize } from "../composer/sign.mjs";
import { frameTransfer, fountainTransfer } from "../composer/carrier.mjs";
import { chooseVersion } from "../composer/qr-encode.mjs";

export const PROFILES = ["still", "collage", "stream"];
export const CUTS = ["droplets", "blocks"];

const te = new TextEncoder();

// The QR a frame string needs, or null when it does not fit one at all (v40 is the ceiling).
export function codeFor(frame, ecLevel = "M") {
  try { const version = chooseVersion(te.encode(frame).length, ecLevel); return { version, size: 17 + 4 * version }; }
  catch { return null; }
}

// Build a broadcast plan for a signed transfer.
//
//   profile   "still" | "collage" | "stream"
//   cut       "droplets" | "blocks"            (ignored by `still`, which is one piece by definition)
//   blockSize payload bytes per piece          — THE knob. transfer.mjs: "the platform has NO opinion
//                                                about N"; this is where an opinion gets measured.
//   tiles     pieces on screen at once         (collage)
//   ecLevel   "L" | "M" | "Q" | "H"            — error correction INSIDE each code, which is a different
//                                                repair layer from the fountain's and composes with it.
//   fps       screens per second               — only used to turn a floor in screens into a floor in
//                                                seconds. It is arithmetic, not a measurement.
//
// Returns a plan: { profile, cut, ok, why, bytes, pieces, perScreen, floorScreens, floorSeconds,
//                   version, size, modules, frames(screen) }.
// `frames(screen)` yields the frame strings to draw for screen number 0, 1, 2, … — one for a still or a
// stream, `tiles` of them for a collage. It never runs out: a stream and a droplet collage are endless by
// construction, and a block cut wraps, which is the loop.
export async function planBroadcast(signed, { profile = "stream", cut = "droplets", blockSize = 256,
                                              tiles = 9, ecLevel = "M", fps = 8 } = {}) {
  if (!PROFILES.includes(profile)) throw new Error("broadcast: unknown profile " + profile);
  if (!CUTS.includes(cut)) throw new Error("broadcast: unknown cut " + cut);
  const bytes = te.encode(canonicalize(signed)).length;
  const base = { profile, cut, bytes, ecLevel, fps, blockSize };

  if (profile === "still") {
    // One block frame carrying the whole payload. It is an ordinary AC1 block (i=0, n=1), so the existing
    // catcher takes it with no new code on the receiving side — a still is a transfer of one piece.
    const [frame] = await frameTransfer(signed, Math.max(bytes, 1));
    const code = codeFor(frame, ecLevel);
    if (!code) {
      // The finding, not a failure: say how far over, so the ceiling can be located instead of guessed at.
      const fits = largestStill(ecLevel);
      return { ...base, cut: "blocks", ok: false, pieces: 1, perScreen: 1, floorScreens: null, floorSeconds: null,
               version: null, size: null, modules: null, over: frame.length - fits,
               why: `${frame.length} frame bytes is ${frame.length - fits} over what one code holds at level ${ecLevel}`,
               frames: () => [] };
    }
    return { ...base, cut: "blocks", ok: true, pieces: 1, perScreen: 1, floorScreens: 1, floorSeconds: 0,
             version: code.version, size: code.size, modules: code.size * code.size, why: null,
             frames: () => [frame] };
  }

  const perScreen = profile === "collage" ? Math.max(1, Math.floor(tiles)) : 1;

  if (cut === "blocks") {
    const all = await frameTransfer(signed, blockSize);
    const code = codeFor(all[0], ecLevel);
    // A fixed set: every piece is needed exactly once, so the floor is simply how many screens it takes to
    // have shown them all — and a miss is not free, because that piece does not come round until the loop does.
    const floorScreens = Math.ceil(all.length / perScreen);
    return { ...base, cut, ok: !!code, pieces: all.length, perScreen,
             floorScreens, floorSeconds: floorScreens / fps,
             version: code && code.version, size: code && code.size, modules: code && code.size * code.size,
             why: code ? null : "a block does not fit one code — lower blockSize",
             frames: (screen) => Array.from({ length: perScreen }, (_, i) => all[(screen * perScreen + i) % all.length]) };
  }

  const ft = await fountainTransfer(signed, { blockSize });
  const code = codeFor(ft.frame(0), ecLevel);
  // K is the information floor: a rateless code needs at least K pieces, and in practice a small overhead
  // above it. The floor is honest about being a floor — the overhead is exactly what two phones measure.
  const floorScreens = Math.ceil(ft.K / perScreen);
  return { ...base, cut, ok: !!code, pieces: ft.K, perScreen, floorScreens, floorSeconds: floorScreens / fps,
           version: code && code.version, size: code && code.size, modules: code && code.size * code.size,
           why: code ? null : "a droplet does not fit one code — lower blockSize",
           frames: (screen) => Array.from({ length: perScreen }, (_, i) => ft.frame(screen * perScreen + i)) };
}

// The largest frame string one code can hold at a level — the still's ceiling, computed rather than recalled.
export function largestStill(ecLevel = "M") {
  let lo = 1, hi = 8000;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (codeFor("x".repeat(mid), ecLevel)) lo = mid; else hi = mid - 1; }
  return lo;
}

// A one-line tuning report, in the catcher's vocabulary. Short on purpose: it has to be readable across a
// room, on a phone, by someone holding a second phone.
export function tuningLine(plan) {
  if (!plan.ok) return `${plan.profile} · ${plan.bytes} B · WILL NOT FIT (${plan.why})`;
  const each = `v${plan.version} ${plan.size}×${plan.size}`;
  const floor = plan.profile === "still" ? "one glance" : `${plan.floorScreens} screens ≥ ${plan.floorSeconds.toFixed(1)}s at ${plan.fps}/s`;
  return `${plan.profile}/${plan.cut} · ${plan.bytes} B · ${plan.pieces} pieces · ${plan.perScreen}/screen · ${each} · floor ${floor}`;
}
