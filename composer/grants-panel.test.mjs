// Tests for the "running on my behalf" panel view-model (Edge 3 phase 4). Pure & deterministic.
//   node composer/grants-panel.test.mjs
import { memoryStore } from "../reducer/store.mjs";
import { generateIdentity } from "./sign.mjs";
import { mintGrant, touchGrant, revokeGrant, listGrants } from "./consent.mjs";
import { buildPanel, panelView, grantState, scopeText, panelRow } from "./grants-panel.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const T = "2026-07-01T00:00:00Z";
const beat = { behavior: "git-enough:staging-beat", scope: { piles: ["history"] },
               basis: { shown: "Keep a running history of this session" } };

// 1. scopeText renders dimensions, and empty scope reads as behavior-level.
{
  ok(scopeText({ piles: ["history"], labels: ["x"] }) === "piles: history; labels: x", "scopeText joins dimensions");
  ok(scopeText({}) === "no specific scope", "empty scope reads as no specific scope");
}

// 2. State + "proven by" — the poll-lifecycle idiom: each state points at the artifact that proves it.
{
  const store = memoryStore();
  const id = await generateIdentity();
  const g = await mintGrant(store, beat, id, { now: T });

  const live = grantState(g, { now: T });
  ok(live.state === "live" && live.provenBy === "signed grant " + g.signed.sig.signature.slice(0, 8),
     "a live grant is proven by its signed grant");

  const gexp = await mintGrant(store, { ...beat, expiry: "2026-07-02T00:00:00Z" }, id, { now: T });
  const exp = grantState(gexp, { now: "2026-07-03T00:00:00Z" });
  ok(exp.state === "expired" && exp.provenBy === "expiry 2026-07-02T00:00:00Z",
     "an expired grant is proven by its expiry");

  const rev = await revokeGrant(store, g.grant, id);
  const revd = grantState(await one(store, g.grant), { now: T });
  ok(revd.state === "revoked" && revd.provenBy === "signed revocation " + rev.sig.signature.slice(0, 8),
     "a revoked grant is proven by its signed revocation");
}

// 3. A row carries what a surface needs, and only a live grant can be revoked.
{
  const store = memoryStore();
  const id = await generateIdentity();
  const g = await mintGrant(store, beat, id, { now: T });
  await touchGrant(store, g.grant, { now: "2026-07-01T00:05:00Z" });
  const row = panelRow(await one(store, g.grant), { now: T });
  ok(row.behavior === "git-enough:staging-beat" && row.scope === "piles: history", "row has behavior + scope");
  ok(row.lastActivityText === "2026-07-01T00:05:00Z" && row.canRevoke, "row shows last activity and is revocable while live");
  ok(row.basis === "Keep a running history of this session", "row surfaces what the user was shown");

  const g2 = await mintGrant(store, beat, id, { now: T });
  await revokeGrant(store, g2.grant, id);
  ok(!panelRow(await one(store, g2.grant), { now: T }).canRevoke, "a revoked grant is not revocable");
}

// 4. buildPanel: live first, then expired, then revoked; within a state, most-recently-active first.
{
  const store = memoryStore();
  const id = await generateIdentity();
  const gRev = await mintGrant(store, beat, id, { now: T }); await revokeGrant(store, gRev.grant, id);
  const gExp = await mintGrant(store, { ...beat, expiry: "2026-07-02T00:00:00Z" }, id, { now: T });
  const gOld = await mintGrant(store, beat, id, { now: T }); await touchGrant(store, gOld.grant, { now: "2026-07-01T00:01:00Z" });
  const gNew = await mintGrant(store, beat, id, { now: T }); await touchGrant(store, gNew.grant, { now: "2026-07-01T00:09:00Z" });

  const view = buildPanel(await listGrants(store), { now: "2026-07-03T00:00:00Z" });
  ok(view.total === 4 && view.liveCount === 2, "counts: 4 total, 2 live (gExp expired, gRev revoked)");
  ok(view.rows[0].grant === gNew.grant && view.rows[1].grant === gOld.grant, "live rows first, most-recently-active first");
  ok(view.rows[2].state === "expired" && view.rows[3].state === "revoked", "then expired, then revoked");
}

// 5. The master switch (recording toggle) rides on the panel; default on.
{
  ok(buildPanel([], {}).recordingOn === true, "recording defaults on");
  ok(buildPanel([], { recordingOn: false }).recordingOn === false, "incognito is reflected");
  ok(buildPanel([], {}).total === 0, "an empty trove yields an empty panel");
}

// 6. panelView reads the trove end to end.
{
  const store = memoryStore();
  const id = await generateIdentity();
  await mintGrant(store, beat, id, { now: T });
  const view = await panelView(store, { now: T });
  ok(view.liveCount === 1 && view.rows[0].behavior === "git-enough:staging-beat", "panelView builds from the store");
}

async function one(store, grant) { return (await listGrants(store)).find((r) => r.grant === grant); }

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall grants-panel tests passed");
