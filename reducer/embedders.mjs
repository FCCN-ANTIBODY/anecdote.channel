// Embedders for the Anecdote reducer. The reducer treats `embed` as a pluggable, possibly
// async instrument. Two are provided:
//
//   toyEmbed     — a deterministic, dependency-free bag-of-content-words embedder. It makes
//                  token-overlap into cosine similarity, which is enough to PROVE the
//                  assign/collide/merge LOGIC offline. It does NOT understand synonymy — that
//                  is the real model's job. "Does the algorithm converge" and "does the model
//                  load" are deliberately two separate problems.
//   makeMiniLmEmbed — the real seam: transformers.js + all-MiniLM, on-device, NPM-shipped.
//                  The singular instrument, supplied as one pinned package. In the browser the
//                  model weights are cached by the Cache API under the page's origin, so after
//                  first load it is a domain-scoped local appliance — no network, in memory.

const STOP = new Set(
  ("a an the is are was were be been being am of at in on to into onto from this that these those" +
   " there here it its your you i we they he she for and or but with as by have has had do does did" +
   " not no yes can could would should will just very really my our their his her").split(/\s+/)
);

// Content tokens: lowercased, punctuation-stripped, stopwords removed.
export function content(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
}

// fewest-verbs naming, v0 heuristic: content words, de-duplicated, in order — the simplest
// noun-ish phrase we can get without a generative model. v1 swaps in the small LLM here.
export function fewestVerbs(text) {
  const seen = new Set(), out = [];
  for (const w of content(text)) if (!seen.has(w)) { seen.add(w); out.push(w); }
  return out.join(" ") || text.trim().toLowerCase();
}

const D = 256;
function fnv(s) {                          // tiny deterministic hash -> dimension index
  let x = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}

// Deterministic toy embedding: L2-normalized bag of hashed content words.
export function toyEmbed(text) {
  const v = new Float64Array(D);
  for (const w of content(text)) v[fnv(w) % D] += 1;
  let n = 0; for (let i = 0; i < D; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < D; i++) v[i] /= n;
  return v;
}

// Real on-device embedder. Requires `npm i` in reducer/ (optional dep: @huggingface/transformers,
// transformers.js v3+ — it lazy-loads `sharp`, so text feature-extraction runs without native
// image libs, unlike the older @xenova/transformers which eager-loads sharp at import).
// Source-agnostic, local-first: by default it loads the IN-REPO, hash-pinned weights at
// models/ (see weights.mjs) with no network — the "one uniform, verifiable instrument" the
// CONSTITUTION asks for. `dtype: "q8"` selects the committed quantized ONNX. Pass
// { local:false, allowRemote:true } where huggingface.co is reachable to fall back to the
// library's own download (browser-cached in the origin Cache API; Node uses NODE_EXTRA_CA_CERTS).
//
//   const embed = await makeMiniLmEmbed();
//   new Reducer({ embed, name: fewestVerbs, reducerVersion: embed.reducerVersion })
//
// The returned function carries `.reducerVersion` — the canonical id keyed by the weights'
// hash — so callers anchor labels to exactly these bytes, never a look-alike quantization.
// Node-only (the weights/path/integrity machinery uses node: builtins); this is loaded lazily
// so the rest of embedders.mjs stays browser-safe for the composer.
export async function makeMiniLmEmbed(model = "Xenova/all-MiniLM-L6-v2",
  { local = true, modelRoot, allowRemote = !local, verifyHash = local, dtype = "q8" } = {}) {
  const { pipeline, env } = await import("@huggingface/transformers");
  const w = await import("./weights.mjs");

  if (local) {
    env.allowRemoteModels = false;          // cold-load only — refuse any network reach
    env.allowLocalModels = true;
    env.localModelPath = modelRoot || w.modelRoot();
    if (verifyHash) {
      const v = await w.verify(env.localModelPath);
      if (!v.ok) throw new Error(
        `MiniLM weights not verifiable at ${env.localModelPath}: ` +
        `${v.reason || ""}${v.missing?.length ? " missing " + v.missing.join(",") : ""}` +
        `${v.mismatch?.length ? " mismatch " + v.mismatch.join(",") : ""}. ` +
        `Run \`node reducer/weights.mjs fetch\`.`
      );
    }
  } else if (allowRemote) {
    env.allowRemoteModels = true;           // for environments where HF is permitted
  }

  const extract = await pipeline("feature-extraction", model, { dtype });
  const embed = async (text) => {
    const out = await extract(text, { pooling: "mean", normalize: true });
    return Float64Array.from(out.data);     // already unit length (384-dim)
  };
  embed.reducerVersion = w.canonicalVersion();
  return embed;
}

// Generative fewest-verbs namer (v1) — the `name` seam's upgrade from the heuristic fewestVerbs.
// A small on-device text2text model (default Xenova/flan-t5-small) rewrites an utterance into its
// atomic, fewest-verbs concept, so labels are anchored to cleaner names and synonymy the embedder
// can't see on raw text has a better chance of colliding. Same distribution as the embedder:
// in-repo, hash-pinned (its own `namer` block in model.lock.json), cold-loaded.
//
// Deterministic by construction: greedy decode (do_sample:false, num_beams:1), no RNG — required
// by the reducer's reproducibility and the cold-load trust model. Falls back to the heuristic
// `fewestVerbs` whenever the model is degenerate/empty, so naming never breaks reduction.
//
//   const name = await makeNamer();
//   new Reducer({ embed, name, reducerVersion: embed.reducerVersion })
//
// Node-only machinery, lazy-imported, so embedders.mjs stays browser-safe for the composer.
export async function makeNamer(model = "Xenova/flan-t5-small",
  { local = true, modelRoot, allowRemote = !local, verifyHash = local, dtype = "q8",
    maxNewTokens = 16, prompt = (t) => `rewrite as a short topic phrase with few verbs: ${t}` } = {}) {
  const { pipeline, env } = await import("@huggingface/transformers");
  const w = await import("./weights.mjs");

  if (local) {
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = modelRoot || w.namerRoot();
    if (verifyHash) {
      const v = await w.namerVerify(env.localModelPath);
      if (!v.ok) throw new Error(
        `namer weights not verifiable at ${env.localModelPath}: ` +
        `${v.reason || ""}${v.missing?.length ? " missing " + v.missing.join(",") : ""}` +
        `${v.mismatch?.length ? " mismatch " + v.mismatch.join(",") : ""}.`
      );
    }
  } else if (allowRemote) {
    env.allowRemoteModels = true;
  }

  const gen = await pipeline("text2text-generation", model, { dtype });
  const name = async (text) => {
    const out = await gen(prompt(text), { max_new_tokens: maxNewTokens, do_sample: false, num_beams: 1 });
    const raw = (Array.isArray(out) ? out[0]?.generated_text : out?.generated_text) || "";
    // Normalize to a fewest-verbs phrase; fall back to the heuristic if degenerate.
    const cleaned = content(raw).join(" ");
    return cleaned || fewestVerbs(text);
  };
  name.namerVersion = w.namerVersion();
  return name;
}
