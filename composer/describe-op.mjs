// composer/describe-op.mjs — the SELF-DESCRIPTION half of the bottle grammar: the one op any bottle can
// vend so a picker, a shelf, or a journal can SKIM what it holds without vendoring anything or trusting
// anyone. `describe` hands back the bottle's DESCRIPTOR — a pre-crunched, dated snapshot of what the
// bottle is for and what is inside: for a data-pile, its questions/leads, its counts, its declared input
// filters; for an engine, its op surface. The sibling of `install` (composer/install-op), same posture:
// static bytes produced at crunch time, served read-only, Rung 0 — serving a snapshot grants nothing.
//
// TRUST SPLIT, on purpose (the design's keystone): the bottle's KIND — the coarse "what this origin is" —
// rides inside the platform-SIGNED inception attestation (composer/bottle-attest `opts.kind`), checkable
// before connecting; a picker FILTERS on that. The descriptor is a SELF-REPORT: it is for previewing and
// sifting, never for trust — a bottle can say anything here, so nothing here may gate anything there.
// Subtypes stay EMERGENT: no enum, no schema police — the descriptor's content (its questions, its leads,
// its filters) IS the taxonomy a sifting tool reads.
//
// EMPTY IS OBSERVABLE: a freshly provisioned bottle ships its descriptor from inception with zero counts,
// so "nothing here yet, as of <date>" is a dated statement, not an absence to interpret. Nothing runs in
// the background — the descriptor updates only when its owner re-crunches (freshness over secrecy, the
// staleness chosen and visible in `as_of`).

export const DESCRIBE = "anecdote.describe/v1";

// Shape gate for a descriptor: minimal on purpose. `schema` + `as_of` (the dated-snapshot honesty) are
// required; everything else — kind echo, questions, leads, filters, counts, api, disclosures — is the
// bottle's own to compose. We refuse to enumerate further: emergence is the point.
export function isDescriptor(d) {
  return !!d && d.schema === DESCRIBE && typeof d.as_of === "string" && d.as_of.length > 0;
}

// Vend one op, `describe`, that emits the pre-crunched descriptor. Mis-wiring fails loudly at boot, like
// install-op: a bottle that claims a descriptor must hold a well-formed one.
export function describeOps({ descriptor } = {}) {
  if (!isDescriptor(descriptor))
    throw new Error("describe-op: needs a descriptor ({ schema:'" + DESCRIBE + "', as_of, … })");
  return {
    // Rung 0 — read-only. The whole snapshot; the caller sifts.
    "describe": async (_input, api) => { api.emit(descriptor); },
  };
}

export default describeOps;
