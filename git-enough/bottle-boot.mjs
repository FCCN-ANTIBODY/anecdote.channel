// git-enough/bottle-boot.mjs — THE BOOT of the served git bottle, extracted from bottle.html's inline script
// so the same brain runs anywhere the bottle site mounts its page (the repo's own /git-enough/bottle.html, or
// a provisioned origin's / — the sub-sub-domain the wildcard serves). Reads the bottle's INCEPTION (its
// attestation, pin, and — for a storage engine — its install manifest), stands the repo up, and runs the boot
// gate: prove ourselves for the domain we are ACTUALLY on, then announce READY and serve over the transferred
// port. An unprovisioned bottle (null inception) offers nothing.
//
// The boot's outcome lands on globalThis.__BOTTLE_BOOT__ (a promise of serveOnHello's { ok, reason?, stop? })
// so an operator's devtools — or a harness driving the real page — can SEE a refusal instead of inferring it
// from silence. Observability only: the resolved value grants nothing (the port is the capability).
import { repo } from "./repo.mjs";
import { serveOnHello } from "./bottle.mjs";
import { INCEPTION } from "./bottle-inception.mjs";

export function bootBottle({ inception = INCEPTION, self: win = globalThis } = {}) {
  const cfg = inception || {};
  const r = repo(); // the bottle's repo (its storage). In-memory for the shell; a provisioned bottle rehydrates its own.
  const author = { name: "bottle", email: "bottle@origin", epoch: 1700000000, tz: "+0000" };
  const boot = serveOnHello({
    repo: r,
    author,
    attestation: cfg.attestation,
    platformKey: cfg.platformKey,
    manifest: cfg.manifest || undefined,
    descriptor: cfg.descriptor || undefined,
    self: win,
  });
  win.__BOTTLE_BOOT__ = boot;
  return boot;
}

export default bootBottle;
