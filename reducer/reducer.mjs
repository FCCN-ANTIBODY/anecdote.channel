// Anecdote reducer — the merge-only label core (CONSTITUTION §"Mobile LLM" / §"Responses").
//
// This is the on-device instrument the CONSTITUTION promises: "a heavily pruned mobile LLM
// for your browser, but you must run it with your device's power." Its pristine, only job is
// LABEL REDUCING — turning arbitrary utterances into the fewest-verbs form §"Responses"
// requires, privately, in memory, BEFORE anything flies into the network. If it cannot
// rationalize an input it mints nothing and you are allowed to know it.
//
// A label is anchored to its own fewest-verbs NAME's embedding (a growing curated
// dictionary), NOT a drifting centroid — so labels are reproducible anchors keyed by the
// embedder version, and the embedding is only there for fuzzy matching INTO the dictionary.
//
// Two moves, exactly as designed:
//   assign() — proposer (nearest label by cosine) + acceptor (a threshold). Mint a new
//              label only when nothing clears the bar.
//   ratchet() — merge-only convergence: fold any two labels whose names embed within
//              mergeT into one, ONE WAY, to a fixpoint. Label count only ever drops and
//              there is no split, so it terminates and cannot flicker (no reversal trap).
//
// The embedder is pluggable and may be async (so transformers.js + MiniLM drops straight
// in; see embedders.mjs). Collision = two utterances sharing a label.
//
// Persistence (CONSTITUTION §"Mobile LLM", local cache): a label's vector is DERIVED, so a
// snapshot stores only the durable names/members/aliases — never the floats. Re-deriving the
// vectors from the names with the same-version embedder reconstructs the dictionary exactly.
// That keeps the persisted form small, human-readable, and honest about what is authoritative
// (the name), and it is what is cached in domain-scoped storage. See store.mjs.

export function cos(a, b) {            // a, b are unit vectors
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d;
}

export class Reducer {
  // embed:  (text) => (unit vector | Promise<unit vector>)   — the pinned instrument
  // name:   (text) => fewest-verbs label name                — heuristic v0 / generative v1
  // assignT: assign threshold; mergeT: merge threshold (mergeT >= assignT, merging is stricter)
  constructor({ embed, name, assignT = 0.5, mergeT = 0.62, reducerVersion = "toy/v0" }) {
    this.embed = embed;
    this.name = name;
    this.assignT = assignT;
    this.mergeT = mergeT;
    this.reducerVersion = reducerVersion;   // a label's vec is derived; this is its constitution_sha
    this.labels = [];                       // { id, name, vec, members:[text], aliases:[name] }
    this._n = 0;
  }

  async _mint(text) {
    const name = await this.name(text);     // name may be sync (heuristic v0) or async (generative v1)
    const l = { id: ++this._n, name, vec: await this.embed(name), members: [], aliases: [] };
    this.labels.push(l);
    return l;
  }

  // Assign an utterance to every label it clears assignT for (multi-label); mint if none.
  async assign(text) {
    const v = await this.embed(text);
    let hits = this.labels
      .map((l) => [l, cos(v, l.vec)])
      .filter(([, s]) => s >= this.assignT)
      .sort((a, b) => b[1] - a[1])
      .map(([l]) => l);
    if (!hits.length) hits = [await this._mint(text)];
    for (const l of hits) l.members.push(text);
    return hits;
  }

  // Merge-only ratchet to a fixpoint. Compares label NAMES (their stored vecs), never
  // re-embeds members, so it is cheap and deterministic. Returns the number of merges.
  ratchet() {
    let merges = 0;
    for (;;) {
      let did = false;
      outer:
      for (let i = 0; i < this.labels.length; i++) {
        for (let j = i + 1; j < this.labels.length; j++) {
          if (cos(this.labels[i].vec, this.labels[j].vec) >= this.mergeT) {
            const A = this.labels[i], B = this.labels[j];   // keep the earlier as canonical
            A.members.push(...B.members);                    // one way: B folds into A
            A.aliases.push(B.name, ...B.aliases);
            this.labels.splice(j, 1);
            merges++; did = true;
            break outer;
          }
        }
      }
      if (!did) break;        // fixpoint: no pair within mergeT remains
    }
    return merges;
  }

  // Coarse, publishable view: each label, how many utterances collided on it, its aliases.
  // (Real gatherer-count is DISTINCT TRUSTED SIGNERS per label — see §C/§M — not raw count.)
  summary() {
    return this.labels
      .map((l) => ({ name: l.name, count: l.members.length, aliases: l.aliases }))
      .sort((a, b) => b.count - a.count);
  }

  // ---- Local cache (CONSTITUTION §"Mobile LLM") ---------------------------------------
  //
  // A snapshot is the DURABLE part of the dictionary only: names, members, aliases, ids, and
  // the reducerVersion that derived the (omitted) vectors. No floats cross this boundary.

  toJSON() {
    return {
      reducerVersion: this.reducerVersion,
      _n: this._n,
      labels: this.labels.map(({ id, name, members, aliases }) => ({ id, name, members, aliases })),
    };
  }

  // Rebuild a reducer from a snapshot, RE-DERIVING every vector from its durable name with the
  // supplied embedder. Refuses a version mismatch: vectors from a different embedder are not
  // comparable, so silently mixing them would corrupt assign/merge. The name is authoritative;
  // the vector is reconstructed, never trusted from disk.
  static async from(snapshot, opts) {
    const r = new Reducer(opts);
    if (snapshot && snapshot.reducerVersion && snapshot.reducerVersion !== r.reducerVersion) {
      throw new Error(
        `reducerVersion mismatch: snapshot "${snapshot.reducerVersion}" != embedder "${r.reducerVersion}". ` +
        `Re-reduce from source utterances under the new embedder rather than reusing stale vectors.`
      );
    }
    const labels = (snapshot && snapshot.labels) || [];
    r.labels = await Promise.all(labels.map(async (l) => ({
      id: l.id,
      name: l.name,
      vec: await r.embed(l.name),                 // derived, not loaded
      members: l.members ? [...l.members] : [],
      aliases: l.aliases ? [...l.aliases] : [],
    })));
    r._n = (snapshot && snapshot._n) || r.labels.reduce((m, l) => Math.max(m, l.id || 0), 0);
    return r;
  }

  // Persist the snapshot through a pluggable, domain-scoped store (see store.mjs).
  async save(store, key = "anecdote:dictionary") {
    await store.set(key, JSON.stringify(this.toJSON()));
  }

  // Load a snapshot through a store and re-derive. Returns a hydrated Reducer, or a fresh one
  // if nothing is cached yet.
  static async load(store, key = "anecdote:dictionary", opts) {
    const raw = await store.get(key);
    return Reducer.from(raw ? JSON.parse(raw) : null, opts);
  }
}
