// Fluent, dependency-free Web Worker bus for the on-device model. Mirrors widget/public.html's
// constitution: the worker announces ready ONCE and is otherwise dormant, acting only on messages
// addressed to it. The main thread gets an awaitable proxy — `await bus.ready; await bus.embed(t)`
// — so the UI stays responsive while the model loads ("over DNS, a matter of patience"), and a
// heavier "next tier" model can swap in behind the same calls without the UI noticing.
//
//   const bus = makeModelBus();         // toy embedder by default (instant, zero network)
//   const bus = makeModelBus({ real: true });   // try on-device MiniLM, fall back to toy
//   await bus.ready;                     // resolves with the backend that actually loaded
//   const vec  = await bus.embed("is there shade at this park");
//   const name = await bus.name("is there shade at this park");

export function makeModelBus({ url = new URL("./model-worker.mjs", import.meta.url), real = false, timeoutMs = 30000 } = {}) {
  const u = new URL(url);
  if (real) u.searchParams.set("real", "1");
  const worker = new Worker(u, { type: "module" });

  const pending = new Map();
  let nextId = 1;
  const api = { backend: null, onProgress: null };

  let resolveReady;
  api.ready = new Promise((res) => { resolveReady = res; });

  worker.addEventListener("message", (ev) => {
    const d = ev.data || {};
    if (d.type === "ready") { api.backend = d.backend; resolveReady(d.backend); return; }
    if (d.type === "progress") { try { api.onProgress?.(d); } catch {} return; }
    if (d.id != null) {
      const p = pending.get(d.id);
      if (!p) return;
      pending.delete(d.id);
      d.error ? p.reject(new Error(d.error)) : p.resolve(d.result);
    }
  });
  // Never hang callers if the worker fails to boot — resolve ready in a degraded state.
  worker.addEventListener("error", () => { if (api.backend == null) { api.backend = "error"; resolveReady("error"); } });

  function rpc(cmd, text) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ cmd, id, text });
      setTimeout(() => { if (pending.delete(id)) reject(new Error(`${cmd} timed out`)); }, timeoutMs);
    });
  }

  api.embed = async (text) => { await api.ready; return rpc("embed", text); };
  api.name = async (text) => { await api.ready; return rpc("name", text); };
  api.terminate = () => worker.terminate();
  return api;
}
