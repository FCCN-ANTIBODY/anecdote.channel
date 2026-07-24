// Unit: probe-engine (probe-engine.mjs) — the presence-and-degrade sibling of open-engine. Proves the one
// property the tiered-model ladder needs: a model that is absent / inauthentic / too big to load all collapse
// to a single { present:false } value, never a throw, so a caller degrades identically (keeps the human's
// declaration). Uses an injected `openByName` stub — no iframe, no weights — like the gate's stub-engine test.
// Run: node composer/probe-engine.test.mjs
import { probeEngine, resolveCapability } from "./probe-engine.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const PIN = "pk_platform_pin";

// Stubs standing in for openEngineByName's four outcomes. Each honors the same shape: it may call the
// injected `embed` (to prove capturing/teardown), then resolve a driven engine, reject, or hang forever.
const present = (name) => async (_n, { embed }) => {
  const h = await embed("https://" + name + ".bottles.anecdote.channel/");
  return { url: "https://" + name + ".bottles.anecdote.channel/", client: { drive: true }, module: {}, verified: { ok: true }, teardown: h.teardown };
};
const inauthentic = async (_n, { embed }) => { const h = await embed("u"); h.teardown(); throw new Error("install did not verify against the pin"); };
const incapacity = async (_n, { embed }) => { const h = await embed("u"); h.teardown(); throw new Error("out of memory loading weights"); };
const hangs = () => new Promise(() => {}); // never resolves — models the boot gate that offers no READY

// a fake embed transport: records teardown calls so we can assert the frame is reclaimed.
function fakeEmbed() {
  const torn = { count: 0 };
  const embed = async () => ({ client: {}, teardown: () => { torn.count++; } });
  return { embed, torn };
}

// 1. present -> { present:true } with a usable client and a teardown.
{
  const { embed } = fakeEmbed();
  const r = await probeEngine("flan-t5-namer", { platformKey: PIN, embed, openByName: present("flan-t5-namer") });
  ok(r.present === true && r.client && typeof r.teardown === "function", "a present model probes present with a client + teardown");
  ok(r.url === "https://flan-t5-namer.bottles.anecdote.channel/", "it resolves the canonical model bottle url");
}

// 2. inauthentic install -> absent, not a throw.
{
  const { embed, torn } = fakeEmbed();
  const r = await probeEngine("evil-namer", { platformKey: PIN, embed, openByName: inauthentic });
  ok(r.present === false && /verify|failed/i.test(r.reason), "an install that doesn't verify against the pin reads as absent");
  ok(torn.count === 1, "and its embed frame was torn down (openEngineByName cleans up on throw)");
}

// 3. incapacity (weights too big to load) -> absent, same branch as inauthentic.
{
  const { embed } = fakeEmbed();
  const r = await probeEngine("huge-model", { platformKey: PIN, embed, openByName: incapacity });
  ok(r.present === false && /memory|failed/i.test(r.reason), "a model that fails to LOAD (OOM) reads as absent — capacity is known only after the load");
}

// 4. absent (no READY) -> times out to absent, does not hang.
{
  const { embed } = fakeEmbed();
  const r = await probeEngine("ghost", { platformKey: PIN, embed, openByName: hangs, timeoutMs: 15 });
  ok(r.present === false && /READY/.test(r.reason), "a bottle that never announces READY times out to absent instead of hanging");
}

// 5. a missing pin is a programmer error — the one thing that DOES throw.
{
  let threw = false;
  try { await probeEngine("x", { openByName: present("x") }); } catch { threw = true; }
  ok(threw, "a missing platformKey throws (programmer error), not a silent absent");
}

// 6. resolveCapability walks the preference list to the first present name.
{
  const seen = [];
  const probe = async (name) => { seen.push(name); return name === "namer-b" ? { present: true, name, client: {}, teardown() {} } : { present: false, name, reason: "absent" }; };
  const r = await resolveCapability({ tag: "namer", names: ["namer-a", "namer-b", "namer-c"], platformKey: PIN, probe });
  ok(r.present === true && r.name === "namer-b", "resolveCapability returns the first present model in the list");
  ok(seen.join(",") === "namer-a,namer-b" && r.tag === "namer", "it stops probing once one is present, and tags the result");
  ok(r.attempts.length === 2 && r.attempts[0].present === false, "it records the attempts it made (the skipped tail is not probed)");
}

// 7. resolveCapability with every candidate absent -> a single absent verdict to degrade on.
{
  const probe = async (name) => ({ present: false, name, reason: "absent" });
  const r = await resolveCapability({ tag: "extractor", names: ["a", "b"], platformKey: PIN, probe });
  ok(r.present === false && r.tag === "extractor" && r.attempts.length === 2, "all-absent yields one { present:false } the caller degrades on");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall probe-engine tests passed");
