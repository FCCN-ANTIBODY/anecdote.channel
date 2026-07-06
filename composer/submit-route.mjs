// composer/submit-route.mjs — the THIN ROUTER over the backend line (docs/backend-seam.md). The
// backend-blind core (composer/submission.mjs) builds a neutral `tell.submission/v1` block; this decides
// where it goes:
//   - a PUBLIC backend is indicated (a credential is at hand, or the QR named a relay `su=`) AND the poll
//     has a canonical thread → the github adapter's deliver() posts a comment and returns a placement.
//   - otherwise → the PRESENCE route: nothing is sent; the answer is HELD (the caller carries it as a
//     ballot through the mesh, composer/ballot.mjs). No URL, no github — a held answer is not a failure.
//
// This file names no issue, comment, POST, or token; all github vocabulary lives in egress-github.mjs, and
// the mesh is composer/ballot.mjs. The backend namespace (cfg.backend — #105's routing-namespace law) is
// read ONLY to decide the route and is handed to the adapter untouched — never into a frame.

import { parseQR, answerView, submissionBlock } from "./submission.mjs";
import { deliver } from "./egress-github.mjs";

// The poll-answer view as probe-line capabilities. `poll.view`/`poll.compose` are Rung 0 (pure compute);
// `poll.compose` is the PREVIEW the confirm shows (the answer + the exact block that will be sent);
// `poll.submit` is the Rung-1 tap that routes it. `egressApi` is the injected github transport (test seam).
export function pollAnswerOps({ qr, canonicalRepo, ts, egressApi } = {}) {
  const cfg = parseQR(qr, { canonicalRepo });
  const b = cfg.backend || {};   // the backend namespace — carried by the core, read only here + the adapter
  const hasPublicRoute = (credential) => (credential || b.cred || b.submitUrl) && b.canonical;
  return {
    "poll.view": async (_input, api) => { api.emit({ view: answerView(cfg) }); },
    "poll.compose": async (input, api) => {
      const answer = ((input && input.answer) || "").trim();
      api.emit({ answer, block: answer ? submissionBlock(cfg, answer, { ts }) : null });
    },
    // The confirm-gated SEND. A host-injected credential (operator chamber) or the QR's relay/post address
    // routes to the public backend; anything else HOLDS the answer for the mesh. Neither a credential nor a
    // relay address ever enters a frame.
    "poll.submit": async (input, api) => {
      const answer = ((input && input.answer) || "").trim();
      const credential = (input && input.credential) || (b.submitUrl ? null : b.cred);
      if (!answer) { api.emit({ submitted: null }); return; }
      if (!hasPublicRoute(credential)) { api.emit({ submitted: null, held: true }); return; }  // → carry as a ballot
      try {
        const { placement } = await deliver(cfg, answer, { api: egressApi, credential, submitUrl: b.submitUrl, ts });
        api.emit({ submitted: true, placement });                 // no credential in the frame
      } catch (e) {
        api.emit({ submitted: false, error: e.message, held: true });  // never silent; hold to retry/carry
      }
    },
  };
}
