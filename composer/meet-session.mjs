// composer/meet-session.mjs — THE MEET AS ONE RUNTIME PRIMITIVE (anecdote.channel#107). meet.mjs is the
// trade logic, meet-carrier.mjs frames it, carrier.mjs is the fountain — this SEQUENCES them into a single
// driver a page (or the Floor, or a CLI) mounts without re-implementing the two-carrier state machine.
//
// Carrier-agnostic: no camera, no QR render, no gesture in here. The caller pulls frames to DISPLAY
// (`show()` — a QR loop) and feeds frames it CAUGHT (`feed()` — from a decoder). Two phases run under the
// hood — the hello (greeting exchange) and the trade (offer exchange) — and the driver holds the two lines
// that make async meets converge: **keep broadcasting my hello until I'm done** (a peer still on hello can
// catch it after I've moved to my trade), and **keep bursting my trade even after I'm done** (a peer who
// finished later than me still needs those frames — going silent the instant I finish would deadlock them).
// My trade frames flow alongside once I've caught the peer's hello (the offer is shaped for THEM). The
// caller stops pulling when BOTH sides read done — that, not my own completion, ends the loop.
//
// On completion: the new hold (peer's ballots merged, terminal quells pruned — receiveMeet), the peer's
// fingerprint, the transcript of what crossed, and MY signed exchangeReceipt naming the peer. The
// countersign return-pass (peer signs my receipt for a fully verifyExchange-able artifact) is a second
// carrier pass — deferred to the caller/next.

import { greeting as makeGreeting, meetOffer, receiveMeet, exchangeReceipt, transcriptIds } from "./meet.mjs";
import { packGreeting, unpackGreeting, packMeetOffer, meetFrames, unpackMeetOffer } from "./meet-carrier.mjs";
import { carrierSession, fountainTransfer } from "./carrier.mjs";

// Open a meet. `hold` = { satchel, quells }; `greeting` = { pins, scopes } (meet.greeting()); `identity`
// signs my hello, trade, and receipt. `receiveOpts` is forwarded to receiveMeet (authorKidFor, cap,
// staleAfterMs, screen, …); `pins` there defaults to my greeting's. `ts` stamps the receipt. Returns the
// session driver — created async because my hello is packed + framed up front.
export async function openMeet({ hold = { satchel: [], quells: [] }, greeting = makeGreeting(), identity,
                                 receiveOpts = {}, ts, blockSize = 256 } = {}) {
  if (!identity) throw new Error("meet-session: an identity is required to sign the meet");

  const helloEnv = await packGreeting(greeting, identity);
  const helloStream = await fountainTransfer(helloEnv, { blockSize });
  let helloCursor = 0;

  const helloCatch = carrierSession({});
  const tradeCatch = carrierSession({});
  let helloDone = false, tradeDone = false;
  let myOffer = null, tradeWire = null, outcome = null;

  function phase() { return tradeDone ? "done" : helloDone ? "trade" : "hello"; }

  // What to display this pass. Two async lines make a meet actually converge:
  //   (a) my HELLO keeps broadcasting until *I* am done — a slower peer still on hello can catch it after
  //       I've advanced to my trade. Once I'm done I caught THEIR trade, which means they caught my hello,
  //       so the hello can finally stop.
  //   (b) my TRADE keeps bursting even AFTER I'm done — the peer who completed later than me still needs
  //       these frames; if I went silent the moment I finished, they'd deadlock. The caller stops pulling
  //       (closes the camera) once both sides read done — that, not my own completion, ends the loop.
  function show(count = 24) {
    const frames = [];
    if (!tradeDone) { frames.push(...helloStream.frames(count, helloCursor)); helloCursor += count; }
    if (tradeWire) frames.push(...tradeWire.burst(count));
    return frames;
  }

  // Feed a caught frame: peer's hello first (until I have it), then peer's trade. A frame for the wrong
  // stage lands as a foreign tile in the wrong catch and is harmlessly ignored — the peer keeps resending.
  async function feed(frameStr) {
    if (!helloDone) {
      const snap = await helloCatch.feed(frameStr);
      if (snap.complete) {
        const res = await helloCatch.result();
        const peerGreeting = (res.ok && unpackGreeting(res.transfers[0] && res.transfers[0].verify)) || makeGreeting();
        myOffer = meetOffer(hold, { pins: greeting.pins || [], peerGreeting });
        tradeWire = await meetFrames(await packMeetOffer(myOffer, identity), { blockSize });
        helloDone = true;
      }
      return { phase: phase() };
    }
    if (!tradeDone) {
      const snap = await tradeCatch.feed(frameStr);
      if (snap.complete) {
        const unpacked = unpackMeetOffer(await tradeCatch.result());
        if (!unpacked.ok) return { phase: phase(), error: unpacked.errors };   // not a trade — stay, keep catching
        const theirOffer = unpacked.offer;
        const after = await receiveMeet(hold, theirOffer, { pins: greeting.pins || [], ...receiveOpts });
        const sent = await transcriptIds(myOffer);
        const received = await transcriptIds(theirOffer);
        const receipt = await exchangeReceipt({ peer: unpacked.by, ts, sent, received }, identity);
        outcome = { hold: { satchel: after.satchel, quells: after.quells }, peer: unpacked.by,
                    transcript: { sent, received }, receipt, diagnostics: after };
        tradeDone = true;
      }
      return { phase: phase() };
    }
    return { phase: "done" };
  }

  return {
    show,
    feed,
    state: () => ({ phase: phase(), done: tradeDone }),
    outcome: () => outcome,   // null until done
  };
}
