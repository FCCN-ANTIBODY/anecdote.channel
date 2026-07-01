// composer/probe-ops.mjs — the composer, vended as probe-line capabilities (Milestone: Origin).
//
// This closes the loop docs/probe-line.md opened with: "the composer and widgets aren't standalone pages;
// they are capability CLIENTS." A powerless data: chamber can host the compose UI, but it has no LM, no
// crypto.subtle, no signing key, and no trove — so the two things a composer actually does it must summon
// from the Elevated app over the probe line:
//
//   - label   (Rung 0): reduce-as-you-type. The reducer/LM lives Elevated; the chamber sends text, gets
//             back the canonical fewest-verbs label. No prompt — the "reading glasses" guarantee.
//   - sign-anecdote (Rung 1): build the anecdote/v1, sign it with the DEVICE key, and keep the receipt in
//             the trove. All three (build hash, Ed25519 sign, domain-scoped store) are Elevated-only, so
//             this is a consequential op — one confirm per send (the chamber sets confirmed on the user's
//             Send click, the probe-line analogue of the tunnel's intake).
//
// These are the REAL modules (route/anecdote/sign/consent), so this file runs and is tested in Node; the
// browser only supplies the port + the chamber UI. `deps` mirrors the tunnel guest's deps.

import { intentOf, prepare } from "./route.mjs";
import { build } from "./anecdote.mjs";
import { sign } from "./sign.mjs";
import { mintNonce, record } from "./consent.mjs";

export function composerOps(deps = {}) {
  if (!deps.identity) throw new Error("probe-ops: need a device identity");
  if (!deps.store) throw new Error("probe-ops: need a trove store");
  return {
    // Rung 0 — the LM as an assistive labeler, summoned on demand. One request → one frame.
    label: async (input, api) => {
      const intent = intentOf((input && input.text) || "", deps.name);
      api.emit({ label: intent.label, tokens: intent.tokens });
    },

    // Rung 1 — build + sign on the device key + keep the receipt. `input` = { text, destination,
    // attachments? }. The yield→check-cancel before we persist is the atomicity boundary: a cancel here
    // abandons the send with nothing signed and nothing in the trove.
    "sign-anecdote": async (input, api) => {
      await api.tick();                                  // yield → check-cancel BEFORE any persist
      const dest = input.destination;
      const routed = prepare(input.text, dest, { name: deps.name });
      const anecdote = await build(routed, input.attachments || [], { hash: deps.hash });
      const nonce = mintNonce({ randomBytes: deps.randomBytes });
      const signed = await sign(anecdote, deps.identity, { agent: deps.agent, nonce });
      const receipt = await record(deps.store, signed);  // the receipt stays in OUR trove
      api.emit({ receipt: { nonce: receipt.nonce, label: receipt.label, by: receipt.by, status: receipt.status },
                 to: { id: dest.id, kind: dest.kind } });
    },
  };
}
