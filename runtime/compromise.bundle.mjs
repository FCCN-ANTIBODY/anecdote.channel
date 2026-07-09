// reducer/node_modules/compromise/src/API/world.js
var methods = {
  one: {},
  two: {},
  three: {},
  four: {}
};
var model = {
  one: {},
  two: {},
  three: {}
};
var compute = {};
var hooks = [];
var world_default = { methods, model, compute, hooks };

// reducer/node_modules/compromise/src/API/methods/compute.js
var isArray = (input) => Object.prototype.toString.call(input) === "[object Array]";
var fns = {
  /** add metadata to term objects */
  compute: function(input) {
    const { world: world2 } = this;
    const compute4 = world2.compute;
    if (typeof input === "string" && compute4.hasOwnProperty(input)) {
      compute4[input](this);
    } else if (isArray(input)) {
      input.forEach((name) => {
        if (world2.compute.hasOwnProperty(name)) {
          compute4[name](this);
        } else {
          console.warn("no compute:", input);
        }
      });
    } else if (typeof input === "function") {
      input(this);
    } else {
      console.warn("no compute:", input);
    }
    return this;
  }
};
var compute_default = fns;

// reducer/node_modules/compromise/src/API/methods/loops.js
var forEach = function(cb) {
  const ptrs = this.fullPointer;
  ptrs.forEach((ptr, i3) => {
    const view = this.update([ptr]);
    cb(view, i3);
  });
  return this;
};
var map = function(cb, empty) {
  const ptrs = this.fullPointer;
  const res = ptrs.map((ptr, i3) => {
    const view = this.update([ptr]);
    const out2 = cb(view, i3);
    if (out2 === void 0) {
      return this.none();
    }
    return out2;
  });
  if (res.length === 0) {
    return empty || this.update([]);
  }
  if (res[0] !== void 0) {
    if (typeof res[0] === "string") {
      return res;
    }
    if (typeof res[0] === "object" && (res[0] === null || !res[0].isView)) {
      return res;
    }
  }
  let all4 = [];
  res.forEach((ptr) => {
    all4 = all4.concat(ptr.fullPointer);
  });
  return this.toView(all4);
};
var filter = function(cb) {
  let ptrs = this.fullPointer;
  ptrs = ptrs.filter((ptr, i3) => {
    const view = this.update([ptr]);
    return cb(view, i3);
  });
  const res = this.update(ptrs);
  return res;
};
var find = function(cb) {
  const ptrs = this.fullPointer;
  const found = ptrs.find((ptr, i3) => {
    const view = this.update([ptr]);
    return cb(view, i3);
  });
  return this.update([found]);
};
var some = function(cb) {
  const ptrs = this.fullPointer;
  return ptrs.some((ptr, i3) => {
    const view = this.update([ptr]);
    return cb(view, i3);
  });
};
var random = function(n3 = 1) {
  let ptrs = this.fullPointer;
  let r2 = Math.floor(Math.random() * ptrs.length);
  if (r2 + n3 > this.length) {
    r2 = this.length - n3;
    r2 = r2 < 0 ? 0 : r2;
  }
  ptrs = ptrs.slice(r2, r2 + n3);
  return this.update(ptrs);
};
var loops_default = { forEach, map, filter, find, some, random };

// reducer/node_modules/compromise/src/API/methods/utils.js
var utils = {
  /** */
  termList: function() {
    return this.methods.one.termList(this.docs);
  },
  /** return individual terms*/
  terms: function(n3) {
    const m3 = this.match(".");
    return typeof n3 === "number" ? m3.eq(n3) : m3;
  },
  /** */
  groups: function(group) {
    if (group || group === 0) {
      return this.update(this._groups[group] || []);
    }
    const res = {};
    Object.keys(this._groups).forEach((k2) => {
      res[k2] = this.update(this._groups[k2]);
    });
    return res;
  },
  /** */
  eq: function(n3) {
    let ptr = this.pointer;
    if (!ptr) {
      ptr = this.docs.map((_doc, i3) => [i3]);
    }
    if (ptr[n3]) {
      return this.update([ptr[n3]]);
    }
    return this.none();
  },
  /** */
  first: function() {
    return this.eq(0);
  },
  /** */
  last: function() {
    const n3 = this.fullPointer.length - 1;
    return this.eq(n3);
  },
  /** grab term[0] for every match */
  firstTerms: function() {
    return this.match("^.");
  },
  /** grab the last term for every match  */
  lastTerms: function() {
    return this.match(".$");
  },
  /** */
  slice: function(min2, max3) {
    let pntrs = this.pointer || this.docs.map((_o, n3) => [n3]);
    pntrs = pntrs.slice(min2, max3);
    return this.update(pntrs);
  },
  /** return a view of the entire document */
  all: function() {
    return this.update().toView();
  },
  /**  */
  fullSentences: function() {
    const ptrs = this.fullPointer.map((a2) => [a2[0]]);
    return this.update(ptrs).toView();
  },
  /** return a view of no parts of the document */
  none: function() {
    return this.update([]);
  },
  /** are these two views looking at the same words? */
  isDoc: function(b) {
    if (!b || !b.isView) {
      return false;
    }
    const aPtr = this.fullPointer;
    const bPtr = b.fullPointer;
    if (!aPtr.length === bPtr.length) {
      return false;
    }
    return aPtr.every((ptr, i3) => {
      if (!bPtr[i3]) {
        return false;
      }
      return ptr[0] === bPtr[i3][0] && ptr[1] === bPtr[i3][1] && ptr[2] === bPtr[i3][2];
    });
  },
  /** how many seperate terms does the document have? */
  wordCount: function() {
    return this.docs.reduce((count, terms) => {
      count += terms.filter((t3) => t3.text !== "").length;
      return count;
    }, 0);
  },
  // is the pointer the full sentence?
  isFull: function() {
    const ptrs = this.pointer;
    if (!ptrs) {
      return true;
    }
    if (ptrs.length === 0 || ptrs[0][0] !== 0) {
      return false;
    }
    let wantTerms = 0;
    let haveTerms = 0;
    this.document.forEach((terms) => wantTerms += terms.length);
    this.docs.forEach((terms) => haveTerms += terms.length);
    return wantTerms === haveTerms;
  },
  // return the nth elem of a doc
  getNth: function(n3) {
    if (typeof n3 === "number") {
      return this.eq(n3);
    } else if (typeof n3 === "string") {
      return this.if(n3);
    }
    return this;
  }
};
utils.group = utils.groups;
utils.fullSentence = utils.fullSentences;
utils.sentence = utils.fullSentences;
utils.lastTerm = utils.lastTerms;
utils.firstTerm = utils.firstTerms;
var utils_default = utils;

// reducer/node_modules/compromise/src/API/methods/index.js
var methods2 = Object.assign({}, utils_default, compute_default, loops_default);
methods2.get = methods2.eq;
var methods_default = methods2;

// reducer/node_modules/compromise/src/API/View.js
var View = class _View {
  constructor(document, pointer, groups = {}) {
    const props = [
      ["document", document],
      ["world", world_default],
      ["_groups", groups],
      ["_cache", null],
      ["viewType", "View"]
    ];
    props.forEach((a2) => {
      Object.defineProperty(this, a2[0], {
        value: a2[1],
        writable: true
      });
    });
    this.ptrs = pointer;
  }
  /* getters:  */
  get docs() {
    let docs = this.document;
    if (this.ptrs) {
      docs = world_default.methods.one.getDoc(this.ptrs, this.document);
    }
    return docs;
  }
  get pointer() {
    return this.ptrs;
  }
  get methods() {
    return this.world.methods;
  }
  get model() {
    return this.world.model;
  }
  get hooks() {
    return this.world.hooks;
  }
  get isView() {
    return true;
  }
  // is the view not-empty?
  get found() {
    return this.docs.length > 0;
  }
  // how many matches we have
  get length() {
    return this.docs.length;
  }
  // return a more-hackable pointer
  get fullPointer() {
    const { docs, ptrs, document } = this;
    const pointers = ptrs || docs.map((_d, n3) => [n3]);
    return pointers.map((a2) => {
      let [n3, start2, end2, id, endId] = a2;
      start2 = start2 || 0;
      end2 = end2 || (document[n3] || []).length;
      if (document[n3] && document[n3][start2]) {
        id = id || document[n3][start2].id;
        if (document[n3][end2 - 1]) {
          endId = endId || document[n3][end2 - 1].id;
        }
      }
      return [n3, start2, end2, id, endId];
    });
  }
  // create a new View, from this one
  update(pointer) {
    const m3 = new _View(this.document, pointer);
    if (this._cache && pointer && pointer.length > 0) {
      const cache2 = [];
      pointer.forEach((ptr, i3) => {
        const [n3, start2, end2] = ptr;
        if (ptr.length === 1) {
          cache2[i3] = this._cache[n3];
        } else if (start2 === 0 && this.document[n3].length === end2) {
          cache2[i3] = this._cache[n3];
        }
      });
      if (cache2.length > 0) {
        m3._cache = cache2;
      }
    }
    m3.world = this.world;
    return m3;
  }
  // create a new View, from this one
  toView(pointer) {
    return new _View(this.document, pointer || this.pointer);
  }
  fromText(input) {
    const { methods: methods17 } = this;
    const document = methods17.one.tokenize.fromString(input, this.world);
    const doc = new _View(document);
    doc.world = this.world;
    doc.compute(["normal", "freeze", "lexicon"]);
    if (this.world.compute.preTagger) {
      doc.compute("preTagger");
    }
    doc.compute("unfreeze");
    return doc;
  }
  clone() {
    let document = this.document.slice(0);
    document = document.map((terms) => {
      return terms.map((term) => {
        term = Object.assign({}, term);
        term.tags = new Set(term.tags);
        return term;
      });
    });
    const m3 = this.update(this.pointer);
    m3.document = document;
    m3._cache = this._cache;
    return m3;
  }
};
Object.assign(View.prototype, methods_default);
var View_default = View;

// reducer/node_modules/compromise/src/_version.js
var version_default = "14.15.1";

// reducer/node_modules/compromise/src/API/extend.js
var isObject = function(item) {
  return item && typeof item === "object" && !Array.isArray(item);
};
var isArray2 = function(arr) {
  return Object.prototype.toString.call(arr) === "[object Array]";
};
function mergeDeep(model5, plugin5) {
  if (isObject(plugin5)) {
    for (const key in plugin5) {
      if (isObject(plugin5[key])) {
        if (!model5[key]) Object.assign(model5, { [key]: {} });
        mergeDeep(model5[key], plugin5[key]);
      } else {
        Object.assign(model5, { [key]: plugin5[key] });
      }
    }
  }
  return model5;
}
function mergeQuick(model5, plugin5) {
  for (const key in plugin5) {
    model5[key] = model5[key] || {};
    Object.assign(model5[key], plugin5[key]);
  }
  return model5;
}
var addIrregulars = function(model5, conj) {
  const m3 = model5.two.models || {};
  Object.keys(conj).forEach((k2) => {
    if (conj[k2].pastTense) {
      if (m3.toPast) {
        m3.toPast.ex[k2] = conj[k2].pastTense;
      }
      if (m3.fromPast) {
        m3.fromPast.ex[conj[k2].pastTense] = k2;
      }
    }
    if (conj[k2].presentTense) {
      if (m3.toPresent) {
        m3.toPresent.ex[k2] = conj[k2].presentTense;
      }
      if (m3.fromPresent) {
        m3.fromPresent.ex[conj[k2].presentTense] = k2;
      }
    }
    if (conj[k2].gerund) {
      if (m3.toGerund) {
        m3.toGerund.ex[k2] = conj[k2].gerund;
      }
      if (m3.fromGerund) {
        m3.fromGerund.ex[conj[k2].gerund] = k2;
      }
    }
    if (conj[k2].comparative) {
      if (m3.toComparative) {
        m3.toComparative.ex[k2] = conj[k2].comparative;
      }
      if (m3.fromComparative) {
        m3.fromComparative.ex[conj[k2].comparative] = k2;
      }
    }
    if (conj[k2].superlative) {
      if (m3.toSuperlative) {
        m3.toSuperlative.ex[k2] = conj[k2].superlative;
      }
      if (m3.fromSuperlative) {
        m3.fromSuperlative.ex[conj[k2].superlative] = k2;
      }
    }
  });
};
var extend = function(plugin5, world2, View2, nlp2) {
  if (isArray2(plugin5)) {
    plugin5.forEach((p5) => extend(p5, world2, View2, nlp2));
    return;
  }
  const { methods: methods17, model: model5, compute: compute4, hooks: hooks2 } = world2;
  if (plugin5.methods) {
    mergeQuick(methods17, plugin5.methods);
  }
  if (plugin5.model) {
    mergeDeep(model5, plugin5.model);
  }
  if (plugin5.irregulars) {
    addIrregulars(model5, plugin5.irregulars);
  }
  if (plugin5.compute) {
    Object.assign(compute4, plugin5.compute);
  }
  if (hooks2) {
    world2.hooks = hooks2.concat(plugin5.hooks || []);
  }
  if (plugin5.api) {
    plugin5.api(View2);
  }
  if (plugin5.lib) {
    Object.keys(plugin5.lib).forEach((k2) => nlp2[k2] = plugin5.lib[k2]);
  }
  if (plugin5.tags) {
    nlp2.addTags(plugin5.tags);
  }
  if (plugin5.words) {
    nlp2.addWords(plugin5.words);
  }
  if (plugin5.frozen) {
    nlp2.addWords(plugin5.frozen, true);
  }
  if (plugin5.mutate) {
    plugin5.mutate(world2, nlp2);
  }
};
var extend_default = extend;

// reducer/node_modules/compromise/src/API/_lib.js
var verbose = function(set) {
  const env2 = typeof process === "undefined" || !process.env ? self.env || {} : process.env;
  env2.DEBUG_TAGS = set === "tagger" || set === true ? true : "";
  env2.DEBUG_MATCH = set === "match" || set === true ? true : "";
  env2.DEBUG_CHUNKS = set === "chunker" || set === true ? true : "";
  return this;
};

// reducer/node_modules/compromise/src/API/inputs.js
var isObject2 = (val) => {
  return Object.prototype.toString.call(val) === "[object Object]";
};
var isArray3 = function(arr) {
  return Object.prototype.toString.call(arr) === "[object Array]";
};
var fromJson = function(json) {
  return json.map((o2) => {
    return o2.terms.map((term) => {
      if (isArray3(term.tags)) {
        term.tags = new Set(term.tags);
      }
      return term;
    });
  });
};
var preTokenized = function(arr) {
  return arr.map((a2) => {
    return a2.map((str) => {
      return {
        text: str,
        normal: str,
        //cleanup
        pre: "",
        post: " ",
        tags: /* @__PURE__ */ new Set()
      };
    });
  });
};
var inputs = function(input, View2, world2) {
  const { methods: methods17 } = world2;
  const doc = new View2([]);
  doc.world = world2;
  if (typeof input === "number") {
    input = String(input);
  }
  if (!input) {
    return doc;
  }
  if (typeof input === "string") {
    const document = methods17.one.tokenize.fromString(input, world2);
    return new View2(document);
  }
  if (isObject2(input) && input.isView) {
    return new View2(input.document, input.ptrs);
  }
  if (isArray3(input)) {
    if (isArray3(input[0])) {
      const document2 = preTokenized(input);
      return new View2(document2);
    }
    const document = fromJson(input);
    return new View2(document);
  }
  return doc;
};
var inputs_default = inputs;

// reducer/node_modules/compromise/src/nlp.js
var world = Object.assign({}, world_default);
var nlp = function(input, lex) {
  if (lex) {
    nlp.addWords(lex);
  }
  const doc = inputs_default(input, View_default, world);
  if (input) {
    doc.compute(world.hooks);
  }
  return doc;
};
Object.defineProperty(nlp, "_world", {
  value: world,
  writable: true
});
nlp.tokenize = function(input, lex) {
  const { compute: compute4 } = this._world;
  if (lex) {
    nlp.addWords(lex);
  }
  const doc = inputs_default(input, View_default, world);
  if (compute4.contractions) {
    doc.compute(["alias", "normal", "machine", "contractions"]);
  }
  return doc;
};
nlp.plugin = function(plugin5) {
  extend_default(plugin5, this._world, View_default, this);
  return this;
};
nlp.extend = nlp.plugin;
nlp.world = function() {
  return this._world;
};
nlp.model = function() {
  return this._world.model;
};
nlp.methods = function() {
  return this._world.methods;
};
nlp.hooks = function() {
  return this._world.hooks;
};
nlp.verbose = verbose;
nlp.version = version_default;
var nlp_default = nlp;

// reducer/node_modules/compromise/src/1-one/cache/methods/cacheDoc.js
var createCache = function(document) {
  const cache2 = document.map((terms) => {
    const items = /* @__PURE__ */ new Set();
    terms.forEach((term) => {
      if (term.normal !== "") {
        items.add(term.normal);
      }
      if (term.switch) {
        items.add(`%${term.switch}%`);
      }
      if (term.implicit) {
        items.add(term.implicit);
      }
      if (term.machine) {
        items.add(term.machine);
      }
      if (term.root) {
        items.add(term.root);
      }
      if (term.alias) {
        term.alias.forEach((str) => items.add(str));
      }
      const tags = Array.from(term.tags);
      for (let t3 = 0; t3 < tags.length; t3 += 1) {
        items.add("#" + tags[t3]);
      }
    });
    return items;
  });
  return cache2;
};
var cacheDoc_default = createCache;

// reducer/node_modules/compromise/src/1-one/cache/methods/index.js
var methods_default2 = {
  one: {
    cacheDoc: cacheDoc_default
  }
};

// reducer/node_modules/compromise/src/1-one/cache/api.js
var methods3 = {
  /** */
  cache: function() {
    this._cache = this.methods.one.cacheDoc(this.document);
    return this;
  },
  /** */
  uncache: function() {
    this._cache = null;
    return this;
  }
};
var addAPI = function(View2) {
  Object.assign(View2.prototype, methods3);
};
var api_default = addAPI;

// reducer/node_modules/compromise/src/1-one/cache/compute.js
var compute_default2 = {
  cache: function(view) {
    view._cache = view.methods.one.cacheDoc(view.document);
  }
};

// reducer/node_modules/compromise/src/1-one/cache/plugin.js
var plugin_default = {
  api: api_default,
  compute: compute_default2,
  methods: methods_default2
};

// reducer/node_modules/compromise/src/1-one/change/api/case.js
var case_default = {
  /** */
  toLowerCase: function() {
    this.termList().forEach((t3) => {
      t3.text = t3.text.toLowerCase();
    });
    return this;
  },
  /** */
  toUpperCase: function() {
    this.termList().forEach((t3) => {
      t3.text = t3.text.toUpperCase();
    });
    return this;
  },
  /** */
  toTitleCase: function() {
    this.termList().forEach((t3) => {
      t3.text = t3.text.replace(/^ *[a-z\u00C0-\u00FF]/, (x) => x.toUpperCase());
    });
    return this;
  },
  /** */
  toCamelCase: function() {
    this.docs.forEach((terms) => {
      terms.forEach((t3, i3) => {
        if (i3 !== 0) {
          t3.text = t3.text.replace(/^ *[a-z\u00C0-\u00FF]/, (x) => x.toUpperCase());
        }
        if (i3 !== terms.length - 1) {
          t3.post = "";
        }
      });
    });
    return this;
  }
};

// reducer/node_modules/compromise/src/1-one/change/api/lib/insert.js
var isTitleCase = (str) => /^\p{Lu}[\p{Ll}'’]/u.test(str) || /^\p{Lu}$/u.test(str);
var toTitleCase = (str) => str.replace(/^\p{Ll}/u, (x) => x.toUpperCase());
var toLowerCase = (str) => str.replace(/^\p{Lu}/u, (x) => x.toLowerCase());
var spliceArr = (parent, index3, child) => {
  child.forEach((term) => term.dirty = true);
  if (parent) {
    const args = [index3, 0].concat(child);
    Array.prototype.splice.apply(parent, args);
  }
  return parent;
};
var endSpace = function(terms) {
  const hasSpace2 = / $/;
  const hasDash4 = /[-–—]/;
  const lastTerm = terms[terms.length - 1];
  if (lastTerm && !hasSpace2.test(lastTerm.post) && !hasDash4.test(lastTerm.post)) {
    lastTerm.post += " ";
  }
};
var movePunct = (source, end2, needle) => {
  const juicy = /[-.?!,;:)–—'"]/g;
  const wasLast = source[end2 - 1];
  if (!wasLast) {
    return;
  }
  const post = wasLast.post;
  if (juicy.test(post)) {
    const punct = post.match(juicy).join("");
    const last = needle[needle.length - 1];
    last.post = punct + last.post;
    wasLast.post = wasLast.post.replace(juicy, "");
  }
};
var moveTitleCase = function(home, start2, needle) {
  const from = home[start2];
  if (start2 !== 0 || !isTitleCase(from.text)) {
    return;
  }
  needle[0].text = toTitleCase(needle[0].text);
  const old = home[start2];
  if (old.tags.has("ProperNoun") || old.tags.has("Acronym")) {
    return;
  }
  if (isTitleCase(old.text) && old.text.length > 1) {
    old.text = toLowerCase(old.text);
  }
};
var cleanPrepend = function(home, ptr, needle, document) {
  const [n3, start2, end2] = ptr;
  if (start2 === 0) {
    endSpace(needle);
  } else if (end2 === document[n3].length) {
    endSpace(needle);
  } else {
    endSpace(needle);
    endSpace([home[ptr[1]]]);
  }
  moveTitleCase(home, start2, needle);
  spliceArr(home, start2, needle);
};
var cleanAppend = function(home, ptr, needle, document) {
  const [n3, , end2] = ptr;
  const total = (document[n3] || []).length;
  if (end2 < total) {
    movePunct(home, end2, needle);
    endSpace(needle);
  } else if (total === end2) {
    endSpace(home);
    movePunct(home, end2, needle);
    if (document[n3 + 1]) {
      needle[needle.length - 1].post += " ";
    }
  }
  spliceArr(home, ptr[2], needle);
  ptr[4] = needle[needle.length - 1].id;
};

// reducer/node_modules/compromise/src/1-one/change/compute/uuid.js
var index = 0;
var pad3 = (str) => {
  str = str.length < 3 ? "0" + str : str;
  return str.length < 3 ? "0" + str : str;
};
var toId = function(term) {
  let [n3, i3] = term.index || [0, 0];
  index += 1;
  index = index > 46655 ? 0 : index;
  n3 = n3 > 46655 ? 0 : n3;
  i3 = i3 > 1294 ? 0 : i3;
  let id = pad3(index.toString(36));
  id += pad3(n3.toString(36));
  let tx = i3.toString(36);
  tx = tx.length < 2 ? "0" + tx : tx;
  id += tx;
  const r2 = parseInt(Math.random() * 36, 10);
  id += r2.toString(36);
  return term.normal + "|" + id.toUpperCase();
};
var uuid_default = toId;

// reducer/node_modules/compromise/src/1-one/change/api/insert.js
var expand = function(m3) {
  if (m3.has("@hasContraction") && typeof m3.contractions === "function") {
    const more = m3.grow("@hasContraction");
    more.contractions().expand();
  }
};
var isArray4 = (arr) => Object.prototype.toString.call(arr) === "[object Array]";
var addIds = function(terms) {
  terms = terms.map((term) => {
    term.id = uuid_default(term);
    return term;
  });
  return terms;
};
var getTerms = function(input, world2) {
  const { methods: methods17 } = world2;
  if (typeof input === "string") {
    return methods17.one.tokenize.fromString(input, world2)[0];
  }
  if (typeof input === "object" && input.isView) {
    return input.clone().docs[0] || [];
  }
  if (isArray4(input)) {
    return isArray4(input[0]) ? input[0] : input;
  }
  return [];
};
var insert = function(input, view, prepend) {
  const { document, world: world2 } = view;
  view.uncache();
  const ptrs = view.fullPointer;
  const selfPtrs = view.fullPointer;
  view.forEach((m3, i3) => {
    const ptr = m3.fullPointer[0];
    const [n3] = ptr;
    const home = document[n3];
    let terms = getTerms(input, world2);
    if (terms.length === 0) {
      return;
    }
    terms = addIds(terms);
    if (prepend) {
      expand(view.update([ptr]).firstTerm());
      cleanPrepend(home, ptr, terms, document);
    } else {
      expand(view.update([ptr]).lastTerm());
      cleanAppend(home, ptr, terms, document);
    }
    if (document[n3] && document[n3][ptr[1]]) {
      ptr[3] = document[n3][ptr[1]].id;
    }
    selfPtrs[i3] = ptr;
    ptr[2] += terms.length;
    ptrs[i3] = ptr;
  });
  const doc = view.toView(ptrs);
  view.ptrs = selfPtrs;
  doc.compute(["id", "index", "freeze", "lexicon"]);
  if (doc.world.compute.preTagger) {
    doc.compute("preTagger");
  }
  doc.compute("unfreeze");
  return doc;
};
var fns2 = {
  insertAfter: function(input) {
    return insert(input, this, false);
  },
  insertBefore: function(input) {
    return insert(input, this, true);
  }
};
fns2.append = fns2.insertAfter;
fns2.prepend = fns2.insertBefore;
fns2.insert = fns2.insertAfter;
var insert_default = fns2;

// reducer/node_modules/compromise/src/1-one/change/api/replace.js
var dollarStub = /\$[0-9a-z]+/g;
var fns3 = {};
var isTitleCase2 = (str) => /^\p{Lu}[\p{Ll}'’]/u.test(str) || /^\p{Lu}$/u.test(str);
var toTitleCase2 = (str) => str.replace(/^\p{Ll}/u, (x) => x.toUpperCase());
var toLowerCase2 = (str) => str.replace(/^\p{Lu}/u, (x) => x.toLowerCase());
var replaceByFn = function(main, fn, keep9) {
  main.forEach((m3) => {
    const out2 = fn(m3);
    m3.replaceWith(out2, keep9);
  });
  return main;
};
var subDollarSign = function(input, main) {
  if (typeof input !== "string") {
    return input;
  }
  const groups = main.groups();
  input = input.replace(dollarStub, (a2) => {
    const num = a2.replace(/\$/, "");
    if (groups.hasOwnProperty(num)) {
      return groups[num].text();
    }
    return a2;
  });
  return input;
};
fns3.replaceWith = function(input, keep9 = {}) {
  let ptrs = this.fullPointer;
  const main = this;
  this.uncache();
  if (typeof input === "function") {
    return replaceByFn(main, input, keep9);
  }
  const terms = main.docs[0];
  if (!terms) return main;
  const isOriginalPossessive = keep9.possessives && terms[terms.length - 1].tags.has("Possessive");
  const isOriginalTitleCase = keep9.case && isTitleCase2(terms[0].text);
  input = subDollarSign(input, main);
  const original = this.update(ptrs);
  ptrs = ptrs.map((ptr) => ptr.slice(0, 3));
  const oldTags = (original.docs[0] || []).map((term) => Array.from(term.tags));
  const originalPre = original.docs[0][0].pre;
  const originalPost = original.docs[0][original.docs[0].length - 1].post;
  if (typeof input === "string") {
    input = this.fromText(input).compute("id");
  }
  main.insertAfter(input);
  if (original.has("@hasContraction") && main.contractions) {
    const more = main.grow("@hasContraction+");
    more.contractions().expand();
  }
  main.delete(original);
  if (isOriginalPossessive) {
    const tmp = main.docs[0];
    const term = tmp[tmp.length - 1];
    if (!term.tags.has("Possessive")) {
      term.text += "'s";
      term.normal += "'s";
      term.tags.add("Possessive");
    }
  }
  if (originalPre && main.docs[0]) {
    main.docs[0][0].pre = originalPre;
  }
  if (originalPost && main.docs[0]) {
    const lastOne = main.docs[0][main.docs[0].length - 1];
    if (!lastOne.post.trim()) {
      lastOne.post = originalPost;
    }
  }
  const m3 = main.toView(ptrs).compute(["index", "freeze", "lexicon"]);
  if (m3.world.compute.preTagger) {
    m3.compute("preTagger");
  }
  m3.compute("unfreeze");
  if (keep9.tags) {
    m3.terms().forEach((term, i3) => {
      term.tagSafe(oldTags[i3]);
    });
  }
  if (!m3.docs[0] || !m3.docs[0][0]) return m3;
  if (keep9.case) {
    const transformCase = isOriginalTitleCase ? toTitleCase2 : toLowerCase2;
    m3.docs[0][0].text = transformCase(m3.docs[0][0].text);
  }
  return m3;
};
fns3.replace = function(match2, input, keep9) {
  if (match2 && !input) {
    return this.replaceWith(match2, keep9);
  }
  const m3 = this.match(match2);
  if (!m3.found) {
    return this;
  }
  this.soften();
  return m3.replaceWith(input, keep9);
};
var replace_default = fns3;

// reducer/node_modules/compromise/src/1-one/change/api/lib/remove.js
var repairPunct = function(terms, len) {
  const last = terms.length - 1;
  const from = terms[last];
  const to = terms[last - len];
  if (to && from) {
    to.post += from.post;
    to.post = to.post.replace(/ +([.?!,;:])/, "$1");
    to.post = to.post.replace(/[,;:]+([.?!])/, "$1");
  }
};
var pluckOut = function(document, nots) {
  nots.forEach((ptr) => {
    const [n3, start2, end2] = ptr;
    const len = end2 - start2;
    if (!document[n3]) {
      return;
    }
    if (end2 === document[n3].length && end2 > 1) {
      repairPunct(document[n3], len);
    }
    document[n3].splice(start2, len);
  });
  for (let i3 = document.length - 1; i3 >= 0; i3 -= 1) {
    if (document[i3].length === 0) {
      document.splice(i3, 1);
      if (i3 === document.length && document[i3 - 1]) {
        const terms = document[i3 - 1];
        const lastTerm = terms[terms.length - 1];
        if (lastTerm) {
          lastTerm.post = lastTerm.post.trimEnd();
        }
      }
    }
  }
  return document;
};
var remove_default = pluckOut;

// reducer/node_modules/compromise/src/1-one/change/api/remove.js
var fixPointers = function(ptrs, gonePtrs) {
  ptrs = ptrs.map((ptr) => {
    const [n3] = ptr;
    if (!gonePtrs[n3]) {
      return ptr;
    }
    gonePtrs[n3].forEach((no) => {
      const len = no[2] - no[1];
      if (ptr[1] <= no[1] && ptr[2] >= no[2]) {
        ptr[2] -= len;
      }
    });
    return ptr;
  });
  ptrs.forEach((ptr, i3) => {
    if (ptr[1] === 0 && ptr[2] == 0) {
      for (let n3 = i3 + 1; n3 < ptrs.length; n3 += 1) {
        ptrs[n3][0] -= 1;
        if (ptrs[n3][0] < 0) {
          ptrs[n3][0] = 0;
        }
      }
    }
  });
  ptrs = ptrs.filter((ptr) => ptr[2] - ptr[1] > 0);
  ptrs = ptrs.map((ptr) => {
    ptr[3] = null;
    ptr[4] = null;
    return ptr;
  });
  return ptrs;
};
var methods4 = {
  /** */
  remove: function(reg) {
    const { indexN: indexN2 } = this.methods.one.pointer;
    this.uncache();
    let self2 = this.all();
    let not = this;
    if (reg) {
      self2 = this;
      not = this.match(reg);
    }
    const isFull = !self2.ptrs;
    if (not.has("@hasContraction") && not.contractions) {
      const more = not.grow("@hasContraction");
      more.contractions().expand();
    }
    let ptrs = self2.fullPointer;
    const nots = not.fullPointer.reverse();
    const document = remove_default(this.document, nots);
    const gonePtrs = indexN2(nots);
    ptrs = fixPointers(ptrs, gonePtrs);
    self2.ptrs = ptrs;
    self2.document = document;
    self2.compute("index");
    if (isFull) {
      self2.ptrs = void 0;
    }
    if (!reg) {
      this.ptrs = [];
      return self2.none();
    }
    const res = self2.toView(ptrs);
    return res;
  }
};
methods4.delete = methods4.remove;
var remove_default2 = methods4;

// reducer/node_modules/compromise/src/1-one/change/api/whitespace.js
var methods5 = {
  /** add this punctuation or whitespace before each match: */
  pre: function(str, concat) {
    if (str === void 0 && this.found) {
      return this.docs[0][0].pre;
    }
    this.docs.forEach((terms) => {
      const term = terms[0];
      if (concat === true) {
        term.pre += str;
      } else {
        term.pre = str;
      }
    });
    return this;
  },
  /** add this punctuation or whitespace after each match: */
  post: function(str, concat) {
    if (str === void 0) {
      const last = this.docs[this.docs.length - 1];
      return last[last.length - 1].post;
    }
    this.docs.forEach((terms) => {
      const term = terms[terms.length - 1];
      if (concat === true) {
        term.post += str;
      } else {
        term.post = str;
      }
    });
    return this;
  },
  /** remove whitespace from start/end */
  trim: function() {
    if (!this.found) {
      return this;
    }
    const docs = this.docs;
    const start2 = docs[0][0];
    start2.pre = start2.pre.trimStart();
    const last = docs[docs.length - 1];
    const end2 = last[last.length - 1];
    end2.post = end2.post.trimEnd();
    return this;
  },
  /** connect words with hyphen, and remove whitespace */
  hyphenate: function() {
    this.docs.forEach((terms) => {
      terms.forEach((t3, i3) => {
        if (i3 !== 0) {
          t3.pre = "";
        }
        if (terms[i3 + 1]) {
          t3.post = "-";
        }
      });
    });
    return this;
  },
  /** remove hyphens between words, and set whitespace */
  dehyphenate: function() {
    const hasHyphen3 = /[-–—]/;
    this.docs.forEach((terms) => {
      terms.forEach((t3) => {
        if (hasHyphen3.test(t3.post)) {
          t3.post = " ";
        }
      });
    });
    return this;
  },
  /** add quotations around these matches */
  toQuotations: function(start2, end2) {
    start2 = start2 || `"`;
    end2 = end2 || `"`;
    this.docs.forEach((terms) => {
      terms[0].pre = start2 + terms[0].pre;
      const last = terms[terms.length - 1];
      last.post = end2 + last.post;
    });
    return this;
  },
  /** add brackets around these matches */
  toParentheses: function(start2, end2) {
    start2 = start2 || `(`;
    end2 = end2 || `)`;
    this.docs.forEach((terms) => {
      terms[0].pre = start2 + terms[0].pre;
      const last = terms[terms.length - 1];
      last.post = end2 + last.post;
    });
    return this;
  }
};
methods5.deHyphenate = methods5.dehyphenate;
methods5.toQuotation = methods5.toQuotations;
var whitespace_default = methods5;

// reducer/node_modules/compromise/src/1-one/change/api/lib/_sort.js
var alpha = (a2, b) => {
  if (a2.normal < b.normal) {
    return -1;
  }
  if (a2.normal > b.normal) {
    return 1;
  }
  return 0;
};
var length = (a2, b) => {
  const left = a2.normal.trim().length;
  const right = b.normal.trim().length;
  if (left < right) {
    return 1;
  }
  if (left > right) {
    return -1;
  }
  return 0;
};
var wordCount = (a2, b) => {
  if (a2.words < b.words) {
    return 1;
  }
  if (a2.words > b.words) {
    return -1;
  }
  return 0;
};
var sequential = (a2, b) => {
  if (a2[0] < b[0]) {
    return 1;
  }
  if (a2[0] > b[0]) {
    return -1;
  }
  return a2[1] > b[1] ? 1 : -1;
};
var byFreq = function(arr) {
  const counts = {};
  arr.forEach((o2) => {
    counts[o2.normal] = counts[o2.normal] || 0;
    counts[o2.normal] += 1;
  });
  arr.sort((a2, b) => {
    const left = counts[a2.normal];
    const right = counts[b.normal];
    if (left < right) {
      return 1;
    }
    if (left > right) {
      return -1;
    }
    return 0;
  });
  return arr;
};
var sort_default = { alpha, length, wordCount, sequential, byFreq };

// reducer/node_modules/compromise/src/1-one/change/api/sort.js
var seqNames = /* @__PURE__ */ new Set(["index", "sequence", "seq", "sequential", "chron", "chronological"]);
var freqNames = /* @__PURE__ */ new Set(["freq", "frequency", "topk", "repeats"]);
var alphaNames = /* @__PURE__ */ new Set(["alpha", "alphabetical"]);
var customSort = function(view, fn) {
  let ptrs = view.fullPointer;
  ptrs = ptrs.sort((a2, b) => {
    a2 = view.update([a2]);
    b = view.update([b]);
    return fn(a2, b);
  });
  view.ptrs = ptrs;
  return view;
};
var sort = function(input) {
  const { docs, pointer } = this;
  this.uncache();
  if (typeof input === "function") {
    return customSort(this, input);
  }
  input = input || "alpha";
  const ptrs = pointer || docs.map((_d, n3) => [n3]);
  let arr = docs.map((terms, n3) => {
    return {
      index: n3,
      words: terms.length,
      normal: terms.map((t3) => t3.machine || t3.normal || "").join(" "),
      pointer: ptrs[n3]
    };
  });
  if (seqNames.has(input)) {
    input = "sequential";
  }
  if (alphaNames.has(input)) {
    input = "alpha";
  }
  if (freqNames.has(input)) {
    arr = sort_default.byFreq(arr);
    return this.update(arr.map((o2) => o2.pointer));
  }
  if (typeof sort_default[input] === "function") {
    arr = arr.sort(sort_default[input]);
    return this.update(arr.map((o2) => o2.pointer));
  }
  return this;
};
var reverse = function() {
  let ptrs = this.pointer || this.docs.map((_d, n3) => [n3]);
  ptrs = [].concat(ptrs);
  ptrs = ptrs.reverse();
  if (this._cache) {
    this._cache = this._cache.reverse();
  }
  return this.update(ptrs);
};
var unique = function() {
  const already = /* @__PURE__ */ new Set();
  const res = this.filter((m3) => {
    const txt = m3.text("machine");
    if (already.has(txt)) {
      return false;
    }
    already.add(txt);
    return true;
  });
  return res;
};
var sort_default2 = { unique, reverse, sort };

// reducer/node_modules/compromise/src/1-one/change/api/concat.js
var isArray5 = (arr) => Object.prototype.toString.call(arr) === "[object Array]";
var combineDocs = function(homeDocs, inputDocs) {
  if (homeDocs.length > 0) {
    const end2 = homeDocs[homeDocs.length - 1];
    const last = end2[end2.length - 1];
    if (/ /.test(last.post) === false) {
      last.post += " ";
    }
  }
  homeDocs = homeDocs.concat(inputDocs);
  return homeDocs;
};
var combineViews = function(home, input) {
  if (home.document === input.document) {
    const ptrs2 = home.fullPointer.concat(input.fullPointer);
    return home.toView(ptrs2).compute("index");
  }
  const ptrs = input.fullPointer;
  ptrs.forEach((a2) => {
    a2[0] += home.document.length;
  });
  home.document = combineDocs(home.document, input.docs);
  return home.all();
};
var concat_default = {
  // add string as new match/sentence
  concat: function(input) {
    if (typeof input === "string") {
      const more = this.fromText(input);
      if (!this.found || !this.ptrs) {
        this.document = this.document.concat(more.document);
      } else {
        const ptrs = this.fullPointer;
        const at = ptrs[ptrs.length - 1][0];
        this.document.splice(at, 0, ...more.document);
      }
      return this.all().compute("index");
    }
    if (typeof input === "object" && input.isView) {
      return combineViews(this, input);
    }
    if (isArray5(input)) {
      const docs = combineDocs(this.document, input);
      this.document = docs;
      return this.all();
    }
    return this;
  }
};

// reducer/node_modules/compromise/src/1-one/change/api/harden.js
var harden = function() {
  this.ptrs = this.fullPointer;
  return this;
};
var soften = function() {
  let ptr = this.ptrs;
  if (!ptr || ptr.length < 1) {
    return this;
  }
  ptr = ptr.map((a2) => a2.slice(0, 3));
  this.ptrs = ptr;
  return this;
};
var harden_default = { harden, soften };

// reducer/node_modules/compromise/src/1-one/change/api/index.js
var methods6 = Object.assign({}, case_default, insert_default, replace_default, remove_default2, whitespace_default, sort_default2, concat_default, harden_default);
var addAPI2 = function(View2) {
  Object.assign(View2.prototype, methods6);
};
var api_default2 = addAPI2;

// reducer/node_modules/compromise/src/1-one/change/compute/index.js
var compute2 = {
  id: function(view) {
    const docs = view.docs;
    for (let n3 = 0; n3 < docs.length; n3 += 1) {
      for (let i3 = 0; i3 < docs[n3].length; i3 += 1) {
        const term = docs[n3][i3];
        term.id = term.id || uuid_default(term);
      }
    }
  }
};
var compute_default3 = compute2;

// reducer/node_modules/compromise/src/1-one/change/plugin.js
var plugin_default2 = {
  api: api_default2,
  compute: compute_default3
};

// reducer/node_modules/compromise/src/1-one/contraction-one/model/contractions.js
var contractions_default = [
  // simple mappings
  { word: "@", out: ["at"] },
  { word: "arent", out: ["are", "not"] },
  { word: "alot", out: ["a", "lot"] },
  { word: "brb", out: ["be", "right", "back"] },
  { word: "cannot", out: ["can", "not"] },
  { word: "dun", out: ["do", "not"] },
  { word: "can't", out: ["can", "not"] },
  { word: "shan't", out: ["should", "not"] },
  { word: "won't", out: ["will", "not"] },
  { word: "that's", out: ["that", "is"] },
  { word: "what's", out: ["what", "is"] },
  { word: "let's", out: ["let", "us"] },
  // { word: "there's", out: ['there', 'is'] },
  { word: "dunno", out: ["do", "not", "know"] },
  { word: "gonna", out: ["going", "to"] },
  { word: "gotta", out: ["have", "got", "to"] },
  //hmm
  { word: "gimme", out: ["give", "me"] },
  { word: "outta", out: ["out", "of"] },
  { word: "tryna", out: ["trying", "to"] },
  { word: "gtg", out: ["got", "to", "go"] },
  { word: "im", out: ["i", "am"] },
  { word: "imma", out: ["I", "will"] },
  { word: "imo", out: ["in", "my", "opinion"] },
  { word: "irl", out: ["in", "real", "life"] },
  { word: "ive", out: ["i", "have"] },
  { word: "rn", out: ["right", "now"] },
  { word: "tbh", out: ["to", "be", "honest"] },
  { word: "wanna", out: ["want", "to"] },
  { word: `c'mere`, out: ["come", "here"] },
  { word: `c'mon`, out: ["come", "on"] },
  // shoulda, coulda
  { word: "shoulda", out: ["should", "have"] },
  { word: "coulda", out: ["coulda", "have"] },
  { word: "woulda", out: ["woulda", "have"] },
  { word: "musta", out: ["must", "have"] },
  { word: "tis", out: ["it", "is"] },
  { word: "twas", out: ["it", "was"] },
  { word: `y'know`, out: ["you", "know"] },
  { word: "ne'er", out: ["never"] },
  { word: "o'er", out: ["over"] },
  // contraction-part mappings
  { after: "ll", out: ["will"] },
  { after: "ve", out: ["have"] },
  { after: "re", out: ["are"] },
  { after: "m", out: ["am"] },
  // french contractions
  { before: "c", out: ["ce"] },
  { before: "m", out: ["me"] },
  { before: "n", out: ["ne"] },
  { before: "qu", out: ["que"] },
  { before: "s", out: ["se"] },
  { before: "t", out: ["tu"] },
  // t'aime
  // missing apostrophes
  { word: "shouldnt", out: ["should", "not"] },
  { word: "couldnt", out: ["could", "not"] },
  { word: "wouldnt", out: ["would", "not"] },
  { word: "hasnt", out: ["has", "not"] },
  { word: "wasnt", out: ["was", "not"] },
  { word: "isnt", out: ["is", "not"] },
  { word: "cant", out: ["can", "not"] },
  { word: "dont", out: ["do", "not"] },
  { word: "wont", out: ["will", "not"] },
  // apostrophe d
  { word: "howd", out: ["how", "did"] },
  { word: "whatd", out: ["what", "did"] },
  { word: "whend", out: ["when", "did"] },
  { word: "whered", out: ["where", "did"] }
];

// reducer/node_modules/compromise/src/1-one/contraction-one/model/number-suffix.js
var t = true;
var number_suffix_default = {
  "st": t,
  "nd": t,
  "rd": t,
  "th": t,
  "am": t,
  "pm": t,
  "max": t,
  "\xB0": t,
  "s": t,
  // 1990s
  "e": t,
  // 18e - french/spanish ordinal
  "er": t,
  //french 1er
  "\xE8re": t,
  //''
  "\xE8me": t
  //french 2ème
};

// reducer/node_modules/compromise/src/1-one/contraction-one/model/index.js
var model_default = {
  one: {
    contractions: contractions_default,
    numberSuffixes: number_suffix_default
  }
};

// reducer/node_modules/compromise/src/1-one/contraction-one/compute/contractions/_splice.js
var insertContraction = function(document, point, words) {
  const [n3, w] = point;
  if (!words || words.length === 0) {
    return;
  }
  words = words.map((word, i3) => {
    word.implicit = word.text;
    word.machine = word.text;
    word.pre = "";
    word.post = "";
    word.text = "";
    word.normal = "";
    word.index = [n3, w + i3];
    return word;
  });
  if (words[0]) {
    words[0].pre = document[n3][w].pre;
    words[words.length - 1].post = document[n3][w].post;
    words[0].text = document[n3][w].text;
    words[0].normal = document[n3][w].normal;
  }
  document[n3].splice(w, 1, ...words);
};
var splice_default = insertContraction;

// reducer/node_modules/compromise/src/1-one/contraction-one/compute/contractions/apostrophe-d.js
var hasContraction = /'/;
var alwaysDid = /* @__PURE__ */ new Set([
  "what",
  "how",
  "when",
  "where",
  "why"
]);
var useWould = /* @__PURE__ */ new Set([
  "be",
  "go",
  "start",
  "think",
  "need"
]);
var useHad = /* @__PURE__ */ new Set([
  "been",
  "gone"
]);
var _apostropheD = function(terms, i3) {
  const before2 = terms[i3].normal.split(hasContraction)[0];
  if (alwaysDid.has(before2)) {
    return [before2, "did"];
  }
  if (terms[i3 + 1]) {
    if (useHad.has(terms[i3 + 1].normal)) {
      return [before2, "had"];
    }
    if (useWould.has(terms[i3 + 1].normal)) {
      return [before2, "would"];
    }
  }
  return null;
};
var apostrophe_d_default = _apostropheD;

// reducer/node_modules/compromise/src/1-one/contraction-one/compute/contractions/apostrophe-t.js
var apostropheT = function(terms, i3) {
  if (terms[i3].normal === "ain't" || terms[i3].normal === "aint") {
    return null;
  }
  const before2 = terms[i3].normal.replace(/n't/, "");
  return [before2, "not"];
};
var apostrophe_t_default = apostropheT;

// reducer/node_modules/compromise/src/1-one/contraction-one/compute/contractions/french.js
var hasContraction2 = /'/;
var isFeminine = /(e|é|aison|sion|tion)$/;
var isMasculine = /(age|isme|acle|ege|oire)$/;
var preL = (terms, i3) => {
  const after2 = terms[i3].normal.split(hasContraction2)[1];
  if (after2 && after2.endsWith("e")) {
    return ["la", after2];
  }
  return ["le", after2];
};
var preD = (terms, i3) => {
  const after2 = terms[i3].normal.split(hasContraction2)[1];
  if (after2 && isFeminine.test(after2) && !isMasculine.test(after2)) {
    return ["du", after2];
  } else if (after2 && after2.endsWith("s")) {
    return ["des", after2];
  }
  return ["de", after2];
};
var preJ = (terms, i3) => {
  const after2 = terms[i3].normal.split(hasContraction2)[1];
  return ["je", after2];
};
var french_default = {
  preJ,
  preL,
  preD
};

// reducer/node_modules/compromise/src/1-one/contraction-one/compute/contractions/number-range.js
var isRange = /^([0-9.]{1,4}[a-z]{0,2}) ?[-–—] ?([0-9]{1,4}[a-z]{0,2})$/i;
var timeRange = /^([0-9]{1,2}(:[0-9][0-9])?(am|pm)?) ?[-–—] ?([0-9]{1,2}(:[0-9][0-9])?(am|pm)?)$/i;
var phoneNum = /^[0-9]{3}-[0-9]{4}$/;
var numberRange = function(terms, i3) {
  const term = terms[i3];
  let parts = term.text.match(isRange);
  if (parts !== null) {
    if (term.tags.has("PhoneNumber") === true || phoneNum.test(term.text)) {
      return null;
    }
    return [parts[1], "to", parts[2]];
  } else {
    parts = term.text.match(timeRange);
    if (parts !== null) {
      return [parts[1], "to", parts[4]];
    }
  }
  return null;
};
var number_range_default = numberRange;

// reducer/node_modules/compromise/src/1-one/contraction-one/compute/contractions/number-unit.js
var numUnit = /^([+-]?[0-9][.,0-9]*)([a-z°²³µ/]+)$/;
var numberUnit = function(terms, i3, world2) {
  const notUnit = world2.model.one.numberSuffixes || {};
  const term = terms[i3];
  const parts = term.text.match(numUnit);
  if (parts !== null) {
    const unit = parts[2].toLowerCase().trim();
    if (notUnit.hasOwnProperty(unit)) {
      return null;
    }
    return [parts[1], unit];
  }
  return null;
};
var number_unit_default = numberUnit;

// reducer/node_modules/compromise/src/1-one/contraction-one/compute/contractions/index.js
var byApostrophe = /'/;
var numDash = /^[0-9][^-–—]*[-–—].*?[0-9]/;
var reTag = function(terms, view, start2, len) {
  const tmp = view.update();
  tmp.document = [terms];
  let end2 = start2 + len;
  if (start2 > 0) {
    start2 -= 1;
  }
  if (terms[end2]) {
    end2 += 1;
  }
  tmp.ptrs = [[0, start2, end2]];
};
var byEnd = {
  // ain't
  t: (terms, i3) => apostrophe_t_default(terms, i3),
  // how'd
  d: (terms, i3) => apostrophe_d_default(terms, i3)
};
var byStart = {
  // j'aime
  j: (terms, i3) => french_default.preJ(terms, i3),
  // l'amour
  l: (terms, i3) => french_default.preL(terms, i3),
  // d'amerique
  d: (terms, i3) => french_default.preD(terms, i3)
};
var knownOnes = function(list4, term, before2, after2) {
  for (let i3 = 0; i3 < list4.length; i3 += 1) {
    const o2 = list4[i3];
    if (o2.word === term.normal) {
      return o2.out;
    } else if (after2 !== null && after2 === o2.after) {
      return [before2].concat(o2.out);
    } else if (before2 !== null && before2 === o2.before && after2 && after2.length > 2) {
      return o2.out.concat(after2);
    }
  }
  return null;
};
var toDocs = function(words, view) {
  const doc = view.fromText(words.join(" "));
  doc.compute(["id", "alias"]);
  return doc.docs[0];
};
var thereHas = function(terms, i3) {
  for (let k2 = i3 + 1; k2 < 5; k2 += 1) {
    if (!terms[k2]) {
      break;
    }
    if (terms[k2].normal === "been") {
      return ["there", "has"];
    }
  }
  return ["there", "is"];
};
var contractions = (view) => {
  const { world: world2, document } = view;
  const { model: model5, methods: methods17 } = world2;
  const list4 = model5.one.contractions || [];
  document.forEach((terms, n3) => {
    for (let i3 = terms.length - 1; i3 >= 0; i3 -= 1) {
      let before2 = null;
      let after2 = null;
      if (byApostrophe.test(terms[i3].normal) === true) {
        const res = terms[i3].normal.split(byApostrophe);
        before2 = res[0];
        after2 = res[1];
      }
      let words = knownOnes(list4, terms[i3], before2, after2);
      if (!words && byEnd.hasOwnProperty(after2)) {
        words = byEnd[after2](terms, i3, world2);
      }
      if (!words && byStart.hasOwnProperty(before2)) {
        words = byStart[before2](terms, i3);
      }
      if (before2 === "there" && after2 === "s") {
        words = thereHas(terms, i3);
      }
      if (words) {
        words = toDocs(words, view);
        splice_default(document, [n3, i3], words);
        reTag(document[n3], view, i3, words.length);
        continue;
      }
      if (numDash.test(terms[i3].normal)) {
        words = number_range_default(terms, i3);
        if (words) {
          words = toDocs(words, view);
          splice_default(document, [n3, i3], words);
          methods17.one.setTag(words, "NumberRange", world2);
          if (words[2] && words[2].tags.has("Time")) {
            methods17.one.setTag([words[0]], "Time", world2, null, "time-range");
          }
          reTag(document[n3], view, i3, words.length);
        }
        continue;
      }
      words = number_unit_default(terms, i3, world2);
      if (words) {
        words = toDocs(words, view);
        splice_default(document, [n3, i3], words);
        methods17.one.setTag([words[1]], "Unit", world2, null, "contraction-unit");
      }
    }
  });
};
var contractions_default2 = contractions;

// reducer/node_modules/compromise/src/1-one/contraction-one/compute/index.js
var compute_default4 = { contractions: contractions_default2 };

// reducer/node_modules/compromise/src/1-one/contraction-one/plugin.js
var plugin = {
  model: model_default,
  compute: compute_default4,
  hooks: ["contractions"]
};
var plugin_default3 = plugin;

// reducer/node_modules/compromise/src/1-one/freeze/compute.js
var freeze = function(view) {
  const world2 = view.world;
  const { model: model5, methods: methods17 } = view.world;
  const setTag2 = methods17.one.setTag;
  const { frozenLex } = model5.one;
  const multi = model5.one._multiCache || {};
  view.docs.forEach((terms) => {
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const t3 = terms[i3];
      const word = t3.machine || t3.normal;
      if (multi[word] !== void 0 && terms[i3 + 1]) {
        const end2 = i3 + multi[word] - 1;
        for (let k2 = end2; k2 > i3; k2 -= 1) {
          const words = terms.slice(i3, k2 + 1);
          const str = words.map((term) => term.machine || term.normal).join(" ");
          if (frozenLex.hasOwnProperty(str) === true) {
            setTag2(words, frozenLex[str], world2, false, "1-frozen-multi-lexicon");
            words.forEach((term) => term.frozen = true);
            continue;
          }
        }
      }
      if (frozenLex[word] !== void 0 && frozenLex.hasOwnProperty(word)) {
        setTag2([t3], frozenLex[word], world2, false, "1-freeze-lexicon");
        t3.frozen = true;
        continue;
      }
    }
  });
};
var unfreeze = function(view) {
  view.docs.forEach((ts) => {
    ts.forEach((term) => {
      delete term.frozen;
    });
  });
  return view;
};
var compute_default5 = { frozen: freeze, freeze, unfreeze };

// reducer/node_modules/compromise/src/1-one/freeze/debug.js
var blue = (str) => "\x1B[34m" + str + "\x1B[0m";
var dim = (str) => "\x1B[3m\x1B[2m" + str + "\x1B[0m";
var debug = function(view) {
  view.docs.forEach((terms) => {
    console.log(blue("\n  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
    terms.forEach((t3) => {
      let str = `  ${dim("\u2502")}  `;
      const txt = t3.implicit || t3.text || "-";
      if (t3.frozen === true) {
        str += `${blue(txt)} \u2744\uFE0F`;
      } else {
        str += dim(txt);
      }
      console.log(str);
    });
  });
};
var debug_default = debug;

// reducer/node_modules/compromise/src/1-one/freeze/plugin.js
var plugin_default4 = {
  // add .compute('freeze')
  compute: compute_default5,
  mutate: (world2) => {
    const methods17 = world2.methods.one;
    methods17.termMethods.isFrozen = (term) => term.frozen === true;
    methods17.debug.freeze = debug_default;
    methods17.debug.frozen = debug_default;
  },
  api: function(View2) {
    View2.prototype.freeze = function() {
      this.docs.forEach((ts) => {
        ts.forEach((term) => {
          term.frozen = true;
        });
      });
      return this;
    };
    View2.prototype.unfreeze = function() {
      this.compute("unfreeze");
    };
    View2.prototype.isFrozen = function() {
      return this.match("@isFrozen+");
    };
  },
  // run it in init
  hooks: ["freeze"]
};

// reducer/node_modules/compromise/src/1-one/lexicon/compute/multi-word.js
var multiWord = function(terms, start_i, world2) {
  const { model: model5, methods: methods17 } = world2;
  const setTag2 = methods17.one.setTag;
  const multi = model5.one._multiCache || {};
  const { lexicon: lexicon4 } = model5.one || {};
  const t3 = terms[start_i];
  const word = t3.machine || t3.normal;
  if (multi[word] !== void 0 && terms[start_i + 1]) {
    const end2 = start_i + multi[word] - 1;
    for (let i3 = end2; i3 > start_i; i3 -= 1) {
      const words = terms.slice(start_i, i3 + 1);
      if (words.length <= 1) {
        return false;
      }
      const str = words.map((term) => term.machine || term.normal).join(" ");
      if (lexicon4.hasOwnProperty(str) === true) {
        const tag = lexicon4[str];
        setTag2(words, tag, world2, false, "1-multi-lexicon");
        if (tag && tag.length === 2 && (tag[0] === "PhrasalVerb" || tag[1] === "PhrasalVerb")) {
          setTag2([words[1]], "Particle", world2, false, "1-phrasal-particle");
        }
        return true;
      }
    }
    return false;
  }
  return null;
};
var multi_word_default = multiWord;

// reducer/node_modules/compromise/src/1-one/lexicon/compute/single-word.js
var prefix = /^(under|over|mis|re|un|dis|semi|pre|post)-?/;
var allowPrefix = /* @__PURE__ */ new Set(["Verb", "Infinitive", "PastTense", "Gerund", "PresentTense", "Adjective", "Participle"]);
var checkLexicon = function(terms, i3, world2) {
  const { model: model5, methods: methods17 } = world2;
  const setTag2 = methods17.one.setTag;
  const { lexicon: lexicon4 } = model5.one;
  const t3 = terms[i3];
  const word = t3.machine || t3.normal;
  if (lexicon4[word] !== void 0 && lexicon4.hasOwnProperty(word)) {
    setTag2([t3], lexicon4[word], world2, false, "1-lexicon");
    return true;
  }
  if (t3.alias) {
    const found = t3.alias.find((str) => lexicon4.hasOwnProperty(str));
    if (found) {
      setTag2([t3], lexicon4[found], world2, false, "1-lexicon-alias");
      return true;
    }
  }
  if (prefix.test(word) === true) {
    const stem = word.replace(prefix, "");
    if (lexicon4.hasOwnProperty(stem) && stem.length > 3) {
      if (allowPrefix.has(lexicon4[stem])) {
        setTag2([t3], lexicon4[stem], world2, false, "1-lexicon-prefix");
        return true;
      }
    }
  }
  return null;
};
var single_word_default = checkLexicon;

// reducer/node_modules/compromise/src/1-one/lexicon/compute/index.js
var lexicon = function(view) {
  const world2 = view.world;
  view.docs.forEach((terms) => {
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      if (terms[i3].tags.size === 0) {
        let found = null;
        found = found || multi_word_default(terms, i3, world2);
        found = found || single_word_default(terms, i3, world2);
      }
    }
  });
};
var compute_default6 = {
  lexicon
};

// reducer/node_modules/compromise/src/1-one/lexicon/methods/expand.js
var expand2 = function(words) {
  const lex = {};
  const _multi = {};
  Object.keys(words).forEach((word) => {
    const tag = words[word];
    word = word.toLowerCase().trim();
    word = word.replace(/'s\b/, "");
    const split3 = word.split(/ /);
    if (split3.length > 1) {
      if (_multi[split3[0]] === void 0 || split3.length > _multi[split3[0]]) {
        _multi[split3[0]] = split3.length;
      }
    }
    lex[word] = lex[word] || tag;
  });
  delete lex[""];
  delete lex[null];
  delete lex[" "];
  return { lex, _multi };
};
var expand_default = expand2;

// reducer/node_modules/compromise/src/1-one/lexicon/methods/index.js
var methods_default3 = {
  one: {
    expandLexicon: expand_default
  }
};

// reducer/node_modules/compromise/src/1-one/lexicon/lib.js
var addWords = function(words, isFrozen = false) {
  const world2 = this.world();
  const { methods: methods17, model: model5 } = world2;
  if (!words) {
    return;
  }
  Object.keys(words).forEach((k2) => {
    if (typeof words[k2] === "string" && words[k2].startsWith("#")) {
      words[k2] = words[k2].replace(/^#/, "");
    }
  });
  if (isFrozen === true) {
    const { lex: lex2, _multi: _multi2 } = methods17.one.expandLexicon(words, world2);
    Object.assign(model5.one._multiCache, _multi2);
    Object.assign(model5.one.frozenLex, lex2);
    return;
  }
  if (methods17.two.expandLexicon) {
    const { lex: lex2, _multi: _multi2 } = methods17.two.expandLexicon(words, world2);
    Object.assign(model5.one.lexicon, lex2);
    Object.assign(model5.one._multiCache, _multi2);
  }
  const { lex, _multi } = methods17.one.expandLexicon(words, world2);
  Object.assign(model5.one.lexicon, lex);
  Object.assign(model5.one._multiCache, _multi);
};
var lib_default = { addWords };

// reducer/node_modules/compromise/src/1-one/lexicon/plugin.js
var model2 = {
  one: {
    lexicon: {},
    //setup blank lexicon
    _multiCache: {},
    frozenLex: {}
    //2nd lexicon
  }
};
var plugin_default5 = {
  model: model2,
  methods: methods_default3,
  compute: compute_default6,
  lib: lib_default,
  hooks: ["lexicon"]
};

// reducer/node_modules/compromise/src/1-one/lookup/api/buildTrie/index.js
var tokenize = function(phrase, world2) {
  const { methods: methods17, model: model5 } = world2;
  const terms = methods17.one.tokenize.splitTerms(phrase, model5).map((t3) => methods17.one.tokenize.splitWhitespace(t3, model5));
  return terms.map((term) => term.text.toLowerCase());
};
var buildTrie = function(phrases, world2) {
  const goNext = [{}];
  const endAs = [null];
  const failTo = [0];
  const xs = [];
  let n3 = 0;
  phrases.forEach(function(phrase) {
    let curr = 0;
    const words = tokenize(phrase, world2);
    for (let i3 = 0; i3 < words.length; i3++) {
      const word = words[i3];
      if (goNext[curr] && goNext[curr].hasOwnProperty(word)) {
        curr = goNext[curr][word];
      } else {
        n3++;
        goNext[curr][word] = n3;
        goNext[n3] = {};
        curr = n3;
        endAs[n3] = null;
      }
    }
    endAs[curr] = [words.length];
  });
  for (const word in goNext[0]) {
    n3 = goNext[0][word];
    failTo[n3] = 0;
    xs.push(n3);
  }
  while (xs.length) {
    const r2 = xs.shift();
    const keys = Object.keys(goNext[r2]);
    for (let i3 = 0; i3 < keys.length; i3 += 1) {
      const word = keys[i3];
      const s3 = goNext[r2][word];
      xs.push(s3);
      n3 = failTo[r2];
      while (n3 > 0 && !goNext[n3].hasOwnProperty(word)) {
        n3 = failTo[n3];
      }
      if (goNext.hasOwnProperty(n3)) {
        const fs = goNext[n3][word];
        failTo[s3] = fs;
        if (endAs[fs]) {
          endAs[s3] = endAs[s3] || [];
          endAs[s3] = endAs[s3].concat(endAs[fs]);
        }
      } else {
        failTo[s3] = 0;
      }
    }
  }
  return { goNext, endAs, failTo };
};
var buildTrie_default = buildTrie;

// reducer/node_modules/compromise/src/1-one/lookup/api/scan.js
var scanWords = function(terms, trie, opts2) {
  let n3 = 0;
  const results = [];
  for (let i3 = 0; i3 < terms.length; i3++) {
    const word = terms[i3][opts2.form] || terms[i3].normal;
    while (n3 > 0 && (trie.goNext[n3] === void 0 || !trie.goNext[n3].hasOwnProperty(word))) {
      n3 = trie.failTo[n3] || 0;
    }
    if (!trie.goNext[n3].hasOwnProperty(word)) {
      continue;
    }
    n3 = trie.goNext[n3][word];
    if (trie.endAs[n3]) {
      const arr = trie.endAs[n3];
      for (let o2 = 0; o2 < arr.length; o2++) {
        const len = arr[o2];
        const term = terms[i3 - len + 1];
        const [no, start2] = term.index;
        results.push([no, start2, start2 + len, term.id]);
      }
    }
  }
  return results;
};
var cacheMiss = function(words, cache2) {
  for (let i3 = 0; i3 < words.length; i3 += 1) {
    if (cache2.has(words[i3]) === true) {
      return false;
    }
  }
  return true;
};
var scan = function(view, trie, opts2) {
  let results = [];
  opts2.form = opts2.form || "normal";
  const docs = view.docs;
  if (!trie.goNext || !trie.goNext[0]) {
    console.error("Compromise invalid lookup trie");
    return view.none();
  }
  const firstWords = Object.keys(trie.goNext[0]);
  for (let i3 = 0; i3 < docs.length; i3++) {
    if (view._cache && view._cache[i3] && cacheMiss(firstWords, view._cache[i3]) === true) {
      continue;
    }
    const terms = docs[i3];
    const found = scanWords(terms, trie, opts2);
    if (found.length > 0) {
      results = results.concat(found);
    }
  }
  return view.update(results);
};
var scan_default = scan;

// reducer/node_modules/compromise/src/1-one/lookup/api/index.js
var isObject3 = (val) => {
  return Object.prototype.toString.call(val) === "[object Object]";
};
function api_default3(View2) {
  View2.prototype.lookup = function(input, opts2 = {}) {
    if (!input) {
      return this.none();
    }
    if (typeof input === "string") {
      input = [input];
    }
    const trie = isObject3(input) ? input : buildTrie_default(input, this.world);
    let res = scan_default(this, trie, opts2);
    res = res.settle();
    return res;
  };
}

// reducer/node_modules/compromise/src/1-one/lookup/api/buildTrie/compress.js
var truncate = (list4, val) => {
  for (let i3 = list4.length - 1; i3 >= 0; i3 -= 1) {
    if (list4[i3] !== val) {
      list4 = list4.slice(0, i3 + 1);
      return list4;
    }
  }
  return list4;
};
var compress = function(trie) {
  trie.goNext = trie.goNext.map((o2) => {
    if (Object.keys(o2).length === 0) {
      return void 0;
    }
    return o2;
  });
  trie.goNext = truncate(trie.goNext, void 0);
  trie.failTo = truncate(trie.failTo, 0);
  trie.endAs = truncate(trie.endAs, null);
  return trie;
};
var compress_default = compress;

// reducer/node_modules/compromise/src/1-one/lookup/plugin.js
var lib = {
  /** turn an array or object into a compressed trie*/
  buildTrie: function(input) {
    const trie = buildTrie_default(input, this.world());
    return compress_default(trie);
  }
};
lib.compile = lib.buildTrie;
var plugin_default6 = {
  api: api_default3,
  lib
};

// reducer/node_modules/compromise/src/1-one/match/api/_lib.js
var relPointer = function(ptrs, parent) {
  if (!parent) {
    return ptrs;
  }
  ptrs.forEach((ptr) => {
    const n3 = ptr[0];
    if (parent[n3]) {
      ptr[0] = parent[n3][0];
      ptr[1] += parent[n3][1];
      ptr[2] += parent[n3][1];
    }
  });
  return ptrs;
};
var fixPointers2 = function(res, parent) {
  let { ptrs } = res;
  const { byGroup } = res;
  ptrs = relPointer(ptrs, parent);
  Object.keys(byGroup).forEach((k2) => {
    byGroup[k2] = relPointer(byGroup[k2], parent);
  });
  return { ptrs, byGroup };
};
var parseRegs = function(regs, opts2, world2) {
  const one = world2.methods.one;
  if (typeof regs === "number") {
    regs = String(regs);
  }
  if (typeof regs === "string") {
    regs = one.killUnicode(regs, world2);
    regs = one.parseMatch(regs, opts2, world2);
  }
  return regs;
};
var isObject4 = (val) => {
  return Object.prototype.toString.call(val) === "[object Object]";
};
var isView = (val) => val && isObject4(val) && val.isView === true;
var isNet = (val) => val && isObject4(val) && val.isNet === true;

// reducer/node_modules/compromise/src/1-one/match/api/match.js
var match = function(regs, group, opts2) {
  const one = this.methods.one;
  if (isView(regs)) {
    return this.intersection(regs);
  }
  if (isNet(regs)) {
    return this.sweep(regs, { tagger: false }).view.settle();
  }
  regs = parseRegs(regs, opts2, this.world);
  const todo = { regs, group };
  const res = one.match(this.docs, todo, this._cache);
  const { ptrs, byGroup } = fixPointers2(res, this.fullPointer);
  const view = this.toView(ptrs);
  view._groups = byGroup;
  return view;
};
var matchOne = function(regs, group, opts2) {
  const one = this.methods.one;
  if (isView(regs)) {
    return this.intersection(regs).eq(0);
  }
  if (isNet(regs)) {
    return this.sweep(regs, { tagger: false, matchOne: true }).view;
  }
  regs = parseRegs(regs, opts2, this.world);
  const todo = { regs, group, justOne: true };
  const res = one.match(this.docs, todo, this._cache);
  const { ptrs, byGroup } = fixPointers2(res, this.fullPointer);
  const view = this.toView(ptrs);
  view._groups = byGroup;
  return view;
};
var has = function(regs, group, opts2) {
  const one = this.methods.one;
  if (isView(regs)) {
    const ptrs2 = this.intersection(regs).fullPointer;
    return ptrs2.length > 0;
  }
  if (isNet(regs)) {
    return this.sweep(regs, { tagger: false }).view.found;
  }
  regs = parseRegs(regs, opts2, this.world);
  const todo = { regs, group, justOne: true };
  const ptrs = one.match(this.docs, todo, this._cache).ptrs;
  return ptrs.length > 0;
};
var ifFn = function(regs, group, opts2) {
  const one = this.methods.one;
  if (isView(regs)) {
    return this.filter((m3) => m3.intersection(regs).found);
  }
  if (isNet(regs)) {
    const m3 = this.sweep(regs, { tagger: false }).view.settle();
    return this.if(m3);
  }
  regs = parseRegs(regs, opts2, this.world);
  const todo = { regs, group, justOne: true };
  let ptrs = this.fullPointer;
  const cache2 = this._cache || [];
  ptrs = ptrs.filter((ptr, i3) => {
    const m3 = this.update([ptr]);
    const res = one.match(m3.docs, todo, cache2[i3]).ptrs;
    return res.length > 0;
  });
  const view = this.update(ptrs);
  if (this._cache) {
    view._cache = ptrs.map((ptr) => cache2[ptr[0]]);
  }
  return view;
};
var ifNo = function(regs, group, opts2) {
  const { methods: methods17 } = this;
  const one = methods17.one;
  if (isView(regs)) {
    return this.filter((m3) => !m3.intersection(regs).found);
  }
  if (isNet(regs)) {
    const m3 = this.sweep(regs, { tagger: false }).view.settle();
    return this.ifNo(m3);
  }
  regs = parseRegs(regs, opts2, this.world);
  const cache2 = this._cache || [];
  const view = this.filter((m3, i3) => {
    const todo = { regs, group, justOne: true };
    const ptrs = one.match(m3.docs, todo, cache2[i3]).ptrs;
    return ptrs.length === 0;
  });
  if (this._cache) {
    view._cache = view.ptrs.map((ptr) => cache2[ptr[0]]);
  }
  return view;
};
var match_default = { matchOne, match, has, if: ifFn, ifNo };

// reducer/node_modules/compromise/src/1-one/match/api/lookaround.js
var before = function(regs, group, opts2) {
  const { indexN: indexN2 } = this.methods.one.pointer;
  const pre = [];
  const byN = indexN2(this.fullPointer);
  Object.keys(byN).forEach((k2) => {
    const first = byN[k2].sort((a2, b) => a2[1] > b[1] ? 1 : -1)[0];
    if (first[1] > 0) {
      pre.push([first[0], 0, first[1]]);
    }
  });
  const preWords = this.toView(pre);
  if (!regs) {
    return preWords;
  }
  return preWords.match(regs, group, opts2);
};
var after = function(regs, group, opts2) {
  const { indexN: indexN2 } = this.methods.one.pointer;
  const post = [];
  const byN = indexN2(this.fullPointer);
  const document = this.document;
  Object.keys(byN).forEach((k2) => {
    const last = byN[k2].sort((a2, b) => a2[1] > b[1] ? -1 : 1)[0];
    const [n3, , end2] = last;
    if (end2 < document[n3].length) {
      post.push([n3, end2, document[n3].length]);
    }
  });
  const postWords = this.toView(post);
  if (!regs) {
    return postWords;
  }
  return postWords.match(regs, group, opts2);
};
var growLeft = function(regs, group, opts2) {
  if (typeof regs === "string") {
    regs = this.world.methods.one.parseMatch(regs, opts2, this.world);
  }
  regs[regs.length - 1].end = true;
  const ptrs = this.fullPointer;
  this.forEach((m3, n3) => {
    const more = m3.before(regs, group);
    if (more.found) {
      const terms = more.terms();
      ptrs[n3][1] -= terms.length;
      ptrs[n3][3] = terms.docs[0][0].id;
    }
  });
  return this.update(ptrs);
};
var growRight = function(regs, group, opts2) {
  if (typeof regs === "string") {
    regs = this.world.methods.one.parseMatch(regs, opts2, this.world);
  }
  regs[0].start = true;
  const ptrs = this.fullPointer;
  this.forEach((m3, n3) => {
    const more = m3.after(regs, group);
    if (more.found) {
      const terms = more.terms();
      ptrs[n3][2] += terms.length;
      ptrs[n3][4] = null;
    }
  });
  return this.update(ptrs);
};
var grow = function(regs, group, opts2) {
  return this.growRight(regs, group, opts2).growLeft(regs, group, opts2);
};
var lookaround_default = { before, after, growLeft, growRight, grow };

// reducer/node_modules/compromise/src/1-one/match/api/split.js
var combine = function(left, right) {
  return [left[0], left[1], right[2]];
};
var isArray6 = function(arr) {
  return Object.prototype.toString.call(arr) === "[object Array]";
};
var getDoc = (reg, view, group) => {
  if (typeof reg === "string" || isArray6(reg)) {
    return view.match(reg, group);
  }
  if (!reg) {
    return view.none();
  }
  return reg;
};
var addIds2 = function(ptr, view) {
  const [n3, start2, end2] = ptr;
  if (view.document[n3] && view.document[n3][start2]) {
    ptr[3] = ptr[3] || view.document[n3][start2].id;
    if (view.document[n3][end2 - 1]) {
      ptr[4] = ptr[4] || view.document[n3][end2 - 1].id;
    }
  }
  return ptr;
};
var methods7 = {};
methods7.splitOn = function(m3, group) {
  const { splitAll: splitAll2 } = this.methods.one.pointer;
  const splits = getDoc(m3, this, group).fullPointer;
  const all4 = splitAll2(this.fullPointer, splits);
  let res = [];
  all4.forEach((o2) => {
    res.push(o2.passthrough);
    res.push(o2.before);
    res.push(o2.match);
    res.push(o2.after);
  });
  res = res.filter((p5) => p5);
  res = res.map((p5) => addIds2(p5, this));
  return this.update(res);
};
methods7.splitBefore = function(m3, group) {
  const { splitAll: splitAll2 } = this.methods.one.pointer;
  const splits = getDoc(m3, this, group).fullPointer;
  const all4 = splitAll2(this.fullPointer, splits);
  for (let i3 = 0; i3 < all4.length; i3 += 1) {
    if (!all4[i3].after && all4[i3 + 1] && all4[i3 + 1].before) {
      if (all4[i3].match && all4[i3].match[0] === all4[i3 + 1].before[0]) {
        all4[i3].after = all4[i3 + 1].before;
        delete all4[i3 + 1].before;
      }
    }
  }
  let res = [];
  all4.forEach((o2) => {
    res.push(o2.passthrough);
    res.push(o2.before);
    if (o2.match && o2.after) {
      res.push(combine(o2.match, o2.after));
    } else {
      res.push(o2.match);
    }
  });
  res = res.filter((p5) => p5);
  res = res.map((p5) => addIds2(p5, this));
  return this.update(res);
};
methods7.splitAfter = function(m3, group) {
  const { splitAll: splitAll2 } = this.methods.one.pointer;
  const splits = getDoc(m3, this, group).fullPointer;
  const all4 = splitAll2(this.fullPointer, splits);
  let res = [];
  all4.forEach((o2) => {
    res.push(o2.passthrough);
    if (o2.before && o2.match) {
      res.push(combine(o2.before, o2.match));
    } else {
      res.push(o2.before);
      res.push(o2.match);
    }
    res.push(o2.after);
  });
  res = res.filter((p5) => p5);
  res = res.map((p5) => addIds2(p5, this));
  return this.update(res);
};
methods7.split = methods7.splitAfter;
var split_default = methods7;

// reducer/node_modules/compromise/src/1-one/match/api/join.js
var isNeighbour = function(ptrL, ptrR) {
  if (!ptrL || !ptrR) {
    return false;
  }
  if (ptrL[0] !== ptrR[0]) {
    return false;
  }
  return ptrL[2] === ptrR[1];
};
var mergeIf = function(doc, lMatch, rMatch) {
  const world2 = doc.world;
  const parseMatch = world2.methods.one.parseMatch;
  lMatch = lMatch || ".$";
  rMatch = rMatch || "^.";
  const leftMatch = parseMatch(lMatch, {}, world2);
  const rightMatch = parseMatch(rMatch, {}, world2);
  leftMatch[leftMatch.length - 1].end = true;
  rightMatch[0].start = true;
  const ptrs = doc.fullPointer;
  const res = [ptrs[0]];
  for (let i3 = 1; i3 < ptrs.length; i3 += 1) {
    const ptrL = res[res.length - 1];
    const ptrR = ptrs[i3];
    const left = doc.update([ptrL]);
    const right = doc.update([ptrR]);
    if (isNeighbour(ptrL, ptrR) && left.has(leftMatch) && right.has(rightMatch)) {
      res[res.length - 1] = [ptrL[0], ptrL[1], ptrR[2], ptrL[3], ptrR[4]];
    } else {
      res.push(ptrR);
    }
  }
  return doc.update(res);
};
var methods8 = {
  //  merge only if conditions are met
  joinIf: function(lMatch, rMatch) {
    return mergeIf(this, lMatch, rMatch);
  },
  // merge all neighbouring matches
  join: function() {
    return mergeIf(this);
  }
};
var join_default = methods8;

// reducer/node_modules/compromise/src/1-one/match/api/index.js
var methods9 = Object.assign({}, match_default, lookaround_default, split_default, join_default);
methods9.lookBehind = methods9.before;
methods9.lookBefore = methods9.before;
methods9.lookAhead = methods9.after;
methods9.lookAfter = methods9.after;
methods9.notIf = methods9.ifNo;
var matchAPI = function(View2) {
  Object.assign(View2.prototype, methods9);
};
var api_default4 = matchAPI;

// reducer/node_modules/compromise/src/1-one/match/methods/parseMatch/01-parseBlocks.js
var bySlashes = /(?:^|\s)([![^]*(?:<[^<]*>)?\/.*?[^\\/]\/[?\]+*$~]*)(?:\s|$)/;
var byParentheses = /([!~[^]*(?:<[^<]*>)?\([^)]+[^\\)]\)[?\]+*$~]*)(?:\s|$)/;
var byWord = / /g;
var isBlock = (str) => {
  return /^[![^]*(<[^<]*>)?\(/.test(str) && /\)[?\]+*$~]*$/.test(str);
};
var isReg = (str) => {
  return /^[![^]*(<[^<]*>)?\//.test(str) && /\/[?\]+*$~]*$/.test(str);
};
var cleanUp = function(arr) {
  arr = arr.map((str) => str.trim());
  arr = arr.filter((str) => str);
  return arr;
};
var parseBlocks = function(txt) {
  const arr = txt.split(bySlashes);
  let res = [];
  arr.forEach((str) => {
    if (isReg(str)) {
      res.push(str);
      return;
    }
    res = res.concat(str.split(byParentheses));
  });
  res = cleanUp(res);
  let final = [];
  res.forEach((str) => {
    if (isBlock(str)) {
      final.push(str);
    } else if (isReg(str)) {
      final.push(str);
    } else {
      final = final.concat(str.split(byWord));
    }
  });
  final = cleanUp(final);
  return final;
};
var parseBlocks_default = parseBlocks;

// reducer/node_modules/compromise/src/1-one/match/methods/parseMatch/02-parseToken.js
var hasMinMax = /\{([0-9]+)?(, *[0-9]*)?\}/;
var andSign = /&&/;
var captureName = new RegExp(/^<\s*(\S+)\s*>/);
var titleCase = (str) => str.charAt(0).toUpperCase() + str.substring(1);
var end = (str) => str.charAt(str.length - 1);
var start = (str) => str.charAt(0);
var stripStart = (str) => str.substring(1);
var stripEnd = (str) => str.substring(0, str.length - 1);
var stripBoth = function(str) {
  str = stripStart(str);
  str = stripEnd(str);
  return str;
};
var parseToken = function(w, opts2) {
  const obj = {};
  for (let i3 = 0; i3 < 2; i3 += 1) {
    if (end(w) === "$") {
      obj.end = true;
      w = stripEnd(w);
    }
    if (start(w) === "^") {
      obj.start = true;
      w = stripStart(w);
    }
    if (end(w) === "?") {
      obj.optional = true;
      w = stripEnd(w);
    }
    if (start(w) === "[" || end(w) === "]") {
      obj.group = null;
      if (start(w) === "[") {
        obj.groupStart = true;
      }
      if (end(w) === "]") {
        obj.groupEnd = true;
      }
      w = w.replace(/^\[/, "");
      w = w.replace(/\]$/, "");
      if (start(w) === "<") {
        const res = captureName.exec(w);
        if (res.length >= 2) {
          obj.group = res[1];
          w = w.replace(res[0], "");
        }
      }
    }
    if (end(w) === "+") {
      obj.greedy = true;
      w = stripEnd(w);
    }
    if (w !== "*" && end(w) === "*" && w !== "\\*") {
      obj.greedy = true;
      w = stripEnd(w);
    }
    if (start(w) === "!") {
      obj.negative = true;
      w = stripStart(w);
    }
    if (start(w) === "~" && end(w) === "~" && w.length > 2) {
      w = stripBoth(w);
      obj.fuzzy = true;
      obj.min = opts2.fuzzy || 0.85;
      if (/\(/.test(w) === false) {
        obj.word = w;
        return obj;
      }
    }
    if (start(w) === "/" && end(w) === "/") {
      w = stripBoth(w);
      if (opts2.caseSensitive) {
        obj.use = "text";
      }
      obj.regex = new RegExp(w);
      return obj;
    }
    if (hasMinMax.test(w) === true) {
      w = w.replace(hasMinMax, (_a, b, c2) => {
        if (c2 === void 0) {
          obj.min = Number(b);
          obj.max = Number(b);
        } else {
          c2 = c2.replace(/, */, "");
          if (b === void 0) {
            obj.min = 0;
            obj.max = Number(c2);
          } else {
            obj.min = Number(b);
            obj.max = Number(c2 || 999);
          }
        }
        obj.greedy = true;
        if (!obj.min) {
          obj.optional = true;
        }
        return "";
      });
    }
    if (start(w) === "(" && end(w) === ")") {
      if (andSign.test(w)) {
        obj.choices = w.split(andSign);
        obj.operator = "and";
      } else {
        obj.choices = w.split("|");
        obj.operator = "or";
      }
      obj.choices[0] = stripStart(obj.choices[0]);
      const last = obj.choices.length - 1;
      obj.choices[last] = stripEnd(obj.choices[last]);
      obj.choices = obj.choices.map((s3) => s3.trim());
      obj.choices = obj.choices.filter((s3) => s3);
      obj.choices = obj.choices.map((str) => {
        return str.split(/ /g).map((s3) => parseToken(s3, opts2));
      });
      w = "";
    }
    if (start(w) === "{" && end(w) === "}") {
      w = stripBoth(w);
      obj.root = w;
      if (/\//.test(w)) {
        const split3 = obj.root.split(/\//);
        obj.root = split3[0];
        obj.pos = split3[1];
        if (obj.pos === "adj") {
          obj.pos = "Adjective";
        }
        obj.pos = obj.pos.charAt(0).toUpperCase() + obj.pos.substr(1).toLowerCase();
        if (split3[2] !== void 0) {
          obj.sense = split3[2];
        }
      }
      return obj;
    }
    if (start(w) === "<" && end(w) === ">") {
      w = stripBoth(w);
      obj.chunk = titleCase(w);
      obj.greedy = true;
      return obj;
    }
    if (start(w) === "%" && end(w) === "%") {
      w = stripBoth(w);
      obj.switch = w;
      return obj;
    }
  }
  if (start(w) === "#") {
    obj.tag = stripStart(w);
    obj.tag = titleCase(obj.tag);
    return obj;
  }
  if (start(w) === "@") {
    obj.method = stripStart(w);
    return obj;
  }
  if (w === ".") {
    obj.anything = true;
    return obj;
  }
  if (w === "*") {
    obj.anything = true;
    obj.greedy = true;
    obj.optional = true;
    return obj;
  }
  if (w) {
    w = w.replace("\\*", "*");
    w = w.replace("\\.", ".");
    if (opts2.caseSensitive) {
      obj.use = "text";
    } else {
      w = w.toLowerCase();
    }
    obj.word = w;
  }
  return obj;
};
var parseToken_default = parseToken;

// reducer/node_modules/compromise/src/1-one/match/methods/parseMatch/03-splitHyphens.js
var hasDash = /[a-z0-9][-–—][a-z]/i;
var splitHyphens = function(regs, world2) {
  const prefixes2 = world2.model.one.prefixes;
  for (let i3 = regs.length - 1; i3 >= 0; i3 -= 1) {
    const reg = regs[i3];
    if (reg.word && hasDash.test(reg.word)) {
      let words = reg.word.split(/[-–—]/g);
      if (prefixes2.hasOwnProperty(words[0])) {
        continue;
      }
      words = words.filter((w) => w).reverse();
      regs.splice(i3, 1);
      words.forEach((w) => {
        const obj = Object.assign({}, reg);
        obj.word = w;
        regs.splice(i3, 0, obj);
      });
    }
  }
  return regs;
};
var splitHyphens_default = splitHyphens;

// reducer/node_modules/compromise/src/1-one/match/methods/parseMatch/04-inflect-root.js
var addVerbs = function(token, world2) {
  const { all: all4 } = world2.methods.two.transform.verb || {};
  const str = token.root;
  if (!all4) {
    return [];
  }
  return all4(str, world2.model);
};
var addNoun = function(token, world2) {
  const { all: all4 } = world2.methods.two.transform.noun || {};
  if (!all4) {
    return [token.root];
  }
  return all4(token.root, world2.model);
};
var addAdjective = function(token, world2) {
  const { all: all4 } = world2.methods.two.transform.adjective || {};
  if (!all4) {
    return [token.root];
  }
  return all4(token.root, world2.model);
};
var inflectRoot = function(regs, world2) {
  regs = regs.map((token) => {
    if (token.root) {
      if (world2.methods.two && world2.methods.two.transform) {
        let choices = [];
        if (token.pos) {
          if (token.pos === "Verb") {
            choices = choices.concat(addVerbs(token, world2));
          } else if (token.pos === "Noun") {
            choices = choices.concat(addNoun(token, world2));
          } else if (token.pos === "Adjective") {
            choices = choices.concat(addAdjective(token, world2));
          }
        } else {
          choices = choices.concat(addVerbs(token, world2));
          choices = choices.concat(addNoun(token, world2));
          choices = choices.concat(addAdjective(token, world2));
        }
        choices = choices.filter((str) => str);
        if (choices.length > 0) {
          token.operator = "or";
          token.fastOr = new Set(choices);
        }
      } else {
        token.machine = token.root;
        delete token.id;
        delete token.root;
      }
    }
    return token;
  });
  return regs;
};
var inflect_root_default = inflectRoot;

// reducer/node_modules/compromise/src/1-one/match/methods/parseMatch/05-postProcess.js
var nameGroups = function(regs) {
  let index3 = 0;
  let inGroup = null;
  for (let i3 = 0; i3 < regs.length; i3++) {
    const token = regs[i3];
    if (token.groupStart === true) {
      inGroup = token.group;
      if (inGroup === null) {
        inGroup = String(index3);
        index3 += 1;
      }
    }
    if (inGroup !== null) {
      token.group = inGroup;
    }
    if (token.groupEnd === true) {
      inGroup = null;
    }
  }
  return regs;
};
var doFastOrMode = function(tokens) {
  return tokens.map((token) => {
    if (token.choices !== void 0) {
      if (token.operator !== "or") {
        return token;
      }
      if (token.fuzzy === true) {
        return token;
      }
      const shouldPack = token.choices.every((block) => {
        if (block.length !== 1) {
          return false;
        }
        const reg = block[0];
        if (reg.fuzzy === true) {
          return false;
        }
        if (reg.start || reg.end) {
          return false;
        }
        if (reg.word !== void 0 && reg.negative !== true && reg.optional !== true && reg.method !== true) {
          return true;
        }
        return false;
      });
      if (shouldPack === true) {
        token.fastOr = /* @__PURE__ */ new Set();
        token.choices.forEach((block) => {
          token.fastOr.add(block[0].word);
        });
        delete token.choices;
      }
    }
    return token;
  });
};
var fuzzyOr = function(regs) {
  return regs.map((reg) => {
    if (reg.fuzzy && reg.choices) {
      reg.choices.forEach((r2) => {
        if (r2.length === 1 && r2[0].word) {
          r2[0].fuzzy = true;
          r2[0].min = reg.min;
        }
      });
    }
    return reg;
  });
};
var postProcess = function(regs) {
  regs = nameGroups(regs);
  regs = doFastOrMode(regs);
  regs = fuzzyOr(regs);
  return regs;
};
var postProcess_default = postProcess;

// reducer/node_modules/compromise/src/1-one/match/methods/parseMatch/index.js
var syntax = function(input, opts2, world2) {
  if (input === null || input === void 0 || input === "") {
    return [];
  }
  opts2 = opts2 || {};
  if (typeof input === "number") {
    input = String(input);
  }
  let tokens = parseBlocks_default(input);
  tokens = tokens.map((str) => parseToken_default(str, opts2));
  tokens = splitHyphens_default(tokens, world2);
  tokens = inflect_root_default(tokens, world2);
  tokens = postProcess_default(tokens, opts2);
  return tokens;
};
var parseMatch_default = syntax;

// reducer/node_modules/compromise/src/1-one/match/methods/match/01-failFast.js
var anyIntersection = function(setA, setB) {
  for (const elem of setB) {
    if (setA.has(elem)) {
      return true;
    }
  }
  return false;
};
var failFast = function(regs, cache2) {
  for (let i3 = 0; i3 < regs.length; i3 += 1) {
    const reg = regs[i3];
    if (reg.optional === true || reg.negative === true || reg.fuzzy === true) {
      continue;
    }
    if (reg.word !== void 0 && cache2.has(reg.word) === false) {
      return true;
    }
    if (reg.tag !== void 0 && cache2.has("#" + reg.tag) === false) {
      return true;
    }
    if (reg.fastOr && anyIntersection(reg.fastOr, cache2) === false) {
      return false;
    }
  }
  return false;
};
var failFast_default = failFast;

// reducer/node_modules/compromise/src/1-one/match/methods/match/term/_fuzzy.js
var editDistance = function(strA, strB) {
  const aLength = strA.length, bLength = strB.length;
  if (aLength === 0) {
    return bLength;
  }
  if (bLength === 0) {
    return aLength;
  }
  const limit = (bLength > aLength ? bLength : aLength) + 1;
  if (Math.abs(aLength - bLength) > (limit || 100)) {
    return limit || 100;
  }
  const matrix = [];
  for (let i3 = 0; i3 < limit; i3++) {
    matrix[i3] = [i3];
    matrix[i3].length = limit;
  }
  for (let i3 = 0; i3 < limit; i3++) {
    matrix[0][i3] = i3;
  }
  let j2, a_index, b_index, cost, min2, t3;
  for (let i3 = 1; i3 <= aLength; ++i3) {
    a_index = strA[i3 - 1];
    for (j2 = 1; j2 <= bLength; ++j2) {
      if (i3 === j2 && matrix[i3][j2] > 4) {
        return aLength;
      }
      b_index = strB[j2 - 1];
      cost = a_index === b_index ? 0 : 1;
      min2 = matrix[i3 - 1][j2] + 1;
      if ((t3 = matrix[i3][j2 - 1] + 1) < min2) min2 = t3;
      if ((t3 = matrix[i3 - 1][j2 - 1] + cost) < min2) min2 = t3;
      const shouldUpdate = i3 > 1 && j2 > 1 && a_index === strB[j2 - 2] && strA[i3 - 2] === b_index && (t3 = matrix[i3 - 2][j2 - 2] + cost) < min2;
      if (shouldUpdate) {
        matrix[i3][j2] = t3;
      } else {
        matrix[i3][j2] = min2;
      }
    }
  }
  return matrix[aLength][bLength];
};
var fuzzyMatch = function(strA, strB, minLength = 3) {
  if (strA === strB) {
    return 1;
  }
  if (strA.length < minLength || strB.length < minLength) {
    return 0;
  }
  const steps = editDistance(strA, strB);
  const length2 = Math.max(strA.length, strB.length);
  const relative2 = length2 === 0 ? 0 : steps / length2;
  const similarity = 1 - relative2;
  return similarity;
};
var fuzzy_default = fuzzyMatch;

// reducer/node_modules/compromise/src/1-one/match/methods/termMethods.js
var startQuote = /([\u0022\uFF02\u0027\u201C\u2018\u201F\u201B\u201E\u2E42\u201A\u00AB\u2039\u2035\u2036\u2037\u301D\u0060\u301F])/;
var endQuote = /([\u0022\uFF02\u0027\u201D\u2019\u00BB\u203A\u2032\u2033\u2034\u301E\u00B4])/;
var hasHyphen = /^[-–—]$/;
var hasDash2 = / [-–—]{1,3} /;
var hasPost = (term, punct) => term.post.indexOf(punct) !== -1;
var methods10 = {
  /** does it have a quotation symbol?  */
  hasQuote: (term) => startQuote.test(term.pre) || endQuote.test(term.post),
  /** does it have a comma?  */
  hasComma: (term) => hasPost(term, ","),
  /** does it end in a period? */
  hasPeriod: (term) => hasPost(term, ".") === true && hasPost(term, "...") === false,
  /** does it end in an exclamation */
  hasExclamation: (term) => hasPost(term, "!"),
  /** does it end with a question mark? */
  hasQuestionMark: (term) => hasPost(term, "?") || hasPost(term, "\xBF"),
  /** is there a ... at the end? */
  hasEllipses: (term) => hasPost(term, "..") || hasPost(term, "\u2026"),
  /** is there a semicolon after term word? */
  hasSemicolon: (term) => hasPost(term, ";"),
  /** is there a colon after term word? */
  hasColon: (term) => hasPost(term, ":"),
  /** is there a slash '/' in term word? */
  hasSlash: (term) => /\//.test(term.text),
  /** a hyphen connects two words like-term */
  hasHyphen: (term) => hasHyphen.test(term.post) || hasHyphen.test(term.pre),
  /** a dash separates words - like that */
  hasDash: (term) => hasDash2.test(term.post) || hasDash2.test(term.pre),
  /** is it multiple words combinded */
  hasContraction: (term) => Boolean(term.implicit),
  /** is it an acronym */
  isAcronym: (term) => term.tags.has("Acronym"),
  /** does it have any tags */
  isKnown: (term) => term.tags.size > 0,
  /** uppercase first letter, then a lowercase */
  isTitleCase: (term) => /^\p{Lu}[a-z'\u00C0-\u00FF]/u.test(term.text),
  /** uppercase all letters */
  isUpperCase: (term) => /^\p{Lu}+$/u.test(term.text)
};
methods10.hasQuotation = methods10.hasQuote;
var termMethods_default = methods10;

// reducer/node_modules/compromise/src/1-one/match/methods/match/term/doesMatch.js
var wrapMatch = function() {
};
var doesMatch = function(term, reg, index3, length2) {
  if (reg.anything === true) {
    return true;
  }
  if (reg.start === true && index3 !== 0) {
    return false;
  }
  if (reg.end === true && index3 !== length2 - 1) {
    return false;
  }
  if (reg.id !== void 0 && reg.id === term.id) {
    return true;
  }
  if (reg.word !== void 0) {
    if (reg.use) {
      return reg.word === term[reg.use];
    }
    if (term.machine !== null && term.machine === reg.word) {
      return true;
    }
    if (term.alias !== void 0 && term.alias.hasOwnProperty(reg.word)) {
      return true;
    }
    if (reg.fuzzy === true) {
      if (reg.word === term.root) {
        return true;
      }
      const score = fuzzy_default(reg.word, term.normal);
      if (score >= reg.min) {
        return true;
      }
    }
    if (term.alias && term.alias.some((str) => str === reg.word)) {
      return true;
    }
    return reg.word === term.text || reg.word === term.normal;
  }
  if (reg.tag !== void 0) {
    return term.tags.has(reg.tag) === true;
  }
  if (reg.method !== void 0) {
    if (typeof termMethods_default[reg.method] === "function" && termMethods_default[reg.method](term) === true) {
      return true;
    }
    return false;
  }
  if (reg.pre !== void 0) {
    return term.pre && term.pre.includes(reg.pre);
  }
  if (reg.post !== void 0) {
    return term.post && term.post.includes(reg.post);
  }
  if (reg.regex !== void 0) {
    let str = term.normal;
    if (reg.use) {
      str = term[reg.use];
    }
    return reg.regex.test(str);
  }
  if (reg.chunk !== void 0) {
    return term.chunk === reg.chunk;
  }
  if (reg.switch !== void 0) {
    return term.switch === reg.switch;
  }
  if (reg.machine !== void 0) {
    return term.normal === reg.machine || term.machine === reg.machine || term.root === reg.machine;
  }
  if (reg.sense !== void 0) {
    return term.sense === reg.sense;
  }
  if (reg.fastOr !== void 0) {
    if (reg.pos && !term.tags.has(reg.pos)) {
      return null;
    }
    const str = term.root || term.implicit || term.machine || term.normal;
    return reg.fastOr.has(str) || reg.fastOr.has(term.text);
  }
  if (reg.choices !== void 0) {
    if (reg.operator === "and") {
      return reg.choices.every((r2) => wrapMatch(term, r2, index3, length2));
    }
    return reg.choices.some((r2) => wrapMatch(term, r2, index3, length2));
  }
  return false;
};
wrapMatch = function(t3, reg, index3, length2) {
  const result = doesMatch(t3, reg, index3, length2);
  if (reg.negative === true) {
    return !result;
  }
  return result;
};
var doesMatch_default = wrapMatch;

// reducer/node_modules/compromise/src/1-one/match/methods/match/steps/logic/greedy.js
var getGreedy = function(state, endReg) {
  const reg = Object.assign({}, state.regs[state.r], { start: false, end: false });
  const start2 = state.t;
  for (; state.t < state.terms.length; state.t += 1) {
    if (endReg && doesMatch_default(state.terms[state.t], endReg, state.start_i + state.t, state.phrase_length)) {
      return state.t;
    }
    const count = state.t - start2 + 1;
    if (reg.max !== void 0 && count === reg.max) {
      return state.t;
    }
    if (doesMatch_default(state.terms[state.t], reg, state.start_i + state.t, state.phrase_length) === false) {
      if (reg.min !== void 0 && count < reg.min) {
        return null;
      }
      return state.t;
    }
  }
  return state.t;
};
var greedyTo = function(state, nextReg) {
  let t3 = state.t;
  if (!nextReg) {
    return state.terms.length;
  }
  for (; t3 < state.terms.length; t3 += 1) {
    if (doesMatch_default(state.terms[t3], nextReg, state.start_i + t3, state.phrase_length) === true) {
      return t3;
    }
  }
  return null;
};
var isEndGreedy = function(reg, state) {
  if (reg.end === true && reg.greedy === true) {
    if (state.start_i + state.t < state.phrase_length - 1) {
      const tmpReg = Object.assign({}, reg, { end: false });
      if (doesMatch_default(state.terms[state.t], tmpReg, state.start_i + state.t, state.phrase_length) === true) {
        return true;
      }
    }
  }
  return false;
};

// reducer/node_modules/compromise/src/1-one/match/methods/match/_lib.js
var getGroup = function(state, term_index) {
  if (state.groups[state.inGroup]) {
    return state.groups[state.inGroup];
  }
  state.groups[state.inGroup] = {
    start: term_index,
    length: 0
  };
  return state.groups[state.inGroup];
};

// reducer/node_modules/compromise/src/1-one/match/methods/match/steps/astrix.js
var doAstrix = function(state) {
  const { regs } = state;
  const reg = regs[state.r];
  const skipto = greedyTo(state, regs[state.r + 1]);
  if (skipto === null || skipto === 0) {
    return null;
  }
  if (reg.min !== void 0 && skipto - state.t < reg.min) {
    return null;
  }
  if (reg.max !== void 0 && skipto - state.t > reg.max) {
    state.t = state.t + reg.max;
    return true;
  }
  if (state.hasGroup === true) {
    const g4 = getGroup(state, state.t);
    g4.length = skipto - state.t;
  }
  state.t = skipto;
  return true;
};
var astrix_default = doAstrix;

// reducer/node_modules/compromise/src/1-one/match/methods/match/steps/logic/and-or.js
var isArray7 = function(arr) {
  return Object.prototype.toString.call(arr) === "[object Array]";
};
var doOrBlock = function(state, skipN = 0) {
  const block = state.regs[state.r];
  let wasFound = false;
  for (let c2 = 0; c2 < block.choices.length; c2 += 1) {
    const regs = block.choices[c2];
    if (!isArray7(regs)) {
      return false;
    }
    wasFound = regs.every((cr, w_index) => {
      let extra = 0;
      const t3 = state.t + w_index + skipN + extra;
      if (state.terms[t3] === void 0) {
        return false;
      }
      const foundBlock = doesMatch_default(state.terms[t3], cr, t3 + state.start_i, state.phrase_length);
      if (foundBlock === true && cr.greedy === true) {
        for (let i3 = 1; i3 < state.terms.length; i3 += 1) {
          const term = state.terms[t3 + i3];
          if (term) {
            const keepGoing = doesMatch_default(term, cr, state.start_i + i3, state.phrase_length);
            if (keepGoing === true) {
              extra += 1;
            } else {
              break;
            }
          }
        }
      }
      skipN += extra;
      return foundBlock;
    });
    if (wasFound) {
      skipN += regs.length;
      break;
    }
  }
  if (wasFound && block.greedy === true) {
    return doOrBlock(state, skipN);
  }
  return skipN;
};
var doAndBlock = function(state) {
  let longest = 0;
  const reg = state.regs[state.r];
  const allDidMatch = reg.choices.every((block) => {
    const allWords = block.every((cr, w_index) => {
      const tryTerm = state.t + w_index;
      if (state.terms[tryTerm] === void 0) {
        return false;
      }
      return doesMatch_default(state.terms[tryTerm], cr, tryTerm, state.phrase_length);
    });
    if (allWords === true && block.length > longest) {
      longest = block.length;
    }
    return allWords;
  });
  if (allDidMatch === true) {
    return longest;
  }
  return false;
};

// reducer/node_modules/compromise/src/1-one/match/methods/match/steps/or-block.js
var orBlock = function(state) {
  const { regs } = state;
  const reg = regs[state.r];
  const skipNum = doOrBlock(state);
  if (skipNum) {
    if (reg.negative === true) {
      return null;
    }
    if (state.hasGroup === true) {
      const g4 = getGroup(state, state.t);
      g4.length += skipNum;
    }
    if (reg.end === true) {
      const end2 = state.phrase_length;
      if (state.t + state.start_i + skipNum !== end2) {
        return null;
      }
    }
    state.t += skipNum;
    return true;
  } else if (!reg.optional) {
    return null;
  }
  return true;
};
var or_block_default = orBlock;

// reducer/node_modules/compromise/src/1-one/match/methods/match/steps/and-block.js
var andBlock = function(state) {
  const { regs } = state;
  const reg = regs[state.r];
  const skipNum = doAndBlock(state);
  if (skipNum) {
    if (reg.negative === true) {
      return null;
    }
    if (state.hasGroup === true) {
      const g4 = getGroup(state, state.t);
      g4.length += skipNum;
    }
    if (reg.end === true) {
      const end2 = state.phrase_length - 1;
      if (state.t + state.start_i !== end2) {
        return null;
      }
    }
    state.t += skipNum;
    return true;
  } else if (!reg.optional) {
    return null;
  }
  return true;
};
var and_block_default = andBlock;

// reducer/node_modules/compromise/src/1-one/match/methods/match/steps/logic/negative-greedy.js
var negGreedy = function(state, reg, nextReg) {
  let skip = 0;
  for (let t3 = state.t; t3 < state.terms.length; t3 += 1) {
    let found = doesMatch_default(state.terms[t3], reg, state.start_i + state.t, state.phrase_length);
    if (found) {
      break;
    }
    if (nextReg) {
      found = doesMatch_default(state.terms[t3], nextReg, state.start_i + state.t, state.phrase_length);
      if (found) {
        break;
      }
    }
    skip += 1;
    if (reg.max !== void 0 && skip === reg.max) {
      break;
    }
  }
  if (skip === 0) {
    return false;
  }
  if (reg.min && reg.min > skip) {
    return false;
  }
  state.t += skip;
  return true;
};
var negative_greedy_default = negGreedy;

// reducer/node_modules/compromise/src/1-one/match/methods/match/steps/negative.js
var doNegative = function(state) {
  const { regs } = state;
  const reg = regs[state.r];
  const tmpReg = Object.assign({}, reg);
  tmpReg.negative = false;
  const found = doesMatch_default(state.terms[state.t], tmpReg, state.start_i + state.t, state.phrase_length);
  if (found) {
    return false;
  }
  if (reg.optional) {
    const nextReg = regs[state.r + 1];
    if (nextReg) {
      const fNext = doesMatch_default(state.terms[state.t], nextReg, state.start_i + state.t, state.phrase_length);
      if (fNext) {
        state.r += 1;
      } else if (nextReg.optional && regs[state.r + 2]) {
        const fNext2 = doesMatch_default(state.terms[state.t], regs[state.r + 2], state.start_i + state.t, state.phrase_length);
        if (fNext2) {
          state.r += 2;
        }
      }
    }
  }
  if (reg.greedy) {
    return negative_greedy_default(state, tmpReg, regs[state.r + 1]);
  }
  state.t += 1;
  return true;
};
var negative_default = doNegative;

// reducer/node_modules/compromise/src/1-one/match/methods/match/steps/optional-match.js
var foundOptional = function(state) {
  const { regs } = state;
  const reg = regs[state.r];
  const term = state.terms[state.t];
  const nextRegMatched = doesMatch_default(term, regs[state.r + 1], state.start_i + state.t, state.phrase_length);
  if (reg.negative || nextRegMatched) {
    const nextTerm = state.terms[state.t + 1];
    if (!nextTerm || !doesMatch_default(nextTerm, regs[state.r + 1], state.start_i + state.t, state.phrase_length)) {
      state.r += 1;
    }
  }
};
var optional_match_default = foundOptional;

// reducer/node_modules/compromise/src/1-one/match/methods/match/steps/greedy-match.js
var greedyMatch = function(state) {
  const { regs, phrase_length } = state;
  const reg = regs[state.r];
  state.t = getGreedy(state, regs[state.r + 1]);
  if (state.t === null) {
    return null;
  }
  if (reg.min && reg.min > state.t) {
    return null;
  }
  if (reg.end === true && state.start_i + state.t !== phrase_length) {
    return null;
  }
  return true;
};
var greedy_match_default = greedyMatch;

// reducer/node_modules/compromise/src/1-one/match/methods/match/steps/contraction-skip.js
var contractionSkip = function(state) {
  const term = state.terms[state.t];
  const reg = state.regs[state.r];
  if (term.implicit && state.terms[state.t + 1]) {
    const nextTerm = state.terms[state.t + 1];
    if (!nextTerm.implicit) {
      return;
    }
    if (reg.word === term.normal) {
      state.t += 1;
    }
    if (reg.method === "hasContraction") {
      state.t += 1;
    }
  }
};
var contraction_skip_default = contractionSkip;

// reducer/node_modules/compromise/src/1-one/match/methods/match/steps/simple-match.js
var setGroup = function(state, startAt) {
  const reg = state.regs[state.r];
  const g4 = getGroup(state, startAt);
  if (state.t > 1 && reg.greedy) {
    g4.length += state.t - startAt;
  } else {
    g4.length++;
  }
};
var simpleMatch = function(state) {
  const { regs } = state;
  const reg = regs[state.r];
  const term = state.terms[state.t];
  const startAt = state.t;
  if (reg.optional && regs[state.r + 1] && reg.negative) {
    return true;
  }
  if (reg.optional && regs[state.r + 1]) {
    optional_match_default(state);
  }
  if (term.implicit && state.terms[state.t + 1]) {
    contraction_skip_default(state);
  }
  state.t += 1;
  if (reg.end === true && state.t !== state.terms.length && reg.greedy !== true) {
    return null;
  }
  if (reg.greedy === true) {
    const alive = greedy_match_default(state);
    if (!alive) {
      return null;
    }
  }
  if (state.hasGroup === true) {
    setGroup(state, startAt);
  }
  return true;
};
var simple_match_default = simpleMatch;

// reducer/node_modules/compromise/src/1-one/match/methods/match/02-from-here.js
var tryHere = function(terms, regs, start_i, phrase_length) {
  if (terms.length === 0 || regs.length === 0) {
    return null;
  }
  const state = {
    t: 0,
    terms,
    r: 0,
    regs,
    groups: {},
    start_i,
    phrase_length,
    inGroup: null
  };
  for (; state.r < regs.length; state.r += 1) {
    const reg = regs[state.r];
    state.hasGroup = Boolean(reg.group);
    if (state.hasGroup === true) {
      state.inGroup = reg.group;
    } else {
      state.inGroup = null;
    }
    if (!state.terms[state.t]) {
      const alive = regs.slice(state.r).some((remain) => !remain.optional);
      if (alive === false) {
        break;
      }
      return null;
    }
    if (reg.anything === true && reg.greedy === true) {
      const alive = astrix_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    if (reg.choices !== void 0 && reg.operator === "or") {
      const alive = or_block_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    if (reg.choices !== void 0 && reg.operator === "and") {
      const alive = and_block_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    if (reg.anything === true) {
      if (reg.negative && reg.anything) {
        return null;
      }
      const alive = simple_match_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    if (isEndGreedy(reg, state) === true) {
      const alive = simple_match_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    if (reg.negative) {
      const alive = negative_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    const hasMatch = doesMatch_default(state.terms[state.t], reg, state.start_i + state.t, state.phrase_length);
    if (hasMatch === true) {
      const alive = simple_match_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    if (reg.optional === true) {
      continue;
    }
    return null;
  }
  const pntr = [null, start_i, state.t + start_i];
  if (pntr[1] === pntr[2]) {
    return null;
  }
  const groups = {};
  Object.keys(state.groups).forEach((k2) => {
    const o2 = state.groups[k2];
    const start2 = start_i + o2.start;
    groups[k2] = [null, start2, start2 + o2.length];
  });
  return { pointer: pntr, groups };
};
var from_here_default = tryHere;

// reducer/node_modules/compromise/src/1-one/match/methods/match/03-getGroup.js
var getGroup2 = function(res, group) {
  const ptrs = [];
  const byGroup = {};
  if (res.length === 0) {
    return { ptrs, byGroup };
  }
  if (typeof group === "number") {
    group = String(group);
  }
  if (group) {
    res.forEach((r2) => {
      if (r2.groups[group]) {
        ptrs.push(r2.groups[group]);
      }
    });
  } else {
    res.forEach((r2) => {
      ptrs.push(r2.pointer);
      Object.keys(r2.groups).forEach((k2) => {
        byGroup[k2] = byGroup[k2] || [];
        byGroup[k2].push(r2.groups[k2]);
      });
    });
  }
  return { ptrs, byGroup };
};
var getGroup_default = getGroup2;

// reducer/node_modules/compromise/src/1-one/match/methods/match/03-notIf.js
var notIf = function(results, not, docs) {
  results = results.filter((res) => {
    const [n3, start2, end2] = res.pointer;
    const terms = docs[n3].slice(start2, end2);
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const slice = terms.slice(i3);
      const found = from_here_default(slice, not, i3, terms.length);
      if (found !== null) {
        return false;
      }
    }
    return true;
  });
  return results;
};
var notIf_default = notIf;

// reducer/node_modules/compromise/src/1-one/match/methods/match/index.js
var addSentence = function(res, n3) {
  res.pointer[0] = n3;
  Object.keys(res.groups).forEach((k2) => {
    res.groups[k2][0] = n3;
  });
  return res;
};
var handleStart = function(terms, regs, n3) {
  let res = from_here_default(terms, regs, 0, terms.length);
  if (res) {
    res = addSentence(res, n3);
    return res;
  }
  return null;
};
var runMatch = function(docs, todo, cache2) {
  cache2 = cache2 || [];
  const { regs, group, justOne } = todo;
  let results = [];
  if (!regs || regs.length === 0) {
    return { ptrs: [], byGroup: {} };
  }
  const minLength = regs.filter((r2) => r2.optional !== true && r2.negative !== true).length;
  docs: for (let n3 = 0; n3 < docs.length; n3 += 1) {
    const terms = docs[n3];
    if (cache2[n3] && failFast_default(regs, cache2[n3])) {
      continue;
    }
    if (regs[0].start === true) {
      const foundStart = handleStart(terms, regs, n3, group);
      if (foundStart) {
        results.push(foundStart);
      }
      continue;
    }
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const slice = terms.slice(i3);
      if (slice.length < minLength) {
        break;
      }
      let res = from_here_default(slice, regs, i3, terms.length);
      if (res) {
        res = addSentence(res, n3);
        results.push(res);
        if (justOne === true) {
          break docs;
        }
        const end2 = res.pointer[2];
        if (Math.abs(end2 - 1) > i3) {
          i3 = Math.abs(end2 - 1);
        }
      }
    }
  }
  if (regs[regs.length - 1].end === true) {
    results = results.filter((res) => {
      const n3 = res.pointer[0];
      return docs[n3].length === res.pointer[2];
    });
  }
  if (todo.notIf) {
    results = notIf_default(results, todo.notIf, docs);
  }
  results = getGroup_default(results, group);
  results.ptrs.forEach((ptr) => {
    const [n3, start2, end2] = ptr;
    ptr[3] = docs[n3][start2].id;
    ptr[4] = docs[n3][end2 - 1].id;
  });
  return results;
};
var match_default2 = runMatch;

// reducer/node_modules/compromise/src/1-one/match/methods/index.js
var methods11 = {
  one: {
    termMethods: termMethods_default,
    parseMatch: parseMatch_default,
    match: match_default2
  }
};
var methods_default4 = methods11;

// reducer/node_modules/compromise/src/1-one/match/lib.js
var lib_default2 = {
  /** pre-parse any match statements */
  parseMatch: function(str, opts2) {
    const world2 = this.world();
    const killUnicode2 = world2.methods.one.killUnicode;
    if (killUnicode2) {
      str = killUnicode2(str, world2);
    }
    return world2.methods.one.parseMatch(str, opts2, world2);
  }
};

// reducer/node_modules/compromise/src/1-one/match/plugin.js
var plugin_default7 = {
  api: api_default4,
  methods: methods_default4,
  lib: lib_default2
};

// reducer/node_modules/compromise/src/1-one/output/api/html.js
var isClass = /^\../;
var isId = /^#./;
var escapeXml = (str) => {
  str = str.replace(/&/g, "&amp;");
  str = str.replace(/</g, "&lt;");
  str = str.replace(/>/g, "&gt;");
  str = str.replace(/"/g, "&quot;");
  str = str.replace(/'/g, "&apos;");
  return str;
};
var toTag = function(k2) {
  let start2 = "";
  let end2 = "</span>";
  k2 = escapeXml(k2);
  if (isClass.test(k2)) {
    start2 = `<span class="${k2.replace(/^\./, "")}"`;
  } else if (isId.test(k2)) {
    start2 = `<span id="${k2.replace(/^#/, "")}"`;
  } else {
    start2 = `<${k2}`;
    end2 = `</${k2}>`;
  }
  start2 += ">";
  return { start: start2, end: end2 };
};
var getIndex = function(doc, obj) {
  const starts = {};
  const ends = {};
  Object.keys(obj).forEach((k2) => {
    let res = obj[k2];
    const tag = toTag(k2);
    if (typeof res === "string") {
      res = doc.match(res);
    }
    res.docs.forEach((terms) => {
      if (terms.every((t3) => t3.implicit)) {
        return;
      }
      const a2 = terms[0].id;
      starts[a2] = starts[a2] || [];
      starts[a2].push(tag.start);
      const b = terms[terms.length - 1].id;
      ends[b] = ends[b] || [];
      ends[b].push(tag.end);
    });
  });
  return { starts, ends };
};
var html = function(obj) {
  const { starts, ends } = getIndex(this, obj);
  let out2 = "";
  this.docs.forEach((terms) => {
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const t3 = terms[i3];
      if (starts.hasOwnProperty(t3.id)) {
        out2 += starts[t3.id].join("");
      }
      out2 += t3.pre || "";
      out2 += t3.text || "";
      if (ends.hasOwnProperty(t3.id)) {
        out2 += ends[t3.id].join("");
      }
      out2 += t3.post || "";
    }
  });
  return out2;
};
var html_default = { html };

// reducer/node_modules/compromise/src/1-one/output/api/_text.js
var trimEnd = /[,:;)\]*.?~!\u0022\uFF02\u201D\u2019\u00BB\u203A\u2032\u2033\u2034\u301E\u00B4—-]+$/;
var trimStart = /^[(['"*~\uFF02\u201C\u2018\u201F\u201B\u201E\u2E42\u201A\u00AB\u2039\u2035\u2036\u2037\u301D\u0060\u301F]+/;
var punctToKill = /[,:;)('"\u201D\]]/;
var isHyphen = /^[-–—]$/;
var hasSpace = / /;
var textFromTerms = function(terms, opts2, keepSpace = true) {
  let txt = "";
  terms.forEach((t3) => {
    let pre = t3.pre || "";
    let post = t3.post || "";
    if (opts2.punctuation === "some") {
      pre = pre.replace(trimStart, "");
      if (isHyphen.test(post)) {
        post = " ";
      }
      post = post.replace(punctToKill, "");
      post = post.replace(/\?!+/, "?");
      post = post.replace(/!+/, "!");
      post = post.replace(/\?+/, "?");
      post = post.replace(/\.{2,}/, "");
      if (t3.tags.has("Abbreviation")) {
        post = post.replace(/\./, "");
      }
    }
    if (opts2.whitespace === "some") {
      pre = pre.replace(/\s/, "");
      post = post.replace(/\s+/, " ");
    }
    if (!opts2.keepPunct) {
      pre = pre.replace(trimStart, "");
      if (post === "-") {
        post = " ";
      } else {
        post = post.replace(trimEnd, "");
      }
    }
    let word = t3[opts2.form || "text"] || t3.normal || "";
    if (opts2.form === "implicit") {
      word = t3.implicit || t3.text;
    }
    if (opts2.form === "root" && t3.implicit) {
      word = t3.root || t3.implicit || t3.normal;
    }
    if ((opts2.form === "machine" || opts2.form === "implicit" || opts2.form === "root") && t3.implicit) {
      if (!post || !hasSpace.test(post)) {
        post += " ";
      }
    }
    txt += pre + word + post;
  });
  if (keepSpace === false) {
    txt = txt.trim();
  }
  if (opts2.lowerCase === true) {
    txt = txt.toLowerCase();
  }
  return txt;
};
var textFromDoc = function(docs, opts2) {
  let text = "";
  if (!docs || !docs[0] || !docs[0][0]) {
    return text;
  }
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    text += textFromTerms(docs[i3], opts2, true);
  }
  if (!opts2.keepSpace) {
    text = text.trim();
  }
  if (opts2.keepEndPunct === false) {
    if (!docs[0][0].tags.has("Emoticon")) {
      text = text.replace(trimStart, "");
    }
    const last = docs[docs.length - 1];
    if (!last[last.length - 1].tags.has("Emoticon")) {
      text = text.replace(trimEnd, "");
    }
    if (text.endsWith(`'`) && !text.endsWith(`s'`)) {
      text = text.replace(/'/, "");
    }
  }
  if (opts2.cleanWhitespace === true) {
    text = text.trim();
  }
  return text;
};

// reducer/node_modules/compromise/src/1-one/output/api/_fmts.js
var fmts = {
  text: {
    form: "text"
  },
  normal: {
    whitespace: "some",
    punctuation: "some",
    case: "some",
    unicode: "some",
    form: "normal"
  },
  machine: {
    keepSpace: false,
    whitespace: "some",
    punctuation: "some",
    case: "none",
    unicode: "some",
    form: "machine"
  },
  root: {
    keepSpace: false,
    whitespace: "some",
    punctuation: "some",
    case: "some",
    unicode: "some",
    form: "root"
  },
  implicit: {
    form: "implicit"
  }
};
fmts.clean = fmts.normal;
fmts.reduced = fmts.root;
var fmts_default = fmts;

// reducer/node_modules/compromise/src/1-one/output/methods/hash.js
var k = [];
var i = 0;
for (; i < 64; ) {
  k[i] = 0 | Math.sin(++i % Math.PI) * 4294967296;
}
var md5 = function(s3) {
  let b, c2, d2, j2 = decodeURI(encodeURI(s3)) + "\x80", a2 = j2.length;
  const h2 = [b = 1732584193, c2 = 4023233417, ~b, ~c2], words = [];
  s3 = --a2 / 4 + 2 | 15;
  words[--s3] = a2 * 8;
  for (; ~a2; ) {
    words[a2 >> 2] |= j2.charCodeAt(a2) << 8 * a2--;
  }
  for (i = j2 = 0; i < s3; i += 16) {
    a2 = h2;
    for (; j2 < 64; a2 = [
      d2 = a2[3],
      b + ((d2 = a2[0] + [b & c2 | ~b & d2, d2 & b | ~d2 & c2, b ^ c2 ^ d2, c2 ^ (b | ~d2)][a2 = j2 >> 4] + k[j2] + ~~words[i | [j2, 5 * j2 + 1, 3 * j2 + 5, 7 * j2][a2] & 15]) << (a2 = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21][4 * a2 + j2++ % 4]) | d2 >>> -a2),
      b,
      c2
    ]) {
      b = a2[1] | 0;
      c2 = a2[2];
    }
    for (j2 = 4; j2; ) h2[--j2] += a2[j2];
  }
  for (s3 = ""; j2 < 32; ) {
    s3 += (h2[j2 >> 3] >> (1 ^ j2++) * 4 & 15).toString(16);
  }
  return s3;
};
var hash_default = md5;

// reducer/node_modules/compromise/src/1-one/output/api/json.js
var defaults = {
  text: true,
  terms: true
};
var opts = { case: "none", unicode: "some", form: "machine", punctuation: "some" };
var merge = function(a2, b) {
  return Object.assign({}, a2, b);
};
var fns4 = {
  text: (terms) => textFromTerms(terms, { keepPunct: true }, false),
  normal: (terms) => textFromTerms(terms, merge(fmts_default.normal, { keepPunct: true }), false),
  implicit: (terms) => textFromTerms(terms, merge(fmts_default.implicit, { keepPunct: true }), false),
  machine: (terms) => textFromTerms(terms, opts, false),
  root: (terms) => textFromTerms(terms, merge(opts, { form: "root" }), false),
  hash: (terms) => hash_default(textFromTerms(terms, { keepPunct: true }, false)),
  offset: (terms) => {
    const len = fns4.text(terms).length;
    return {
      index: terms[0].offset.index,
      start: terms[0].offset.start,
      length: len
    };
  },
  terms: (terms) => {
    return terms.map((t3) => {
      const term = Object.assign({}, t3);
      term.tags = Array.from(t3.tags);
      return term;
    });
  },
  confidence: (_terms, view, i3) => view.eq(i3).confidence(),
  syllables: (_terms, view, i3) => view.eq(i3).syllables(),
  sentence: (_terms, view, i3) => view.eq(i3).fullSentence().text(),
  dirty: (terms) => terms.some((t3) => t3.dirty === true)
};
fns4.sentences = fns4.sentence;
fns4.clean = fns4.normal;
fns4.reduced = fns4.root;
var toJSON = function(view, option) {
  option = option || {};
  if (typeof option === "string") {
    option = {};
  }
  option = Object.assign({}, defaults, option);
  if (option.offset) {
    view.compute("offset");
  }
  return view.docs.map((terms, i3) => {
    const res = {};
    Object.keys(option).forEach((k2) => {
      if (option[k2] && fns4[k2]) {
        res[k2] = fns4[k2](terms, view, i3);
      }
    });
    return res;
  });
};
var methods12 = {
  /** return data */
  json: function(n3) {
    const res = toJSON(this, n3);
    if (typeof n3 === "number") {
      return res[n3];
    }
    return res;
  }
};
methods12.data = methods12.json;
var json_default = methods12;

// reducer/node_modules/compromise/src/1-one/output/api/debug.js
var isClientSide = () => typeof window !== "undefined" && window.document;
var debug2 = function(fmt2) {
  const debugMethods = this.methods.one.debug || {};
  if (fmt2 && debugMethods.hasOwnProperty(fmt2)) {
    debugMethods[fmt2](this);
    return this;
  }
  if (isClientSide()) {
    debugMethods.clientSide(this);
    return this;
  }
  debugMethods.tags(this);
  return this;
};
var debug_default2 = debug2;

// reducer/node_modules/compromise/src/1-one/output/api/wrap.js
var toText = function(term) {
  const pre = term.pre || "";
  const post = term.post || "";
  return pre + term.text + post;
};
var findStarts = function(doc, obj) {
  const starts = {};
  Object.keys(obj).forEach((reg) => {
    const m3 = doc.match(reg);
    m3.fullPointer.forEach((a2) => {
      starts[a2[3]] = { fn: obj[reg], end: a2[2] };
    });
  });
  return starts;
};
var wrap = function(doc, obj) {
  const starts = findStarts(doc, obj);
  let text = "";
  doc.docs.forEach((terms, n3) => {
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const t3 = terms[i3];
      if (starts.hasOwnProperty(t3.id)) {
        const { fn, end: end2 } = starts[t3.id];
        const m3 = doc.update([[n3, i3, end2]]);
        text += terms[i3].pre || "";
        text += fn(m3);
        i3 = end2 - 1;
        text += terms[i3].post || "";
      } else {
        text += toText(t3);
      }
    }
  });
  return text;
};
var wrap_default = wrap;

// reducer/node_modules/compromise/src/1-one/output/api/out.js
var isObject5 = (val) => {
  return Object.prototype.toString.call(val) === "[object Object]";
};
var topk = function(arr) {
  const obj = {};
  arr.forEach((a2) => {
    obj[a2] = obj[a2] || 0;
    obj[a2] += 1;
  });
  const res = Object.keys(obj).map((k2) => {
    return { normal: k2, count: obj[k2] };
  });
  return res.sort((a2, b) => a2.count > b.count ? -1 : 0);
};
var out = function(method) {
  if (isObject5(method)) {
    return wrap_default(this, method);
  }
  if (method === "text") {
    return this.text();
  }
  if (method === "normal") {
    return this.text("normal");
  }
  if (method === "root") {
    return this.text("root");
  }
  if (method === "machine" || method === "reduced") {
    return this.text("machine");
  }
  if (method === "hash" || method === "md5") {
    return hash_default(this.text());
  }
  if (method === "json") {
    return this.json();
  }
  if (method === "offset" || method === "offsets") {
    this.compute("offset");
    return this.json({ offset: true });
  }
  if (method === "array") {
    const arr = this.docs.map((terms) => {
      return terms.reduce((str, t3) => {
        return str + t3.pre + t3.text + t3.post;
      }, "").trim();
    });
    return arr.filter((str) => str);
  }
  if (method === "freq" || method === "frequency" || method === "topk") {
    return topk(this.json({ normal: true }).map((o2) => o2.normal));
  }
  if (method === "terms") {
    let list4 = [];
    this.docs.forEach((terms) => {
      let words = terms.map((t3) => t3.text);
      words = words.filter((t3) => t3);
      list4 = list4.concat(words);
    });
    return list4;
  }
  if (method === "tags") {
    return this.docs.map((terms) => {
      return terms.reduce((h2, t3) => {
        h2[t3.implicit || t3.normal] = Array.from(t3.tags);
        return h2;
      }, {});
    });
  }
  if (method === "debug") {
    return this.debug();
  }
  return this.text();
};
var methods13 = {
  /** */
  debug: debug_default2,
  /** */
  out,
  /** */
  wrap: function(obj) {
    return wrap_default(this, obj);
  }
};
var out_default = methods13;

// reducer/node_modules/compromise/src/1-one/output/api/text.js
var isObject6 = (val) => {
  return Object.prototype.toString.call(val) === "[object Object]";
};
var text_default = {
  /** */
  text: function(fmt2) {
    let opts2 = {};
    if (fmt2 && typeof fmt2 === "string" && fmts_default.hasOwnProperty(fmt2)) {
      opts2 = Object.assign({}, fmts_default[fmt2]);
    } else if (fmt2 && isObject6(fmt2)) {
      opts2 = Object.assign({}, fmt2);
    }
    if (opts2.keepSpace === void 0 && !this.isFull()) {
      opts2.keepSpace = false;
    }
    if (opts2.keepEndPunct === void 0 && this.pointer) {
      const ptr = this.pointer[0];
      if (ptr && ptr[1]) {
        opts2.keepEndPunct = false;
      } else {
        opts2.keepEndPunct = true;
      }
    }
    if (opts2.keepPunct === void 0) {
      opts2.keepPunct = true;
    }
    if (opts2.keepSpace === void 0) {
      opts2.keepSpace = true;
    }
    return textFromDoc(this.docs, opts2);
  }
};

// reducer/node_modules/compromise/src/1-one/output/api/index.js
var methods14 = Object.assign({}, out_default, text_default, json_default, html_default);
var addAPI3 = function(View2) {
  Object.assign(View2.prototype, methods14);
};
var api_default5 = addAPI3;

// reducer/node_modules/compromise/src/1-one/output/methods/debug/client-side.js
var logClientSide = function(view) {
  console.log("%c -=-=- ", "background-color:#6699cc;");
  view.forEach((m3) => {
    console.groupCollapsed(m3.text());
    const terms = m3.docs[0];
    const out2 = terms.map((t3) => {
      let text = t3.text || "-";
      if (t3.implicit) {
        text = "[" + t3.implicit + "]";
      }
      const tags = "[" + Array.from(t3.tags).join(", ") + "]";
      return { text, tags };
    });
    console.table(out2, ["text", "tags"]);
    console.groupEnd();
  });
};
var client_side_default = logClientSide;

// reducer/node_modules/compromise/src/1-one/output/methods/debug/_color.js
var reset = "\x1B[0m";
var cli = {
  green: (str) => "\x1B[32m" + str + reset,
  red: (str) => "\x1B[31m" + str + reset,
  blue: (str) => "\x1B[34m" + str + reset,
  magenta: (str) => "\x1B[35m" + str + reset,
  cyan: (str) => "\x1B[36m" + str + reset,
  yellow: (str) => "\x1B[33m" + str + reset,
  black: (str) => "\x1B[30m" + str + reset,
  dim: (str) => "\x1B[2m" + str + reset,
  i: (str) => "\x1B[3m" + str + reset
};
var color_default = cli;

// reducer/node_modules/compromise/src/1-one/output/methods/debug/tags.js
var tagString = function(tags, model5) {
  if (model5.one.tagSet) {
    tags = tags.map((tag) => {
      if (!model5.one.tagSet.hasOwnProperty(tag)) {
        return tag;
      }
      const c2 = model5.one.tagSet[tag].color || "blue";
      return color_default[c2](tag);
    });
  }
  return tags.join(", ");
};
var showTags = function(view) {
  const { docs, model: model5 } = view;
  if (docs.length === 0) {
    console.log(color_default.blue("\n     \u2500\u2500\u2500\u2500\u2500\u2500"));
  }
  docs.forEach((terms) => {
    console.log(color_default.blue("\n  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
    terms.forEach((t3) => {
      const tags = [...t3.tags || []];
      let text = t3.text || "-";
      if (t3.sense) {
        text = `{${t3.normal}/${t3.sense}}`;
      }
      if (t3.implicit) {
        text = "[" + t3.implicit + "]";
      }
      text = color_default.yellow(text);
      let word = "'" + text + "'";
      if (t3.reference) {
        const str2 = view.update([t3.reference]).text("normal");
        word += ` - ${color_default.dim(color_default.i("[" + str2 + "]"))}`;
      }
      word = word.padEnd(18);
      const str = color_default.blue("  \u2502 ") + color_default.i(word) + "  - " + tagString(tags, model5);
      console.log(str);
    });
  });
  console.log("\n");
};
var tags_default = showTags;

// reducer/node_modules/compromise/src/1-one/output/methods/debug/chunks.js
var showChunks = function(view) {
  const { docs } = view;
  console.log("");
  docs.forEach((terms) => {
    const out2 = [];
    terms.forEach((term) => {
      if (term.chunk === "Noun") {
        out2.push(color_default.blue(term.implicit || term.normal));
      } else if (term.chunk === "Verb") {
        out2.push(color_default.green(term.implicit || term.normal));
      } else if (term.chunk === "Adjective") {
        out2.push(color_default.yellow(term.implicit || term.normal));
      } else if (term.chunk === "Pivot") {
        out2.push(color_default.red(term.implicit || term.normal));
      } else {
        out2.push(term.implicit || term.normal);
      }
    });
    console.log(out2.join(" "), "\n");
  });
  console.log("\n");
};
var chunks_default = showChunks;

// reducer/node_modules/compromise/src/1-one/output/methods/debug/highlight.js
var split = (txt, offset2, index3) => {
  const buff = index3 * 9;
  const start2 = offset2.start + buff;
  const end2 = start2 + offset2.length;
  const pre = txt.substring(0, start2);
  const mid = txt.substring(start2, end2);
  const post = txt.substring(end2, txt.length);
  return [pre, mid, post];
};
var spliceIn = function(txt, offset2, index3) {
  const parts = split(txt, offset2, index3);
  return `${parts[0]}${color_default.blue(parts[1])}${parts[2]}`;
};
var showHighlight = function(doc) {
  if (!doc.found) {
    return;
  }
  const bySentence = {};
  doc.fullPointer.forEach((ptr) => {
    bySentence[ptr[0]] = bySentence[ptr[0]] || [];
    bySentence[ptr[0]].push(ptr);
  });
  Object.keys(bySentence).forEach((k2) => {
    const full = doc.update([[Number(k2)]]);
    let txt = full.text();
    const matches3 = doc.update(bySentence[k2]);
    const json = matches3.json({ offset: true });
    json.forEach((obj, i3) => {
      txt = spliceIn(txt, obj.offset, i3);
    });
    console.log(txt);
  });
  console.log("\n");
};
var highlight_default = showHighlight;

// reducer/node_modules/compromise/src/1-one/output/methods/debug/index.js
var debug3 = {
  tags: tags_default,
  clientSide: client_side_default,
  chunks: chunks_default,
  highlight: highlight_default
};
var debug_default3 = debug3;

// reducer/node_modules/compromise/src/1-one/output/plugin.js
var plugin_default8 = {
  api: api_default5,
  methods: {
    one: {
      hash: hash_default,
      debug: debug_default3
    }
  }
};

// reducer/node_modules/compromise/src/1-one/pointers/api/lib/_lib.js
var doesOverlap = function(a2, b) {
  if (a2[0] !== b[0]) {
    return false;
  }
  const [, startA, endA] = a2;
  const [, startB, endB] = b;
  if (startA <= startB && endA > startB) {
    return true;
  }
  if (startB <= startA && endB > startA) {
    return true;
  }
  return false;
};
var getExtent = function(ptrs) {
  let min2 = ptrs[0][1];
  let max3 = ptrs[0][2];
  ptrs.forEach((ptr) => {
    if (ptr[1] < min2) {
      min2 = ptr[1];
    }
    if (ptr[2] > max3) {
      max3 = ptr[2];
    }
  });
  return [ptrs[0][0], min2, max3];
};
var indexN = function(ptrs) {
  const byN = {};
  ptrs.forEach((ref) => {
    byN[ref[0]] = byN[ref[0]] || [];
    byN[ref[0]].push(ref);
  });
  return byN;
};
var uniquePtrs = function(arr) {
  const obj = {};
  for (let i3 = 0; i3 < arr.length; i3 += 1) {
    obj[arr[i3].join(",")] = arr[i3];
  }
  return Object.values(obj);
};

// reducer/node_modules/compromise/src/1-one/pointers/api/lib/split.js
var pivotBy = function(full, m3) {
  const [n3, start2] = full;
  const mStart = m3[1];
  const mEnd = m3[2];
  const res = {};
  if (start2 < mStart) {
    const end2 = mStart < full[2] ? mStart : full[2];
    res.before = [n3, start2, end2];
  }
  res.match = m3;
  if (full[2] > mEnd) {
    res.after = [n3, mEnd, full[2]];
  }
  return res;
};
var doesMatch2 = function(full, m3) {
  return full[1] <= m3[1] && m3[2] <= full[2];
};
var splitAll = function(full, m3) {
  const byN = indexN(m3);
  const res = [];
  full.forEach((ptr) => {
    const [n3] = ptr;
    let matches3 = byN[n3] || [];
    matches3 = matches3.filter((p5) => doesMatch2(ptr, p5));
    if (matches3.length === 0) {
      res.push({ passthrough: ptr });
      return;
    }
    matches3 = matches3.sort((a2, b) => a2[1] - b[1]);
    let carry = ptr;
    matches3.forEach((p5, i3) => {
      const found = pivotBy(carry, p5);
      if (!matches3[i3 + 1]) {
        res.push(found);
      } else {
        res.push({ before: found.before, match: found.match });
        if (found.after) {
          carry = found.after;
        }
      }
    });
  });
  return res;
};
var split_default2 = splitAll;

// reducer/node_modules/compromise/src/1-one/pointers/methods/getDoc.js
var max = 20;
var blindSweep = function(id, doc, n3) {
  for (let i3 = 0; i3 < max; i3 += 1) {
    if (doc[n3 - i3]) {
      const index3 = doc[n3 - i3].findIndex((term) => term.id === id);
      if (index3 !== -1) {
        return [n3 - i3, index3];
      }
    }
    if (doc[n3 + i3]) {
      const index3 = doc[n3 + i3].findIndex((term) => term.id === id);
      if (index3 !== -1) {
        return [n3 + i3, index3];
      }
    }
  }
  return null;
};
var repairEnding = function(ptr, document) {
  const [n3, start2, , , endId] = ptr;
  const terms = document[n3];
  const newEnd = terms.findIndex((t3) => t3.id === endId);
  if (newEnd === -1) {
    ptr[2] = document[n3].length;
    ptr[4] = terms.length ? terms[terms.length - 1].id : null;
  } else {
    ptr[2] = newEnd;
  }
  return document[n3].slice(start2, ptr[2] + 1);
};
var getDoc2 = function(ptrs, document) {
  let doc = [];
  ptrs.forEach((ptr, i3) => {
    if (!ptr) {
      return;
    }
    let [n3, start2, end2, id, endId] = ptr;
    let terms = document[n3] || [];
    if (start2 === void 0) {
      start2 = 0;
    }
    if (end2 === void 0) {
      end2 = terms.length;
    }
    if (id && (!terms[start2] || terms[start2].id !== id)) {
      const wild = blindSweep(id, document, n3);
      if (wild !== null) {
        const len = end2 - start2;
        terms = document[wild[0]].slice(wild[1], wild[1] + len);
        const startId = terms[0] ? terms[0].id : null;
        ptrs[i3] = [wild[0], wild[1], wild[1] + len, startId];
      }
    } else {
      terms = terms.slice(start2, end2);
    }
    if (terms.length === 0) {
      return;
    }
    if (start2 === end2) {
      return;
    }
    if (endId && terms[terms.length - 1].id !== endId) {
      terms = repairEnding(ptr, document);
    }
    doc.push(terms);
  });
  doc = doc.filter((a2) => a2.length > 0);
  return doc;
};
var getDoc_default = getDoc2;

// reducer/node_modules/compromise/src/1-one/pointers/methods/index.js
var termList = function(docs) {
  const arr = [];
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    for (let t3 = 0; t3 < docs[i3].length; t3 += 1) {
      arr.push(docs[i3][t3]);
    }
  }
  return arr;
};
var methods_default5 = {
  one: {
    termList,
    getDoc: getDoc_default,
    pointer: {
      indexN,
      splitAll: split_default2
    }
  }
};

// reducer/node_modules/compromise/src/1-one/pointers/api/lib/union.js
var getUnion = function(a2, b) {
  const both = a2.concat(b);
  const byN = indexN(both);
  let res = [];
  both.forEach((ptr) => {
    const [n3] = ptr;
    if (byN[n3].length === 1) {
      res.push(ptr);
      return;
    }
    const hmm = byN[n3].filter((m3) => doesOverlap(ptr, m3));
    hmm.push(ptr);
    const range = getExtent(hmm);
    res.push(range);
  });
  res = uniquePtrs(res);
  return res;
};
var union_default = getUnion;

// reducer/node_modules/compromise/src/1-one/pointers/api/lib/difference.js
var subtract = function(refs, not) {
  const res = [];
  const found = split_default2(refs, not);
  found.forEach((o2) => {
    if (o2.passthrough) {
      res.push(o2.passthrough);
    }
    if (o2.before) {
      res.push(o2.before);
    }
    if (o2.after) {
      res.push(o2.after);
    }
  });
  return res;
};
var difference_default = subtract;

// reducer/node_modules/compromise/src/1-one/pointers/api/lib/intersection.js
var intersection = function(a2, b) {
  const start2 = a2[1] < b[1] ? b[1] : a2[1];
  const end2 = a2[2] > b[2] ? b[2] : a2[2];
  if (start2 < end2) {
    return [a2[0], start2, end2];
  }
  return null;
};
var getIntersection = function(a2, b) {
  const byN = indexN(b);
  const res = [];
  a2.forEach((ptr) => {
    let hmm = byN[ptr[0]] || [];
    hmm = hmm.filter((p5) => doesOverlap(ptr, p5));
    if (hmm.length === 0) {
      return;
    }
    hmm.forEach((h2) => {
      const overlap = intersection(ptr, h2);
      if (overlap) {
        res.push(overlap);
      }
    });
  });
  return res;
};
var intersection_default = getIntersection;

// reducer/node_modules/compromise/src/1-one/pointers/api/index.js
var isArray8 = function(arr) {
  return Object.prototype.toString.call(arr) === "[object Array]";
};
var getDoc3 = (m3, view) => {
  if (typeof m3 === "string" || isArray8(m3)) {
    return view.match(m3);
  }
  if (!m3) {
    return view.none();
  }
  return m3;
};
var addIds3 = function(ptrs, docs) {
  return ptrs.map((ptr) => {
    const [n3, start2] = ptr;
    if (docs[n3] && docs[n3][start2]) {
      ptr[3] = docs[n3][start2].id;
    }
    return ptr;
  });
};
var methods15 = {};
methods15.union = function(m3) {
  m3 = getDoc3(m3, this);
  let ptrs = union_default(this.fullPointer, m3.fullPointer);
  ptrs = addIds3(ptrs, this.document);
  return this.toView(ptrs);
};
methods15.and = methods15.union;
methods15.intersection = function(m3) {
  m3 = getDoc3(m3, this);
  let ptrs = intersection_default(this.fullPointer, m3.fullPointer);
  ptrs = addIds3(ptrs, this.document);
  return this.toView(ptrs);
};
methods15.not = function(m3) {
  m3 = getDoc3(m3, this);
  let ptrs = difference_default(this.fullPointer, m3.fullPointer);
  ptrs = addIds3(ptrs, this.document);
  return this.toView(ptrs);
};
methods15.difference = methods15.not;
methods15.complement = function() {
  const doc = this.all();
  let ptrs = difference_default(doc.fullPointer, this.fullPointer);
  ptrs = addIds3(ptrs, this.document);
  return this.toView(ptrs);
};
methods15.settle = function() {
  let ptrs = this.fullPointer;
  ptrs.forEach((ptr) => {
    ptrs = union_default(ptrs, [ptr]);
  });
  ptrs = addIds3(ptrs, this.document);
  return this.update(ptrs);
};
var addAPI4 = function(View2) {
  Object.assign(View2.prototype, methods15);
};
var api_default6 = addAPI4;

// reducer/node_modules/compromise/src/1-one/pointers/plugin.js
var plugin_default9 = {
  methods: methods_default5,
  api: api_default6
};

// reducer/node_modules/compromise/src/1-one/sweep/lib.js
var lib_default3 = {
  // compile a list of matches into a match-net
  buildNet: function(matches3) {
    const methods17 = this.methods();
    const net3 = methods17.one.buildNet(matches3, this.world());
    net3.isNet = true;
    return net3;
  }
};

// reducer/node_modules/compromise/src/1-one/sweep/api.js
var api = function(View2) {
  View2.prototype.sweep = function(net3, opts2 = {}) {
    const { world: world2, docs } = this;
    const { methods: methods17 } = world2;
    let found = methods17.one.bulkMatch(docs, net3, this.methods, opts2);
    if (opts2.tagger !== false) {
      methods17.one.bulkTagger(found, docs, this.world);
    }
    found = found.map((o2) => {
      const ptr = o2.pointer;
      const term = docs[ptr[0]][ptr[1]];
      const len = ptr[2] - ptr[1];
      if (term.index) {
        o2.pointer = [
          term.index[0],
          term.index[1],
          ptr[1] + len
        ];
      }
      return o2;
    });
    const ptrs = found.map((o2) => o2.pointer);
    found = found.map((obj) => {
      obj.view = this.update([obj.pointer]);
      delete obj.regs;
      delete obj.needs;
      delete obj.pointer;
      delete obj._expanded;
      return obj;
    });
    return {
      view: this.update(ptrs),
      found
    };
  };
};
var api_default7 = api;

// reducer/node_modules/compromise/src/1-one/sweep/methods/buildNet/01-parse.js
var getTokenNeeds = function(reg) {
  if (reg.optional === true || reg.negative === true) {
    return null;
  }
  if (reg.tag) {
    return "#" + reg.tag;
  }
  if (reg.word) {
    return reg.word;
  }
  if (reg.switch) {
    return `%${reg.switch}%`;
  }
  return null;
};
var getNeeds = function(regs) {
  const needs = [];
  regs.forEach((reg) => {
    needs.push(getTokenNeeds(reg));
    if (reg.operator === "and" && reg.choices) {
      reg.choices.forEach((oneSide) => {
        oneSide.forEach((r2) => {
          needs.push(getTokenNeeds(r2));
        });
      });
    }
  });
  return needs.filter((str) => str);
};
var getWants = function(regs) {
  const wants = [];
  let count = 0;
  regs.forEach((reg) => {
    if (reg.operator === "or" && !reg.optional && !reg.negative) {
      if (reg.fastOr) {
        Array.from(reg.fastOr).forEach((w) => {
          wants.push(w);
        });
      }
      if (reg.choices) {
        reg.choices.forEach((rs) => {
          rs.forEach((r2) => {
            const n3 = getTokenNeeds(r2);
            if (n3) {
              wants.push(n3);
            }
          });
        });
      }
      count += 1;
    }
  });
  return { wants, count };
};
var parse = function(matches3, world2) {
  const parseMatch = world2.methods.one.parseMatch;
  matches3.forEach((obj) => {
    obj.regs = parseMatch(obj.match, {}, world2);
    if (typeof obj.ifNo === "string") {
      obj.ifNo = [obj.ifNo];
    }
    if (obj.notIf) {
      obj.notIf = parseMatch(obj.notIf, {}, world2);
    }
    obj.needs = getNeeds(obj.regs);
    const { wants, count } = getWants(obj.regs);
    obj.wants = wants;
    obj.minWant = count;
    obj.minWords = obj.regs.filter((o2) => !o2.optional).length;
  });
  return matches3;
};
var parse_default = parse;

// reducer/node_modules/compromise/src/1-one/sweep/methods/buildNet/index.js
var buildNet = function(matches3, world2) {
  matches3 = parse_default(matches3, world2);
  const hooks2 = {};
  matches3.forEach((obj) => {
    obj.needs.forEach((str) => {
      hooks2[str] = Array.isArray(hooks2[str]) ? hooks2[str] : [];
      hooks2[str].push(obj);
    });
    obj.wants.forEach((str) => {
      hooks2[str] = Array.isArray(hooks2[str]) ? hooks2[str] : [];
      hooks2[str].push(obj);
    });
  });
  Object.keys(hooks2).forEach((k2) => {
    const already = {};
    hooks2[k2] = hooks2[k2].filter((obj) => {
      if (typeof already[obj.match] === "boolean") {
        return false;
      }
      already[obj.match] = true;
      return true;
    });
  });
  const always = matches3.filter((o2) => o2.needs.length === 0 && o2.wants.length === 0);
  return {
    hooks: hooks2,
    always
  };
};
var buildNet_default = buildNet;

// reducer/node_modules/compromise/src/1-one/sweep/methods/sweep/01-getHooks.js
var getHooks = function(docCaches, hooks2) {
  return docCaches.map((set, i3) => {
    let maybe = [];
    Object.keys(hooks2).forEach((k2) => {
      if (docCaches[i3].has(k2)) {
        maybe = maybe.concat(hooks2[k2]);
      }
    });
    const already = {};
    maybe = maybe.filter((m3) => {
      if (typeof already[m3.match] === "boolean") {
        return false;
      }
      already[m3.match] = true;
      return true;
    });
    return maybe;
  });
};
var getHooks_default = getHooks;

// reducer/node_modules/compromise/src/1-one/sweep/methods/sweep/02-trim-down.js
var localTrim = function(maybeList, docCache) {
  return maybeList.map((list4, n3) => {
    const haves = docCache[n3];
    list4 = list4.filter((obj) => {
      return obj.needs.every((need) => haves.has(need));
    });
    list4 = list4.filter((obj) => {
      if (obj.ifNo !== void 0 && obj.ifNo.some((no) => haves.has(no)) === true) {
        return false;
      }
      return true;
    });
    list4 = list4.filter((obj) => {
      if (obj.wants.length === 0) {
        return true;
      }
      const found = obj.wants.filter((str) => haves.has(str)).length;
      return found >= obj.minWant;
    });
    return list4;
  });
};
var trim_down_default = localTrim;

// reducer/node_modules/compromise/src/1-one/sweep/methods/sweep/04-runMatch.js
var runMatch2 = function(maybeList, document, docCache, methods17, opts2) {
  const results = [];
  for (let n3 = 0; n3 < maybeList.length; n3 += 1) {
    for (let i3 = 0; i3 < maybeList[n3].length; i3 += 1) {
      const m3 = maybeList[n3][i3];
      const res = methods17.one.match([document[n3]], m3);
      if (res.ptrs.length > 0) {
        res.ptrs.forEach((ptr) => {
          ptr[0] = n3;
          const todo = Object.assign({}, m3, { pointer: ptr });
          if (m3.unTag !== void 0) {
            todo.unTag = m3.unTag;
          }
          results.push(todo);
        });
        if (opts2.matchOne === true) {
          return [results[0]];
        }
      }
    }
  }
  return results;
};
var runMatch_default = runMatch2;

// reducer/node_modules/compromise/src/1-one/sweep/methods/sweep/index.js
var tooSmall = function(maybeList, document) {
  return maybeList.map((arr, i3) => {
    const termCount = document[i3].length;
    arr = arr.filter((o2) => {
      return termCount >= o2.minWords;
    });
    return arr;
  });
};
var sweep = function(document, net3, methods17, opts2 = {}) {
  const docCache = methods17.one.cacheDoc(document);
  let maybeList = getHooks_default(docCache, net3.hooks);
  maybeList = trim_down_default(maybeList, docCache, document);
  if (net3.always.length > 0) {
    maybeList = maybeList.map((arr) => arr.concat(net3.always));
  }
  maybeList = tooSmall(maybeList, document);
  const results = runMatch_default(maybeList, document, docCache, methods17, opts2);
  return results;
};
var sweep_default = sweep;

// reducer/node_modules/compromise/src/1-one/sweep/methods/tagger/canBe.js
var canBe = function(terms, tag, model5) {
  const tagSet = model5.one.tagSet;
  if (!tagSet.hasOwnProperty(tag)) {
    return true;
  }
  const not = tagSet[tag].not || [];
  for (let i3 = 0; i3 < terms.length; i3 += 1) {
    const term = terms[i3];
    for (let k2 = 0; k2 < not.length; k2 += 1) {
      if (term.tags.has(not[k2]) === true) {
        return false;
      }
    }
  }
  return true;
};
var canBe_default = canBe;

// reducer/node_modules/compromise/src/1-one/sweep/methods/tagger/index.js
var tagger = function(list4, document, world2) {
  const { model: model5, methods: methods17 } = world2;
  const { getDoc: getDoc4, setTag: setTag2, unTag: unTag2 } = methods17.one;
  const looksPlural2 = methods17.two.looksPlural;
  if (list4.length === 0) {
    return list4;
  }
  const env2 = typeof process === "undefined" || !process.env ? self.env || {} : process.env;
  if (env2.DEBUG_TAGS) {
    console.log(`

  \x1B[32m\u2192 ${list4.length} post-tagger:\x1B[0m`);
  }
  return list4.map((todo) => {
    if (!todo.tag && !todo.chunk && !todo.unTag) {
      return;
    }
    const reason = todo.reason || todo.match;
    const terms = getDoc4([todo.pointer], document)[0];
    if (todo.safe === true) {
      if (canBe_default(terms, todo.tag, model5) === false) {
        return;
      }
      if (terms[terms.length - 1].post === "-") {
        return;
      }
    }
    if (todo.tag !== void 0) {
      setTag2(terms, todo.tag, world2, todo.safe, `[post] '${reason}'`);
      if (todo.tag === "Noun" && looksPlural2) {
        const term = terms[terms.length - 1];
        if (looksPlural2(term.text)) {
          setTag2([term], "Plural", world2, todo.safe, "quick-plural");
        } else {
          setTag2([term], "Singular", world2, todo.safe, "quick-singular");
        }
      }
      if (todo.freeze === true) {
        terms.forEach((term) => term.frozen = true);
      }
    }
    if (todo.unTag !== void 0) {
      unTag2(terms, todo.unTag, world2, todo.safe, reason);
    }
    if (todo.chunk) {
      terms.forEach((t3) => t3.chunk = todo.chunk);
    }
  });
};
var tagger_default = tagger;

// reducer/node_modules/compromise/src/1-one/sweep/methods/index.js
var methods_default6 = {
  buildNet: buildNet_default,
  bulkMatch: sweep_default,
  bulkTagger: tagger_default
};

// reducer/node_modules/compromise/src/1-one/sweep/plugin.js
var plugin_default10 = {
  lib: lib_default3,
  api: api_default7,
  methods: {
    one: methods_default6
  }
};

// reducer/node_modules/compromise/src/1-one/tag/methods/setTag.js
var isMulti = / /;
var addChunk = function(term, tag) {
  if (tag === "Noun") {
    term.chunk = tag;
  }
  if (tag === "Verb") {
    term.chunk = tag;
  }
};
var tagTerm = function(term, tag, tagSet, isSafe) {
  if (term.tags.has(tag) === true) {
    return null;
  }
  if (tag === ".") {
    return null;
  }
  if (term.frozen === true) {
    isSafe = true;
  }
  const known = tagSet[tag];
  if (known) {
    if (known.not && known.not.length > 0) {
      for (let o2 = 0; o2 < known.not.length; o2 += 1) {
        if (isSafe === true && term.tags.has(known.not[o2])) {
          return null;
        }
        term.tags.delete(known.not[o2]);
      }
    }
    if (known.parents && known.parents.length > 0) {
      for (let o2 = 0; o2 < known.parents.length; o2 += 1) {
        term.tags.add(known.parents[o2]);
        addChunk(term, known.parents[o2]);
      }
    }
  }
  term.tags.add(tag);
  term.dirty = true;
  addChunk(term, tag);
  return true;
};
var multiTag = function(terms, tagString2, tagSet, isSafe) {
  const tags = tagString2.split(isMulti);
  terms.forEach((term, i3) => {
    let tag = tags[i3];
    if (tag) {
      tag = tag.replace(/^#/, "");
      tagTerm(term, tag, tagSet, isSafe);
    }
  });
};
var isArray9 = function(arr) {
  return Object.prototype.toString.call(arr) === "[object Array]";
};
var log = (terms, tag, reason = "") => {
  const yellow = (str) => "\x1B[33m\x1B[3m" + str + "\x1B[0m";
  const i3 = (str) => "\x1B[3m" + str + "\x1B[0m";
  const word = terms.map((t3) => {
    return t3.text || "[" + t3.implicit + "]";
  }).join(" ");
  if (typeof tag !== "string" && tag.length > 2) {
    tag = tag.slice(0, 2).join(", #") + " +";
  }
  tag = typeof tag !== "string" ? tag.join(", #") : tag;
  console.log(` ${yellow(word).padEnd(24)} \x1B[32m\u2192\x1B[0m #${tag.padEnd(22)}  ${i3(reason)}`);
};
var setTag = function(terms, tag, world2 = {}, isSafe, reason) {
  const tagSet = world2.model.one.tagSet || {};
  if (!tag) {
    return;
  }
  const env2 = typeof process === "undefined" || !process.env ? self.env || {} : process.env;
  if (env2 && env2.DEBUG_TAGS) {
    log(terms, tag, reason);
  }
  if (isArray9(tag) === true) {
    tag.forEach((tg) => setTag(terms, tg, world2, isSafe));
    return;
  }
  if (typeof tag !== "string") {
    console.warn(`compromise: Invalid tag '${tag}'`);
    return;
  }
  tag = tag.trim();
  if (isMulti.test(tag)) {
    multiTag(terms, tag, tagSet, isSafe);
    return;
  }
  tag = tag.replace(/^#/, "");
  for (let i3 = 0; i3 < terms.length; i3 += 1) {
    tagTerm(terms[i3], tag, tagSet, isSafe);
  }
};
var setTag_default = setTag;

// reducer/node_modules/compromise/src/1-one/tag/methods/unTag.js
var unTag = function(terms, tag, tagSet) {
  tag = tag.trim().replace(/^#/, "");
  for (let i3 = 0; i3 < terms.length; i3 += 1) {
    const term = terms[i3];
    if (term.frozen === true) {
      continue;
    }
    if (tag === "*") {
      term.tags.clear();
      continue;
    }
    const known = tagSet[tag];
    if (known && known.children.length > 0) {
      for (let o2 = 0; o2 < known.children.length; o2 += 1) {
        term.tags.delete(known.children[o2]);
      }
    }
    term.tags.delete(tag);
  }
};
var unTag_default = unTag;

// reducer/node_modules/compromise/src/1-one/tag/methods/canBe.js
var canBe2 = function(term, tag, tagSet) {
  if (!tagSet.hasOwnProperty(tag)) {
    return true;
  }
  const not = tagSet[tag].not || [];
  for (let i3 = 0; i3 < not.length; i3 += 1) {
    if (term.tags.has(not[i3])) {
      return false;
    }
  }
  return true;
};
var canBe_default2 = canBe2;

// reducer/node_modules/grad-school/builds/grad-school.mjs
var e = function(e2) {
  return e2.children = e2.children || [], e2._cache = e2._cache || {}, e2.props = e2.props || {}, e2._cache.parents = e2._cache.parents || [], e2._cache.children = e2._cache.children || [], e2;
};
var t2 = /^ *(#|\/\/)/;
var n = function(t3) {
  let n3 = t3.trim().split(/->/), r2 = [];
  n3.forEach(((t4) => {
    r2 = r2.concat((function(t5) {
      if (!(t5 = t5.trim())) return null;
      if (/^\[/.test(t5) && /\]$/.test(t5)) {
        let n4 = (t5 = (t5 = t5.replace(/^\[/, "")).replace(/\]$/, "")).split(/,/);
        return n4 = n4.map(((e2) => e2.trim())).filter(((e2) => e2)), n4 = n4.map(((t6) => e({ id: t6 }))), n4;
      }
      return [e({ id: t5 })];
    })(t4));
  })), r2 = r2.filter(((e2) => e2));
  let i3 = r2[0];
  for (let e2 = 1; e2 < r2.length; e2 += 1) i3.children.push(r2[e2]), i3 = r2[e2];
  return r2[0];
};
var r = (e2, t3) => {
  let n3 = [], r2 = [e2];
  for (; r2.length > 0; ) {
    let e3 = r2.pop();
    n3.push(e3), e3.children && e3.children.forEach(((n4) => {
      t3 && t3(e3, n4), r2.push(n4);
    }));
  }
  return n3;
};
var i2 = (e2) => "[object Array]" === Object.prototype.toString.call(e2);
var c = (e2) => (e2 = e2 || "").trim();
var s = function(c2 = []) {
  return "string" == typeof c2 ? (function(r2) {
    let i3 = r2.split(/\r?\n/), c3 = [];
    i3.forEach(((e2) => {
      if (!e2.trim() || t2.test(e2)) return;
      let r3 = ((e3) => {
        const t3 = /^( {2}|\t)/;
        let n3 = 0;
        for (; t3.test(e3); ) e3 = e3.replace(t3, ""), n3 += 1;
        return n3;
      })(e2);
      c3.push({ indent: r3, node: n(e2) });
    }));
    let s4 = (function(e2) {
      let t3 = { children: [] };
      return e2.forEach(((n3, r3) => {
        0 === n3.indent ? t3.children = t3.children.concat(n3.node) : e2[r3 - 1] && (function(e3, t4) {
          let n4 = e3[t4].indent;
          for (; t4 >= 0; t4 -= 1) if (e3[t4].indent < n4) return e3[t4];
          return e3[0];
        })(e2, r3).node.children.push(n3.node);
      })), t3;
    })(c3);
    return s4 = e(s4), s4;
  })(c2) : i2(c2) ? (function(t3) {
    let n3 = {};
    t3.forEach(((e2) => {
      n3[e2.id] = e2;
    }));
    let r2 = e({});
    return t3.forEach(((t4) => {
      if ((t4 = e(t4)).parent) if (n3.hasOwnProperty(t4.parent)) {
        let e2 = n3[t4.parent];
        delete t4.parent, e2.children.push(t4);
      } else console.warn(`[Grad] - missing node '${t4.parent}'`);
      else r2.children.push(t4);
    })), r2;
  })(c2) : (r(s3 = c2).forEach(e), s3);
  var s3;
};
var h = (e2) => "\x1B[31m" + e2 + "\x1B[0m";
var o = (e2) => "\x1B[2m" + e2 + "\x1B[0m";
var l = function(e2, t3) {
  let n3 = "-> ";
  t3 && (n3 = o("\u2192 "));
  let i3 = "";
  return r(e2).forEach(((e3, r2) => {
    let c2 = e3.id || "";
    if (t3 && (c2 = h(c2)), 0 === r2 && !e3.id) return;
    let s3 = e3._cache.parents.length;
    i3 += "    ".repeat(s3) + n3 + c2 + "\n";
  })), i3;
};
var a = function(e2) {
  let t3 = r(e2);
  t3.forEach(((e3) => {
    delete (e3 = Object.assign({}, e3)).children;
  }));
  let n3 = t3[0];
  return n3 && !n3.id && 0 === Object.keys(n3.props).length && t3.shift(), t3;
};
var p = { text: l, txt: l, array: a, flat: a };
var d = function(e2, t3) {
  return "nested" === t3 || "json" === t3 ? e2 : "debug" === t3 ? (console.log(l(e2, true)), null) : p.hasOwnProperty(t3) ? p[t3](e2) : e2;
};
var u = (e2) => {
  r(e2, ((e3, t3) => {
    e3.id && (e3._cache.parents = e3._cache.parents || [], t3._cache.parents = e3._cache.parents.concat([e3.id]));
  }));
};
var f = (e2, t3) => (Object.keys(t3).forEach(((n3) => {
  if (t3[n3] instanceof Set) {
    let r2 = e2[n3] || /* @__PURE__ */ new Set();
    e2[n3] = /* @__PURE__ */ new Set([...r2, ...t3[n3]]);
  } else {
    if (((e3) => e3 && "object" == typeof e3 && !Array.isArray(e3))(t3[n3])) {
      let r2 = e2[n3] || {};
      e2[n3] = Object.assign({}, t3[n3], r2);
    } else i2(t3[n3]) ? e2[n3] = t3[n3].concat(e2[n3] || []) : void 0 === e2[n3] && (e2[n3] = t3[n3]);
  }
})), e2);
var j = /\//;
var g = class _g {
  constructor(e2 = {}) {
    Object.defineProperty(this, "json", { enumerable: false, value: e2, writable: true });
  }
  get children() {
    return this.json.children;
  }
  get id() {
    return this.json.id;
  }
  get found() {
    return this.json.id || this.json.children.length > 0;
  }
  props(e2 = {}) {
    let t3 = this.json.props || {};
    return "string" == typeof e2 && (t3[e2] = true), this.json.props = Object.assign(t3, e2), this;
  }
  get(t3) {
    if (t3 = c(t3), !j.test(t3)) {
      let e2 = this.json.children.find(((e3) => e3.id === t3));
      return new _g(e2);
    }
    let n3 = ((e2, t4) => {
      let n4 = ((e3) => "string" != typeof e3 ? e3 : (e3 = e3.replace(/^\//, "")).split(/\//))(t4 = t4 || "");
      for (let t5 = 0; t5 < n4.length; t5 += 1) {
        let r2 = e2.children.find(((e3) => e3.id === n4[t5]));
        if (!r2) return null;
        e2 = r2;
      }
      return e2;
    })(this.json, t3) || e({});
    return new _g(n3);
  }
  add(t3, n3 = {}) {
    if (i2(t3)) return t3.forEach(((e2) => this.add(c(e2), n3))), this;
    t3 = c(t3);
    let r2 = e({ id: t3, props: n3 });
    return this.json.children.push(r2), new _g(r2);
  }
  remove(e2) {
    return e2 = c(e2), this.json.children = this.json.children.filter(((t3) => t3.id !== e2)), this;
  }
  nodes() {
    return r(this.json).map(((e2) => (delete (e2 = Object.assign({}, e2)).children, e2)));
  }
  cache() {
    return ((e2) => {
      let t3 = r(e2, ((e3, t4) => {
        e3.id && (e3._cache.parents = e3._cache.parents || [], e3._cache.children = e3._cache.children || [], t4._cache.parents = e3._cache.parents.concat([e3.id]));
      })), n3 = {};
      t3.forEach(((e3) => {
        e3.id && (n3[e3.id] = e3);
      })), t3.forEach(((e3) => {
        e3._cache.parents.forEach(((t4) => {
          n3.hasOwnProperty(t4) && n3[t4]._cache.children.push(e3.id);
        }));
      })), e2._cache.children = Object.keys(n3);
    })(this.json), this;
  }
  list() {
    return r(this.json);
  }
  fillDown() {
    var e2;
    return e2 = this.json, r(e2, ((e3, t3) => {
      t3.props = f(t3.props, e3.props);
    })), this;
  }
  depth() {
    u(this.json);
    let e2 = r(this.json), t3 = e2.length > 1 ? 1 : 0;
    return e2.forEach(((e3) => {
      if (0 === e3._cache.parents.length) return;
      let n3 = e3._cache.parents.length + 1;
      n3 > t3 && (t3 = n3);
    })), t3;
  }
  out(e2) {
    return u(this.json), d(this.json, e2);
  }
  debug() {
    return u(this.json), d(this.json, "debug"), this;
  }
};
var _ = function(e2) {
  let t3 = s(e2);
  return new g(t3);
};
_.prototype.plugin = function(e2) {
  e2(this);
};

// reducer/node_modules/compromise/src/1-one/tag/methods/addTags/_colors.js
var colors = {
  Noun: "blue",
  Verb: "green",
  Negative: "green",
  Date: "red",
  Value: "red",
  Adjective: "magenta",
  Preposition: "cyan",
  Conjunction: "cyan",
  Determiner: "cyan",
  Hyphenated: "cyan",
  Adverb: "cyan"
};
var colors_default = colors;

// reducer/node_modules/compromise/src/1-one/tag/methods/addTags/02-fmt.js
var getColor = function(node) {
  if (colors_default.hasOwnProperty(node.id)) {
    return colors_default[node.id];
  }
  if (colors_default.hasOwnProperty(node.is)) {
    return colors_default[node.is];
  }
  const found = node._cache.parents.find((c2) => colors_default[c2]);
  return colors_default[found];
};
var fmt = function(nodes) {
  const res = {};
  nodes.forEach((node) => {
    const { not, also, is, novel } = node.props;
    let parents = node._cache.parents;
    if (also) {
      parents = parents.concat(also);
    }
    res[node.id] = {
      is,
      not,
      novel,
      also,
      parents,
      children: node._cache.children,
      color: getColor(node)
    };
  });
  Object.keys(res).forEach((k2) => {
    const nots = new Set(res[k2].not);
    res[k2].not.forEach((not) => {
      if (res[not]) {
        res[not].children.forEach((tag) => nots.add(tag));
      }
    });
    res[k2].not = Array.from(nots);
  });
  return res;
};
var fmt_default = fmt;

// reducer/node_modules/compromise/src/1-one/tag/methods/addTags/01-validate.js
var toArr = function(input) {
  if (!input) {
    return [];
  }
  if (typeof input === "string") {
    return [input];
  }
  return input;
};
var addImplied = function(tags, already) {
  Object.keys(tags).forEach((k2) => {
    if (tags[k2].isA) {
      tags[k2].is = tags[k2].isA;
    }
    if (tags[k2].notA) {
      tags[k2].not = tags[k2].notA;
    }
    if (tags[k2].is && typeof tags[k2].is === "string") {
      if (!already.hasOwnProperty(tags[k2].is) && !tags.hasOwnProperty(tags[k2].is)) {
        tags[tags[k2].is] = {};
      }
    }
    if (tags[k2].not && typeof tags[k2].not === "string" && !tags.hasOwnProperty(tags[k2].not)) {
      if (!already.hasOwnProperty(tags[k2].not) && !tags.hasOwnProperty(tags[k2].not)) {
        tags[tags[k2].not] = {};
      }
    }
  });
  return tags;
};
var validate = function(tags, already) {
  tags = addImplied(tags, already);
  Object.keys(tags).forEach((k2) => {
    tags[k2].children = toArr(tags[k2].children);
    tags[k2].not = toArr(tags[k2].not);
  });
  Object.keys(tags).forEach((k2) => {
    const nots = tags[k2].not || [];
    nots.forEach((no) => {
      if (tags[no] && tags[no].not) {
        tags[no].not.push(k2);
      }
    });
  });
  return tags;
};
var validate_default = validate;

// reducer/node_modules/compromise/src/1-one/tag/methods/addTags/index.js
var compute3 = function(allTags2) {
  const flatList = Object.keys(allTags2).map((k2) => {
    const o2 = allTags2[k2];
    const props = { not: new Set(o2.not), also: o2.also, is: o2.is, novel: o2.novel };
    return { id: k2, parent: o2.is, props, children: [] };
  });
  const graph = _(flatList).cache().fillDown();
  return graph.out("array");
};
var fromUser = function(tags) {
  Object.keys(tags).forEach((k2) => {
    tags[k2] = Object.assign({}, tags[k2]);
    tags[k2].novel = true;
  });
  return tags;
};
var addTags = function(tags, already) {
  if (Object.keys(already).length > 0) {
    tags = fromUser(tags);
  }
  tags = validate_default(tags, already);
  const allTags2 = Object.assign({}, already, tags);
  const nodes = compute3(allTags2);
  const res = fmt_default(nodes);
  return res;
};
var addTags_default = addTags;

// reducer/node_modules/compromise/src/1-one/tag/methods/index.js
var methods_default7 = {
  one: {
    setTag: setTag_default,
    unTag: unTag_default,
    addTags: addTags_default,
    canBe: canBe_default2
  }
};

// reducer/node_modules/compromise/src/1-one/tag/api/tag.js
var isArray10 = function(arr) {
  return Object.prototype.toString.call(arr) === "[object Array]";
};
var fns5 = {
  /** add a given tag, to all these terms */
  tag: function(input, reason = "", isSafe) {
    if (!this.found || !input) {
      return this;
    }
    const terms = this.termList();
    if (terms.length === 0) {
      return this;
    }
    const { methods: methods17, verbose: verbose2, world: world2 } = this;
    if (verbose2 === true) {
      console.log(" +  ", input, reason || "");
    }
    if (isArray10(input)) {
      input.forEach((tag) => methods17.one.setTag(terms, tag, world2, isSafe, reason));
    } else {
      methods17.one.setTag(terms, input, world2, isSafe, reason);
    }
    this.uncache();
    return this;
  },
  /** add a given tag, only if it is consistent */
  tagSafe: function(input, reason = "") {
    return this.tag(input, reason, true);
  },
  /** remove a given tag from all these terms */
  unTag: function(input, reason) {
    if (!this.found || !input) {
      return this;
    }
    const terms = this.termList();
    if (terms.length === 0) {
      return this;
    }
    const { methods: methods17, verbose: verbose2, model: model5 } = this;
    if (verbose2 === true) {
      console.log(" -  ", input, reason || "");
    }
    const tagSet = model5.one.tagSet;
    if (isArray10(input)) {
      input.forEach((tag) => methods17.one.unTag(terms, tag, tagSet));
    } else {
      methods17.one.unTag(terms, input, tagSet);
    }
    this.uncache();
    return this;
  },
  /** return only the terms that can be this tag  */
  canBe: function(tag) {
    tag = tag.replace(/^#/, "");
    const tagSet = this.model.one.tagSet;
    const canBe3 = this.methods.one.canBe;
    const nope2 = [];
    this.document.forEach((terms, n3) => {
      terms.forEach((term, i3) => {
        if (!canBe3(term, tag, tagSet)) {
          nope2.push([n3, i3, i3 + 1]);
        }
      });
    });
    const noDoc = this.update(nope2);
    return this.difference(noDoc);
  }
};
var tag_default = fns5;

// reducer/node_modules/compromise/src/1-one/tag/api/index.js
var tagAPI = function(View2) {
  Object.assign(View2.prototype, tag_default);
};
var api_default8 = tagAPI;

// reducer/node_modules/compromise/src/1-one/tag/lib.js
var addTags2 = function(tags) {
  const { model: model5, methods: methods17 } = this.world();
  const tagSet = model5.one.tagSet;
  const fn = methods17.one.addTags;
  const res = fn(tags, tagSet);
  model5.one.tagSet = res;
  return this;
};
var lib_default4 = { addTags: addTags2 };

// reducer/node_modules/compromise/src/1-one/tag/compute/tagRank.js
var boringTags = /* @__PURE__ */ new Set(["Auxiliary", "Possessive"]);
var sortByKids = function(tags, tagSet) {
  tags = tags.sort((a2, b) => {
    if (boringTags.has(a2) || !tagSet.hasOwnProperty(b)) {
      return 1;
    }
    if (boringTags.has(b) || !tagSet.hasOwnProperty(a2)) {
      return -1;
    }
    let kids = tagSet[a2].children || [];
    const aKids = kids.length;
    kids = tagSet[b].children || [];
    const bKids = kids.length;
    return aKids - bKids;
  });
  return tags;
};
var tagRank = function(view) {
  const { document, world: world2 } = view;
  const tagSet = world2.model.one.tagSet;
  document.forEach((terms) => {
    terms.forEach((term) => {
      const tags = Array.from(term.tags);
      term.tagRank = sortByKids(tags, tagSet);
    });
  });
};
var tagRank_default = tagRank;

// reducer/node_modules/compromise/src/1-one/tag/plugin.js
var plugin_default11 = {
  model: {
    one: { tagSet: {} }
  },
  compute: {
    tagRank: tagRank_default
  },
  methods: methods_default7,
  api: api_default8,
  lib: lib_default4
};

// reducer/node_modules/compromise/src/1-one/tokenize/methods/01-sentences/01-simple-split.js
var initSplit = /([.!?\u203D\u2E18\u203C\u2047-\u2049\u3002]+\s)/g;
var splitsOnly = /^[.!?\u203D\u2E18\u203C\u2047-\u2049\u3002]+\s$/;
var newLine = /((?:\r?\n|\r)+)/;
var basicSplit = function(text) {
  const all4 = [];
  const lines = text.split(newLine);
  for (let i3 = 0; i3 < lines.length; i3++) {
    const arr = lines[i3].split(initSplit);
    for (let o2 = 0; o2 < arr.length; o2++) {
      if (arr[o2 + 1] && splitsOnly.test(arr[o2 + 1]) === true) {
        arr[o2] += arr[o2 + 1];
        arr[o2 + 1] = "";
      }
      if (arr[o2] !== "") {
        all4.push(arr[o2]);
      }
    }
  }
  return all4;
};
var simple_split_default = basicSplit;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/01-sentences/02-simple-merge.js
var hasLetter = /[a-z0-9\u00C0-\u00FF\u00a9\u00ae\u2000-\u3300\ud000-\udfff]/i;
var hasSomething = /\S/;
var notEmpty = function(splits) {
  const chunks2 = [];
  for (let i3 = 0; i3 < splits.length; i3++) {
    const s3 = splits[i3];
    if (s3 === void 0 || s3 === "") {
      continue;
    }
    if (hasSomething.test(s3) === false || hasLetter.test(s3) === false) {
      if (chunks2[chunks2.length - 1]) {
        chunks2[chunks2.length - 1] += s3;
        continue;
      } else if (splits[i3 + 1]) {
        splits[i3 + 1] = s3 + splits[i3 + 1];
        continue;
      }
    }
    chunks2.push(s3);
  }
  return chunks2;
};
var simple_merge_default = notEmpty;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/01-sentences/03-smart-merge.js
var hasNewline = function(c2) {
  return Boolean(c2.match(/\n$/));
};
var smartMerge = function(chunks2, world2) {
  const isSentence2 = world2.methods.one.tokenize.isSentence;
  const abbrevs = world2.model.one.abbreviations || /* @__PURE__ */ new Set();
  const sentences = [];
  for (let i3 = 0; i3 < chunks2.length; i3++) {
    const c2 = chunks2[i3];
    if (chunks2[i3 + 1] && !isSentence2(c2, abbrevs) && !hasNewline(c2)) {
      chunks2[i3 + 1] = c2 + (chunks2[i3 + 1] || "");
    } else if (c2 && c2.length > 0) {
      sentences.push(c2);
      chunks2[i3] = "";
    }
  }
  return sentences;
};
var smart_merge_default = smartMerge;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/01-sentences/04-quote-merge.js
var MAX_QUOTE = 280;
var pairs = {
  '"': '"',
  // 'StraightDoubleQuotes'
  "\uFF02": "\uFF02",
  // 'StraightDoubleQuotesWide'
  // '\u0027': '\u0027', // 'StraightSingleQuotes'
  "\u201C": "\u201D",
  // 'CommaDoubleQuotes'
  // '\u2018': '\u2019', // 'CommaSingleQuotes'
  "\u201F": "\u201D",
  // 'CurlyDoubleQuotesReversed'
  // '\u201B': '\u2019', // 'CurlySingleQuotesReversed'
  "\u201E": "\u201D",
  // 'LowCurlyDoubleQuotes'
  "\u2E42": "\u201D",
  // 'LowCurlyDoubleQuotesReversed'
  "\u201A": "\u2019",
  // 'LowCurlySingleQuotes'
  "\xAB": "\xBB",
  // 'AngleDoubleQuotes'
  "\u2039": "\u203A",
  // 'AngleSingleQuotes'
  "\u2035": "\u2032",
  // 'PrimeSingleQuotes'
  "\u2036": "\u2033",
  // 'PrimeDoubleQuotes'
  "\u2037": "\u2034",
  // 'PrimeTripleQuotes'
  "\u301D": "\u301E",
  // 'PrimeDoubleQuotes'
  // '\u0060': '\u00B4', // 'PrimeSingleQuotes'
  "\u301F": "\u301E"
  // 'LowPrimeDoubleQuotesReversed'
};
var openQuote = RegExp("[" + Object.keys(pairs).join("") + "]", "g");
var closeQuote = RegExp("[" + Object.values(pairs).join("") + "]", "g");
var closesQuote = function(str) {
  if (!str) {
    return false;
  }
  const m3 = str.match(closeQuote);
  if (m3 !== null && m3.length === 1) {
    return true;
  }
  return false;
};
var quoteMerge = function(splits) {
  const arr = [];
  for (let i3 = 0; i3 < splits.length; i3 += 1) {
    const split3 = splits[i3];
    const m3 = split3.match(openQuote);
    if (m3 !== null && m3.length === 1) {
      if (closesQuote(splits[i3 + 1]) && splits[i3 + 1].length < MAX_QUOTE) {
        splits[i3] += splits[i3 + 1];
        arr.push(splits[i3]);
        splits[i3 + 1] = "";
        i3 += 1;
        continue;
      }
      if (closesQuote(splits[i3 + 2])) {
        const toAdd = splits[i3 + 1] + splits[i3 + 2];
        if (toAdd.length < MAX_QUOTE) {
          splits[i3] += toAdd;
          arr.push(splits[i3]);
          splits[i3 + 1] = "";
          splits[i3 + 2] = "";
          i3 += 2;
          continue;
        }
      }
    }
    arr.push(splits[i3]);
  }
  return arr;
};
var quote_merge_default = quoteMerge;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/01-sentences/05-parens-merge.js
var MAX_LEN = 250;
var hasOpen = /\(/g;
var hasClosed = /\)/g;
var mergeParens = function(splits) {
  const arr = [];
  for (let i3 = 0; i3 < splits.length; i3 += 1) {
    const split3 = splits[i3];
    const m3 = split3.match(hasOpen);
    if (m3 !== null && m3.length === 1) {
      if (splits[i3 + 1] && splits[i3 + 1].length < MAX_LEN) {
        const m22 = splits[i3 + 1].match(hasClosed);
        if (m22 !== null && m3.length === 1 && !hasOpen.test(splits[i3 + 1])) {
          splits[i3] += splits[i3 + 1];
          arr.push(splits[i3]);
          splits[i3 + 1] = "";
          i3 += 1;
          continue;
        }
      }
    }
    arr.push(splits[i3]);
  }
  return arr;
};
var parens_merge_default = mergeParens;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/01-sentences/index.js
var hasSomething2 = /\S/;
var startWhitespace = /^\s+/;
var splitSentences = function(text, world2) {
  text = text || "";
  text = String(text);
  if (!text || typeof text !== "string" || hasSomething2.test(text) === false) {
    return [];
  }
  text = text.replace("\xA0", " ");
  const splits = simple_split_default(text);
  let sentences = simple_merge_default(splits);
  sentences = smart_merge_default(sentences, world2);
  sentences = quote_merge_default(sentences);
  sentences = parens_merge_default(sentences);
  if (sentences.length === 0) {
    return [text];
  }
  for (let i3 = 1; i3 < sentences.length; i3 += 1) {
    const ws = sentences[i3].match(startWhitespace);
    if (ws !== null) {
      sentences[i3 - 1] += ws[0];
      sentences[i3] = sentences[i3].replace(startWhitespace, "");
    }
  }
  return sentences;
};
var sentences_default = splitSentences;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/02-terms/01-hyphens.js
var hasHyphen2 = function(str, model5) {
  const parts = str.split(/[-–—]/);
  if (parts.length <= 1) {
    return false;
  }
  const { prefixes: prefixes2, suffixes: suffixes5 } = model5.one;
  if (parts[0].length === 1 && /[a-z]/i.test(parts[0])) {
    return false;
  }
  if (prefixes2.hasOwnProperty(parts[0])) {
    return false;
  }
  parts[1] = parts[1].trim().replace(/[.?!]$/, "");
  if (suffixes5.hasOwnProperty(parts[1])) {
    return false;
  }
  const reg = /^([a-z\u00C0-\u00FF`"'/]+)[-–—]([a-z0-9\u00C0-\u00FF].*)/i;
  if (reg.test(str) === true) {
    return true;
  }
  const reg2 = /^[('"]?([0-9]{1,4})[-–—]([a-z\u00C0-\u00FF`"'/-]+[)'"]?$)/i;
  if (reg2.test(str) === true) {
    return true;
  }
  return false;
};
var splitHyphens2 = function(word) {
  const arr = [];
  const hyphens = word.split(/[-–—]/);
  let whichDash = "-";
  const found = word.match(/[-–—]/);
  if (found && found[0]) {
    whichDash = found;
  }
  for (let o2 = 0; o2 < hyphens.length; o2++) {
    if (o2 === hyphens.length - 1) {
      arr.push(hyphens[o2]);
    } else {
      arr.push(hyphens[o2] + whichDash);
    }
  }
  return arr;
};

// reducer/node_modules/compromise/src/1-one/tokenize/methods/02-terms/03-ranges.js
var combineRanges = function(arr) {
  const startRange = /^[0-9]{1,4}(:[0-9][0-9])?([a-z]{1,2})? ?[-–—] ?$/;
  const endRange = /^[0-9]{1,4}([a-z]{1,2})? ?$/;
  for (let i3 = 0; i3 < arr.length - 1; i3 += 1) {
    if (arr[i3 + 1] && startRange.test(arr[i3]) && endRange.test(arr[i3 + 1])) {
      arr[i3] = arr[i3] + arr[i3 + 1];
      arr[i3 + 1] = null;
    }
  }
  return arr;
};
var ranges_default = combineRanges;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/02-terms/02-slashes.js
var isSlash = /\p{L} ?\/ ?\p{L}+$/u;
var combineSlashes = function(arr) {
  for (let i3 = 1; i3 < arr.length - 1; i3++) {
    if (isSlash.test(arr[i3])) {
      arr[i3 - 1] += arr[i3] + arr[i3 + 1];
      arr[i3] = null;
      arr[i3 + 1] = null;
    }
  }
  return arr;
};
var slashes_default = combineSlashes;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/02-terms/index.js
var wordlike = /\S/;
var isBoundary = /^[!?.]+$/;
var naiiveSplit = /(\S+)/;
var notWord = [
  ".",
  "?",
  "!",
  ":",
  ";",
  "-",
  "\u2013",
  "\u2014",
  "--",
  "...",
  "(",
  ")",
  "[",
  "]",
  '"',
  "'",
  "`",
  "\xAB",
  "\xBB",
  "*",
  "\u2022"
];
notWord = notWord.reduce((h2, c2) => {
  h2[c2] = true;
  return h2;
}, {});
var isArray11 = function(arr) {
  return Object.prototype.toString.call(arr) === "[object Array]";
};
var splitWords = function(str, model5) {
  let result = [];
  let arr = [];
  str = str || "";
  if (typeof str === "number") {
    str = String(str);
  }
  if (isArray11(str)) {
    return str;
  }
  const words = str.split(naiiveSplit);
  for (let i3 = 0; i3 < words.length; i3++) {
    if (hasHyphen2(words[i3], model5) === true) {
      arr = arr.concat(splitHyphens2(words[i3]));
      continue;
    }
    arr.push(words[i3]);
  }
  let carry = "";
  for (let i3 = 0; i3 < arr.length; i3++) {
    const word = arr[i3];
    if (wordlike.test(word) === true && notWord.hasOwnProperty(word) === false && isBoundary.test(word) === false) {
      if (result.length > 0) {
        result[result.length - 1] += carry;
        result.push(word);
      } else {
        result.push(carry + word);
      }
      carry = "";
    } else {
      carry += word;
    }
  }
  if (carry) {
    if (result.length === 0) {
      result[0] = "";
    }
    result[result.length - 1] += carry;
  }
  result = slashes_default(result);
  result = ranges_default(result);
  result = result.filter((s3) => s3);
  return result;
};
var terms_default = splitWords;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/03-whitespace/tokenize.js
var isLetter = /\p{Letter}/u;
var isNumber = /[\p{Number}\p{Currency_Symbol}]/u;
var hasAcronym = /^[a-z]\.([a-z]\.)+/i;
var chillin = /[sn]['’]$/;
var normalizePunctuation = function(str, model5) {
  const { prePunctuation: prePunctuation2, postPunctuation: postPunctuation2, emoticons: emoticons2 } = model5.one;
  let original = str;
  let pre = "";
  let post = "";
  const chars = Array.from(str);
  if (emoticons2.hasOwnProperty(str.trim())) {
    return { str: str.trim(), pre, post: " " };
  }
  let len = chars.length;
  for (let i3 = 0; i3 < len; i3 += 1) {
    const c2 = chars[0];
    if (prePunctuation2[c2] === true) {
      continue;
    }
    if ((c2 === "+" || c2 === "-") && isNumber.test(chars[1])) {
      break;
    }
    if (c2 === "'" && c2.length === 3 && isNumber.test(chars[1])) {
      break;
    }
    if (isLetter.test(c2) || isNumber.test(c2)) {
      break;
    }
    pre += chars.shift();
  }
  len = chars.length;
  for (let i3 = 0; i3 < len; i3 += 1) {
    const c2 = chars[chars.length - 1];
    if (postPunctuation2[c2] === true) {
      continue;
    }
    if (isLetter.test(c2) || isNumber.test(c2)) {
      break;
    }
    if (c2 === "." && hasAcronym.test(original) === true) {
      continue;
    }
    if (c2 === "'" && chillin.test(original) === true) {
      continue;
    }
    post = chars.pop() + post;
  }
  str = chars.join("");
  if (str === "") {
    original = original.replace(/ *$/, (after2) => {
      post = after2 || "";
      return "";
    });
    str = original;
    pre = "";
  }
  return { str, pre, post };
};
var tokenize_default = normalizePunctuation;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/03-whitespace/index.js
var parseTerm = (txt, model5) => {
  const { str, pre, post } = tokenize_default(txt, model5);
  const parsed = {
    text: str,
    pre,
    post,
    tags: /* @__PURE__ */ new Set()
  };
  return parsed;
};
var whitespace_default2 = parseTerm;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/unicode.js
var killUnicode = function(str, world2) {
  const unicode2 = world2.model.one.unicode || {};
  str = str || "";
  const chars = str.split("");
  chars.forEach((s3, i3) => {
    if (unicode2[s3]) {
      chars[i3] = unicode2[s3];
    }
  });
  return chars.join("");
};
var unicode_default = killUnicode;

// reducer/node_modules/compromise/src/1-one/tokenize/compute/normal/01-cleanup.js
var clean = function(str) {
  str = str || "";
  str = str.toLowerCase();
  str = str.trim();
  const original = str;
  str = str.replace(/[,;.!?]+$/, "");
  str = str.replace(/\u2026/g, "...");
  str = str.replace(/\u2013/g, "-");
  if (/^[:;]/.test(str) === false) {
    str = str.replace(/\.{3,}$/g, "");
    str = str.replace(/[",.!:;?)]+$/g, "");
    str = str.replace(/^['"(]+/g, "");
  }
  str = str.replace(/[\u200B-\u200D\uFEFF]/g, "");
  str = str.trim();
  if (str === "") {
    str = original;
  }
  str = str.replace(/([0-9]),([0-9])/g, "$1$2");
  return str;
};
var cleanup_default = clean;

// reducer/node_modules/compromise/src/1-one/tokenize/compute/normal/02-acronyms.js
var periodAcronym = /([A-Z]\.)+[A-Z]?,?$/;
var oneLetterAcronym = /^[A-Z]\.,?$/;
var noPeriodAcronym = /[A-Z]{2,}('s|,)?$/;
var lowerCaseAcronym = /([a-z]\.)+[a-z]\.?$/;
var isAcronym = function(str) {
  if (periodAcronym.test(str) === true) {
    return true;
  }
  if (lowerCaseAcronym.test(str) === true) {
    return true;
  }
  if (oneLetterAcronym.test(str) === true) {
    return true;
  }
  if (noPeriodAcronym.test(str) === true) {
    return true;
  }
  return false;
};
var doAcronym = function(str) {
  if (isAcronym(str)) {
    str = str.replace(/\./g, "");
  }
  return str;
};
var acronyms_default = doAcronym;

// reducer/node_modules/compromise/src/1-one/tokenize/compute/normal/index.js
var normalize = function(term, world2) {
  const killUnicode2 = world2.methods.one.killUnicode;
  let str = term.text || "";
  str = cleanup_default(str);
  str = killUnicode2(str, world2);
  str = acronyms_default(str);
  term.normal = str;
};
var normal_default = normalize;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/parse.js
var parse2 = function(input, world2) {
  const { methods: methods17, model: model5 } = world2;
  const { splitSentences: splitSentences2, splitTerms, splitWhitespace } = methods17.one.tokenize;
  input = input || "";
  const sentences = splitSentences2(input, world2);
  input = sentences.map((txt) => {
    let terms = splitTerms(txt, model5);
    terms = terms.map((t3) => splitWhitespace(t3, model5));
    terms.forEach((t3) => {
      normal_default(t3, world2);
    });
    return terms;
  });
  return input;
};
var parse_default2 = parse2;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/01-sentences/is-sentence.js
var isAcronym2 = /[ .][A-Z]\.? *$/i;
var hasEllipse = /(?:\u2026|\.{2,}) *$/;
var hasLetter2 = /\p{L}/u;
var hasPeriod = /\. *$/;
var leadInit = /^[A-Z]\. $/;
var isSentence = function(str, abbrevs) {
  if (hasLetter2.test(str) === false) {
    return false;
  }
  if (isAcronym2.test(str) === true) {
    return false;
  }
  if (str.length === 3 && leadInit.test(str)) {
    return false;
  }
  if (hasEllipse.test(str) === true) {
    return false;
  }
  const txt = str.replace(/[.!?\u203D\u2E18\u203C\u2047-\u2049] *$/, "");
  const words = txt.split(" ");
  const lastWord = words[words.length - 1].toLowerCase();
  if (abbrevs.hasOwnProperty(lastWord) === true && hasPeriod.test(str) === true) {
    return false;
  }
  return true;
};
var is_sentence_default = isSentence;

// reducer/node_modules/compromise/src/1-one/tokenize/methods/index.js
var methods_default8 = {
  one: {
    killUnicode: unicode_default,
    tokenize: {
      splitSentences: sentences_default,
      isSentence: is_sentence_default,
      splitTerms: terms_default,
      splitWhitespace: whitespace_default2,
      fromString: parse_default2
    }
  }
};

// reducer/node_modules/compromise/src/1-one/tokenize/model/aliases.js
var aliases = {
  "&": "and",
  "@": "at",
  "%": "percent",
  "plz": "please",
  "bein": "being"
};
var aliases_default = aliases;

// reducer/node_modules/compromise/src/1-one/tokenize/model/abbreviations/misc.js
var misc_default = [
  "approx",
  "apt",
  "bc",
  "cyn",
  "eg",
  "esp",
  "est",
  "etc",
  "ex",
  "exp",
  "prob",
  //probably
  "pron",
  // Pronunciation
  "gal",
  //gallon
  "min",
  "pseud",
  "fig",
  //figure
  "jd",
  "lat",
  //latitude
  "lng",
  //longitude
  "vol",
  //volume
  "fm",
  //not am
  "def",
  //definition
  "misc",
  "plz",
  //please
  "ea",
  //each
  "ps",
  "sec",
  //second
  "pt",
  "pref",
  //preface
  "pl",
  //plural
  "pp",
  //pages
  "qt",
  //quarter
  "fr",
  //french
  "sq",
  "nee",
  //given name at birth
  "ss",
  //ship, or sections
  "tel",
  "temp",
  "vet",
  "ver",
  //version
  "fem",
  //feminine
  "masc",
  //masculine
  "eng",
  //engineering/english
  "adj",
  //adjective
  "vb",
  //verb
  "rb",
  //adverb
  "inf",
  //infinitive
  "situ",
  // in situ
  "vivo",
  "vitro",
  "wr"
  //world record
];

// reducer/node_modules/compromise/src/1-one/tokenize/model/abbreviations/honorifics.js
var honorifics_default = [
  "adj",
  "adm",
  "adv",
  "asst",
  "atty",
  "bldg",
  "brig",
  "capt",
  "cmdr",
  "comdr",
  "cpl",
  "det",
  "dr",
  "esq",
  "gen",
  "gov",
  "hon",
  "jr",
  "llb",
  "lt",
  "maj",
  "messrs",
  "mlle",
  "mme",
  "mr",
  "mrs",
  "ms",
  "mstr",
  "phd",
  "prof",
  "pvt",
  "rep",
  "reps",
  "res",
  "rev",
  "sen",
  "sens",
  "sfc",
  "sgt",
  "sir",
  "sr",
  "supt",
  "surg"
  //miss
  //misses
];

// reducer/node_modules/compromise/src/1-one/tokenize/model/abbreviations/months.js
var months_default = ["jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"];

// reducer/node_modules/compromise/src/1-one/tokenize/model/abbreviations/nouns.js
var nouns_default = [
  "ad",
  "al",
  "arc",
  "ba",
  "bl",
  "ca",
  "cca",
  "col",
  "corp",
  "ft",
  "fy",
  "ie",
  "lit",
  "ma",
  "md",
  "pd",
  "tce"
];

// reducer/node_modules/compromise/src/1-one/tokenize/model/abbreviations/organizations.js
var organizations_default = ["dept", "univ", "assn", "bros", "inc", "ltd", "co"];

// reducer/node_modules/compromise/src/1-one/tokenize/model/abbreviations/places.js
var places_default = [
  "rd",
  "st",
  "dist",
  "mt",
  "ave",
  "blvd",
  "cl",
  // 'ct',
  "cres",
  "hwy",
  //states
  "ariz",
  "cal",
  "calif",
  "colo",
  "conn",
  "fla",
  "fl",
  "ga",
  "ida",
  "ia",
  "kan",
  "kans",
  "minn",
  "neb",
  "nebr",
  "okla",
  "penna",
  "penn",
  "pa",
  "dak",
  "tenn",
  "tex",
  "ut",
  "vt",
  "va",
  "wis",
  "wisc",
  "wy",
  "wyo",
  "usafa",
  "alta",
  "ont",
  "que",
  "sask"
];

// reducer/node_modules/compromise/src/1-one/tokenize/model/abbreviations/units.js
var units_default = [
  "dl",
  "ml",
  "gal",
  // 'ft', //ambiguous
  "qt",
  "pt",
  "tbl",
  "tsp",
  "tbsp",
  "km",
  "dm",
  //decimeter
  "cm",
  "mm",
  "mi",
  "td",
  "hr",
  //hour
  "hrs",
  //hour
  "kg",
  "hg",
  "dg",
  //decigram
  "cg",
  //centigram
  "mg",
  //milligram
  "\xB5g",
  //microgram
  "lb",
  //pound
  "oz",
  //ounce
  "sq ft",
  "hz",
  //hertz
  "mps",
  //meters per second
  "mph",
  "kmph",
  //kilometers per hour
  "kb",
  //kilobyte
  "mb",
  //megabyte
  // 'gb', //ambig
  "tb",
  //terabyte
  "lx",
  //lux
  "lm",
  //lumen
  // 'pa', //ambig
  "fl oz",
  //
  "yb"
];

// reducer/node_modules/compromise/src/1-one/tokenize/model/lexicon.js
var list = [
  [misc_default],
  [units_default, "Unit"],
  [nouns_default, "Noun"],
  [honorifics_default, "Honorific"],
  [months_default, "Month"],
  [organizations_default, "Organization"],
  [places_default, "Place"]
];
var abbreviations = {};
var lexicon2 = {};
list.forEach((a2) => {
  a2[0].forEach((w) => {
    abbreviations[w] = true;
    lexicon2[w] = "Abbreviation";
    if (a2[1] !== void 0) {
      lexicon2[w] = [lexicon2[w], a2[1]];
    }
  });
});

// reducer/node_modules/compromise/src/1-one/tokenize/model/prefixes.js
var prefixes_default = [
  "anti",
  "bi",
  "co",
  "contra",
  "de",
  "extra",
  "infra",
  "inter",
  "intra",
  "macro",
  "micro",
  "mis",
  "mono",
  "multi",
  "peri",
  "pre",
  "pro",
  "proto",
  "pseudo",
  "re",
  "sub",
  "supra",
  "trans",
  "tri",
  "un",
  "out",
  //out-lived
  "ex"
  //ex-wife
  // 'counter',
  // 'mid',
  // 'out',
  // 'non',
  // 'over',
  // 'post',
  // 'semi',
  // 'super', //'super-cool'
  // 'ultra', //'ulta-cool'
  // 'under',
  // 'whole',
].reduce((h2, str) => {
  h2[str] = true;
  return h2;
}, {});

// reducer/node_modules/compromise/src/1-one/tokenize/model/suffixes.js
var suffixes_default = {
  "like": true,
  "ish": true,
  "less": true,
  "able": true,
  "elect": true,
  "type": true,
  "designate": true
  // 'fold':true,
};

// reducer/node_modules/compromise/src/1-one/tokenize/model/unicode.js
var compact = {
  "!": "\xA1",
  "?": "\xBF\u0241",
  '"': '\u201C\u201D"\u275D\u275E',
  "'": "\u2018\u201B\u275B\u275C\u2019",
  "-": "\u2014\u2013",
  a: "\xAA\xC0\xC1\xC2\xC3\xC4\xC5\xE0\xE1\xE2\xE3\xE4\xE5\u0100\u0101\u0102\u0103\u0104\u0105\u01CD\u01CE\u01DE\u01DF\u01E0\u01E1\u01FA\u01FB\u0200\u0201\u0202\u0203\u0226\u0227\u023A\u0386\u0391\u0394\u039B\u03AC\u03B1\u03BB\u0410\u0430\u0466\u0467\u04D0\u04D1\u04D2\u04D3\u019B\xE6",
  b: "\xDF\xFE\u0180\u0181\u0182\u0183\u0184\u0185\u0243\u0392\u03B2\u03D0\u03E6\u0411\u0412\u042A\u042C\u0432\u044A\u044C\u0462\u0463\u048C\u048D",
  c: "\xA2\xA9\xC7\xE7\u0106\u0107\u0108\u0109\u010A\u010B\u010C\u010D\u0186\u0187\u0188\u023B\u023C\u037B\u037C\u03F2\u03F9\u03FD\u03FE\u0421\u0441\u0454\u0480\u0481\u04AA\u04AB",
  d: "\xD0\u010E\u010F\u0110\u0111\u0189\u018A\u0221\u018B\u018C",
  e: "\xC8\xC9\xCA\xCB\xE8\xE9\xEA\xEB\u0112\u0113\u0114\u0115\u0116\u0117\u0118\u0119\u011A\u011B\u0190\u0204\u0205\u0206\u0207\u0228\u0229\u0246\u0247\u0388\u0395\u039E\u03A3\u03AD\u03B5\u03BE\u03F5\u0400\u0401\u0415\u0435\u0450\u0451\u04BC\u04BD\u04BE\u04BF\u04D6\u04D7\u1EC5",
  f: "\u0191\u0192\u03DC\u03DD\u04FA\u04FB\u0492\u0493\u017F",
  g: "\u011C\u011D\u011E\u011F\u0120\u0121\u0122\u0123\u0193\u01E4\u01E5\u01E6\u01E7\u01F4\u01F5",
  h: "\u0124\u0125\u0126\u0127\u0195\u01F6\u021E\u021F\u0389\u0397\u0402\u040A\u040B\u041D\u043D\u0452\u045B\u04A2\u04A3\u04A4\u04A5\u04BA\u04BB\u04C9\u04CA",
  I: "\xCC\xCD\xCE\xCF",
  i: "\xEC\xED\xEE\xEF\u0128\u0129\u012A\u012B\u012C\u012D\u012E\u012F\u0130\u0131\u0196\u0197\u0208\u0209\u020A\u020B\u038A\u0390\u03AA\u03AF\u03B9\u03CA\u0406\u0407\u0456\u0457i\u0307",
  j: "\u0134\u0135\u01F0\u0237\u0248\u0249\u03F3\u0408\u0458",
  k: "\u0136\u0137\u0138\u0198\u0199\u01E8\u01E9\u039A\u03BA\u040C\u0416\u041A\u0436\u043A\u045C\u049A\u049B\u049C\u049D\u049E\u049F\u04A0\u04A1",
  l: "\u0139\u013A\u013B\u013C\u013D\u013E\u013F\u0140\u0141\u0142\u019A\u01AA\u01C0\u01CF\u01D0\u0234\u023D\u0399\u04C0\u04CF",
  m: "\u039C\u03FA\u03FB\u041C\u043C\u04CD\u04CE",
  n: "\xD1\xF1\u0143\u0144\u0145\u0146\u0147\u0148\u0149\u014A\u014B\u019D\u019E\u01F8\u01F9\u0220\u0235\u039D\u03A0\u03AE\u03B7\u03DE\u040D\u0418\u0419\u041B\u041F\u0438\u0439\u043B\u043F\u045D\u048A\u048B\u04C5\u04C6\u04E2\u04E3\u04E4\u04E5\u03C0",
  o: "\xD2\xD3\xD4\xD5\xD6\xD8\xF0\xF2\xF3\xF4\xF5\xF6\xF8\u014C\u014D\u014E\u014F\u0150\u0151\u019F\u01A0\u01A1\u01D1\u01D2\u01EA\u01EB\u01EC\u01ED\u01FE\u01FF\u020C\u020D\u020E\u020F\u022A\u022B\u022C\u022D\u022E\u022F\u0230\u0231\u038C\u0398\u039F\u03B8\u03BF\u03C3\u03CC\u03D5\u03D8\u03D9\u03EC\u03F4\u041E\u0424\u043E\u0472\u0473\u04E6\u04E7\u04E8\u04E9\u04EA\u04EB",
  p: "\u01A4\u03A1\u03C1\u03F7\u03F8\u03FC\u0420\u0440\u048E\u048F\xDE",
  q: "\u024A\u024B",
  r: "\u0154\u0155\u0156\u0157\u0158\u0159\u01A6\u0210\u0211\u0212\u0213\u024C\u024D\u0403\u0413\u042F\u0433\u044F\u0453\u0490\u0491",
  s: "\u015A\u015B\u015C\u015D\u015E\u015F\u0160\u0161\u01A7\u01A8\u0218\u0219\u023F\u0405\u0455",
  t: "\u0162\u0163\u0164\u0165\u0166\u0167\u01AB\u01AC\u01AD\u01AE\u021A\u021B\u0236\u023E\u0393\u03A4\u03C4\u03EE\u0422\u0442",
  u: "\xD9\xDA\xDB\xDC\xF9\xFA\xFB\xFC\u0168\u0169\u016A\u016B\u016C\u016D\u016E\u016F\u0170\u0171\u0172\u0173\u01AF\u01B0\u01B1\u01B2\u01D3\u01D4\u01D5\u01D6\u01D7\u01D8\u01D9\u01DA\u01DB\u01DC\u0214\u0215\u0216\u0217\u0244\u03B0\u03C5\u03CB\u03CD",
  v: "\u03BD\u0474\u0475\u0476\u0477",
  w: "\u0174\u0175\u019C\u03C9\u03CE\u03D6\u03E2\u03E3\u0428\u0429\u0448\u0449\u0461\u047F",
  x: "\xD7\u03A7\u03C7\u03D7\u03F0\u0425\u0445\u04B2\u04B3\u04FC\u04FD\u04FE\u04FF",
  y: "\xDD\xFD\xFF\u0176\u0177\u0178\u01B3\u01B4\u0232\u0233\u024E\u024F\u038E\u03A5\u03AB\u03B3\u03C8\u03D2\u03D3\u03D4\u040E\u0423\u0443\u0447\u045E\u0470\u0471\u04AE\u04AF\u04B0\u04B1\u04EE\u04EF\u04F0\u04F1\u04F2\u04F3",
  z: "\u0179\u017A\u017B\u017C\u017D\u017E\u01B5\u01B6\u0224\u0225\u0240\u0396"
};
var unicode = {};
Object.keys(compact).forEach(function(k2) {
  compact[k2].split("").forEach(function(s3) {
    unicode[s3] = k2;
  });
});
var unicode_default2 = unicode;

// reducer/node_modules/compromise/src/1-one/tokenize/model/punctuation.js
var prePunctuation = {
  "#": true,
  //#hastag
  "@": true,
  //@atmention
  "_": true,
  //underscore
  "\xB0": true,
  // '+': true,//+4
  // '\\-',//-4  (escape)
  // '.',//.4
  // zero-width chars
  "\u200B": true,
  "\u200C": true,
  "\u200D": true,
  "\uFEFF": true
};
var postPunctuation = {
  "%": true,
  //88%
  "_": true,
  //underscore
  "\xB0": true,
  //degrees, italian ordinal
  // '\'',// sometimes
  // zero-width chars
  "\u200B": true,
  "\u200C": true,
  "\u200D": true,
  "\uFEFF": true
};
var emoticons = {
  "<3": true,
  "</3": true,
  "<\\3": true,
  ":^P": true,
  ":^p": true,
  ":^O": true,
  ":^3": true
};

// reducer/node_modules/compromise/src/1-one/tokenize/model/index.js
var model_default2 = {
  one: {
    aliases: aliases_default,
    abbreviations,
    prefixes: prefixes_default,
    suffixes: suffixes_default,
    prePunctuation,
    postPunctuation,
    lexicon: lexicon2,
    //give this one forward
    unicode: unicode_default2,
    emoticons
  }
};

// reducer/node_modules/compromise/src/1-one/tokenize/compute/alias.js
var hasSlash = /\//;
var hasDomain = /[a-z]\.[a-z]/i;
var isMath = /[0-9]/;
var addAliases = function(term, world2) {
  const str = term.normal || term.text || term.machine;
  const aliases3 = world2.model.one.aliases;
  if (aliases3.hasOwnProperty(str)) {
    term.alias = term.alias || [];
    term.alias.push(aliases3[str]);
  }
  if (hasSlash.test(str) && !hasDomain.test(str) && !isMath.test(str)) {
    const arr = str.split(hasSlash);
    if (arr.length <= 3) {
      arr.forEach((word) => {
        word = word.trim();
        if (word !== "") {
          term.alias = term.alias || [];
          term.alias.push(word);
        }
      });
    }
  }
  return term;
};
var alias_default = addAliases;

// reducer/node_modules/compromise/src/1-one/tokenize/compute/machine.js
var hasDash3 = /^\p{Letter}+-\p{Letter}+$/u;
var doMachine = function(term) {
  let str = term.implicit || term.normal || term.text;
  str = str.replace(/['’]s$/, "");
  str = str.replace(/s['’]$/, "s");
  str = str.replace(/([aeiou][ktrp])in'$/, "$1ing");
  if (hasDash3.test(str)) {
    str = str.replace(/-/g, "");
  }
  str = str.replace(/^[#@]/, "");
  if (str !== term.normal) {
    term.machine = str;
  }
};
var machine_default = doMachine;

// reducer/node_modules/compromise/src/1-one/tokenize/compute/freq.js
var freq = function(view) {
  const docs = view.docs;
  const counts = {};
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    for (let t3 = 0; t3 < docs[i3].length; t3 += 1) {
      const term = docs[i3][t3];
      const word = term.machine || term.normal;
      counts[word] = counts[word] || 0;
      counts[word] += 1;
    }
  }
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    for (let t3 = 0; t3 < docs[i3].length; t3 += 1) {
      const term = docs[i3][t3];
      const word = term.machine || term.normal;
      term.freq = counts[word];
    }
  }
};
var freq_default = freq;

// reducer/node_modules/compromise/src/1-one/tokenize/compute/offset.js
var offset = function(view) {
  let elapsed = 0;
  let index3 = 0;
  const docs = view.document;
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    for (let t3 = 0; t3 < docs[i3].length; t3 += 1) {
      const term = docs[i3][t3];
      term.offset = {
        index: index3,
        start: elapsed + term.pre.length,
        length: term.text.length
      };
      elapsed += term.pre.length + term.text.length + term.post.length;
      index3 += 1;
    }
  }
};
var offset_default = offset;

// reducer/node_modules/compromise/src/1-one/tokenize/compute/reindex.js
var index2 = function(view) {
  const document = view.document;
  for (let n3 = 0; n3 < document.length; n3 += 1) {
    for (let i3 = 0; i3 < document[n3].length; i3 += 1) {
      document[n3][i3].index = [n3, i3];
    }
  }
};
var reindex_default = index2;

// reducer/node_modules/compromise/src/1-one/tokenize/compute/wordCount.js
var wordCount2 = function(view) {
  let n3 = 0;
  const docs = view.docs;
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    for (let t3 = 0; t3 < docs[i3].length; t3 += 1) {
      if (docs[i3][t3].normal === "") {
        continue;
      }
      n3 += 1;
      docs[i3][t3].wordCount = n3;
    }
  }
};
var wordCount_default = wordCount2;

// reducer/node_modules/compromise/src/1-one/tokenize/compute/index.js
var termLoop = function(view, fn) {
  const docs = view.docs;
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    for (let t3 = 0; t3 < docs[i3].length; t3 += 1) {
      fn(docs[i3][t3], view.world);
    }
  }
};
var methods16 = {
  alias: (view) => termLoop(view, alias_default),
  machine: (view) => termLoop(view, machine_default),
  normal: (view) => termLoop(view, normal_default),
  freq: freq_default,
  offset: offset_default,
  index: reindex_default,
  wordCount: wordCount_default
};
var compute_default7 = methods16;

// reducer/node_modules/compromise/src/1-one/tokenize/plugin.js
var plugin_default12 = {
  compute: compute_default7,
  methods: methods_default8,
  model: model_default2,
  hooks: ["alias", "machine", "index", "id"]
};

// reducer/node_modules/compromise/src/1-one/typeahead/compute.js
var typeahead = function(view) {
  const prefixes2 = view.model.one.typeahead;
  const docs = view.docs;
  if (docs.length === 0 || Object.keys(prefixes2).length === 0) {
    return;
  }
  const lastPhrase = docs[docs.length - 1] || [];
  const lastTerm = lastPhrase[lastPhrase.length - 1];
  if (lastTerm.post) {
    return;
  }
  if (prefixes2.hasOwnProperty(lastTerm.normal)) {
    const found = prefixes2[lastTerm.normal];
    lastTerm.implicit = found;
    lastTerm.machine = found;
    lastTerm.typeahead = true;
    if (view.compute.preTagger) {
      view.last().unTag("*").compute(["lexicon", "preTagger"]);
    }
  }
};
var compute_default8 = { typeahead };

// reducer/node_modules/compromise/src/1-one/typeahead/api.js
var autoFill = function() {
  const docs = this.docs;
  if (docs.length === 0) {
    return this;
  }
  const lastPhrase = docs[docs.length - 1] || [];
  const term = lastPhrase[lastPhrase.length - 1];
  if (term.typeahead === true && term.machine) {
    term.text = term.machine;
    term.normal = term.machine;
  }
  return this;
};
var api2 = function(View2) {
  View2.prototype.autoFill = autoFill;
};
var api_default9 = api2;

// reducer/node_modules/compromise/src/1-one/typeahead/lib/allPrefixes.js
var getPrefixes = function(arr, opts2, world2) {
  let index3 = {};
  const collisions = [];
  const existing = world2.prefixes || {};
  arr.forEach((str) => {
    str = str.toLowerCase().trim();
    let max3 = str.length;
    if (opts2.max && max3 > opts2.max) {
      max3 = opts2.max;
    }
    for (let size = opts2.min; size < max3; size += 1) {
      const prefix5 = str.substring(0, size);
      if (opts2.safe && world2.model.one.lexicon.hasOwnProperty(prefix5)) {
        continue;
      }
      if (existing.hasOwnProperty(prefix5) === true) {
        collisions.push(prefix5);
        continue;
      }
      if (index3.hasOwnProperty(prefix5) === true) {
        collisions.push(prefix5);
        continue;
      }
      index3[prefix5] = str;
    }
  });
  index3 = Object.assign({}, existing, index3);
  collisions.forEach((str) => {
    delete index3[str];
  });
  return index3;
};
var allPrefixes_default = getPrefixes;

// reducer/node_modules/compromise/src/1-one/typeahead/lib/index.js
var isObject7 = (val) => {
  return Object.prototype.toString.call(val) === "[object Object]";
};
var defaults2 = {
  safe: true,
  min: 3
};
var prepare = function(words = [], opts2 = {}) {
  const model5 = this.model();
  opts2 = Object.assign({}, defaults2, opts2);
  if (isObject7(words)) {
    Object.assign(model5.one.lexicon, words);
    words = Object.keys(words);
  }
  const prefixes2 = allPrefixes_default(words, opts2, this.world());
  Object.keys(prefixes2).forEach((str) => {
    if (model5.one.typeahead.hasOwnProperty(str)) {
      delete model5.one.typeahead[str];
      return;
    }
    model5.one.typeahead[str] = prefixes2[str];
  });
  return this;
};
var lib_default5 = {
  typeahead: prepare
};

// reducer/node_modules/compromise/src/1-one/typeahead/plugin.js
var model3 = {
  one: {
    typeahead: {}
    //set a blank key-val
  }
};
var plugin_default13 = {
  model: model3,
  api: api_default9,
  lib: lib_default5,
  compute: compute_default8,
  hooks: ["typeahead"]
};

// reducer/node_modules/compromise/src/one.js
nlp_default.extend(plugin_default2);
nlp_default.extend(plugin_default8);
nlp_default.extend(plugin_default7);
nlp_default.extend(plugin_default9);
nlp_default.extend(plugin_default11);
nlp_default.plugin(plugin_default3);
nlp_default.extend(plugin_default12);
nlp_default.extend(plugin_default4);
nlp_default.plugin(plugin_default);
nlp_default.extend(plugin_default6);
nlp_default.extend(plugin_default13);
nlp_default.extend(plugin_default5);
nlp_default.extend(plugin_default10);
var one_default = nlp_default;

// reducer/node_modules/compromise/src/2-two/preTagger/model/irregulars/plurals.js
var plurals_default = {
  // -a
  addendum: "addenda",
  corpus: "corpora",
  criterion: "criteria",
  curriculum: "curricula",
  genus: "genera",
  memorandum: "memoranda",
  opus: "opera",
  ovum: "ova",
  phenomenon: "phenomena",
  referendum: "referenda",
  // -ae
  alga: "algae",
  alumna: "alumnae",
  antenna: "antennae",
  formula: "formulae",
  larva: "larvae",
  nebula: "nebulae",
  vertebra: "vertebrae",
  // -is
  analysis: "analyses",
  axis: "axes",
  diagnosis: "diagnoses",
  parenthesis: "parentheses",
  prognosis: "prognoses",
  synopsis: "synopses",
  thesis: "theses",
  neurosis: "neuroses",
  // -x
  appendix: "appendices",
  index: "indices",
  matrix: "matrices",
  ox: "oxen",
  sex: "sexes",
  // -i
  alumnus: "alumni",
  bacillus: "bacilli",
  cactus: "cacti",
  fungus: "fungi",
  hippopotamus: "hippopotami",
  libretto: "libretti",
  modulus: "moduli",
  nucleus: "nuclei",
  octopus: "octopi",
  radius: "radii",
  stimulus: "stimuli",
  syllabus: "syllabi",
  // -ie
  cookie: "cookies",
  calorie: "calories",
  auntie: "aunties",
  movie: "movies",
  pie: "pies",
  rookie: "rookies",
  tie: "ties",
  zombie: "zombies",
  // -f
  leaf: "leaves",
  loaf: "loaves",
  thief: "thieves",
  // ee-
  foot: "feet",
  goose: "geese",
  tooth: "teeth",
  // -eaux
  beau: "beaux",
  chateau: "chateaux",
  tableau: "tableaux",
  // -ses
  bus: "buses",
  gas: "gases",
  circus: "circuses",
  crisis: "crises",
  virus: "viruses",
  database: "databases",
  excuse: "excuses",
  abuse: "abuses",
  avocado: "avocados",
  barracks: "barracks",
  child: "children",
  clothes: "clothes",
  echo: "echoes",
  embargo: "embargoes",
  epoch: "epochs",
  deer: "deer",
  halo: "halos",
  man: "men",
  woman: "women",
  mosquito: "mosquitoes",
  mouse: "mice",
  person: "people",
  quiz: "quizzes",
  rodeo: "rodeos",
  shoe: "shoes",
  sombrero: "sombreros",
  stomach: "stomachs",
  tornado: "tornados",
  tuxedo: "tuxedos",
  volcano: "volcanoes"
};

// reducer/node_modules/compromise/src/2-two/preTagger/model/lexicon/_data.js
var data_default = {
  "Comparative": "true\xA6bett1f0;arth0ew0in0;er",
  "Superlative": "true\xA6earlier",
  "PresentTense": "true\xA6bests,sounds",
  "Condition": "true\xA6lest,unless",
  "PastTense": "true\xA6began,came,d4had,kneel3l2m0sa4we1;ea0sg2;nt;eap0i0;ed;id",
  "Participle": "true\xA60:09;a06b01cZdXeat0fSgQhPoJprov0rHs7t6u4w1;ak0ithdra02o2r1;i02uY;k0v0;nd1pr04;ergoJoJ;ak0hHo3;e9h7lain,o6p5t4un3w1;o1um;rn;g,k;ol0reS;iQok0;ught,wn;ak0o1runk;ne,wn;en,wn;ewriNi1uJ;dd0s0;ut3ver1;do4se0t1;ak0h2;do2g1;roG;ne;ast0i7;iv0o1;ne,tt0;all0loBor1;bi3g2s1;ak0e0;iv0o9;dd0;ove,r1;a5eamt,iv0;hos0lu1;ng;e4i3lo2ui1;lt;wn;tt0;at0en,gun;r2w1;ak0ok0;is0;en",
  "Gerund": "true\xA6accord0be0doin,go0result0stain0;ing",
  "Expression": "true\xA6a0Yb0Uc0Sd0Oe0Mfarew0Lg0FhZjeez,lWmVnToOpLsJtIuFvEw7y0;a5e3i1u0;ck,p;k04p0;ee,pee;a0p,s;!h;!a,h,y;a5h2o1t0;af,f;rd up,w;atsoever,e1o0;a,ops;e,w;hoo,t;ery w06oi0L;gh,h0;! 0h,m;huh,oh;here nPsk,ut tut;h0ic;eesh,hh,it,oo;ff,h1l0ow,sst;ease,s,z;ew,ooey;h1i,mg,o0uch,w,y;h,o,ps;! 0h;hTmy go0wT;d,sh;a7evertheless,o0;!pe;eh,mm;ah,eh,m1ol0;!s;ao,fao;aCeBi9o2u0;h,mph,rra0zzC;h,y;l1o0;r6y9;la,y0;! 0;c1moCsmok0;es;ow;!p hip hoor0;ay;ck,e,llo,y;ha1i,lleluj0;ah;!ha;ah,ee4o1r0;eat scott,r;l1od0sh; grief,bye;ly;! whiz;ell;e0h,t cetera,ureka,ww,xcuse me;k,p;'oh,a0rat,uh;m0ng;mit,n0;!it;mon,o0;ngratulations,wabunga;a2oo1r0tw,ye;avo,r;!ya;h,m; 1h0ka,las,men,rgh,ye;!a,em,h,oy;la",
  "Negative": "true\xA6n0;ever,o0;n,t",
  "QuestionWord": "true\xA6how3wh0;at,e1ich,o0y;!m,se;n,re; come,'s",
  "Reflexive": "true\xA6h4it5my5o1the0your2;ir1m1;ne3ur0;sel0;f,ves;er0im0;self",
  "Plural": "true\xA6dick0gre0ones,records;ens",
  "Unit|Noun": "true\xA6cEfDgChBinchAk9lb,m6newt5oz,p4qt,t1y0;ardEd;able1b0ea1sp;!l,sp;spo1;a,t,x;on9;!b,g,i1l,m,p0;h,s;!les;!b,elvin,g,m;!es;g,z;al,b;eet,oot,t;m,up0;!s",
  "Value": "true\xA6a few",
  "Imperative": "true\xA6bewa0come he0;re",
  "Plural|Verb": "true\xA6leaves",
  "Demonym": "true\xA60:15;1:12;a0Vb0Oc0Dd0Ce08f07g04h02iYjVkTlPmLnIomHpEqatari,rCs7t5u4v3welAz2;am0Gimbabwe0;enezuel0ietnam0I;gAkrai1;aiwTex0hai,rinida0Ju2;ni0Prkmen;a5cotti4e3ingapoOlovak,oma0Spaniard,udRw2y0W;ede,iss;negal0Cr09;sh;mo0uT;o5us0Jw2;and0;a2eru0Fhilippi0Nortugu07uerto r0S;kist3lesti1na2raguay0;ma1;ani;ami00i2orweP;caragu0geri2;an,en;a3ex0Lo2;ngo0Drocc0;cedo1la2;gasy,y07;a4eb9i2;b2thua1;e0Cy0;o,t01;azakh,eny0o2uwaiI;re0;a2orda1;ma0Ap2;anO;celandic,nd4r2sraeli,ta01vo05;a2iB;ni0qi;i0oneU;aiAin2ondur0unO;di;amEe2hanai0reek,uatemal0;or2rm0;gi0;ilipino,ren8;cuadoVgyp4mira3ngli2sto1thiopi0urope0;shm0;ti;ti0;aPominUut3;a9h6o4roat3ub0ze2;ch;!i0;lom2ngol5;bi0;a6i2;le0n2;ese;lifor1m2na3;bo2eroo1;di0;angladeshi,el6o4r3ul2;gaE;azi9it;li2s1;vi0;aru2gi0;si0;fAl7merBngol0r5si0us2;sie,tr2;a2i0;li0;genti2me1;ne;ba1ge2;ri0;ni0;gh0r2;ic0;an",
  "Organization": "true\xA60:4Q;a3Tb3Bc2Od2He2Df27g1Zh1Ti1Pj1Nk1Ll1Gm12n0Po0Mp0Cqu0Br02sTtHuCv9w3xiaomi,y1;amaha,m1Bou1w1B;gov,tu3C;a4e2iki1orld trade organizati33;leaRped0O;lls fargo,st1;fie2Hinghou2R;l1rner br3U;gree3Jl street journ2Im1E;an halOeriz2Xisa,o1;dafo2Yl1;kswagMvo;b4kip,n2ps,s1;a tod3Aps;es3Mi1;lev3Fted natio3C;er,s; mobi32aco beRd bOe9gi frida3Lh3im horto3Amz,o1witt3D;shi49y1;ota,s r 05;e 1in lizzy;b3carpen3Jdaily ma3Dguess w2holli0s1w2;mashing pumpki35uprem0;ho;ea1lack eyed pe3Xyr0Q;ch bo3Dtl0;l2n3Qs1xas instrumen1U;co,la m1F;efoni0Kus;a8cientology,e5ieme2Ymirnoff,np,o3pice gir6quare0Ata1ubaru;rbuc1to34;ks;ny,undgard1;en;a2x pisto1;ls;g1Wrs;few2Minsbur31lesfor03msu2E;adiohead,b8e4o1yana3C;man empi1Xyal 1;b1dutch she4;ank;a3d 1max,vl20;bu1c2Ahot chili peppe2Ylobst2N;ll;ders dige1Ll madrid;c,s;ant3Aizn2Q;a8bs,e5fiz2Ihilip4i3r1;emier 1udenti1D;leagTo2K;nk floyd,zza hut; morrBs;psi2tro1uge0E;br33chi0Tn33;!co;lant2Un1yp16; 2ason27da2P;ld navy,pec,range juli2xf1;am;us;aAb9e6fl,h5i4o1sa,vid3wa;k2tre dame,vart1;is;ia;ke,ntendo,ss0QvZ;l,s;c,st1Otflix,w1; 1sweek;kids on the block,york0D;a,c;nd22s2t1;ional aca2Po,we0U;a,c02d0S;aDcdonalCe9i6lb,o3tv,y1;spa1;ce;b1Tnsanto,ody blu0t1;ley cr1or0T;ue;c2t1;as,subisO;helin,rosoft;dica2rcedes benz,talli1;ca;id,re;ds;cs milk,tt19z24;a3e1g,ittle caesa1P; ore09novo,x1;is,mark,us; 1bour party;pres0Dz boy;atv,fc,kk,lm,m1od1O;art;iffy lu0Roy divisi0Jpmorgan1sa;! cha09;bm,hop,k3n1tv;g,te1;l,rpol;ea;a5ewlett pack1Vi3o1sbc,yundai;me dep1n1P;ot;tac1zbollah;hi;lliburt08sbro;eneral 6hq,ithub,l5mb,o2reen d0Ou1;cci,ns n ros0;ldman sachs,o1;dye1g0H;ar;axo smith kli04encoW;electr0Nm1;oto0Z;a5bi,c barcelo4da,edex,i2leetwood m03o1rito l0G;rd,xcY;at,fa,nancial1restoZ; tim0;na;cebook,nnie mae;b0Asa,u3xxon1; m1m1;ob0J;!rosceptics;aiml0De5isney,o4u1;nkin donu2po0Zran dur1;an;ts;j,w jon0;a,f lepp12ll,peche mode,r spieg02stiny's chi1;ld;aJbc,hFiDloudflaCnn,o3r1;aigsli5eedence clearwater reviv1ossra09;al;c7inba6l4m1o0Est09;ca2p1;aq;st;dplSg1;ate;se;a c1o chanQ;ola;re;a,sco1tigroup;! systems;ev2i1;ck fil a,na daily;r1y;on;d2pital o1rls jr;ne;bury,ill1;ac;aEbc,eBf9l5mw,ni,o1p,rexiteeU;ei3mbardiIston 1;glo1pizza;be;ng;o2ue c1;roV;ckbuster video,omingda1;le; g1g1;oodriL;cht2e ge0rkshire hathaw1;ay;el;cardi,idu,nana republ3s1xt5y5;f,kin robbi1;ns;ic;bYcTdidSerosmith,iRlKmEnheuser busDol,ppleAr6s4u3v2y1;er;is,on;di,todesk;hland o1sociated E;il;b3g2m1;co;os;ys; compu1be0;te1;rs;ch;c,d,erican3t1;!r1;ak; ex1;pre1;ss; 5catel2ta1;ir;! lu1;ce1;nt;jazeera,qae1;da;g,rbnb;as;/dc,a3er,tivision1;! blizz1;ard;demy of scienc0;es;ba",
  "Possessive": "true\xA6its,my,our0thy;!s",
  "Noun|Verb": "true\xA60:9W;1:AA;2:96;3:A3;4:9R;5:A2;6:9K;7:8N;8:7L;9:A8;A:93;B:8D;C:8X;a9Ob8Qc7Id6Re6Gf5Sg5Hh55i4Xj4Uk4Rl4Em40n3Vo3Sp2Squ2Rr21s0Jt02u00vVwGyFzD;ip,oD;ne,om;awn,e6Fie68;aOeMhJiHoErD;ap,e9Oink2;nd0rDuC;kDry,sh5Hth;!shop;ck,nDpe,re,sh;!d,g;e86iD;p,sD;k,p0t2;aDed,lco8W;r,th0;it,lk,rEsDt4ve,x;h,te;!ehou1ra9;aGen5FiFoD;iDmAte,w;ce,d;be,ew,sA;cuum,l4B;pDr7;da5gra6Elo6A;aReQhrPiOoMrGuEwiDy5Z;n,st;nDrn;e,n7O;aGeFiEoDu6;t,ub2;bu5ck4Jgg0m,p;at,k,nd;ck,de,in,nsDp,v7J;f0i8R;ll,ne,p,r4Yss,t94uD;ch,r;ck,de,e,le,me,p,re;e5Wow,u6;ar,e,ll,mp0st,xt;g,lDng2rg7Ps5x;k,ly;a0Sc0Ne0Kh0Fi0Dk0Cl0Am08n06o05pXquaBtKuFwD;ea88iD;ng,pe,t4;bGit,m,ppErD;fa3ge,pri1v2U;lDo6S;e6Py;!je8;aMeLiKoHrEuDy2;dy,ff,mb2;a85eEiDo5Pugg2;ke,ng;am,ss,t4;ckEop,p,rD;e,m;ing,pi2;ck,nk,t4;er,m,p;ck,ff,ge,in,ke,lEmp,nd,p2rDte,y;!e,t;k,l;aJeIiHlGoFrDur,y;ay,e56inDu3;g,k2;ns8Bt;a5Qit;ll,n,r87te;ed,ll;m,n,rk;b,uC;aDee1Tow;ke,p;a5Je4FiDo53;le,rk;eep,iDou4;ce,p,t;ateboa7Ii;de,gnDl2Vnk,p,ze;!al;aGeFiEoDuff2;ck,p,re,w;ft,p,v0;d,i3Ylt0;ck,de,pe,re,ve;aEed,nDrv1It;se,t2N;l,r4t;aGhedu2oBrD;aEeDibb2o3Z;en,w;pe,t4;le,n,r2M;cDfegua72il,mp2;k,rifi3;aZeHhy6LiGoEuD;b,in,le,n,s5X;a6ck,ll,oDpe,u5;f,t;de,ng,ot,p,s1W;aTcSdo,el,fQgPje8lOmMnLo17pJque6sFturn,vDwa6V;eDi27;al,r1;er74oFpe8tEuD;lt,me;!a55;l71rt;air,eaDly,o53;l,t;dezvo2Zt;aDedy;ke,rk;ea1i4G;a6Iist0r5N;act6Yer1Vo71uD;nd,se;a38o6F;ch,s6G;c1Dge,iEke,lly,nDp1Wt1W;ge,k,t;n,se;es6Biv0;a04e00hYiXlToNrEsy4uD;mp,n4rcha1sh;aKeIiHoDu4O;be,ceFdu3fi2grDje8mi1p,te6;amDe6W;!me;ed,ss;ce,de,nt;sDy;er6Cs;cti3i1;iHlFoEp,re,sDuCw0;e,i5Yt;l,p;iDl;ce,sh;nt,s5V;aEce,e32uD;g,mp,n7;ce,nDy;!t;ck,le,n17pe,tNvot;a1oD;ne,tograph;ak,eFnErDt;fu55mA;!c32;!l,r;ckJiInHrFsEtDu1y;ch,e9;s,te;k,tD;!y;!ic;nt,r,se;!a7;bje8ff0il,oErDutli3Qver4B;bAd0ie9;ze;a4ReFoDur1;d,tD;e,i3;ed,gle8tD;!work;aMeKiIoEuD;rd0;ck,d3Rld,nEp,uDve;nt,th;it5EkD;ey;lk,n4Brr5CsDx;s,ta2B;asuBn4UrDss;ge,it;il,nFp,rk3WsEtD;ch,t0;h,k,t0;da5n0oeuvB;aLeJiHoEuD;mp,st;aEbby,ck,g,oDve;k,t;d,n;cDe,ft,mAnIst;en1k;aDc0Pe4vK;ch,d,k,p,se;bFcEnd,p,t4uD;gh,n4;e,k;el,o2U;eEiDno4E;ck,d,ll,ss;el,y;aEo1OuD;i3mp;m,zz;mpJnEr46ssD;ue;c1Rdex,fluGha2k,se2HteDvoi3;nt,rD;e6fa3viD;ew;en3;a8le2A;aJeHiGoEuD;g,nt;l3Ano2Dok,pDr1u1;!e;ghli1Fke,nt,re,t;aDd7lp;d,t;ck,mGndFrEsh,tDu9;ch,e;bo3Xm,ne4Eve6;!le;!m0;aMear,ift,lKossJrFuD;arDe4Alp,n;antee,d;aFiEoDumb2;uCwth;ll,nd,p;de,sp;ip;aBoDue;ss,w;g,in,me,ng,s,te,ze;aZeWiRlNoJrFuD;ck,el,nDss,zz;c38d;aEoDy;st,wn;cDgme,me,nchi1;tuB;cFg,il,ld,rD;ce,e29mDwa31;!at;us;aFe0Vip,oDy;at,ck,od,wD;!er;g,ke,me,re,sh,vo1E;eGgFlEnDre,sh,t,x;an3i0Q;e,m,t0;ht,uB;ld;aEeDn3;d,l;r,tuB;ce,il,ll,rm,vo2W;cho,d7ffe8nMsKxFyeD;!baD;ll;cGerci1hFpDtra8;eriDo0W;en3me9;au6ibA;el,han7u1;caDtima5;pe;count0d,vy;a01eSiMoJrEuDye;b,el,mp,pli2X;aGeFiEoD;ne,p;ft,ll,nk,p,ve;am,ss;ft,g,in;cEd7ubt,wnloD;ad;k,u0E;ge6p,sFt4vD;e,iDor3;de;char7gui1h,liEpD;at4lay,u5;ke;al,bKcJfeIlGmaCposAsEtaD;il;e07iD;gn,re;ay,ega5iD;ght;at,ct;li04rea1;a5ut;b,ma7n3rDte;e,t;a0Eent0Dh06irc2l03oKrFuD;be,e,rDt;b,e,l,ve;aGeFoEuDy;sh;p,ss,wd;dAep;ck,ft,sh;at,de,in,lTmMnFordina5py,re,st,uDv0;gh,nDp2rt;s01t;ceHdu8fli8glomeIsFtDveN;a8rD;a6ol;e9tru8;ct;ntDrn;ra5;bHfoGmFpD;leDouCromi1;me9;aCe9it,u5;rt;at,iD;ne;lap1oD;r,ur;aEiDoud,ub;ck,p;im,w;aEeDip;at,ck,er;iGllen7nErD;ge,m,t;ge,nD;el;n,r;er,re;ke,ll,mp,noe,pGrXsFtEuDve;se,ti0I;alog,ch;h,t;!tuB;re;a03eZiXlToPrHuEyD;pa11;bb2ck2dgEff0mp,rDst,zz;den,n;et;anJeHiFoadEuD;i1sh;ca6;be,d7;ge;aDed;ch,k;ch,d;aFg,mb,nEoDrd0tt2x,ycott;k,st,t;d,e;rd,st;aFeCiDoYur;nk,tz;nd;me;as,d,ke,nd,opsy,tD;!ch,e;aFef,lt,nDt;d,efA;it;r,t;ck,il,lan3nIrFsEtt2;le;e,h;!gDk;aDe;in;!d,g,k;bu1c05dZge,iYlVnTppQrLsIttGucEwaD;rd;tiD;on;aDempt;ck;k,sD;i6ocia5;st;chFmD;!oD;ur;!iD;ve;eEroa4;ch;al;chDg0sw0;or;aEt0;er;rm;d,m,r;dreHvD;an3oD;ca5;te;ce;ss;cDe,he,t;eFoD;rd,u9;nt;nt,ss;se",
  "Actor": "true\xA60:7B;1:7G;2:6A;3:7F;4:7O;5:7K;a6Nb62c4Ud4Be41f3Sg3Bh30i2Uj2Qkin2Pl2Km26n1Zo1Sp0Vqu0Tr0JsQtJuHvEw8yo6;gi,ut6;h,ub0;aAe9i8o7r6;estl0it0;m2rk0;fe,nn0t2Bza2H;atherm2ld0;ge earn0it0nder0rri1;eter7i6oyF;ll5Qp,s3Z;an,ina2U;n6s0;c6Uder03;aoisea23e9herapi5iktok0o8r6ut1yco6S;a6endseLo43;d0mp,nscri0Bvel0;ddl0u1G;a0Qchn7en6na4st0;ag0;i3Oo0D;aiXcUeRhPiMki0mu26oJpGquaFtBu7wee6;p0theart;lt2per7r6;f0ge6Iviv1;h6inten0Ist5Ivis1;ero,um2;a8ep7r6;ang0eam0;bro2Nc2Ofa2Nmo2Nsi20;ff0tesm2;tt0;ec7ir2Do6;kesp59u0M;ia5Jt3;l7me6An,rcere6ul;r,ss;di0oi5;n7s6;sy,t0;g0n0;am2ephe1Iow6;girl,m2r2Q;cretInior cit3Fr6;gea4v6;a4it1;hol4Xi7reen6ulpt1;wr2C;e01on;l1nt;aEe9o8u6;l0nn6;er up,ingE;g40le mod3Zof0;a4Zc8fug2Ppo32searQv6;ere4Uolution6;ary;e6luYru22;ptio3T;bbi,dic5Vpp0;arter6e2Z;back;aYeWhSiRlOoKr8sycho7u6;nk,p31;logi5;aGeDiBo6;d9fess1g7ph47s6;pe2Ktitu51;en6ramm0;it1y;igy,uc0;est4Nme mini0Unce6s3E;!ss;a7si6;de4;ch0;ctiti39nk0P;dca0Oet,li6pula50rnst42;c2Itic6;al scie6i2;nti5;a6umb0;nn0y6;er,ma4Lwright;lgrim,one0;a8iloso7otogra7ra6ysi1V;se;ph0;ntom,rmaci5;r6ssi1T;form0s4O;i3El,nel3Yr8st1tr6wn;i6on;arWot;ent4Wi42tn0;ccupa4ffBp8r7ut6;ca5l0B;ac4Iganiz0ig2Fph2;er3t6;i1Jomet6;ri5;ic0spring;aBe9ie4Xo7u6;n,rser3J;b6mad,vi4V;le2Vo4D;i6mesis,phew;ce,ghb1;nny,rr3t1X;aEeDiAo7u6yst1Y;m8si16;der3gul,m7n6th0;arDk;!my;ni7s6;f02s0Jt0;on,st0;chan1Qnt1rcha4;gi9k0n8rtyr,t6y1;e,riar6;ch;ag0iac;ci2stra3I;a7e2Aieutena4o6;rd,s0v0;bor0d7ndlo6ss,urea3Fwy0ym2;rd;!y;!s28;e8o7u6;ggl0;gg0urna2U;st0;c3Hdol,llu3Ummigra4n6; l9c1Qfa4habi42nov3s7ve6;nt1stig3;pe0Nt6;a1Fig3ru0M;aw;airFeBistoAo8u6ygie1K;man6sba2H;!ita8;bo,st6usekN;age,e3P;ri2;ir,r6;m7o6;!ine;it;dress0sty2C;aLeIhostGirl26ladi3oCrand7u6;e5ru;c9daug0Jfa8m7pa6s2Y;!re4;a,o6;th0;hi1B;al7d6lf0;!de3A;ie,k6te26;eep0;!wr6;it0;isha,n6;i6tl04;us;mbl0rden0;aDella,iAo7r6;eela2Nie1P;e,re6ster pare4;be1Hm2r6st0;unn0;an2ZgZlmm17nanci0r6tt0;e6st la2H; marsh2OfigXm2;rm0th0;conoEdDlectriCm8n7x6;amin0cellency,i2A;emy,trepreneur,vironmenta1J;c8p6;er1loye6;e,r;ee;ci2;it1;mi5;aKeBi8ork,ri7u6we02;de,tche2H;ft0v0;ct3eti7plom2Hre6va;ct1;ci2ti2;aDcor3fencCi0InAput9s7tectLvel6;op0;ce1Ge6ign0;rt0;ee,y;iz6;en;em2;c1Ml0;d8nc0redev7ug6;ht0;il;!dy;a06e04fo,hXitizenWlToBr9u6;r3stomer6;! representat6;ive;e3it6;ic;lJmGnAord9rpor1Nu7w6;boy,ork0;n6ri0;ciTte1Q;in3;fidantAgressSs9t6;e0Kr6;ibut1o6;ll0;tab13ul1O;!e;edi2m6pos0rade;a0EeQissi6;on0;leag8on7um6;ni5;el;ue;e6own;an0r6;ic,k;!s;a9e7i6um;ld;erle6f;ad0;ir7nce6plFract0;ll1;m2wI;lebri6o;ty;dBptAr6shi0;e7pe6;nt0;r,t6;ak0;ain;et;aMeLiJlogg0oErBu6;dd0Fild0rgl9siness6;m2p7w6;om2;ers05;ar;i7o6;!k0th0;cklay0de,gadi0;hemi2oge8y6;!frie6;nd;ym2;an;cyc6sR;li5;atbox0ings;by,nk0r6;b0on7te6;nd0;!e07;c04dWge4nQpLrHsFtAu7yatull6;ah;nt7t6;h1oG;!ie;h8t6;e6orney;nda4;ie5le6;te;sis00tron6;aut,om0;chbis8isto7tis6;an,t;crU;hop;ost9p6;ari6rentiS;ti6;on;le;a9cest1im3nou8y6;bo6;dy;nc0;ly5rc6;hi5;mi8v6;entur0is1;er;ni7r6;al;str3;at1;or;counBquaintanArob9t6;ivi5or,re6;ss;st;at;ce;ta4;nt",
  "Adj|Noun": "true\xA60:16;a1Db17c0Ud0Re0Mf0Dg0Ah08i06ju05l02mWnUoSpNrIsBt7u4v1watershed;a1ision0Z;gabo4nilla,ria1;b0Vnt;ndergr1pstairs;adua14ou1;nd;a3e1oken,ri0;en,r1;min0rori13;boo,n;age,e5ilv0Flack,o3quat,ta2u1well;bordina0Xper5;b0Lndard;ciali0Yl1vereign;e,ve16;cret,n1ri0;ior;a4e2ou1ubbiL;nd,tiY;ar,bBl0Wnt0p1side11;resent0Vublican;ci0Qsh;a4eriodic0last0Zotenti0r1;emi2incip0o1;!fession0;er,um;rall4st,tie0U;ff1pposi0Hv0;ens0Oi0C;agg01ov1uts;el;a5e3iniatJo1;bi01der07r1;al,t0;di1tr0N;an,um;le,riG;attOi2u1;sh;ber0ght,qC;stice,veniT;de0mpressioYn1;cumbe0Edividu0no0Dsta0Eterim;alf,o1umdrum;bby,melF;en2old,ra1;ph0Bve;er0ious;a7e5i4l3u1;git03t1;ure;uid;ne;llow,m1;aFiL;ir,t,vo1;riOuriO;l3p00x1;c1ecutUpeV;ess;d1iK;er;ar2e1;mographUrivO;k,l2;hiGlassSo2rude,unn1;ing;m5n1operK;creCstitueOte2vertab1;le;mpor1nt;ary;ic,m2p1;anion,lex;er2u1;ni8;ci0;al;e5lank,o4r1;i2u1;te;ef;ttom,urgeois;st;cadem9d6l2ntarct9r1;ab,ct8;e3tern1;at1;ive;rt;oles1ult;ce1;nt;ic",
  "Adj|Past": "true\xA60:4Q;1:4C;2:4H;3:4E;a44b3Tc36d2Je29f20g1Wh1Si1Jj1Gkno1Fl1Am15n12o0Xp0Mqu0Kr08sLtEuAv9w4yellow0;a7ea6o4rinkl0;r4u3Y;n,ri0;k31th3;rp0sh0tZ;ari0e1O;n5p4s0;d1li1Rset;cov3derstood,i4;fi0t0;a8e3Rhr7i6ouTr4urn0wi4C;a4imm0ou2G;ck0in0pp0;ed,r0;eat2Qi37;m0nn0r4;get0ni2T;aOcKeIhGimFm0Hoak0pDt7u4;bsid3Ogge44s4;pe4ta2Y;ct0nd0;a8e7i2Eok0r5u4;ff0mp0nn0;ength2Hip4;ed,p0;am0reotyp0;in0t0;eci4ik0oH;al3Efi0;pRul1;a4ock0ut;d0r0;a4c1Jle2t31;l0s3Ut0;a6or5r4;at4e25;ch0;r0tt3;t4ut0;is2Mur1;aEe5o4;tt0;cAdJf2Bg9je2l8m0Knew0p7qu6s4;eTpe2t4;or0ri2;e3Dir0;e1lac0;at0e2Q;i0Rul1;eiv0o4ycl0;mme2Lrd0v3;in0lli0ti2A;a4ot0;li28;aCer30iBlAo9r5u4;mp0zzl0;e6i2Oo4;ce2Fd4lo1Anou30pos0te2v0;uc0;fe1CocCp0Iss0;i2Kli1L;ann0e2CuS;ck0erc0ss0;ck0i2Hr4st0;allLk0;bse7c6pp13rgan2Dver4;lo4whelm0;ok0;cupi0;rv0;aJe5o4;t0uri1A;ed0gle2;a6e5ix0o4ut0ys1N;di1Nt15u26;as0Clt0;n4rk0;ag0ufact0A;e6i5o4;ad0ck0st,v0;cens0m04st0;ft,v4;el0;tt0wn;a5o15u4;dg0s1B;gg0;llumSmpAn4sol1;br0cre1Ldebt0f8jZspir0t5v4;it0olv0;e4ox0Y;gr1n4re23;d0si15;e2l1o1Wuri1;li0o01r4;ov0;a6e1o4um03;ok0r4;ri0Z;mm3rm0;i6r5u4;a1Bid0;a0Ui0Rown;ft0;aAe9i8l6oc0Ir4;a4i0oz0Y;ctHg19m0;avo0Ju4;st3;ni08tt0x0;ar0;d0il0sc4;in1;dCl1mBn9quipp0s8x4;agger1c6p4te0T;a0Se4os0;ct0rie1D;it0;cap0tabliZ;cha0XgFha1As4;ur0;a0Zbarra0N;i0Buc1;aMeDi5r4;a01i0;gni08miniSre2s4;a9c6grun0Ft4;o4re0Hu17;rt0;iplWou4;nt0r4;ag0;bl0;cBdRf9l8p7ra6t5v4;elop0ot0;ail0ermQ;ng0;re07;ay0ight0;e4in0o0M;rr0;ay0enTor1;m5t0z4;ed,zl0;ag0p4;en0;aPeLhIlHo9r6u4;lt4r0stom03;iv1;a5owd0u4;sh0;ck0mp0;d0loAm7n4ok0v3;centr1f5s4troC;id3olid1;us0;b5pl4;ic1;in0;r0ur0;assi9os0utt3;ar5i4;ll0;g0m0;lebr1n6r4;ti4;fi0;tralJ;g0lcul1;aDewild3iCl9o7r5urn4;ed,t;ok4uis0;en;il0r0t4und;tl0;e5i4;nd0;ss0;as0;ffl0k0laMs0tt3;bPcNdKfIg0lFmaz0nDppBrm0ss9u5wa4;rd0;g5thor4;iz0;me4;nt0;o6u4;m0r0;li0re4;ci1;im1ticip1;at0;a5leg0t3;er0;rm0;fe2;ct0;ju5o7va4;nc0;st0;ce4knowledg0;pt0;and5so4;rb0;on0;ed",
  "Singular": "true\xA60:5J;1:5H;2:4W;3:4S;4:52;5:57;6:5L;7:56;8:5B;a52b4Lc3Nd35e2Xf2Og2Jh28in24j23k22l1Um1Ln1Ho1Bp0Rqu0Qr0FsZtMuHvCw9x r58yo yo;a9ha3Po3Q;f3i4Rt0Gy9;! arou39;arCeAideo ga2Qo9;cabu4Jl5C;gOr9t;di4Zt1Y;iety,ni4P;nBp30rAs 9;do43s5E;bani1in0;coordinat3Ader9;estima1to24we41; rex,aKeJhHiFoErBuAv9;! show;m2On2rntLto1D;agedy,ib9o4E;e,u9;n0ta46;ni1p2rq3L;c,er,m9;etF;ing9ree26;!y;am,mp3F;ct2le6x return;aNcMeKhor4QiJkHoGpin off,tDuBy9;ll9ner7st4T;ab2X;b9i1n28per bowl,rro1X;st3Ltot0;atAipe2Go1Lrate7udent9;! lo0I;i39u1;ft ser4Lmeo1I;elet5i9;ll,r3V;b38gn2Tte;ab2Jc9min3B;t,urity gua2N;e6ho2Y;bbatic0la3Jndwi0Qpi5;av5eDhetor2iAo9;de6om,w;tAv9;erb2C;e,u0;bDcBf9publ2r10spi1;er9orm3;e6r0;i9ord label;p2Ht0;a1u46;estion mark,ot2F;aPeMhoLiIlGoErAu9yram1F;ddi3HpErpo1Js3J;eBo9;bl3Zs9;pe3Jta1;dic1Rmi1Fp1Qroga8ss relea1F;p9rt0;py;a9ebisci1;q2Dte;cn2eAg9;!gy;!r;ne call,tocoK;anut,dAr9t0yo1;cen3Jsp3K;al,est0;nop4rAt9;e,hog5;adi11i2V;atme0bj3FcBpia1rde0thers,utspok5ve9wn3;n,r9;ti0Pview;cuAe9;an;pi3;arBitAot9umb3;a2Fhi2R;e,ra1;cot2ra8;aFeCiAo9ur0;nopo4p18rni2Nsq1Rti36uld;c,li11n0As9tt5;chief,si34;dAnu,t9;al,i3;al,ic;gna1mm0nd15rsupi0te9yf4;ri0;aDegCiBu9;ddi1n9;ch;me,p09; Be0M;bor14y9; 9er;up;eyno1itt5;el4ourn0;cBdices,itia8ni25sAtel0Lvert9;eb1J;e28titu1;en8i2T;aIeEighDoAu9;man right,s22;me9rmoFsp1Ftb0K;! r9;un; scho0YriY;a9i1N;d9v5; start,pho9;ne;ndful,sh brown,v5ze;aBelat0Ilaci3r9ul4yp1S;an9enadi3id;a1Cd slam,ny;df4r9;l2ni1I;aGeti1HiFlu1oCrAun9;er0;ee market,i9onti3;ga1;l4ur9;so9;me;ePref4;br2mi4;conoFffi7gg,lecto0Rmbas1EnCpidem2s1Zth2venBxAyel9;id;ampZempl0Nte6;i19t;er7terp9;ri9;se;my;eLiEoBr9ump tru0U;agonf4i9;er,ve thru;cAg7i4or,ssi3wn9;side;to0EumenE;aEgniDnn3sAvide9;nd;conte6incen8p9tri11;osi9;ti0C;ta0H;le0X;athBcAf9ni0terre6;ault 05err0;al,im0;!b9;ed;aWeThMiLlJoDr9;edit caBuc9;ib9;le;rd;efficDke,lCmmuniqLnsApi3rr0t0Xus9yo1;in;erv9uI;ato02;ic,lQ;ie6;er7i9oth;e6n2;ty,vil wM;aDeqCick5ocoBr9;istmas car9ysanthemum;ol;la1;ue;ndeli3racteri9;st2;iAllEr9;e0tifica1;liZ;hi3nFpErCt9ucus;erpi9hedr0;ll9;ar;!bohyd9ri3;ra1;it0;aAe,nib0t9;on;l,ry;aMeLiop2leJoHrDu9;nny,r9tterf4;g9i0;la9;ry;eakAi9;ck;fa9throB;st;dy,ro9wl;ugh;mi9;sh;an,l4;nkiArri3;er;ng;cSdMlInFppeti1rDsBtt2utop9;sy;ic;ce6pe9;ct;r9sen0;ay;ecAoma4tiA;ly;do1;i5l9;er7y;gy;en; hominDjAvan9;tage;ec8;ti9;ve;em;cCeAqui9;tt0;ta1;te;iAru0;al;de6;nt",
  "Person|Noun": "true\xA6a0Eb07c03dWeUfQgOhLjHkiGlFmCnBolive,p7r4s3trini06v1wa0;ng,rd,tts;an,enus,iol0;a,et;ky,onPumm09;ay,e1o0uby;bin,d,se;ed,x;a2e1o0;l,tt04;aLnJ;dYge,tR;at,orm;a0eloW;t0x,ya;!s;a9eo,iH;ng,tP;a2e1o0;lGy;an,w3;de,smi4y;a0erb,iOolBuntR;ll,z0;el;ail,e0iLuy;ne;a1ern,i0lo;elds,nn;ith,n0;ny;a0dEmir,ula,ve;rl;a4e3i1j,ol0;ly;ck,x0;ie;an,ja;i0wn;sy;am,h0liff,rystal;a0in,ristian;mbers,ri0;ty;a4e3i2o,r0ud;an0ook;dy;ll;nedict,rg;k0nks;er;l0rt;fredo,ma",
  "Actor|Verb": "true\xA6aCb8c5doctor,engineAfool,g3host,judge,m2nerd,p1recruit,scout,ushAvolunteAwi0;mp,tneA;arent,ilot;an,ime;eek,oof,r0uide;adu8oom;ha1o0;ach,nscript,ok;mpion,uffeur;o2u0;lly,tch0;er;ss;ddi1ffili0rchite1;ate;ct",
  "MaleName": "true\xA60:H6;1:FZ;2:DS;3:GQ;4:CZ;5:FV;6:GM;7:FP;8:GW;9:ET;A:C2;B:GD;aF8bE1cCQdBMeASfA1g8Yh88i7Uj6Sk6Bl5Mm48n3So3Ip33qu31r26s1Et0Ru0Ov0CwTxSyHzC;aCor0;cChC1karia,nAT;!hDkC;!aF6;!ar7CeF5;aJevgenBSoEuC;en,rFVsCu3FvEF;if,uf;nDs6OusC;ouf,s6N;aCg;s,tC;an,h0;hli,nCrosE1ss09;is,nC;!iBU;avi2ho5;aPeNiDoCyaEL;jcieBJlfgang,odrFutR;lFnC;f8TsC;lCt1;ow;bGey,frEhe4QlC;aE5iCy;am,e,s;ed8iC;d,ed;eAur;i,ndeD2rn2sC;!l9t1;lDyC;l1ne;lDtC;!er;aCHy;aKernDAiFladDoC;jteB0lodymyr;!iC;mFQsDB;cFha0ktBZnceDrgCOvC;a0ek;!nC;t,zo;!e4StBV;lCnC7sily;!entC;in9J;ghE2lCm70nax,ri,sm0;riCyss87;ch,k;aWeRhNiLoGrEuDyC;!l2roEDs1;n6r6E;avD0eCist0oy,um0;ntCRvBKy;bFdAWmCny;!asDmCoharu;aFFie,y;!z;iA6y;mCt4;!my,othy;adEeoDia0SomC;!as;!dor91;!de4;dFrC;enBKrC;anBJeCy;ll,nBI;!dy;dgh,ha,iCnn2req,tsu5V;cDAka;aYcotWeThPiMlobod0oKpenc2tEurDvenAEyCzym1;ed,lvest2;aj,e9V;anFeDuC;!aA;fan17phEQvCwaA;e77ie;!islaCl9;v,w;lom1rBuC;leymaDHta;dDgmu9UlCm1yabonga;as,v8B;!dhart8Yn9;aEeClo75;lCrm0;d1t1;h9Jne,qu1Jun,wn,yne;aDbastiEDk2Yl5Mpp,rgCth,ymoCU;e1Dio;m4n;!tC;!ie,y;eDPlFmEnCq67tosCMul;dCj2UtiA5;e01ro;!iATkeB6mC4u5;!ik,vato9K;aZeUheC8iRoGuDyC;an,ou;b99dDf4peAssC;!elEG;ol00y;an,bLc7MdJel,geIh0lHmGnEry,sDyC;!ce;ar7Ocoe,s;!aCnBU;ld,n;an,eo;a7Ef;l7Jr;e3Eg2n9olfo,riC;go;bBNeDH;cCl9;ar87c86h54kCo;!ey,ie,y;cFeA3gDid,ubByCza;an8Ln06;g85iC;naC6s;ep;ch8Kfa5hHin2je8HlGmFndEoHpha5sDul,wi36yC;an,mo8O;h9Im4;alDSol3O;iD0on;f,ph;ul;e9CinC;cy,t1;aOeLhilJiFrCyoG;aDeC;m,st1;ka85v2O;eDoC;tr;r8GtC;er,ro;!ipCl6H;!p6U;dCLrcy,tC;ar,e9JrC;!o7;b9Udra8So9UscAHtri62ulCv8I;!ie,o7;ctav6Ji2lImHndrBRrGsDtCum6wB;is,to;aDc6k6m0vCwaBE;al79;ma;i,vR;ar,er;aDeksandr,ivC;er,i2;f,v;aNeLguyBiFoCu3O;aDel,j4l0ma0rC;beAm0;h,m;cFels,g5i9EkDlC;es,s;!au,h96l78olaC;!i,y;hCkCol76;ol75;al,d,il,ls1vC;ilAF;hom,tC;e,hC;anCy;!a5i5;aYeViLoGuDyC;l4Nr1;hamDr84staC;fa,p6E;ed,mG;di10e,hamEis4JntDritz,sCussa;es,he;e,y;ad,ed,mC;ad,ed;cGgu5hai,kFlEnDtchC;!e8O;a9Pik;house,o7t1;ae73eC3ha8Iolaj;ah,hDkC;!ey,y;aDeC;al,l;el,l;hDlv3rC;le,ri8Ev4T;di,met;ay0c00gn4hWjd,ks2NlTmadZnSrKsXtDuric7VxC;imilBKwe8B;eHhEi69tCus,y69;!eo,hCia7;ew,i67;eDiC;as,eu,s;us,w;j,o;cHiGkFlEqu8Qsha83tCv3;iCy;!m,n;in,on;el,o7us;a6Yo7us;!elCin,o7us;!l8o;frAEi5Zny,u5;achDcoCik;lm;ai,y;amDdi,e5VmC;oud;adCm6W;ou;aulCi9P;ay;aWeOiMloyd,oJuDyC;le,nd1;cFdEiDkCth2uk;a7e;gi,s,z;ov7Cv6Hw6H;!as,iC;a6Een;g0nn52renDuCvA4we7D;!iS;!zo;am,n4oC;n5r;a9Yevi,la5KnHoFst2thaEvC;eCi;nte;bo;nCpo8V;!a82el,id;!nC;aAy;mEnd1rDsz73urenCwr6K;ce,t;ry,s;ar,beAont;aOeIhalHiFla4onr63rDu5SylC;e,s;istCzysztof;i0oph2;er0ngsl9p,rC;ilA9k,ollos;ed,id;en0iGnDrmCv4Z;it;!dDnCt1;e2Ny;ri4Z;r,th;cp2j4mEna8BrDsp6them,uC;ri;im,l;al,il;a03eXiVoFuC;an,lCst3;en,iC;an,en,o,us;aQeOhKkub4AnIrGsDzC;ef;eDhCi9Wue;!ua;!f,ph;dCge;i,on;!aCny;h,s,th6J;anDnC;!ath6Hie,n72;!nC;!es;!l,sCy;ph;o,qu3;an,mC;!i,m6V;d,ffFns,rCs4;a7JemDmai7QoCry;me,ni1H;i9Dy;!e73rC;ey,y;cKdBkImHrEsDvi2yC;dBs1;on,p2;ed,oDrCv67;e6Qod;d,s61;al,es5Wis1;a,e,oCub;b,v;ob,qu13;aTbNchiMgLke53lija,nuKonut,rIsEtCv0;ai,suC;ki;aDha0i8XmaCsac;el,il;ac,iaC;h,s;a,vinCw3;!g;k,nngu6X;nac1Xor;ka;ai,rahC;im;aReLoIuCyd6;beAgGmFsC;eyDsC;a3e3;in,n;ber5W;h,o;m2raDsse3wC;a5Pie;c49t1K;a0Qct3XiGnDrC;beAman08;dr7VrC;iCy2N;!k,q1R;n0Tt3S;bKlJmza,nIo,rEsDyC;a5KdB;an,s0;lEo67r2IuCv9;hi5Hki,tC;a,o;an,ey;k,s;!im;ib;a08e00iUlenToQrMuCyorgy;iHnFsC;!taC;f,vC;!e,o;n6tC;er,h2;do,lC;herDlC;auCerQ;me;aEegCov2;!g,orC;!io,y;dy,h7C;dfr9nza3XrDttfC;ri6C;an,d47;!n;acoGlEno,oCuseppe;rgiCvan6O;!o,s;be6Ies,lC;es;mo;oFrC;aDha4HrCt;it,y;ld,rd8;ffErgC;!e7iCy;!os;!r9;bElBrCv3;eCla1Nr4Hth,y;th;e,rC;e3YielC;!i4;aXeSiQlOorrest,rCyod2E;aHedFiC;edDtC;s,z;ri18;!d42eri11riC;ck,k;nCs2;cEkC;ie,lC;in,yn;esLisC;!co,z3M;etch2oC;ri0yd;d5lConn;ip;deriFliEng,rC;dinaCg4nan0B;nd8;pe,x;co;bCdi,hd;iEriC;ce,zC;io;an,en,o;benez2dZfrYit0lTmMnJo3rFsteb0th0ugenEvCymBzra;an,eCge4D;ns,re3K;!e;gi,iDnCrol,v3w3;est8ie,st;cCk;!h,k;o0DriCzo;co,qC;ue;aHerGiDmC;aGe3A;lCrh0;!iC;a10o,s;s1y;nu5;beAd1iEliDm2t1viCwood;n,s;ot28s;!as,j5Hot,sC;ha;a3en;!dGg6mFoDua2QwC;a2Pin;arC;do;oZuZ;ie;a04eTiOmitrNoFrag0uEwDylC;an,l0;ay3Hig4D;a3Gdl9nc0st3;minFnDri0ugCvydGy2S;!lF;!a36nCov0;e1Eie,y;go,iDykC;as;cCk;!k;i,y;armuFetDll1mitri7neCon,rk;sh;er,m6riC;ch;id;andLepak,j0lbeAmetri4nIon,rGsEvDwCxt2;ay30ey;en,in;hawn,moC;nd;ek,riC;ck;is,nC;is,y;rt;re;an,le,mKnIrEvC;e,iC;!d;en,iEne0PrCyl;eCin,yl;l45n;n,o,us;!iCny;el,lo;iCon;an,en,on;a0Fe0Ch03iar0lRoJrFuDyrC;il,us;rtC;!is;aEistC;iaCob12;no;ig;dy,lInErC;ey,neliCy;s,us;nEor,rDstaC;nt3;ad;or;by,e,in,l3t1;aHeEiCyde;fCnt,ve;fo0Xt1;menDt4;us;s,t;rFuDyC;!t1;dCs;e,io;enC;ce;aHeGrisC;!toC;phCs;!eC;!r;st2t;d,rCs;b5leC;s,y;cDdrCs6;ic;il;lHmFrC;ey,lDroCy;ll;!o7t1;er1iC;lo;!eb,v3;a09eZiVjorn,laUoSrEuCyr1;ddy,rtKst2;er;aKeFiEuDyC;an,ce,on;ce,no;an,ce;nDtC;!t;dDtC;!on;an,on;dFnC;dDisC;lav;en,on;!foOl9y;bby,gd0rCyd;is;i0Lke;bElDshC;al;al,lL;ek;nIrCshoi;at,nEtC;!raC;m,nd;aDhaCie;rd;rd8;!iDjam3nCs1;ie,y;to;kaMlazs,nHrC;n9rDtC;!holomew;eCy;tt;ey;dCeD;ar,iC;le;ar1Nb1Dd16fon15gust3hm12i0Zja0Yl0Bm07nTputsiSrGsaFugustEveDyCziz;a0kh0;ry;o,us;hi;aMchiKiJjun,mHnEon,tCy0;em,hCie,ur8;ur;aDoC;!ld;ud,v;aCin;an,nd8;!el,ki;baCe;ld;ta;aq;aMdHgel8tCw6;hoFoC;iDnC;!i8y;ne;ny;er7rCy;eDzC;ej;!as,i,j,s,w;!s;s,tolC;iCy;!y;ar,iEmaCos;nu5r;el;ne,r,t;aVbSdBeJfHiGl01onFphonsEt1vC;aPin;on;e,o;so,zo;!sR;!onZrC;ed;c,jaHksFssaHxC;!andC;er,rC;e,os,u;andCei;ar,er,r;ndC;ro;en;eDrecC;ht;rt8;dd3in,n,sC;taC;ir;ni;dDm6;ar;an,en;ad,eC;d,t;in;so;aGi,olErDvC;ik;ian8;f8ph;!o;mCn;!a;dGeFraDuC;!bakr,lfazl;hCm;am;!l;allFel,oulaye,ulC;!lDrahm0;an;ah,o;ah;av,on",
  "Uncountable": "true\xA60:2E;1:2L;2:33;a2Ub2Lc29d22e1Rf1Ng1Eh16i11j0Yk0Wl0Rm0Hn0Do0Cp03rZsLt9uran2Jv7w3you gu0E;a5his17i4oo3;d,l;ldlife,ne;rm8t1;apor,ernacul29i3;neg28ol1Otae;eDhBiAo8r4un3yranny;a,gst1B;aff2Oea1Ko4ue nor3;th;o08u3;bleshoot2Ose1Tt;night,othpas1Vwn3;foEsfoE;me off,n;er3und1;e,mod2S;a,nnis;aDcCeBhAi9ki8o7p6t4u3weepstak0;g1Unshi2Hshi;ati08e3;am,el;ace2Keci0;ap,cc1meth2C;n,ttl0;lk;eep,ingl0or1C;lf,na1Gri0;ene1Kisso1C;d0Wfe2l4nd,t3;i0Iurn;m1Ut;abi0e4ic3;e,ke15;c3i01laxa11search;ogni10rea10;a9e8hys7luto,o5re3ut2;amble,mis0s3ten20;en1Zs0L;l3rk;i28l0EyH; 16i28;a24tr0F;nt3ti0M;i0s;bstetri24vercrowd1Qxyg09;a5e4owada3utella;ys;ptu1Ows;il poliZtional securi2;aAe8o5u3;m3s1H;ps;n3o1K;ey,o3;gamy;a3cha0Elancholy,rchandi1Htallurgy;sl0t;chine3g1Aj1Hrs,thema1Q; learn1Cry;aught1e6i5ogi4u3;ck,g12;c,s1M;ce,ghtn18nguis1LteratWv1;ath1isVss;ara0EindergartPn3;icke0Aowled0Y;e3upit1;a3llyfiGwel0G;ns;ce,gnor6mp5n3;forma00ter3;net,sta07;atiSort3rov;an18;a7e6isto09o3ung1;ckey,mework,ne4o3rseradi8spitali2use arrest;ky;s2y;adquarteXre;ir,libut,ppiHs3;hi3te;sh;ene8l6o5r3um,ymnas11;a3eZ;niUss;lf,re;ut3yce0F;en; 3ti0W;edit0Hpo3;ol;aNicFlour,o4urnit3;ure;od,rgive3uri1wl;ness;arCcono0LducaBlectr9n7quip8thi0Pvery6x3;ist4per3;ti0B;en0J;body,o08th07;joy3tertain3;ment;ici2o3;ni0H;tiS;nings,th;emi02i6o4raugh3ynas2;ts;pe,wnstai3;rs;abet0ce,s3;honZrepu3;te;aDelciChAivi07l8o3urrency;al,ld w6mmenta5n3ral,ttIuscoB;fusiHt 3;ed;ry;ar;assi01oth0;es;aos,e3;eMwK;us;d,rO;a8i6lood,owlHread5u3;ntGtt1;er;!th;lliarJs3;on;g3ss;ga3;ge;cKdviJeroGirFmBn6ppeal court,r4spi3thleL;rin;ithmet3sen3;ic;i6y3;o4th3;ing;ne;se;en5n3;es2;ty;ds;craft;bi8d3nau7;yna3;mi6;ce;id,ous3;ti3;cs",
  "Infinitive": "true\xA60:9G;1:9T;2:AD;3:90;4:9Z;5:84;6:AH;7:A9;8:92;9:A0;A:AG;B:AI;C:9V;D:8R;E:8O;F:97;G:6H;H:7D;a94b8Hc7Jd68e4Zf4Mg4Gh4Ai3Qj3Nk3Kl3Bm34nou48o2Vp2Equ2Dr1Es0CtZuTvRwI;aOeNiLors5rI;eJiI;ng,te;ak,st3;d5e8TthI;draw,er;a2d,ep;i2ke,nIrn;d1t;aIie;liADniAry;nJpI;ho8Llift;cov1dJear8Hfound8DlIplug,rav82tie,ve94;eaAo3X;erIo;cut,go,staAFvalA3w2G;aSeQhNoMrIu73;aIe72;ffi3Smp3nsI;aBfo7CpI;i8oD;pp3ugh5;aJiJrIwaD;eat5i2;nk;aImA0;ch,se;ck3ilor,keImp1r8L;! paD;a0Ic0He0Fh0Bi0Al08mugg3n07o05p02qu01tUuLwI;aJeeIim;p,t5;ll7Wy;bNccMffLggeCmmKppJrI;mouFpa6Zvi2;o0re6Y;ari0on;er,i4;e7Numb;li9KmJsiIveD;de,st;er9it;aMe8MiKrI;ang3eIi2;ng27w;fIng;f5le;b,gg1rI;t3ve;a4AiA;a4UeJit,l7DoI;il,of;ak,nd;lIot7Kw;icEve;atGeak,i0O;aIi6;m,y;ft,ng,t;aKi6CoJriIun;nk,v6Q;ot,rt5;ke,rp5tt1;eIll,nd,que8Gv1w;!k,m;aven9ul8W;dd5tis1Iy;a0FeKiJoI;am,t,ut;d,p5;a0Ab08c06d05f01group,hea00iZjoi4lXmWnVpTq3MsOtMup,vI;amp,eJiIo3B;sEve;l,rI;e,t;i8rI;ie2ofE;eLiKpo8PtIurfa4;o24rI;aHiBuctu8;de,gn,st;mb3nt;el,hra0lIreseF;a4e71;d1ew,o07;aHe3Fo2;a7eFiIo6Jy;e2nq41ve;mbur0nf38;r0t;inKleBocus,rJuI;el,rbiA;aBeA;an4e;aBu4;ei2k8Bla43oIyc3;gni39nci3up,v1;oot,uI;ff;ct,d,liIp;se,ze;tt3viA;aAenGit,o7;aWerUinpoiFlumm1LoTrLuI;b47ke,niArIt;poDsuI;aFe;eMoI;cKd,fe4XhibEmo7noJpo0sp1tru6vI;e,i6o5L;un4;la3Nu8;aGclu6dJf1occupy,sup0JvI;a6BeF;etermi4TiB;aGllu7rtr5Ksse4Q;cei2fo4NiAmea7plex,sIva6;eve8iCua6;mp1rItrol,ve;a6It6E;bOccuNmEpMutLverIwe;l07sJtu6Yu0wI;helm;ee,h1F;gr5Cnu2Cpa4;era7i4Ipo0;py,r;ey,seItaH;r2ss;aMe0ViJoIultiply;leCu6Pw;micJnIspla4;ce,g3us;!k;iIke,na9;m,ntaH;aPeLiIo0u3N;ke,ng1quIv5;eIi6S;fy;aKnIss5;d,gI;th5;rn,ve;ng2Gu1N;eep,idnJnI;e4Cow;ap;oHuI;gg3xtaI;po0;gno8mVnIrk;cTdRfQgeChPitia7ju8q1CsNtKun6EvI;a6eIo11;nt,rt,st;erJimi6BoxiPrI;odu4u6;aBn,pr03ru6C;iCpi8tIu8;all,il,ruB;abEibE;eCo3Eu0;iIul9;ca7;i7lu6;b5Xmer0pI;aLer4Uin9ly,oJrI;e3Ais6Bo2;rt,se,veI;riA;le,rt;aLeKiIoiCuD;de,jaInd1;ck;ar,iT;mp1ng,pp5raIve;ng5Mss;ath1et,iMle27oLrI;aJeIow;et;b,pp3ze;!ve5A;gg3ve;aTer45i5RlSorMrJuI;lf4Cndrai0r48;eJiIolic;ght5;e0Qsh5;b3XeLfeEgJsI;a3Dee;eIi2;!t;clo0go,shIwa4Z;ad3F;att1ee,i36;lt1st5;a0OdEl0Mm0FnXquip,rWsVtGvTxI;aRcPeDhOiNpJtIu6;ing0Yol;eKi8lIo0un9;aHoI;it,re;ct,di7l;st,t;a3oDu3B;e30lI;a10u6;lt,mi28;alua7oI;ke,l2;chew,pou0tab19;a0u4U;aYcVdTfSgQhan4joy,lPqOrNsuMtKvI;e0YisI;a9i50;er,i4rI;aHenGuC;e,re;iGol0F;ui8;ar9iC;a9eIra2ulf;nd1;or4;ang1oIu8;r0w;irc3lo0ou0ErJuI;mb1;oaGy4D;b3ct;bKer9pI;hasiIow1;ze;aKody,rI;a4oiI;d1l;lm,rk;ap0eBuI;ci40de;rIt;ma0Rn;a0Re04iKo,rIwind3;aw,ed9oI;wn;agno0e,ff1g,mi2Kne,sLvI;eIul9;rIst;ge,t;aWbVcQlod9mant3pNru3TsMtI;iIoDu37;lJngI;uiA;!l;ol2ua6;eJlIo0ro2;a4ea0;n0r0;a2Xe36lKoIu0S;uIv1;ra9;aIo0;im;a3Kur0;b3rm;af5b01cVduBep5fUliTmQnOpMrLsiCtaGvI;eIol2;lop;ch;a20i2;aDiBloIoD;re,y;oIy;te,un4;eJoI;liA;an;mEv1;a4i0Ao06raud,y;ei2iMla8oKrI;ee,yI;!pt;de,mIup3;missi34po0;de,ma7ph1;aJrief,uI;g,nk;rk;mp5rk5uF;a0Dea0h0Ai09l08oKrIurta1G;a2ea7ipp3uI;mb3;ales4e04habEinci6ll03m00nIrro6;cXdUfQju8no7qu1sLtKvI;eIin4;ne,r9y;aHin2Bribu7;er2iLoli2Epi8tJuI;lt,me;itu7raH;in;d1st;eKiJoIroFu0;rm;de,gu8rm;ss;eJoI;ne;mn,n0;eIlu6ur;al,i2;buCe,men4pI;eIi3ly;l,te;eBi6u6;r4xiC;ean0iT;rcumveFte;eJirp,oI;o0p;riAw;ncIre5t1ulk;el;a02eSi6lQoPrKuI;iXrIy;st,y;aLeaKiJoad5;en;ng;stfeLtX;ke;il,l11mba0WrrMth1;eIow;ed;!coQfrie1LgPhMliLqueaKstJtrIwild1;ay;ow;th;e2tt3;a2eJoI;ld;ad;!in,ui3;me;bysEckfi8ff3tI;he;b15c0Rd0Iff0Ggree,l0Cm09n03ppZrXsQttOuMvJwaE;it;eDoI;id;rt;gIto0X;meF;aIeCraB;ch,in;pi8sJtoI;niA;aKeIi04u8;mb3rt,ss;le;il;re;g0Hi0ou0rI;an9i2;eaKly,oiFrI;ai0o2;nt;r,se;aMi0GnJtI;icipa7;eJoIul;un4y;al;ly0;aJu0;se;lga08ze;iKlI;e9oIu6;t,w;gn;ix,oI;rd;a03jNmiKoJsoI;rb;pt,rn;niIt;st1;er;ouJuC;st;rn;cLhie2knowled9quiItiva7;es4re;ce;ge;eQliOoKrJusI;e,tom;ue;mIst;moJpI;any,liA;da7;ma7;te;pt;andPduBet,i6oKsI;coKol2;ve;liArt,uI;nd;sh;de;ct;on",
  "Person": "true\xA60:1Q;a29b1Zc1Md1Ee18f15g13h0Ri0Qj0Nk0Jl0Gm09n06o05p00rPsItCusain bolt,v9w4xzibit,y1;anni,oko on2uji,v1;an,es;en,o;a3ednesday adams,i2o1;lfram,o0Q;ll ferrell,z khalifa;lt disn1Qr1;hol,r0G;a2i1oltai06;n dies0Zrginia wo17;lentino rossi,n goG;a4h3i2ripp,u1yra banks;lZpac shakur;ger woods,mba07;eresa may,or;kashi,t1ylor;um,ya1B;a5carlett johanss0h4i3lobodan milosevic,no2ocr1Lpider1uperm0Fwami; m0Em0E;op dogg,w whi1H;egfried,nbad;akespeaTerlock holm1Sia labeouf;ddam hussa16nt1;a cla11ig9;aAe6i5o3u1za;mi,n dmc,paul,sh limbau1;gh;bin hood,d stew16nald1thko;in0Mo;han0Yngo starr,valdo;ese witherspo0i1mbrandt;ll2nh1;old;ey,y;chmaninoff,ffi,iJshid,y roma1H;a4e3i2la16o1uff daddy;cahont0Ie;lar,p19;le,rZ;lm17ris hilt0;leg,prah winfr0Sra;a2e1iles cra1Bostradam0J; yo,l5tt06wmQ;pole0s;a5e4i2o1ubar03;by,lie5net,rriss0N;randa ju1tt romn0M;ly;rl0GssiaB;cklemo1rkov,s0ta hari,ya angelou;re;ady gaga,e1ibera0Pu;bron jam0Xch wale1e;sa;anye west,e3i1obe bryant;d cudi,efer suther1;la0P;ats,sha;a2effers0fk,k rowling,rr tolki1;en;ck the ripp0Mwaharlal nehru,y z;liTnez,ron m7;a7e5i3u1;lk hog5mphrey1sa01;! bog05;l1tl0H;de; m1dwig,nry 4;an;ile selassFlle ber4m3rrison1;! 1;ford;id,mo09;ry;ast0iannis,o1;odwPtye;ergus0lorence nightinga08r1;an1ederic chopN;s,z;ff5m2nya,ustaXzeki1;el;eril lagasse,i1;le zatop1nem;ek;ie;a6e4i2octor w1rake;ho;ck w1ego maradoC;olf;g1mi lovaOnzel washingt0;as;l1nHrth vadR;ai lNt0;a8h5lint0o1thulhu;n1olio;an,fuci1;us;on;aucKop2ristian baMy1;na;in;millo,ptain beefhe4r1;dinal wols2son1;! palmF;ey;art;a8e5hatt,i3oHro1;ck,n1;te;ll g1ng crosby;atB;ck,nazir bhut2rtil,yon1;ce;to;nksy,rack ob1;ama;l 6r3shton kutch2vril lavig8yn ra1;nd;er;chimed2istot1;le;es;capo2paci1;no;ne",
  "Adjective": "true\xA60:AI;1:BS;2:BI;3:BA;4:A8;5:84;6:AV;7:AN;8:AF;9:7H;A:BQ;B:AY;C:BC;D:BH;E:9Y;aA2b9Ec8Fd7We79f6Ng6Eh61i4Xj4Wk4Tl4Im41n3Po36p2Oquart7Pr2Ds1Dt14uSvOwFye29;aMeKhIiHoF;man5oFrth7G;dADzy;despreB1n w97s86;acked1UoleF;!sa6;ather1PeFll o70ste1D;!k5;nt1Ist6Ate4;aHeGiFola5T;bBUce versa,gi3Lle;ng67rsa5R;ca1gBSluAV;lt0PnLpHrGsFttermoBL;ef9Ku3;b96ge1; Hb32pGsFtiAH;ca6ide d4R;er,i85;f52to da2;a0Fbeco0Hc0Bd04e02f01gu1XheaBGiXkn4OmUnTopp06pRrNsJtHus0wF;aFiel3K;nt0rra0P;app0eXoF;ld,uS;eHi37o5ApGuF;perv06spec39;e1ok9O;en,ttl0;eFu5;cogn06gul2RlGqu84sF;erv0olv0;at0en33;aFrecede0E;id,rallel0;am0otic0;aFet;rri0tF;ch0;nFq26vers3;sur0terFv7U;eFrupt0;st0;air,inish0orese98;mploy0n7Ov97xpF;ect0lain0;eHisFocume01ue;clFput0;os0;cid0rF;!a8Scov9ha8Jlyi8nea8Gprivileg0sMwF;aFei9I;t9y;hGircumcFonvin2U;is0;aFeck0;lleng0rt0;b20ppea85ssuGttend0uthorF;iz0;mi8;i4Ara;aLeIhoHip 25oGrF;anspare1encha1i2;geth9leADp notch,rpB;rny,ugh6H;ena8DmpGrFs6U;r49tia4;eCo8P;leFst4M;nt0;a0Dc09e07h06i04ki03l01mug,nobbi4XoVpRqueami4XtKuFymb94;bHccinAi generis,pFr5;erFre7N;! dup9b,vi70;du0li7Lp6IsFurb7J;eq9Atanda9X;aKeJi16o2QrGubboFy4Q;rn;aightFin5GungS; fFfF;or7V;adfa9Pri6;lwa6Ftu82;arHeGir6NlendBot Fry;on;c3Qe1S;k5se; call0lImb9phistic16rHuFviV;ndFth1B;proof;dBry;dFub6; o2A;e60ipF;pe4shod;ll0n d7R;g2HnF;ceEg6ist9;am3Se9;co1Zem5lfFn6Are7; suf4Xi43;aGholFient3A;ar5;rlFt4A;et;cr0me,tisfac7F;aOeIheumatoBiGoF;bu8Ztt7Gy3;ghtFv3; 1Sf6X;cJdu8PlInown0pro69sGtF;ard0;is47oF;lu2na1;e1Suc45;alcit8Xe1ondi2;bBci3mpa1;aSePicayu7laOoNrGuF;bl7Tnjabi;eKiIoF;b7VfGmi49pFxi2M;er,ort81;a7uD;maFor,sti7va2;!ry;ciDexis0Ima2CpaB;in55puli8G;cBid;ac2Ynt 3IrFti2;ma40tFv7W;!i3Z;i2YrFss7R;anoBtF; 5XiF;al,s5V;bSffQkPld OnMrLth9utKverF;!aIbMdHhGni75seas,t,wF;ei74rou74;a63e7A;ue;ll;do1Ger,si6A;d3Qg2Aotu5Z; bFbFe on o7g3Uli7;oa80;fashion0school;!ay; gua7XbFha5Uli7;eat;eHligGsF;ce7er0So1C;at0;diFse;a1e1;aOeNiMoGuF;anc0de; moEnHrthFt6V;!eFwe7L;a7Krn;chaGdescri7Iprof30sF;top;la1;ght5;arby,cessa4ighbor5wlyw0xt;k0usiaFv3;ti8;aQeNiLoHuF;dIltiF;facet0p6;deHlGnFot,rbBst;ochro4Xth5;dy;rn,st;ddle ag0nF;dbloZi,or;ag9diocEga,naGrFtropolit4Q;e,ry;ci8;cIgenta,inHj0Fkeshift,mmGnFri4Oscu61ver18;da5Dy;ali4Lo4U;!stream;abEho;aOeLiIoFumberi8;ngFuti1R;stan3RtF;erm,i4H;ghtGteraF;l,ry,te;heart0wei5O;ft JgFss9th3;al,eFi0M;nda4;nguBps0te5;apGind5noF;wi8;ut;ad0itte4uniW;ce co0Hgno6Mll0Cm04nHpso 2UrF;a2releF;va1; ZaYcoWdReQfOgrNhibi4Ri05nMoLsHtFvalu5M;aAeF;nDrdepe2K;a7iGolFuboI;ub6ve1;de,gF;nifica1;rdi5N;a2er;own;eriIiLluenVrF;ar0eq5H;pt,rt;eHiGoFul1O;or;e,reA;fiFpe26termi5E;ni2;mpFnsideCrreA;le2;ccuCdeq5Ene,ppr4J;fFsitu,vitro;ro1;mJpF;arHeGl15oFrop9;li2r11;n2LrfeA;ti3;aGeFi18;d4BnD;tuE;egGiF;c0YteC;al,iF;tiF;ma2;ld;aOelNiLoFuma7;a4meInHrrGsFur5;ti6;if4E;e58o3U; ma3GsF;ick;ghfalut2HspF;an49;li00pf33;i4llow0ndGrdFtM; 05coEworki8;sy,y;aLener44iga3Blob3oKrGuF;il1Nng ho;aFea1Fizzl0;cGtF;ef2Vis;ef2U;ld3Aod;iFuc2D;nf2R;aVeSiQlOoJrF;aGeFil5ug3;q43tf2O;gFnt3S;i6ra1;lk13oHrF; keeps,eFge0Vm9tu41;g0Ei2Ds3R;liF;sh;ag4Mowe4uF;e1or45;e4nF;al,i2;d Gmini7rF;ti6ve1;up;bl0lDmIr Fst pac0ux;oGreacF;hi8;ff;ed,ili0R;aXfVlTmQnOqu3rMthere3veryday,xF;aApIquisi2traHuF;be48lF;ta1;!va2L;edRlF;icF;it;eAstF;whi6; Famor0ough,tiE;rou2sui2;erGiF;ne1;ge1;dFe2Aoq34;er5;ficF;ie1;g9sF;t,ygF;oi8;er;aWeMiHoGrFue;ea4owY;ci6mina1ne,r31ti8ubQ;dact2Jfficult,m,sGverF;ge1se;creGePjoi1paCtF;a1inA;et,te; Nadp0WceMfiLgeneCliJmuEpeIreliAsGvoF;id,ut;pFtitu2ul1L;eCoF;nde1;ca2ghF;tf13;a1ni2;as0;facto;i5ngero0I;ar0Ce09h07i06l05oOrIuF;rmudgeon5stoma4teF;sy;ly;aIeHu1EystalF; cleFli7;ar;epy;fFv17z0;ty;erUgTloSmPnGrpoCunterclVveFy;rt;cLdJgr21jIsHtrF;aFi2;dic0Yry;eq1Yta1;oi1ug3;escenFuN;di8;a1QeFiD;it0;atoDmensuCpF;ass1SulF;so4;ni3ss3;e1niza1;ci1J;ockwiD;rcumspeAvil;eFintzy;e4wy;leGrtaF;in;ba2;diac,ef00;a00ePiLliJoGrFuck nak0;and new,isk,on22;gGldface,naF; fi05fi05;us;nd,tF;he;gGpartisFzarE;an;tiF;me;autifOhiNlLnHsFyoN;iWtselF;li8;eGiFt;gn;aFfi03;th;at0oF;v0w;nd;ul;ckwards,rF;e,rT; priori,b13c0Zd0Tf0Ng0Ihe0Hl09mp6nt06pZrTsQttracti0MuLvIwF;aGkF;wa1B;ke,re;ant garGeraF;ge;de;diIsteEtF;heFoimmu7;nt07;re;to4;hGlFtu2;eep;en;bitIchiv3roHtF;ifiFsy;ci3;ga1;ra4;ry;pFt;aHetizi8rF;oprF;ia2;llFre1;ed,i8;ng;iquFsy;at0e;ed;cohKiJkaHl,oGriFterX;ght;ne,of;li7;ne;ke,ve;olF;ic;ad;ain07gressiIi6rF;eeF;ab6;le;ve;fGraB;id;ectGlF;ue1;ioF;na2; JaIeGvF;erD;pt,qF;ua2;ma1;hoc,infinitum;cuCquiGtu3u2;al;esce1;ra2;erSjeAlPoNrKsGuF;nda1;e1olu2trF;aAuD;se;te;eaGuF;pt;st;aFve;rd;aFe;ze;ct;ra1;nt",
  "Pronoun": "true\xA6elle,h3i2me,she,th0us,we,you;e0ou;e,m,y;!l,t;e,im",
  "Preposition": "true\xA6aPbMcLdKexcept,fIinGmid,notwithstandiWoDpXqua,sCt7u4v2w0;/o,hereSith0;! whHin,oW;ersus,i0;a,s a vis;n1p0;!on;like,til;h1ill,oward0;!s;an,ereby,r0;ough0u;!oM;ans,ince,o that,uch G;f1n0ut;!to;!f;! 0to;effect,part;or,r0;om;espite,own,u3;hez,irca;ar1e0oBy;sides,tween;ri7;bo8cross,ft7lo6m4propos,round,s1t0;!op;! 0;a whole,long 0;as;id0ong0;!st;ng;er;ut",
  "SportsTeam": "true\xA60:18;1:1E;2:1D;3:14;a1Db15c0Sd0Kfc dallas,g0Ihouston 0Hindiana0Gjacksonville jagua0k0El0Am01new UoRpKqueens parkJreal salt lake,sBt6utah jazz,vancouver whitecaps,w4yW;ashington 4h10;natio1Mredski2wizar0W;ampa bay 7e6o4;ronto 4ttenham hotspur;blue ja0Mrapto0;nnessee tita2xasD;buccanee0ra0K;a8eattle 6porting kansas0Wt4; louis 4oke0V;c1Drams;marine0s4;eah13ounH;cramento Rn 4;antonio spu0diego 4francisco gJjose earthquak1;char08paB; ran07;a9h6ittsburgh 5ortland t4;imbe0rail blaze0;pirat1steele0;il4oenix su2;adelphia 4li1;eagl1philNunE;dr1;akland 4klahoma city thunder,rlando magic;athle0Lrai4;de0;england 8orleans 7york 4;g5je3knYme3red bul0Xy4;anke1;ian3;pelica2sain3;patrio3revolut4;ion;anchEeAi4ontreal impact;ami 8lwaukee b7nnesota 4;t5vi4;kings;imberwolv1wi2;rewe0uc0J;dolphi2heat,marli2;mphis grizz4ts;li1;a6eic5os angeles 4;clippe0dodFlaB;esterV; galaxy,ke0;ansas city 4nF;chiefs,roya0D; pace0polis col3;astr05dynamo,rocke3texa2;olden state warrio0reen bay pac4;ke0;allas 8e4i04od6;nver 6troit 4;lio2pisto2ti4;ge0;broncYnugge3;cowbo5maver4;icZ;ys;arEelLhAincinnati 8leveland 6ol4;orado r4umbus crew sc;api7ocki1;brow2cavalie0guar4in4;dia2;bengaVre4;ds;arlotte horAicago 4;b5cubs,fire,wh4;iteB;ea0ulQ;diff4olina panthe0; city;altimore Alackburn rove0oston 6rooklyn 4uffalo bilN;ne3;ts;cel5red4; sox;tics;rs;oriol1rave2;rizona Ast8tlanta 4;brav1falco2h4;awA;ns;es;on villa,r4;os;c6di4;amondbac4;ks;ardi4;na4;ls",
  "Unit": "true\xA6a07b04cXdWexVfTgRhePinYjoule0BkMlJmDnan08oCp9quart0Bsq ft,t7volts,w6y2ze3\xB01\xB50;g,s;c,f,n;dVear1o0;ttR; 0s 0;old;att,b;erNon0;!ne02;ascals,e1i0;cXnt00;rcent,tJ;hms,unceY;/s,e4i0m\xB2,\xB2,\xB3;/h,cro2l0;e0liK;!\xB2;grLsR;gCtJ;it1u0;menQx;erPreP;b5elvins,ilo1m0notO;/h,ph,\xB2;!byGgrEmCs;ct0rtzL;aJogrC;allonJb0ig3rB;ps;a0emtEl oz,t4;hrenheit,radG;aby9;eci3m1;aratDe1m0oulombD;\xB2,\xB3;lsius,nti0;gr2lit1m0;et0;er8;am7;b1y0;te5;l,ps;c2tt0;os0;econd1;re0;!s",
  "Noun|Gerund": "true\xA60:3O;1:3M;2:3N;3:3D;4:32;5:2V;6:3E;7:3K;8:36;9:3J;A:3B;a3Pb37c2Jd27e23f1Vg1Sh1Mi1Ij1Gk1Dl18m13n11o0Wp0Pques0Sr0EsTtNunderMvKwFyDzB;eroi0oB;ni0o3P;aw2eB;ar2l3;aEed4hispe5i5oCrB;ap8est3i1;n0ErB;ki0r31;i1r2s9tc9;isualizi0oB;lunt1Vti0;stan4ta6;aFeDhin6iCraBy8;c6di0i2vel1M;mi0p8;aBs1;c9si0;l6n2s1;aUcReQhOiMkatKl2Wmo6nowJpeItFuCwB;ea5im37;b35f0FrB;fi0vB;e2Mi2J;aAoryt1KrCuB;d2KfS;etc9ugg3;l3n4;bCi0;ebBi0;oar4;gnBnAt1;a3i0;ip8oB;p8rte2u1;a1r27t1;hCo5reBulp1;a2Qe2;edu3oo3;i3yi0;aKeEi4oCuB;li0n2;oBwi0;fi0;aFcEhear7laxi0nDpor1sB;pon4tructB;r2Iu5;de5;or4yc3;di0so2;p8ti0;aFeacek20laEoCrBublis9;a1Teten4in1oces7;iso2siB;tio2;n2yi0;ckaAin1rB;ki0t1O;fEpeDrganiCvB;erco24ula1;si0zi0;ni0ra1;fe5;avi0QeBur7;gotia1twor6;aDeCi2oB;de3nito5;a2dita1e1ssaA;int0XnBrke1;ifUufactu5;aEeaDiBodAyi0;cen7f1mi1stB;e2i0;r2si0;n4ug9;iCnB;ea4it1;c6l3;ogAuB;dAgg3stif12;ci0llust0VmDnBro2;nova1sp0NterBven1;ac1vie02;agi2plo4;aDea1iCoBun1;l4w3;ki0ri0;nd3rB;roWvB;es1;aCene0Lli4rBui4;ee1ie0N;rde2the5;aHeGiDlCorBros1un4;e0Pmat1;ir1oo4;gh1lCnBs9;anZdi0;i0li0;e3nX;r0Zscina1;a1du01nCxB;erci7plo5;chan1di0ginB;ee5;aLeHiGoub1rCum8wB;el3;aDeCiB;bb3n6vi0;a0Qs7;wi0;rTscoDvi0;ba1coZlBvelo8;eCiB;ve5;ga1;nGti0;aVelebUhSlPoDrBur3yc3;aBos7yi0;f1w3;aLdi0lJmFnBo6pi0ve5;dDsCvinB;ci0;trBul1;uc1;muniDpB;lBo7;ai2;ca1;lBo5;ec1;c9ti0;ap8eaCimToBubT;ni0t9;ni0ri0;aBee5;n1t1;ra1;m8rCs1te5;ri0;vi0;aPeNitMlLoGrDuB;dge1il4llBr8;yi0;an4eat9oadB;cas1;di0;a1mEokB;i0kB;ee8;pi0;bi0;es7oa1;c9i0;gin2lonAt1;gi0;bysit1c6ki0tt3;li0;ki0;bando2cGdverti7gi0pproac9rgDssuCtB;trac1;mi0;ui0;hi0;si0;coun1ti0;ti0;ni0;ng",
  "PhrasalVerb": "true\xA60:92;1:96;2:8H;3:8V;4:8A;5:83;6:85;7:98;8:90;9:8G;A:8X;B:8R;C:8U;D:8S;E:70;F:97;G:8Y;H:81;I:7H;J:79;a9Fb7Uc6Rd6Le6Jf5Ig50h4Biron0j47k40l3Em31n2Yo2Wp2Cquiet Hr1Xs0KtZuXvacuu6QwNyammerBzK;ero Dip LonK;e0k0;by,ov9up;aQeMhLiKor0Mrit19;mp0n3Fpe0r5s5;ackAeel Di0S;aLiKn33;gh 3Wrd0;n Dr K;do1in,oJ;it 79k5lk Lrm 69sh Kt83v60;aw3do1o7up;aw3in,oC;rgeBsK;e 2herE;a00eYhViRoQrMuKypP;ckErn K;do1in,oJup;aLiKot0y 30;ckl7Zp F;ck HdK;e 5Y;n7Wp 3Es5K;ck MdLe Kghten 6me0p o0Rre0;aw3ba4do1in,up;e Iy 2;by,oG;ink Lrow K;aw3ba4in,up;ba4ov9up;aKe 77ll62;m 2r 5M;ckBke Llk K;ov9shit,u47;aKba4do1in,leave,o4Dup;ba4ft9pa69w3;a0Vc0Te0Mh0Ii0Fl09m08n07o06p01quar5GtQuOwK;earMiK;ngLtch K;aw3ba4o8K; by;cKi6Bm 2ss0;k 64;aReQiPoNrKud35;aigh2Det75iK;ke 7Sng K;al6Yup;p Krm2F;by,in,oG;c3Ln3Lr 2tc4O;p F;c3Jmp0nd LrKveAy 2O;e Ht 2L;ba4do1up;ar3GeNiMlLrKurB;ead0ingBuc5;a49it 6H;c5ll o3Cn 2;ak Fe1Xll0;a3Bber 2rt0und like;ap 5Vow Duggl5;ash 6Noke0;eep NiKow 6;cLp K;o6Dup;e 68;in,oK;ff,v9;de19gn 4NnKt 6Gz5;gKkE; al6Ale0;aMoKu5W;ot Kut0w 7M;aw3ba4f48oC;c2WdeEk6EveA;e Pll1Nnd Orv5tK; Ktl5J;do1foLin,o7upK;!on;ot,r5Z;aw3ba4do1in,o33up;oCto;al66out0rK;ap65ew 6J;ilAv5;aXeUiSoOuK;b 5Yle0n Kstl5;aLba4do1inKo2Ith4Nu5P;!to;c2Xr8w3;ll Mot LpeAuK;g3Ind17;a2Wf3Po7;ar8in,o7up;ng 68p oKs5;ff,p18;aKelAinEnt0;c6Hd K;o4Dup;c27t0;aZeYiWlToQrOsyc35uK;ll Mn5Kt K;aKba4do1in,oJto47up;pa4Dw3;a3Jdo1in,o21to45up;attleBess KiNop 2;ah2Fon;iLp Kr4Zu1Gwer 6N;do1in,o6Nup;nt0;aLuK;gEmp 6;ce u20y 6D;ck Kg0le 4An 6p5B;oJup;el 5NncilE;c53ir 39n0ss MtLy K;ba4oG; Hc2R;aw3ba4in,oJ;pKw4Y;e4Xt D;aLerd0oK;dAt53;il Hrrow H;aTeQiPoLuK;ddl5ll I;c1FnkeyMp 6uthAve K;aKdo1in,o4Lup;l4Nw3; wi4K;ss0x 2;asur5e3SlLss K;a21up;t 6;ke Ln 6rKs2Ax0;k 6ryA;do,fun,oCsure,up;a02eViQoLuK;ck0st I;aNc4Fg MoKse0;k Kse4D;aft9ba4do1forw37in56o0Zu46;in,oJ;d 6;e NghtMnLsKve 00;ten F;e 2k 2; 2e46;ar8do1in;aMt LvelK; oC;do1go,in,o7up;nEve K;in,oK;pKut;en;c5p 2sh LtchBughAy K;do1o59;in4Po7;eMick Lnock K;do1oCup;oCup;eLy K;in,up;l Ip K;aw3ba4do1f04in,oJto,up;aMoLuK;ic5mpE;ke3St H;c43zz 2;a01eWiToPuK;nLrrKsh 6;y 2;keLt K;ar8do1;r H;lKneErse3K;d Ke 2;ba4dKfast,o0Cup;ear,o1;de Lt K;ba4on,up;aw3o7;aKlp0;d Ml Ir Kt 2;fKof;rom;f11in,o03uW;cPm 2nLsh0ve Kz2P;at,it,to;d Lg KkerP;do1in,o2Tup;do1in,oK;ut,v9;k 2;aZeTive Rloss IoMrLunK; f0S;ab hold,in43ow 2U; Kof 2I;aMb1Mit,oLr8th1IuK;nd9;ff,n,v9;bo7ft9hQw3;aw3bKdo1in,oJrise,up,w3;a4ir2H;ar 6ek0t K;aLb1Fdo1in,oKr8up;ff,n,ut,v9;cLhKl2Fr8t,w3;ead;ross;d aKng 2;bo7;a0Ee07iYlUoQrMuK;ck Ke2N;ar8up;eLighten KownBy 2;aw3oG;eKshe27; 2z5;g 2lMol Krk I;aKwi20;bo7r8;d 6low 2;aLeKip0;sh0;g 6ke0mKrKtten H;e F;gRlPnNrLsKzzle0;h F;e Km 2;aw3ba4up;d0isK;h 2;e Kl 1T;aw3fPin,o7;ht ba4ure0;ePnLsK;s 2;cMd K;fKoG;or;e D;d04l 2;cNll Krm0t1G;aLbKdo1in,o09sho0Eth08victim;a4ehi2O;pa0C;e K;do1oGup;at Kdge0nd 12y5;in,o7up;aOi1HoNrK;aLess 6op KuN;aw3b03in,oC;gBwB; Ile0ubl1B;m 2;a0Ah05l02oOrLut K;aw3ba4do1oCup;ackBeep LoKy0;ss Dwd0;by,do1in,o0Uup;me NoLuntK; o2A;k 6l K;do1oG;aRbQforOin,oNtKu0O;hLoKrue;geth9;rough;ff,ut,v9;th,wK;ard;a4y;paKr8w3;rt;eaLose K;in,oCup;n 6r F;aNeLiK;ll0pE;ck Der Kw F;on,up;t 2;lRncel0rOsMtch LveE; in;o1Nup;h Dt K;doubt,oG;ry LvK;e 08;aw3oJ;l Km H;aLba4do1oJup;ff,n,ut;r8w3;a0Ve0MiteAl0Fo04rQuK;bblNckl05il0Dlk 6ndl05rLsKtMy FzzA;t 00;n 0HsK;t D;e I;ov9;anWeaUiLush K;oGup;ghQng K;aNba4do1forMin,oLuK;nd9p;n,ut;th;bo7lKr8w3;ong;teK;n 2;k K;do1in,o7up;ch0;arTg 6iRn5oPrNssMttlLunce Kx D;aw3ba4;e 6; ar8;e H;do1;k Dt 2;e 2;l 6;do1up;d 2;aPeed0oKurt0;cMw K;aw3ba4do1o7up;ck;k K;in,oC;ck0nk0stA; oQaNef 2lt0nd K;do1ov9up;er;up;r Lt K;do1in,oCup;do1o7;ff,nK;to;ck Pil0nMrgLsK;h D;ainBe D;g DkB; on;in,o7;aw3do1in,oCup;ff,ut;ay;ct FdQir0sk MuctionA; oG;ff;ar8o7;ouK;nd; o7;d K;do1oKup;ff,n;wn;o7up;ut",
  "ProperNoun": "true\xA6aIbDc8dalhousHe7f5gosford,h4iron maiden,kirby,landsdowne,m2nis,r1s0wembF;herwood,paldiB;iel,othwe1;cgi0ercedes,issy;ll;intBudsB;airview,lorence,ra0;mpt9nco;lmo,uro;a1h0;arlt6es5risti;rl0talina;et4i0;ng;arb3e0;et1nt0rke0;ley;on;ie;bid,jax",
  "Person|Place": "true\xA6a8d6h4jordan,k3orlando,s1vi0;ctor9rgin9;a0ydney;lvador,mara,ntia4;ent,obe;amil0ous0;ton;arw2ie0;go;lexandr1ust0;in;ia",
  "LastName": "true\xA60:BR;1:BF;2:B5;3:BH;4:AX;5:9Y;6:B6;7:BK;8:B0;9:AV;A:AL;B:8Q;C:8G;D:7K;E:BM;F:AH;aBDb9Zc8Wd88e81f7Kg6Wh64i60j5Lk4Vl4Dm39n2Wo2Op25quispe,r1Ls0Pt0Ev03wTxSyKzG;aIhGimmerm6A;aGou,u;ng,o;khar5ytsE;aKeun9BiHoGun;koya32shiBU;!lG;diGmaz;rim,z;maGng;da,g52mo83sGzaC;aChiBV;iao,u;aLeJiHoGright,u;jcA5lff,ng;lGmm0nkl0sniewsC;kiB1liams33s3;bGiss,lt0;b,er,st0;a6Vgn0lHtG;anabe,s3;k0sh,tG;e2Non;aLeKiHoGukD;gt,lk5roby5;dHllalGnogr3Kr1Css0val3S;ba,ob1W;al,ov4;lasHsel8W;lJn dIrgBEsHzG;qu7;ilyEqu7siljE;en b6Aijk,yk;enzueAIverde;aPeix1VhKi2j8ka43oJrIsui,uG;om5UrG;c2n0un1;an,emblA7ynisC;dorAMlst3Km4rrAth;atch0i8UoG;mHrG;are84laci79;ps3sG;en,on;hirDkah9Mnaka,te,varA;a06ch01eYhUiRmOoMtIuHvGzabo;en9Jobod3N;ar7bot4lliv2zuC;aIeHoG;i7Bj4AyanAB;ele,in2FpheBvens25;l8rm0;kol5lovy5re7Tsa,to,uG;ng,sa;iGy72;rn5tG;!h;l71mHnGrbu;at9cla9Egh;moBo7M;aIeGimizu;hu,vchG;en8Luk;la,r1G;gu9infe5YmGoh,pulveA7rra5P;jGyG;on5;evi6iltz,miHneid0roed0uGwarz;be3Elz;dHtG;!t,z;!t;ar4Th8ito,ka4OlJnGr4saCto,unde19v4;ch7dHtGz;a5Le,os;b53e16;as,ihDm4Po0Y;aVeSiPoJuHyG;a6oo,u;bio,iz,sG;so,u;bKc8Fdrigue67ge10j9YmJosevelt,sItHux,wG;e,li6;a9Ch;enb4Usi;a54e4L;erts15i93;bei4JcHes,vGzzo;as,e9;ci,hards12;ag2es,iHut0yG;es,nol5N;s,t0;dImHnGsmu97v6C;tan1;ir7os;ic,u;aUeOhMiJoHrGut8;asad,if6Zochazk27;lishc2GpGrti72u10we76;e3Aov51;cHe45nG;as,to;as70hl0;aGillips;k,m,n6I;a3Hde3Wete0Bna,rJtG;ersHrovGters54;!a,ic;!en,on;eGic,kiBss3;i9ra,tz,z;h86k,padopoulIrk0tHvG;ic,l4N;el,te39;os;bMconn2Ag2TlJnei6PrHsbor6XweBzG;dem7Rturk;ella4DtGwe6N;ega,iz;iGof7Hs8I;vGyn1R;ei9;aSri1;aPeNiJoGune50ym2;rHvGwak;ak4Qik5otn66;odahl,r4S;cholsZeHkolGls4Jx3;ic,ov84;ls1miG;!n1;ils3mG;co4Xec;gy,kaGray2sh,var38;jiGmu9shiG;ma;a07c04eZiWoMuHyeG;rs;lJnIrGssoli6S;atGp03r7C;i,ov4;oz,te58;d0l0;h2lOnNo0RrHsGza1A;er,s;aKeJiIoz5risHtG;e56on;!on;!n7K;au,i9no,t5J;!lA;r1Btgome59;i3El0;cracFhhail5kkeHlG;l0os64;ls1;hmeJiIj30lHn3Krci0ssiGyer2N;!er;n0Po;er,j0;dDti;cartHlG;aughl8e2;hy;dQe7Egnu68i0jer3TkPmNnMrItHyG;er,r;ei,ic,su21thews;iHkDquAroqu8tinG;ez,s;a5Xc,nG;!o;ci5Vn;a5UmG;ad5;ar5e6Kin1;rig77s1;aVeOiLoJuHyG;!nch;k4nGo;d,gu;mbarGpe3Fvr4we;di;!nGu,yana2B;coln,dG;b21holm,strom;bedEfeKhIitn0kaHn8rGw35;oy;!j;m11tG;in1on1;bvGvG;re;iGmmy,ng,rs2Qu,voie,ws3;ne,t1F;aZeYh2iWlUnez50oNrJuHvar2woG;k,n;cerGmar68znets5;a,o34;aHem0isGyeziu;h23t3O;m0sni4Fus3KvG;ch4O;bay57ch,rh0Usk16vaIwalGzl5;czGsC;yk;cIlG;!cGen4K;huk;!ev4ic,s;e8uiveG;rt;eff0kGl4mu9nnun1;ucF;ll0nnedy;hn,llKminsCne,pIrHstra3Qto,ur,yGzl5;a,s0;j0Rls22;l2oG;or;oe;aPenOha6im14oHuG;ng,r4;e32hInHrge32u6vG;anD;es,ss3;anHnsG;en,on,t3;nesGs1R;en,s1;kiBnings,s1;cJkob4EnGrv0E;kDsG;en,sG;en0Ion;ks3obs2A;brahimDglesi5Nke5Fl0Qno07oneIshikHto,vanoG;u,v54;awa;scu;aVeOiNjaltal8oIrist50uG;!aGb0ghAynh;m2ng;a6dz4fIjgaa3Hk,lHpUrGwe,x3X;ak1Gvat;mAt;er,fm3WmG;ann;ggiBtchcock;iJmingw4BnHrGss;nand7re9;deGriks1;rs3;kkiHnG;on1;la,n1;dz4g1lvoQmOns0ZqNrMsJuIwHyG;asFes;kiB;g1ng;anHhiG;mo14;i,ov0J;di6p0r10t;ue;alaG;in1;rs1;aVeorgUheorghe,iSjonRoLrJuGw3;errGnnar3Co,staf3Ctierr7zm2;a,eG;ro;ayli6ee2Lg4iffithGub0;!s;lIme0UnHodGrbachE;e,m2;calvAzale0S;dGubE;bGs0E;erg;aj,i;bs3l,mGordaO;en7;iev3U;gnMlJmaIndFo,rGsFuthi0;cGdn0za;ia;ge;eaHlG;agh0i,o;no;e,on;aVerQiLjeldsted,lKoIrHuG;chs,entAji41ll0;eem2iedm2;ntaGrt8urni0wl0;na;emi6orA;lipIsHtzgeraG;ld;ch0h0;ovG;!ic;hatDnanIrG;arGei9;a,i;deY;ov4;b0rre1D;dKinsJriksIsGvaB;cob3GpGtra3D;inoza,osiQ;en,s3;te8;er,is3warG;ds;aXePiNjurhuMoKrisco15uHvorakG;!oT;arte,boHmitru,nn,rGt3C;and,ic;is;g2he0Omingu7nErd1ItG;to;us;aGcki2Hmitr2Ossanayake,x3;s,z; JbnaIlHmirGrvisFvi,w2;!ov4;gado,ic;th;bo0groot,jo6lHsilGvriA;va;a cruz,e3uG;ca;hl,mcevsCnIt2WviG;dGes,s;ov,s3;ielsGku22;!en;ki;a0Be06hRiobQlarkPoIrGunningh1H;awfo0RivGuz;elli;h1lKntJoIrGs2Nx;byn,reG;a,ia;ke,p0;i,rer2K;em2liB;ns;!e;anu;aOeMiu,oIristGu6we;eGiaG;ns1;i,ng,p9uHwGy;!dH;dGng;huJ;!n,onGu6;!g;kJnIpm2ttHudhGv7;ry;erjee,o14;!d,g;ma,raboG;rty;bJl0Cng4rG;eghetHnG;a,y;ti;an,ota1C;cerAlder3mpbeLrIstGvadi0B;iGro;llo;doHl0Er,t0uGvalho;so;so,zo;ll;a0Fe01hYiXlUoNrKuIyG;rLtyG;qi;chan2rG;ke,ns;ank5iem,oGyant;oks,wG;ne;gdan5nIruya,su,uchaHyKziG;c,n5;rd;darGik;enG;ko;ov;aGond15;nco,zG;ev4;ancFshw16;a08oGuiy2;umGwmG;ik;ckRethov1gu,ktPnNrG;gJisInG;ascoGds1;ni;ha;er,mG;anG;!n;gtGit7nP;ss3;asF;hi;er,hG;am;b4ch,ez,hRiley,kk0ldw8nMrIshHtAu0;es;ir;bInHtlGua;ett;es,i0;ieYosa;dGik;a9yoG;padhyG;ay;ra;k,ng;ic;bb0Acos09d07g04kht05lZnPrLsl2tJyG;aHd8;in;la;chis3kiG;ns3;aImstro6sl2;an;ng;ujo,ya;dJgelHsaG;ri;ovG;!a;ersJov,reG;aGjEws;ss1;en;en,on,s3;on;eksejEiyEmeiIvG;ar7es;ez;da;ev;arwHuilG;ar;al;ams,l0;er;ta;as",
  "Ordinal": "true\xA6eBf7nin5s3t0zeroE;enDhir1we0;lfCn7;d,t3;e0ixt8;cond,vent7;et0th;e6ie7;i2o0;r0urt3;tie4;ft1rst;ight0lev1;e0h,ie1;en0;th",
  "Cardinal": "true\xA6bEeBf5mEnine7one,s4t0zero;en,h2rDw0;e0o;lve,n5;irt6ousands,ree;even2ix2;i3o0;r1ur0;!t2;ty;ft0ve;e2y;ight0lev1;!e0y;en;illions",
  "Multiple": "true\xA6b3hundred,m3qu2se1t0;housand,r2;pt1xt1;adr0int0;illion",
  "City": "true\xA60:74;1:61;2:6G;3:6J;4:5S;a68b53c4Id48e44f3Wg3Hh39i31j2Wk2Fl23m1Mn1Co19p0Wq0Ur0Os05tRuQvLwDxiBy9z5;a7h5i4Muri4O;a5e5ongsh0;ng3H;greb,nzib5G;ang2e5okoha3Sunfu;katerin3Hrev0;a5n0Q;m5Hn;arsBeAi6roclBu5;h0xi,zh5P;c7n5;d5nipeg,terth4;hoek,s1L;hi5Zkl3A;l63xford;aw;a8e6i5ladivost5Molgogr6L;en3lni6S;ni22r5;o3saill4N;lenc4Wncouv3Sr3ughn;lan bat1Crumqi,trecht;aFbilisi,eEheDiBo9r7u5;l21n63r5;in,ku;i5ondh62;es51poli;kyo,m2Zron1Pulo5;n,uS;an5jua3l2Tmisoa6Bra3;j4Tshui; hag62ssaloni2H;gucigal26hr0l av1U;briz,i6llinn,mpe56ng5rtu,shk2R;i3Esh0;an,chu1n0p2Eyu0;aEeDh8kopje,owe1Gt7u5;ra5zh4X;ba0Ht;aten is55ockholm,rasbou67uttga2V;an8e6i5;jiazhua1llo1m5Xy0;f50n5;ya1zh4H;gh3Kt4Q;att45o1Vv44;cramen16int ClBn5o paulo,ppo3Rrajevo; 7aa,t5;a 5o domin3E;a3fe,m1M;antonio,die3Cfrancisco,j5ped3Nsalvad0J;o5u0;se;em,t lake ci5Fz25;lou58peters24;a9e8i6o5;me,t59;ga,o5yadh;! de janei3F;cife,ims,nn3Jykjavik;b4Sip4lei2Inc2Pwalpindi;ingdao,u5;ez2i0Q;aFeEhDiCo9r7u6yong5;ya1;eb59ya1;a5etor3M;g52to;rt5zn0; 5la4Co;au prin0Melizabe24sa03;ls3Prae5Atts26;iladelph3Gnom pe1Aoenix;ki1tah tik3E;dua,lerYnaji,r4Ot5;na,r32;ak44des0Km1Mr6s5ttawa;a3Vlo;an,d06;a7ew5ing2Fovosibir1Jyc; 5cast36;del24orlea44taip14;g8iro4Wn5pl2Wshv33v0;ch6ji1t5;es,o1;a1o1;a6o5p4;ya;no,sa0W;aEeCi9o6u5;mb2Ani26sc3Y;gadishu,nt6s5;c13ul;evideo,pelli1Rre2Z;ami,l6n14s5;kolc,sissauga;an,waukee;cca,d5lbour2Mmph41ndo1Cssi3;an,ell2Xi3;cau,drAkass2Sl9n8r5shh4A;aca6ib5rakesh,se2L;or;i1Sy;a4EchFdal0Zi47;mo;id;aDeAi8o6u5vSy2;anMckn0Odhia3;n5s angel26;d2g bea1N;brev2Be3Lma5nz,sb2verpo28;!ss27; ma39i5;c5pzig;est16; p6g5ho2Wn0Cusan24;os;az,la33;aHharFiClaipeBo9rak0Du7y5;iv,o5;to;ala lump4n5;mi1sh0;hi0Hlka2Xpavog4si5wlo2;ce;da;ev,n5rkuk;gst2sha5;sa;k5toum;iv;bHdu3llakuric0Qmpa3Fn6ohsiu1ra5un1Iwaguc0Q;c0Pj;d5o,p4;ah1Ty;a7e6i5ohannesV;l1Vn0;dd36rusalem;ip4k5;ar2H;bad0mph1OnArkutUs7taXz5;mir,tapala5;pa;fah0l6tanb5;ul;am2Zi2H;che2d5;ianap2Mo20;aAe7o5yder2W; chi mi5ms,nolulu;nh;f6lsin5rakli2;ki;ei;ifa,lifax,mCn5rb1Dva3;g8nov01oi;aFdanEenDhCiPlasgBo9raz,u5;a5jr23;dal6ng5yaquil;zh1J;aja2Oupe;ld coa1Bthen5;bu2S;ow;ent;e0Uoa;sk;lw7n5za;dhi5gt1E;nag0U;ay;aisal29es,o8r6ukuya5;ma;ankfu5esno;rt;rt5sh0; wor6ale5;za;th;d5indhov0Pl paso;in5mont2;bur5;gh;aBe8ha0Xisp4o7resd0Lu5;b5esseldorf,nkirk,rb0shanbe;ai,l0I;ha,nggu0rtmu13;hradSl6nv5troit;er;hi;donghIe6k09l5masc1Zr es sala1KugavpiY;i0lU;gu,je2;aJebu,hAleve0Vo5raio02uriti1Q;lo7n6penhag0Ar5;do1Ok;akKst0V;gUm5;bo;aBen8i6ongqi1ristchur5;ch;ang m7ca5ttago1;go;g6n5;ai;du,zho1;ng5ttogr14;ch8sha,zh07;gliari,i9lga8mayenJn6pe town,r5tanO;acCdiff;ber1Ac5;un;ry;ro;aWeNhKirmingh0WoJr9u5;chareTdapeTenos air7r5s0tu0;g5sa;as;es;a9is6usse5;ls;ba6t5;ol;ne;sil8tisla7zzav5;il5;le;va;ia;goZst2;op6ubaneshw5;ar;al;iCl9ng8r5;g6l5n;in;en;aluru,hazi;fa6grade,o horizon5;te;st;ji1rut;ghd0BkFn9ot8r7s6yan n4;ur;el,r07;celo3i,ranquil09;ou;du1g6ja lu5;ka;alo6k5;ok;re;ng;ers5u;field;a05b02cc01ddis aba00gartaZhmedXizawl,lSmPnHqa00rEsBt7uck5;la5;nd;he7l5;an5;ta;ns;h5unci2;dod,gab5;at;li5;ngt2;on;a8c5kaOtwerp;hora6o3;na;ge;h7p5;ol5;is;eim;aravati,m0s5;terd5;am; 7buquerq6eppo,giers,ma5;ty;ue;basrah al qadim5mawsil al jadid5;ah;ab5;ad;la;ba;ra;idj0u dha5;bi;an;lbo6rh5;us;rg",
  "Region": "true\xA60:2O;1:2L;2:2U;3:2F;a2Sb2Fc21d1Wes1Vf1Tg1Oh1Ki1Fj1Bk16l13m0Sn09o07pYqVrSsJtEuBverAw6y4zacatec2W;akut0o0Fu4;cat1k09;a5est 4isconsin,yomi1O;bengal,virgin0;rwick3shington4;! dc;acruz,mont;dmurt0t4;ah,tar4; 2Pa12;a6e5laxca1Vripu21u4;scaEva;langa2nnessee,x2J;bas10m4smQtar29;aulip2Hil nadu;a9elang07i7o5taf16u4ylh1J;ff02rr09s1E;me1Gno1Uuth 4;cZdY;ber0c4kkim,naloa;hu1ily;n5rawak,skatchew1xo4;ny; luis potosi,ta catari2;a4hodeA;j4ngp0C;asth1shahi;ingh29u4;e4intana roo;bec,en6retaro;aAe6rince edward4unjab; i4;sl0G;i,n5r4;ak,nambu0F;a0Rnsylv4;an0;ha0Pra4;!na;axa0Zdisha,h4klaho21ntar4reg7ss0Dx0I;io;aLeEo6u4;evo le4nav0X;on;r4tt18va scot0;f9mandy,th4; 4ampton3;c6d5yo4;rk3;ako1O;aroli2;olk;bras1Nva0Dw4; 6foundland4;! and labrad4;or;brunswick,hamp3jers5mexiTyork4;! state;ey;galPyarit;aAeghala0Mi6o4;nta2r4;dov0elos;ch6dlanDn5ss4zor11;issippi,ouri;as geraPneso18;ig1oac1;dhy12harasht0Gine,lac07ni5r4ssachusetts;anhao,i el,ylG;p4toba;ur;anca3e4incoln3ouisI;e4iR;ds;a6e5h4omi;aka06ul2;dah,lant1ntucky,ra01;bardino,lmyk0ns0Qr4;achay,el0nata0X;alis6har4iangxi;kh4;and;co;daho,llino7n4owa;d5gush4;et0;ia2;is;a6ert5i4un1;dalFm0D;ford3;mp3rya2waii;ansu,eorg0lou7oa,u4;an4izhou,jarat;ajuato,gdo4;ng;cester3;lori4uji1;da;sex;ageUe7o5uran4;go;rs4;et;lawaMrby3;aFeaEh9o4rim08umbr0;ahui7l6nnectic5rsi4ventry;ca;ut;i03orado;la;e5hattisgarh,i4uvash0;apRhuahua;chn5rke4;ss0;ya;ra;lGm4;bridge3peche;a9ihar,r8u4;ck4ryat0;ingham3;shi4;re;emen,itish columb0;h0ja cal8lk7s4v7;hkorto4que;st1;an;ar0;iforn0;ia;dygHguascalientes,lBndhr9r5ss4;am;izo2kans5un4;achal 7;as;na;a 4;pradesh;a6ber5t4;ai;ta;ba5s4;ka;ma;ea",
  "Place": "true\xA60:4T;1:4V;2:44;3:4B;4:3I;a4Eb3Gc2Td2Ge26f25g1Vh1Ji1Fk1Cl14m0Vn0No0Jp08r04sTtNuLvJw7y5;a5o0Syz;kut1Bngtze;aDeChitBi9o5upatki,ycom2P;ki26o5;d5l1B;b3Ps5;i4to3Y;c0SllowbroCn5;c2Qgh2;by,chur1P;ed0ntw3Gs22;ke6r3St5;erf1f1; is0Gf3V;auxha3Mirgin is0Jost5;ok;laanbaatar,pto5xb3E;n,wn;a9eotihuac43h7ive49o6ru2Nsarskoe selo,u5;l2Dzigo47;nto,rquay,tt2J;am3e 5orn3E;bronx,hamptons;hiti,j mah0Iu1N;aEcotts bluff,eCfo,herbroQoApring9t7u5yd2F;dbu1Wn5;der03set3B;aff1ock2Nr5;atf1oud;hi37w24;ho,uth5; 1Iam1Zwo3E;a5i2O;f2Tt0;int lawrence riv3Pkhal2D;ayleigh,ed7i5oc1Z;chmo1Eo gran4ver5;be1Dfr09si4; s39cliffe,hi2Y;aCe9h8i5ompeii,utn2;c6ne5tcai2T; 2Pc0G;keri13t0;l,x;k,lh2mbr6n5r2J;n1Hzance;oke;cif38pahanaumokuak30r5;k5then0;si4w1K;ak7r6x5;f1l2X;ange county,d,f1inoco;mTw1G;e8i1Uo5;r5tt2N;th5wi0E; 0Sam19;uschwanste1Pw5; eng6a5h2market,po36;rk;la0P;a8co,e6i5uc;dt1Yll0Z;adow5ko0H;lands;chu picchu,gad2Ridsto1Ql8n7ple6r5;kh2; g1Cw11;hatt2Osf2B;ibu,t0ve1Z;a8e7gw,hr,in5owlOynd02;coln memori5dl2C;al;asi4w3;kefr7mbe1On5s,x;ca2Ig5si05;f1l27t0;ont;azan kreml14e6itchen2Gosrae,rasnoyar5ul;sk;ns0Hs1U;ax,cn,lf1n6ps5st;wiN;d5glew0Lverness;ian27ochina;aDeBi6kg,nd,ov5unti2H;d,enweep;gh6llc5;reL;bu03l5;and5;!s;r5yw0C;ef1tf1;libu24mp6r5stings;f1lem,row;stead,t0;aDodavari,r5uelph;avenAe5imsS;at 8en5; 6f1Fwi5;ch;acr3vall1H;brita0Flak3;hur5;st;ng3y villa0W;airhavHco,ra;aAgli9nf17ppi8u7ver6x5;et1Lf1;glad3t0;rope,st0;ng;nt0;rls1Ls5;t 5;e5si4;nd;aCe9fw,ig8o7ryd6u5xb;mfri3nstab00rh2tt0;en;nca18rcKv19wnt0B;by;n6r5vonpo1D;ry;!h2;nu8r5;l6t5;f1moor;ingt0;be;aLdg,eIgk,hClBo5royd0;l6m5rnwa0B;pt0;c7lingw6osse5;um;ood;he0S;earwat0St;a8el6i5uuk;chen itza,mney ro07natSricahua;m0Zt5;enh2;mor5rlottetPth2;ro;dar 5ntervilA;breaks,faZg5;rove;ld9m8r5versh2;lis6rizo pla5;in;le;bLpbellf1;weQ;aZcn,eNingl01kk,lackLolt0r5uckV;aGiAo5;ckt0ok5wns cany0;lyn,s5;i4to5;ne;de;dge6gh5;am,t0;n6t5;own;or5;th;ceb6m5;lNpt0;rid5;ge;bu5pool,wa8;rn;aconsfEdf1lBr9verly7x5;hi5;ll; hi5;lls;wi5;ck; air,l5;ingh2;am;ie5;ld;ltimore,rnsl6tters5;ea;ey;bLct0driadic,frica,ginJlGmFn9rc8s7tl6yleOzor3;es;!ant8;hcroft,ia; de triomphe,t6;adyr,ca8dov9tarct5;ic5; oce5;an;st5;er;ericas,s;be6dersh5hambra,list0;ot;rt0;cou5;rt;bot7i5;ngd0;on;sf1;ord",
  "Country": "true\xA60:38;1:2L;2:3B;a2Xb2Ec22d1Ye1Sf1Mg1Ch1Ai14j12k0Zl0Um0Gn05om2pZqat1KrXsKtCu7v5wal4yemTz3;a25imbabwe;es,lis and futu2Y;a3enezue32ietnam;nuatu,tican city;gTk6nited 4ruXs3zbeE; 2Ca,sr;arab emirat0Kkingdom,states3;! of am2Y;!raiV;a8haCimor les0Co7rinidad 5u3;nis0rk3valu;ey,me2Zs and caic1V;and t3t3;oba1L;go,kel10nga;iw2ji3nz2T;ki2V;aDcotl1eCi9lov8o6pa2Dri lanka,u5w3yr0;az3edAitzerl1;il1;d2riname;lomon1Xmal0uth 3;afr2KkMsud2;ak0en0;erra leoFn3;gapo1Yt maart3;en;negLrb0ychellZ;int 3moa,n marino,udi arab0;hele26luc0mart21;epublic of ir0Eom2Euss0w3;an27;a4eIhilippinUitcairn1Mo3uerto riN;l1rtugF;ki2Dl4nama,pua new0Vra3;gu7;au,esti3;ne;aBe9i7or3;folk1Ith4w3;ay; k3ern mariana1D;or0O;caragua,ger3ue;!ia;p3ther1Aw zeal1;al;mib0u3;ru;a7exi6icro0Bo3yanm06;ldova,n3roc5zambA;a4gol0t3;enegro,serrat;co;cAdagasc01l7r5urit4yot3;te;an0i16;shall0Xtin3;ique;a4div3i,ta;es;wi,ys0;ao,ed02;a6e5i3uxembourg;b3echtenste12thu1G;er0ya;ban0Isotho;os,tv0;azakh1Fe4iriba04o3uwait,yrgyz1F;rXsovo;eling0Knya;a3erG;ma16p2;c7nd6r4s3taly,vory coast;le of m2rael;a3el1;n,q;ia,oJ;el1;aiTon3ungary;dur0Ng kong;aBermany,ha0QibraltAre8u3;a6ern5inea3ya0P;! biss3;au;sey;deloupe,m,tema0Q;e3na0N;ce,nl1;ar;bUmb0;a7i6r3;ance,ench 3;guia0Epoly3;nes0;ji,nl1;lklandUroeU;ast tim7cu6gypt,l salv6ngl1quatorial4ritr5st3thiop0;on0; guin3;ea;ad3;or;enmark,jibou5ominica4r con3;go;!n C;ti;aBentral african Ah8o5roat0u4yprRzech3; 9ia;ba,racao;c4lo3morQngo brazzaville,okGsta r04te de ivoiL;mb0;osE;i3ristmasG;le,na;republic;m3naUpe verde,ymanA;bod0ero3;on;aGeDhut2o9r5u3;lgar0r3;kina faso,ma,undi;azil,itish 3unei;virgin3; is3;lands;liv0nai5snia and herzegoviHtswaHuvet3; isl1;and;re;l3n8rmuG;ar3gium,ize;us;h4ngladesh,rbad3;os;am4ra3;in;as;fghaGlDmBn6r4ustr3zerbaij2;al0ia;genti3men0uba;na;dorra,g5t3;arct7igua and barbu3;da;o3uil3;la;er3;ica;b3ger0;an0;ia;ni3;st2;an",
  "FirstName": "true\xA6aTblair,cQdOfrancoZgabMhinaLilya,jHkClBm6ni4quinn,re3s0;h0umit,yd;ay,e0iloh;a,lby;g9ne;co,ko0;!s;a1el0ina,org6;!okuhF;ds,naia,r1tt0xiB;i,y;ion,lo;ashawn,eif,uca;a3e1ir0rM;an;lsFn0rry;dall,yat5;i,sD;a0essIie,ude;i1m0;ie,mG;me;ta;rie0y;le;arcy,ev0;an,on;as1h0;arl8eyenne;ey,sidy;drien,kira,l4nd1ubr0vi;ey;i,r0;a,e0;a,y;ex2f1o0;is;ie;ei,is",
  "WeekDay": "true\xA6fri2mon2s1t0wednesd3;hurs1ues1;aturd1und1;!d0;ay0;!s",
  "Month": "true\xA6dec0february,july,nov0octo1sept0;em0;ber",
  "Date": "true\xA6ago,on4som4t1week0yesterd5; end,ends;mr1o0;d2morrow;!w;ed0;ay",
  "Duration": "true\xA6centurAd8h7m5q4se3w1y0;ear8r8;eek0k7;!end,s;ason,c5;tr,uarter;i0onth3;llisecond2nute2;our1r1;ay0ecade0;!s;ies,y",
  "FemaleName": "true\xA60:J7;1:JB;2:IJ;3:IK;4:J1;5:IO;6:JS;7:JO;8:HB;9:JK;A:H4;B:I2;C:IT;D:JH;E:IX;F:BA;G:I4;aGTbFLcDRdD0eBMfB4gADh9Ti9Gj8Dk7Cl5Wm48n3Lo3Hp33qu32r29s15t0Eu0Cv02wVxiTyOzH;aLeIineb,oHsof3;e3Sf3la,ra;h2iKlIna,ynH;ab,ep;da,ma;da,h2iHra;nab;aKeJi0FolB7uIvH;et8onDP;i0na;le0sen3;el,gm3Hn,rGLs8W;aoHme0nyi;m5XyAD;aMendDZhiDGiH;dele9lJnH;if48niHo0;e,f47;a,helmi0lHma;a,ow;ka0nB;aNeKiHusa5;ck84kIl8oleAviH;anFenJ4;ky,toriBK;da,lA8rHs0;a,nHoniH9;a,iFR;leHnesH9;nILrH;i1y;g9rHs6xHA;su5te;aYeUhRiNoLrIuHy2;i,la;acJ3iHu0J;c3na,sH;hFta;nHr0F;iFya;aJffaEOnHs6;a,gtiH;ng;!nFSra;aIeHomasi0;a,l9Oo8Ares1;l3ndolwethu;g9Fo88rIssH;!a,ie;eHi,ri7;sa,za;bOlMmKnIrHs6tia0wa0;a60yn;iHya;a,ka,s6;arFe2iHm77ra;!ka;a,iH;a,t6;at6it6;a0Ecarlett,e0AhWiSkye,neza0oQri,tNuIyH;bIGlvi1;ha,mayIJniAsIzH;an3Net8ie,y;anHi7;!a,e,nH;aCe;aIeH;fan4l5Dphan6E;cI5r5;b3fiAAm0LnHphi1;d2ia,ja,ya;er2lJmon1nIobh8QtH;a,i;dy;lETv3;aMeIirHo0risFDy5;a,lDM;ba,e0i5lJrH;iHr6Jyl;!d8Ifa;ia,lDZ;hd,iMki2nJrIu0w0yH;la,ma,na;i,le9on,ron,yn;aIda,ia,nHon;a,on;!ya;k6mH;!aa;lJrItaye82vH;da,inj;e0ife;en1i0ma;anA9bLd5Oh1SiBkKlJmInd2rHs6vannaC;aCi0;ant6i2;lDOma,ome;ee0in8Tu2;in1ri0;a05eZhXiUoHuthDM;bScRghQl8LnPsJwIxH;anB3ie,y;an,e0;aIeHie,lD;ann7ll1marDGtA;!lHnn1;iHyn;e,nH;a,dF;da,i,na;ayy8G;hel67io;bDRerAyn;a,cIkHmas,nFta,ya;ki,o;h8Xki;ea,iannGMoH;da,n1P;an0bJemFgi0iInHta,y0;a8Bee;han86na;a,eH;cHkaC;a,ca;bi0chIe,i0mo0nHquETy0;di,ia;aERelHiB;!e,le;een4ia0;aPeOhMiLoJrHute6A;iHudenCV;scil3LyamvaB;lHrt3;i0ly;a,paluk;ilome0oebe,ylH;is,lis;ggy,nelope,r5t2;ige,m0VnKo5rvaDMtIulH;a,et8in1;ricHt4T;a,e,ia;do2i07;ctav3dIfD3is6ksa0lHphD3umC5yunbileg;a,ga,iv3;eHvAF;l3t8;aWeUiMoIurHy5;!ay,ul;a,eJor,rIuH;f,r;aCeEma;ll1mi;aNcLhariBQkKlaJna,sHta,vi;anHha;ur;!y;a,iDZki;hoGk9YolH;a,e4P;!mh;hir,lHna,risDEsreE;!a,iDDlBV;asuMdLh3i6Dl5nKomi7rgEVtH;aHhal4;lHs6;i1ya;cy,et8;e9iF0ya;nngu2X;a0Ackenz4e02iMoJrignayani,uriDJyH;a,rH;a,iOlNna,tG;bi0i2llBJnH;a,iH;ca,ka,qD9;a,cUdo4ZkaTlOmi,nMrItzi,yH;ar;aJiIlH;anET;am;!l,nB;dy,eHh,n4;nhGrva;aKdJe0iCUlH;iHy;cent,e;red;!gros;!e5;ae5hH;ae5el3Z;ag5DgNi,lKrH;edi7AiIjem,on,yH;em,l;em,sCG;an4iHliCF;nHsCJ;a,da;!an,han;b09cASd07e,g05ha,i04ja,l02n00rLsoum5YtKuIv84xBKyHz4;bell,ra,soBB;d7rH;a,eE;h8Gild1t4;a,cUgQiKjor4l7Un4s6tJwa,yH;!aHbe6Xja9lAE;m,nBL;a,ha,in1;!aJbCGeIja,lDna,sHt63;!a,ol,sa;!l1D;!h,mInH;!a,e,n1;!awit,i;arJeIie,oHr48ueri8;!t;!ry;et46i3B;el4Xi7Cy;dHon,ue5;akranAy;ak,en,iHlo3S;a,ka,nB;a,re,s4te;daHg4;!l3E;alDd4elHge,isDJon0;ei9in1yn;el,le;a0Ne0CiXoQuLyH;d3la,nH;!a,dIe2OnHsCT;!a,e2N;a,sCR;aD4cJel0Pis1lIna,pHz;e,iA;a,u,wa;iHy;a0Se,ja,l2NnB;is,l1UrItt1LuHvel4;el5is1;aKeIi7na,rH;aADi7;lHn1tA;ei;!in1;aTbb9HdSepa,lNnKsJvIzH;!a,be5Ret8z4;!ia;a,et8;!a,dH;a,sHy;ay,ey,i,y;a,iJja,lH;iHy;aA8e;!aH;!nF;ia,ya;!nH;!a,ne;aPda,e0iNjYla,nMoKsJtHx93y5;iHt4;c3t3;e2PlCO;la,nHra;a,ie,o2;a,or1;a,gh,laH;!ni;!h,nH;a,d2e,n5V;cOdon9DiNkes6mi9Gna,rMtJurIvHxmi,y5;ern1in3;a,e5Aie,yn;as6iIoH;nya,ya;fa,s6;a,isA9;a,la;ey,ie,y;a04eZhXiOlASoNrJyH;lHra;a,ee,ie;istHy6I;a,en,iIyH;!na;!e,n5F;nul,ri,urtnB8;aOerNlB7mJrHzzy;a,stH;en,in;!berlImernH;aq;eHi,y;e,y;a,stE;!na,ra;aHei2ongordzol;dij1w5;el7UiKjsi,lJnIrH;a,i,ri;d2na,za;ey,i,lBLs4y;ra,s6;biAcARdiat7MeBAiSlQmPnyakuma1DrNss6NtKviAyH;!e,lH;a,eH;e,i8T;!a6HeIhHi4TlDri0y;ar8Her8Hie,leErBAy;!lyn8Ori0;a,en,iHl5Xoli0yn;!ma,nFs95;a5il1;ei8Mi,lH;e,ie;a,tl6O;a0AeZiWoOuH;anMdLlHst88;es,iH;a8NeHs8X;!n9tH;!a,te;e5Mi3My;a,iA;!anNcelDdMelGhan7VleLni,sIva0yH;a,ce;eHie;fHlDph7Y;a,in1;en,n1;i7y;!a,e,n45;lHng;!i1DlH;!i1C;anNle0nKrJsH;i8JsH;!e,i8I;i,ri;!a,elGif2CnH;a,et8iHy;!e,f2A;a,eJiInH;a,eIiH;e,n1;!t8;cMda,mi,nIque4YsminFvie2y9zH;min7;a7eIiH;ce,e,n1s;!lHs82t0F;e,le;inIk6HlDquelH;in1yn;da,ta;da,lRmPnOo0rNsIvaHwo0zaro;!a0lu,na;aJiIlaHob89;!n9R;do2;belHdo2;!a,e,l3B;a7Ben1i0ma;di2es,gr72ji;a9elBogH;en1;a,e9iHo0se;a0na;aSeOiJoHus7Kyacin2C;da,ll4rten24snH;a,i9U;lImaH;ri;aIdHlaI;a,egard;ry;ath1BiJlInrietArmi9sH;sa,t1A;en2Uga,mi;di;bi2Fil8MlNnMrJsItHwa,yl8M;i5Tt4;n60ti;iHmo51ri53;etH;!te;aCnaC;a,ey,l4;a02eWiRlPoNrKunJwH;enHyne1R;!dolD;ay,el;acieIetHiselB;a,chE;!la;ld1CogooH;sh;adys,enHor3yn2K;a,da,na;aKgi,lIna,ov8EselHta;a,e,le;da,liH;an;!n0;mLnJorgIrH;ald5Si,m3Etrud7;et8i4X;a,eHna;s29vieve;ma;bIle,mHrnet,yG;al5Si5;iIrielH;a,l1;!ja;aTeQiPlorOoz3rH;anJeIiH;da,eB;da,ja;!cH;esIiHoi0P;n1s66;!ca;a,enc3;en,o0;lIn0rnH;anB;ec3ic3;jr,nArKtHy7;emIiHma,oumaA;ha,ma,n;eh;ah,iBrah,za0;cr4Rd0Re0Qi0Pk0Ol07mXn54rUsOtNuMvHwa;aKelIiH;!e,ta;inFyn;!a;!ngel4V;geni1ni47;h5Yien9ta;mLperanKtH;eIhHrel5;er;l31r7;za;a,eralB;iHma,ne4Lyn;cHka,n;a,ka;aPeNiKmH;aHe21ie,y;!li9nuH;elG;lHn1;e7iHy;a,e,ja;lHrald;da,y;!nue5;aWeUiNlMma,no2oKsJvH;a,iH;na,ra;a,ie;iHuiH;se;a,en,ie,y;a0c3da,e,f,nMsJzaH;!betHveA;e,h;aHe,ka;!beH;th;!a,or;anor,nH;!a,i;!in1na;ate1Rta;leEs6;vi;eIiHna,wi0;e,th;l,n;aYeMh3iLjeneKoH;lor5Vminiq4Ln3FrHtt4;a,eEis,la,othHthy;ea,y;ba;an09naCon9ya;anQbPde,eOiMlJmetr3nHsir5M;a,iH;ce,se;a,iIla,orHphi9;es,is;a,l6F;dHrdH;re;!d5Ena;!b2ForaCraC;a,d2nH;!a,e;hl3i0l0GmNnLphn1rIvi1WyH;le,na;a,by,cIia,lH;a,en1;ey,ie;a,et8iH;!ca,el1Aka,z;arHia;is;a0Re0Nh04i02lUoJristIynH;di,th3;al,i0;lPnMrIurH;tn1D;aJd2OiHn2Ori9;!nH;a,e,n1;!l4;cepci5Cn4sH;tanHuelo;ce,za;eHleE;en,t8;aJeoIotH;il54;!pat2;ir7rJudH;et8iH;a,ne;a,e,iH;ce,sZ;a2er2ndH;i,y;aReNloe,rH;isJyH;stH;al;sy,tH;a1Sen,iHy;an1e,n1;deJlseIrH;!i7yl;a,y;li9;nMrH;isKlImH;ai9;a,eHot8;n1t8;!sa;d2elGtH;al,elG;cIlH;es8i47;el3ilH;e,ia,y;itlYlXmilWndVrMsKtHy5;aIeIhHri0;er1IleErDy;ri0;a38sH;a37ie;a,iOlLmeJolIrH;ie,ol;!e,in1yn;lHn;!a,la;a,eIie,otHy;a,ta;ne,y;na,s1X;a0Ii0I;a,e,l1;isAl4;in,yn;a0Ke02iZlXoUrH;andi7eRiJoIyH;an0nn;nwDoke;an3HdgMgiLtH;n31tH;!aInH;ey,i,y;ny;d,t8;etH;!t7;an0e,nH;da,na;bbi7glarIlo07nH;iAn4;ka;ancHythe;a,he;an1Clja0nHsm3M;iAtH;ou;aWcVlinUniArPssOtJulaCvH;!erlH;ey,y;hJsy,tH;e,iHy7;e,na;!anH;ie,y;!ie;nItHyl;ha,ie;adIiH;ce;et8i9;ay,da;ca,ky;!triH;ce,z;rbJyaH;rmH;aa;a2o2ra;a2Ub2Od25g21i1Sj5l18m0Zn0Boi,r06sWtVuPvOwa,yIzH;ra,u0;aKes6gJlIn,seH;!l;in;un;!nH;a,na;a,i2K;drLguJrIsteH;ja;el3;stH;in1;a,ey,i,y;aahua,he0;hIi2Gja,miAs2DtrH;id;aMlIraqHt21;at;eIi7yH;!n;e,iHy;gh;!nH;ti;iJleIo6piA;ta;en,n1t8;aHelG;!n1J;a01dje5eZgViTjRnKohito,toHya;inet8nH;el5ia;te;!aKeIiHmJ;e,ka;!mHtt7;ar4;!belIliHmU;sa;!l1;a,eliH;ca;ka,sHta;a,sa;elHie;a,iH;a,ca,n1qH;ue;!tH;a,te;!bImHstasiMya;ar3;el;aLberKeliJiHy;e,l3naH;!ta;a,ja;!ly;hGiIl3nB;da;a,ra;le;aWba,ePiMlKthJyH;a,c3sH;a,on,sa;ea;iHys0N;e,s0M;a,cIn1sHza;a,e,ha,on,sa;e,ia,ja;c3is6jaKksaKna,sJxH;aHia;!nd2;ia,saH;nd2;ra;ia;i0nIyH;ah,na;a,is,naCoud;la;c6da,leEmNnLsH;haClH;inHyY;g,n;!h;a,o,slH;ey;ee;en;at6g4nIusH;ti0;es;ie;aWdiTelMrH;eJiH;anMenH;a,e,ne;an0;na;!aLeKiIyH;nn;a,n1;a,e;!ne;!iH;de;e,lDsH;on;yn;!lH;i9yn;ne;aKbIiHrL;!e,gaK;ey,i7y;!e;gaH;il;dKliyJradhIs6;ha;ya;ah;a,ya",
  "Honorific": "true\xA6director1field marsh2lieutenant1rear0sergeant major,vice0; admir1; gener0;al",
  "Adj|Gerund": "true\xA60:3F;1:3H;2:31;3:2X;4:35;5:33;6:3C;7:2Z;8:36;9:29;a33b2Tc2Bd1Te1If19g12h0Zi0Rl0Nm0Gnu0Fo0Ap04rYsKtEuBvAw1Ayiel3;ar6e08;nBpA;l1Rs0B;fol3n1Zsett2;aEeDhrBi4ouc7rAwis0;e0Bif2oub2us0yi1;ea1SiA;l2vi1;l2mp0rr1J;nt1Vxi1;aMcreec7enten2NhLkyrocke0lo0Vmi2oJpHtDuBweA;e0Ul2;pp2ArA;gi1pri5roun3;aBea8iAri2Hun9;mula0r4;gge4rA;t2vi1;ark2eAraw2;e3llb2F;aAot7;ki1ri1;i9oc29;dYtisf6;aEeBive0oAus7;a4l2;assu4defi9fres7ig9juve07mai9s0vAwar3;ea2italiAol1G;si1zi1;gi1ll6mb2vi1;a6eDier23lun1VrAun2C;eBoA;mi5vo1Z;ce3s5vai2;n3rpleA;xi1;ffCpWutBverAwi1;arc7lap04p0Pri3whel8;goi1l6st1J;en3sA;et0;m2Jrtu4;aEeDiCoBuAyst0L;mb2;t1Jvi1;s5tiga0;an1Rl0n3smeri26;dAtu4;de9;aCeaBiAo0U;fesa0Tvi1;di1ni1;c1Fg19s0;llumiGmFnArri0R;cDfurHsCtBviA;go23ti1;e1Oimi21oxica0rig0V;pi4ul0;orpo20r0K;po5;na0;eaBorr02umilA;ia0;li1rtwar8;lFrA;atiDipCoBuelA;i1li1;undbrea10wi1;pi1;f6ng;a4ea8;a3etc7it0lEoCrBulfA;il2;ee1FighXust1L;rAun3;ebo3thco8;aCoA;a0wA;e4i1;mi1tte4;lectrJmHnExA;aCci0hBis0pA;an3lo3;aOila1B;c0spe1A;ab2coura0CdBergi13ga0Clive9ric7s02tA;hral2i0J;ea4u4;barras5er09pA;owe4;if6;aQeIiBrA;if0;sAzz6;aEgDhearCsen0tA;rAur11;ac0es5;te9;us0;ppoin0r8;biliGcDfi9gra3ligh0mBpres5sAvasG;erE;an3ea9orA;ali0L;a6eiBli9rA;ea5;vi1;ta0;maPri1s7un0zz2;aPhMlo5oAripp2ut0;mGnArrespon3;cer9fDspi4tA;inBrA;as0ibu0ol2;ui1;lic0u5;ni1;fDmCpA;eAromi5;l2ti1;an3;or0;aAil2;llenAnAr8;gi1;l8ptAri1;iva0;aff2eGin3lFoDrBuA;d3st2;eathtaAui5;ki1;gg2i2o8ri1unA;ci1;in3;co8wiA;lAtc7;de4;bsorVcOgonMlJmHnno6ppea2rFsA;pi4su4toA;nBun3;di1;is7;hi1;res0;li1;aFu5;si1;ar8lu4;ri1;mi1;iAzi1;zi1;cAhi1;eleDomA;moBpan6;yi1;da0;ra0;ti1;bi1;ng",
  "Comparable": "true\xA60:3C;1:3Q;2:3F;a3Tb3Cc33d2Te2Mf2Ag1Wh1Li1Fj1Ek1Bl13m0Xn0So0Rp0Iqu0Gr07sHtCug0vAw4y3za0Q;el10ouN;ary,e6hi5i3ry;ck0Cde,l3n1ry,se;d,y;ny,te;a3i3R;k,ry;a3erda2ulgar;gue,in,st;a6en2Xhi5i4ouZr3;anqu2Cen1ue;dy,g36me0ny;ck,rs28;ll,me,rt,wd3I;aRcaPeOhMiLkin0BlImGoEpDt6u4w3;eet,ift;b3dd0Wperfi21rre28;sta26t21;a8e7iff,r4u3;pUr1;a4ict,o3;ng;ig2Vn0N;a1ep,rn;le,rk,te0;e1Si2Vright0;ci1Yft,l3on,re;emn,id;a3el0;ll,rt;e4i3y;g2Mm0Z;ek,nd2T;ck24l0mp1L;a3iRrill,y;dy,l01rp;ve0Jxy;n1Jr3;ce,y;d,fe,int0l1Hv0V;a8e6i5o3ude;mantic,o19sy,u3;gh;pe,t1P;a3d,mo0A;dy,l;gg4iFndom,p3re,w;id;ed;ai2i3;ck,et;hoAi1Fl9o8r5u3;ny,r3;e,p11;egna2ic4o3;fouSud;ey,k0;liXor;ain,easa2;ny;dd,i0ld,ranL;aive,e5i4o3u14;b0Sisy,rm0Ysy;bb0ce,mb0R;a3r1w;r,t;ad,e5ild,o4u3;nda12te;ist,o1;a4ek,l3;low;s0ty;a8e7i6o3ucky;f0Jn4o15u3ve0w10y0N;d,sy;e0g;ke0l,mp,tt0Eve0;e1Qwd;me,r3te;ge;e4i3;nd;en;ol0ui19;cy,ll,n3;secu6t3;e3ima4;llege2rmedia3;te;re;aAe7i6o5u3;ge,m3ng1C;bYid;me0t;gh,l0;a3fXsita2;dy,rWv3;en0y;nd13ppy,r3;d3sh;!y;aFenEhCiBlAoofy,r3;a8e6i5o3ue0Z;o3ss;vy;m,s0;at,e3y;dy,n;nd,y;ad,ib,ooD;a2d1;a3o3;st0;tDuiS;u1y;aCeebBi9l8o6r5u3;ll,n3r0N;!ny;aCesh,iend0;a3nd,rmD;my;at,ir7;erce,nan3;ci9;le;r,ul3;ty;a6erie,sse4v3xtre0B;il;nti3;al;r4s3;tern,y;ly,th0;appZe9i5ru4u3;mb;nk;r5vi4z3;zy;ne;e,ty;a3ep,n9;d3f,r;!ly;agey,h8l7o5r4u3;dd0r0te;isp,uel;ar3ld,mmon,st0ward0zy;se;evKou1;e3il0;ap,e3;sy;aHiFlCoAr5u3;ff,r0sy;ly;a6i3oad;g4llia2;nt;ht;sh,ve;ld,un3;cy;a4o3ue;nd,o1;ck,nd;g,tt3;er;d,ld,w1;dy;bsu6ng5we3;so3;me;ry;rd",
  "Adverb": "true\xA6a08b05d00eYfSheQinPjustOkinda,likewiZmMnJoEpCquite,r9s5t2u0very,well;ltima01p0; to,wards5;h1iny bit,o0wiO;o,t6;en,us;eldom,o0uch;!me1rt0; of;how,times,w0C;a1e0;alS;ndomRth05;ar excellenEer0oint blank; Lhaps;f3n0utright;ce0ly;! 0;ag05moX; courGten;ewJo0; longWt 0;onHwithstand9;aybe,eanwhiNore0;!ovT;! aboX;deed,steY;lla,n0;ce;or3u0;ck1l9rther0;!moK;ing; 0evK;exampCgood,suH;n mas0vI;se;e0irect2; 2fini0;te0;ly;juAtrop;ackward,y 0;far,no0; means,w; GbroFd nauseam,gEl7ny5part,s4t 2w0;ay,hi0;le;be7l0mo7wor7;arge,ea6; soon,i4;mo0way;re;l 3mo2ongsi1ready,so,togeth0ways;er;de;st;b1t0;hat;ut;ain;ad;lot,posteriori",
  "Conjunction": "true\xA6aXbTcReNhowMiEjust00noBo9p8supposing,t5wh0yet;e1il0o3;e,st;n1re0thN; if,by,vM;evL;h0il,o;erefOo0;!uU;lus,rovided th9;r0therwiM;! not; mattEr,w0;! 0;since,th4w7;f4n0; 0asmuch;as mIcaForder t0;h0o;at;! 0;only,t0w0;hen;!ev3;ith2ven0;! 0;if,tB;er;o0uz;s,z;e0ut,y the time;cau1f0;ore;se;lt3nd,s 0;far1if,m0soon1t2;uch0; as;hou0;gh",
  "Currency": "true\xA6$,aud,bQcOdJeurIfHgbp,hkd,iGjpy,kElDp8r7s3usd,x2y1z0\xA2,\xA3,\xA5,\u0434\u0435\u043D,\u043B\u0432,\u0440\u0443\u0431,\u0E3F,\u20A1,\u20A8,\u20AC,\u20AD,\uFDFC;lotyQ\u0142;en,uanP;af,of;h0t5;e0il5;k0q0;elK;oubleJp,upeeJ;e2ound st0;er0;lingG;n0soF;ceEnies;empi7i7;n,r0wanzaCyatC;!onaBw;ls,nr;ori7ranc9;!os;en3i2kk,o0;b0ll2;ra5;me4n0rham4;ar3;e0ny;nt1;aht,itcoin0;!s",
  "Determiner": "true\xA6aBboth,d9e6few,le5mu8neiDplenty,s4th2various,wh0;at0ich0;evC;a0e4is,ose;!t;everal,ome;!ast,s;a1l0very;!se;ch;e0u;!s;!n0;!o0y;th0;er",
  "Adj|Present": "true\xA6a07b04cVdQeNfJhollIidRlEmCnarrIoBp9qua8r7s3t2uttFw0;aKet,ro0;ng,u08;endChin;e2hort,l1mooth,our,pa9tray,u0;re,speU;i2ow;cu6da02leSpaN;eplica01i02;ck;aHerfePr0;eseUime,omV;bscu1pen,wn;atu0e3odeH;re;a2e1ive,ow0;er;an;st,y;ow;a2i1oul,r0;ee,inge;rm;iIke,ncy,st;l1mpty,x0;emHpress;abo4ic7;amp,e2i1oub0ry,ull;le;ffu9re6;fu8libe0;raE;alm,l5o0;mpleCn3ol,rr1unterfe0;it;e0u7;ct;juga8sum7;ea1o0;se;n,r;ankru1lu0;nt;pt;li2pproxi0rticula1;ma0;te;ght",
  "Person|Adj": "true\xA6b3du2earnest,frank,mi2r0san1woo1;an0ich,u1;dy;sty;ella,rown",
  "Modal": "true\xA6c5lets,m4ought3sh1w0;ill,o5;a0o4;ll,nt;! to,a;ight,ust;an,o0;uld",
  "Verb": "true\xA6born,cannot,gonna,has,keep tabs,msg",
  "Person|Verb": "true\xA6b8ch7dr6foster,gra5ja9lan4ma2ni9ollie,p1rob,s0wade;kip,pike,t5ue;at,eg,ier2;ck,r0;k,shal;ce;ce,nt;ew;ase,u1;iff,l1ob,u0;ck;aze,ossom",
  "Person|Date": "true\xA6a2j0sep;an0une;!uary;p0ugust,v0;ril"
};

// reducer/node_modules/efrt/src/encoding.js
var BASE = 36;
var seq = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
var cache = seq.split("").reduce(function(h2, c2, i3) {
  h2[c2] = i3;
  return h2;
}, {});
var toAlphaCode = function(n3) {
  if (seq[n3] !== void 0) {
    return seq[n3];
  }
  let places2 = 1;
  let range = BASE;
  let s3 = "";
  for (; n3 >= range; n3 -= range, places2++, range *= BASE) {
  }
  while (places2--) {
    const d2 = n3 % BASE;
    s3 = String.fromCharCode((d2 < 10 ? 48 : 55) + d2) + s3;
    n3 = (n3 - d2) / BASE;
  }
  return s3;
};
var fromAlphaCode = function(s3) {
  if (cache[s3] !== void 0) {
    return cache[s3];
  }
  let n3 = 0;
  let places2 = 1;
  let range = BASE;
  let pow = 1;
  for (; places2 < s3.length; n3 += range, places2++, range *= BASE) {
  }
  for (let i3 = s3.length - 1; i3 >= 0; i3--, pow *= BASE) {
    let d2 = s3.charCodeAt(i3) - 48;
    if (d2 > 10) {
      d2 -= 7;
    }
    n3 += d2 * pow;
  }
  return n3;
};
var encoding_default = {
  toAlphaCode,
  fromAlphaCode
};

// reducer/node_modules/efrt/src/unpack/symbols.js
var symbols = function(t3) {
  const reSymbol = new RegExp("([0-9A-Z]+):([0-9A-Z]+)");
  for (let i3 = 0; i3 < t3.nodes.length; i3++) {
    const m3 = reSymbol.exec(t3.nodes[i3]);
    if (!m3) {
      t3.symCount = i3;
      break;
    }
    t3.syms[encoding_default.fromAlphaCode(m3[1])] = encoding_default.fromAlphaCode(m3[2]);
  }
  t3.nodes = t3.nodes.slice(t3.symCount, t3.nodes.length);
};
var symbols_default = symbols;

// reducer/node_modules/efrt/src/unpack/traverse.js
var indexFromRef = function(trie, ref, index3) {
  const dnode = encoding_default.fromAlphaCode(ref);
  if (dnode < trie.symCount) {
    return trie.syms[dnode];
  }
  return index3 + dnode + 1 - trie.symCount;
};
var toArray = function(trie) {
  const all4 = [];
  const crawl = (index3, pref) => {
    let node = trie.nodes[index3];
    if (node[0] === "!") {
      all4.push(pref);
      node = node.slice(1);
    }
    const matches3 = node.split(/([A-Z0-9,]+)/g);
    for (let i3 = 0; i3 < matches3.length; i3 += 2) {
      const str = matches3[i3];
      const ref = matches3[i3 + 1];
      if (!str) {
        continue;
      }
      const have = pref + str;
      if (ref === "," || ref === void 0) {
        all4.push(have);
        continue;
      }
      const newIndex = indexFromRef(trie, ref, index3);
      crawl(newIndex, have);
    }
  };
  crawl(0, "");
  return all4;
};
var unpack = function(str) {
  const trie = {
    nodes: str.split(";"),
    syms: [],
    symCount: 0
  };
  if (str.match(":")) {
    symbols_default(trie);
  }
  return toArray(trie);
};
var traverse_default = unpack;

// reducer/node_modules/efrt/src/unpack/index.js
var unpack2 = function(str) {
  if (!str) {
    return {};
  }
  const obj = str.split("|").reduce((h2, s3) => {
    const arr = s3.split("\xA6");
    h2[arr[0]] = arr[1];
    return h2;
  }, {});
  const all4 = {};
  Object.keys(obj).forEach(function(cat) {
    const arr = traverse_default(obj[cat]);
    if (cat === "true") {
      cat = true;
    }
    for (let i3 = 0; i3 < arr.length; i3++) {
      const k2 = arr[i3];
      if (all4.hasOwnProperty(k2) === true) {
        if (Array.isArray(all4[k2]) === false) {
          all4[k2] = [all4[k2], cat];
        } else {
          all4[k2].push(cat);
        }
      } else {
        all4[k2] = cat;
      }
    }
  });
  return all4;
};
var unpack_default = unpack2;

// reducer/node_modules/compromise/src/2-two/preTagger/model/lexicon/misc.js
var prp = ["Possessive", "Pronoun"];
var misc = {
  // numbers
  "20th century fox": "Organization",
  "7 eleven": "Organization",
  "motel 6": "Organization",
  g8: "Organization",
  vh1: "Organization",
  "76ers": "SportsTeam",
  "49ers": "SportsTeam",
  q1: "Date",
  q2: "Date",
  q3: "Date",
  q4: "Date",
  km2: "Unit",
  m2: "Unit",
  dm2: "Unit",
  cm2: "Unit",
  mm2: "Unit",
  mile2: "Unit",
  in2: "Unit",
  yd2: "Unit",
  ft2: "Unit",
  m3: "Unit",
  dm3: "Unit",
  cm3: "Unit",
  in3: "Unit",
  ft3: "Unit",
  yd3: "Unit",
  // ampersands
  "at&t": "Organization",
  "black & decker": "Organization",
  "h & m": "Organization",
  "johnson & johnson": "Organization",
  "procter & gamble": "Organization",
  "ben & jerry's": "Organization",
  "&": "Conjunction",
  //pronouns
  i: ["Pronoun", "Singular"],
  he: ["Pronoun", "Singular"],
  she: ["Pronoun", "Singular"],
  it: ["Pronoun", "Singular"],
  they: ["Pronoun", "Plural"],
  we: ["Pronoun", "Plural"],
  was: ["Copula", "PastTense"],
  is: ["Copula", "PresentTense"],
  are: ["Copula", "PresentTense"],
  am: ["Copula", "PresentTense"],
  were: ["Copula", "PastTense"],
  // possessive pronouns
  her: prp,
  his: prp,
  hers: prp,
  their: prp,
  theirs: prp,
  themselves: prp,
  your: prp,
  our: prp,
  ours: prp,
  my: prp,
  its: prp,
  // misc
  vs: ["Conjunction", "Abbreviation"],
  if: ["Condition", "Preposition"],
  closer: "Comparative",
  closest: "Superlative",
  much: "Adverb",
  may: "Modal",
  // irregular conjugations with two forms
  babysat: "PastTense",
  blew: "PastTense",
  drank: "PastTense",
  drove: "PastTense",
  forgave: "PastTense",
  skiied: "PastTense",
  spilt: "PastTense",
  stung: "PastTense",
  swam: "PastTense",
  swung: "PastTense",
  guaranteed: "PastTense",
  shrunk: "PastTense",
  // support 'near', 'nears', 'nearing'
  nears: "PresentTense",
  nearing: "Gerund",
  neared: "PastTense",
  no: ["Negative", "Expression"]
  // '-': 'Preposition', //june - july
  // there: 'There'
};
var misc_default2 = misc;

// reducer/node_modules/compromise/src/2-two/preTagger/model/lexicon/frozenLex.js
var frozenLex_default = {
  "20th century fox": "Organization",
  "7 eleven": "Organization",
  "motel 6": "Organization",
  "excuse me": "Expression",
  "financial times": "Organization",
  "guns n roses": "Organization",
  "la z boy": "Organization",
  "labour party": "Organization",
  "new kids on the block": "Organization",
  "new york times": "Organization",
  "the guess who": "Organization",
  "thin lizzy": "Organization",
  "prime minister": "Actor",
  "free market": "Singular",
  "lay up": "Singular",
  "living room": "Singular",
  "living rooms": "Plural",
  "spin off": "Singular",
  "appeal court": "Uncountable",
  "cold war": "Uncountable",
  "gene pool": "Uncountable",
  "machine learning": "Uncountable",
  "nail polish": "Uncountable",
  "time off": "Uncountable",
  "take part": "Infinitive",
  "bill gates": "Person",
  "doctor who": "Person",
  "dr who": "Person",
  "he man": "Person",
  "iron man": "Person",
  "kid cudi": "Person",
  "run dmc": "Person",
  "rush limbaugh": "Person",
  "snow white": "Person",
  "tiger woods": "Person",
  "brand new": "Adjective",
  "en route": "Adjective",
  "left wing": "Adjective",
  "off guard": "Adjective",
  "on board": "Adjective",
  "part time": "Adjective",
  "right wing": "Adjective",
  "so called": "Adjective",
  "spot on": "Adjective",
  "straight forward": "Adjective",
  "super duper": "Adjective",
  "tip top": "Adjective",
  "top notch": "Adjective",
  "up to date": "Adjective",
  "win win": "Adjective",
  "brooklyn nets": "SportsTeam",
  "chicago bears": "SportsTeam",
  "houston astros": "SportsTeam",
  "houston dynamo": "SportsTeam",
  "houston rockets": "SportsTeam",
  "houston texans": "SportsTeam",
  "minnesota twins": "SportsTeam",
  "orlando magic": "SportsTeam",
  "san antonio spurs": "SportsTeam",
  "san diego chargers": "SportsTeam",
  "san diego padres": "SportsTeam",
  "iron maiden": "ProperNoun",
  "isle of man": "Country",
  "united states": "Country",
  "united states of america": "Country",
  "prince edward island": "Region",
  "cedar breaks": "Place",
  "cedar falls": "Place",
  "point blank": "Adverb",
  "tiny bit": "Adverb",
  "by the time": "Conjunction",
  "no matter": "Conjunction",
  "civil wars": "Plural",
  "credit cards": "Plural",
  "default rates": "Plural",
  "free markets": "Plural",
  "head starts": "Plural",
  "home runs": "Plural",
  "lay ups": "Plural",
  "phone calls": "Plural",
  "press releases": "Plural",
  "record labels": "Plural",
  "soft serves": "Plural",
  "student loans": "Plural",
  "tax returns": "Plural",
  "tv shows": "Plural",
  "video games": "Plural",
  "took part": "PastTense",
  "takes part": "PresentTense",
  "taking part": "Gerund",
  "taken part": "Participle",
  "light bulb": "Noun",
  "rush hour": "Noun",
  "fluid ounce": "Unit",
  "the rolling stones": "Organization"
};

// reducer/node_modules/compromise/src/2-two/preTagger/model/lexicon/emoticons.js
var emoticons_default = [
  ":(",
  ":)",
  ":P",
  ":p",
  ":O",
  ";(",
  ";)",
  ";P",
  ";p",
  ";O",
  ":3",
  ":|",
  ":/",
  ":\\",
  ":$",
  ":*",
  ":@",
  ":-(",
  ":-)",
  ":-P",
  ":-p",
  ":-O",
  ":-3",
  ":-|",
  ":-/",
  ":-\\",
  ":-$",
  ":-*",
  ":-@",
  ":^(",
  ":^)",
  ":^P",
  ":^p",
  ":^O",
  ":^3",
  ":^|",
  ":^/",
  ":^\\",
  ":^$",
  ":^*",
  ":^@",
  "):",
  "(:",
  "$:",
  "*:",
  ")-:",
  "(-:",
  "$-:",
  "*-:",
  ")^:",
  "(^:",
  "$^:",
  "*^:",
  "<3",
  "</3",
  "<\\3",
  "=("
];

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/nouns/toPlural/_rules.js
var suffixes = {
  a: [
    [/(antenn|formul|nebul|vertebr|vit)a$/i, "$1ae"],
    [/ia$/i, "ia"]
  ],
  e: [
    [/(kn|l|w)ife$/i, "$1ives"],
    [/(hive)$/i, "$1s"],
    [/([m|l])ouse$/i, "$1ice"],
    [/([m|l])ice$/i, "$1ice"]
  ],
  f: [
    [/^(dwar|handkerchie|hoo|scar|whar)f$/i, "$1ves"],
    [/^((?:ca|e|ha|(?:our|them|your)?se|she|wo)l|lea|loa|shea|thie)f$/i, "$1ves"]
  ],
  i: [[/(octop|vir)i$/i, "$1i"]],
  m: [[/([ti])um$/i, "$1a"]],
  n: [[/^(oxen)$/i, "$1"]],
  o: [[/(al|ad|at|er|et|ed)o$/i, "$1oes"]],
  s: [
    [/(ax|test)is$/i, "$1es"],
    [/(alias|status)$/i, "$1es"],
    [/sis$/i, "ses"],
    [/(bu)s$/i, "$1ses"],
    [/(sis)$/i, "ses"],
    [/^(?!talis|.*hu)(.*)man$/i, "$1men"],
    [/(octop|vir|radi|nucle|fung|cact|stimul)us$/i, "$1i"]
  ],
  x: [
    [/(matr|vert|ind|cort)(ix|ex)$/i, "$1ices"],
    [/^(ox)$/i, "$1en"]
  ],
  y: [[/([^aeiouy]|qu)y$/i, "$1ies"]],
  z: [[/(quiz)$/i, "$1zes"]]
};
var rules_default = suffixes;

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/nouns/toPlural/index.js
var addE = /([xsz]|ch|sh)$/;
var trySuffix = function(str) {
  const c2 = str[str.length - 1];
  if (rules_default.hasOwnProperty(c2) === true) {
    for (let i3 = 0; i3 < rules_default[c2].length; i3 += 1) {
      const reg = rules_default[c2][i3][0];
      if (reg.test(str) === true) {
        return str.replace(reg, rules_default[c2][i3][1]);
      }
    }
  }
  return null;
};
var pluralize = function(str = "", model5) {
  const { irregularPlurals, uncountable: uncountable2 } = model5.two;
  if (uncountable2.hasOwnProperty(str)) {
    return str;
  }
  if (irregularPlurals.hasOwnProperty(str)) {
    return irregularPlurals[str];
  }
  const plural2 = trySuffix(str);
  if (plural2 !== null) {
    return plural2;
  }
  if (addE.test(str)) {
    return str + "es";
  }
  return str + "s";
};
var toPlural_default = pluralize;

// reducer/node_modules/compromise/src/2-two/preTagger/model/lexicon/index.js
var hasSwitch = /\|/;
var lexicon3 = misc_default2;
var switches = {};
var tmpModel = { two: { irregularPlurals: plurals_default, uncountable: {} } };
Object.keys(data_default).forEach((tag) => {
  const wordsObj = unpack_default(data_default[tag]);
  if (!hasSwitch.test(tag)) {
    Object.keys(wordsObj).forEach((w) => {
      lexicon3[w] = tag;
    });
    return;
  }
  Object.keys(wordsObj).forEach((w) => {
    switches[w] = tag;
    if (tag === "Noun|Verb") {
      const plural2 = toPlural_default(w, tmpModel);
      switches[plural2] = "Plural|Verb";
    }
  });
});
emoticons_default.forEach((str) => lexicon3[str] = "Emoticon");
delete lexicon3[""];
delete lexicon3[null];
delete lexicon3[" "];

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/_noun.js
var n2 = "Singular";
var noun_default = {
  beforeTags: {
    Determiner: n2,
    //the date
    Possessive: n2,
    //his date
    Acronym: n2,
    //u.s. state
    // ProperNoun:n,
    Noun: n2,
    //nasa funding
    Adjective: n2,
    //whole bottles
    // Verb:true, //save storm victims
    PresentTense: n2,
    //loves hiking
    Gerund: n2,
    //uplifting victims
    PastTense: n2,
    //saved storm victims
    Infinitive: n2,
    //profess love
    Date: n2,
    //9pm show
    Ordinal: n2,
    //first date
    Demonym: n2
    //dutch map
  },
  afterTags: {
    Value: n2,
    //date nine  -?
    Modal: n2,
    //date would
    Copula: n2,
    //fear is
    PresentTense: n2,
    //babysitting sucks
    PastTense: n2,
    //babysitting sucked
    // Noun:n, //talking therapy, planning process
    Demonym: n2,
    //american touch
    Actor: n2
    //dance therapist
  },
  // ownTags: { ProperNoun: n },
  beforeWords: {
    the: n2,
    //the brands
    with: n2,
    //with cakes
    without: n2,
    //
    // was:n, //was time  -- was working
    // is:n, //
    of: n2,
    //of power
    for: n2,
    //for rats
    any: n2,
    //any rats
    all: n2,
    //all tips
    on: n2,
    //on time
    // thing-ish verbs
    cut: n2,
    //cut spending
    cuts: n2,
    //cut spending
    increase: n2,
    // increase funding
    decrease: n2,
    //
    raise: n2,
    //
    drop: n2,
    //
    // give: n,//give parents
    save: n2,
    //
    saved: n2,
    //
    saves: n2,
    //
    make: n2,
    //
    makes: n2,
    //
    made: n2,
    //
    minus: n2,
    //minus laughing
    plus: n2,
    //
    than: n2,
    //more than age
    another: n2,
    //
    versus: n2,
    //
    neither: n2,
    //
    about: n2,
    //about claims
    // strong adjectives
    favorite: n2,
    //
    best: n2,
    //
    daily: n2,
    //
    weekly: n2,
    //
    linear: n2,
    //
    binary: n2,
    //
    mobile: n2,
    //
    lexical: n2,
    //
    technical: n2,
    //
    computer: n2,
    //
    scientific: n2,
    //
    security: n2,
    //
    government: n2,
    //
    popular: n2,
    //
    formal: n2,
    no: n2,
    //no worries
    more: n2,
    //more details
    one: n2,
    //one flood
    let: n2,
    //let fear
    her: n2,
    //her boots
    his: n2,
    //
    their: n2,
    //
    our: n2,
    //
    us: n2,
    //served us drinks
    sheer: n2,
    monthly: n2,
    yearly: n2,
    current: n2,
    previous: n2,
    upcoming: n2,
    last: n2,
    next: n2,
    main: n2,
    initial: n2,
    final: n2,
    beginning: n2,
    end: n2,
    top: n2,
    bottom: n2,
    future: n2,
    past: n2,
    major: n2,
    minor: n2,
    side: n2,
    central: n2,
    peripheral: n2,
    public: n2,
    private: n2
  },
  afterWords: {
    of: n2,
    //date of birth (preposition)
    system: n2,
    aid: n2,
    method: n2,
    utility: n2,
    tool: n2,
    reform: n2,
    therapy: n2,
    philosophy: n2,
    room: n2,
    authority: n2,
    says: n2,
    said: n2,
    wants: n2,
    wanted: n2,
    is: n2,
    did: n2,
    do: n2,
    can: n2,
    //parents can
    wise: n2
    //service-wise
    // they: n,//snakes they
  }
};

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/_verb.js
var v = "Infinitive";
var verb_default = {
  beforeTags: {
    Modal: v,
    //would date
    Adverb: v,
    //quickly date
    Negative: v,
    //not date
    Plural: v
    //characters drink
    // ProperNoun: vb,//google thought
  },
  afterTags: {
    Determiner: v,
    //flash the
    Adverb: v,
    //date quickly
    Possessive: v,
    //date his
    Reflexive: v,
    //resolve yourself
    // Noun:true, //date spencer
    Preposition: v,
    //date around, dump onto, grumble about
    // Conjunction: v, // dip to, dip through
    Cardinal: v,
    //cut 3 squares
    Comparative: v,
    //feel greater
    Superlative: v
    //feel greatest
  },
  beforeWords: {
    i: v,
    //i date
    we: v,
    //we date
    you: v,
    //you date
    they: v,
    //they date
    to: v,
    //to date
    please: v,
    //please check
    will: v,
    //will check
    have: v,
    had: v,
    would: v,
    could: v,
    should: v,
    do: v,
    did: v,
    does: v,
    can: v,
    must: v,
    us: v,
    me: v,
    let: v,
    even: v,
    when: v,
    help: v,
    //help combat
    // them: v,
    he: v,
    she: v,
    it: v,
    being: v,
    // prefixes
    bi: v,
    co: v,
    contra: v,
    de: v,
    inter: v,
    intra: v,
    mis: v,
    pre: v,
    out: v,
    counter: v,
    nobody: v,
    somebody: v,
    anybody: v,
    everybody: v
    // un: v,
    // over: v,
    // under: v,
  },
  afterWords: {
    the: v,
    //echo the
    me: v,
    //date me
    you: v,
    //date you
    him: v,
    //loves him
    us: v,
    //cost us
    her: v,
    //
    his: v,
    //
    them: v,
    //
    they: v,
    //
    it: v,
    //hope it
    himself: v,
    herself: v,
    itself: v,
    myself: v,
    ourselves: v,
    themselves: v,
    something: v,
    anything: v,
    a: v,
    //covers a
    an: v,
    //covers an
    // from: v, //ranges from
    up: v,
    //serves up
    down: v,
    //serves up
    by: v,
    // in: v, //bob in
    out: v,
    // on: v,
    off: v,
    under: v,
    what: v,
    //look what
    // when: v,//starts when
    // for:true, //settled for
    all: v,
    //shiver all night
    // conjunctions
    to: v,
    //dip to
    because: v,
    //
    although: v,
    //
    // after: v,
    // before: v,//
    how: v,
    //
    otherwise: v,
    //
    together: v,
    //fit together
    though: v,
    //
    into: v,
    //
    yet: v,
    //
    more: v,
    //kill more
    here: v,
    // look here
    there: v,
    //
    away: v
    //float away
  }
};

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/actor-verb.js
var clue = {
  beforeTags: Object.assign({}, verb_default.beforeTags, noun_default.beforeTags, {}),
  afterTags: Object.assign({}, verb_default.afterTags, noun_default.afterTags, {}),
  beforeWords: Object.assign({}, verb_default.beforeWords, noun_default.beforeWords, {}),
  afterWords: Object.assign({}, verb_default.afterWords, noun_default.afterWords, {})
};
var actor_verb_default = clue;

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/_adj.js
var jj = "Adjective";
var adj_default = {
  beforeTags: {
    Determiner: jj,
    //the detailed
    // Copula: jj, //is detailed
    Possessive: jj,
    //spencer's detailed
    Hyphenated: jj
    //rapidly-changing
  },
  afterTags: {
    // Noun: jj, //detailed plan, overwhelming evidence
    Adjective: jj
    //intoxicated little
  },
  beforeWords: {
    seem: jj,
    //seem prepared
    seemed: jj,
    seems: jj,
    feel: jj,
    //feel prepared
    feels: jj,
    felt: jj,
    stay: jj,
    appear: jj,
    appears: jj,
    appeared: jj,
    also: jj,
    over: jj,
    //over cooked
    under: jj,
    too: jj,
    //too insulting
    it: jj,
    //find it insulting
    but: jj,
    //nothing but frustrating
    still: jj,
    //still scared
    // adverbs that are adjective-ish
    really: jj,
    //really damaged
    quite: jj,
    well: jj,
    very: jj,
    truly: jj,
    how: jj,
    //how slow
    deeply: jj,
    hella: jj,
    // always: jj,
    // never: jj,
    profoundly: jj,
    extremely: jj,
    so: jj,
    badly: jj,
    mostly: jj,
    totally: jj,
    awfully: jj,
    rather: jj,
    nothing: jj,
    //nothing secret,
    something: jj,
    //something wrong
    anything: jj,
    not: jj,
    //not swell
    me: jj,
    //called me swell
    is: jj,
    face: jj,
    //faces shocking revelations
    faces: jj,
    faced: jj,
    look: jj,
    looks: jj,
    looked: jj,
    reveal: jj,
    reveals: jj,
    revealed: jj,
    sound: jj,
    sounded: jj,
    sounds: jj,
    remains: jj,
    remained: jj,
    prove: jj,
    //would prove shocking
    proves: jj,
    proved: jj,
    becomes: jj,
    stays: jj,
    tastes: jj,
    taste: jj,
    smells: jj,
    smell: jj,
    gets: jj,
    //gets shocking snowfall
    grows: jj,
    as: jj,
    rings: jj,
    radiates: jj,
    conveys: jj,
    convey: jj,
    conveyed: jj,
    of: jj
    // 'smacks of': jj,
    // 'reeks of': jj,
  },
  afterWords: {
    too: jj,
    //insulting too
    also: jj,
    //insulting too
    or: jj,
    //insulting or
    enough: jj,
    //cool enough
    as: jj
    //as shocking as
    //about: jj, //cool about
  }
};

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/_gerund.js
var g2 = "Gerund";
var gerund_default = {
  beforeTags: {
    // Verb: g, // loves shocking
    Adverb: g2,
    //quickly shocking
    Preposition: g2,
    //by insulting
    Conjunction: g2
    //to insulting
  },
  afterTags: {
    Adverb: g2,
    //shocking quickly
    Possessive: g2,
    //shocking spencer's
    Person: g2,
    //telling spencer
    Pronoun: g2,
    //shocking him
    Determiner: g2,
    //shocking the
    Copula: g2,
    //shocking is
    Preposition: g2,
    //dashing by, swimming in
    Conjunction: g2,
    //insulting to
    Comparative: g2
    //growing shorter
  },
  beforeWords: {
    been: g2,
    keep: g2,
    //keep going
    continue: g2,
    //
    stop: g2,
    //
    am: g2,
    //am watching
    be: g2,
    //be timing
    me: g2,
    //got me thinking
    // action-words
    began: g2,
    start: g2,
    starts: g2,
    started: g2,
    stops: g2,
    stopped: g2,
    help: g2,
    helps: g2,
    avoid: g2,
    avoids: g2,
    love: g2,
    //love painting
    loves: g2,
    loved: g2,
    hate: g2,
    hates: g2,
    hated: g2
    // was:g,//was working
    // is:g,
    // be:g,
  },
  afterWords: {
    you: g2,
    //telling you
    me: g2,
    //
    her: g2,
    //
    him: g2,
    //
    his: g2,
    //
    them: g2,
    //
    their: g2,
    // fighting their
    it: g2,
    //dumping it
    this: g2,
    //running this
    there: g2,
    // swimming there
    on: g2,
    // landing on
    about: g2,
    // talking about
    for: g2,
    // paying for
    up: g2,
    //speeding up
    down: g2
    //
  }
};

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/adj-gerund.js
var g3 = "Gerund";
var jj2 = "Adjective";
var clue2 = {
  beforeTags: Object.assign({}, adj_default.beforeTags, gerund_default.beforeTags, {
    // Copula: jj,
    Imperative: g3,
    //recommend living in
    Infinitive: jj2,
    //say charming things
    // PresentTense: g,
    Plural: g3
    //kids cutting
  }),
  afterTags: Object.assign({}, adj_default.afterTags, gerund_default.afterTags, {
    Noun: jj2
    //shocking ignorance
    // Plural: jj, //shocking lies
  }),
  beforeWords: Object.assign({}, adj_default.beforeWords, gerund_default.beforeWords, {
    is: jj2,
    are: g3,
    //is overflowing: JJ, are overflowing : VB ??
    was: jj2,
    of: jj2,
    //of varying
    suggest: g3,
    suggests: g3,
    suggested: g3,
    recommend: g3,
    recommends: g3,
    recommended: g3,
    imagine: g3,
    imagines: g3,
    imagined: g3,
    consider: g3,
    considered: g3,
    considering: g3,
    resist: g3,
    resists: g3,
    resisted: g3,
    avoid: g3,
    avoided: g3,
    avoiding: g3,
    except: jj2,
    accept: jj2,
    assess: g3,
    explore: g3,
    fear: g3,
    fears: g3,
    appreciate: g3,
    question: g3,
    help: g3,
    embrace: g3,
    with: jj2
    //filled with daring
  }),
  afterWords: Object.assign({}, adj_default.afterWords, gerund_default.afterWords, {
    to: g3,
    not: g3,
    //trying not to car
    the: g3
    //sweeping the country
  })
};
var adj_gerund_default = clue2;

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/adj-noun.js
var misc2 = {
  beforeTags: {
    Determiner: void 0,
    //the premier university
    Cardinal: "Noun",
    //1950 convertable
    PhrasalVerb: "Adjective"
    //starts out fine
  },
  afterTags: {
    // Pronoun: 'Noun'//as an adult i
  }
};
var clue3 = {
  beforeTags: Object.assign({}, adj_default.beforeTags, noun_default.beforeTags, misc2.beforeTags),
  afterTags: Object.assign({}, adj_default.afterTags, noun_default.afterTags, misc2.afterTags),
  beforeWords: Object.assign({}, adj_default.beforeWords, noun_default.beforeWords, {
    // are representative
    are: "Adjective",
    is: "Adjective",
    was: "Adjective",
    be: "Adjective",
    // phrasals
    off: "Adjective",
    //start off fine
    out: "Adjective"
    //comes out fine
  }),
  afterWords: Object.assign({}, adj_default.afterWords, noun_default.afterWords)
};
var adj_noun_default = clue3;

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/adj-past.js
var past = "PastTense";
var jj3 = "Adjective";
var adjPast = {
  beforeTags: {
    Adverb: past,
    //quickly detailed
    Pronoun: past,
    //he detailed
    ProperNoun: past,
    //toronto closed
    Auxiliary: past,
    Noun: past
    //eye closed  -- i guess.
  },
  afterTags: {
    Possessive: past,
    //hooked him
    Pronoun: past,
    //hooked me
    Determiner: past,
    //hooked the
    Adverb: past,
    //cooked perfectly
    Comparative: past,
    //closed higher
    Date: past,
    // alleged thursday
    Gerund: past
    //left dancing
  },
  beforeWords: {
    be: past,
    //be hooked vs be embarrassed
    who: past,
    //who lost
    get: jj3,
    //get charged
    had: past,
    has: past,
    have: past,
    been: past,
    it: past,
    //it intoxicated him
    as: past,
    //as requested
    for: jj3,
    //for discounted items
    more: jj3,
    //more broken promises
    always: jj3
  },
  afterWords: {
    by: past,
    //damaged by
    back: past,
    //charged back
    out: past,
    //charged out
    in: past,
    //crowded in
    up: past,
    //heated up
    down: past,
    //hammered down
    before: past,
    //
    after: past,
    //
    for: past,
    //settled for
    the: past,
    //settled the
    with: past,
    //obsessed with
    as: past,
    //known as
    on: past,
    //focused on
    at: past,
    //recorded at
    between: past,
    //settled between
    to: past,
    //dedicated to
    into: past,
    //pumped into
    us: past,
    //charged us
    them: past,
    //charged us
    his: past,
    //shared his
    her: past,
    //
    their: past,
    //
    our: past,
    //
    me: past,
    //
    about: jj3
  }
};
var adj_past_default = {
  beforeTags: Object.assign({}, adj_default.beforeTags, adjPast.beforeTags),
  afterTags: Object.assign({}, adj_default.afterTags, adjPast.afterTags),
  beforeWords: Object.assign({}, adj_default.beforeWords, adjPast.beforeWords),
  afterWords: Object.assign({}, adj_default.afterWords, adjPast.afterWords)
};

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/adj-present.js
var misc3 = {
  afterTags: {
    Noun: "Adjective",
    //ruling party
    Conjunction: void 0
    //clean and excellent
  }
};
var clue4 = {
  beforeTags: Object.assign({}, adj_default.beforeTags, verb_default.beforeTags, {
    // always clean
    Adverb: void 0,
    Negative: void 0
  }),
  afterTags: Object.assign({}, adj_default.afterTags, verb_default.afterTags, misc3.afterTags),
  beforeWords: Object.assign({}, adj_default.beforeWords, verb_default.beforeWords, {
    // have seperate contracts
    have: void 0,
    had: void 0,
    not: void 0,
    //went wrong, got wrong
    went: "Adjective",
    goes: "Adjective",
    got: "Adjective",
    // be sure
    be: "Adjective"
  }),
  afterWords: Object.assign({}, adj_default.afterWords, verb_default.afterWords, {
    to: void 0,
    //slick to the touch
    as: "Adjective"
    //pale as
  })
};
var adj_present_default = clue4;

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/noun-gerund.js
var misc4 = {
  beforeTags: {
    Copula: "Gerund",
    PastTense: "Gerund",
    PresentTense: "Gerund",
    Infinitive: "Gerund"
  },
  afterTags: {
    Value: "Gerund"
    //maintaining 500
  },
  beforeWords: {
    are: "Gerund",
    were: "Gerund",
    be: "Gerund",
    no: "Gerund",
    without: "Gerund",
    //are you playing
    you: "Gerund",
    we: "Gerund",
    they: "Gerund",
    he: "Gerund",
    she: "Gerund",
    //stop us playing
    us: "Gerund",
    them: "Gerund"
  },
  afterWords: {
    // offering the
    the: "Gerund",
    this: "Gerund",
    that: "Gerund",
    //got me thinking
    me: "Gerund",
    us: "Gerund",
    them: "Gerund"
  }
};
var clue5 = {
  beforeTags: Object.assign({}, gerund_default.beforeTags, noun_default.beforeTags, misc4.beforeTags),
  afterTags: Object.assign({}, gerund_default.afterTags, noun_default.afterTags, misc4.afterTags),
  beforeWords: Object.assign({}, gerund_default.beforeWords, noun_default.beforeWords, misc4.beforeWords),
  afterWords: Object.assign({}, gerund_default.afterWords, noun_default.afterWords, misc4.afterWords)
};
var noun_gerund_default = clue5;

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/noun-verb.js
var nn = "Singular";
var vb = "Infinitive";
var clue6 = {
  beforeTags: Object.assign({}, verb_default.beforeTags, noun_default.beforeTags, {
    // Noun: undefined
    Adjective: nn,
    //great name
    Particle: nn
    //brought under control
  }),
  afterTags: Object.assign({}, verb_default.afterTags, noun_default.afterTags, {
    ProperNoun: vb,
    Gerund: vb,
    Adjective: vb,
    Copula: nn
  }),
  beforeWords: Object.assign({}, verb_default.beforeWords, noun_default.beforeWords, {
    // is time
    is: nn,
    was: nn,
    //balance of power
    of: nn,
    have: null
    //have cash
  }),
  afterWords: Object.assign({}, verb_default.afterWords, noun_default.afterWords, {
    // for: vb,//work for
    instead: vb,
    // that: nn,//subject that was
    // for: vb,//work for
    about: vb,
    //talk about
    his: vb,
    //shot his
    her: vb,
    //
    to: null,
    by: null,
    in: null
  })
};
var noun_verb_default = clue6;

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/_person.js
var p2 = "Person";
var person_default = {
  beforeTags: {
    Honorific: p2,
    Person: p2
    // Preposition: p, //with sue
  },
  afterTags: {
    Person: p2,
    ProperNoun: p2,
    Verb: p2
    //bob could
    // Modal:true, //bob could
    // Copula:true, //bob is
    // PresentTense:true, //bob seems
  },
  ownTags: {
    ProperNoun: p2
    //capital letter
  },
  beforeWords: {
    hi: p2,
    hey: p2,
    yo: p2,
    dear: p2,
    hello: p2
  },
  afterWords: {
    // person-usually verbs
    said: p2,
    says: p2,
    told: p2,
    tells: p2,
    feels: p2,
    felt: p2,
    seems: p2,
    thinks: p2,
    thought: p2,
    spends: p2,
    spendt: p2,
    plays: p2,
    played: p2,
    sing: p2,
    sang: p2,
    learn: p2,
    learned: p2,
    wants: p2,
    wanted: p2
    // and:true, //sue and jeff
  }
};

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/person-date.js
var m = "Month";
var p3 = "Person";
var month = {
  beforeTags: {
    Date: m,
    Value: m
  },
  afterTags: {
    Date: m,
    Value: m
  },
  beforeWords: {
    by: m,
    in: m,
    on: m,
    during: m,
    after: m,
    before: m,
    between: m,
    until: m,
    til: m,
    sometime: m,
    of: m,
    //5th of april
    this: m,
    //this april
    next: m,
    last: m,
    previous: m,
    following: m,
    with: p3
    // for: p,
  },
  afterWords: {
    sometime: m,
    in: m,
    of: m,
    until: m,
    the: m
    //june the 4th
  }
};
var person_date_default = {
  beforeTags: Object.assign({}, person_default.beforeTags, month.beforeTags),
  afterTags: Object.assign({}, person_default.afterTags, month.afterTags),
  beforeWords: Object.assign({}, person_default.beforeWords, month.beforeWords),
  afterWords: Object.assign({}, person_default.afterWords, month.afterWords)
};

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/person-noun.js
var clue7 = {
  beforeTags: Object.assign({}, noun_default.beforeTags, person_default.beforeTags),
  afterTags: Object.assign({}, noun_default.afterTags, person_default.afterTags),
  beforeWords: Object.assign({}, noun_default.beforeWords, person_default.beforeWords, { i: "Infinitive", we: "Infinitive" }),
  afterWords: Object.assign({}, noun_default.afterWords, person_default.afterWords)
};
var person_noun_default = clue7;

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/person-verb.js
var clues = {
  beforeTags: Object.assign({}, noun_default.beforeTags, person_default.beforeTags, verb_default.beforeTags),
  afterTags: Object.assign({}, noun_default.afterTags, person_default.afterTags, verb_default.afterTags),
  beforeWords: Object.assign({}, noun_default.beforeWords, person_default.beforeWords, verb_default.beforeWords),
  afterWords: Object.assign({}, noun_default.afterWords, person_default.afterWords, verb_default.afterWords)
};
var person_verb_default = clues;

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/person-place.js
var p4 = "Place";
var place = {
  beforeTags: {
    Place: p4
  },
  afterTags: {
    Place: p4,
    Abbreviation: p4
  },
  beforeWords: {
    in: p4,
    by: p4,
    near: p4,
    from: p4,
    to: p4
  },
  afterWords: {
    in: p4,
    by: p4,
    near: p4,
    from: p4,
    to: p4,
    government: p4,
    council: p4,
    region: p4,
    city: p4
  }
};
var clue8 = {
  beforeTags: Object.assign({}, place.beforeTags, person_default.beforeTags),
  afterTags: Object.assign({}, place.afterTags, person_default.afterTags),
  beforeWords: Object.assign({}, place.beforeWords, person_default.beforeWords),
  afterWords: Object.assign({}, place.afterWords, person_default.afterWords)
};
var person_place_default = clue8;

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/person-adj.js
var clues2 = {
  beforeTags: Object.assign({}, person_default.beforeTags, adj_default.beforeTags),
  afterTags: Object.assign({}, person_default.afterTags, adj_default.afterTags),
  beforeWords: Object.assign({}, person_default.beforeWords, adj_default.beforeWords),
  afterWords: Object.assign({}, person_default.afterWords, adj_default.afterWords)
};
var person_adj_default = clues2;

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/unit-noun.js
var un = "Unit";
var clues3 = {
  beforeTags: { Value: un },
  afterTags: {},
  beforeWords: {
    per: un,
    every: un,
    each: un,
    square: un,
    //square km
    cubic: un,
    sq: un,
    metric: un
    //metric ton
  },
  afterWords: {
    per: un,
    squared: un,
    cubed: un,
    long: un
    //foot long
  }
};
var unit_noun_default = clues3;

// reducer/node_modules/compromise/src/2-two/preTagger/model/clues/index.js
var clues4 = {
  "Actor|Verb": actor_verb_default,
  "Adj|Gerund": adj_gerund_default,
  "Adj|Noun": adj_noun_default,
  "Adj|Past": adj_past_default,
  "Adj|Present": adj_present_default,
  "Noun|Verb": noun_verb_default,
  "Noun|Gerund": noun_gerund_default,
  "Person|Noun": person_noun_default,
  "Person|Date": person_date_default,
  "Person|Verb": person_verb_default,
  "Person|Place": person_place_default,
  "Person|Adj": person_adj_default,
  "Unit|Noun": unit_noun_default
};
var copy = (obj, more) => {
  const res = Object.keys(obj).reduce((h2, k2) => {
    h2[k2] = obj[k2] === "Infinitive" ? "PresentTense" : "Plural";
    return h2;
  }, {});
  return Object.assign(res, more);
};
clues4["Plural|Verb"] = {
  beforeWords: copy(clues4["Noun|Verb"].beforeWords, {
    had: "Plural",
    //had tears
    have: "Plural"
  }),
  afterWords: copy(clues4["Noun|Verb"].afterWords, {
    his: "PresentTense",
    her: "PresentTense",
    its: "PresentTense",
    in: null,
    to: null,
    is: "PresentTense",
    //the way it works is
    by: "PresentTense"
    //it works by
  }),
  beforeTags: copy(clues4["Noun|Verb"].beforeTags, {
    Conjunction: "PresentTense",
    //and changes
    Noun: void 0,
    //the century demands
    ProperNoun: "PresentTense"
    //john plays
  }),
  afterTags: copy(clues4["Noun|Verb"].afterTags, {
    Gerund: "Plural",
    //ice caps disappearing
    Noun: "PresentTense",
    //changes gears
    Value: "PresentTense"
    //changes seven gears
  })
};
var clues_default = clues4;

// reducer/node_modules/compromise/src/2-two/preTagger/model/patterns/suffixes.js
var Adj = "Adjective";
var Inf = "Infinitive";
var Pres = "PresentTense";
var Sing = "Singular";
var Past = "PastTense";
var Avb = "Adverb";
var Plrl = "Plural";
var Actor = "Actor";
var Vb = "Verb";
var Noun = "Noun";
var Prop = "ProperNoun";
var Last = "LastName";
var Modal = "Modal";
var Place = "Place";
var Prt = "Participle";
var suffixes_default2 = [
  null,
  null,
  {
    //2-letter
    ea: Sing,
    ia: Noun,
    ic: Adj,
    ly: Avb,
    "'n": Vb,
    "'t": Vb
  },
  {
    //3-letter
    oed: Past,
    ued: Past,
    xed: Past,
    " so": Avb,
    "'ll": Modal,
    "'re": "Copula",
    azy: Adj,
    eer: Noun,
    end: Vb,
    ped: Past,
    ffy: Adj,
    ify: Inf,
    ing: "Gerund",
    ize: Inf,
    ibe: Inf,
    lar: Adj,
    mum: Adj,
    nes: Pres,
    nny: Adj,
    // oid: Adj,
    ous: Adj,
    que: Adj,
    ger: Noun,
    ber: Noun,
    rol: Sing,
    sis: Sing,
    ogy: Sing,
    oid: Sing,
    ian: Sing,
    zes: Pres,
    eld: Past,
    ken: Prt,
    //awoken
    ven: Prt,
    //woven
    ten: Prt,
    //brighten
    ect: Inf,
    ict: Inf,
    // ide: Inf,
    ign: Inf,
    oze: Inf,
    ful: Adj,
    bal: Adj,
    ton: Noun,
    pur: Place
  },
  {
    //4-letter
    amed: Past,
    aped: Past,
    ched: Past,
    lked: Past,
    rked: Past,
    reed: Past,
    nded: Past,
    mned: Adj,
    cted: Past,
    dged: Past,
    ield: Sing,
    akis: Last,
    cede: Inf,
    chuk: Last,
    czyk: Last,
    ects: Pres,
    iend: Sing,
    ends: Vb,
    enko: Last,
    ette: Sing,
    iary: Sing,
    wner: Sing,
    //owner
    fies: Pres,
    fore: Avb,
    gate: Inf,
    gone: Adj,
    ices: Plrl,
    ints: Plrl,
    ruct: Inf,
    ines: Plrl,
    ions: Plrl,
    ners: Plrl,
    pers: Plrl,
    lers: Plrl,
    less: Adj,
    llen: Adj,
    made: Adj,
    nsen: Last,
    oses: Pres,
    ould: Modal,
    some: Adj,
    sson: Last,
    ians: Plrl,
    // tage: Inf,
    tion: Sing,
    tage: Noun,
    ique: Sing,
    tive: Adj,
    tors: Noun,
    vice: Sing,
    lier: Sing,
    fier: Sing,
    wned: Past,
    gent: Sing,
    tist: Actor,
    pist: Actor,
    rist: Actor,
    mist: Actor,
    yist: Actor,
    vist: Actor,
    ists: Actor,
    lite: Sing,
    site: Sing,
    rite: Sing,
    mite: Sing,
    bite: Sing,
    mate: Sing,
    date: Sing,
    ndal: Sing,
    vent: Sing,
    uist: Actor,
    gist: Actor,
    note: Sing,
    cide: Sing,
    //homicide
    ence: Sing,
    //absence
    wide: Adj,
    //nationwide
    // side: Adj,//alongside
    vide: Inf,
    //provide
    ract: Inf,
    duce: Inf,
    pose: Inf,
    eive: Inf,
    lyze: Inf,
    lyse: Inf,
    iant: Adj,
    nary: Adj,
    ghty: Adj,
    uent: Adj,
    erer: Actor,
    //caterer
    bury: Place,
    dorf: Noun,
    esty: Noun,
    wych: Place,
    dale: Place,
    folk: Place,
    vale: Place,
    abad: Place,
    sham: Place,
    wick: Place,
    view: Place
  },
  {
    //5-letter
    elist: Actor,
    holic: Sing,
    phite: Sing,
    tized: Past,
    urned: Past,
    eased: Past,
    ances: Plrl,
    bound: Adj,
    ettes: Plrl,
    fully: Avb,
    ishes: Pres,
    ities: Plrl,
    marek: Last,
    nssen: Last,
    ology: Noun,
    osome: Sing,
    tment: Sing,
    ports: Plrl,
    rough: Adj,
    tches: Pres,
    tieth: "Ordinal",
    tures: Plrl,
    wards: Avb,
    where: Avb,
    archy: Noun,
    pathy: Noun,
    opoly: Noun,
    embly: Noun,
    phate: Noun,
    ndent: Sing,
    scent: Sing,
    onist: Actor,
    anist: Actor,
    alist: Actor,
    olist: Actor,
    icist: Actor,
    ounce: Inf,
    iable: Adj,
    borne: Adj,
    gnant: Adj,
    inant: Adj,
    igent: Adj,
    atory: Adj,
    // ctory: Adj,
    rient: Sing,
    dient: Sing,
    maker: Actor,
    burgh: Place,
    mouth: Place,
    ceter: Place,
    ville: Place,
    hurst: Place,
    stead: Place,
    endon: Place,
    brook: Place,
    shire: Place,
    worth: Noun,
    field: Prop,
    ridge: Place
  },
  {
    //6-letter
    auskas: Last,
    parent: Sing,
    cedent: Sing,
    ionary: Sing,
    cklist: Sing,
    brooke: Place,
    keeper: Actor,
    logist: Actor,
    teenth: "Value",
    worker: Actor,
    master: Actor,
    writer: Actor,
    brough: Place,
    cester: Place,
    ington: Place,
    cliffe: Place,
    ingham: Place
  },
  {
    //7-letter
    chester: Place,
    logists: Actor,
    opoulos: Last,
    borough: Place,
    sdottir: Last
    //swedish female
  }
];

// reducer/node_modules/compromise/src/2-two/preTagger/model/patterns/prefixes.js
var Adj2 = "Adjective";
var Noun2 = "Noun";
var Verb = "Verb";
var prefixes_default2 = [
  null,
  null,
  {
    // 2-letter
  },
  {
    // 3-letter
    neo: Noun2,
    bio: Noun2,
    // pre: Noun,
    "de-": Verb,
    "re-": Verb,
    "un-": Verb,
    "ex-": Noun2
  },
  {
    // 4-letter
    anti: Noun2,
    auto: Noun2,
    faux: Adj2,
    hexa: Noun2,
    kilo: Noun2,
    mono: Noun2,
    nano: Noun2,
    octa: Noun2,
    poly: Noun2,
    semi: Adj2,
    tele: Noun2,
    "pro-": Adj2,
    "mis-": Verb,
    "dis-": Verb,
    "pre-": Adj2
    //hmm
  },
  {
    // 5-letter
    anglo: Noun2,
    centi: Noun2,
    ethno: Noun2,
    ferro: Noun2,
    grand: Noun2,
    hepta: Noun2,
    hydro: Noun2,
    intro: Noun2,
    macro: Noun2,
    micro: Noun2,
    milli: Noun2,
    nitro: Noun2,
    penta: Noun2,
    quasi: Adj2,
    radio: Noun2,
    tetra: Noun2,
    "omni-": Adj2,
    "post-": Adj2
  },
  {
    // 6-letter
    pseudo: Adj2,
    "extra-": Adj2,
    "hyper-": Adj2,
    "inter-": Adj2,
    "intra-": Adj2,
    "deca-": Adj2
    // 'trans-': Noun,
  },
  {
    // 7-letter
    electro: Noun2
  }
];

// reducer/node_modules/compromise/src/2-two/preTagger/model/patterns/endsWith.js
var Adj3 = "Adjective";
var Inf2 = "Infinitive";
var Pres2 = "PresentTense";
var Sing2 = "Singular";
var Past2 = "PastTense";
var Adverb = "Adverb";
var Exp = "Expression";
var Actor2 = "Actor";
var Verb2 = "Verb";
var Noun3 = "Noun";
var Last2 = "LastName";
var endsWith_default = {
  a: [
    [/.[aeiou]na$/, Noun3, "tuna"],
    [/.[oau][wvl]ska$/, Last2],
    [/.[^aeiou]ica$/, Sing2, "harmonica"],
    [/^([hyj]a+)+$/, Exp, "haha"]
    //hahah
  ],
  c: [[/.[^aeiou]ic$/, Adj3]],
  d: [
    //==-ed==
    //double-consonant
    [/[aeiou](pp|ll|ss|ff|gg|tt|rr|bb|nn|mm)ed$/, Past2, "popped"],
    //double-vowel
    [/.[aeo]{2}[bdgmnprvz]ed$/, Past2, "rammed"],
    //-hed
    [/.[aeiou][sg]hed$/, Past2, "gushed"],
    //-rd
    [/.[aeiou]red$/, Past2, "hired"],
    [/.[aeiou]r?ried$/, Past2, "hurried"],
    // ard
    [/[^aeiou]ard$/, Sing2, "steward"],
    // id
    [/[aeiou][^aeiou]id$/, Adj3, ""],
    [/.[vrl]id$/, Adj3, "livid"],
    // ===== -ed ======
    //-led
    [/..led$/, Past2, "hurled"],
    //-sed
    [/.[iao]sed$/, Past2, ""],
    [/[aeiou]n?[cs]ed$/, Past2, ""],
    //-med
    [/[aeiou][rl]?[mnf]ed$/, Past2, ""],
    //-ked
    [/[aeiou][ns]?c?ked$/, Past2, "bunked"],
    //-gned
    [/[aeiou]gned$/, Past2],
    //-ged
    [/[aeiou][nl]?ged$/, Past2],
    //-ted
    [/.[tdbwxyz]ed$/, Past2],
    [/[^aeiou][aeiou][tvx]ed$/, Past2],
    //-ied
    [/.[cdflmnprstv]ied$/, Past2, "emptied"]
  ],
  e: [
    [/.[lnr]ize$/, Inf2, "antagonize"],
    [/.[^aeiou]ise$/, Inf2, "antagonise"],
    [/.[aeiou]te$/, Inf2, "bite"],
    [/.[^aeiou][ai]ble$/, Adj3, "fixable"],
    [/.[^aeiou]eable$/, Adj3, "maleable"],
    [/.[ts]ive$/, Adj3, "festive"],
    [/[a-z]-like$/, Adj3, "woman-like"]
  ],
  h: [
    [/.[^aeiouf]ish$/, Adj3, "cornish"],
    [/.v[iy]ch$/, Last2, "..ovich"],
    [/^ug?h+$/, Exp, "ughh"],
    [/^uh[ -]?oh$/, Exp, "uhoh"],
    [/[a-z]-ish$/, Adj3, "cartoon-ish"]
  ],
  i: [[/.[oau][wvl]ski$/, Last2, "polish-male"]],
  k: [
    [/^(k){2}$/, Exp, "kkkk"]
    //kkkk
  ],
  l: [
    [/.[gl]ial$/, Adj3, "familial"],
    [/.[^aeiou]ful$/, Adj3, "fitful"],
    [/.[nrtumcd]al$/, Adj3, "natal"],
    [/.[^aeiou][ei]al$/, Adj3, "familial"]
  ],
  m: [
    [/.[^aeiou]ium$/, Sing2, "magnesium"],
    [/[^aeiou]ism$/, Sing2, "schism"],
    [/^[hu]m+$/, Exp, "hmm"],
    [/^\d+ ?[ap]m$/, "Date", "3am"]
  ],
  n: [
    [/.[lsrnpb]ian$/, Adj3, "republican"],
    [/[^aeiou]ician$/, Actor2, "musician"],
    [/[aeiou][ktrp]in'$/, "Gerund", "cookin'"]
    // 'cookin', 'hootin'
  ],
  o: [
    [/^no+$/, Exp, "noooo"],
    [/^(yo)+$/, Exp, "yoo"],
    [/^wo{2,}[pt]?$/, Exp, "woop"]
    //woo
  ],
  r: [
    [/.[bdfklmst]ler$/, "Noun"],
    [/[aeiou][pns]er$/, Sing2],
    [/[^i]fer$/, Inf2],
    [/.[^aeiou][ao]pher$/, Actor2],
    [/.[lk]er$/, "Noun"],
    [/.ier$/, "Comparative"]
  ],
  t: [
    [/.[di]est$/, "Superlative"],
    [/.[icldtgrv]ent$/, Adj3],
    [/[aeiou].*ist$/, Adj3],
    [/^[a-z]et$/, Verb2]
  ],
  s: [
    [/.[^aeiou]ises$/, Pres2],
    [/.[rln]ates$/, Pres2],
    [/.[^z]ens$/, Verb2],
    [/.[lstrn]us$/, Sing2],
    [/.[aeiou]sks$/, Pres2],
    [/.[aeiou]kes$/, Pres2],
    [/[aeiou][^aeiou]is$/, Sing2],
    [/[a-z]'s$/, Noun3],
    [/^yes+$/, Exp]
    //yessss
  ],
  v: [
    [/.[^aeiou][ai][kln]ov$/, Last2]
    //east-europe
  ],
  y: [
    [/.[cts]hy$/, Adj3],
    [/.[st]ty$/, Adj3],
    [/.[tnl]ary$/, Adj3],
    [/.[oe]ry$/, Sing2],
    [/[rdntkbhs]ly$/, Adverb],
    [/.(gg|bb|zz)ly$/, Adj3],
    [/...lly$/, Adverb],
    [/.[gk]y$/, Adj3],
    [/[bszmp]{2}y$/, Adj3],
    [/.[ai]my$/, Adj3],
    [/[ea]{2}zy$/, Adj3],
    [/.[^aeiou]ity$/, Sing2]
  ]
};

// reducer/node_modules/compromise/src/2-two/preTagger/model/patterns/neighbours.js
var vb2 = "Verb";
var nn2 = "Noun";
var neighbours_default = {
  // looking at the previous word's tags:
  leftTags: [
    ["Adjective", nn2],
    ["Possessive", nn2],
    ["Determiner", nn2],
    ["Adverb", vb2],
    ["Pronoun", vb2],
    ["Value", nn2],
    ["Ordinal", nn2],
    ["Modal", vb2],
    ["Superlative", nn2],
    ["Demonym", nn2],
    ["Honorific", "Person"]
    //dr. Smith
  ],
  // looking at the previous word:
  leftWords: [
    ["i", vb2],
    ["first", nn2],
    ["it", vb2],
    ["there", vb2],
    ["not", vb2],
    ["because", nn2],
    ["if", nn2],
    ["but", nn2],
    ["who", vb2],
    ["this", nn2],
    ["his", nn2],
    ["when", nn2],
    ["you", vb2],
    ["very", "Adjective"],
    ["old", nn2],
    ["never", vb2],
    ["before", nn2],
    ["a", nn2],
    ["the", nn2],
    ["been", vb2]
  ],
  // looking at the next word's tags:
  rightTags: [
    ["Copula", nn2],
    ["PastTense", nn2],
    ["Conjunction", nn2],
    ["Modal", nn2]
  ],
  // looking at the next word:
  rightWords: [
    ["there", vb2],
    ["me", vb2],
    ["man", "Adjective"],
    // ['only', vb],
    ["him", vb2],
    ["it", vb2],
    //relaunch it
    ["were", nn2],
    ["took", nn2],
    ["himself", vb2],
    ["went", nn2],
    ["who", nn2],
    ["jr", "Person"]
  ]
};

// reducer/node_modules/compromise/src/2-two/preTagger/model/models/_data.js
var data_default2 = {
  "Comparative": {
    "fwd": "3:ser,ier\xA61er:h,t,f,l,n\xA61r:e\xA62er:ss,or,om",
    "both": "3er:ver,ear,alm\xA63ner:hin\xA63ter:lat\xA62mer:im\xA62er:ng,rm,mb\xA62ber:ib\xA62ger:ig\xA61er:w,p,k,d\xA6ier:y",
    "rev": "1:tter,yer\xA62:uer,ver,ffer,oner,eler,ller,iler,ster,cer,uler,sher,ener,gher,aner,adder,nter,eter,rter,hter,rner,fter\xA63:oser,ooler,eafer,user,airer,bler,maler,tler,eater,uger,rger,ainer,urer,ealer,icher,pler,emner,icter,nser,iser\xA64:arser,viner,ucher,rosser,somer,ndomer,moter,oother,uarer,hiter\xA65:nuiner,esser,emier\xA6ar:urther",
    "ex": "worse:bad\xA6better:good\xA64er:fair,gray,poor\xA61urther:far\xA63ter:fat,hot,wet\xA63der:mad,sad\xA63er:shy,fun\xA64der:glad\xA6:\xA64r:cute,dire,fake,fine,free,lame,late,pale,rare,ripe,rude,safe,sore,tame,wide\xA65r:eerie,stale"
  },
  "Gerund": {
    "fwd": "1:nning,tting,rring,pping,eing,mming,gging,dding,bbing,kking\xA62:eking,oling,eling,eming\xA63:velling,siting,uiting,fiting,loting,geting,ialing,celling\xA64:graming",
    "both": "1:aing,iing,fing,xing,ying,oing,hing,wing\xA62:tzing,rping,izzing,bting,mning,sping,wling,rling,wding,rbing,uping,lming,wning,mping,oning,lting,mbing,lking,fting,hting,sking,gning,pting,cking,ening,nking,iling,eping,ering,rting,rming,cting,lping,ssing,nting,nding,lding,sting,rning,rding,rking\xA63:belling,siping,toming,yaking,uaking,oaning,auling,ooping,aiding,naping,euring,tolling,uzzing,ganing,haning,ualing,halling,iasing,auding,ieting,ceting,ouling,voring,ralling,garing,joring,oaming,oaking,roring,nelling,ooring,uelling,eaming,ooding,eaping,eeting,ooting,ooming,xiting,keting,ooking,ulling,airing,oaring,biting,outing,oiting,earing,naling,oading,eeding,ouring,eaking,aiming,illing,oining,eaning,onging,ealing,aining,eading\xA64:thoming,melling,aboring,ivoting,weating,dfilling,onoring,eriting,imiting,tialling,rgining,otoring,linging,winging,lleting,louding,spelling,mpelling,heating,feating,opelling,choring,welling,ymaking,ctoring,calling,peating,iloring,laiting,utoring,uditing,mmaking,loating,iciting,waiting,mbating,voiding,otalling,nsoring,nselling,ocusing,itoring,eloping\xA65:rselling,umpeting,atrolling,treating,tselling,rpreting,pringing,ummeting,ossoming,elmaking,eselling,rediting,totyping,onmaking,rfeiting,ntrolling\xA65e:chmaking,dkeeping,severing,erouting,ecreting,ephoning,uthoring,ravening,reathing,pediting,erfering,eotyping,fringing,entoring,ombining,ompeting\xA64e:emaking,eething,twining,rruling,chuting,xciting,rseding,scoping,edoring,pinging,lunging,agining,craping,pleting,eleting,nciting,nfining,ncoding,tponing,ecoding,writing,esaling,nvening,gnoring,evoting,mpeding,rvening,dhering,mpiling,storing,nviting,ploring\xA63e:tining,nuring,saking,miring,haling,ceding,xuding,rining,nuting,laring,caring,miling,riding,hoking,piring,lading,curing,uading,noting,taping,futing,paring,hading,loding,siring,guring,vading,voking,during,niting,laning,caping,luting,muting,ruding,ciding,juring,laming,caling,hining,uoting,liding,ciling,duling,tuting,puting,cuting,coring,uiding,tiring,turing,siding,rading,enging,haping,buting,lining,taking,anging,haring,uiring,coming,mining,moting,suring,viding,luding\xA62e:tring,zling,uging,oging,gling,iging,vring,fling,lging,obing,psing,pling,ubing,cling,dling,wsing,iking,rsing,dging,kling,ysing,tling,rging,eging,nsing,uning,osing,uming,using,ibing,bling,aging,ising,asing,ating\xA62ie:rlying\xA61e:zing,uing,cing,ving",
    "rev": "ying:ie\xA61ing:se,ke,te,we,ne,re,de,pe,me,le,c,he\xA62ing:ll,ng,dd,ee,ye,oe,rg,us\xA62ning:un\xA62ging:og,ag,ug,ig,eg\xA62ming:um\xA62bing:ub,ab,eb,ob\xA63ning:lan,can,hin,pin,win\xA63ring:cur,lur,tir,tar,pur,car\xA63ing:ait,del,eel,fin,eat,oat,eem,lel,ool,ein,uin\xA63ping:rop,rap,top,uip,wap,hip,hop,lap,rip,cap\xA63ming:tem,wim,rim,kim,lim\xA63ting:mat,cut,pot,lit,lot,hat,set,pit,put\xA63ding:hed,bed,bid\xA63king:rek\xA63ling:cil,pel\xA63bing:rib\xA64ning:egin\xA64ing:isit,ruit,ilot,nsit,dget,rkel,ival,rcel\xA64ring:efer,nfer\xA64ting:rmit,mmit,ysit,dmit,emit,bmit,tfit,gret\xA64ling:evel,xcel,ivel\xA64ding:hred\xA65ing:arget,posit,rofit\xA65ring:nsfer\xA65ting:nsmit,orget,cquit\xA65ling:ancel,istil",
    "ex": "3:adding,eating,aiming,aiding,airing,outing,gassing,setting,getting,putting,cutting,winning,sitting,betting,mapping,tapping,letting,bidding,hitting,tanning,netting,popping,fitting,capping,lapping,barring,banning,vetting,topping,rotting,tipping,potting,wetting,pitting,dipping,budding,hemming,pinning,jetting,kidding,padding,podding,sipping,wedding,bedding,donning,warring,penning,gutting,cueing,wadding,petting,ripping,napping,matting,tinning,binning,dimming,hopping,mopping,nodding,panning,rapping,ridding,sinning\xA64:selling,falling,calling,waiting,editing,telling,rolling,heating,boating,hanging,beating,coating,singing,tolling,felling,polling,discing,seating,voiding,gelling,yelling,baiting,reining,ruining,seeking,spanning,stepping,knitting,emitting,slipping,quitting,dialing,omitting,clipping,shutting,skinning,abutting,flipping,trotting,cramming,fretting,suiting\xA65:bringing,treating,spelling,stalling,trolling,expelling,rivaling,wringing,deterring,singeing,befitting,refitting\xA66:enrolling,distilling,scrolling,strolling,caucusing,travelling\xA67:installing,redefining,stencilling,recharging,overeating,benefiting,unraveling,programing\xA69:reprogramming\xA6is:being\xA62e:using,aging,owing\xA63e:making,taking,coming,noting,hiring,filing,coding,citing,doping,baking,coping,hoping,lading,caring,naming,voting,riding,mining,curing,lining,ruling,typing,boring,dining,firing,hiding,piling,taping,waning,baling,boning,faring,honing,wiping,luring,timing,wading,piping,fading,biting,zoning,daring,waking,gaming,raking,ceding,tiring,coking,wining,joking,paring,gaping,poking,pining,coring,liming,toting,roping,wiring,aching\xA64e:writing,storing,eroding,framing,smoking,tasting,wasting,phoning,shaking,abiding,braking,flaking,pasting,priming,shoring,sloping,withing,hinging\xA65e:defining,refining,renaming,swathing,fringing,reciting\xA61ie:dying,tying,lying,vying\xA67e:sunbathing"
  },
  "Participle": {
    "fwd": "1:mt\xA62:llen\xA63:iven,aken\xA6:ne\xA6y:in",
    "both": "1:wn\xA62:me,aten\xA63:seen,bidden,isen\xA64:roven,asten\xA63l:pilt\xA63d:uilt\xA62e:itten\xA61im:wum\xA61eak:poken\xA61ine:hone\xA61ose:osen\xA61in:gun\xA61ake:woken\xA6ear:orn\xA6eal:olen\xA6eeze:ozen\xA6et:otten\xA6ink:unk\xA6ing:ung",
    "rev": "2:un\xA6oken:eak\xA6ought:eek\xA6oven:eave\xA61ne:o\xA61own:ly\xA61den:de\xA61in:ay\xA62t:am\xA62n:ee\xA63en:all\xA64n:rive,sake,take\xA65n:rgive",
    "ex": "2:been\xA63:seen,run\xA64:given,taken\xA65:shaken\xA62eak:broken\xA61ive:dove\xA62y:flown\xA63e:hidden,ridden\xA61eek:sought\xA61ake:woken\xA61eave:woven"
  },
  "PastTense": {
    "fwd": "1:tted,wed,gged,nned,een,rred,pped,yed,bbed,oed,dded,rd,wn,mmed\xA62:eed,nded,et,hted,st,oled,ut,emed,eled,lded,ken,rt,nked,apt,ant,eped,eked\xA63:eared,eat,eaded,nelled,ealt,eeded,ooted,eaked,eaned,eeted,mited,bid,uit,ead,uited,ealed,geted,velled,ialed,belled\xA64:ebuted,hined,comed\xA6y:ied\xA6ome:ame\xA6ear:ore\xA6ind:ound\xA6ing:ung,ang\xA6ep:pt\xA6ink:ank,unk\xA6ig:ug\xA6all:ell\xA6ee:aw\xA6ive:ave\xA6eeze:oze\xA6old:eld\xA6ave:ft\xA6ake:ook\xA6ell:old\xA6ite:ote\xA6ide:ode\xA6ine:one\xA6in:un,on\xA6eal:ole\xA6im:am\xA6ie:ay\xA6and:ood\xA61ise:rose\xA61eak:roke\xA61ing:rought\xA61ive:rove\xA61el:elt\xA61id:bade\xA61et:got\xA61y:aid\xA61it:sat\xA63e:lid\xA63d:pent",
    "both": "1:aed,fed,xed,hed\xA62:sged,xted,wled,rped,lked,kied,lmed,lped,uped,bted,rbed,rked,wned,rled,mped,fted,mned,mbed,zzed,omed,ened,cked,gned,lted,sked,ued,zed,nted,ered,rted,rmed,ced,sted,rned,ssed,rded,pted,ved,cted\xA63:cled,eined,siped,ooned,uked,ymed,jored,ouded,ioted,oaned,lged,asped,iged,mured,oided,eiled,yped,taled,moned,yled,lit,kled,oaked,gled,naled,fled,uined,oared,valled,koned,soned,aided,obed,ibed,meted,nicked,rored,micked,keted,vred,ooped,oaded,rited,aired,auled,filled,ouled,ooded,ceted,tolled,oited,bited,aped,tled,vored,dled,eamed,nsed,rsed,sited,owded,pled,sored,rged,osed,pelled,oured,psed,oated,loned,aimed,illed,eured,tred,ioned,celled,bled,wsed,ooked,oiled,itzed,iked,iased,onged,ased,ailed,uned,umed,ained,auded,nulled,ysed,eged,ised,aged,oined,ated,used,dged,doned\xA64:ntied,efited,uaked,caded,fired,roped,halled,roked,himed,culed,tared,lared,tuted,uared,routed,pited,naked,miled,houted,helled,hared,cored,caled,tired,peated,futed,ciled,called,tined,moted,filed,sided,poned,iloted,honed,lleted,huted,ruled,cured,named,preted,vaded,sured,talled,haled,peded,gined,nited,uided,ramed,feited,laked,gured,ctored,unged,pired,cuted,voked,eloped,ralled,rined,coded,icited,vided,uaded,voted,mined,sired,noted,lined,nselled,luted,jured,fided,puted,piled,pared,olored,cided,hoked,enged,tured,geoned,cotted,lamed,uiled,waited,udited,anged,luded,mired,uired,raded\xA65:modelled,izzled,eleted,umpeted,ailored,rseded,treated,eduled,ecited,rammed,eceded,atrolled,nitored,basted,twined,itialled,ncited,gnored,ploded,xcited,nrolled,namelled,plored,efeated,redited,ntrolled,nfined,pleted,llided,lcined,eathed,ibuted,lloted,dhered,cceded\xA63ad:sled\xA62aw:drew\xA62ot:hot\xA62ke:made\xA62ow:hrew,grew\xA62ose:hose\xA62d:ilt\xA62in:egan\xA61un:ran\xA61ink:hought\xA61ick:tuck\xA61ike:ruck\xA61eak:poke,nuck\xA61it:pat\xA61o:did\xA61ow:new\xA61ake:woke\xA6go:went",
    "rev": "3:rst,hed,hut,cut,set\xA64:tbid\xA65:dcast,eread,pread,erbid\xA6ought:uy,eek\xA61ied:ny,ly,dy,ry,fy,py,vy,by,ty,cy\xA61ung:ling,ting,wing\xA61pt:eep\xA61ank:rink\xA61ore:bear,wear\xA61ave:give\xA61oze:reeze\xA61ound:rind,wind\xA61ook:take,hake\xA61aw:see\xA61old:sell\xA61ote:rite\xA61ole:teal\xA61unk:tink\xA61am:wim\xA61ay:lie\xA61ood:tand\xA61eld:hold\xA62d:he,ge,re,le,leed,ne,reed,be,ye,lee,pe,we\xA62ed:dd,oy,or,ey,gg,rr,us,ew,to\xA62ame:ecome,rcome\xA62ped:ap\xA62ged:ag,og,ug,eg\xA62bed:ub,ab,ib,ob\xA62lt:neel\xA62id:pay\xA62ang:pring\xA62ove:trive\xA62med:um\xA62ode:rride\xA62at:ysit\xA63ted:mit,hat,mat,lat,pot,rot,bat\xA63ed:low,end,tow,und,ond,eem,lay,cho,dow,xit,eld,ald,uld,law,lel,eat,oll,ray,ank,fin,oam,out,how,iek,tay,haw,ait,vet,say,cay,bow\xA63d:ste,ede,ode,ete,ree,ude,ame,oke,ote,ime,ute,ade\xA63red:lur,cur,pur,car\xA63ped:hop,rop,uip,rip,lip,tep,top\xA63ded:bed,rod,kid\xA63ade:orbid\xA63led:uel\xA63ned:lan,can,kin,pan,tun\xA63med:rim,lim\xA64ted:quit,llot\xA64ed:pear,rrow,rand,lean,mand,anel,pand,reet,link,abel,evel,imit,ceed,ruit,mind,peal,veal,hool,head,pell,well,mell,uell,band,hear,weak\xA64led:nnel,qual,ebel,ivel\xA64red:nfer,efer,sfer\xA64n:sake,trew\xA64d:ntee\xA64ded:hred\xA64ned:rpin\xA65ed:light,nceal,right,ndear,arget,hread,eight,rtial,eboot\xA65d:edite,nvite\xA65ted:egret\xA65led:ravel",
    "ex": "2:been,upped\xA63:added,aged,aided,aimed,aired,bid,died,dyed,egged,erred,eyed,fit,gassed,hit,lied,owed,pent,pied,tied,used,vied,oiled,outed,banned,barred,bet,canned,cut,dipped,donned,ended,feed,inked,jarred,let,manned,mowed,netted,padded,panned,pitted,popped,potted,put,set,sewn,sowed,tanned,tipped,topped,vowed,weed,bowed,jammed,binned,dimmed,hopped,mopped,nodded,pinned,rigged,sinned,towed,vetted\xA64:ached,baked,baled,boned,bored,called,caned,cared,ceded,cited,coded,cored,cubed,cured,dared,dined,edited,exited,faked,fared,filed,fined,fired,fuelled,gamed,gelled,hired,hoped,joked,lined,mined,named,noted,piled,poked,polled,pored,pulled,reaped,roamed,rolled,ruled,seated,shed,sided,timed,tolled,toned,voted,waited,walled,waned,winged,wiped,wired,zoned,yelled,tamed,lubed,roped,faded,mired,caked,honed,banged,culled,heated,raked,welled,banded,beat,cast,cooled,cost,dealt,feared,folded,footed,handed,headed,heard,hurt,knitted,landed,leaked,leapt,linked,meant,minded,molded,neared,needed,peaked,plodded,plotted,pooled,quit,read,rooted,sealed,seeded,seeped,shipped,shunned,skimmed,slammed,sparred,stemmed,stirred,suited,thinned,twinned,swayed,winked,dialed,abutted,blotted,fretted,healed,heeded,peeled,reeled\xA65:basted,cheated,equalled,eroded,exiled,focused,opined,pleated,primed,quoted,scouted,shored,sloped,smoked,sniped,spelled,spouted,routed,staked,stored,swelled,tasted,treated,wasted,smelled,dwelled,honored,prided,quelled,eloped,scared,coveted,sweated,breaded,cleared,debuted,deterred,freaked,modeled,pleaded,rebutted,speeded\xA66:anchored,defined,endured,impaled,invited,refined,revered,strolled,cringed,recast,thrust,unfolded\xA67:authored,combined,competed,conceded,convened,excreted,extruded,redefined,restored,secreted,rescinded,welcomed\xA68:expedited,infringed\xA69:interfered,intervened,persevered\xA610:contravened\xA6eat:ate\xA6is:was\xA6go:went\xA6are:were\xA63d:bent,lent,rent,sent\xA63e:bit,fled,hid,lost\xA63ed:bled,bred\xA62ow:blew,grew\xA61uy:bought\xA62tch:caught\xA61o:did\xA61ive:dove,gave\xA62aw:drew\xA62ed:fed\xA62y:flew,laid,paid,said\xA61ight:fought\xA61et:got\xA62ve:had\xA61ang:hung\xA62ad:led\xA62ght:lit\xA62ke:made\xA62et:met\xA61un:ran\xA61ise:rose\xA61it:sat\xA61eek:sought\xA61each:taught\xA61ake:woke,took\xA61eave:wove\xA62ise:arose\xA61ear:bore,tore,wore\xA61ind:bound,found,wound\xA62eak:broke\xA62ing:brought,wrung\xA61ome:came\xA62ive:drove\xA61ig:dug\xA61all:fell\xA62el:felt\xA64et:forgot\xA61old:held\xA62ave:left\xA61ing:rang,sang\xA61ide:rode\xA61ink:sank\xA61ee:saw\xA62ine:shone\xA64e:slid\xA61ell:sold,told\xA64d:spent\xA62in:spun\xA61in:won"
  },
  "PresentTense": {
    "fwd": "1:oes\xA61ve:as",
    "both": "1:xes\xA62:zzes,ches,shes,sses\xA63:iases\xA62y:llies,plies\xA61y:cies,bies,ties,vies,nies,pies,dies,ries,fies\xA6:s",
    "rev": "1ies:ly\xA62es:us,go,do\xA63es:cho,eto",
    "ex": "2:does,goes\xA63:gasses\xA65:focuses\xA6is:are\xA63y:relies\xA62y:flies\xA62ve:has"
  },
  "Superlative": {
    "fwd": "1st:e\xA61est:l,m,f,s\xA61iest:cey\xA62est:or,ir\xA63est:ver",
    "both": "4:east\xA65:hwest\xA65lest:erful\xA64est:weet,lgar,tter,oung\xA64most:uter\xA63est:ger,der,rey,iet,ong,ear\xA63test:lat\xA63most:ner\xA62est:pt,ft,nt,ct,rt,ht\xA62test:it\xA62gest:ig\xA61est:b,k,n,p,h,d,w\xA6iest:y",
    "rev": "1:ttest,nnest,yest\xA62:sest,stest,rmest,cest,vest,lmest,olest,ilest,ulest,ssest,imest,uest\xA63:rgest,eatest,oorest,plest,allest,urest,iefest,uelest,blest,ugest,amest,yalest,ealest,illest,tlest,itest\xA64:cerest,eriest,somest,rmalest,ndomest,motest,uarest,tiffest\xA65:leverest,rangest\xA6ar:urthest\xA63ey:riciest",
    "ex": "best:good\xA6worst:bad\xA65est:great\xA64est:fast,full,fair,dull\xA63test:hot,wet,fat\xA64nest:thin\xA61urthest:far\xA63est:gay,shy,ill\xA64test:neat\xA64st:late,wide,fine,safe,cute,fake,pale,rare,rude,sore,ripe,dire\xA66st:severe"
  },
  "AdjToNoun": {
    "fwd": "1:tistic,eable,lful,sful,ting,tty\xA62:onate,rtable,geous,ced,seful,ctful\xA63:ortive,ented\xA6arity:ear\xA6y:etic\xA6fulness:begone\xA61ity:re\xA61y:tiful,gic\xA62ity:ile,imous,ilous,ime\xA62ion:ated\xA62eness:iving\xA62y:trious\xA62ation:iring\xA62tion:vant\xA63ion:ect\xA63ce:mant,mantic\xA63tion:irable\xA63y:est,estic\xA63m:mistic,listic\xA63ess:ning\xA64n:utious\xA64on:rative,native,vative,ective\xA64ce:erant",
    "both": "1:king,wing\xA62:alous,ltuous,oyful,rdous\xA63:gorous,ectable,werful,amatic\xA64:oised,usical,agical,raceful,ocused,lined,ightful\xA65ness:stful,lding,itous,nuous,ulous,otous,nable,gious,ayful,rvous,ntous,lsive,peful,entle,ciful,osive,leful,isive,ncise,reful,mious\xA65ty:ivacious\xA65ties:ubtle\xA65ce:ilient,adiant,atient\xA65cy:icient\xA65sm:gmatic\xA65on:sessive,dictive\xA65ity:pular,sonal,eative,entic\xA65sity:uminous\xA65ism:conic\xA65nce:mperate\xA65ility:mitable\xA65ment:xcited\xA65n:bitious\xA64cy:brant,etent,curate\xA64ility:erable,acable,icable,ptable\xA64ty:nacious,aive,oyal,dacious\xA64n:icious\xA64ce:vient,erent,stent,ndent,dient,quent,ident\xA64ness:adic,ound,hing,pant,sant,oing,oist,tute\xA64icity:imple\xA64ment:fined,mused\xA64ism:otic\xA64ry:dantic\xA64ity:tund,eral\xA64edness:hand\xA64on:uitive\xA64lity:pitable\xA64sm:eroic,namic\xA64sity:nerous\xA63th:arm\xA63ility:pable,bable,dable,iable\xA63cy:hant,nant,icate\xA63ness:red,hin,nse,ict,iet,ite,oud,ind,ied,rce\xA63ion:lute\xA63ity:ual,gal,volous,ial\xA63ce:sent,fensive,lant,gant,gent,lent,dant\xA63on:asive\xA63m:fist,sistic,iastic\xA63y:terious,xurious,ronic,tastic\xA63ur:amorous\xA63e:tunate\xA63ation:mined\xA63sy:rteous\xA63ty:ain\xA63ry:ave\xA63ment:azed\xA62ness:de,on,ue,rn,ur,ft,rp,pe,om,ge,rd,od,ay,ss,er,ll,oy,ap,ht,ld,ad,rt\xA62inousness:umous\xA62ity:neous,ene,id,ane\xA62cy:bate,late\xA62ation:ized\xA62ility:oble,ible\xA62y:odic\xA62e:oving,aring\xA62s:ost\xA62itude:pt\xA62dom:ee\xA62ance:uring\xA62tion:reet\xA62ion:oted\xA62sion:ending\xA62liness:an\xA62or:rdent\xA61th:ung\xA61e:uable\xA61ness:w,h,k,f\xA61ility:mble\xA61or:vent\xA61ement:ging\xA61tiquity:ncient\xA61ment:hed\xA6verty:or\xA6ength:ong\xA6eat:ot\xA6pth:ep\xA6iness:y",
    "rev": "",
    "ex": "5:forceful,humorous\xA68:charismatic\xA613:understanding\xA65ity:active\xA611ness:adventurous,inquisitive,resourceful\xA68on:aggressive,automatic,perceptive\xA67ness:amorous,fatuous,furtive,ominous,serious\xA65ness:ample,sweet\xA612ness:apprehensive,cantankerous,contemptuous,ostentatious\xA613ness:argumentative,conscientious\xA69ness:assertive,facetious,imperious,inventive,oblivious,rapacious,receptive,seditious,whimsical\xA610ness:attractive,expressive,impressive,loquacious,salubrious,thoughtful\xA63edom:boring\xA64ness:calm,fast,keen,tame\xA68ness:cheerful,gracious,specious,spurious,timorous,unctuous\xA65sity:curious\xA69ion:deliberate\xA68ion:desperate\xA66e:expensive\xA67ce:fragrant\xA63y:furious\xA69ility:ineluctable\xA66ism:mystical\xA68ity:physical,proactive,sensitive,vertical\xA65cy:pliant\xA67ity:positive\xA69ity:practical\xA612ism:professional\xA66ce:prudent\xA63ness:red\xA66cy:vagrant\xA63dom:wise"
  }
};

// reducer/node_modules/suffix-thumb/src/convert/index.js
var checkEx = function(str, ex = {}) {
  if (ex.hasOwnProperty(str)) {
    return ex[str];
  }
  return null;
};
var checkSame = function(str, same = []) {
  for (let i3 = 0; i3 < same.length; i3 += 1) {
    if (str.endsWith(same[i3])) {
      return str;
    }
  }
  return null;
};
var checkRules = function(str, fwd, both = {}) {
  fwd = fwd || {};
  let max3 = str.length - 1;
  for (let i3 = max3; i3 >= 1; i3 -= 1) {
    let size = str.length - i3;
    let suff = str.substring(size, str.length);
    if (fwd.hasOwnProperty(suff) === true) {
      return str.slice(0, size) + fwd[suff];
    }
    if (both.hasOwnProperty(suff) === true) {
      return str.slice(0, size) + both[suff];
    }
  }
  if (fwd.hasOwnProperty("")) {
    return str += fwd[""];
  }
  if (both.hasOwnProperty("")) {
    return str += both[""];
  }
  return null;
};
var convert = function(str = "", model5 = {}) {
  let out2 = checkEx(str, model5.ex);
  out2 = out2 || checkSame(str, model5.same);
  out2 = out2 || checkRules(str, model5.fwd, model5.both);
  out2 = out2 || str;
  return out2;
};
var convert_default = convert;

// reducer/node_modules/suffix-thumb/src/reverse/index.js
var flipObj = function(obj) {
  return Object.entries(obj).reduce((h2, a2) => {
    h2[a2[1]] = a2[0];
    return h2;
  }, {});
};
var reverse2 = function(model5 = {}) {
  return {
    reversed: true,
    // keep these two
    both: flipObj(model5.both),
    ex: flipObj(model5.ex),
    // swap this one in
    fwd: model5.rev || {}
  };
};
var reverse_default = reverse2;

// reducer/node_modules/suffix-thumb/src/compress/unpack.js
var prefix2 = /^([0-9]+)/;
var toObject = function(txt) {
  let obj = {};
  txt.split("\xA6").forEach((str) => {
    let [key, vals] = str.split(":");
    vals = (vals || "").split(",");
    vals.forEach((val) => {
      obj[val] = key;
    });
  });
  return obj;
};
var growObject = function(key = "", val = "") {
  val = String(val);
  let m3 = val.match(prefix2);
  if (m3 === null) {
    return val;
  }
  let num = Number(m3[1]) || 0;
  let pre = key.substring(0, num);
  let full = pre + val.replace(prefix2, "");
  return full;
};
var unpackOne = function(str) {
  let obj = toObject(str);
  return Object.keys(obj).reduce((h2, k2) => {
    h2[k2] = growObject(k2, obj[k2]);
    return h2;
  }, {});
};
var uncompress = function(model5 = {}) {
  if (typeof model5 === "string") {
    model5 = JSON.parse(model5);
  }
  model5.fwd = unpackOne(model5.fwd || "");
  model5.both = unpackOne(model5.both || "");
  model5.rev = unpackOne(model5.rev || "");
  model5.ex = unpackOne(model5.ex || "");
  return model5;
};
var unpack_default2 = uncompress;

// reducer/node_modules/compromise/src/2-two/preTagger/model/models/index.js
var fromPast = unpack_default2(data_default2.PastTense);
var fromPresent = unpack_default2(data_default2.PresentTense);
var fromGerund = unpack_default2(data_default2.Gerund);
var fromParticiple = unpack_default2(data_default2.Participle);
var toPast = reverse_default(fromPast);
var toPresent = reverse_default(fromPresent);
var toGerund = reverse_default(fromGerund);
var toParticiple = reverse_default(fromParticiple);
var toComparative = unpack_default2(data_default2.Comparative);
var toSuperlative = unpack_default2(data_default2.Superlative);
var fromComparative = reverse_default(toComparative);
var fromSuperlative = reverse_default(toSuperlative);
var adjToNoun = unpack_default2(data_default2.AdjToNoun);
var models_default = {
  fromPast,
  fromPresent,
  fromGerund,
  fromParticiple,
  toPast,
  toPresent,
  toGerund,
  toParticiple,
  // adjectives
  toComparative,
  toSuperlative,
  fromComparative,
  fromSuperlative,
  adjToNoun
};

// reducer/node_modules/compromise/src/2-two/preTagger/model/regex/regex-normal.js
var regex_normal_default = [
  //web tags
  [/^[\w.]+@[\w.]+\.[a-z]{2,3}$/, "Email"],
  [/^(https?:\/\/|www\.)+\w+\.[a-z]{2,3}/, "Url", "http.."],
  [/^[a-z0-9./].+\.(com|net|gov|org|ly|edu|info|biz|dev|ru|jp|de|in|uk|br|io|ai)/, "Url", ".com"],
  // timezones
  [/^[PMCE]ST$/, "Timezone", "EST"],
  //names
  [/^ma?c'[a-z]{3}/, "LastName", "mc'neil"],
  [/^o'[a-z]{3}/, "LastName", "o'connor"],
  [/^ma?cd[aeiou][a-z]{3}/, "LastName", "mcdonald"],
  //slang things
  [/^(lol)+[sz]$/, "Expression", "lol"],
  [/^wo{2,}a*h?$/, "Expression", "wooah"],
  [/^(hee?){2,}h?$/, "Expression", "hehe"],
  [/^(un|de|re)\\-[a-z\u00C0-\u00FF]{2}/, "Verb", "un-vite"],
  // m/h
  [/^(m|k|cm|km)\/(s|h|hr)$/, "Unit", "5 k/m"],
  // μg/g
  [/^(ug|ng|mg)\/(l|m3|ft3)$/, "Unit", "ug/L"],
  // love/hate
  [/[^:/]\/\p{Letter}/u, "SlashedTerm", "love/hate"]
];

// reducer/node_modules/compromise/src/2-two/preTagger/model/regex/regex-text.js
var regex_text_default = [
  // #coolguy
  [/^#[\p{Number}_]*\p{Letter}/u, "HashTag"],
  // can't be all numbers
  // @spencermountain
  [/^@\w{2,}$/, "AtMention"],
  // period-ones acronyms - f.b.i.
  [/^([A-Z]\.){2}[A-Z]?/i, ["Acronym", "Noun"], "F.B.I"],
  //ascii-only
  // ending-apostrophes
  [/.{3}[lkmnp]in['‘’‛‵′`´]$/, "Gerund", "chillin'"],
  [/.{4}s['‘’‛‵′`´]$/, "Possessive", "flanders'"],
  //from https://www.regextester.com/106421
  // [/^([\u00a9\u00ae\u2319-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/, 'Emoji', 'emoji-range']
  // unicode character range
  [/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u, "Emoji", "emoji-class"]
];

// reducer/node_modules/compromise/src/2-two/preTagger/model/regex/regex-numbers.js
var regex_numbers_default = [
  [/^@1?[0-9](am|pm)$/i, "Time", "3pm"],
  [/^@1?[0-9]:[0-9]{2}(am|pm)?$/i, "Time", "3:30pm"],
  [/^'[0-9]{2}$/, "Year"],
  // times
  [/^[012]?[0-9](:[0-5][0-9])(:[0-5][0-9])$/, "Time", "3:12:31"],
  [/^[012]?[0-9](:[0-5][0-9])?(:[0-5][0-9])? ?(am|pm)$/i, "Time", "1:12pm"],
  [/^[012]?[0-9](:[0-5][0-9])(:[0-5][0-9])? ?(am|pm)?$/i, "Time", "1:12:31pm"],
  //can remove?
  // iso-dates
  [/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/i, "Date", "iso-date"],
  [/^[0-9]{1,4}-[0-9]{1,2}-[0-9]{1,4}$/, "Date", "iso-dash"],
  [/^[0-9]{1,4}\/[0-9]{1,2}\/([0-9]{4}|[0-9]{2})$/, "Date", "iso-slash"],
  [/^[0-9]{1,4}\.[0-9]{1,2}\.[0-9]{1,4}$/, "Date", "iso-dot"],
  [/^[0-9]{1,4}-[a-z]{2,9}-[0-9]{1,4}$/i, "Date", "12-dec-2019"],
  // timezones
  [/^utc ?[+-]?[0-9]+$/, "Timezone", "utc-9"],
  [/^(gmt|utc)[+-][0-9]{1,2}$/i, "Timezone", "gmt-3"],
  //phone numbers
  [/^[0-9]{3}-[0-9]{4}$/, "PhoneNumber", "421-0029"],
  [/^(\+?[0-9][ -])?[0-9]{3}[ -]?[0-9]{3}-[0-9]{4}$/, "PhoneNumber", "1-800-"],
  //money
  //like $5.30
  [/^[-+]?\p{Currency_Symbol}[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?([kmb]|bn)?\+?$/u, ["Money", "Value"], "$5.30"],
  //like 5.30$
  [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?\p{Currency_Symbol}\+?$/u, ["Money", "Value"], "5.30\xA3"],
  //like
  [/^[-+]?[$£]?[0-9]([0-9,.])+(usd|eur|jpy|gbp|cad|aud|chf|cny|hkd|nzd|kr|rub)$/i, ["Money", "Value"], "$400usd"],
  //numbers
  // 50 | -50 | 3.23  | 5,999.0  | 10+
  [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?\+?$/, ["Cardinal", "NumericValue"], "5,999"],
  [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?(st|nd|rd|r?th)$/, ["Ordinal", "NumericValue"], "53rd"],
  // .73th
  [/^\.[0-9]+\+?$/, ["Cardinal", "NumericValue"], ".73th"],
  //percent
  [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?%\+?$/, ["Percent", "Cardinal", "NumericValue"], "-4%"],
  [/^\.[0-9]+%$/, ["Percent", "Cardinal", "NumericValue"], ".3%"],
  //fraction
  [/^[0-9]{1,4}\/[0-9]{1,4}(st|nd|rd|th)?s?$/, ["Fraction", "NumericValue"], "2/3rds"],
  //range
  [/^[0-9.]{1,3}[a-z]{0,2}[-–—][0-9]{1,3}[a-z]{0,2}$/, ["Value", "NumberRange"], "3-4"],
  //time-range
  [/^[0-9]{1,2}(:[0-9][0-9])?(am|pm)? ?[-–—] ?[0-9]{1,2}(:[0-9][0-9])?(am|pm)$/, ["Time", "NumberRange"], "3-4pm"],
  //number with unit
  [/^[0-9.]+([a-z°]{1,4})$/, "NumericValue", "9km"]
];

// reducer/node_modules/compromise/src/2-two/preTagger/model/orgWords.js
var orgWords_default = [
  "academy",
  "administration",
  "agence",
  "agences",
  "agencies",
  "agency",
  "airlines",
  "airways",
  "army",
  "assoc",
  "associates",
  "association",
  "assurance",
  "authority",
  "autorite",
  "aviation",
  "bank",
  "banque",
  "board",
  "boys",
  "brands",
  "brewery",
  "brotherhood",
  "brothers",
  "bureau",
  "cafe",
  "co",
  "caisse",
  "capital",
  "care",
  "cathedral",
  "center",
  "centre",
  "chemicals",
  "choir",
  "chronicle",
  "church",
  "circus",
  "clinic",
  "clinique",
  "club",
  "co",
  "coalition",
  "coffee",
  "collective",
  "college",
  "commission",
  "committee",
  "communications",
  "community",
  "company",
  "comprehensive",
  "computers",
  "confederation",
  "conference",
  "conseil",
  "consulting",
  "containers",
  "corporation",
  "corps",
  "corp",
  "council",
  "crew",
  "data",
  "departement",
  "department",
  "departments",
  "design",
  "development",
  "directorate",
  "division",
  "drilling",
  "education",
  "eglise",
  "electric",
  "electricity",
  "energy",
  "ensemble",
  "enterprise",
  "enterprises",
  "entertainment",
  "estate",
  "etat",
  "faculty",
  "faction",
  "federation",
  "financial",
  "fm",
  "foundation",
  "fund",
  "gas",
  "gazette",
  "girls",
  "government",
  "group",
  "guild",
  "herald",
  "holdings",
  "hospital",
  "hotel",
  "hotels",
  "inc",
  "industries",
  "institut",
  "institute",
  "institutes",
  "insurance",
  "international",
  "interstate",
  "investment",
  "investments",
  "investors",
  "journal",
  "laboratory",
  "labs",
  "llc",
  "ltd",
  "limited",
  "machines",
  "magazine",
  "management",
  "marine",
  "marketing",
  "markets",
  "media",
  "memorial",
  "ministere",
  "ministry",
  "military",
  "mobile",
  "motor",
  "motors",
  "musee",
  "museum",
  "news",
  "observatory",
  "office",
  "oil",
  "optical",
  "orchestra",
  "organization",
  "partners",
  "partnership",
  "petrol",
  "petroleum",
  "pharmacare",
  "pharmaceutical",
  "pharmaceuticals",
  "pizza",
  "plc",
  "police",
  "politburo",
  "polytechnic",
  "post",
  "power",
  "press",
  "productions",
  "quartet",
  "radio",
  "reserve",
  "resources",
  "restaurant",
  "restaurants",
  "savings",
  "school",
  "securities",
  "service",
  "services",
  "societe",
  "subsidiary",
  "society",
  "sons",
  // 'standard',
  "subcommittee",
  "syndicat",
  "systems",
  "telecommunications",
  "telegraph",
  "television",
  "times",
  "tribunal",
  "tv",
  "union",
  "university",
  "utilities",
  "workers"
].reduce((h2, str) => {
  h2[str] = true;
  return h2;
}, {});

// reducer/node_modules/compromise/src/2-two/preTagger/model/placeWords.js
var placeWords_default = [
  // geology
  "atoll",
  "basin",
  "bay",
  "beach",
  "bluff",
  "bog",
  "camp",
  "canyon",
  "canyons",
  "cape",
  "cave",
  "caves",
  // 'cliff',
  "cliffs",
  "coast",
  "cove",
  "coves",
  "crater",
  "crossing",
  "creek",
  "desert",
  "dune",
  "dunes",
  "downs",
  "estates",
  "escarpment",
  "estuary",
  "falls",
  "fjord",
  "fjords",
  "forest",
  "forests",
  "glacier",
  "gorge",
  "gorges",
  "grove",
  "gulf",
  "gully",
  "highland",
  "heights",
  "hollow",
  "hill",
  "hills",
  "inlet",
  "island",
  "islands",
  "isthmus",
  "junction",
  "knoll",
  "lagoon",
  "lake",
  "lakeshore",
  "marsh",
  "marshes",
  "mount",
  "mountain",
  "mountains",
  "narrows",
  "peninsula",
  "plains",
  "plateau",
  "pond",
  "rapids",
  "ravine",
  "reef",
  "reefs",
  "ridge",
  // 'river delta',
  "river",
  "rivers",
  "sandhill",
  "shoal",
  "shore",
  "shoreline",
  "shores",
  "strait",
  "straits",
  "springs",
  "stream",
  "swamp",
  "tombolo",
  "trail",
  "trails",
  "trench",
  "valley",
  "vallies",
  "village",
  "volcano",
  "waterfall",
  "watershed",
  "wetland",
  "woods",
  "acres",
  // districts
  "burough",
  "county",
  "district",
  "municipality",
  "prefecture",
  "province",
  "region",
  "reservation",
  "state",
  "territory",
  "borough",
  "metropolis",
  "downtown",
  "uptown",
  "midtown",
  "city",
  "town",
  "township",
  "hamlet",
  "country",
  "kingdom",
  "enclave",
  "neighbourhood",
  "neighborhood",
  "kingdom",
  "ward",
  "zone",
  // 'range',
  //building/ complex
  "airport",
  "amphitheater",
  "arch",
  "arena",
  "auditorium",
  "bar",
  "barn",
  "basilica",
  "battlefield",
  "bridge",
  "building",
  "castle",
  "centre",
  "coliseum",
  "cineplex",
  "complex",
  "dam",
  "farm",
  "field",
  "fort",
  "garden",
  "gardens",
  // 'grounds',
  "gymnasium",
  "hall",
  "house",
  "levee",
  "library",
  "manor",
  "memorial",
  "monument",
  "museum",
  "gallery",
  "palace",
  "pillar",
  "pits",
  // 'pit',
  // 'place',
  // 'point',
  // 'room',
  "plantation",
  "playhouse",
  "quarry",
  // 'ruins',
  "sportsfield",
  "sportsplex",
  "stadium",
  // 'statue',
  "terrace",
  "terraces",
  "theater",
  "tower",
  "park",
  "parks",
  "site",
  "ranch",
  "raceway",
  "sportsplex",
  // 'sports centre',
  // 'sports field',
  // 'soccer complex',
  // 'soccer centre',
  // 'sports complex',
  // 'civic centre',
  // roads
  "ave",
  "st",
  "street",
  "rd",
  "road",
  "lane",
  "landing",
  "crescent",
  "cr",
  "way",
  "tr",
  "terrace",
  "avenue"
].reduce((h2, str) => {
  h2[str] = true;
  return h2;
}, {});

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/nouns/toSingular/_rules.js
var rules_default2 = [
  [/([^v])ies$/i, "$1y"],
  [/(ise)s$/i, "$1"],
  //promises
  [/(kn|[^o]l|w)ives$/i, "$1ife"],
  [/^((?:ca|e|ha|(?:our|them|your)?se|she|wo)l|lea|loa|shea|thie)ves$/i, "$1f"],
  [/^(dwar|handkerchie|hoo|scar|whar)ves$/i, "$1f"],
  [/(antenn|formul|nebul|vertebr|vit)ae$/i, "$1a"],
  [/(octop|vir|radi|nucle|fung|cact|stimul)(i)$/i, "$1us"],
  [/(buffal|tomat|tornad)(oes)$/i, "$1o"],
  [/(ause)s$/i, "$1"],
  //causes
  [/(ease)s$/i, "$1"],
  //diseases
  [/(ious)es$/i, "$1"],
  //geniouses
  [/(ouse)s$/i, "$1"],
  //houses
  [/(ose)s$/i, "$1"],
  //roses
  [/(..ase)s$/i, "$1"],
  [/(..[aeiu]s)es$/i, "$1"],
  [/(vert|ind|cort)(ices)$/i, "$1ex"],
  [/(matr|append)(ices)$/i, "$1ix"],
  [/([xo]|ch|ss|sh)es$/i, "$1"],
  [/men$/i, "man"],
  [/(n)ews$/i, "$1ews"],
  [/([ti])a$/i, "$1um"],
  [/([^aeiouy]|qu)ies$/i, "$1y"],
  [/(s)eries$/i, "$1eries"],
  [/(m)ovies$/i, "$1ovie"],
  [/(cris|ax|test)es$/i, "$1is"],
  [/(alias|status)es$/i, "$1"],
  [/(ss)$/i, "$1"],
  [/(ic)s$/i, "$1"],
  [/s$/i, ""]
];

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/nouns/toSingular/index.js
var invertObj = function(obj) {
  return Object.keys(obj).reduce((h2, k2) => {
    h2[obj[k2]] = k2;
    return h2;
  }, {});
};
var toSingular = function(str, model5) {
  const { irregularPlurals } = model5.two;
  const invert = invertObj(irregularPlurals);
  if (invert.hasOwnProperty(str)) {
    return invert[str];
  }
  for (let i3 = 0; i3 < rules_default2.length; i3++) {
    if (rules_default2[i3][0].test(str) === true) {
      str = str.replace(rules_default2[i3][0], rules_default2[i3][1]);
      return str;
    }
  }
  return str;
};
var toSingular_default = toSingular;

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/nouns/index.js
var all = function(str, model5) {
  const arr = [str];
  const p5 = toPlural_default(str, model5);
  if (p5 !== str) {
    arr.push(p5);
  }
  const s3 = toSingular_default(str, model5);
  if (s3 !== str) {
    arr.push(s3);
  }
  return arr;
};
var nouns_default2 = { toPlural: toPlural_default, toSingular: toSingular_default, all };

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/verbs/getTense/_guess.js
var guessVerb = {
  Gerund: ["ing"],
  Actor: ["erer"],
  Infinitive: [
    "ate",
    "ize",
    "tion",
    "rify",
    "then",
    "ress",
    "ify",
    "age",
    "nce",
    "ect",
    "ise",
    "ine",
    "ish",
    "ace",
    "ash",
    "ure",
    "tch",
    "end",
    "ack",
    "and",
    "ute",
    "ade",
    "ock",
    "ite",
    "ase",
    "ose",
    "use",
    "ive",
    "int",
    "nge",
    "lay",
    "est",
    "ain",
    "ant",
    "ent",
    "eed",
    "er",
    "le",
    "unk",
    "ung",
    "upt",
    "en"
  ],
  PastTense: ["ept", "ed", "lt", "nt", "ew", "ld"],
  PresentTense: [
    "rks",
    "cks",
    "nks",
    "ngs",
    "mps",
    "tes",
    "zes",
    "ers",
    "les",
    "acks",
    "ends",
    "ands",
    "ocks",
    "lays",
    "eads",
    "lls",
    "els",
    "ils",
    "ows",
    "nds",
    "ays",
    "ams",
    "ars",
    "ops",
    "ffs",
    "als",
    "urs",
    "lds",
    "ews",
    "ips",
    "es",
    "ts",
    "ns"
  ],
  Participle: ["ken", "wn"]
};
guessVerb = Object.keys(guessVerb).reduce((h2, k2) => {
  guessVerb[k2].forEach((a2) => h2[a2] = k2);
  return h2;
}, {});
var guess_default = guessVerb;

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/verbs/getTense/index.js
var getTense = function(str) {
  const three = str.substring(str.length - 3);
  if (guess_default.hasOwnProperty(three) === true) {
    return guess_default[three];
  }
  const two = str.substring(str.length - 2);
  if (guess_default.hasOwnProperty(two) === true) {
    return guess_default[two];
  }
  const one = str.substring(str.length - 1);
  if (one === "s") {
    return "PresentTense";
  }
  return null;
};
var getTense_default = getTense;

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/verbs/toInfinitive/index.js
var toParts = function(str, model5) {
  let prefix5 = "";
  let prefixes2 = {};
  if (model5.one && model5.one.prefixes) {
    prefixes2 = model5.one.prefixes;
  }
  let [verb, particle] = str.split(/ /);
  if (particle && prefixes2[verb] === true) {
    prefix5 = verb;
    verb = particle;
    particle = "";
  }
  return {
    prefix: prefix5,
    verb,
    particle
  };
};
var copulaMap = {
  are: "be",
  were: "be",
  been: "be",
  is: "be",
  am: "be",
  was: "be",
  be: "be",
  being: "be"
};
var toInfinitive = function(str, model5, tense) {
  const { fromPast: fromPast2, fromPresent: fromPresent2, fromGerund: fromGerund2, fromParticiple: fromParticiple2 } = model5.two.models;
  const { prefix: prefix5, verb, particle } = toParts(str, model5);
  let inf = "";
  if (!tense) {
    tense = getTense_default(str);
  }
  if (copulaMap.hasOwnProperty(str)) {
    inf = copulaMap[str];
  } else if (tense === "Participle") {
    inf = convert_default(verb, fromParticiple2);
  } else if (tense === "PastTense") {
    inf = convert_default(verb, fromPast2);
  } else if (tense === "PresentTense") {
    inf = convert_default(verb, fromPresent2);
  } else if (tense === "Gerund") {
    inf = convert_default(verb, fromGerund2);
  } else {
    return str;
  }
  if (particle) {
    inf += " " + particle;
  }
  if (prefix5) {
    inf = prefix5 + " " + inf;
  }
  return inf;
};
var toInfinitive_default = toInfinitive;

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/verbs/conjugate/index.js
var parse3 = (inf) => {
  if (/ /.test(inf)) {
    return inf.split(/ /);
  }
  return [inf, ""];
};
var conjugate = function(inf, model5) {
  const { toPast: toPast5, toPresent: toPresent4, toGerund: toGerund4, toParticiple: toParticiple2 } = model5.two.models;
  if (inf === "be") {
    return {
      Infinitive: inf,
      Gerund: "being",
      PastTense: "was",
      PresentTense: "is"
    };
  }
  const [str, particle] = parse3(inf);
  const found = {
    Infinitive: str,
    PastTense: convert_default(str, toPast5),
    PresentTense: convert_default(str, toPresent4),
    Gerund: convert_default(str, toGerund4),
    FutureTense: "will " + str
  };
  let pastPrt = convert_default(str, toParticiple2);
  if (pastPrt !== inf && pastPrt !== found.PastTense) {
    const lex = model5.one.lexicon || {};
    if (lex[pastPrt] === "Participle" || lex[pastPrt] === "Adjective") {
      if (inf === "play") {
        pastPrt = "played";
      }
      found.Participle = pastPrt;
    }
  }
  if (particle) {
    Object.keys(found).forEach((k2) => {
      found[k2] += " " + particle;
    });
  }
  return found;
};
var conjugate_default = conjugate;

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/verbs/index.js
var all2 = function(str, model5) {
  const res = conjugate_default(str, model5);
  delete res.FutureTense;
  return Object.values(res).filter((s3) => s3);
};
var verbs_default = {
  toInfinitive: toInfinitive_default,
  conjugate: conjugate_default,
  all: all2
};

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/adjectives/inflect.js
var toSuperlative2 = function(adj, model5) {
  const mod = model5.two.models.toSuperlative;
  return convert_default(adj, mod);
};
var toComparative2 = function(adj, model5) {
  const mod = model5.two.models.toComparative;
  return convert_default(adj, mod);
};
var fromComparative2 = function(adj, model5) {
  const mod = model5.two.models.fromComparative;
  return convert_default(adj, mod);
};
var fromSuperlative2 = function(adj, model5) {
  const mod = model5.two.models.fromSuperlative;
  return convert_default(adj, mod);
};
var toNoun = function(adj, model5) {
  const mod = model5.two.models.adjToNoun;
  return convert_default(adj, mod);
};

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/adjectives/conjugate/lib.js
var suffixLoop = function(str = "", suffixes5 = []) {
  const len = str.length;
  const max3 = len <= 6 ? len - 1 : 6;
  for (let i3 = max3; i3 >= 1; i3 -= 1) {
    const suffix = str.substring(len - i3, str.length);
    if (suffixes5[suffix.length].hasOwnProperty(suffix) === true) {
      const pre = str.slice(0, len - i3);
      const post = suffixes5[suffix.length][suffix];
      return pre + post;
    }
  }
  return null;
};
var lib_default6 = suffixLoop;

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/adjectives/conjugate/fromAdverb.js
var s2 = "ically";
var ical = /* @__PURE__ */ new Set([
  "analyt" + s2,
  //analytical
  "chem" + s2,
  // chemical
  "class" + s2,
  //classical
  "clin" + s2,
  // clinical
  "crit" + s2,
  // critical
  "ecolog" + s2,
  // ecological
  "electr" + s2,
  // electrical
  "empir" + s2,
  // empirical
  "frant" + s2,
  // frantical
  "grammat" + s2,
  // grammatical
  "ident" + s2,
  // identical
  "ideolog" + s2,
  // ideological
  "log" + s2,
  // logical
  "mag" + s2,
  //magical
  "mathemat" + s2,
  // mathematical
  "mechan" + s2,
  // mechanical
  "med" + s2,
  // medical
  "method" + s2,
  // methodical
  "method" + s2,
  // methodical
  "mus" + s2,
  // musical
  "phys" + s2,
  // physical
  "phys" + s2,
  // physical
  "polit" + s2,
  // political
  "pract" + s2,
  // practical
  "rad" + s2,
  //radical
  "satir" + s2,
  // satirical
  "statist" + s2,
  // statistical
  "techn" + s2,
  // technical
  "technolog" + s2,
  // technological
  "theoret" + s2,
  // theoretical
  "typ" + s2,
  // typical
  "vert" + s2,
  // vertical
  "whims" + s2
  // whimsical
]);
var suffixes2 = [
  null,
  {},
  { "ly": "" },
  {
    "ily": "y",
    "bly": "ble",
    "ply": "ple"
  },
  {
    "ally": "al",
    "rply": "rp"
  },
  {
    "ually": "ual",
    "ially": "ial",
    "cally": "cal",
    "eally": "eal",
    "rally": "ral",
    "nally": "nal",
    "mally": "mal",
    "eeply": "eep",
    "eaply": "eap"
  },
  {
    ically: "ic"
  }
];
var noAdj = /* @__PURE__ */ new Set([
  "early",
  "only",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "mostly",
  "duly",
  "unduly",
  "especially",
  "undoubtedly",
  "conversely",
  "namely",
  "exceedingly",
  "presumably",
  "accordingly",
  "overly",
  "best",
  "latter",
  "little",
  "long",
  "low"
]);
var exceptions = {
  wholly: "whole",
  fully: "full",
  truly: "true",
  gently: "gentle",
  singly: "single",
  customarily: "customary",
  idly: "idle",
  publically: "public",
  quickly: "quick",
  superbly: "superb",
  cynically: "cynical",
  well: "good"
  // -?
};
var toAdjective = function(str) {
  if (!str.endsWith("ly")) {
    return null;
  }
  if (ical.has(str)) {
    return str.replace(/ically/, "ical");
  }
  if (noAdj.has(str)) {
    return null;
  }
  if (exceptions.hasOwnProperty(str)) {
    return exceptions[str];
  }
  return lib_default6(str, suffixes2) || str;
};
var fromAdverb_default = toAdjective;

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/adjectives/conjugate/toAdverb.js
var suffixes3 = [
  null,
  {
    y: "ily"
  },
  {
    ly: "ly",
    //unchanged
    ic: "ically"
  },
  {
    ial: "ially",
    ual: "ually",
    tle: "tly",
    ble: "bly",
    ple: "ply",
    ary: "arily"
  },
  {},
  {},
  {}
];
var exceptions2 = {
  cool: "cooly",
  whole: "wholly",
  full: "fully",
  good: "well",
  idle: "idly",
  public: "publicly",
  single: "singly",
  special: "especially"
};
var toAdverb = function(str) {
  if (exceptions2.hasOwnProperty(str)) {
    return exceptions2[str];
  }
  let adv = lib_default6(str, suffixes3);
  if (!adv) {
    adv = str + "ly";
  }
  return adv;
};
var toAdverb_default = toAdverb;

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/adjectives/index.js
var all3 = function(str, model5) {
  let arr = [str];
  arr.push(toSuperlative2(str, model5));
  arr.push(toComparative2(str, model5));
  arr.push(toAdverb_default(str));
  arr = arr.filter((s3) => s3);
  arr = new Set(arr);
  return Array.from(arr);
};
var adjectives_default = {
  toSuperlative: toSuperlative2,
  toComparative: toComparative2,
  toAdverb: toAdverb_default,
  toNoun,
  fromAdverb: fromAdverb_default,
  fromSuperlative: fromSuperlative2,
  fromComparative: fromComparative2,
  all: all3
};

// reducer/node_modules/compromise/src/2-two/preTagger/methods/transform/index.js
var transform_default = {
  noun: nouns_default2,
  verb: verbs_default,
  adjective: adjectives_default
};

// reducer/node_modules/compromise/src/2-two/preTagger/methods/expand/byTag.js
var byTag_default = {
  // add plural forms of singular nouns
  Singular: (word, lex, methods17, model5) => {
    const already = model5.one.lexicon;
    const plural2 = methods17.two.transform.noun.toPlural(word, model5);
    if (!already[plural2]) {
      lex[plural2] = lex[plural2] || "Plural";
    }
  },
  // 'lawyer', 'manager' plural forms
  Actor: (word, lex, methods17, model5) => {
    const already = model5.one.lexicon;
    const plural2 = methods17.two.transform.noun.toPlural(word, model5);
    if (!already[plural2]) {
      lex[plural2] = lex[plural2] || ["Plural", "Actor"];
    }
  },
  // superlative/ comparative forms for adjectives
  Comparable: (word, lex, methods17, model5) => {
    const already = model5.one.lexicon;
    const { toSuperlative: toSuperlative3, toComparative: toComparative3 } = methods17.two.transform.adjective;
    const sup = toSuperlative3(word, model5);
    if (!already[sup]) {
      lex[sup] = lex[sup] || "Superlative";
    }
    const comp = toComparative3(word, model5);
    if (!already[comp]) {
      lex[comp] = lex[comp] || "Comparative";
    }
    lex[word] = "Adjective";
  },
  // 'german' -> 'germans'
  Demonym: (word, lex, methods17, model5) => {
    const plural2 = methods17.two.transform.noun.toPlural(word, model5);
    lex[plural2] = lex[plural2] || ["Demonym", "Plural"];
  },
  // conjugate all forms of these verbs
  Infinitive: (word, lex, methods17, model5) => {
    const already = model5.one.lexicon;
    const all4 = methods17.two.transform.verb.conjugate(word, model5);
    Object.entries(all4).forEach((a2) => {
      if (!already[a2[1]] && !lex[a2[1]] && a2[0] !== "FutureTense") {
        lex[a2[1]] = a2[0];
      }
    });
  },
  // 'walk up' should conjugate, too
  PhrasalVerb: (word, lex, methods17, model5) => {
    const already = model5.one.lexicon;
    lex[word] = ["PhrasalVerb", "Infinitive"];
    const _multi = model5.one._multiCache;
    const [inf, rest] = word.split(" ");
    if (!already[inf]) {
      lex[inf] = lex[inf] || "Infinitive";
    }
    const all4 = methods17.two.transform.verb.conjugate(inf, model5);
    delete all4.FutureTense;
    Object.entries(all4).forEach((a2) => {
      if (a2[0] === "Actor" || a2[1] === "") {
        return;
      }
      if (!lex[a2[1]] && !already[a2[1]]) {
        lex[a2[1]] = a2[0];
      }
      _multi[a2[1]] = 2;
      const str = a2[1] + " " + rest;
      lex[str] = lex[str] || [a2[0], "PhrasalVerb"];
    });
  },
  // expand 'million'
  Multiple: (word, lex) => {
    lex[word] = ["Multiple", "Cardinal"];
    lex[word + "th"] = ["Multiple", "Ordinal"];
    lex[word + "ths"] = ["Multiple", "Fraction"];
  },
  // expand number-words
  Cardinal: (word, lex) => {
    lex[word] = ["TextValue", "Cardinal"];
  },
  // 'millionth'
  Ordinal: (word, lex) => {
    lex[word] = ["TextValue", "Ordinal"];
    lex[word + "s"] = ["TextValue", "Fraction"];
  },
  // 'thames'
  Place: (word, lex) => {
    lex[word] = ["Place", "ProperNoun"];
  },
  // 'ontario'
  Region: (word, lex) => {
    lex[word] = ["Region", "ProperNoun"];
  }
};

// reducer/node_modules/compromise/src/2-two/preTagger/methods/expand/index.js
var expand3 = function(words, world2) {
  const { methods: methods17, model: model5 } = world2;
  const lex = {};
  const _multi = {};
  Object.keys(words).forEach((word) => {
    const tag = words[word];
    word = word.toLowerCase().trim();
    word = word.replace(/'s\b/, "");
    const split3 = word.split(/ /);
    if (split3.length > 1) {
      if (_multi[split3[0]] === void 0 || split3.length > _multi[split3[0]]) {
        _multi[split3[0]] = split3.length;
      }
    }
    if (byTag_default.hasOwnProperty(tag) === true) {
      byTag_default[tag](word, lex, methods17, model5);
    }
    lex[word] = lex[word] || tag;
  });
  delete lex[""];
  delete lex[null];
  delete lex[" "];
  return { lex, _multi };
};
var expand_default2 = expand3;

// reducer/node_modules/compromise/src/2-two/preTagger/methods/quickSplit.js
var splitOn = function(terms, i3) {
  const isNum = /^[0-9]+$/;
  const term = terms[i3];
  if (!term) {
    return false;
  }
  const maybeDate = /* @__PURE__ */ new Set(["may", "april", "august", "jan"]);
  if (term.normal === "like" || maybeDate.has(term.normal)) {
    return false;
  }
  if (term.tags.has("Place") || term.tags.has("Date")) {
    return false;
  }
  if (terms[i3 - 1]) {
    const lastTerm = terms[i3 - 1];
    if (lastTerm.tags.has("Date") || maybeDate.has(lastTerm.normal)) {
      return false;
    }
    if (lastTerm.tags.has("Adjective") || term.tags.has("Adjective")) {
      return false;
    }
  }
  const str = term.normal;
  if (str.length === 1 || str.length === 2 || str.length === 4) {
    if (isNum.test(str)) {
      return false;
    }
  }
  return true;
};
var quickSplit = function(document) {
  const splitHere = /[,:;]/;
  const arr = [];
  document.forEach((terms) => {
    let start2 = 0;
    terms.forEach((term, i3) => {
      if (splitHere.test(term.post) && splitOn(terms, i3 + 1)) {
        arr.push(terms.slice(start2, i3 + 1));
        start2 = i3 + 1;
      }
    });
    if (start2 < terms.length) {
      arr.push(terms.slice(start2, terms.length));
    }
  });
  return arr;
};
var quickSplit_default = quickSplit;

// reducer/node_modules/compromise/src/2-two/preTagger/methods/looksPlural.js
var isPlural = {
  e: ["mice", "louse", "antennae", "formulae", "nebulae", "vertebrae", "vitae"],
  i: ["tia", "octopi", "viri", "radii", "nuclei", "fungi", "cacti", "stimuli"],
  n: ["men"],
  t: ["feet"]
};
var exceptions3 = /* @__PURE__ */ new Set([
  // 'formulas',
  // 'umbrellas',
  // 'gorillas',
  // 'koalas',
  "israelis",
  "menus",
  "logos"
]);
var notPlural = [
  "bus",
  "mas",
  //christmas
  "was",
  // 'las',
  "ias",
  //alias
  "xas",
  "vas",
  "cis",
  //probocis
  "lis",
  "nis",
  //tennis
  "ois",
  "ris",
  "sis",
  //thesis
  "tis",
  //mantis, testis
  "xis",
  "aus",
  "cus",
  "eus",
  //nucleus
  "fus",
  //doofus
  "gus",
  //fungus
  "ius",
  //radius
  "lus",
  //stimulus
  "nus",
  "das",
  "ous",
  "pus",
  //octopus
  "rus",
  //virus
  "sus",
  //census
  "tus",
  //status,cactus
  "xus",
  "aos",
  //chaos
  "igos",
  "ados",
  //barbados
  "ogos",
  "'s",
  "ss"
];
var looksPlural = function(str) {
  if (!str || str.length <= 3) {
    return false;
  }
  if (exceptions3.has(str)) {
    return true;
  }
  const end2 = str[str.length - 1];
  if (isPlural.hasOwnProperty(end2)) {
    return isPlural[end2].find((suff) => str.endsWith(suff));
  }
  if (end2 !== "s") {
    return false;
  }
  if (notPlural.find((suff) => str.endsWith(suff))) {
    return false;
  }
  return true;
};
var looksPlural_default = looksPlural;

// reducer/node_modules/compromise/src/2-two/preTagger/methods/index.js
var methods_default9 = {
  two: {
    quickSplit: quickSplit_default,
    expandLexicon: expand_default2,
    transform: transform_default,
    looksPlural: looksPlural_default
  }
};

// reducer/node_modules/compromise/src/2-two/preTagger/model/_expand/irregulars.js
var expandIrregulars = function(model5) {
  const { irregularPlurals } = model5.two;
  const { lexicon: lexicon4 } = model5.one;
  Object.entries(irregularPlurals).forEach((a2) => {
    lexicon4[a2[0]] = lexicon4[a2[0]] || "Singular";
    lexicon4[a2[1]] = lexicon4[a2[1]] || "Plural";
  });
  return model5;
};
var irregulars_default = expandIrregulars;

// reducer/node_modules/compromise/src/2-two/preTagger/model/_expand/index.js
var tmpModel2 = {
  one: { lexicon: {} },
  two: { models: models_default }
};
var switchDefaults = {
  // 'pilot'
  "Actor|Verb": "Actor",
  //
  // 'amusing'
  "Adj|Gerund": "Adjective",
  //+conjugations
  // 'standard'
  "Adj|Noun": "Adjective",
  // 'boiled'
  "Adj|Past": "Adjective",
  //+conjugations
  // 'smooth'
  "Adj|Present": "Adjective",
  //+conjugations
  // 'box'
  "Noun|Verb": "Singular",
  //+conjugations (no-present)
  //'singing'
  "Noun|Gerund": "Gerund",
  //+conjugations
  // 'hope'
  "Person|Noun": "Noun",
  // 'April'
  "Person|Date": "Month",
  // 'rob'
  "Person|Verb": "FirstName",
  //+conjugations
  // 'victoria'
  "Person|Place": "Person",
  // 'rusty'
  "Person|Adj": "Comparative",
  // 'boxes'
  "Plural|Verb": "Plural",
  //(these are already derivative)
  // 'miles'
  "Unit|Noun": "Noun"
};
var expandLexicon = function(words, model5) {
  const world2 = { model: model5, methods: methods_default9 };
  const { lex, _multi } = methods_default9.two.expandLexicon(words, world2);
  Object.assign(model5.one.lexicon, lex);
  Object.assign(model5.one._multiCache, _multi);
  return model5;
};
var addUncountables = function(words, model5) {
  Object.keys(words).forEach((k2) => {
    if (words[k2] === "Uncountable") {
      model5.two.uncountable[k2] = true;
      words[k2] = "Uncountable";
    }
  });
  return model5;
};
var expandVerb = function(str, words, doPresent) {
  const obj = conjugate_default(str, tmpModel2);
  words[obj.PastTense] = words[obj.PastTense] || "PastTense";
  words[obj.Gerund] = words[obj.Gerund] || "Gerund";
  if (doPresent === true) {
    words[obj.PresentTense] = words[obj.PresentTense] || "PresentTense";
  }
};
var expandAdjective = function(str, words, model5) {
  const sup = toSuperlative2(str, model5);
  words[sup] = words[sup] || "Superlative";
  const comp = toComparative2(str, model5);
  words[comp] = words[comp] || "Comparative";
};
var expandNoun = function(str, words, model5) {
  const plur = toPlural_default(str, model5);
  words[plur] = words[plur] || "Plural";
};
var expandVariable = function(switchWords, model5) {
  const words = {};
  const lex = model5.one.lexicon;
  Object.keys(switchWords).forEach((w) => {
    const name = switchWords[w];
    words[w] = switchDefaults[name];
    if (name === "Noun|Verb" || name === "Person|Verb" || name === "Actor|Verb") {
      expandVerb(w, lex, false);
    }
    if (name === "Adj|Present") {
      expandVerb(w, lex, true);
      expandAdjective(w, lex, model5);
    }
    if (name === "Person|Adj") {
      expandAdjective(w, lex, model5);
    }
    if (name === "Adj|Gerund" || name === "Noun|Gerund") {
      const inf = toInfinitive_default(w, tmpModel2, "Gerund");
      if (!lex[inf]) {
        words[inf] = "Infinitive";
      }
    }
    if (name === "Noun|Gerund" || name === "Adj|Noun" || name === "Person|Noun") {
      expandNoun(w, lex, model5);
    }
    if (name === "Adj|Past") {
      const inf = toInfinitive_default(w, tmpModel2, "PastTense");
      if (!lex[inf]) {
        words[inf] = "Infinitive";
      }
    }
  });
  model5 = expandLexicon(words, model5);
  return model5;
};
var expand4 = function(model5) {
  model5 = expandLexicon(model5.one.lexicon, model5);
  model5 = addUncountables(model5.one.lexicon, model5);
  model5 = expandVariable(model5.two.switches, model5);
  model5 = irregulars_default(model5);
  return model5;
};
var expand_default3 = expand4;

// reducer/node_modules/compromise/src/2-two/preTagger/model/index.js
var model4 = {
  one: {
    _multiCache: {},
    lexicon: lexicon3,
    frozenLex: frozenLex_default
  },
  two: {
    irregularPlurals: plurals_default,
    models: models_default,
    suffixPatterns: suffixes_default2,
    prefixPatterns: prefixes_default2,
    endsWith: endsWith_default,
    neighbours: neighbours_default,
    regexNormal: regex_normal_default,
    regexText: regex_text_default,
    regexNumbers: regex_numbers_default,
    switches,
    clues: clues_default,
    uncountable: {},
    orgWords: orgWords_default,
    placeWords: placeWords_default
  }
};
model4 = expand_default3(model4);
var model_default3 = model4;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/1st-pass/01-colons.js
var byPunctuation = function(terms, i3, model5, world2) {
  const setTag2 = world2.methods.one.setTag;
  if (i3 === 0 && terms.length >= 3) {
    const hasColon = /:/;
    const post = terms[0].post;
    if (post.match(hasColon)) {
      const nextTerm = terms[1];
      if (nextTerm.tags.has("Value") || nextTerm.tags.has("Email") || nextTerm.tags.has("PhoneNumber")) {
        return;
      }
      setTag2([terms[0]], "Expression", world2, null, `2-punct-colon''`);
    }
  }
};
var colons_default = byPunctuation;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/1st-pass/02-hyphens.js
var byHyphen = function(terms, i3, model5, world2) {
  const setTag2 = world2.methods.one.setTag;
  if (terms[i3].post === "-" && terms[i3 + 1]) {
    setTag2([terms[i3], terms[i3 + 1]], "Hyphenated", world2, null, `1-punct-hyphen''`);
  }
};
var hyphens_default = byHyphen;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/2nd-pass/00-tagSwitch.js
var prefix3 = /^(under|over|mis|re|un|dis|semi)-?/;
var tagSwitch = function(terms, i3, model5) {
  const switches2 = model5.two.switches;
  const term = terms[i3];
  if (switches2.hasOwnProperty(term.normal)) {
    term.switch = switches2[term.normal];
    return;
  }
  if (prefix3.test(term.normal)) {
    const stem = term.normal.replace(prefix3, "");
    if (stem.length > 3 && switches2.hasOwnProperty(stem)) {
      term.switch = switches2[stem];
    }
  }
};
var tagSwitch_default = tagSwitch;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/_fastTag.js
var log2 = (term, tag, reason = "") => {
  const yellow = (str) => "\x1B[33m\x1B[3m" + str + "\x1B[0m";
  const i3 = (str) => "\x1B[3m" + str + "\x1B[0m";
  const word = term.text || "[" + term.implicit + "]";
  if (typeof tag !== "string" && tag.length > 2) {
    tag = tag.slice(0, 2).join(", #") + " +";
  }
  tag = typeof tag !== "string" ? tag.join(", #") : tag;
  console.log(` ${yellow(word).padEnd(24)} \x1B[32m\u2192\x1B[0m #${tag.padEnd(22)}  ${i3(reason)}`);
};
var fastTag = function(term, tag, reason) {
  if (!tag || tag.length === 0) {
    return;
  }
  if (term.frozen === true) {
    return;
  }
  const env2 = typeof process === "undefined" || !process.env ? self.env || {} : process.env;
  if (env2 && env2.DEBUG_TAGS) {
    log2(term, tag, reason);
  }
  term.tags = term.tags || /* @__PURE__ */ new Set();
  if (typeof tag === "string") {
    term.tags.add(tag);
  } else {
    tag.forEach((tg) => term.tags.add(tg));
  }
};
var fastTag_default = fastTag;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/_fillTags.js
var uncountable = [
  "Acronym",
  "Abbreviation",
  "ProperNoun",
  "Uncountable",
  "Possessive",
  "Pronoun",
  "Activity",
  "Honorific",
  "Month"
];
var setPluralSingular = function(term) {
  if (!term.tags.has("Noun") || term.tags.has("Plural") || term.tags.has("Singular")) {
    return;
  }
  if (uncountable.find((tag) => term.tags.has(tag))) {
    return;
  }
  if (looksPlural_default(term.normal)) {
    fastTag_default(term, "Plural", "3-plural-guess");
  } else {
    fastTag_default(term, "Singular", "3-singular-guess");
  }
};
var setTense = function(term) {
  const tags = term.tags;
  if (tags.has("Verb") && tags.size === 1) {
    const guess = getTense_default(term.normal);
    if (guess) {
      fastTag_default(term, guess, "3-verb-tense-guess");
    }
  }
};
var fillTags = function(terms, i3, model5) {
  const term = terms[i3];
  const tags = Array.from(term.tags);
  for (let k2 = 0; k2 < tags.length; k2 += 1) {
    if (model5.one.tagSet[tags[k2]]) {
      const toAdd = model5.one.tagSet[tags[k2]].parents;
      fastTag_default(term, toAdd, ` -inferred by #${tags[k2]}`);
    }
  }
  setPluralSingular(term);
  setTense(term, model5);
};
var fillTags_default = fillTags;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/2nd-pass/01-case.js
var titleCase2 = /^\p{Lu}[\p{Ll}'’]/u;
var hasNumber = /[0-9]/;
var notProper = ["Date", "Month", "WeekDay", "Unit", "Expression"];
var hasIVX = /[IVX]/;
var romanNumeral = /^[IVXLCDM]{2,}$/;
var romanNumValid = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
var nope = {
  li: true,
  dc: true,
  md: true,
  dm: true,
  ml: true
};
var checkCase = function(terms, i3, model5) {
  const term = terms[i3];
  term.index = term.index || [0, 0];
  const index3 = term.index[1];
  const str = term.text || "";
  if (index3 !== 0 && titleCase2.test(str) === true && hasNumber.test(str) === false) {
    if (notProper.find((tag) => term.tags.has(tag))) {
      return null;
    }
    if (term.pre.match(/["']$/)) {
      return null;
    }
    if (term.normal === "the") {
      return null;
    }
    fillTags_default(terms, i3, model5);
    if (!term.tags.has("Noun") && !term.frozen) {
      term.tags.clear();
    }
    fastTag_default(term, "ProperNoun", "2-titlecase");
    return true;
  }
  if (str.length >= 2 && romanNumeral.test(str) && hasIVX.test(str) && romanNumValid.test(str) && !nope[term.normal]) {
    fastTag_default(term, "RomanNumeral", "2-xvii");
    return true;
  }
  return null;
};
var case_default2 = checkCase;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/2nd-pass/02-suffix.js
var suffixLoop2 = function(str = "", suffixes5 = []) {
  const len = str.length;
  let max3 = 7;
  if (len <= max3) {
    max3 = len - 1;
  }
  for (let i3 = max3; i3 > 1; i3 -= 1) {
    const suffix = str.substring(len - i3, len);
    if (suffixes5[suffix.length].hasOwnProperty(suffix) === true) {
      const tag = suffixes5[suffix.length][suffix];
      return tag;
    }
  }
  return null;
};
var tagBySuffix = function(terms, i3, model5) {
  const term = terms[i3];
  if (term.tags.size === 0) {
    let tag = suffixLoop2(term.normal, model5.two.suffixPatterns);
    if (tag !== null) {
      fastTag_default(term, tag, "2-suffix");
      term.confidence = 0.7;
      return true;
    }
    if (term.implicit) {
      tag = suffixLoop2(term.implicit, model5.two.suffixPatterns);
      if (tag !== null) {
        fastTag_default(term, tag, "2-implicit-suffix");
        term.confidence = 0.7;
        return true;
      }
    }
  }
  return null;
};
var suffix_default = tagBySuffix;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/2nd-pass/03-regex.js
var hasApostrophe = /['‘’‛‵′`´]/;
var doRegs = function(str, regs) {
  for (let i3 = 0; i3 < regs.length; i3 += 1) {
    if (regs[i3][0].test(str) === true) {
      return regs[i3];
    }
  }
  return null;
};
var doEndsWith = function(str = "", byEnd3) {
  const char = str[str.length - 1];
  if (byEnd3.hasOwnProperty(char) === true) {
    const regs = byEnd3[char] || [];
    for (let r2 = 0; r2 < regs.length; r2 += 1) {
      if (regs[r2][0].test(str) === true) {
        return regs[r2];
      }
    }
  }
  return null;
};
var checkRegex = function(terms, i3, model5, world2) {
  const setTag2 = world2.methods.one.setTag;
  const { regexText, regexNormal, regexNumbers, endsWith } = model5.two;
  const term = terms[i3];
  const normal = term.machine || term.normal;
  let text = term.text;
  if (hasApostrophe.test(term.post) && !hasApostrophe.test(term.pre)) {
    text += term.post.trim();
  }
  let arr = doRegs(text, regexText) || doRegs(normal, regexNormal);
  if (!arr && /[0-9]/.test(normal)) {
    arr = doRegs(normal, regexNumbers);
  }
  if (!arr && term.tags.size === 0) {
    arr = doEndsWith(normal, endsWith);
  }
  if (arr) {
    setTag2([term], arr[1], world2, null, `2-regex-'${arr[2] || arr[0]}'`);
    term.confidence = 0.6;
    return true;
  }
  return null;
};
var regex_default = checkRegex;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/2nd-pass/04-prefix.js
var prefixLoop = function(str = "", prefixes2 = []) {
  const len = str.length;
  let max3 = 7;
  if (max3 > len - 3) {
    max3 = len - 3;
  }
  for (let i3 = max3; i3 > 2; i3 -= 1) {
    const prefix5 = str.substring(0, i3);
    if (prefixes2[prefix5.length].hasOwnProperty(prefix5) === true) {
      const tag = prefixes2[prefix5.length][prefix5];
      return tag;
    }
  }
  return null;
};
var checkPrefix = function(terms, i3, model5) {
  const term = terms[i3];
  if (term.tags.size === 0) {
    const tag = prefixLoop(term.normal, model5.two.prefixPatterns);
    if (tag !== null) {
      fastTag_default(term, tag, "2-prefix");
      term.confidence = 0.5;
      return true;
    }
  }
  return null;
};
var prefix_default = checkPrefix;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/2nd-pass/05-year.js
var min = 1400;
var max2 = 2100;
var dateWords = /* @__PURE__ */ new Set([
  "in",
  "on",
  "by",
  "until",
  "for",
  "to",
  "during",
  "throughout",
  "through",
  "within",
  "before",
  "after",
  "of",
  "this",
  "next",
  "last",
  "circa",
  "around",
  "post",
  "pre",
  "budget",
  "classic",
  "plan",
  "may"
]);
var seemsGood = function(term) {
  if (!term) {
    return false;
  }
  const str = term.normal || term.implicit;
  if (dateWords.has(str)) {
    return true;
  }
  if (term.tags.has("Date") || term.tags.has("Month") || term.tags.has("WeekDay") || term.tags.has("Year")) {
    return true;
  }
  if (term.tags.has("ProperNoun")) {
    return true;
  }
  return false;
};
var seemsOkay = function(term) {
  if (!term) {
    return false;
  }
  if (term.tags.has("Ordinal")) {
    return true;
  }
  if (term.tags.has("Cardinal") && term.normal.length < 3) {
    return true;
  }
  if (term.normal === "is" || term.normal === "was") {
    return true;
  }
  return false;
};
var seemsFine = function(term) {
  return term && (term.tags.has("Date") || term.tags.has("Month") || term.tags.has("WeekDay") || term.tags.has("Year"));
};
var tagYear = function(terms, i3) {
  const term = terms[i3];
  if (term.tags.has("NumericValue") && term.tags.has("Cardinal") && term.normal.length === 4) {
    const num = Number(term.normal);
    if (num && !isNaN(num)) {
      if (num > min && num < max2) {
        const lastTerm = terms[i3 - 1];
        const nextTerm = terms[i3 + 1];
        if (seemsGood(lastTerm) || seemsGood(nextTerm)) {
          return fastTag_default(term, "Year", "2-tagYear");
        }
        if (num >= 1920 && num < 2025) {
          if (seemsOkay(lastTerm) || seemsOkay(nextTerm)) {
            return fastTag_default(term, "Year", "2-tagYear-close");
          }
          if (seemsFine(terms[i3 - 2]) || seemsFine(terms[i3 + 2])) {
            return fastTag_default(term, "Year", "2-tagYear-far");
          }
          if (lastTerm && (lastTerm.tags.has("Determiner") || lastTerm.tags.has("Possessive"))) {
            if (nextTerm && nextTerm.tags.has("Noun") && !nextTerm.tags.has("Plural")) {
              return fastTag_default(term, "Year", "2-tagYear-noun");
            }
          }
        }
      }
    }
  }
  return null;
};
var year_default = tagYear;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/07-verb-type.js
var verbType = function(terms, i3, model5, world2) {
  const setTag2 = world2.methods.one.setTag;
  const term = terms[i3];
  const types = ["PastTense", "PresentTense", "Auxiliary", "Modal", "Particle"];
  if (term.tags.has("Verb")) {
    const type = types.find((typ) => term.tags.has(typ));
    if (!type) {
      setTag2([term], "Infinitive", world2, null, `2-verb-type''`);
    }
  }
};
var verb_type_default = verbType;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/01-acronym.js
var oneLetterAcronym2 = /^[A-Z]('s|,)?$/;
var isUpperCase = /^[A-Z-]+$/;
var upperThenS = /^[A-Z]+s$/;
var periodAcronym2 = /([A-Z]\.)+[A-Z]?,?$/;
var noPeriodAcronym2 = /[A-Z]{2,}('s|,)?$/;
var lowerCaseAcronym2 = /([a-z]\.)+[a-z]\.?$/;
var oneLetterWord = {
  I: true,
  A: true
};
var places = {
  la: true,
  ny: true,
  us: true,
  dc: true,
  gb: true
};
var isNoPeriodAcronym = function(term, model5) {
  let str = term.text;
  if (isUpperCase.test(str) === false) {
    if (str.length > 3 && upperThenS.test(str) === true) {
      str = str.replace(/s$/, "");
    } else {
      return false;
    }
  }
  if (str.length > 5) {
    return false;
  }
  if (oneLetterWord.hasOwnProperty(str)) {
    return false;
  }
  if (model5.one.lexicon.hasOwnProperty(term.normal)) {
    return false;
  }
  if (periodAcronym2.test(str) === true) {
    return true;
  }
  if (lowerCaseAcronym2.test(str) === true) {
    return true;
  }
  if (oneLetterAcronym2.test(str) === true) {
    return true;
  }
  if (noPeriodAcronym2.test(str) === true) {
    return true;
  }
  return false;
};
var isAcronym3 = function(terms, i3, model5) {
  const term = terms[i3];
  if (term.tags.has("RomanNumeral") || term.tags.has("Acronym") || term.frozen) {
    return null;
  }
  if (isNoPeriodAcronym(term, model5)) {
    term.tags.clear();
    fastTag_default(term, ["Acronym", "Noun"], "3-no-period-acronym");
    if (places[term.normal] === true) {
      fastTag_default(term, "Place", "3-place-acronym");
    }
    if (upperThenS.test(term.text) === true) {
      fastTag_default(term, "Plural", "3-plural-acronym");
    }
    return true;
  }
  if (!oneLetterWord.hasOwnProperty(term.text) && oneLetterAcronym2.test(term.text)) {
    term.tags.clear();
    fastTag_default(term, ["Acronym", "Noun"], "3-one-letter-acronym");
    return true;
  }
  if (term.tags.has("Organization") && term.text.length <= 3) {
    fastTag_default(term, "Acronym", "3-org-acronym");
    return true;
  }
  if (term.tags.has("Organization") && isUpperCase.test(term.text) && term.text.length <= 6) {
    fastTag_default(term, "Acronym", "3-titlecase-acronym");
    return true;
  }
  return null;
};
var acronym_default = isAcronym3;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/02-neighbours.js
var lookAtWord = function(term, words) {
  if (!term) {
    return null;
  }
  const found = words.find((a2) => term.normal === a2[0]);
  if (found) {
    return found[1];
  }
  return null;
};
var lookAtTag = function(term, tags) {
  if (!term) {
    return null;
  }
  const found = tags.find((a2) => term.tags.has(a2[0]));
  if (found) {
    return found[1];
  }
  return null;
};
var neighbours = function(terms, i3, model5) {
  const { leftTags, leftWords, rightWords, rightTags } = model5.two.neighbours;
  const term = terms[i3];
  if (term.tags.size === 0) {
    let tag = null;
    tag = tag || lookAtWord(terms[i3 - 1], leftWords);
    tag = tag || lookAtWord(terms[i3 + 1], rightWords);
    tag = tag || lookAtTag(terms[i3 - 1], leftTags);
    tag = tag || lookAtTag(terms[i3 + 1], rightTags);
    if (tag) {
      fastTag_default(term, tag, "3-[neighbour]");
      fillTags_default(terms, i3, model5);
      terms[i3].confidence = 0.2;
      return true;
    }
  }
  return null;
};
var neighbours_default2 = neighbours;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/03-orgWords.js
var isTitleCase3 = (str) => /^\p{Lu}[\p{Ll}'’]/u.test(str);
var isOrg = function(term, i3, yelling) {
  if (!term) {
    return false;
  }
  if (term.tags.has("FirstName") || term.tags.has("Place")) {
    return false;
  }
  if (term.tags.has("ProperNoun") || term.tags.has("Organization") || term.tags.has("Acronym")) {
    return true;
  }
  if (!yelling && isTitleCase3(term.text)) {
    if (i3 === 0) {
      return term.tags.has("Singular");
    }
    return true;
  }
  return false;
};
var tagOrgs = function(terms, i3, world2, yelling) {
  const orgWords = world2.model.two.orgWords;
  const setTag2 = world2.methods.one.setTag;
  const term = terms[i3];
  const str = term.machine || term.normal;
  if (orgWords[str] === true && isOrg(terms[i3 - 1], i3 - 1, yelling)) {
    setTag2([terms[i3]], "Organization", world2, null, "3-[org-word]");
    for (let t3 = i3; t3 >= 0; t3 -= 1) {
      if (isOrg(terms[t3], t3, yelling)) {
        setTag2([terms[t3]], "Organization", world2, null, "3-[org-word]");
      } else {
        break;
      }
    }
  }
  return null;
};
var orgWords_default2 = tagOrgs;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/04-placeWords.js
var isTitleCase4 = (str) => /^\p{Lu}[\p{Ll}'’]/u.test(str);
var isPossessive = /'s$/;
var placeCont = /* @__PURE__ */ new Set([
  "athletic",
  "city",
  "community",
  "eastern",
  "federal",
  "financial",
  "great",
  "historic",
  "historical",
  "local",
  "memorial",
  "municipal",
  "national",
  "northern",
  "provincial",
  "southern",
  "state",
  "western",
  "spring",
  "pine",
  "sunset",
  "view",
  "oak",
  "maple",
  "spruce",
  "cedar",
  "willow"
]);
var noBefore = /* @__PURE__ */ new Set(["center", "centre", "way", "range", "bar", "bridge", "field", "pit"]);
var isPlace = function(term, i3, yelling) {
  if (!term) {
    return false;
  }
  const tags = term.tags;
  if (tags.has("Organization") || tags.has("Possessive") || isPossessive.test(term.normal)) {
    return false;
  }
  if (tags.has("ProperNoun") || tags.has("Place")) {
    return true;
  }
  if (!yelling && isTitleCase4(term.text)) {
    if (i3 === 0) {
      return tags.has("Singular");
    }
    return true;
  }
  return false;
};
var tagOrgs2 = function(terms, i3, world2, yelling) {
  const placeWords = world2.model.two.placeWords;
  const setTag2 = world2.methods.one.setTag;
  const term = terms[i3];
  const str = term.machine || term.normal;
  if (placeWords[str] === true) {
    for (let n3 = i3 - 1; n3 >= 0; n3 -= 1) {
      if (placeCont.has(terms[n3].normal)) {
        continue;
      }
      if (isPlace(terms[n3], n3, yelling)) {
        setTag2(terms.slice(n3, i3 + 1), "Place", world2, null, "3-[place-of-foo]");
        continue;
      }
      break;
    }
    if (noBefore.has(str)) {
      return false;
    }
    for (let n3 = i3 + 1; n3 < terms.length; n3 += 1) {
      if (isPlace(terms[n3], n3, yelling)) {
        setTag2(terms.slice(i3, n3 + 1), "Place", world2, null, "3-[foo-place]");
        return true;
      }
      if (terms[n3].normal === "of" || placeCont.has(terms[n3].normal)) {
        continue;
      }
      break;
    }
  }
  return null;
};
var placeWords_default2 = tagOrgs2;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/05-fallback.js
var nounFallback = function(terms, i3, model5) {
  let isEmpty = false;
  const tags = terms[i3].tags;
  if (tags.size === 0) {
    isEmpty = true;
  } else if (tags.size === 1) {
    if (tags.has("Hyphenated") || tags.has("HashTag") || tags.has("Prefix") || tags.has("SlashedTerm")) {
      isEmpty = true;
    }
  }
  if (isEmpty) {
    fastTag_default(terms[i3], "Noun", "3-[fallback]");
    fillTags_default(terms, i3, model5);
    terms[i3].confidence = 0.1;
  }
};
var fallback_default = nounFallback;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/_adhoc.js
var isTitleCase5 = /^[A-Z][a-z]/;
var isCapital = (terms, i3) => {
  if (terms[i3].tags.has("ProperNoun") && isTitleCase5.test(terms[i3].text)) {
    return "Noun";
  }
  return null;
};
var isAlone = (terms, i3, tag) => {
  if (i3 === 0 && !terms[1]) {
    return tag;
  }
  return null;
};
var isEndNoun = function(terms, i3) {
  if (!terms[i3 + 1] && terms[i3 - 1] && terms[i3 - 1].tags.has("Determiner")) {
    return "Noun";
  }
  return null;
};
var isStart = function(terms, i3, tag) {
  if (i3 === 0 && terms.length > 3) {
    return tag;
  }
  return null;
};
var adhoc = {
  "Adj|Gerund": (terms, i3) => {
    return isCapital(terms, i3);
  },
  "Adj|Noun": (terms, i3) => {
    return isCapital(terms, i3) || isEndNoun(terms, i3);
  },
  "Actor|Verb": (terms, i3) => {
    return isCapital(terms, i3);
  },
  "Adj|Past": (terms, i3) => {
    return isCapital(terms, i3);
  },
  "Adj|Present": (terms, i3) => {
    return isCapital(terms, i3);
  },
  "Noun|Gerund": (terms, i3) => {
    return isCapital(terms, i3);
  },
  "Noun|Verb": (terms, i3) => {
    return i3 > 0 && isCapital(terms, i3) || isAlone(terms, i3, "Infinitive");
  },
  "Plural|Verb": (terms, i3) => {
    return isCapital(terms, i3) || isAlone(terms, i3, "PresentTense") || isStart(terms, i3, "Plural");
  },
  "Person|Noun": (terms, i3) => {
    return isCapital(terms, i3);
  },
  "Person|Verb": (terms, i3) => {
    if (i3 !== 0) {
      return isCapital(terms, i3);
    }
    return null;
  },
  "Person|Adj": (terms, i3) => {
    if (i3 === 0 && terms.length > 1) {
      return "Person";
    }
    return isCapital(terms, i3) ? "Person" : null;
  }
};
var adhoc_default = adhoc;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/06-switches.js
var env = typeof process === "undefined" || !process.env ? self.env || {} : process.env;
var prefix4 = /^(under|over|mis|re|un|dis|semi)-?/;
var checkWord = (term, obj) => {
  if (!term || !obj) {
    return null;
  }
  const str = term.normal || term.implicit;
  let found = null;
  if (obj.hasOwnProperty(str)) {
    found = obj[str];
  }
  if (found && env.DEBUG_TAGS) {
    console.log(`
  \x1B[2m\x1B[3m     \u2193 - '${str}' \x1B[0m`);
  }
  return found;
};
var checkTag = (term, obj = {}, tagSet) => {
  if (!term || !obj) {
    return null;
  }
  const tags = Array.from(term.tags).sort((a2, b) => {
    const numA = tagSet[a2] ? tagSet[a2].parents.length : 0;
    const numB = tagSet[b] ? tagSet[b].parents.length : 0;
    return numA > numB ? -1 : 1;
  });
  let found = tags.find((tag) => obj[tag]);
  if (found && env.DEBUG_TAGS) {
    console.log(`  \x1B[2m\x1B[3m      \u2193 - '${term.normal || term.implicit}' (#${found})  \x1B[0m`);
  }
  found = obj[found];
  return found;
};
var pickTag = function(terms, i3, clues5, model5) {
  if (!clues5) {
    return null;
  }
  const beforeIndex = terms[i3 - 1]?.text !== "also" ? i3 - 1 : Math.max(0, i3 - 2);
  const tagSet = model5.one.tagSet;
  let tag = checkWord(terms[i3 + 1], clues5.afterWords);
  tag = tag || checkWord(terms[beforeIndex], clues5.beforeWords);
  tag = tag || checkTag(terms[beforeIndex], clues5.beforeTags, tagSet);
  tag = tag || checkTag(terms[i3 + 1], clues5.afterTags, tagSet);
  return tag;
};
var doSwitches = function(terms, i3, world2) {
  const model5 = world2.model;
  const setTag2 = world2.methods.one.setTag;
  const { switches: switches2, clues: clues5 } = model5.two;
  const term = terms[i3];
  let str = term.normal || term.implicit || "";
  if (prefix4.test(str) && !switches2[str]) {
    str = str.replace(prefix4, "");
  }
  if (term.switch) {
    const form = term.switch;
    if (term.tags.has("Acronym") || term.tags.has("PhrasalVerb")) {
      return;
    }
    let tag = pickTag(terms, i3, clues5[form], model5);
    if (adhoc_default[form]) {
      tag = adhoc_default[form](terms, i3) || tag;
    }
    if (tag) {
      setTag2([term], tag, world2, null, `3-[switch] (${form})`);
      fillTags_default(terms, i3, model5);
    } else if (env.DEBUG_TAGS) {
      console.log(`
 -> X  - '${str}'  : (${form})  `);
    }
  }
};
var switches_default = doSwitches;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/08-imperative.js
var beside = {
  there: true,
  //go there
  this: true,
  //try this
  it: true,
  //do it
  him: true,
  her: true,
  us: true
  //tell us
};
var imperative = function(terms, world2) {
  const setTag2 = world2.methods.one.setTag;
  const multiWords = world2.model.one._multiCache || {};
  const t3 = terms[0];
  const isRight = t3.switch === "Noun|Verb" || t3.tags.has("Infinitive");
  if (isRight && terms.length >= 2) {
    if (terms.length < 4 && !beside[terms[1].normal]) {
      return;
    }
    if (!t3.tags.has("PhrasalVerb") && multiWords.hasOwnProperty(t3.normal)) {
      return;
    }
    const nextNoun = terms[1].tags.has("Noun") || terms[1].tags.has("Determiner");
    if (nextNoun) {
      const soonVerb = terms.slice(1, 3).some((term) => term.tags.has("Verb"));
      if (!soonVerb || t3.tags.has("#PhrasalVerb")) {
        setTag2([t3], "Imperative", world2, null, "3-[imperative]");
      }
    }
  }
};
var imperative_default = imperative;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/tagger/index.js
var ignoreCase = function(terms) {
  if (terms.filter((t3) => !t3.tags.has("ProperNoun")).length <= 3) {
    return false;
  }
  const lowerCase = /^[a-z]/;
  return terms.every((t3) => !lowerCase.test(t3.text));
};
var firstPass = function(docs, model5, world2) {
  docs.forEach((terms) => {
    colons_default(terms, 0, model5, world2);
  });
};
var secondPass = function(terms, model5, world2, isYelling) {
  for (let i3 = 0; i3 < terms.length; i3 += 1) {
    if (terms[i3].frozen === true) {
      continue;
    }
    tagSwitch_default(terms, i3, model5);
    if (isYelling === false) {
      case_default2(terms, i3, model5);
    }
    suffix_default(terms, i3, model5);
    regex_default(terms, i3, model5, world2);
    prefix_default(terms, i3, model5);
    year_default(terms, i3, model5);
  }
};
var thirdPass = function(terms, model5, world2, isYelling) {
  for (let i3 = 0; i3 < terms.length; i3 += 1) {
    let found = acronym_default(terms, i3, model5);
    fillTags_default(terms, i3, model5);
    found = found || neighbours_default2(terms, i3, model5);
    found = found || fallback_default(terms, i3, model5);
  }
  for (let i3 = 0; i3 < terms.length; i3 += 1) {
    if (terms[i3].frozen === true) {
      continue;
    }
    orgWords_default2(terms, i3, world2, isYelling);
    placeWords_default2(terms, i3, world2, isYelling);
    switches_default(terms, i3, world2);
    verb_type_default(terms, i3, model5, world2);
    hyphens_default(terms, i3, model5, world2);
  }
  imperative_default(terms, world2);
};
var preTagger = function(view) {
  const { methods: methods17, model: model5, world: world2 } = view;
  const docs = view.docs;
  firstPass(docs, model5, world2);
  const document = methods17.two.quickSplit(docs);
  for (let n3 = 0; n3 < document.length; n3 += 1) {
    const terms = document[n3];
    const isYelling = ignoreCase(terms);
    secondPass(terms, model5, world2, isYelling);
    thirdPass(terms, model5, world2, isYelling);
  }
  return document;
};
var tagger_default2 = preTagger;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/root.js
var toRoot = {
  // 'spencer's' -> 'spencer'
  "Possessive": (term) => {
    let str = term.machine || term.normal || term.text;
    str = str.replace(/'s$/, "");
    return str;
  },
  // 'drinks' -> 'drink'
  "Plural": (term, world2) => {
    const str = term.machine || term.normal || term.text;
    return world2.methods.two.transform.noun.toSingular(str, world2.model);
  },
  // ''
  "Copula": () => {
    return "is";
  },
  // 'walked' -> 'walk'
  "PastTense": (term, world2) => {
    const str = term.machine || term.normal || term.text;
    return world2.methods.two.transform.verb.toInfinitive(str, world2.model, "PastTense");
  },
  // 'walking' -> 'walk'
  "Gerund": (term, world2) => {
    const str = term.machine || term.normal || term.text;
    return world2.methods.two.transform.verb.toInfinitive(str, world2.model, "Gerund");
  },
  // 'walks' -> 'walk'
  "PresentTense": (term, world2) => {
    const str = term.machine || term.normal || term.text;
    if (term.tags.has("Infinitive")) {
      return str;
    }
    return world2.methods.two.transform.verb.toInfinitive(str, world2.model, "PresentTense");
  },
  // 'quieter' -> 'quiet'
  "Comparative": (term, world2) => {
    const str = term.machine || term.normal || term.text;
    return world2.methods.two.transform.adjective.fromComparative(str, world2.model);
  },
  // 'quietest' -> 'quiet'
  "Superlative": (term, world2) => {
    const str = term.machine || term.normal || term.text;
    return world2.methods.two.transform.adjective.fromSuperlative(str, world2.model);
  },
  // 'suddenly' -> 'sudden'
  "Adverb": (term, world2) => {
    const { fromAdverb } = world2.methods.two.transform.adjective;
    const str = term.machine || term.normal || term.text;
    return fromAdverb(str);
  }
};
var getRoot = function(view) {
  const world2 = view.world;
  const keys = Object.keys(toRoot);
  view.docs.forEach((terms) => {
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const term = terms[i3];
      for (let k2 = 0; k2 < keys.length; k2 += 1) {
        if (term.tags.has(keys[k2])) {
          const fn = toRoot[keys[k2]];
          const root = fn(term, world2);
          if (term.normal !== root) {
            term.root = root;
          }
          break;
        }
      }
    }
  });
};
var root_default = getRoot;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/penn.js
var mapping = {
  // adverbs
  // 'Comparative': 'RBR',
  // 'Superlative': 'RBS',
  Adverb: "RB",
  // adjectives
  Comparative: "JJR",
  Superlative: "JJS",
  Adjective: "JJ",
  TO: "Conjunction",
  // verbs
  Modal: "MD",
  Auxiliary: "MD",
  Gerund: "VBG",
  //throwing
  PastTense: "VBD",
  //threw
  Participle: "VBN",
  //thrown
  PresentTense: "VBZ",
  //throws
  Infinitive: "VB",
  //throw
  Particle: "RP",
  //phrasal particle
  Verb: "VB",
  // throw
  // pronouns
  Pronoun: "PRP",
  // misc
  Cardinal: "CD",
  Conjunction: "CC",
  Determiner: "DT",
  Preposition: "IN",
  // 'Determiner': 'WDT',
  // 'Expression': 'FW',
  QuestionWord: "WP",
  Expression: "UH",
  //nouns
  Possessive: "POS",
  ProperNoun: "NNP",
  Person: "NNP",
  Place: "NNP",
  Organization: "NNP",
  Singular: "NN",
  Plural: "NNS",
  Noun: "NN",
  There: "EX"
  //'there'
  // 'Adverb':'WRB',
  // 'Noun':'PDT', //predeterminer
  // 'Noun':'SYM', //symbol
  // 'Noun':'NFP', //
  //  WDT 	Wh-determiner
  // 	WP 	Wh-pronoun
  // 	WP$ 	Possessive wh-pronoun
  // 	WRB 	Wh-adverb
};
var toPenn = function(term) {
  if (term.tags.has("ProperNoun") && term.tags.has("Plural")) {
    return "NNPS";
  }
  if (term.tags.has("Possessive") && term.tags.has("Pronoun")) {
    return "PRP$";
  }
  if (term.normal === "there") {
    return "EX";
  }
  if (term.normal === "to") {
    return "TO";
  }
  const arr = term.tagRank || [];
  for (let i3 = 0; i3 < arr.length; i3 += 1) {
    if (mapping.hasOwnProperty(arr[i3])) {
      return mapping[arr[i3]];
    }
  }
  return null;
};
var pennTag = function(view) {
  view.compute("tagRank");
  view.docs.forEach((terms) => {
    terms.forEach((term) => {
      term.penn = toPenn(term);
    });
  });
};
var penn_default = pennTag;

// reducer/node_modules/compromise/src/2-two/preTagger/compute/index.js
var compute_default9 = { preTagger: tagger_default2, root: root_default, penn: penn_default };

// reducer/node_modules/compromise/src/2-two/preTagger/tagSet/nouns.js
var entity = ["Person", "Place", "Organization"];
var nouns_default3 = {
  Noun: {
    not: ["Verb", "Adjective", "Adverb", "Value", "Determiner"]
  },
  Singular: {
    is: "Noun",
    not: ["Plural", "Uncountable"]
  },
  // 'Canada'
  ProperNoun: {
    is: "Noun"
  },
  Person: {
    is: "Singular",
    also: ["ProperNoun"],
    not: ["Place", "Organization", "Date"]
  },
  FirstName: {
    is: "Person"
  },
  MaleName: {
    is: "FirstName",
    not: ["FemaleName", "LastName"]
  },
  FemaleName: {
    is: "FirstName",
    not: ["MaleName", "LastName"]
  },
  LastName: {
    is: "Person",
    not: ["FirstName"]
  },
  // 'dr.'
  Honorific: {
    is: "Person",
    not: ["FirstName", "LastName", "Value"]
  },
  Place: {
    is: "Singular",
    not: ["Person", "Organization"]
  },
  Country: {
    is: "Place",
    also: ["ProperNoun"],
    not: ["City"]
  },
  City: {
    is: "Place",
    also: ["ProperNoun"],
    not: ["Country"]
  },
  // 'california'
  Region: {
    is: "Place",
    also: ["ProperNoun"]
  },
  Address: {
    // is: 'Place',
  },
  Organization: {
    is: "ProperNoun",
    not: ["Person", "Place"]
  },
  SportsTeam: {
    is: "Organization"
  },
  School: {
    is: "Organization"
  },
  Company: {
    is: "Organization"
  },
  Plural: {
    is: "Noun",
    not: ["Singular", "Uncountable"]
  },
  // 'gravity'
  Uncountable: {
    is: "Noun"
  },
  // 'it'
  Pronoun: {
    is: "Noun",
    not: entity
  },
  // 'swimmer'
  Actor: {
    is: "Noun",
    not: ["Place", "Organization"]
  },
  // walking
  Activity: {
    is: "Noun",
    not: ["Person", "Place"]
  },
  // kilometres
  Unit: {
    is: "Noun",
    not: entity
  },
  // canadian
  Demonym: {
    is: "Noun",
    also: ["ProperNoun"],
    not: entity
  },
  // [spencer's] hat
  Possessive: {
    is: "Noun"
  },
  // 'yourself'
  Reflexive: {
    is: "Pronoun"
  }
};

// reducer/node_modules/compromise/src/2-two/preTagger/tagSet/verbs.js
var verbs_default2 = {
  Verb: {
    not: ["Noun", "Adjective", "Adverb", "Value", "Expression"]
  },
  // 'he [walks]'
  PresentTense: {
    is: "Verb",
    not: ["PastTense", "FutureTense"]
  },
  // 'will [walk]'
  Infinitive: {
    is: "PresentTense",
    not: ["Gerund"]
  },
  // '[walk] now!'
  Imperative: {
    is: "Verb",
    not: ["PastTense", "Gerund", "Copula"]
  },
  // walking
  Gerund: {
    is: "PresentTense",
    not: ["Copula"]
  },
  // walked
  PastTense: {
    is: "Verb",
    not: ["PresentTense", "Gerund", "FutureTense"]
  },
  // will walk
  FutureTense: {
    is: "Verb",
    not: ["PresentTense", "PastTense"]
  },
  // is/was
  Copula: {
    is: "Verb"
  },
  // '[could] walk'
  Modal: {
    is: "Verb",
    not: ["Infinitive"]
  },
  // 'awaken'
  Participle: {
    is: "PastTense"
  },
  // '[will have had] walked'
  Auxiliary: {
    is: "Verb",
    not: ["PastTense", "PresentTense", "Gerund", "Conjunction"]
  },
  // 'walk out'
  PhrasalVerb: {
    is: "Verb"
  },
  // 'walk [out]'
  Particle: {
    is: "PhrasalVerb",
    not: ["PastTense", "PresentTense", "Copula", "Gerund"]
  },
  // 'walked by'
  Passive: {
    is: "Verb"
  }
};

// reducer/node_modules/compromise/src/2-two/preTagger/tagSet/values.js
var values_default = {
  Value: {
    not: ["Verb", "Adjective", "Adverb"]
  },
  Ordinal: {
    is: "Value",
    not: ["Cardinal"]
  },
  Cardinal: {
    is: "Value",
    not: ["Ordinal"]
  },
  Fraction: {
    is: "Value",
    not: ["Noun"]
  },
  Multiple: {
    is: "TextValue"
  },
  RomanNumeral: {
    is: "Cardinal",
    not: ["TextValue"]
  },
  TextValue: {
    is: "Value",
    not: ["NumericValue"]
  },
  NumericValue: {
    is: "Value",
    not: ["TextValue"]
  },
  Money: {
    is: "Cardinal"
  },
  Percent: {
    is: "Value"
  }
};

// reducer/node_modules/compromise/src/2-two/preTagger/tagSet/dates.js
var dates_default = {
  Date: {
    not: ["Verb", "Adverb", "Adjective"]
  },
  Month: {
    is: "Date",
    also: ["Noun"],
    not: ["Year", "WeekDay", "Time"]
  },
  WeekDay: {
    is: "Date",
    also: ["Noun"]
  },
  Year: {
    is: "Date",
    not: ["RomanNumeral"]
  },
  FinancialQuarter: {
    is: "Date",
    not: "Fraction"
  },
  // 'easter'
  Holiday: {
    is: "Date",
    also: ["Noun"]
  },
  // 'summer'
  Season: {
    is: "Date"
  },
  Timezone: {
    is: "Date",
    also: ["Noun"],
    not: ["ProperNoun"]
  },
  Time: {
    is: "Date",
    not: ["AtMention"]
  },
  // 'months'
  Duration: {
    is: "Date",
    also: ["Noun"]
  }
};

// reducer/node_modules/compromise/src/2-two/preTagger/tagSet/misc.js
var anything = ["Noun", "Verb", "Adjective", "Adverb", "Value", "QuestionWord"];
var misc_default3 = {
  Adjective: {
    not: ["Noun", "Verb", "Adverb", "Value"]
  },
  Comparable: {
    is: "Adjective"
  },
  Comparative: {
    is: "Adjective"
  },
  Superlative: {
    is: "Adjective",
    not: ["Comparative"]
  },
  NumberRange: {},
  Adverb: {
    not: ["Noun", "Verb", "Adjective", "Value"]
  },
  Determiner: {
    not: ["Noun", "Verb", "Adjective", "Adverb", "QuestionWord", "Conjunction"]
    //allow 'a' to be a Determiner/Value
  },
  Conjunction: {
    not: anything
  },
  Preposition: {
    not: ["Noun", "Verb", "Adjective", "Adverb", "QuestionWord", "Determiner"]
  },
  QuestionWord: {
    not: ["Determiner"]
  },
  Currency: {
    is: "Noun"
  },
  Expression: {
    not: ["Noun", "Adjective", "Verb", "Adverb"]
  },
  Abbreviation: {},
  Url: {
    not: ["HashTag", "PhoneNumber", "Verb", "Adjective", "Value", "AtMention", "Email", "SlashedTerm"]
  },
  PhoneNumber: {
    not: ["HashTag", "Verb", "Adjective", "Value", "AtMention", "Email"]
  },
  HashTag: {},
  AtMention: {
    is: "Noun",
    not: ["HashTag", "Email"]
  },
  Emoji: {
    not: ["HashTag", "Verb", "Adjective", "Value", "AtMention"]
  },
  Emoticon: {
    not: ["HashTag", "Verb", "Adjective", "Value", "AtMention", "SlashedTerm"]
  },
  SlashedTerm: {
    not: ["Emoticon", "Url", "Value"]
  },
  Email: {
    not: ["HashTag", "Verb", "Adjective", "Value", "AtMention"]
  },
  Acronym: {
    not: ["Plural", "RomanNumeral", "Pronoun", "Date"]
  },
  Negative: {
    not: ["Noun", "Adjective", "Value", "Expression"]
  },
  Condition: {
    not: ["Verb", "Adjective", "Noun", "Value"]
  },
  // existential 'there'
  There: {
    not: ["Verb", "Adjective", "Noun", "Value", "Conjunction", "Preposition"]
  },
  // 'co-wrote'
  Prefix: {
    not: ["Abbreviation", "Acronym", "ProperNoun"]
  },
  // hard-nosed, bone-headed
  Hyphenated: {}
};

// reducer/node_modules/compromise/src/2-two/preTagger/tagSet/index.js
var allTags = Object.assign({}, nouns_default3, verbs_default2, values_default, dates_default, misc_default3);
var tagSet_default = allTags;

// reducer/node_modules/compromise/src/2-two/preTagger/plugin.js
var plugin_default14 = {
  compute: compute_default9,
  methods: methods_default9,
  model: model_default3,
  tags: tagSet_default,
  hooks: ["preTagger"]
};

// reducer/node_modules/compromise/src/2-two/contraction-two/api/contract.js
var postPunct = /[,)"';:\-–—.…]/;
var setContraction = function(m3, suffix) {
  if (!m3.found) {
    return;
  }
  const terms = m3.termList();
  for (let i3 = 0; i3 < terms.length - 1; i3++) {
    const t3 = terms[i3];
    if (postPunct.test(t3.post)) {
      return;
    }
  }
  terms[0].implicit = terms[0].normal;
  terms[0].text += suffix;
  terms[0].normal += suffix;
  terms.slice(1).forEach((t3) => {
    t3.implicit = t3.normal;
    t3.text = "";
    t3.normal = "";
  });
  for (let i3 = 0; i3 < terms.length - 1; i3++) {
    terms[i3].post = terms[i3].post.replace(/ /, "");
  }
};
var contract = function() {
  const doc = this.not("@hasContraction");
  let m3 = doc.match("(we|they|you) are");
  setContraction(m3, `'re`);
  m3 = doc.match("(he|she|they|it|we|you) will");
  setContraction(m3, `'ll`);
  m3 = doc.match("(he|she|they|it|we) is");
  setContraction(m3, `'s`);
  m3 = doc.match("#Person is");
  setContraction(m3, `'s`);
  m3 = doc.match("#Person would");
  setContraction(m3, `'d`);
  m3 = doc.match("(is|was|had|would|should|could|do|does|have|has|can) not");
  setContraction(m3, `n't`);
  m3 = doc.match("(i|we|they) have");
  setContraction(m3, `'ve`);
  m3 = doc.match("(would|should|could) have");
  setContraction(m3, `'ve`);
  m3 = doc.match("i am");
  setContraction(m3, `'m`);
  m3 = doc.match("going to");
  return this;
};
var contract_default = contract;

// reducer/node_modules/compromise/src/2-two/contraction-two/api/index.js
var titleCase3 = /^\p{Lu}[\p{Ll}'’]/u;
var toTitleCase3 = function(str = "") {
  str = str.replace(/^ *[a-z\u00C0-\u00FF]/, (x) => x.toUpperCase());
  return str;
};
var api3 = function(View2) {
  class Contractions extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Contraction";
    }
    /** i've -> 'i have' */
    expand() {
      this.docs.forEach((terms) => {
        const isTitleCase6 = titleCase3.test(terms[0].text);
        terms.forEach((t3, i3) => {
          t3.text = t3.implicit || "";
          delete t3.implicit;
          if (i3 < terms.length - 1 && t3.post === "") {
            t3.post += " ";
          }
          t3.dirty = true;
        });
        if (isTitleCase6) {
          terms[0].text = toTitleCase3(terms[0].text);
        }
      });
      this.compute("normal");
      return this;
    }
  }
  View2.prototype.contractions = function() {
    const m3 = this.match("@hasContraction+");
    return new Contractions(this.document, m3.pointer);
  };
  View2.prototype.contract = contract_default;
};
var api_default10 = api3;

// reducer/node_modules/compromise/src/2-two/contraction-two/compute/_splice.js
var insertContraction2 = function(document, point, words) {
  const [n3, w] = point;
  if (!words || words.length === 0) {
    return;
  }
  words = words.map((word, i3) => {
    word.implicit = word.text;
    word.machine = word.text;
    word.pre = "";
    word.post = "";
    word.text = "";
    word.normal = "";
    word.index = [n3, w + i3];
    return word;
  });
  if (words[0]) {
    words[0].pre = document[n3][w].pre;
    words[words.length - 1].post = document[n3][w].post;
    words[0].text = document[n3][w].text;
    words[0].normal = document[n3][w].normal;
  }
  document[n3].splice(w, 1, ...words);
};
var splice_default2 = insertContraction2;

// reducer/node_modules/compromise/src/2-two/contraction-two/compute/apostrophe-s.js
var hasContraction3 = /'/;
var hasWords = /* @__PURE__ */ new Set([
  "been",
  //the meeting's been ..
  "become"
  //my son's become
]);
var isWords = /* @__PURE__ */ new Set([
  "what",
  //it's what
  "how",
  //it's how
  "when",
  "if",
  //it's if
  "too"
]);
var adjLike = /* @__PURE__ */ new Set(["too", "also", "enough"]);
var isOrHas = (terms, i3) => {
  for (let o2 = i3 + 1; o2 < terms.length; o2 += 1) {
    const t3 = terms[o2];
    if (hasWords.has(t3.normal)) {
      return "has";
    }
    if (isWords.has(t3.normal)) {
      return "is";
    }
    if (t3.tags.has("Gerund")) {
      return "is";
    }
    if (t3.tags.has("Determiner")) {
      return "is";
    }
    if (t3.tags.has("Adjective")) {
      return "is";
    }
    if (t3.switch === "Adj|Past") {
      if (terms[o2 + 1]) {
        if (adjLike.has(terms[o2 + 1].normal)) {
          return "is";
        }
        if (terms[o2 + 1].tags.has("Preposition")) {
          return "is";
        }
      }
    }
    if (t3.tags.has("PastTense")) {
      if (terms[o2 + 1] && terms[o2 + 1].normal === "for") {
        return "is";
      }
      return "has";
    }
  }
  return "is";
};
var apostropheS = function(terms, i3) {
  const before2 = terms[i3].normal.split(hasContraction3)[0];
  if (before2 === "let") {
    return [before2, "us"];
  }
  if (before2 === "there") {
    const t3 = terms[i3 + 1];
    if (t3 && t3.tags.has("Plural")) {
      return [before2, "are"];
    }
  }
  if (isOrHas(terms, i3) === "has") {
    return [before2, "has"];
  }
  return [before2, "is"];
};
var apostrophe_s_default = apostropheS;

// reducer/node_modules/compromise/src/2-two/contraction-two/compute/apostrophe-d.js
var hasContraction4 = /'/;
var hadWords = /* @__PURE__ */ new Set([
  "better",
  //had better
  "done",
  //had done
  "before",
  // he'd _ before
  "it",
  // he'd _ it
  "had"
  //she'd had -> she would have..
]);
var wouldWords = /* @__PURE__ */ new Set([
  "have",
  // 'i'd have' -> i would have..
  "be"
  //' she'd be'
]);
var hadOrWould = (terms, i3) => {
  for (let o2 = i3 + 1; o2 < terms.length; o2 += 1) {
    const t3 = terms[o2];
    if (hadWords.has(t3.normal)) {
      return "had";
    }
    if (wouldWords.has(t3.normal)) {
      return "would";
    }
    if (t3.tags.has("PastTense") || t3.switch === "Adj|Past") {
      return "had";
    }
    if (t3.tags.has("PresentTense") || t3.tags.has("Infinitive")) {
      return "would";
    }
    if (t3.tags.has("#Determiner")) {
      return "had";
    }
    if (t3.tags.has("Adjective")) {
      return "would";
    }
  }
  return false;
};
var _apostropheD2 = function(terms, i3) {
  const before2 = terms[i3].normal.split(hasContraction4)[0];
  if (before2 === "how" || before2 === "what") {
    return [before2, "did"];
  }
  if (hadOrWould(terms, i3) === "had") {
    return [before2, "had"];
  }
  return [before2, "would"];
};
var apostrophe_d_default2 = _apostropheD2;

// reducer/node_modules/compromise/src/2-two/contraction-two/compute/apostrophe-t.js
var lastNoun = function(terms, i3) {
  for (let n3 = i3 - 1; n3 >= 0; n3 -= 1) {
    if (terms[n3].tags.has("Noun") || terms[n3].tags.has("Pronoun") || terms[n3].tags.has("Plural") || terms[n3].tags.has("Singular")) {
      return terms[n3];
    }
  }
  return null;
};
var apostropheT2 = function(terms, i3) {
  if (terms[i3].normal === "ain't" || terms[i3].normal === "aint") {
    if (terms[i3 + 1] && terms[i3 + 1].normal === "never") {
      return ["have"];
    }
    const noun = lastNoun(terms, i3);
    if (noun) {
      if (noun.normal === "we" || noun.normal === "they") {
        return ["are", "not"];
      }
      if (noun.normal === "i") {
        return ["am", "not"];
      }
      if (noun.tags && noun.tags.has("Plural")) {
        return ["are", "not"];
      }
    }
    return ["is", "not"];
  }
  const before2 = terms[i3].normal.replace(/n't/, "");
  return [before2, "not"];
};
var apostrophe_t_default2 = apostropheT2;

// reducer/node_modules/compromise/src/2-two/contraction-two/compute/isPossessive.js
var banList = {
  that: true,
  there: true,
  let: true,
  here: true,
  everywhere: true
};
var beforePossessive = {
  in: true,
  //in sunday's
  by: true,
  //by sunday's
  for: true
  //for sunday's
};
var adjLike2 = /* @__PURE__ */ new Set(["too", "also", "enough", "about"]);
var nounLike = /* @__PURE__ */ new Set(["is", "are", "did", "were", "could", "should", "must", "had", "have"]);
var isPossessive2 = (terms, i3) => {
  const term = terms[i3];
  if (banList.hasOwnProperty(term.machine || term.normal)) {
    return false;
  }
  if (term.tags.has("Possessive")) {
    return true;
  }
  if (term.tags.has("QuestionWord")) {
    return false;
  }
  if (term.normal === `he's` || term.normal === `she's`) {
    return false;
  }
  const nextTerm = terms[i3 + 1];
  if (!nextTerm) {
    return true;
  }
  if (term.normal === `it's`) {
    if (nextTerm.tags.has("#Noun")) {
      return true;
    }
    return false;
  }
  if (nextTerm.switch == "Noun|Gerund") {
    const next2 = terms[i3 + 2];
    if (!next2) {
      if (term.tags.has("Actor") || term.tags.has("ProperNoun")) {
        return true;
      }
      return false;
    }
    if (next2.tags.has("Copula")) {
      return true;
    }
    if (next2.normal === "on" || next2.normal === "in") {
      return false;
    }
    return false;
  }
  if (nextTerm.tags.has("Verb")) {
    if (nextTerm.tags.has("Infinitive")) {
      return true;
    }
    if (nextTerm.tags.has("Gerund")) {
      return false;
    }
    if (nextTerm.tags.has("PresentTense")) {
      return true;
    }
    return false;
  }
  if (nextTerm.switch === "Adj|Noun") {
    const twoTerm = terms[i3 + 2];
    if (!twoTerm) {
      return false;
    }
    if (nounLike.has(twoTerm.normal)) {
      return true;
    }
    if (adjLike2.has(twoTerm.normal)) {
      return false;
    }
  }
  if (nextTerm.tags.has("Noun")) {
    const nextStr = nextTerm.machine || nextTerm.normal;
    if (nextStr === "here" || nextStr === "there" || nextStr === "everywhere") {
      return false;
    }
    if (nextTerm.tags.has("Possessive")) {
      return false;
    }
    if (nextTerm.tags.has("ProperNoun") && !term.tags.has("ProperNoun")) {
      return false;
    }
    return true;
  }
  if (terms[i3 - 1] && beforePossessive[terms[i3 - 1].normal] === true) {
    return true;
  }
  if (nextTerm.tags.has("Adjective")) {
    const twoTerm = terms[i3 + 2];
    if (!twoTerm) {
      return false;
    }
    if (twoTerm.tags.has("Noun") && !twoTerm.tags.has("Pronoun")) {
      const str = nextTerm.normal;
      if (str === "above" || str === "below" || str === "behind") {
        return false;
      }
      return true;
    }
    if (twoTerm.switch === "Noun|Verb") {
      return true;
    }
    return false;
  }
  if (nextTerm.tags.has("Value")) {
    return true;
  }
  return false;
};
var isPossessive_default = isPossessive2;

// reducer/node_modules/compromise/src/2-two/contraction-two/compute/index.js
var byApostrophe2 = /'/;
var reIndex = function(terms) {
  terms.forEach((t3, i3) => {
    if (t3.index) {
      t3.index[1] = i3;
    }
  });
};
var reTag2 = function(terms, view, start2, len) {
  const tmp = view.update();
  tmp.document = [terms];
  let end2 = start2 + len;
  if (start2 > 0) {
    start2 -= 1;
  }
  if (terms[end2]) {
    end2 += 1;
  }
  tmp.ptrs = [[0, start2, end2]];
  tmp.compute(["freeze", "lexicon", "preTagger", "unfreeze"]);
  reIndex(terms);
};
var byEnd2 = {
  // how'd
  d: (terms, i3) => apostrophe_d_default2(terms, i3),
  // we ain't
  t: (terms, i3) => apostrophe_t_default2(terms, i3),
  // bob's
  s: (terms, i3, world2) => {
    if (isPossessive_default(terms, i3)) {
      return world2.methods.one.setTag([terms[i3]], "Possessive", world2, null, "2-contraction");
    }
    return apostrophe_s_default(terms, i3);
  }
};
var toDocs2 = function(words, view) {
  const doc = view.fromText(words.join(" "));
  doc.compute("id");
  return doc.docs[0];
};
var contractionTwo = (view) => {
  const { world: world2, document } = view;
  document.forEach((terms, n3) => {
    for (let i3 = terms.length - 1; i3 >= 0; i3 -= 1) {
      if (terms[i3].implicit) {
        continue;
      }
      let after2 = null;
      if (byApostrophe2.test(terms[i3].normal) === true) {
        after2 = terms[i3].normal.split(byApostrophe2)[1];
      }
      let words = null;
      if (byEnd2.hasOwnProperty(after2)) {
        words = byEnd2[after2](terms, i3, world2);
      }
      if (words) {
        words = toDocs2(words, view);
        splice_default2(document, [n3, i3], words);
        reTag2(document[n3], view, i3, words.length);
        continue;
      }
    }
  });
};
var compute_default10 = { contractionTwo };

// reducer/node_modules/compromise/src/2-two/contraction-two/plugin.js
var plugin_default15 = {
  compute: compute_default10,
  api: api_default10,
  hooks: ["contractionTwo"]
};

// reducer/node_modules/compromise/src/2-two/postTagger/model/adjective/adjective.js
var adjective_default = [
  // all fell apart
  { match: "[(all|both)] #Determiner #Noun", group: 0, tag: "Noun", reason: "all-noun" },
  //sometimes not-adverbs
  { match: "#Copula [(just|alone)]$", group: 0, tag: "Adjective", reason: "not-adverb" },
  //jack is guarded
  { match: "#Singular is #Adverb? [#PastTense$]", group: 0, tag: "Adjective", reason: "is-filled" },
  // smoked poutine is
  { match: "[#PastTense] #Singular is", group: 0, tag: "Adjective", reason: "smoked-poutine" },
  // baked onions are
  { match: "[#PastTense] #Plural are", group: 0, tag: "Adjective", reason: "baked-onions" },
  // well made
  { match: "well [#PastTense]", group: 0, tag: "Adjective", reason: "well-made" },
  // is f*ed up
  { match: "#Copula [fucked up?]", group: 0, tag: "Adjective", reason: "swears-adjective" },
  //jack seems guarded
  { match: "#Singular (seems|appears) #Adverb? [#PastTense$]", group: 0, tag: "Adjective", reason: "seems-filled" },
  // jury is out - preposition ➔ adjective
  { match: "#Copula #Adjective? [(out|in|through)]$", group: 0, tag: "Adjective", reason: "still-out" },
  // shut the door
  { match: "^[#Adjective] (the|your) #Noun", group: 0, notIf: "(all|even)", tag: "Infinitive", reason: "shut-the" },
  // the said card
  { match: "the [said] #Noun", group: 0, tag: "Adjective", reason: "the-said-card" },
  // faith-based, much-appreciated, soft-boiled
  { match: "[#Hyphenated (#Hyphenated && #PastTense)] (#Noun|#Conjunction)", group: 0, tag: "Adjective", notIf: "#Adverb", reason: "faith-based" },
  //self-driving
  { match: "[#Hyphenated (#Hyphenated && #Gerund)] (#Noun|#Conjunction)", group: 0, tag: "Adjective", notIf: "#Adverb", reason: "self-driving" },
  //dammed-up
  { match: "[#PastTense (#Hyphenated && #PhrasalVerb)] (#Noun|#Conjunction)", group: 0, tag: "Adjective", reason: "dammed-up" },
  //two-fold
  { match: "(#Hyphenated && #Value) fold", tag: "Adjective", reason: "two-fold" },
  //must-win
  { match: "must (#Hyphenated && #Infinitive)", tag: "Adjective", reason: "must-win" },
  // vacuum-sealed
  { match: `(#Hyphenated && #Infinitive) #Hyphenated`, tag: "Adjective", notIf: "#PhrasalVerb", reason: "vacuum-sealed" },
  { match: "too much", tag: "Adverb Adjective", reason: "bit-4" },
  { match: "a bit much", tag: "Determiner Adverb Adjective", reason: "bit-3" },
  // adjective-prefixes - 'un skilled'
  { match: "[(un|contra|extra|inter|intra|macro|micro|mid|mis|mono|multi|pre|sub|tri|ex)] #Adjective", group: 0, tag: ["Adjective", "Prefix"], reason: "un-skilled" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/adjective/adj-adverb.js
var adverbAdj = `(dark|bright|flat|light|soft|pale|dead|dim|faux|little|wee|sheer|most|near|good|extra|all)`;
var noLy = "(hard|fast|late|early|high|right|deep|close|direct)";
var adj_adverb_default = [
  // kinda sparkly
  { match: `#Adverb [#Adverb] (and|or|then)`, group: 0, tag: "Adjective", reason: "kinda-sparkly-and" },
  // dark green
  { match: `[${adverbAdj}] #Adjective`, group: 0, tag: "Adverb", reason: "dark-green" },
  // far too
  { match: `#Copula [far too] #Adjective`, group: 0, tag: "Adverb", reason: "far-too" },
  // was still in
  { match: `#Copula [still] (in|#Gerund|#Adjective)`, group: 0, tag: "Adverb", reason: "was-still-walking" },
  // studies hard
  { match: `#Plural ${noLy}`, tag: "#PresentTense #Adverb", reason: "studies-hard" },
  // shops direct
  {
    match: `#Verb [${noLy}] !#Noun?`,
    group: 0,
    notIf: "(#Copula|get|got|getting|become|became|becoming|feel|feels|feeling|#Determiner|#Preposition)",
    tag: "Adverb",
    reason: "shops-direct"
  },
  // studies a lot
  { match: `[#Plural] a lot`, tag: "PresentTense", reason: "studies-a-lot" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/adjective/adj-gerund.js
var adj_gerund_default2 = [
  //a staggering cost
  // { match: '(a|an) [#Gerund]', group: 0, tag: 'Adjective', reason: 'a|an' },
  //as amusing as
  { match: "as [#Gerund] as", group: 0, tag: "Adjective", reason: "as-gerund-as" },
  // more amusing than
  { match: "more [#Gerund] than", group: 0, tag: "Adjective", reason: "more-gerund-than" },
  // very amusing
  { match: "(so|very|extremely) [#Gerund]", group: 0, tag: "Adjective", reason: "so-gerund" },
  // found it amusing
  { match: "(found|found) it #Adverb? [#Gerund]", group: 0, tag: "Adjective", reason: "found-it-gerund" },
  // a bit amusing
  { match: "a (little|bit|wee) bit? [#Gerund]", group: 0, tag: "Adjective", reason: "a-bit-gerund" },
  // looking annoying
  {
    match: "#Gerund [#Gerund]",
    group: 0,
    tag: "Adjective",
    notIf: "(impersonating|practicing|considering|assuming)",
    reason: "looking-annoying"
  },
  // looked amazing
  {
    match: "(looked|look|looks) #Adverb? [%Adj|Gerund%]",
    group: 0,
    tag: "Adjective",
    notIf: "(impersonating|practicing|considering|assuming)",
    reason: "looked-amazing"
  },
  // were really amazing
  // { match: '(looked|look|looks) #Adverb [%Adj|Gerund%]', group: 0, tag: 'Adjective', notIf: '(impersonating|practicing|considering|assuming)', reason: 'looked-amazing' },
  // developing a
  { match: "[%Adj|Gerund%] #Determiner", group: 0, tag: "Gerund", reason: "developing-a" },
  // world's leading manufacturer
  { match: "#Possessive [%Adj|Gerund%] #Noun", group: 0, tag: "Adjective", reason: "leading-manufacturer" },
  // meaning alluring
  { match: "%Noun|Gerund% %Adj|Gerund%", tag: "Gerund #Adjective", reason: "meaning-alluring" },
  // face shocking revelations
  {
    match: "(face|embrace|reveal|stop|start|resume) %Adj|Gerund%",
    tag: "#PresentTense #Adjective",
    reason: "face-shocking"
  },
  // are enduring symbols
  { match: "(are|were) [%Adj|Gerund%] #Plural", group: 0, tag: "Adjective", reason: "are-enduring-symbols" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/adjective/adj-noun.js
var adj_noun_default2 = [
  //the above is clear
  { match: "#Determiner [#Adjective] #Copula", group: 0, tag: "Noun", reason: "the-adj-is" },
  //real evil is
  { match: "#Adjective [#Adjective] #Copula", group: 0, tag: "Noun", reason: "adj-adj-is" },
  //his fine
  { match: "(his|its) [%Adj|Noun%]", group: 0, tag: "Noun", notIf: "#Hyphenated", reason: "his-fine" },
  //is all
  { match: "#Copula #Adverb? [all]", group: 0, tag: "Noun", reason: "is-all" },
  // have fun
  { match: `(have|had) [#Adjective] #Preposition .`, group: 0, tag: "Noun", reason: "have-fun" },
  // brewing giant
  { match: `#Gerund (giant|capital|center|zone|application)`, tag: "Noun", reason: "brewing-giant" },
  // in an instant
  { match: `#Preposition (a|an) [#Adjective]$`, group: 0, tag: "Noun", reason: "an-instant" },
  // no golden would
  { match: `no [#Adjective] #Modal`, group: 0, tag: "Noun", reason: "no-golden" },
  // brand new
  { match: `[brand #Gerund?] new`, group: 0, tag: "Adverb", reason: "brand-new" },
  // some kind
  { match: `(#Determiner|#Comparative|new|different) [kind]`, group: 0, tag: "Noun", reason: "some-kind" },
  // her favourite sport
  { match: `#Possessive [%Adj|Noun%] #Noun`, group: 0, tag: "Adjective", reason: "her-favourite" },
  // must-win
  { match: `must && #Hyphenated .`, tag: "Adjective", reason: "must-win" },
  // the present
  {
    match: `#Determiner [#Adjective]$`,
    tag: "Noun",
    notIf: "(this|that|#Comparative|#Superlative)",
    reason: "the-south"
  },
  //are that crazy.
  // company-wide
  {
    match: `(#Noun && #Hyphenated) (#Adjective && #Hyphenated)`,
    tag: "Adjective",
    notIf: "(this|that|#Comparative|#Superlative)",
    reason: "company-wide"
  },
  // the poor were
  {
    match: `#Determiner [#Adjective] (#Copula|#Determiner)`,
    notIf: "(#Comparative|#Superlative)",
    group: 0,
    tag: "Noun",
    reason: "the-poor"
  },
  // professional bodybuilder
  {
    match: `[%Adj|Noun%] #Noun`,
    notIf: "(#Pronoun|#ProperNoun)",
    group: 0,
    tag: "Adjective",
    reason: "stable-foundations"
  }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/adjective/adj-verb.js
var adj_verb_default = [
  // amusing his aunt
  // { match: '[#Adjective] #Possessive #Noun', group: 0, tag: 'Verb', reason: 'gerund-his-noun' },
  // loving you
  // { match: '[#Adjective] (us|you)', group: 0, tag: 'Gerund', reason: 'loving-you' },
  // slowly stunning
  { match: "(slowly|quickly) [#Adjective]", group: 0, tag: "Verb", reason: "slowly-adj" },
  // does mean
  { match: "does (#Adverb|not)? [#Adjective]", group: 0, tag: "PresentTense", reason: "does-mean" },
  // okay by me
  { match: "[(fine|okay|cool|ok)] by me", group: 0, tag: "Adjective", reason: "okay-by-me" },
  // i mean
  { match: "i (#Adverb|do)? not? [mean]", group: 0, tag: "PresentTense", reason: "i-mean" },
  //will secure our
  { match: "will #Adjective", tag: "Auxiliary Infinitive", reason: "will-adj" },
  //he disguised the thing
  { match: "#Pronoun [#Adjective] #Determiner #Adjective? #Noun", group: 0, tag: "Verb", reason: "he-adj-the" },
  //is eager to go
  { match: "#Copula [%Adj|Present%] to #Verb", group: 0, tag: "Verb", reason: "adj-to" },
  //is done well
  { match: "#Copula [#Adjective] (well|badly|quickly|slowly)", group: 0, tag: "Verb", reason: "done-well" },
  // rude and insulting
  { match: "#Adjective and [#Gerund] !#Preposition?", group: 0, tag: "Adjective", reason: "rude-and-x" },
  // were over cooked
  { match: "#Copula #Adverb? (over|under) [#PastTense]", group: 0, tag: "Adjective", reason: "over-cooked" },
  // was bland and overcooked
  { match: "#Copula #Adjective+ (and|or) [#PastTense]$", group: 0, tag: "Adjective", reason: "bland-and-overcooked" },
  // got tired of
  { match: "got #Adverb? [#PastTense] of", group: 0, tag: "Adjective", reason: "got-tired-of" },
  //felt loved
  {
    match: "(seem|seems|seemed|appear|appeared|appears|feel|feels|felt|sound|sounds|sounded) (#Adverb|#Adjective)? [#PastTense]",
    group: 0,
    tag: "Adjective",
    reason: "felt-loved"
  },
  // seem confused
  { match: "(seem|feel|seemed|felt) [#PastTense #Particle?]", group: 0, tag: "Adjective", reason: "seem-confused" },
  // a bit confused
  { match: "a (bit|little|tad) [#PastTense #Particle?]", group: 0, tag: "Adjective", reason: "a-bit-confused" },
  // do not be embarrassed
  { match: "not be [%Adj|Past% #Particle?]", group: 0, tag: "Adjective", reason: "do-not-be-confused" },
  // is just right
  { match: "#Copula just [%Adj|Past% #Particle?]", group: 0, tag: "Adjective", reason: "is-just-right" },
  // as pale as
  { match: "as [#Infinitive] as", group: 0, tag: "Adjective", reason: "as-pale-as" },
  //failed and oppressive
  { match: "[%Adj|Past%] and #Adjective", group: 0, tag: "Adjective", reason: "faled-and-oppressive" },
  // or heightened emotion
  {
    match: "or [#PastTense] #Noun",
    group: 0,
    tag: "Adjective",
    notIf: "(#Copula|#Pronoun)",
    reason: "or-heightened-emotion"
  },
  // became involved
  { match: "(become|became|becoming|becomes) [#Verb]", group: 0, tag: "Adjective", reason: "become-verb" },
  // their declared intentions
  { match: "#Possessive [#PastTense] #Noun", group: 0, tag: "Adjective", reason: "declared-intentions" },
  // is he cool
  { match: "#Copula #Pronoun [%Adj|Present%]", group: 0, tag: "Adjective", reason: "is-he-cool" },
  // is crowded with
  {
    match: "#Copula [%Adj|Past%] with",
    group: 0,
    tag: "Adjective",
    notIf: "(associated|worn|baked|aged|armed|bound|fried|loaded|mixed|packed|pumped|filled|sealed)",
    reason: "is-crowded-with"
  },
  // is empty$
  { match: "#Copula #Adverb? [%Adj|Present%]$", group: 0, tag: "Adjective", reason: "was-empty$" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/adverb.js
var adverb_default = [
  //still good
  { match: "[still] #Adjective", group: 0, tag: "Adverb", reason: "still-advb" },
  //still make
  { match: "[still] #Verb", group: 0, tag: "Adverb", reason: "still-verb" },
  // so hot
  { match: "[so] #Adjective", group: 0, tag: "Adverb", reason: "so-adv" },
  // way hotter
  { match: "[way] #Comparative", group: 0, tag: "Adverb", reason: "way-adj" },
  // way too hot
  { match: "[way] #Adverb #Adjective", group: 0, tag: "Adverb", reason: "way-too-adj" },
  // all singing
  { match: "[all] #Verb", group: 0, tag: "Adverb", reason: "all-verb" },
  // sing like an angel
  { match: "#Verb  [like]", group: 0, notIf: "(#Modal|#PhrasalVerb)", tag: "Adverb", reason: "verb-like" },
  //barely even walk
  { match: "(barely|hardly) even", tag: "Adverb", reason: "barely-even" },
  //even held
  { match: "[even] #Verb", group: 0, tag: "Adverb", reason: "even-walk" },
  //even worse
  { match: "[even] #Comparative", group: 0, tag: "Adverb", reason: "even-worse" },
  // even the greatest
  { match: "[even] (#Determiner|#Possessive)", group: 0, tag: "#Adverb", reason: "even-the" },
  // even left
  { match: "even left", tag: "#Adverb #Verb", reason: "even-left" },
  // way over
  { match: "[way] #Adjective", group: 0, tag: "#Adverb", reason: "way-over" },
  //cheering hard - dropped -ly's
  {
    match: "#PresentTense [(hard|quick|bright|slow|fast|backwards|forwards)]",
    notIf: "#Copula",
    group: 0,
    tag: "Adverb",
    reason: "lazy-ly"
  },
  // much appreciated
  { match: "[much] #Adjective", group: 0, tag: "Adverb", reason: "bit-1" },
  // is well
  { match: "#Copula [#Adverb]$", group: 0, tag: "Adjective", reason: "is-well" },
  // a bit cold
  { match: "a [(little|bit|wee) bit?] #Adjective", group: 0, tag: "Adverb", reason: "a-bit-cold" },
  // super strong
  { match: `[(super|pretty)] #Adjective`, group: 0, tag: "Adverb", reason: "super-strong" },
  // become overly weakened
  { match: "(become|fall|grow) #Adverb? [#PastTense]", group: 0, tag: "Adjective", reason: "overly-weakened" },
  // a completely beaten man
  { match: "(a|an) #Adverb [#Participle] #Noun", group: 0, tag: "Adjective", reason: "completely-beaten" },
  //a close
  { match: "#Determiner #Adverb? [close]", group: 0, tag: "Adjective", reason: "a-close" },
  //walking close
  { match: "#Gerund #Adverb? [close]", group: 0, tag: "Adverb", notIf: "(getting|becoming|feeling)", reason: "being-close" },
  // a blown motor
  { match: "(the|those|these|a|an) [#Participle] #Noun", group: 0, tag: "Adjective", reason: "blown-motor" },
  // charged back
  { match: "(#PresentTense|#PastTense) [back]", group: 0, tag: "Adverb", notIf: "(#PhrasalVerb|#Copula)", reason: "charge-back" },
  // send around
  { match: "#Verb [around]", group: 0, tag: "Adverb", notIf: "#PhrasalVerb", reason: "send-around" },
  // later say
  { match: "[later] #PresentTense", group: 0, tag: "Adverb", reason: "later-say" },
  // the well
  { match: "#Determiner [well] !#PastTense?", group: 0, tag: "Noun", reason: "the-well" },
  // high enough
  { match: "#Adjective [enough]", group: 0, tag: "Adverb", reason: "high-enough" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/dates/date-phrase.js
var date_phrase_default = [
  // ==== Holiday ====
  { match: "#Holiday (day|eve)", tag: "Holiday", reason: "holiday-day" },
  //5th of March
  { match: "#Value of #Month", tag: "Date", reason: "value-of-month" },
  //5 March
  { match: "#Cardinal #Month", tag: "Date", reason: "cardinal-month" },
  //march 5 to 7
  { match: "#Month #Value to #Value", tag: "Date", reason: "value-to-value" },
  //march the 12th
  { match: "#Month the #Value", tag: "Date", reason: "month-the-value" },
  //june 7
  { match: "(#WeekDay|#Month) #Value", tag: "Date", reason: "date-value" },
  //7 june
  { match: "#Value (#WeekDay|#Month)", tag: "Date", reason: "value-date" },
  //may twenty five
  { match: "(#TextValue && #Date) #TextValue", tag: "Date", reason: "textvalue-date" },
  // 'aug 20-21'
  { match: `#Month #NumberRange`, tag: "Date", reason: "aug 20-21" },
  // wed march 5th
  { match: `#WeekDay #Month #Ordinal`, tag: "Date", reason: "week mm-dd" },
  // aug 5th 2021
  { match: `#Month #Ordinal #Cardinal`, tag: "Date", reason: "mm-dd-yyy" },
  // === timezones ===
  // china standard time
  { match: `(#Place|#Demonmym|#Time) (standard|daylight|central|mountain)? time`, tag: "Timezone", reason: "std-time" },
  // eastern time
  {
    match: `(eastern|mountain|pacific|central|atlantic) (standard|daylight|summer)? time`,
    tag: "Timezone",
    reason: "eastern-time"
  },
  // 5pm central
  { match: `#Time [(eastern|mountain|pacific|central|est|pst|gmt)]`, group: 0, tag: "Timezone", reason: "5pm-central" },
  // central european time
  { match: `(central|western|eastern) european time`, tag: "Timezone", reason: "cet" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/dates/date.js
var date_default = [
  // ==== WeekDay ====
  // sun the 5th
  { match: "[sun] the #Ordinal", tag: "WeekDay", reason: "sun-the-5th" },
  //sun feb 2
  { match: "[sun] #Date", group: 0, tag: "WeekDay", reason: "sun-feb" },
  //1pm next sun
  { match: "#Date (on|this|next|last|during)? [sun]", group: 0, tag: "WeekDay", reason: "1pm-sun" },
  //this sat
  { match: `(in|by|before|during|on|until|after|of|within|all) [sat]`, group: 0, tag: "WeekDay", reason: "sat" },
  { match: `(in|by|before|during|on|until|after|of|within|all) [wed]`, group: 0, tag: "WeekDay", reason: "wed" },
  { match: `(in|by|before|during|on|until|after|of|within|all) [march]`, group: 0, tag: "Month", reason: "march" },
  //sat november
  { match: "[sat] #Date", group: 0, tag: "WeekDay", reason: "sat-feb" },
  // ==== Month ====
  //all march
  { match: `#Preposition [(march|may)]`, group: 0, tag: "Month", reason: "in-month" },
  //this march
  { match: `(this|next|last) (march|may) !#Infinitive?`, tag: "#Date #Month", reason: "this-month" },
  // march 5th
  { match: `(march|may) the? #Value`, tag: "#Month #Date #Date", reason: "march-5th" },
  // 5th of march
  { match: `#Value of? (march|may)`, tag: "#Date #Date #Month", reason: "5th-of-march" },
  // march and feb
  { match: `[(march|may)] .? #Date`, group: 0, tag: "Month", reason: "march-and-feb" },
  // feb to march
  { match: `#Date .? [(march|may)]`, group: 0, tag: "Month", reason: "feb-and-march" },
  //quickly march
  { match: `#Adverb [(march|may)]`, group: 0, tag: "Verb", reason: "quickly-march" },
  //march quickly
  { match: `[(march|may)] #Adverb`, group: 0, tag: "Verb", reason: "march-quickly" },
  //12 am
  { match: `#Value (am|pm)`, tag: "Time", reason: "2-am" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/nouns/nouns.js
var infNouns = "(feel|sense|process|rush|side|bomb|bully|challenge|cover|crush|dump|exchange|flow|function|issue|lecture|limit|march|process)";
var nouns_default4 = [
  //'more' is not always an adverb
  // any more
  { match: "(the|any) [more]", group: 0, tag: "Singular", reason: "more-noun" },
  // more players
  { match: "[more] #Noun", group: 0, tag: "Adjective", reason: "more-noun" },
  // rights of man
  { match: "(right|rights) of .", tag: "Noun", reason: "right-of" },
  // a bit
  { match: "a [bit]", group: 0, tag: "Singular", reason: "bit-2" },
  // a must
  { match: "a [must]", group: 0, tag: "Singular", reason: "must-2" },
  // we all
  { match: "(we|us) [all]", group: 0, tag: "Noun", reason: "we all" },
  // due to weather
  { match: "due to [#Verb]", group: 0, tag: "Noun", reason: "due-to" },
  //some pressing issues
  { match: "some [#Verb] #Plural", group: 0, tag: "Noun", reason: "determiner6" },
  // my first thought
  { match: "#Possessive #Ordinal [#PastTense]", group: 0, tag: "Noun", reason: "first-thought" },
  //the nice swim
  {
    match: "(the|this|those|these) #Adjective [%Verb|Noun%]",
    group: 0,
    tag: "Noun",
    notIf: "#Copula",
    reason: "the-adj-verb"
  },
  // the truly nice swim
  { match: "(the|this|those|these) #Adverb #Adjective [#Verb]", group: 0, tag: "Noun", reason: "determiner4" },
  //the wait to vote
  { match: "the [#Verb] #Preposition .", group: 0, tag: "Noun", reason: "determiner1" },
  //a sense of
  { match: "(a|an|the) [#Verb] of", group: 0, tag: "Noun", reason: "the-verb-of" },
  //the threat of force
  { match: "#Determiner #Noun of [#Verb]", group: 0, tag: "Noun", notIf: "#Gerund", reason: "noun-of-noun" },
  // ended in ruins
  {
    match: "#PastTense #Preposition [#PresentTense]",
    group: 0,
    notIf: "#Gerund",
    tag: "Noun",
    reason: "ended-in-ruins"
  },
  //'u' as pronoun
  { match: "#Conjunction [u]", group: 0, tag: "Pronoun", reason: "u-pronoun-2" },
  { match: "[u] #Verb", group: 0, tag: "Pronoun", reason: "u-pronoun-1" },
  //the western line
  {
    match: "#Determiner [(western|eastern|northern|southern|central)] #Noun",
    group: 0,
    tag: "Noun",
    reason: "western-line"
  },
  //air-flow
  { match: "(#Singular && @hasHyphen) #PresentTense", tag: "Noun", reason: "hyphen-verb" },
  //is no walk
  { match: "is no [#Verb]", group: 0, tag: "Noun", reason: "is-no-verb" },
  //do so
  { match: "do [so]", group: 0, tag: "Noun", reason: "so-noun" },
  // what the hell
  { match: "#Determiner [(shit|damn|hell)]", group: 0, tag: "Noun", reason: "swears-noun" },
  // go to shit
  { match: "to [(shit|hell)]", group: 0, tag: "Noun", reason: "to-swears" },
  // the staff were
  { match: "(the|these) [#Singular] (were|are)", group: 0, tag: "Plural", reason: "singular-were" },
  // a comdominium, or simply condo
  { match: `a #Noun+ or #Adverb+? [#Verb]`, group: 0, tag: "Noun", reason: "noun-or-noun" },
  // walk the walk
  {
    match: "(the|those|these|a|an) #Adjective? [#PresentTense #Particle?]",
    group: 0,
    tag: "Noun",
    notIf: "(seem|appear|include|#Gerund|#Copula)",
    reason: "det-inf"
  },
  // { match: '(the|those|these|a|an) #Adjective? [#PresentTense #Particle?]', group: 0, tag: 'Noun', notIf: '(#Gerund|#Copula)', reason: 'det-pres' },
  // ==== Actor ====
  //Aircraft designer
  { match: "#Noun #Actor", tag: "Actor", notIf: "(#Person|#Pronoun)", reason: "thing-doer" },
  //lighting designer
  { match: "#Gerund #Actor", tag: "Actor", reason: "gerund-doer" },
  // captain sanders
  // { match: '[#Actor+] #ProperNoun', group: 0, tag: 'Honorific', reason: 'sgt-kelly' },
  // co-founder
  { match: `co #Singular`, tag: "Actor", reason: "co-noun" },
  // co-founder
  {
    match: `[#Noun+] #Actor`,
    group: 0,
    tag: "Actor",
    notIf: "(#Honorific|#Pronoun|#Possessive)",
    reason: "air-traffic-controller"
  },
  // fine-artist
  {
    match: `(urban|cardiac|cardiovascular|respiratory|medical|clinical|visual|graphic|creative|dental|exotic|fine|certified|registered|technical|virtual|professional|amateur|junior|senior|special|pharmaceutical|theoretical)+ #Noun? #Actor`,
    tag: "Actor",
    reason: "fine-artist"
  },
  // dance coach
  {
    match: `#Noun+ (coach|chef|king|engineer|fellow|personality|boy|girl|man|woman|master)`,
    tag: "Actor",
    reason: "dance-coach"
  },
  // chief design officer
  { match: `chief . officer`, tag: "Actor", reason: "chief-x-officer" },
  // chief of police
  { match: `chief of #Noun+`, tag: "Actor", reason: "chief-of-police" },
  // president of marketing
  { match: `senior? vice? president of #Noun+`, tag: "Actor", reason: "president-of" },
  // ==== Singular ====
  //the sun
  { match: "#Determiner [sun]", group: 0, tag: "Singular", reason: "the-sun" },
  //did a 900, paid a 20
  { match: "#Verb (a|an) [#Value]$", group: 0, tag: "Singular", reason: "did-a-value" },
  //'the can'
  { match: "the [(can|will|may)]", group: 0, tag: "Singular", reason: "the can" },
  // ==== Possessive ====
  //spencer kelly's
  { match: "#FirstName #Acronym? (#Possessive && #LastName)", tag: "Possessive", reason: "name-poss" },
  //Super Corp's fundraiser
  { match: "#Organization+ #Possessive", tag: "Possessive", reason: "org-possessive" },
  //Los Angeles's fundraiser
  { match: "#Place+ #Possessive", tag: "Possessive", reason: "place-possessive" },
  // Ptolemy's experiments
  { match: "#Possessive #PresentTense #Particle?", notIf: "(#Gerund|her)", tag: "Noun", reason: "possessive-verb" },
  // anna's eating vs anna's eating lunch
  // my presidents house
  { match: "(my|our|their|her|his|its) [(#Plural && #Actor)] #Noun", tag: "Possessive", reason: "my-dads" },
  // 10th of a second
  { match: "#Value of a [second]", group: 0, unTag: "Value", tag: "Singular", reason: "10th-of-a-second" },
  // 10 seconds
  { match: "#Value [seconds]", group: 0, unTag: "Value", tag: "Plural", reason: "10-seconds" },
  // in time
  { match: "in [#Infinitive]", group: 0, tag: "Singular", reason: "in-age" },
  // a minor in
  { match: "a [#Adjective] #Preposition", group: 0, tag: "Noun", reason: "a-minor-in" },
  //the repairer said
  { match: "#Determiner [#Singular] said", group: 0, tag: "Actor", reason: "the-actor-said" },
  //the euro sense
  {
    match: `#Determiner #Noun [${infNouns}] !(#Preposition|to|#Adverb)?`,
    group: 0,
    tag: "Noun",
    reason: "the-noun-sense"
  },
  // photographs of a computer are
  { match: "[#PresentTense] (of|by|for) (a|an|the) #Noun #Copula", group: 0, tag: "Plural", reason: "photographs-of" },
  // fight and win
  { match: "#Infinitive and [%Noun|Verb%]", group: 0, tag: "Infinitive", reason: "fight and win" },
  // peace and flowers and love
  { match: "#Noun and [#Verb] and #Noun", group: 0, tag: "Noun", reason: "peace-and-flowers" },
  // the 1992 classic
  { match: "the #Cardinal [%Adj|Noun%]", group: 0, tag: "Noun", reason: "the-1992-classic" },
  // the premier university
  { match: "#Copula the [%Adj|Noun%] #Noun", group: 0, tag: "Adjective", reason: "the-premier-university" },
  // scottish - i ate me sandwich
  { match: "i #Verb [me] #Noun", group: 0, tag: "Possessive", reason: "scottish-me" },
  // dance music
  {
    match: "[#PresentTense] (music|class|lesson|night|party|festival|league|ceremony)",
    group: 0,
    tag: "Noun",
    reason: "dance-music"
  },
  // wit it
  { match: "[wit] (me|it)", group: 0, tag: "Presposition", reason: "wit-me" },
  //left-her-boots, shoved her hand
  { match: "#PastTense #Possessive [#Verb]", group: 0, tag: "Noun", notIf: "(saw|made)", reason: "left-her-boots" },
  //35 signs
  { match: "#Value [%Plural|Verb%]", group: 0, tag: "Plural", notIf: "(one|1|a|an)", reason: "35-signs" },
  //had time
  { match: "had [#PresentTense]", group: 0, tag: "Noun", notIf: "(#Gerund|come|become)", reason: "had-time" },
  //instant access
  { match: "%Adj|Noun% %Noun|Verb%", tag: "#Adjective #Noun", notIf: "#ProperNoun #Noun", reason: "instant-access" },
  // a representative to
  { match: "#Determiner [%Adj|Noun%] #Conjunction", group: 0, tag: "Noun", reason: "a-rep-to" },
  // near death experiences, ambitious sales targets
  {
    match: "#Adjective #Noun [%Plural|Verb%]$",
    group: 0,
    tag: "Plural",
    notIf: "#Pronoun",
    reason: "near-death-experiences"
  },
  // your guild colors
  { match: "#Possessive #Noun [%Plural|Verb%]$", group: 0, tag: "Plural", reason: "your-guild-colors" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/verbs/noun-gerund.js
var noun_gerund_default2 = [
  // the planning processes
  { match: "(this|that|the|a|an) [#Gerund #Infinitive]", group: 0, tag: "Singular", reason: "the-planning-process" },
  // the paving stones
  { match: "(that|the) [#Gerund #PresentTense]", group: 0, ifNo: "#Copula", tag: "Plural", reason: "the-paving-stones" },
  // this swimming
  // { match: '(this|that|the) [#Gerund]', group: 0, tag: 'Noun', reason: 'this-gerund' },
  // the remaining claims
  { match: "#Determiner [#Gerund] #Noun", group: 0, tag: "Adjective", reason: "the-gerund-noun" },
  // i think tipping sucks
  { match: `#Pronoun #Infinitive [#Gerund] #PresentTense`, group: 0, tag: "Noun", reason: "tipping-sucks" },
  // early warning
  { match: "#Adjective [#Gerund]", group: 0, tag: "Noun", notIf: "(still|even|just)", reason: "early-warning" },
  //walking is cool
  { match: "[#Gerund] #Adverb? not? #Copula", group: 0, tag: "Activity", reason: "gerund-copula" },
  //are doing is
  { match: "#Copula [(#Gerund|#Activity)] #Copula", group: 0, tag: "Gerund", reason: "are-doing-is" },
  //walking should be fun
  { match: "[#Gerund] #Modal", group: 0, tag: "Activity", reason: "gerund-modal" },
  // finish listening
  // { match: '#Infinitive [#Gerund]', group: 0, tag: 'Activity', reason: 'finish-listening' },
  // the ruling party
  // responsibility for setting
  { match: "#Singular for [%Noun|Gerund%]", group: 0, tag: "Gerund", reason: "noun-for-gerund" },
  // better for training
  { match: "#Comparative (for|at) [%Noun|Gerund%]", group: 0, tag: "Gerund", reason: "better-for-gerund" },
  // keep the touching
  { match: "#PresentTense the [#Gerund]", group: 0, tag: "Noun", reason: "keep-the-touching" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/verbs/verb-noun.js
var verb_noun_default = [
  // do the dance
  { match: "#Infinitive (this|that|the) [#Infinitive]", group: 0, tag: "Noun", reason: "do-this-dance" },
  //running-a-show
  { match: "#Gerund #Determiner [#Infinitive]", group: 0, tag: "Noun", reason: "running-a-show" },
  //the-only-reason
  { match: "#Determiner (only|further|just|more|backward) [#Infinitive]", group: 0, tag: "Noun", reason: "the-only-reason" },
  // a stream runs
  { match: "(the|this|a|an) [#Infinitive] #Adverb? #Verb", group: 0, tag: "Noun", reason: "determiner5" },
  //a nice deal
  { match: "#Determiner #Adjective #Adjective? [#Infinitive]", group: 0, tag: "Noun", reason: "a-nice-inf" },
  // the mexican train
  { match: "#Determiner #Demonym [#PresentTense]", group: 0, tag: "Noun", reason: "mexican-train" },
  //next career move
  { match: "#Adjective #Noun+ [#Infinitive] #Copula", group: 0, tag: "Noun", reason: "career-move" },
  // at some point
  { match: "at some [#Infinitive]", group: 0, tag: "Noun", reason: "at-some-inf" },
  // goes to sleep
  { match: "(go|goes|went) to [#Infinitive]", group: 0, tag: "Noun", reason: "goes-to-verb" },
  //a close watch on
  { match: "(a|an) #Adjective? #Noun [#Infinitive] (#Preposition|#Noun)", group: 0, notIf: "from", tag: "Noun", reason: "a-noun-inf" },
  //a tv show
  { match: "(a|an) #Noun [#Infinitive]$", group: 0, tag: "Noun", reason: "a-noun-inf2" },
  //is mark hughes
  // { match: '#Copula [#Infinitive] #Noun', group: 0, tag: 'Noun', reason: 'is-pres-noun' },
  // good wait staff
  // { match: '#Adjective [#Infinitive] #Noun', group: 0, tag: 'Noun', reason: 'good-wait-staff' },
  // running for congress
  { match: "#Gerund #Adjective? for [#Infinitive]", group: 0, tag: "Noun", reason: "running-for" },
  // running to work
  // { match: '#Gerund #Adjective to [#Infinitive]', group: 0, tag: 'Noun', reason: 'running-to' },
  // about love
  { match: "about [#Infinitive]", group: 0, tag: "Singular", reason: "about-love" },
  // singers on stage
  { match: "#Plural on [#Infinitive]", group: 0, tag: "Noun", reason: "on-stage" },
  // any charge
  { match: "any [#Infinitive]", group: 0, tag: "Noun", reason: "any-charge" },
  // no doubt
  { match: "no [#Infinitive]", group: 0, tag: "Noun", reason: "no-doubt" },
  // number of seats
  { match: "number of [#PresentTense]", group: 0, tag: "Noun", reason: "number-of-x" },
  // teaches/taught
  { match: "(taught|teaches|learns|learned) [#PresentTense]", group: 0, tag: "Noun", reason: "teaches-x" },
  // use reverse
  { match: "(try|use|attempt|build|make) [#Verb #Particle?]", notIf: "(#Copula|#Noun|sure|fun|up)", group: 0, tag: "Noun", reason: "do-verb" },
  //make sure of
  // checkmate is
  { match: "^[#Infinitive] (is|was)", group: 0, tag: "Noun", reason: "checkmate-is" },
  // get much sleep
  { match: "#Infinitive much [#Infinitive]", group: 0, tag: "Noun", reason: "get-much" },
  // cause i gotta
  { match: "[cause] #Pronoun #Verb", group: 0, tag: "Conjunction", reason: "cause-cuz" },
  // the cardio dance party
  { match: "the #Singular [#Infinitive] #Noun", group: 0, tag: "Noun", notIf: "#Pronoun", reason: "cardio-dance" },
  // that should smoke
  { match: "#Determiner #Modal [#Noun]", group: 0, tag: "PresentTense", reason: "should-smoke" },
  //this rocks
  { match: "this [#Plural]", group: 0, tag: "PresentTense", notIf: "(#Preposition|#Date)", reason: "this-verbs" },
  //voice that rocks
  { match: "#Noun that [#Plural]", group: 0, tag: "PresentTense", notIf: "(#Preposition|#Pronoun|way)", reason: "voice-that-rocks" },
  //that leads to
  { match: "that [#Plural] to", group: 0, tag: "PresentTense", notIf: "#Preposition", reason: "that-leads-to" },
  //let him glue
  {
    match: "(let|make|made) (him|her|it|#Person|#Place|#Organization)+ [#Singular] (a|an|the|it)",
    group: 0,
    tag: "Infinitive",
    reason: "let-him-glue"
  },
  // assign all tasks
  { match: "#Verb (all|every|each|most|some|no) [#PresentTense]", notIf: "#Modal", group: 0, tag: "Noun", reason: "all-presentTense" },
  // PresentTense/Noun ambiguities
  // big dreams, critical thinking
  // have big dreams
  { match: "(had|have|#PastTense) #Adjective [#PresentTense]", group: 0, tag: "Noun", notIf: "better", reason: "adj-presentTense" },
  // excellent answer spencer
  // { match: '^#Adjective [#PresentTense]', group: 0, tag: 'Noun', reason: 'start adj-presentTense' },
  // one big reason
  { match: "#Value #Adjective [#PresentTense]", group: 0, tag: "Noun", notIf: "#Copula", reason: "one-big-reason" },
  // won widespread support
  { match: "#PastTense #Adjective+ [#PresentTense]", group: 0, tag: "Noun", notIf: "(#Copula|better)", reason: "won-wide-support" },
  // many poses
  { match: "(many|few|several|couple) [#PresentTense]", group: 0, tag: "Noun", notIf: "#Copula", reason: "many-poses" },
  // very big dreams
  { match: "#Determiner #Adverb #Adjective [%Noun|Verb%]", group: 0, tag: "Noun", notIf: "#Copula", reason: "very-big-dream" },
  // from start to finish
  { match: "from #Noun to [%Noun|Verb%]", group: 0, tag: "Noun", reason: "start-to-finish" },
  // for comparison or contrast
  { match: "(for|with|of) #Noun (and|or|not) [%Noun|Verb%]", group: 0, tag: "Noun", notIf: "#Pronoun", reason: "for-food-and-gas" },
  // adorable little store
  { match: "#Adjective #Adjective [#PresentTense]", group: 0, tag: "Noun", notIf: "#Copula", reason: "adorable-little-store" },
  // of basic training
  // { match: '#Preposition #Adjective [#PresentTense]', group: 0, tag: 'Noun', reason: 'of-basic-training' },
  // justifiying higher costs
  { match: "#Gerund #Adverb? #Comparative [#PresentTense]", group: 0, tag: "Noun", notIf: "#Copula", reason: "higher-costs" },
  { match: "(#Noun && @hasComma) #Noun (and|or) [#PresentTense]", group: 0, tag: "Noun", notIf: "#Copula", reason: "noun-list" },
  // any questions for
  { match: "(many|any|some|several) [#PresentTense] for", group: 0, tag: "Noun", reason: "any-verbs-for" },
  // to facilitate gas exchange with
  { match: `to #PresentTense #Noun [#PresentTense] #Preposition`, group: 0, tag: "Noun", reason: "gas-exchange" },
  // waited until release
  { match: `#PastTense (until|as|through|without) [#PresentTense]`, group: 0, tag: "Noun", reason: "waited-until-release" },
  // selling like hot cakes
  { match: `#Gerund like #Adjective? [#PresentTense]`, group: 0, tag: "Plural", reason: "like-hot-cakes" },
  // some valid reason
  { match: `some #Adjective [#PresentTense]`, group: 0, tag: "Noun", reason: "some-reason" },
  // for some reason
  { match: `for some [#PresentTense]`, group: 0, tag: "Noun", reason: "for-some-reason" },
  // same kind of shouts
  { match: `(same|some|the|that|a) kind of [#PresentTense]`, group: 0, tag: "Noun", reason: "some-kind-of" },
  // a type of shout
  { match: `(same|some|the|that|a) type of [#PresentTense]`, group: 0, tag: "Noun", reason: "some-type-of" },
  // doing better for fights
  { match: `#Gerund #Adjective #Preposition [#PresentTense]`, group: 0, tag: "Noun", reason: "doing-better-for-x" },
  // get better aim
  { match: `(get|got|have) #Comparative [#PresentTense]`, group: 0, tag: "Noun", reason: "got-better-aim" },
  // whose name was
  { match: "whose [#PresentTense] #Copula", group: 0, tag: "Noun", reason: "whos-name-was" },
  // give up on reason
  { match: `#PhrasalVerb #Particle #Preposition [#PresentTense]`, group: 0, tag: "Noun", reason: "given-up-on-x" },
  //there are reasons
  { match: "there (are|were) #Adjective? [#PresentTense]", group: 0, tag: "Plural", reason: "there-are" },
  // 30 trains
  { match: "#Value [#PresentTense] of", group: 0, notIf: "(one|1|#Copula|#Infinitive)", tag: "Plural", reason: "2-trains" },
  // compromises are possible
  { match: "[#PresentTense] (are|were) #Adjective", group: 0, tag: "Plural", reason: "compromises-are-possible" },
  // hope i helped
  { match: "^[(hope|guess|thought|think)] #Pronoun #Verb", group: 0, tag: "Infinitive", reason: "suppose-i" },
  //pursue its dreams
  // { match: '#PresentTense #Possessive [#PresentTense]', notIf: '#Gerund', group: 0, tag: 'Plural', reason: 'pursue-its-dreams' },
  // our unyielding support
  { match: "#Possessive #Adjective [#Verb]", group: 0, tag: "Noun", notIf: "#Copula", reason: "our-full-support" },
  // tastes good
  { match: "[(tastes|smells)] #Adverb? #Adjective", group: 0, tag: "PresentTense", reason: "tastes-good" },
  // are you playing golf
  // { match: '^are #Pronoun [#Noun]', group: 0, notIf: '(here|there)', tag: 'Verb', reason: 'are-you-x' },
  // ignoring commute
  { match: "#Copula #Gerund [#PresentTense] !by?", group: 0, tag: "Noun", notIf: "going", reason: "ignoring-commute" },
  // noun-pastTense variables
  { match: "#Determiner #Adjective? [(shed|thought|rose|bid|saw|spelt)]", group: 0, tag: "Noun", reason: "noun-past" },
  // 'verb-to'
  // how to watch
  { match: "how to [%Noun|Verb%]", group: 0, tag: "Infinitive", reason: "how-to-noun" },
  // which boost it
  { match: "which [%Noun|Verb%] #Noun", group: 0, tag: "Infinitive", reason: "which-boost-it" },
  // asking questions
  { match: "#Gerund [%Plural|Verb%]", group: 0, tag: "Plural", reason: "asking-questions" },
  // ready to stream
  { match: "(ready|available|difficult|hard|easy|made|attempt|try) to [%Noun|Verb%]", group: 0, tag: "Infinitive", reason: "ready-to-noun" },
  // bring to market
  { match: "(bring|went|go|drive|run|bike) to [%Noun|Verb%]", group: 0, tag: "Noun", reason: "bring-to-noun" },
  // can i sleep, would you look
  { match: "#Modal #Noun [%Noun|Verb%]", group: 0, tag: "Infinitive", reason: "would-you-look" },
  // is just spam
  { match: "#Copula just [#Infinitive]", group: 0, tag: "Noun", reason: "is-just-spam" },
  // request copies
  { match: "^%Noun|Verb% %Plural|Verb%", tag: "Imperative #Plural", reason: "request-copies" },
  // homemade pickles and drinks
  { match: "#Adjective #Plural and [%Plural|Verb%]", group: 0, tag: "#Plural", reason: "pickles-and-drinks" },
  // the 1968 film
  { match: "#Determiner #Year [#Verb]", group: 0, tag: "Noun", reason: "the-1968-film" },
  // the break up
  { match: "#Determiner [#PhrasalVerb #Particle]", group: 0, tag: "Noun", reason: "the-break-up" },
  // the individual goals
  { match: "#Determiner [%Adj|Noun%] #Noun", group: 0, tag: "Adjective", notIf: "(#Pronoun|#Possessive|#ProperNoun)", reason: "the-individual-goals" },
  // work or prepare
  { match: "[%Noun|Verb%] or #Infinitive", group: 0, tag: "Infinitive", reason: "work-or-prepare" },
  // to give thanks
  { match: "to #Infinitive [#PresentTense]", group: 0, tag: "Noun", notIf: "(#Gerund|#Copula|help)", reason: "to-give-thanks" },
  // kills me
  { match: "[#Noun] me", group: 0, tag: "Verb", reason: "kills-me" },
  // removes wrinkles
  { match: "%Plural|Verb% %Plural|Verb%", tag: "#PresentTense #Plural", reason: "removes-wrinkles" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/numbers/money.js
var money_default = [
  { match: "#Money and #Money #Currency?", tag: "Money", reason: "money-and-money" },
  // 6 dollars and 5 cents
  { match: "#Value #Currency [and] #Value (cents|ore|centavos|sens)", group: 0, tag: "money", reason: "and-5-cents" },
  // maybe currencies
  { match: "#Value (mark|rand|won|rub|ore)", tag: "#Money #Currency", reason: "4-mark" },
  // 3 pounds
  { match: "a pound", tag: "#Money #Unit", reason: "a-pound" },
  { match: "#Value (pound|pounds)", tag: "#Money #Unit", reason: "4-pounds" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/numbers/fractions.js
var fractions_default = [
  // half a penny
  { match: "[(half|quarter)] of? (a|an)", group: 0, tag: "Fraction", reason: "millionth" },
  // nearly half
  { match: "#Adverb [half]", group: 0, tag: "Fraction", reason: "nearly-half" },
  // half the
  { match: "[half] the", group: 0, tag: "Fraction", reason: "half-the" },
  // and a half
  { match: "#Cardinal and a half", tag: "Fraction", reason: "and-a-half" },
  // two-halves
  { match: "#Value (halves|halfs|quarters)", tag: "Fraction", reason: "two-halves" },
  // ---ordinals as fractions---
  // a fifth
  { match: "a #Ordinal", tag: "Fraction", reason: "a-quarter" },
  // seven fifths
  { match: "[#Cardinal+] (#Fraction && /s$/)", tag: "Fraction", reason: "seven-fifths" },
  // doc.match('(#Fraction && /s$/)').lookBefore('#Cardinal+$').tag('Fraction')
  // one third of ..
  { match: "[#Cardinal+ #Ordinal] of .", group: 0, tag: "Fraction", reason: "ordinal-of" },
  // 100th of
  { match: "[(#NumericValue && #Ordinal)] of .", group: 0, tag: "Fraction", reason: "num-ordinal-of" },
  // a twenty fifth
  { match: "(a|one) #Cardinal?+ #Ordinal", tag: "Fraction", reason: "a-ordinal" },
  // //  '3 out of 5'
  { match: "#Cardinal+ out? of every? #Cardinal", tag: "Fraction", reason: "out-of" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/numbers/numbers.js
var numbers_default = [
  // ==== Ambiguous numbers ====
  // 'second'
  { match: `#Cardinal [second]`, tag: "Unit", reason: "one-second" },
  //'a/an' can mean 1 - "a hour"
  {
    match: "!once? [(a|an)] (#Duration|hundred|thousand|million|billion|trillion)",
    group: 0,
    tag: "Value",
    reason: "a-is-one"
  },
  // ==== PhoneNumber ====
  //1 800 ...
  { match: "1 #Value #PhoneNumber", tag: "PhoneNumber", reason: "1-800-Value" },
  //(454) 232-9873
  { match: "#NumericValue #PhoneNumber", tag: "PhoneNumber", reason: "(800) PhoneNumber" },
  // ==== Currency ====
  // chinese yuan
  { match: "#Demonym #Currency", tag: "Currency", reason: "demonym-currency" },
  // ten bucks
  { match: "#Value [(buck|bucks|grand)]", group: 0, tag: "Currency", reason: "value-bucks" },
  // ==== Money ====
  { match: "[#Value+] #Currency", group: 0, tag: "Money", reason: "15 usd" },
  // ==== Ordinal ====
  { match: "[second] #Noun", group: 0, tag: "Ordinal", reason: "second-noun" },
  // ==== Units ====
  //5 yan
  { match: "#Value+ [#Currency]", group: 0, tag: "Unit", reason: "5-yan" },
  { match: "#Value [(foot|feet)]", group: 0, tag: "Unit", reason: "foot-unit" },
  //5 kg.
  { match: "#Value [#Abbreviation]", group: 0, tag: "Unit", reason: "value-abbr" },
  { match: "#Value [k]", group: 0, tag: "Unit", reason: "value-k" },
  { match: "#Unit an hour", tag: "Unit", reason: "unit-an-hour" },
  // ==== Magnitudes ====
  //minus 7
  { match: "(minus|negative) #Value", tag: "Value", reason: "minus-value" },
  //seven point five
  { match: "#Value (point|decimal) #Value", tag: "Value", reason: "value-point-value" },
  //quarter million
  { match: "#Determiner [(half|quarter)] #Ordinal", group: 0, tag: "Value", reason: "half-ordinal" },
  // thousand and two
  { match: `#Multiple+ and #Value`, tag: "Value", reason: "magnitude-and-value" },
  // ambiguous units like 'gb'
  // { match: '#Value square? [(kb|mb|gb|tb|ml|pt|qt|tbl|tbsp|km|cm|mm|mi|ft|yd|kg|hg|mg|oz|lb|mph|pa|miles|yard|yards|pound|pounds)]', group: 0, tag: 'Unit', reason: '12-gb' },
  // 5 miles per hour
  { match: "#Value #Unit [(per|an) (hr|hour|sec|second|min|minute)]", group: 0, tag: "Unit", reason: "12-miles-per-second" },
  // 5 square miles
  { match: "#Value [(square|cubic)] #Unit", group: 0, tag: "Unit", reason: "square-miles" }
  // 5) The expenses
  // { match: '^[#Value] (#Determiner|#Gerund)', group: 0, tag: 'Expression', unTag: 'Value', reason: 'numbered-list' },
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/person/person-phrase.js
var person_phrase_default = [
  // ==== FirstNames ====
  //is foo Smith
  { match: "#Copula [(#Noun|#PresentTense)] #LastName", group: 0, tag: "FirstName", reason: "copula-noun-lastname" },
  //pope francis
  {
    match: "(sister|pope|brother|father|aunt|uncle|grandpa|grandfather|grandma) #ProperNoun",
    tag: "Person",
    reason: "lady-titlecase",
    safe: true
  },
  // ==== Nickname ====
  // Dwayne 'the rock' Johnson
  { match: "#FirstName [#Determiner #Noun] #LastName", group: 0, tag: "Person", reason: "first-noun-last" },
  {
    match: "#ProperNoun (b|c|d|e|f|g|h|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z) #ProperNoun",
    tag: "Person",
    reason: "titlecase-acronym-titlecase",
    safe: true
  },
  { match: "#Acronym #LastName", tag: "Person", reason: "acronym-lastname", safe: true },
  { match: "#Person (jr|sr|md)", tag: "Person", reason: "person-honorific" },
  //remove single 'mr'
  { match: "#Honorific #Acronym", tag: "Person", reason: "Honorific-TitleCase" },
  { match: "#Person #Person the? #RomanNumeral", tag: "Person", reason: "roman-numeral" },
  { match: "#FirstName [/^[^aiurck]$/]", group: 0, tag: ["Acronym", "Person"], reason: "john-e" },
  //j.k Rowling
  { match: "#Noun van der? #Noun", tag: "Person", reason: "van der noun", safe: true },
  //king of spain
  { match: "(king|queen|prince|saint|lady) of #Noun", tag: "Person", reason: "king-of-noun", safe: true },
  //lady Florence
  { match: "(prince|lady) #Place", tag: "Person", reason: "lady-place" },
  //saint Foo
  { match: "(king|queen|prince|saint) #ProperNoun", tag: "Person", notIf: "#Place", reason: "saint-foo" },
  // al sharpton
  { match: "al (#Person|#ProperNoun)", tag: "Person", reason: "al-borlen", safe: true },
  //ferdinand de almar
  { match: "#FirstName de #Noun", tag: "Person", reason: "bill-de-noun" },
  //Osama bin Laden
  { match: "#FirstName (bin|al) #Noun", tag: "Person", reason: "bill-al-noun" },
  //John L. Foo
  { match: "#FirstName #Acronym #ProperNoun", tag: "Person", reason: "bill-acronym-title" },
  //Andrew Lloyd Webber
  { match: "#FirstName #FirstName #ProperNoun", tag: "Person", reason: "bill-firstname-title" },
  //Mr Foo
  { match: "#Honorific #FirstName? #ProperNoun", tag: "Person", reason: "dr-john-Title" },
  //peter the great
  { match: "#FirstName the #Adjective", tag: "Person", reason: "name-the-great" },
  // dick van dyke
  { match: "#ProperNoun (van|al|bin) #ProperNoun", tag: "Person", reason: "title-van-title", safe: true },
  //jose de Sucre
  { match: "#ProperNoun (de|du) la? #ProperNoun", tag: "Person", notIf: "#Place", reason: "title-de-title" },
  //Jani K. Smith
  { match: "#Singular #Acronym #LastName", tag: "#FirstName #Person .", reason: "title-acro-noun", safe: true },
  //Foo Ford
  { match: "[#ProperNoun] #Person", group: 0, tag: "Person", reason: "proper-person", safe: true },
  // john keith jones
  {
    match: "#Person [#ProperNoun #ProperNoun]",
    group: 0,
    tag: "Person",
    notIf: "#Possessive",
    reason: "three-name-person",
    safe: true
  },
  //John Foo
  {
    match: "#FirstName #Acronym? [#ProperNoun]",
    group: 0,
    tag: "LastName",
    notIf: "#Possessive",
    reason: "firstname-titlecase"
  },
  // john stewart
  { match: "#FirstName [#FirstName]", group: 0, tag: "LastName", reason: "firstname-firstname" },
  //Joe K. Sombrero
  { match: "#FirstName #Acronym #Noun", tag: "Person", reason: "n-acro-noun", safe: true },
  //Anthony de Marco
  { match: "#FirstName [(de|di|du|van|von)] #Person", group: 0, tag: "LastName", reason: "de-firstname" },
  // baker jenna smith
  // { match: '[#Actor+] #Person', group: 0, tag: 'Person', reason: 'baker-sam-smith' },
  // sergeant major Harold
  {
    match: "[(lieutenant|corporal|sergeant|captain|qeen|king|admiral|major|colonel|marshal|president|queen|king)+] #ProperNoun",
    group: 0,
    tag: "Honorific",
    reason: "seargeant-john"
  },
  // ==== Honorics ====
  {
    match: "[(private|general|major|rear|prime|field|count|miss)] #Honorific? #Person",
    group: 0,
    tag: ["Honorific", "Person"],
    reason: "ambg-honorifics"
  },
  // dr john foobar
  {
    match: "#Honorific #FirstName [#Singular]",
    group: 0,
    tag: "LastName",
    notIf: "#Possessive",
    reason: "dr-john-foo",
    safe: true
  },
  //his-excellency
  {
    match: "[(his|her) (majesty|honour|worship|excellency|honorable)] #Person",
    group: 0,
    tag: "Honorific",
    reason: "his-excellency"
  },
  // Lieutenant colonel
  { match: "#Honorific #Actor", tag: "Honorific", reason: "Lieutenant colonel" },
  // first lady, second admiral
  { match: "(first|second|third|1st|2nd|3rd) #Actor", tag: "Honorific", reason: "first lady" },
  // Louis IV
  { match: "#Person #RomanNumeral", tag: "Person", reason: "louis-IV" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/person/ambig-name.js
var ambig_name_default = [
  // ebenezer scrooge
  {
    match: "#FirstName #Noun$",
    tag: ". #LastName",
    notIf: "(#Possessive|#Organization|#Place|#Pronoun|@hasTitleCase)",
    reason: "firstname-noun"
  },
  // ===person-date===
  { match: "%Person|Date% #Acronym? #ProperNoun", tag: "Person", reason: "jan-thierson" },
  // ===person-noun===
  //Cliff Clavin
  { match: "%Person|Noun% #Acronym? #ProperNoun", tag: "Person", reason: "switch-person", safe: true },
  // olive garden
  { match: "%Person|Noun% #Organization", tag: "Organization", reason: "olive-garden" },
  // ===person-verb===
  // ollie faroo
  { match: "%Person|Verb% #Acronym? #ProperNoun", tag: "Person", reason: "verb-propernoun", ifNo: "#Actor" },
  // chuck will ...
  {
    match: `[%Person|Verb%] (will|had|has|said|says|told|did|learned|wants|wanted)`,
    group: 0,
    tag: "Person",
    reason: "person-said"
  },
  // ===person-place===
  //sydney harbour
  {
    match: `[%Person|Place%] (harbor|harbour|pier|town|city|place|dump|landfill)`,
    group: 0,
    tag: "Place",
    reason: "sydney-harbour"
  },
  // east sydney
  { match: `(west|east|north|south) [%Person|Place%]`, group: 0, tag: "Place", reason: "east-sydney" },
  // ===person-adjective===
  // rusty smith
  // { match: `${personAdj} #Person`, tag: 'Person', reason: 'randy-smith' },
  // rusty a. smith
  // { match: `${personAdj} #Acronym? #ProperNoun`, tag: 'Person', reason: 'rusty-smith' },
  // very rusty
  // { match: `#Adverb [${personAdj}]`, group: 0, tag: 'Adjective', reason: 'really-rich' },
  // ===person-verb===
  // would wade
  { match: `#Modal [%Person|Verb%]`, group: 0, tag: "Verb", reason: "would-mark" },
  // really wade
  { match: `#Adverb [%Person|Verb%]`, group: 0, tag: "Verb", reason: "really-mark" },
  // drew closer
  { match: `[%Person|Verb%] (#Adverb|#Comparative)`, group: 0, tag: "Verb", reason: "drew-closer" },
  // wade smith
  { match: `%Person|Verb% #Person`, tag: "Person", reason: "rob-smith" },
  // wade m. Cooper
  { match: `%Person|Verb% #Acronym #ProperNoun`, tag: "Person", reason: "rob-a-smith" },
  // will go
  { match: "[will] #Verb", group: 0, tag: "Modal", reason: "will-verb" },
  // will Pharell
  { match: "(will && @isTitleCase) #ProperNoun", tag: "Person", reason: "will-name" },
  // jack layton won
  {
    match: "(#FirstName && !#Possessive) [#Singular] #Verb",
    group: 0,
    safe: true,
    tag: "LastName",
    reason: "jack-layton"
  },
  // sherwood anderson told
  { match: "^[#Singular] #Person #Verb", group: 0, safe: true, tag: "Person", reason: "sherwood-anderson" },
  // bought a warhol
  { match: "(a|an) [#Person]$", group: 0, unTag: "Person", reason: "a-warhol" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/verbs/verbs.js
var verbs_default3 = [
  //sometimes adverbs - 'pretty good','well above'
  {
    match: "#Copula (pretty|dead|full|well|sure) (#Adjective|#Noun)",
    tag: "#Copula #Adverb #Adjective",
    reason: "sometimes-adverb"
  },
  //i better ..
  { match: "(#Pronoun|#Person) (had|#Adverb)? [better] #PresentTense", group: 0, tag: "Modal", reason: "i-better" },
  // adj -> gerund
  // like
  { match: "(#Modal|i|they|we|do) not? [like]", group: 0, tag: "PresentTense", reason: "modal-like" },
  // ==== Tense ====
  //he left
  { match: "#Noun #Adverb? [left]", group: 0, tag: "PastTense", reason: "left-verb" },
  // ==== Copula ====
  //will be running (not copula)
  { match: "will #Adverb? not? #Adverb? [be] #Gerund", group: 0, tag: "Copula", reason: "will-be-copula" },
  //for more complex forms, just tag 'be'
  { match: "will #Adverb? not? #Adverb? [be] #Adjective", group: 0, tag: "Copula", reason: "be-copula" },
  // ==== Infinitive ====
  //march to
  { match: "[march] (up|down|back|toward)", notIf: "#Date", group: 0, tag: "Infinitive", reason: "march-to" },
  //must march
  { match: "#Modal [march]", group: 0, tag: "Infinitive", reason: "must-march" },
  // may be
  { match: `[may] be`, group: 0, tag: "Verb", reason: "may-be" },
  // subject to
  { match: `[(subject|subjects|subjected)] to`, group: 0, tag: "Verb", reason: "subject to" },
  // subject to
  { match: `[home] to`, group: 0, tag: "PresentTense", reason: "home to" },
  // === misc==
  // side with
  // { match: '[(side|fool|monkey)] with', group: 0, tag: 'Infinitive', reason: 'fool-with' },
  // open the door
  { match: "[open] #Determiner", group: 0, tag: "Infinitive", reason: "open-the" },
  //were being run
  { match: `(were|was) being [#PresentTense]`, group: 0, tag: "PastTense", reason: "was-being" },
  //had been broken
  { match: `(had|has|have) [been /en$/]`, group: 0, tag: "Auxiliary Participle", reason: "had-been-broken" },
  //had been smoked
  { match: `(had|has|have) [been /ed$/]`, group: 0, tag: "Auxiliary PastTense", reason: "had-been-smoked" },
  //were being run
  { match: `(had|has) #Adverb? [been] #Adverb? #PastTense`, group: 0, tag: "Auxiliary", reason: "had-been-adj" },
  //had to walk
  { match: `(had|has) to [#Noun] (#Determiner|#Possessive)`, group: 0, tag: "Infinitive", reason: "had-to-noun" },
  // have read
  { match: `have [#PresentTense]`, group: 0, tag: "PastTense", notIf: "(come|gotten)", reason: "have-read" },
  // does that work
  { match: `(does|will|#Modal) that [work]`, group: 0, tag: "PastTense", reason: "does-that-work" },
  // sounds fun
  { match: `[(sound|sounds)] #Adjective`, group: 0, tag: "PresentTense", reason: "sounds-fun" },
  // look good
  { match: `[(look|looks)] #Adjective`, group: 0, tag: "PresentTense", reason: "looks-good" },
  // stops thinking
  { match: `[(start|starts|stop|stops|begin|begins)] #Gerund`, group: 0, tag: "Verb", reason: "starts-thinking" },
  // have read
  { match: `(have|had) read`, tag: "Modal #PastTense", reason: "read-read" },
  //were under cooked
  {
    match: `(is|was|were) [(under|over) #PastTense]`,
    group: 0,
    tag: "Adverb Adjective",
    reason: "was-under-cooked"
  },
  // damn them
  { match: "[shit] (#Determiner|#Possessive|them)", group: 0, tag: "Verb", reason: "swear1-verb" },
  { match: "[damn] (#Determiner|#Possessive|them)", group: 0, tag: "Verb", reason: "swear2-verb" },
  { match: "[fuck] (#Determiner|#Possessive|them)", group: 0, tag: "Verb", reason: "swear3-verb" },
  // jobs that fit
  { match: "#Plural that %Noun|Verb%", tag: ". #Preposition #Infinitive", reason: "jobs-that-work" },
  // works for me
  { match: "[works] for me", group: 0, tag: "PresentTense", reason: "works-for-me" },
  // as we please
  { match: "as #Pronoun [please]", group: 0, tag: "Infinitive", reason: "as-we-please" },
  // verb-prefixes - 'co write'
  { match: "[(co|mis|de|inter|intra|pre|re|un|out|under|over|counter)] #Verb", group: 0, tag: ["Verb", "Prefix"], notIf: "(#Copula|#PhrasalVerb)", reason: "co-write" },
  // dressed and left
  { match: "#PastTense and [%Adj|Past%]", group: 0, tag: "PastTense", reason: "dressed-and-left" },
  // melted and fallen
  { match: "[%Adj|Past%] and #PastTense", group: 0, tag: "PastTense", reason: "dressed-and-left" },
  // is he stoked
  { match: "#Copula #Pronoun [%Adj|Past%]", group: 0, tag: "Adjective", reason: "is-he-stoked" },
  // to dream of
  { match: "to [%Noun|Verb%] #Preposition", group: 0, tag: "Infinitive", reason: "to-dream-of" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/verbs/auxiliary.js
var auxiliary_default = [
  // ==== Auxiliary ====
  // have been
  { match: `will (#Adverb|not)+? [have] (#Adverb|not)+? #Verb`, group: 0, tag: "Auxiliary", reason: "will-have-vb" },
  //was walking
  { match: `[#Copula] (#Adverb|not)+? (#Gerund|#PastTense)`, group: 0, tag: "Auxiliary", reason: "copula-walking" },
  //would walk
  { match: `[(#Modal|did)+] (#Adverb|not)+? #Verb`, group: 0, tag: "Auxiliary", reason: "modal-verb" },
  //would have had
  { match: `#Modal (#Adverb|not)+? [have] (#Adverb|not)+? [had] (#Adverb|not)+? #Verb`, group: 0, tag: "Auxiliary", reason: "would-have" },
  //support a splattering of auxillaries before a verb
  { match: `[(has|had)] (#Adverb|not)+? #PastTense`, group: 0, tag: "Auxiliary", reason: "had-walked" },
  // will walk
  { match: "[(do|does|did|will|have|had|has|got)] (not|#Adverb)+? #Verb", group: 0, tag: "Auxiliary", reason: "have-had" },
  // about to go
  { match: "[about to] #Adverb? #Verb", group: 0, tag: ["Auxiliary", "Verb"], reason: "about-to" },
  //would be walking
  { match: `#Modal (#Adverb|not)+? [be] (#Adverb|not)+? #Verb`, group: 0, tag: "Auxiliary", reason: "would-be" },
  //had been walking
  { match: `[(#Modal|had|has)] (#Adverb|not)+? [been] (#Adverb|not)+? #Verb`, group: 0, tag: "Auxiliary", reason: "had-been" },
  // was being driven
  { match: "[(be|being|been)] #Participle", group: 0, tag: "Auxiliary", reason: "being-driven" },
  // may want
  { match: "[may] #Adverb? #Infinitive", group: 0, tag: "Auxiliary", reason: "may-want" },
  // was being walked
  { match: "#Copula (#Adverb|not)+? [(be|being|been)] #Adverb+? #PastTense", group: 0, tag: "Auxiliary", reason: "being-walked" },
  // will be walked
  { match: "will [be] #PastTense", group: 0, tag: "Auxiliary", reason: "will-be-x" },
  // been walking
  { match: "[(be|been)] (#Adverb|not)+? #Gerund", group: 0, tag: "Auxiliary", reason: "been-walking" },
  // used to walk
  { match: "[used to] #PresentTense", group: 0, tag: "Auxiliary", reason: "used-to-walk" },
  // was going to walk
  { match: "#Copula (#Adverb|not)+? [going to] #Adverb+? #PresentTense", group: 0, tag: "Auxiliary", reason: "going-to-walk" },
  // tell me
  { match: "#Imperative [(me|him|her)]", group: 0, tag: "Reflexive", reason: "tell-him" },
  // there is no x
  { match: "(is|was) #Adverb? [no]", group: 0, tag: "Negative", reason: "is-no" },
  // been told
  { match: "[(been|had|became|came)] #PastTense", group: 0, notIf: "#PhrasalVerb", tag: "Auxiliary", reason: "been-told" },
  // being born
  { match: "[(being|having|getting)] #Verb", group: 0, tag: "Auxiliary", reason: "being-born" },
  // be walking
  { match: "[be] #Gerund", group: 0, tag: "Auxiliary", reason: "be-walking" },
  // better go
  { match: "[better] #PresentTense", group: 0, tag: "Modal", notIf: "(#Copula|#Gerund)", reason: "better-go" },
  // even better
  { match: "even better", tag: "Adverb #Comparative", reason: "even-better" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/verbs/phrasal.js
var phrasal_default = [
  // ==== Phrasal ====
  //'foo-up'
  { match: "(#Verb && @hasHyphen) up", tag: "PhrasalVerb", reason: "foo-up" },
  { match: "(#Verb && @hasHyphen) off", tag: "PhrasalVerb", reason: "foo-off" },
  { match: "(#Verb && @hasHyphen) over", tag: "PhrasalVerb", reason: "foo-over" },
  { match: "(#Verb && @hasHyphen) out", tag: "PhrasalVerb", reason: "foo-out" },
  // walk in on
  {
    match: "[#Verb (in|out|up|down|off|back)] (on|in)",
    notIf: "#Copula",
    tag: "PhrasalVerb Particle",
    reason: "walk-in-on"
  },
  // went on for
  { match: "(lived|went|crept|go) [on] for", group: 0, tag: "PhrasalVerb", reason: "went-on" },
  // the curtains come down
  { match: "#Verb (up|down|in|on|for)$", tag: "PhrasalVerb #Particle", notIf: "#PhrasalVerb", reason: "come-down$" },
  // got me thinking
  // { match: '(got|had) me [#Noun]', group: 0, tag: 'Verb', reason: 'got-me-gerund' },
  // help stop
  { match: "help [(stop|end|make|start)]", group: 0, tag: "Infinitive", reason: "help-stop" },
  // work in the office
  { match: "#PhrasalVerb (in && #Particle) #Determiner", tag: "#Verb #Preposition #Determiner", unTag: "PhrasalVerb", reason: "work-in-the" },
  // start listening
  { match: "[(stop|start|finish|help)] #Gerund", group: 0, tag: "Infinitive", reason: "start-listening" },
  // mis-fired
  // { match: '[(mis)] #Verb', group: 0, tag: 'Verb', reason: 'mis-firedsa' },
  //back it up
  {
    match: "#Verb (him|her|it|us|himself|herself|itself|everything|something) [(up|down)]",
    group: 0,
    tag: "Adverb",
    reason: "phrasal-pronoun-advb"
  }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/verbs/imperative.js
var notIf2 = "(i|we|they)";
var imperative_default2 = [
  // do not go
  { match: "^do not? [#Infinitive #Particle?]", notIf: notIf2, group: 0, tag: "Imperative", reason: "do-eat" },
  // please go
  { match: "^please do? not? [#Infinitive #Particle?]", group: 0, tag: "Imperative", reason: "please-go" },
  // just go
  { match: "^just do? not? [#Infinitive #Particle?]", group: 0, tag: "Imperative", reason: "just-go" },
  // do it better
  { match: "^[#Infinitive] it #Comparative", notIf: notIf2, group: 0, tag: "Imperative", reason: "do-it-better" },
  // do it again
  { match: "^[#Infinitive] it (please|now|again|plz)", notIf: notIf2, group: 0, tag: "Imperative", reason: "do-it-please" },
  // go quickly.
  { match: "^[#Infinitive] (#Adjective|#Adverb)$", group: 0, tag: "Imperative", notIf: "(so|such|rather|enough)", reason: "go-quickly" },
  // turn down the noise
  { match: "^[#Infinitive] (up|down|over) #Determiner", group: 0, tag: "Imperative", reason: "turn-down" },
  // eat my shorts
  { match: "^[#Infinitive] (your|my|the|a|an|any|each|every|some|more|with|on)", group: 0, notIf: "like", tag: "Imperative", reason: "eat-my-shorts" },
  // tell him the story
  { match: "^[#Infinitive] (him|her|it|us|me|there)", group: 0, tag: "Imperative", reason: "tell-him" },
  // avoid loud noises
  { match: "^[#Infinitive] #Adjective #Noun$", group: 0, tag: "Imperative", reason: "avoid-loud-noises" },
  // call and reserve
  { match: "^[#Infinitive] (#Adjective|#Adverb)? and #Infinitive", group: 0, tag: "Imperative", reason: "call-and-reserve" },
  // one-word imperatives
  { match: "^(go|stop|wait|hurry) please?$", tag: "Imperative", reason: "go" },
  // somebody call
  { match: "^(somebody|everybody) [#Infinitive]", group: 0, tag: "Imperative", reason: "somebody-call" },
  // let's leave
  { match: "^let (us|me) [#Infinitive]", group: 0, tag: "Imperative", reason: "lets-leave" },
  // shut the door
  { match: "^[(shut|close|open|start|stop|end|keep)] #Determiner #Noun", group: 0, tag: "Imperative", reason: "shut-the-door" },
  // turn off the light
  { match: "^[#PhrasalVerb #Particle] #Determiner #Noun", group: 0, tag: "Imperative", reason: "turn-off-the-light" },
  // go to toronto
  { match: "^[go] to .", group: 0, tag: "Imperative", reason: "go-to-toronto" },
  // would you recommend
  { match: "^#Modal you [#Infinitive]", group: 0, tag: "Imperative", reason: "would-you-" },
  // never say
  { match: "^never [#Infinitive]", group: 0, tag: "Imperative", reason: "never-stop" },
  // come have a drink
  { match: "^come #Infinitive", tag: "Imperative", notIf: "on", reason: "come-have" },
  // come and have a drink
  { match: "^come and? #Infinitive", tag: "Imperative . Imperative", notIf: "#PhrasalVerb", reason: "come-and-have" },
  // stay away
  { match: "^stay (out|away|back)", tag: "Imperative", reason: "stay-away" },
  // stay cool
  { match: "^[(stay|be|keep)] #Adjective", group: 0, tag: "Imperative", reason: "stay-cool" },
  // keep it silent
  { match: "^[keep it] #Adjective", group: 0, tag: "Imperative", reason: "keep-it-cool" },
  // don't be late
  { match: "^do not [#Infinitive]", group: 0, tag: "Imperative", reason: "do-not-be" },
  // allow yourself
  { match: "[#Infinitive] (yourself|yourselves)", group: 0, tag: "Imperative", reason: "allow-yourself" },
  // look what
  { match: "[#Infinitive] what .", group: 0, tag: "Imperative", reason: "look-what" },
  // continue playing
  { match: "^[#Infinitive] #Gerund", group: 0, tag: "Imperative", reason: "keep-playing" },
  // go to it
  { match: "^[#Infinitive] (to|for|into|toward|here|there)", group: 0, tag: "Imperative", reason: "go-to" },
  // relax and unwind
  { match: "^[#Infinitive] (and|or) #Infinitive", group: 0, tag: "Imperative", reason: "inf-and-inf" },
  // commit to
  { match: "^[%Noun|Verb%] to", group: 0, tag: "Imperative", reason: "commit-to" },
  // maintain eye contact
  { match: "^[#Infinitive] #Adjective? #Singular #Singular", group: 0, tag: "Imperative", reason: "maintain-eye-contact" },
  // don't forget to clean
  { match: "do not (forget|omit|neglect) to [#Infinitive]", group: 0, tag: "Imperative", reason: "do-not-forget" },
  // pay attention
  { match: "^[(ask|wear|pay|look|help|show|watch|act|fix|kill|stop|start|turn|try|win)] #Noun", group: 0, tag: "Imperative", reason: "pay-attention" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/verbs/adj-gerund.js
var adj_gerund_default3 = [
  // that were growing
  { match: "(that|which) were [%Adj|Gerund%]", group: 0, tag: "Gerund", reason: "that-were-growing" },
  // was dissapointing
  // { match: '#Copula [%Adj|Gerund%]$', group: 0, tag: 'Adjective', reason: 'was-disappointing$' },
  // repairing crubling roads
  { match: "#Gerund [#Gerund] #Plural", group: 0, tag: "Adjective", reason: "hard-working-fam" }
  // { match: '(that|which) were [%Adj|Gerund%]', group: 0, tag: 'Gerund', reason: 'that-were-growing' },
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/verbs/passive.js
var passive_default = [
  // got walked, was walked, were walked
  { match: "(got|were|was|is|are|am) (#PastTense|#Participle)", tag: "Passive", reason: "got-walked" },
  // was being walked
  { match: "(was|were|is|are|am) being (#PastTense|#Participle)", tag: "Passive", reason: "was-being" },
  // had been walked, have been eaten
  { match: "(had|have|has) been (#PastTense|#Participle)", tag: "Passive", reason: "had-been" },
  // will be cleaned
  { match: "will be being? (#PastTense|#Participle)", tag: "Passive", reason: "will-be-cleaned" },
  // suffered by the country
  { match: "#Noun [(#PastTense|#Participle)] by (the|a) #Noun", group: 0, tag: "Passive", reason: "suffered-by" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/_misc.js
var matches = [
  // u r cool
  { match: "u r", tag: "#Pronoun #Copula", reason: "u r" },
  { match: "#Noun [(who|whom)]", group: 0, tag: "Determiner", reason: "captain-who" },
  // ==== Conditions ====
  // had he survived,
  { match: "[had] #Noun+ #PastTense", group: 0, tag: "Condition", reason: "had-he" },
  // were he to survive
  { match: "[were] #Noun+ to #Infinitive", group: 0, tag: "Condition", reason: "were-he" },
  // some sort of
  { match: "some sort of", tag: "Adjective Noun Conjunction", reason: "some-sort-of" },
  // some of
  // { match: 'some of', tag: 'Noun Conjunction', reason: 'some-of' },
  // of some sort
  { match: "of some sort", tag: "Conjunction Adjective Noun", reason: "of-some-sort" },
  // such skill
  { match: "[such] (a|an|is)? #Noun", group: 0, tag: "Determiner", reason: "such-skill" },
  // another one
  // { match: '[another] (#Noun|#Value)', group: 0, tag: 'Adjective', reason: 'another-one' },
  // right after
  { match: "[right] (before|after|in|into|to|toward)", group: 0, tag: "#Adverb", reason: "right-into" },
  // at about
  { match: "#Preposition [about]", group: 0, tag: "Adjective", reason: "at-about" },
  // are ya
  { match: "(are|#Modal|see|do|for) [ya]", group: 0, tag: "Pronoun", reason: "are-ya" },
  // long live
  { match: "[long live] .", group: 0, tag: "#Adjective #Infinitive", reason: "long-live" },
  // plenty of
  { match: "[plenty] of", group: 0, tag: "#Uncountable", reason: "plenty-of" },
  // 'there' as adjective
  { match: "(always|nearly|barely|practically) [there]", group: 0, tag: "Adjective", reason: "always-there" },
  // existential 'there'
  // there she is
  { match: "[there] (#Adverb|#Pronoun)? #Copula", group: 0, tag: "There", reason: "there-is" },
  // is there food
  { match: "#Copula [there] .", group: 0, tag: "There", reason: "is-there" },
  // should there
  { match: "#Modal #Adverb? [there]", group: 0, tag: "There", reason: "should-there" },
  // do you
  { match: "^[do] (you|we|they)", group: 0, tag: "QuestionWord", reason: "do-you" },
  // does he
  { match: "^[does] (he|she|it|#ProperNoun)", group: 0, tag: "QuestionWord", reason: "does-he" },
  // the person who
  { match: "#Determiner #Noun+ [who] #Verb", group: 0, tag: "Preposition", reason: "the-x-who" },
  // the person which
  { match: "#Determiner #Noun+ [which] #Verb", group: 0, tag: "Preposition", reason: "the-x-which" },
  // a while
  { match: "a [while]", group: 0, tag: "Noun", reason: "a-while" },
  // guess who
  { match: "guess who", tag: "#Infinitive #QuestionWord", reason: "guess-who" },
  // swear words
  { match: "[fucking] !#Verb", group: 0, tag: "#Gerund", reason: "f-as-gerund" }
];
var misc_default4 = matches;

// reducer/node_modules/compromise/src/2-two/postTagger/model/nouns/organizations.js
var organizations_default2 = [
  // Foo University
  // { match: `#Noun ${orgMap}`, tag: 'Organization', safe: true, reason: 'foo-university' },
  // // University of Toronto
  // { match: `${orgMap} of #Place`, tag: 'Organization', safe: true, reason: 'university-of-foo' },
  // // foo regional health authority
  // { match: `${orgMap} (health|local|regional)+ authority`, tag: 'Organization', reason: 'regional-health' },
  // // foo stock exchange
  // { match: `${orgMap} (stock|mergantile)+ exchange`, tag: 'Organization', reason: 'stock-exchange' },
  // // foo news service
  // { match: `${orgMap} (daily|evening|local)+ news service?`, tag: 'Organization', reason: 'foo-news' },
  //University of Foo
  { match: "university of #Place", tag: "Organization", reason: "university-of-Foo" },
  //John & Joe's
  { match: "#Noun (&|n) #Noun", tag: "Organization", reason: "Noun-&-Noun" },
  // teachers union of Ontario
  { match: "#Organization of the? #ProperNoun", tag: "Organization", reason: "org-of-place", safe: true },
  //walmart USA
  { match: "#Organization #Country", tag: "Organization", reason: "org-country" },
  //organization
  { match: "#ProperNoun #Organization", tag: "Organization", notIf: "#FirstName", reason: "titlecase-org" },
  //FitBit Inc
  { match: "#ProperNoun (ltd|co|inc|dept|assn|bros)", tag: "Organization", reason: "org-abbrv" },
  // the OCED
  { match: "the [#Acronym]", group: 0, tag: "Organization", reason: "the-acronym", safe: true },
  // government of india
  { match: "government of the? [#Place+]", tag: "Organization", reason: "government-of-x" },
  // school board
  { match: "(health|school|commerce) board", tag: "Organization", reason: "school-board" },
  // special comittee
  {
    match: "(nominating|special|conference|executive|steering|central|congressional) committee",
    tag: "Organization",
    reason: "special-comittee"
  },
  // global trade union
  {
    match: "(world|global|international|national|#Demonym) #Organization",
    tag: "Organization",
    reason: "global-org"
  },
  // schools
  { match: "#Noun+ (public|private) school", tag: "School", reason: "noun-public-school" },
  // new york yankees
  { match: "#Place+ #SportsTeam", tag: "SportsTeam", reason: "place-sportsteam" },
  // 'manchester united'
  {
    match: "(dc|atlanta|minnesota|manchester|newcastle|sheffield) united",
    tag: "SportsTeam",
    reason: "united-sportsteam"
  },
  // 'toronto fc'
  { match: "#Place+ fc", tag: "SportsTeam", reason: "fc-sportsteam" },
  // baltimore quilting club
  {
    match: "#Place+ #Noun{0,2} (club|society|group|team|committee|commission|association|guild|crew)",
    tag: "Organization",
    reason: "place-noun-society"
  }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/nouns/places.js
var places_default2 = [
  // ==== Region ====
  // West Norforlk
  { match: "(west|north|south|east|western|northern|southern|eastern)+ #Place", tag: "Region", reason: "west-norfolk" },
  //some us-state acronyms (exlude: al, in, la, mo, hi, me, md, ok..)
  {
    match: "#City [(al|ak|az|ar|ca|ct|dc|fl|ga|id|il|nv|nh|nj|ny|oh|pa|sc|tn|tx|ut|vt|pr)]",
    group: 0,
    tag: "Region",
    reason: "us-state"
  },
  // portland oregon
  { match: "portland [or]", group: 0, tag: "Region", reason: "portland-or" },
  //words removed from preTagger/placeWords
  {
    match: "#ProperNoun+ (cliff|place|range|pit|place|point|room|grounds|ruins)",
    tag: "Place",
    reason: "foo-point"
  },
  // in Foo California
  { match: "in [#ProperNoun] #Place", group: 0, tag: "Place", reason: "propernoun-place" },
  // Address
  {
    match: "#Value #Noun (st|street|rd|road|crescent|cr|way|tr|terrace|avenue|ave)",
    tag: "Address",
    reason: "address-st"
  },
  // port dover
  { match: "(port|mount|mt) #ProperName", tag: "Place", reason: "port-name" }
  // generic 'oak ridge' names
  // { match: '(oak|maple|spruce|pine|cedar|willow|green|sunset|sunrise) #Place', tag: 'Place', reason: 'tree-name' },
  // generic 'sunset view' names
  // { match: '() #Place', tag: 'Place', reason: 'tree-name' },
  // Sports Arenas and Complexs
  // {
  //   match:
  //     '(#Place+|#Place|#ProperNoun) (memorial|athletic|community|financial)? (sportsplex|stadium|sports centre|sports field|soccer complex|soccer centre|sports complex|civic centre|centre|arena|gardens|complex|coliseum|auditorium|place|building)',
  //   tag: 'Place',
  //   reason: 'sport-complex',
  // },
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/conjunctions.js
var conjunctions_default = [
  // ==== Conjunctions ====
  { match: "[so] #Noun", group: 0, tag: "Conjunction", reason: "so-conj" },
  //how he is driving
  {
    match: "[(who|what|where|why|how|when)] #Noun #Copula #Adverb? (#Verb|#Adjective)",
    group: 0,
    tag: "Conjunction",
    reason: "how-he-is-x"
  },
  // when he
  { match: "#Copula [(who|what|where|why|how|when)] #Noun", group: 0, tag: "Conjunction", reason: "when-he" },
  // says that he..
  { match: "#Verb [that] #Pronoun", group: 0, tag: "Conjunction", reason: "said-that-he" },
  // things that are required
  { match: "#Noun [that] #Copula", group: 0, tag: "Conjunction", reason: "that-are" },
  // things that seem cool
  { match: "#Noun [that] #Verb #Adjective", group: 0, tag: "Conjunction", reason: "that-seem" },
  // wasn't that wide..
  { match: "#Noun #Copula not? [that] #Adjective", group: 0, tag: "Adverb", reason: "that-adj" },
  // ==== Prepositions ====
  //all students
  { match: "#Verb #Adverb? #Noun [(that|which)]", group: 0, tag: "Preposition", reason: "that-prep" },
  //work, which has been done.
  { match: "@hasComma [which] (#Pronoun|#Verb)", group: 0, tag: "Preposition", reason: "which-copula" },
  //folks like her
  { match: "#Noun [like] #Noun", group: 0, tag: "Preposition", reason: "noun-like" },
  //like the time
  { match: "^[like] #Determiner", group: 0, tag: "Preposition", reason: "like-the" },
  //a day like this
  { match: "a #Noun [like] (#Noun|#Determiner)", group: 0, tag: "Preposition", reason: "a-noun-like" },
  // really like
  { match: "#Adverb [like]", group: 0, tag: "Verb", reason: "really-like" },
  // nothing like
  { match: "(not|nothing|never) [like]", group: 0, tag: "Preposition", reason: "nothing-like" },
  // treat them like
  { match: "#Infinitive #Pronoun [like]", group: 0, tag: "Preposition", reason: "treat-them-like" },
  // ==== Questions ====
  // where
  // why
  // when
  // who
  // whom
  // whose
  // what
  // which
  //the word 'how many'
  // { match: '^(how|which)', tag: 'QuestionWord', reason: 'how-question' },
  // how-he, when the
  { match: "[#QuestionWord] (#Pronoun|#Determiner)", group: 0, tag: "Preposition", reason: "how-he" },
  // when stolen
  { match: "[#QuestionWord] #Participle", group: 0, tag: "Preposition", reason: "when-stolen" },
  // how is
  { match: "[how] (#Determiner|#Copula|#Modal|#PastTense)", group: 0, tag: "QuestionWord", reason: "how-is" },
  // children who dance
  { match: "#Plural [(who|which|when)] .", group: 0, tag: "Preposition", reason: "people-who" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/expressions.js
var expressions_default = [
  //swear-words as non-expression POS
  { match: "holy (shit|fuck|hell)", tag: "Expression", reason: "swears-expression" },
  // well..
  { match: "^[(well|so|okay|now)] !#Adjective?", group: 0, tag: "Expression", reason: "well-" },
  // well..
  { match: "^come on", tag: "Expression", reason: "come-on" },
  // sorry
  { match: "(say|says|said) [sorry]", group: 0, tag: "Expression", reason: "say-sorry" },
  // ok,
  { match: "^(ok|alright|shoot|hell|anyways)", tag: "Expression", reason: "ok-" },
  // c'mon marge..
  // { match: '^[come on] #Noun', group: 0, tag: 'Expression', reason: 'come-on' },
  // say,
  { match: "^(say && @hasComma)", tag: "Expression", reason: "say-" },
  { match: "^(like && @hasComma)", tag: "Expression", reason: "like-" },
  // dude we should
  { match: "^[(dude|man|girl)] #Pronoun", group: 0, tag: "Expression", reason: "dude-i" }
];

// reducer/node_modules/compromise/src/2-two/postTagger/model/index.js
var matches2 = [].concat(
  // order matters top-matches can get overwritten
  passive_default,
  adjective_default,
  adj_adverb_default,
  adj_gerund_default2,
  adj_noun_default2,
  adverb_default,
  date_default,
  date_phrase_default,
  nouns_default4,
  noun_gerund_default2,
  verb_noun_default,
  money_default,
  fractions_default,
  numbers_default,
  person_phrase_default,
  ambig_name_default,
  verbs_default3,
  adj_verb_default,
  auxiliary_default,
  phrasal_default,
  imperative_default2,
  adj_gerund_default3,
  misc_default4,
  organizations_default2,
  places_default2,
  conjunctions_default,
  expressions_default
);
var model_default4 = {
  two: {
    matches: matches2
  }
};

// reducer/node_modules/compromise/src/2-two/postTagger/compute/index.js
var net = null;
var postTagger = function(view) {
  const { world: world2 } = view;
  const { model: model5, methods: methods17 } = world2;
  net = net || methods17.one.buildNet(model5.two.matches, world2);
  const document = methods17.two.quickSplit(view.document);
  const ptrs = document.map((terms) => {
    const t3 = terms[0];
    return [t3.index[0], t3.index[1], t3.index[1] + terms.length];
  });
  const m3 = view.update(ptrs);
  m3.cache();
  m3.sweep(net);
  view.uncache();
  view.unfreeze();
  return view;
};
var tagger2 = (view) => view.compute(["freeze", "lexicon", "preTagger", "postTagger", "unfreeze"]);
var compute_default11 = { postTagger, tagger: tagger2 };

// reducer/node_modules/compromise/src/2-two/postTagger/api.js
var round = (n3) => Math.round(n3 * 100) / 100;
function api_default11(View2) {
  View2.prototype.confidence = function() {
    let sum = 0;
    let count = 0;
    this.docs.forEach((terms) => {
      terms.forEach((term) => {
        count += 1;
        sum += term.confidence || 1;
      });
    });
    if (count === 0) {
      return 1;
    }
    return round(sum / count);
  };
  View2.prototype.tagger = function() {
    return this.compute(["tagger"]);
  };
}

// reducer/node_modules/compromise/src/2-two/postTagger/plugin.js
var plugin2 = {
  api: api_default11,
  compute: compute_default11,
  model: model_default4,
  hooks: ["postTagger"]
};
var plugin_default16 = plugin2;

// reducer/node_modules/compromise/src/2-two/lazy/maybeMatch.js
var getWords = function(net3) {
  return Object.keys(net3.hooks).filter((w) => !w.startsWith("#") && !w.startsWith("%"));
};
var maybeMatch = function(doc, net3) {
  const words = getWords(net3);
  if (words.length === 0) {
    return doc;
  }
  if (!doc._cache) {
    doc.cache();
  }
  const cache2 = doc._cache;
  return doc.filter((_m, i3) => {
    return words.some((str) => cache2[i3].has(str));
  });
};
var maybeMatch_default = maybeMatch;

// reducer/node_modules/compromise/src/2-two/lazy/lazyParse.js
var lazyParse = function(input, reg) {
  let net3 = reg;
  if (typeof reg === "string") {
    net3 = this.buildNet([{ match: reg }]);
  }
  const doc = this.tokenize(input);
  const m3 = maybeMatch_default(doc, net3);
  if (m3.found) {
    m3.compute(["index", "tagger"]);
    return m3.match(reg);
  }
  return doc.none();
};
var lazyParse_default = lazyParse;

// reducer/node_modules/compromise/src/2-two/lazy/plugin.js
var plugin_default17 = {
  lib: {
    lazy: lazyParse_default
  }
};

// reducer/node_modules/compromise/src/2-two/swap/api/swap-verb.js
var matchVerb = function(m3, lemma) {
  const conjugate2 = m3.methods.two.transform.verb.conjugate;
  const all4 = conjugate2(lemma, m3.model);
  if (m3.has("#Gerund")) {
    return all4.Gerund;
  }
  if (m3.has("#PastTense")) {
    return all4.PastTense;
  }
  if (m3.has("#PresentTense")) {
    return all4.PresentTense;
  }
  if (m3.has("#Gerund")) {
    return all4.Gerund;
  }
  return lemma;
};
var swapVerb = function(vb3, lemma) {
  let str = lemma;
  vb3.forEach((m3) => {
    if (!m3.has("#Infinitive")) {
      str = matchVerb(m3, lemma);
    }
    m3.replaceWith(str);
  });
  return vb3;
};
var swap_verb_default = swapVerb;

// reducer/node_modules/compromise/src/2-two/swap/api/swap.js
var swapNoun = function(m3, lemma) {
  let str = lemma;
  if (m3.has("#Plural")) {
    const toPlural = m3.methods.two.transform.noun.toPlural;
    str = toPlural(lemma, m3.model);
  }
  m3.replaceWith(str, { possessives: true });
};
var swapAdverb = function(m3, lemma) {
  const { toAdverb: toAdverb2 } = m3.methods.two.transform.adjective;
  const str = lemma;
  const adv = toAdverb2(str);
  if (adv) {
    m3.replaceWith(adv);
  }
};
var swapAdjective = function(m3, lemma) {
  const { toComparative: toComparative3, toSuperlative: toSuperlative3 } = m3.methods.two.transform.adjective;
  let str = lemma;
  if (m3.has("#Comparative")) {
    str = toComparative3(str, m3.model);
  } else if (m3.has("#Superlative")) {
    str = toSuperlative3(str, m3.model);
  }
  if (str) {
    m3.replaceWith(str);
  }
};
var swap = function(from, to, tag) {
  let reg = from.split(/ /g).map((str) => str.toLowerCase().trim());
  reg = reg.filter((str) => str);
  reg = reg.map((str) => `{${str}}`).join(" ");
  let m3 = this.match(reg);
  if (tag) {
    m3 = m3.if(tag);
  }
  if (m3.has("#Verb")) {
    return swap_verb_default(m3, to);
  }
  if (m3.has("#Noun")) {
    return swapNoun(m3, to);
  }
  if (m3.has("#Adverb")) {
    return swapAdverb(m3, to);
  }
  if (m3.has("#Adjective")) {
    return swapAdjective(m3, to);
  }
  return this;
};
var swap_default = swap;

// reducer/node_modules/compromise/src/2-two/swap/plugin.js
var api4 = function(View2) {
  View2.prototype.swap = swap_default;
};
var plugin_default18 = {
  api: api4
};

// reducer/node_modules/compromise/src/two.js
one_default.plugin(plugin_default14);
one_default.plugin(plugin_default15);
one_default.plugin(plugin_default16);
one_default.plugin(plugin_default17);
one_default.plugin(plugin_default18);
var two_default = one_default;

// reducer/node_modules/compromise/src/3-three/adjectives/plugin.js
var toRoot2 = function(adj) {
  const { fromComparative: fromComparative3, fromSuperlative: fromSuperlative3 } = adj.methods.two.transform.adjective;
  const str = adj.text("normal");
  if (adj.has("#Comparative")) {
    return fromComparative3(str, adj.model);
  }
  if (adj.has("#Superlative")) {
    return fromSuperlative3(str, adj.model);
  }
  return str;
};
var api5 = function(View2) {
  class Adjectives extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Adjectives";
    }
    json(opts2 = {}) {
      const { toAdverb: toAdverb2, toNoun: toNoun2, toSuperlative: toSuperlative3, toComparative: toComparative3 } = this.methods.two.transform.adjective;
      opts2.normal = true;
      return this.map((m3) => {
        const json = m3.toView().json(opts2)[0] || {};
        const str = toRoot2(m3);
        json.adjective = {
          adverb: toAdverb2(str, this.model),
          noun: toNoun2(str, this.model),
          superlative: toSuperlative3(str, this.model),
          comparative: toComparative3(str, this.model)
        };
        return json;
      }, []);
    }
    adverbs() {
      return this.before("#Adverb+$").concat(this.after("^#Adverb+"));
    }
    conjugate(n3) {
      const { toComparative: toComparative3, toSuperlative: toSuperlative3, toNoun: toNoun2, toAdverb: toAdverb2 } = this.methods.two.transform.adjective;
      return this.getNth(n3).map((adj) => {
        const root = toRoot2(adj);
        return {
          Adjective: root,
          Comparative: toComparative3(root, this.model),
          Superlative: toSuperlative3(root, this.model),
          Noun: toNoun2(root, this.model),
          Adverb: toAdverb2(root, this.model)
        };
      }, []);
    }
    toComparative(n3) {
      const { toComparative: toComparative3 } = this.methods.two.transform.adjective;
      return this.getNth(n3).map((adj) => {
        const root = toRoot2(adj);
        const str = toComparative3(root, this.model);
        return adj.replaceWith(str);
      });
    }
    toSuperlative(n3) {
      const { toSuperlative: toSuperlative3 } = this.methods.two.transform.adjective;
      return this.getNth(n3).map((adj) => {
        const root = toRoot2(adj);
        const str = toSuperlative3(root, this.model);
        return adj.replaceWith(str);
      });
    }
    toAdverb(n3) {
      const { toAdverb: toAdverb2 } = this.methods.two.transform.adjective;
      return this.getNth(n3).map((adj) => {
        const root = toRoot2(adj);
        const str = toAdverb2(root, this.model);
        return adj.replaceWith(str);
      });
    }
    toNoun(n3) {
      const { toNoun: toNoun2 } = this.methods.two.transform.adjective;
      return this.getNth(n3).map((adj) => {
        const root = toRoot2(adj);
        const str = toNoun2(root, this.model);
        return adj.replaceWith(str);
      });
    }
  }
  View2.prototype.adjectives = function(n3) {
    let m3 = this.match("#Adjective");
    m3 = m3.getNth(n3);
    return new Adjectives(m3.document, m3.pointer);
  };
  View2.prototype.superlatives = function(n3) {
    let m3 = this.match("#Superlative");
    m3 = m3.getNth(n3);
    return new Adjectives(m3.document, m3.pointer);
  };
  View2.prototype.comparatives = function(n3) {
    let m3 = this.match("#Comparative");
    m3 = m3.getNth(n3);
    return new Adjectives(m3.document, m3.pointer);
  };
};
var plugin_default19 = { api: api5 };

// reducer/node_modules/compromise/src/3-three/adverbs/plugin.js
var toRoot3 = function(adj) {
  const str = adj.compute("root").text("root");
  return str;
};
var api6 = function(View2) {
  class Adverbs extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Adverbs";
    }
    conjugate(n3) {
      return this.getNth(n3).map((adv) => {
        const adj = toRoot3(adv);
        return {
          Adverb: adv.text("normal"),
          Adjective: adj
        };
      }, []);
    }
    json(opts2 = {}) {
      const fromAdverb = this.methods.two.transform.adjective.fromAdverb;
      opts2.normal = true;
      return this.map((m3) => {
        const json = m3.toView().json(opts2)[0] || {};
        json.adverb = {
          adjective: fromAdverb(json.normal)
        };
        return json;
      }, []);
    }
  }
  View2.prototype.adverbs = function(n3) {
    let m3 = this.match("#Adverb");
    m3 = m3.getNth(n3);
    return new Adverbs(m3.document, m3.pointer);
  };
};
var plugin_default20 = { api: api6 };

// reducer/node_modules/compromise/src/3-three/chunker/api/clauses.js
var byComma = function(doc) {
  let commas = doc.match("@hasComma");
  commas = commas.filter((m3) => {
    if (m3.growLeft(".").wordCount() === 1) {
      return false;
    }
    if (m3.growRight(". .").wordCount() === 1) {
      return false;
    }
    let more = m3.grow(".");
    more = more.ifNo("@hasComma @hasComma");
    more = more.ifNo("@hasComma (and|or) .");
    more = more.ifNo("(#City && @hasComma) #Country");
    more = more.ifNo("(#WeekDay && @hasComma) #Date");
    more = more.ifNo("(#Date+ && @hasComma) #Value");
    more = more.ifNo("(#Adjective && @hasComma) #Adjective");
    return more.found;
  });
  return doc.splitAfter(commas);
};
var splitParentheses = function(doc) {
  let matches3 = doc.parentheses();
  matches3 = matches3.filter((m3) => {
    return m3.wordCount() >= 3 && m3.has("#Verb") && m3.has("#Noun");
  });
  return doc.splitOn(matches3);
};
var splitQuotes = function(doc) {
  let matches3 = doc.quotations();
  matches3 = matches3.filter((m3) => {
    return m3.wordCount() >= 3 && m3.has("#Verb") && m3.has("#Noun");
  });
  return doc.splitOn(matches3);
};
var clauses = function(n3) {
  let found = this;
  found = splitParentheses(found);
  found = splitQuotes(found);
  found = byComma(found);
  found = found.splitAfter("(@hasEllipses|@hasSemicolon|@hasDash|@hasColon)");
  found = found.splitAfter("^#Pronoun (said|says)");
  found = found.splitBefore("(said|says) #ProperNoun$");
  found = found.splitBefore(". . if .{4}");
  found = found.splitBefore("and while");
  found = found.splitBefore("now that");
  found = found.splitBefore("ever since");
  found = found.splitBefore("(supposing|although)");
  found = found.splitBefore("even (while|if|though)");
  found = found.splitBefore("(whereas|whose)");
  found = found.splitBefore("as (though|if)");
  found = found.splitBefore("(til|until)");
  const m3 = found.match("#Verb .* [but] .* #Verb", 0);
  if (m3.found) {
    found = found.splitBefore(m3);
  }
  const condition = found.if("if .{2,9} then .").match("then");
  found = found.splitBefore(condition);
  if (typeof n3 === "number") {
    found = found.get(n3);
  }
  return found;
};
var clauses_default = clauses;

// reducer/node_modules/compromise/src/3-three/chunker/api/chunks.js
var chunks = function(doc) {
  const all4 = [];
  let lastOne = null;
  const m3 = doc.clauses();
  m3.docs.forEach((terms) => {
    terms.forEach((term) => {
      if (!term.chunk || term.chunk !== lastOne) {
        lastOne = term.chunk;
        all4.push([term.index[0], term.index[1], term.index[1] + 1]);
      } else {
        all4[all4.length - 1][2] = term.index[1] + 1;
      }
    });
    lastOne = null;
  });
  const parts = doc.update(all4);
  return parts;
};
var chunks_default2 = chunks;

// reducer/node_modules/compromise/src/3-three/chunker/api/api.js
var api7 = function(View2) {
  class Chunks extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Chunks";
    }
    isVerb() {
      return this.filter((c2) => c2.has("<Verb>"));
    }
    isNoun() {
      return this.filter((c2) => c2.has("<Noun>"));
    }
    isAdjective() {
      return this.filter((c2) => c2.has("<Adjective>"));
    }
    isPivot() {
      return this.filter((c2) => c2.has("<Pivot>"));
    }
    // chunk-friendly debug
    debug() {
      this.toView().debug("chunks");
      return this;
    }
    // overloaded - keep Sentences class
    update(pointer) {
      const m3 = new Chunks(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  View2.prototype.chunks = function(n3) {
    let m3 = chunks_default2(this);
    m3 = m3.getNth(n3);
    return new Chunks(this.document, m3.pointer);
  };
  View2.prototype.clauses = clauses_default;
};
var api_default12 = api7;

// reducer/node_modules/compromise/src/3-three/chunker/compute/01-easy.js
var byWord2 = {
  this: "Noun",
  then: "Pivot"
};
var easyMode = function(document) {
  for (let n3 = 0; n3 < document.length; n3 += 1) {
    for (let t3 = 0; t3 < document[n3].length; t3 += 1) {
      const term = document[n3][t3];
      if (byWord2.hasOwnProperty(term.normal) === true) {
        term.chunk = byWord2[term.normal];
        continue;
      }
      if (term.tags.has("Verb")) {
        term.chunk = "Verb";
        continue;
      }
      if (term.tags.has("Noun") || term.tags.has("Determiner")) {
        term.chunk = "Noun";
        continue;
      }
      if (term.tags.has("Value")) {
        term.chunk = "Noun";
        continue;
      }
      if (term.tags.has("QuestionWord")) {
        term.chunk = "Pivot";
        continue;
      }
    }
  }
};
var easy_default = easyMode;

// reducer/node_modules/compromise/src/3-three/chunker/compute/02-neighbours.js
var byNeighbour = function(document) {
  for (let n3 = 0; n3 < document.length; n3 += 1) {
    for (let t3 = 0; t3 < document[n3].length; t3 += 1) {
      const term = document[n3][t3];
      if (term.chunk) {
        continue;
      }
      const onRight = document[n3][t3 + 1];
      const onLeft = document[n3][t3 - 1];
      if (term.tags.has("Adjective")) {
        if (onLeft && onLeft.tags.has("Copula")) {
          term.chunk = "Adjective";
          continue;
        }
        if (onLeft && onLeft.tags.has("Determiner")) {
          term.chunk = "Noun";
          continue;
        }
        if (onRight && onRight.tags.has("Noun")) {
          term.chunk = "Noun";
          continue;
        }
        continue;
      }
      if (term.tags.has("Adverb") || term.tags.has("Negative")) {
        if (onLeft && onLeft.tags.has("Adjective")) {
          term.chunk = "Adjective";
          continue;
        }
        if (onLeft && onLeft.tags.has("Verb")) {
          term.chunk = "Verb";
          continue;
        }
        if (onRight && onRight.tags.has("Adjective")) {
          term.chunk = "Adjective";
          continue;
        }
        if (onRight && onRight.tags.has("Verb")) {
          term.chunk = "Verb";
          continue;
        }
      }
    }
  }
};
var neighbours_default3 = byNeighbour;

// reducer/node_modules/compromise/src/3-three/chunker/compute/03-matcher.js
var rules = [
  // === Conjunction ===
  // that the houses
  { match: "[that] #Determiner #Noun", group: 0, chunk: "Pivot" },
  // estimated that
  { match: "#PastTense [that]", group: 0, chunk: "Pivot" },
  // so the
  { match: "[so] #Determiner", group: 0, chunk: "Pivot" },
  // === Adjective ===
  // was really nice
  { match: "#Copula #Adverb+? [#Adjective]", group: 0, chunk: "Adjective" },
  // was nice
  // { match: '#Copula [#Adjective]', group: 0, chunk: 'Adjective' },
  // nice and cool
  { match: "#Adjective and #Adjective", chunk: "Adjective" },
  // really nice
  // { match: '#Adverb+ #Adjective', chunk: 'Adjective' },
  // === Verb ===
  // quickly and suddenly run
  { match: "#Adverb+ and #Adverb #Verb", chunk: "Verb" },
  // sitting near
  { match: "#Gerund #Adjective$", chunk: "Verb" },
  // going to walk
  { match: "#Gerund to #Verb", chunk: "Verb" },
  // come and have a drink
  { match: "#PresentTense and #PresentTense", chunk: "Verb" },
  // really not
  { match: "#Adverb #Negative", chunk: "Verb" },
  // want to see
  { match: "(want|wants|wanted) to #Infinitive", chunk: "Verb" },
  // walk ourselves
  { match: "#Verb #Reflexive", chunk: "Verb" },
  // tell him the story
  // { match: '#PresentTense [#Pronoun] #Determiner', group: 0, chunk: 'Verb' },
  // tries to walk
  { match: "#Verb [to] #Adverb? #Infinitive", group: 0, chunk: "Verb" },
  // upon seeing
  { match: "[#Preposition] #Gerund", group: 0, chunk: "Verb" },
  // ensure that
  { match: "#Infinitive [that] <Noun>", group: 0, chunk: "Verb" },
  // === Noun ===
  // the brown fox
  // { match: '#Determiner #Adjective+ #Noun', chunk: 'Noun' },
  // the fox
  // { match: '(the|this) <Noun>', chunk: 'Noun' },
  // brown fox
  // { match: '#Adjective+ <Noun>', chunk: 'Noun' },
  // --- of ---
  // son of a gun
  { match: "#Noun of #Determiner? #Noun", chunk: "Noun" },
  // 3 beautiful women
  { match: "#Value+ #Adverb? #Adjective", chunk: "Noun" },
  // the last russian tsar
  { match: "the [#Adjective] #Noun", chunk: "Noun" },
  // breakfast in bed
  { match: "#Singular in #Determiner? #Singular", chunk: "Noun" },
  // Some citizens in this Canadian capital
  { match: "#Plural [in] #Determiner? #Noun", group: 0, chunk: "Pivot" },
  // indoor and outdoor seating
  { match: "#Noun and #Determiner? #Noun", notIf: "(#Possessive|#Pronoun)", chunk: "Noun" }
  //  boys and girls
  // { match: '#Plural and #Determiner? #Plural', chunk: 'Noun' },
  // tomatoes and cheese
  // { match: '#Noun and #Determiner? #Noun', notIf: '#Pronoun', chunk: 'Noun' },
  // that is why
  // { match: '[that] (is|was)', group: 0, chunk: 'Noun' },
];
var net2 = null;
var matcher = function(view, _2, world2) {
  const { methods: methods17 } = world2;
  net2 = net2 || methods17.one.buildNet(rules, world2);
  view.sweep(net2);
};
var matcher_default = matcher;

// reducer/node_modules/compromise/src/3-three/chunker/compute/04-fallback.js
var setChunk = function(term, chunk) {
  const env2 = typeof process === "undefined" || !process.env ? self.env || {} : process.env;
  if (env2.DEBUG_CHUNKS) {
    const str = (term.normal + "'").padEnd(8);
    console.log(`  | '${str}  \u2192  \x1B[34m${chunk.padEnd(12)}\x1B[0m \x1B[2m -fallback- \x1B[0m`);
  }
  term.chunk = chunk;
};
var fallback = function(document) {
  for (let n3 = 0; n3 < document.length; n3 += 1) {
    for (let t3 = 0; t3 < document[n3].length; t3 += 1) {
      const term = document[n3][t3];
      if (term.chunk === void 0) {
        if (term.tags.has("Conjunction")) {
          setChunk(term, "Pivot");
        } else if (term.tags.has("Preposition")) {
          setChunk(term, "Pivot");
        } else if (term.tags.has("Adverb")) {
          setChunk(term, "Verb");
        } else {
          term.chunk = "Noun";
        }
      }
    }
  }
};
var fallback_default2 = fallback;

// reducer/node_modules/compromise/src/3-three/chunker/compute/05-fixUp.js
var fixUp = function(docs) {
  const byChunk = [];
  let current = null;
  docs.forEach((terms) => {
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const term = terms[i3];
      if (current && term.chunk === current) {
        byChunk[byChunk.length - 1].terms.push(term);
      } else {
        byChunk.push({ chunk: term.chunk, terms: [term] });
        current = term.chunk;
      }
    }
  });
  byChunk.forEach((c2) => {
    if (c2.chunk === "Verb") {
      const hasVerb = c2.terms.find((t3) => t3.tags.has("Verb"));
      if (!hasVerb) {
        c2.terms.forEach((t3) => t3.chunk = null);
      }
    }
  });
};
var fixUp_default = fixUp;

// reducer/node_modules/compromise/src/3-three/chunker/compute/index.js
var findChunks = function(view) {
  const { document, world: world2 } = view;
  easy_default(document);
  neighbours_default3(document);
  matcher_default(view, document, world2);
  fallback_default2(document, world2);
  fixUp_default(document, world2);
};
var compute_default12 = { chunks: findChunks };

// reducer/node_modules/compromise/src/3-three/chunker/plugin.js
var plugin_default21 = {
  compute: compute_default12,
  api: api_default12,
  hooks: ["chunks"]
};

// reducer/node_modules/compromise/src/3-three/misc/acronyms/index.js
var hasPeriod2 = /\./g;
var api8 = function(View2) {
  class Acronyms extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Acronyms";
    }
    strip() {
      this.docs.forEach((terms) => {
        terms.forEach((term) => {
          term.text = term.text.replace(hasPeriod2, "");
          term.normal = term.normal.replace(hasPeriod2, "");
        });
      });
      return this;
    }
    addPeriods() {
      this.docs.forEach((terms) => {
        terms.forEach((term) => {
          term.text = term.text.replace(hasPeriod2, "");
          term.normal = term.normal.replace(hasPeriod2, "");
          term.text = term.text.split("").join(".") + ".";
          term.normal = term.normal.split("").join(".") + ".";
        });
      });
      return this;
    }
  }
  View2.prototype.acronyms = function(n3) {
    let m3 = this.match("#Acronym");
    m3 = m3.getNth(n3);
    return new Acronyms(m3.document, m3.pointer);
  };
};
var acronyms_default2 = api8;

// reducer/node_modules/compromise/src/3-three/misc/parentheses/fns.js
var hasOpen2 = /\(/;
var hasClosed2 = /\)/;
var findEnd = function(terms, i3) {
  for (; i3 < terms.length; i3 += 1) {
    if (terms[i3].post && hasClosed2.test(terms[i3].post)) {
      let [, index3] = terms[i3].index;
      index3 = index3 || 0;
      return index3;
    }
  }
  return null;
};
var find2 = function(doc) {
  const ptrs = [];
  doc.docs.forEach((terms) => {
    const isOpen = false;
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const term = terms[i3];
      if (!isOpen && term.pre && hasOpen2.test(term.pre)) {
        const end2 = findEnd(terms, i3);
        if (end2 !== null) {
          const [n3, start2] = terms[i3].index;
          ptrs.push([n3, start2, end2 + 1, terms[i3].id]);
          i3 = end2;
        }
      }
    }
  });
  return doc.update(ptrs);
};
var strip = function(m3) {
  m3.docs.forEach((terms) => {
    terms[0].pre = terms[0].pre.replace(hasOpen2, "");
    const last = terms[terms.length - 1];
    last.post = last.post.replace(hasClosed2, "");
  });
  return m3;
};

// reducer/node_modules/compromise/src/3-three/misc/parentheses/index.js
var api9 = function(View2) {
  class Parentheses extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Possessives";
    }
    strip() {
      return strip(this);
    }
  }
  View2.prototype.parentheses = function(n3) {
    let m3 = find2(this);
    m3 = m3.getNth(n3);
    return new Parentheses(m3.document, m3.pointer);
  };
};
var parentheses_default = api9;

// reducer/node_modules/compromise/src/3-three/misc/possessives/index.js
var apostropheS2 = /'s$/;
var find3 = function(doc) {
  let m3 = doc.match("#Possessive+");
  if (m3.has("#Person")) {
    m3 = m3.growLeft("#Person+");
  }
  if (m3.has("#Place")) {
    m3 = m3.growLeft("#Place+");
  }
  if (m3.has("#Organization")) {
    m3 = m3.growLeft("#Organization+");
  }
  return m3;
};
var api10 = function(View2) {
  class Possessives extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Possessives";
    }
    strip() {
      this.docs.forEach((terms) => {
        terms.forEach((term) => {
          term.text = term.text.replace(apostropheS2, "");
          term.normal = term.normal.replace(apostropheS2, "");
        });
      });
      return this;
    }
  }
  View2.prototype.possessives = function(n3) {
    let m3 = find3(this);
    m3 = m3.getNth(n3);
    return new Possessives(m3.document, m3.pointer);
  };
};
var possessives_default = api10;

// reducer/node_modules/compromise/src/3-three/misc/quotations/fns.js
var pairs2 = {
  '"': '"',
  // 'StraightDoubleQuotes'
  "\uFF02": "\uFF02",
  // 'StraightDoubleQuotesWide'
  "'": "'",
  // 'StraightSingleQuotes'
  "\u201C": "\u201D",
  // 'CommaDoubleQuotes'
  "\u2018": "\u2019",
  // 'CommaSingleQuotes'
  "\u201F": "\u201D",
  // 'CurlyDoubleQuotesReversed'
  "\u201B": "\u2019",
  // 'CurlySingleQuotesReversed'
  "\u201E": "\u201D",
  // 'LowCurlyDoubleQuotes'
  "\u2E42": "\u201D",
  // 'LowCurlyDoubleQuotesReversed'
  "\u201A": "\u2019",
  // 'LowCurlySingleQuotes'
  "\xAB": "\xBB",
  // 'AngleDoubleQuotes' «, »
  "\u2039": "\u203A",
  // 'AngleSingleQuotes'
  // Prime 'non quotation'
  "\u2035": "\u2032",
  // 'PrimeSingleQuotes'
  "\u2036": "\u2033",
  // 'PrimeDoubleQuotes'
  "\u2037": "\u2034",
  // 'PrimeTripleQuotes'
  // Prime 'quotation' variation
  "\u301D": "\u301E",
  // 'PrimeDoubleQuotes'
  "`": "\xB4",
  // 'PrimeSingleQuotes'
  "\u301F": "\u301E"
  // 'LowPrimeDoubleQuotesReversed'
};
var hasOpen3 = RegExp("[" + Object.keys(pairs2).join("") + "]");
var hasClosed3 = RegExp("[" + Object.values(pairs2).join("") + "]");
var findEnd2 = function(terms, i3) {
  const have = terms[i3].pre.match(hasOpen3)[0] || "";
  if (!have || !pairs2[have]) {
    return null;
  }
  const want = pairs2[have];
  for (; i3 < terms.length; i3 += 1) {
    if (terms[i3].post && terms[i3].post.match(want)) {
      return i3;
    }
  }
  return null;
};
var find4 = function(doc) {
  const ptrs = [];
  doc.docs.forEach((terms) => {
    const isOpen = false;
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const term = terms[i3];
      if (!isOpen && term.pre && hasOpen3.test(term.pre)) {
        const end2 = findEnd2(terms, i3);
        if (end2 !== null) {
          const [n3, start2] = terms[i3].index;
          ptrs.push([n3, start2, end2 + 1, terms[i3].id]);
          i3 = end2;
        }
      }
    }
  });
  return doc.update(ptrs);
};
var strip2 = function(m3) {
  m3.docs.forEach((terms) => {
    terms[0].pre = terms[0].pre.replace(hasOpen3, "");
    const lastTerm = terms[terms.length - 1];
    lastTerm.post = lastTerm.post.replace(hasClosed3, "");
  });
};

// reducer/node_modules/compromise/src/3-three/misc/quotations/index.js
var api11 = function(View2) {
  class Quotations extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Possessives";
    }
    strip() {
      return strip2(this);
    }
  }
  View2.prototype.quotations = function(n3) {
    let m3 = find4(this);
    m3 = m3.getNth(n3);
    return new Quotations(m3.document, m3.pointer);
  };
};
var quotations_default = api11;

// reducer/node_modules/compromise/src/3-three/misc/selections/index.js
var phoneNumbers = function(n3) {
  let m3 = this.splitAfter("@hasComma");
  m3 = m3.match("#PhoneNumber+");
  m3 = m3.getNth(n3);
  return m3;
};
var selections = [
  ["hyphenated", "@hasHyphen ."],
  ["hashTags", "#HashTag"],
  ["emails", "#Email"],
  ["emoji", "#Emoji"],
  ["emoticons", "#Emoticon"],
  ["atMentions", "#AtMention"],
  ["urls", "#Url"],
  // ['pronouns', '#Pronoun'],
  ["conjunctions", "#Conjunction"],
  ["prepositions", "#Preposition"],
  ["abbreviations", "#Abbreviation"],
  ["honorifics", "#Honorific"]
];
var aliases2 = [
  ["emojis", "emoji"],
  ["atmentions", "atMentions"]
];
var addMethods = function(View2) {
  selections.forEach((a2) => {
    View2.prototype[a2[0]] = function(n3) {
      const m3 = this.match(a2[1]);
      return typeof n3 === "number" ? m3.get(n3) : m3;
    };
  });
  View2.prototype.phoneNumbers = phoneNumbers;
  aliases2.forEach((a2) => {
    View2.prototype[a2[0]] = View2.prototype[a2[1]];
  });
};
var selections_default = addMethods;

// reducer/node_modules/compromise/src/3-three/misc/slashes/index.js
var hasSlash2 = /\//;
var api12 = function(View2) {
  class Slashes extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Slashes";
    }
    split() {
      return this.map((m3) => {
        const str = m3.text();
        const arr = str.split(hasSlash2);
        m3 = m3.replaceWith(arr.join(" "));
        return m3.growRight("(" + arr.join("|") + ")+");
      });
    }
  }
  View2.prototype.slashes = function(n3) {
    let m3 = this.match("#SlashedTerm");
    m3 = m3.getNth(n3);
    return new Slashes(m3.document, m3.pointer);
  };
};
var slashes_default2 = api12;

// reducer/node_modules/compromise/src/3-three/misc/plugin.js
var plugin_default22 = {
  api: function(View2) {
    acronyms_default2(View2);
    parentheses_default(View2);
    possessives_default(View2);
    quotations_default(View2);
    selections_default(View2);
    slashes_default2(View2);
  }
};

// reducer/node_modules/compromise/src/3-three/normalize/methods.js
var termLoop2 = function(view, cb) {
  view.docs.forEach((terms) => {
    terms.forEach(cb);
  });
};
var methods_default10 = {
  // remove titlecasing, uppercase
  "case": (doc) => {
    termLoop2(doc, (term) => {
      term.text = term.text.toLowerCase();
    });
  },
  // visually romanize/anglicize 'Björk' into 'Bjork'.
  "unicode": (doc) => {
    const world2 = doc.world;
    const killUnicode2 = world2.methods.one.killUnicode;
    termLoop2(doc, (term) => term.text = killUnicode2(term.text, world2));
  },
  // remove hyphens, newlines, and force one space between words
  "whitespace": (doc) => {
    termLoop2(doc, (term) => {
      term.post = term.post.replace(/\s+/g, " ");
      term.post = term.post.replace(/\s([.,?!:;])/g, "$1");
      term.pre = term.pre.replace(/\s+/g, "");
    });
  },
  // remove commas, semicolons - but keep sentence-ending punctuation
  "punctuation": (doc) => {
    termLoop2(doc, (term) => {
      term.post = term.post.replace(/[–—-]/g, " ");
      term.post = term.post.replace(/[,:;]/g, "");
      term.post = term.post.replace(/\.{2,}/g, "");
      term.post = term.post.replace(/\?{2,}/g, "?");
      term.post = term.post.replace(/!{2,}/g, "!");
      term.post = term.post.replace(/\?!+/g, "?");
    });
    const docs = doc.docs;
    const terms = docs[docs.length - 1];
    if (terms && terms.length > 0) {
      const lastTerm = terms[terms.length - 1];
      lastTerm.post = lastTerm.post.replace(/ /g, "");
    }
  },
  // ====== subsets ===
  // turn "isn't" to "is not"
  "contractions": (doc) => {
    doc.contractions().expand();
  },
  //remove periods from acronyms, like 'F.B.I.'
  "acronyms": (doc) => {
    doc.acronyms().strip();
  },
  //remove words inside brackets (like these)
  "parentheses": (doc) => {
    doc.parentheses().strip();
  },
  // turn "Google's tax return" to "Google tax return"
  "possessives": (doc) => {
    doc.possessives().strip();
  },
  // turn "tax return" to tax return
  "quotations": (doc) => {
    doc.quotations().strip();
  },
  // remove them
  "emoji": (doc) => {
    doc.emojis().remove();
  },
  //turn 'Vice Admiral John Smith' to 'John Smith'
  "honorifics": (doc) => {
    doc.match("#Honorific+ #Person").honorifics().remove();
  },
  // remove needless adverbs
  "adverbs": (doc) => {
    doc.adverbs().remove();
  },
  // turn "batmobiles" into "batmobile"
  "nouns": (doc) => {
    doc.nouns().toSingular();
  },
  // turn all verbs into Infinitive form - "I walked" → "I walk"
  "verbs": (doc) => {
    doc.verbs().toInfinitive();
  },
  // turn "fifty" into "50"
  "numbers": (doc) => {
    doc.numbers().toNumber();
  },
  /** remove bullets from beginning of phrase */
  "debullet": (doc) => {
    const hasBullet = /^\s*([-–—*•])\s*$/;
    doc.docs.forEach((terms) => {
      if (hasBullet.test(terms[0].pre)) {
        terms[0].pre = terms[0].pre.replace(hasBullet, "");
      }
    });
    return doc;
  }
};

// reducer/node_modules/compromise/src/3-three/normalize/api.js
var split2 = (str) => {
  return str.split("|").reduce((h2, k2) => {
    h2[k2] = true;
    return h2;
  }, {});
};
var light = "unicode|punctuation|whitespace|acronyms";
var medium = "|case|contractions|parentheses|quotations|emoji|honorifics|debullet";
var heavy = "|possessives|adverbs|nouns|verbs";
var presets = {
  light: split2(light),
  medium: split2(light + medium),
  heavy: split2(light + medium + heavy)
};
function api_default13(View2) {
  View2.prototype.normalize = function(opts2 = "light") {
    if (typeof opts2 === "string") {
      opts2 = presets[opts2];
    }
    Object.keys(opts2).forEach((fn) => {
      if (methods_default10.hasOwnProperty(fn)) {
        methods_default10[fn](this, opts2[fn]);
      }
    });
    return this;
  };
}

// reducer/node_modules/compromise/src/3-three/normalize/plugin.js
var plugin_default23 = {
  api: api_default13
};

// reducer/node_modules/compromise/src/3-three/nouns/find.js
var findNouns = function(doc) {
  let m3 = doc.clauses().match("<Noun>");
  let commas = m3.match("@hasComma");
  commas = commas.not("#Place");
  if (commas.found) {
    m3 = m3.splitAfter(commas);
  }
  m3 = m3.splitOn("#Expression");
  m3 = m3.splitOn("(he|she|we|you|they|i)");
  m3 = m3.splitOn("(#Noun|#Adjective) [(he|him|she|it)]", 0);
  m3 = m3.splitOn("[(he|him|she|it)] (#Determiner|#Value)", 0);
  m3 = m3.splitBefore("#Noun [(the|a|an)] #Adjective? #Noun", 0);
  m3 = m3.splitOn("[(here|there)] #Noun", 0);
  m3 = m3.splitOn("[#Noun] (here|there)", 0);
  m3 = m3.splitBefore("(our|my|their|your)");
  m3 = m3.splitOn("#Noun [#Determiner]", 0);
  m3 = m3.if("#Noun");
  return m3;
};
var find_default = findNouns;

// reducer/node_modules/compromise/src/3-three/nouns/api/isSubordinate.js
var list2 = [
  "after",
  "although",
  "as if",
  "as long as",
  "as",
  "because",
  "before",
  "even if",
  "even though",
  "ever since",
  "if",
  "in order that",
  "provided that",
  "since",
  "so that",
  "than",
  "that",
  "though",
  "unless",
  "until",
  "what",
  "whatever",
  "when",
  "whenever",
  "where",
  "whereas",
  "wherever",
  "whether",
  "which",
  "whichever",
  "who",
  "whoever",
  "whom",
  "whomever",
  "whose"
];
var isSubordinate = function(m3) {
  if (m3.before("#Preposition$").found) {
    return true;
  }
  const leadIn = m3.before();
  if (!leadIn.found) {
    return false;
  }
  for (let i3 = 0; i3 < list2.length; i3 += 1) {
    if (m3.has(list2[i3])) {
      return true;
    }
  }
  return false;
};
var isSubordinate_default = isSubordinate;

// reducer/node_modules/compromise/src/3-three/nouns/api/isPlural.js
var notPlural2 = "(#Pronoun|#Place|#Value|#Person|#Uncountable|#Month|#WeekDay|#Holiday|#Possessive)";
var isPlural2 = function(m3, root) {
  if (m3.has("#Plural")) {
    return true;
  }
  if (m3.has("#Noun and #Noun")) {
    return true;
  }
  if (m3.has("(we|they)")) {
    return true;
  }
  if (root.has(notPlural2) === true) {
    return false;
  }
  if (m3.has("#Singular")) {
    return false;
  }
  const str = root.text("normal");
  return str.length > 3 && str.endsWith("s") && !str.endsWith("ss");
};
var isPlural_default = isPlural2;

// reducer/node_modules/compromise/src/3-three/nouns/api/parse.js
var getRoot2 = function(m3) {
  let tmp = m3.clone();
  tmp = tmp.match("#Noun+");
  tmp = tmp.remove("(#Adjective|#Preposition|#Determiner|#Value)");
  tmp = tmp.not("#Possessive");
  tmp = tmp.first();
  if (!tmp.found) {
    return m3;
  }
  return tmp;
};
var parseNoun = function(m3) {
  const root = getRoot2(m3);
  return {
    determiner: m3.match("#Determiner").eq(0),
    adjectives: m3.match("#Adjective"),
    number: m3.values(),
    isPlural: isPlural_default(m3, root),
    isSubordinate: isSubordinate_default(m3),
    root
  };
};
var parse_default3 = parseNoun;

// reducer/node_modules/compromise/src/3-three/nouns/api/toJSON.js
var toText2 = (m3) => m3.text();
var toArray2 = (m3) => m3.json({ terms: false, normal: true }).map((s3) => s3.normal);
var getNum = function(m3) {
  const num = null;
  if (!m3.found) {
    return num;
  }
  const val = m3.values(0);
  if (val.found) {
    const obj = val.parse()[0] || {};
    return obj.num;
  }
  return num;
};
var toJSON2 = function(m3) {
  const res = parse_default3(m3);
  return {
    root: toText2(res.root),
    number: getNum(res.number),
    determiner: toText2(res.determiner),
    adjectives: toArray2(res.adjectives),
    isPlural: res.isPlural,
    isSubordinate: res.isSubordinate
  };
};
var toJSON_default = toJSON2;

// reducer/node_modules/compromise/src/3-three/nouns/api/hasPlural.js
var hasPlural = function(root) {
  if (root.has("^(#Uncountable|#ProperNoun|#Place|#Pronoun|#Acronym)+$")) {
    return false;
  }
  return true;
};
var hasPlural_default = hasPlural;

// reducer/node_modules/compromise/src/3-three/nouns/api/toPlural.js
var keep = { tags: true };
var nounToPlural = function(m3, parsed) {
  if (parsed.isPlural === true) {
    return m3;
  }
  if (parsed.root.has("#Possessive")) {
    parsed.root = parsed.root.possessives().strip();
  }
  if (!hasPlural_default(parsed.root)) {
    return m3;
  }
  const { methods: methods17, model: model5 } = m3.world;
  const { toPlural } = methods17.two.transform.noun;
  const str = parsed.root.text({ keepPunct: false });
  const plural2 = toPlural(str, model5);
  m3.match(parsed.root).replaceWith(plural2, keep).tag("Plural", "toPlural");
  if (parsed.determiner.has("(a|an)")) {
    m3.remove(parsed.determiner);
  }
  const copula = parsed.root.after("not? #Adverb+? [#Copula]", 0);
  if (copula.found) {
    if (copula.has("is")) {
      m3.replace(copula, "are");
    } else if (copula.has("was")) {
      m3.replace(copula, "were");
    }
  }
  return m3;
};
var toPlural_default2 = nounToPlural;

// reducer/node_modules/compromise/src/3-three/nouns/api/toSingular.js
var keep2 = { tags: true };
var nounToSingular = function(m3, parsed) {
  if (parsed.isPlural === false) {
    return m3;
  }
  const { methods: methods17, model: model5 } = m3.world;
  const { toSingular: toSingular2 } = methods17.two.transform.noun;
  const str = parsed.root.text("normal");
  const single = toSingular2(str, model5);
  m3.replace(parsed.root, single, keep2).tag("Singular", "toPlural");
  return m3;
};
var toSingular_default2 = nounToSingular;

// reducer/node_modules/compromise/src/3-three/nouns/api/api.js
var api13 = function(View2) {
  class Nouns extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Nouns";
    }
    parse(n3) {
      return this.getNth(n3).map(parse_default3);
    }
    json(n3) {
      const opts2 = typeof n3 === "object" ? n3 : {};
      return this.getNth(n3).map((m3) => {
        const json = m3.toView().json(opts2)[0] || {};
        if (opts2 && opts2.noun !== false) {
          json.noun = toJSON_default(m3);
        }
        return json;
      }, []);
    }
    conjugate(n3) {
      const methods17 = this.world.methods.two.transform.noun;
      return this.getNth(n3).map((m3) => {
        const parsed = parse_default3(m3);
        const root = parsed.root.compute("root").text("root");
        const res = {
          Singular: root
        };
        if (hasPlural_default(parsed.root)) {
          res.Plural = methods17.toPlural(root, this.model);
        }
        if (res.Singular === res.Plural) {
          delete res.Plural;
        }
        return res;
      }, []);
    }
    isPlural(n3) {
      const res = this.filter((m3) => parse_default3(m3).isPlural);
      return res.getNth(n3);
    }
    isSingular(n3) {
      const res = this.filter((m3) => !parse_default3(m3).isPlural);
      return res.getNth(n3);
    }
    adjectives(n3) {
      let res = this.update([]);
      this.forEach((m3) => {
        const adj = parse_default3(m3).adjectives;
        if (adj.found) {
          res = res.concat(adj);
        }
      });
      return res.getNth(n3);
    }
    toPlural(n3) {
      return this.getNth(n3).map((m3) => {
        return toPlural_default2(m3, parse_default3(m3));
      });
    }
    toSingular(n3) {
      return this.getNth(n3).map((m3) => {
        const res = parse_default3(m3);
        return toSingular_default2(m3, res);
      });
    }
    // create a new View, from this one
    update(pointer) {
      const m3 = new Nouns(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  View2.prototype.nouns = function(n3) {
    let m3 = find_default(this);
    m3 = m3.getNth(n3);
    return new Nouns(this.document, m3.pointer);
  };
};
var api_default14 = api13;

// reducer/node_modules/compromise/src/3-three/nouns/plugin.js
var plugin_default24 = {
  api: api_default14
};

// reducer/node_modules/compromise/src/3-three/numbers/fractions/find.js
var findFractions = function(doc, n3) {
  let m3 = doc.match("#Fraction+");
  m3 = m3.filter((r2) => {
    return !r2.lookBehind("#Value and$").found;
  });
  m3 = m3.notIf("#Value seconds");
  if (typeof n3 === "number") {
    m3 = m3.eq(n3);
  }
  return m3;
};
var find_default2 = findFractions;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/parse/toNumber/findModifiers.js
var findModifiers = (str) => {
  const mults = [
    {
      reg: /^(minus|negative)[\s-]/i,
      mult: -1
    },
    {
      reg: /^(a\s)?half[\s-](of\s)?/i,
      mult: 0.5
    }
    //  {
    //   reg: /^(a\s)?quarter[\s\-]/i,
    //   mult: 0.25
    // }
  ];
  for (let i3 = 0; i3 < mults.length; i3++) {
    if (mults[i3].reg.test(str) === true) {
      return {
        amount: mults[i3].mult,
        str: str.replace(mults[i3].reg, "")
      };
    }
  }
  return {
    amount: 1,
    str
  };
};
var findModifiers_default = findModifiers;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/parse/toNumber/data.js
var data_default3 = {
  ones: {
    zeroth: 0,
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9
  },
  teens: {
    tenth: 10,
    eleventh: 11,
    twelfth: 12,
    thirteenth: 13,
    fourteenth: 14,
    fifteenth: 15,
    sixteenth: 16,
    seventeenth: 17,
    eighteenth: 18,
    nineteenth: 19,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19
  },
  tens: {
    twentieth: 20,
    thirtieth: 30,
    fortieth: 40,
    fourtieth: 40,
    fiftieth: 50,
    sixtieth: 60,
    seventieth: 70,
    eightieth: 80,
    ninetieth: 90,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fourty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90
  },
  multiples: {
    hundredth: 100,
    thousandth: 1e3,
    millionth: 1e6,
    billionth: 1e9,
    trillionth: 1e12,
    quadrillionth: 1e15,
    quintillionth: 1e18,
    sextillionth: 1e21,
    septillionth: 1e24,
    hundred: 100,
    thousand: 1e3,
    million: 1e6,
    billion: 1e9,
    trillion: 1e12,
    quadrillion: 1e15,
    quintillion: 1e18,
    sextillion: 1e21,
    septillion: 1e24,
    grand: 1e3
  }
};

// reducer/node_modules/compromise/src/3-three/numbers/numbers/parse/toNumber/validate.js
var isValid = (w, has2) => {
  if (data_default3.ones.hasOwnProperty(w)) {
    if (has2.ones || has2.teens) {
      return false;
    }
  } else if (data_default3.teens.hasOwnProperty(w)) {
    if (has2.ones || has2.teens || has2.tens) {
      return false;
    }
  } else if (data_default3.tens.hasOwnProperty(w)) {
    if (has2.ones || has2.teens || has2.tens) {
      return false;
    }
  }
  return true;
};
var validate_default2 = isValid;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/parse/toNumber/parseDecimals.js
var parseDecimals = function(arr) {
  let str = "0.";
  for (let i3 = 0; i3 < arr.length; i3++) {
    const w = arr[i3];
    if (data_default3.ones.hasOwnProperty(w) === true) {
      str += data_default3.ones[w];
    } else if (data_default3.teens.hasOwnProperty(w) === true) {
      str += data_default3.teens[w];
    } else if (data_default3.tens.hasOwnProperty(w) === true) {
      str += data_default3.tens[w];
    } else if (/^[0-9]$/.test(w) === true) {
      str += w;
    } else {
      return 0;
    }
  }
  return parseFloat(str);
};
var parseDecimals_default = parseDecimals;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/parse/toNumber/parseNumeric.js
var parseNumeric = (str) => {
  str = str.replace(/1st$/, "1");
  str = str.replace(/2nd$/, "2");
  str = str.replace(/3rd$/, "3");
  str = str.replace(/([4567890])r?th$/, "$1");
  str = str.replace(/^[$€¥£¢]/, "");
  str = str.replace(/[%$€¥£¢]$/, "");
  str = str.replace(/,/g, "");
  str = str.replace(/([0-9])([a-z\u00C0-\u00FF]{1,2})$/, "$1");
  return str;
};
var parseNumeric_default = parseNumeric;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/parse/toNumber/index.js
var improperFraction = /^([0-9,. ]+)\/([0-9,. ]+)$/;
var casualForms = {
  "a few": 3,
  "a couple": 2,
  "a dozen": 12,
  "two dozen": 24,
  zero: 0
};
var section_sum = (obj) => {
  return Object.keys(obj).reduce((sum, k2) => {
    sum += obj[k2];
    return sum;
  }, 0);
};
var parse4 = function(str) {
  if (casualForms.hasOwnProperty(str) === true) {
    return casualForms[str];
  }
  if (str === "a" || str === "an") {
    return 1;
  }
  const modifier = findModifiers_default(str);
  str = modifier.str;
  let last_mult = null;
  let has2 = {};
  let sum = 0;
  let isNegative = false;
  const terms = str.split(/[ -]/);
  for (let i3 = 0; i3 < terms.length; i3++) {
    let w = terms[i3];
    w = parseNumeric_default(w);
    if (!w || w === "and") {
      continue;
    }
    if (w === "-" || w === "negative") {
      isNegative = true;
      continue;
    }
    if (w.charAt(0) === "-") {
      isNegative = true;
      w = w.substring(1);
    }
    if (w === "point") {
      sum += section_sum(has2);
      sum += parseDecimals_default(terms.slice(i3 + 1, terms.length));
      sum *= modifier.amount;
      return sum;
    }
    const fm = w.match(improperFraction);
    if (fm) {
      const num = parseFloat(fm[1].replace(/[, ]/g, ""));
      const denom = parseFloat(fm[2].replace(/[, ]/g, ""));
      if (denom) {
        sum += num / denom || 0;
      }
      continue;
    }
    if (data_default3.tens.hasOwnProperty(w)) {
      if (has2.ones && Object.keys(has2).length === 1) {
        sum = has2.ones * 100;
        has2 = {};
      }
    }
    if (validate_default2(w, has2) === false) {
      return null;
    }
    if (/^[0-9.]+$/.test(w)) {
      has2.ones = parseFloat(w);
    } else if (data_default3.ones.hasOwnProperty(w) === true) {
      has2.ones = data_default3.ones[w];
    } else if (data_default3.teens.hasOwnProperty(w) === true) {
      has2.teens = data_default3.teens[w];
    } else if (data_default3.tens.hasOwnProperty(w) === true) {
      has2.tens = data_default3.tens[w];
    } else if (data_default3.multiples.hasOwnProperty(w) === true) {
      let mult = data_default3.multiples[w];
      if (mult === last_mult) {
        return null;
      }
      if (mult === 100 && terms[i3 + 1] !== void 0) {
        const w2 = terms[i3 + 1];
        if (data_default3.multiples[w2]) {
          mult *= data_default3.multiples[w2];
          i3 += 1;
        }
      }
      if (last_mult === null || mult < last_mult) {
        sum += (section_sum(has2) || 1) * mult;
        last_mult = mult;
        has2 = {};
      } else {
        sum += section_sum(has2);
        last_mult = mult;
        sum = (sum || 1) * mult;
        has2 = {};
      }
    }
  }
  sum += section_sum(has2);
  sum *= modifier.amount;
  sum *= isNegative ? -1 : 1;
  if (sum === 0 && Object.keys(has2).length === 0) {
    return null;
  }
  return sum;
};
var toNumber_default = parse4;

// reducer/node_modules/compromise/src/3-three/numbers/fractions/parse.js
var endS = /s$/;
var parseNumber = function(m3) {
  const str = m3.text("reduced");
  return toNumber_default(str);
};
var mapping2 = {
  half: 2,
  halve: 2,
  quarter: 4
};
var slashForm = function(m3) {
  const str = m3.text("reduced");
  const found = str.match(/^([-+]?[0-9]+)\/([-+]?[0-9]+)(st|nd|rd|th)?s?$/);
  if (found && found[1] && found[0]) {
    return {
      numerator: Number(found[1]),
      denominator: Number(found[2])
    };
  }
  return null;
};
var nOutOfN = function(m3) {
  const found = m3.match("[<num>#Value+] out of every? [<den>#Value+]");
  if (found.found !== true) {
    return null;
  }
  let { num, den } = found.groups();
  if (!num || !den) {
    return null;
  }
  num = parseNumber(num);
  den = parseNumber(den);
  if (!num || !den) {
    return null;
  }
  if (typeof num === "number" && typeof den === "number") {
    return {
      numerator: num,
      denominator: den
    };
  }
  return null;
};
var nOrinalth = function(m3) {
  const found = m3.match("[<num>(#Cardinal|a)+] [<den>#Fraction+]");
  if (found.found !== true) {
    return null;
  }
  let { num, den } = found.groups();
  if (num.has("a")) {
    num = 1;
  } else {
    num = parseNumber(num);
  }
  let str = den.text("reduced");
  if (endS.test(str)) {
    str = str.replace(endS, "");
    den = den.replaceWith(str);
  }
  if (mapping2.hasOwnProperty(str)) {
    den = mapping2[str];
  } else {
    den = parseNumber(den);
  }
  if (typeof num === "number" && typeof den === "number") {
    return {
      numerator: num,
      denominator: den
    };
  }
  return null;
};
var oneNth = function(m3) {
  const found = m3.match("^#Ordinal$");
  if (found.found !== true) {
    return null;
  }
  if (m3.lookAhead("^of .")) {
    const num = parseNumber(found);
    return {
      numerator: 1,
      denominator: num
    };
  }
  return null;
};
var named = function(m3) {
  const str = m3.text("reduced");
  if (mapping2.hasOwnProperty(str)) {
    return { numerator: 1, denominator: mapping2[str] };
  }
  return null;
};
var round2 = (n3) => {
  const rounded = Math.round(n3 * 1e3) / 1e3;
  if (rounded === 0 && n3 !== 0) {
    return n3;
  }
  return rounded;
};
var parseFraction = function(m3) {
  m3 = m3.clone();
  const res = named(m3) || slashForm(m3) || nOutOfN(m3) || nOrinalth(m3) || oneNth(m3) || null;
  if (res !== null) {
    if (res.numerator && res.denominator) {
      res.decimal = res.numerator / res.denominator;
      res.decimal = round2(res.decimal);
    }
  }
  return res;
};
var parse_default4 = parseFraction;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/_toString.js
var numToString = function(n3) {
  if (n3 < 1e6) {
    return String(n3);
  }
  let str;
  if (typeof n3 === "number") {
    str = n3.toFixed(0);
  } else {
    str = n3;
  }
  if (str.indexOf("e+") === -1) {
    return str;
  }
  return str.replace(".", "").split("e+").reduce(function(p5, b) {
    return p5 + Array(b - p5.length + 2).join(0);
  });
};
var toString_default = numToString;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/format/toText/data.js
var tens_mapping = [
  ["ninety", 90],
  ["eighty", 80],
  ["seventy", 70],
  ["sixty", 60],
  ["fifty", 50],
  ["forty", 40],
  ["thirty", 30],
  ["twenty", 20]
];
var ones_mapping = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen"
];
var sequence = [
  [1e24, "septillion"],
  [1e20, "hundred sextillion"],
  [1e21, "sextillion"],
  [1e20, "hundred quintillion"],
  [1e18, "quintillion"],
  [1e17, "hundred quadrillion"],
  [1e15, "quadrillion"],
  [1e14, "hundred trillion"],
  [1e12, "trillion"],
  [1e11, "hundred billion"],
  [1e9, "billion"],
  [1e8, "hundred million"],
  [1e6, "million"],
  [1e5, "hundred thousand"],
  [1e3, "thousand"],
  [100, "hundred"],
  [1, "one"]
];

// reducer/node_modules/compromise/src/3-three/numbers/numbers/format/toText/index.js
var breakdown_magnitudes = function(num) {
  let working = num;
  const have = [];
  sequence.forEach((a2) => {
    if (num >= a2[0]) {
      const howmany = Math.floor(working / a2[0]);
      working -= howmany * a2[0];
      if (howmany) {
        have.push({
          unit: a2[1],
          count: howmany
        });
      }
    }
  });
  return have;
};
var breakdown_hundred = function(num) {
  const arr = [];
  if (num > 100) {
    return arr;
  }
  for (let i3 = 0; i3 < tens_mapping.length; i3++) {
    if (num >= tens_mapping[i3][1]) {
      num -= tens_mapping[i3][1];
      arr.push(tens_mapping[i3][0]);
    }
  }
  if (ones_mapping[num]) {
    arr.push(ones_mapping[num]);
  }
  return arr;
};
var handle_decimal = (num) => {
  const names = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const arr = [];
  const str = toString_default(num);
  const decimal = str.match(/\.([0-9]+)/);
  if (!decimal || !decimal[0]) {
    return arr;
  }
  arr.push("point");
  const decimals = decimal[0].split("");
  for (let i3 = 0; i3 < decimals.length; i3++) {
    arr.push(names[decimals[i3]]);
  }
  return arr;
};
var toText3 = function(obj) {
  let num = obj.num;
  if (num === 0 || num === "0") {
    return "zero";
  }
  if (num > 1e21) {
    num = toString_default(num);
  }
  let arr = [];
  if (num < 0) {
    arr.push("minus");
    num = Math.abs(num);
  }
  const units = breakdown_magnitudes(num);
  for (let i3 = 0; i3 < units.length; i3++) {
    let unit_name = units[i3].unit;
    if (unit_name === "one") {
      unit_name = "";
      if (arr.length > 1) {
        arr.push("and");
      }
    }
    arr = arr.concat(breakdown_hundred(units[i3].count));
    arr.push(unit_name);
  }
  arr = arr.concat(handle_decimal(num));
  arr = arr.filter((s3) => s3);
  if (arr.length === 0) {
    arr[0] = "";
  }
  return arr.join(" ");
};
var toText_default = toText3;

// reducer/node_modules/compromise/src/3-three/numbers/fractions/convert/toCardinal.js
var toCardinal = function(obj) {
  if (!obj.numerator || !obj.denominator) {
    return "";
  }
  const a2 = toText_default({ num: obj.numerator });
  const b = toText_default({ num: obj.denominator });
  return `${a2} out of ${b}`;
};
var toCardinal_default = toCardinal;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/format/toOrdinal/textOrdinal.js
var irregulars = {
  one: "first",
  two: "second",
  three: "third",
  five: "fifth",
  eight: "eighth",
  nine: "ninth",
  twelve: "twelfth",
  twenty: "twentieth",
  thirty: "thirtieth",
  forty: "fortieth",
  fourty: "fourtieth",
  fifty: "fiftieth",
  sixty: "sixtieth",
  seventy: "seventieth",
  eighty: "eightieth",
  ninety: "ninetieth"
};
var textOrdinal = (obj) => {
  const words = toText_default(obj).split(" ");
  const last = words[words.length - 1];
  if (irregulars.hasOwnProperty(last)) {
    words[words.length - 1] = irregulars[last];
  } else {
    words[words.length - 1] = last.replace(/y$/, "i") + "th";
  }
  return words.join(" ");
};
var textOrdinal_default = textOrdinal;

// reducer/node_modules/compromise/src/3-three/numbers/fractions/convert/toOrdinal.js
var toOrdinal = function(obj) {
  if (!obj.numerator || !obj.denominator) {
    return "";
  }
  const start2 = toText_default({ num: obj.numerator });
  let end2 = textOrdinal_default({ num: obj.denominator });
  if (obj.denominator === 2) {
    end2 = "half";
  }
  if (start2 && end2) {
    if (obj.numerator !== 1) {
      end2 += "s";
    }
    return `${start2} ${end2}`;
  }
  return "";
};
var toOrdinal_default = toOrdinal;

// reducer/node_modules/compromise/src/3-three/numbers/fractions/api.js
var plugin3 = function(View2) {
  class Fractions extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Fractions";
    }
    parse(n3) {
      return this.getNth(n3).map(parse_default4);
    }
    get(n3) {
      return this.getNth(n3).map(parse_default4);
    }
    json(n3) {
      return this.getNth(n3).map((p5) => {
        const json = p5.toView().json(n3)[0];
        const parsed = parse_default4(p5);
        json.fraction = parsed;
        return json;
      }, []);
    }
    // become 0.5
    toDecimal(n3) {
      this.getNth(n3).forEach((m3) => {
        const { decimal } = parse_default4(m3);
        m3 = m3.replaceWith(String(decimal), true);
        m3.tag("NumericValue");
        m3.unTag("Fraction");
      });
      return this;
    }
    toFraction(n3) {
      this.getNth(n3).forEach((m3) => {
        const obj = parse_default4(m3);
        if (obj && typeof obj.numerator === "number" && typeof obj.denominator === "number") {
          const str = `${obj.numerator}/${obj.denominator}`;
          this.replace(m3, str);
        }
      });
      return this;
    }
    toOrdinal(n3) {
      this.getNth(n3).forEach((m3) => {
        const obj = parse_default4(m3);
        let str = toOrdinal_default(obj);
        if (m3.after("^#Noun").found) {
          str += " of";
        }
        m3.replaceWith(str);
      });
      return this;
    }
    toCardinal(n3) {
      this.getNth(n3).forEach((m3) => {
        const obj = parse_default4(m3);
        const str = toCardinal_default(obj);
        m3.replaceWith(str);
      });
      return this;
    }
    toPercentage(n3) {
      this.getNth(n3).forEach((m3) => {
        const { decimal } = parse_default4(m3);
        let percent = decimal * 100;
        percent = Math.round(percent * 100) / 100;
        m3.replaceWith(`${percent}%`);
      });
      return this;
    }
  }
  View2.prototype.fractions = function(n3) {
    let m3 = find_default2(this);
    m3 = m3.getNth(n3);
    return new Fractions(this.document, m3.pointer);
  };
};
var api_default15 = plugin3;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/find.js
var ones = "one|two|three|four|five|six|seven|eight|nine";
var tens = "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|fourty";
var teens = "eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen";
var findNumbers = function(doc) {
  let m3 = doc.match("#Value+");
  if (m3.has("#NumericValue #NumericValue")) {
    if (m3.has("#Value @hasComma #Value")) {
      m3.splitAfter("@hasComma");
    } else if (m3.has("#NumericValue #Fraction")) {
      m3.splitAfter("#NumericValue #Fraction");
    } else {
      m3 = m3.splitAfter("#NumericValue");
    }
  }
  if (m3.has("#Value #Value #Value") && !m3.has("#Multiple")) {
    if (m3.has("(" + tens + ") #Cardinal #Cardinal")) {
      m3 = m3.splitAfter("(" + tens + ") #Cardinal");
    }
  }
  if (m3.has("#Value #Value")) {
    if (m3.has("#NumericValue #NumericValue")) {
      m3 = m3.splitOn("#Year");
    }
    if (m3.has("(" + tens + ") (" + teens + ")")) {
      m3 = m3.splitAfter("(" + tens + ")");
    }
    const double = m3.match("#Cardinal #Cardinal");
    if (double.found && !m3.has("(point|decimal|#Fraction)")) {
      if (!double.has("#Cardinal (#Multiple|point|decimal)")) {
        const noMultiple = m3.has(`(${ones}) (${tens})`);
        const tensVal = double.has("(" + tens + ") #Cardinal");
        const multVal = double.has("#Multiple #Value");
        if (!noMultiple && !tensVal && !multVal) {
          double.terms().forEach((d2) => {
            m3 = m3.splitOn(d2);
          });
        }
      }
    }
    if (m3.match("#Ordinal #Ordinal").match("#TextValue").found && !m3.has("#Multiple")) {
      if (!m3.has("(" + tens + ") #Ordinal")) {
        m3 = m3.splitAfter("#Ordinal");
      }
    }
    if (m3.has("#Time")) {
      m3 = m3.splitOn("#Time");
    }
    m3 = m3.splitBefore("#Ordinal [#Cardinal]", 0);
    if (m3.has("#TextValue #NumericValue") && !m3.has("(" + tens + "|#Multiple)")) {
      m3 = m3.splitBefore("#TextValue #NumericValue");
    }
  }
  m3 = m3.splitAfter("#NumberRange");
  m3 = m3.splitBefore("#Year");
  return m3;
};
var find_default3 = findNumbers;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/parse/index.js
var parseNumeric2 = function(str, m3) {
  str = str.replace(/,/g, "");
  const arr = str.split(/([0-9.,]*)/);
  let [prefix5, num] = arr;
  let suffix = arr.slice(2).join("");
  if (num !== "" && m3.length < 2) {
    num = Number(num || str);
    if (typeof num !== "number") {
      num = null;
    }
    suffix = suffix || "";
    if (suffix === "st" || suffix === "nd" || suffix === "rd" || suffix === "th") {
      suffix = "";
    }
    return {
      prefix: prefix5 || "",
      num,
      suffix
    };
  }
  return null;
};
var parseNumber2 = function(m3) {
  if (typeof m3 === "string") {
    return { num: toNumber_default(m3) };
  }
  let str = m3.text("reduced");
  const unit = m3.growRight("#Unit").match("#Unit$").text("machine");
  const hasComma = /[0-9],[0-9]/.test(m3.text("text"));
  if (m3.terms().length === 1 && !m3.has("#Multiple")) {
    const res = parseNumeric2(str, m3);
    if (res !== null) {
      res.hasComma = hasComma;
      res.unit = unit;
      return res;
    }
  }
  let frPart = m3.match("#Fraction{2,}$");
  frPart = frPart.found === false ? m3.match("^#Fraction$") : frPart;
  let fraction = null;
  if (frPart.found) {
    if (frPart.has("#Value and #Value #Fraction")) {
      frPart = frPart.match("and #Value #Fraction");
    }
    fraction = parse_default4(frPart);
    m3 = m3.not(frPart);
    m3 = m3.not("and$");
    str = m3.text("reduced");
  }
  let num = 0;
  if (str) {
    num = toNumber_default(str) || 0;
  }
  if (fraction && fraction.decimal) {
    num += fraction.decimal;
  }
  return {
    hasComma,
    prefix: "",
    num,
    suffix: "",
    isOrdinal: m3.has("#Ordinal"),
    isText: m3.has("#TextValue"),
    isFraction: m3.has("#Fraction"),
    isMoney: m3.has("#Money"),
    unit
  };
};
var parse_default5 = parseNumber2;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/format/toOrdinal/numOrdinal.js
var numOrdinal = function(obj) {
  const num = obj.num;
  if (!num && num !== 0) {
    return null;
  }
  const tens2 = num % 100;
  if (tens2 > 10 && tens2 < 20) {
    return String(num) + "th";
  }
  const mapping3 = {
    0: "th",
    1: "st",
    2: "nd",
    3: "rd"
  };
  let str = toString_default(num);
  const last = str.slice(str.length - 1, str.length);
  if (mapping3[last]) {
    str += mapping3[last];
  } else {
    str += "th";
  }
  return str;
};
var numOrdinal_default = numOrdinal;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/format/suffix.js
var prefixes = {
  "\xA2": "cents",
  $: "dollars",
  "\xA3": "pounds",
  "\xA5": "yen",
  "\u20AC": "euros",
  "\u20A1": "col\xF3n",
  "\u0E3F": "baht",
  "\u20AD": "kip",
  "\u20A9": "won",
  "\u20B9": "rupees",
  "\u20BD": "ruble",
  "\u20BA": "liras"
};
var suffixes4 = {
  "%": "percent",
  // s: 'seconds',
  // cm: 'centimetres',
  // km: 'kilometres',
  // ft: 'feet',
  "\xB0": "degrees"
};
var addSuffix = function(obj) {
  const res = {
    suffix: "",
    prefix: obj.prefix
  };
  if (prefixes.hasOwnProperty(obj.prefix)) {
    res.suffix += " " + prefixes[obj.prefix];
    res.prefix = "";
  }
  if (suffixes4.hasOwnProperty(obj.suffix)) {
    res.suffix += " " + suffixes4[obj.suffix];
  }
  if (res.suffix && obj.num === 1) {
    res.suffix = res.suffix.replace(/s$/, "");
  }
  if (!res.suffix && obj.suffix) {
    res.suffix += " " + obj.suffix;
  }
  return res;
};
var suffix_default2 = addSuffix;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/format/index.js
var format = function(obj, fmt2) {
  if (fmt2 === "TextOrdinal") {
    const { prefix: prefix5, suffix } = suffix_default2(obj);
    return prefix5 + textOrdinal_default(obj) + suffix;
  }
  if (fmt2 === "Ordinal") {
    return obj.prefix + numOrdinal_default(obj) + obj.suffix;
  }
  if (fmt2 === "TextCardinal") {
    const { prefix: prefix5, suffix } = suffix_default2(obj);
    return prefix5 + toText_default(obj) + suffix;
  }
  let num = obj.num;
  if (obj.hasComma) {
    num = num.toLocaleString();
  }
  return obj.prefix + String(num) + obj.suffix;
};
var format_default = format;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/isUnit.js
var isArray12 = (arr) => Object.prototype.toString.call(arr) === "[object Array]";
var coerceToObject = function(input) {
  if (typeof input === "string" || typeof input === "number") {
    const tmp = {};
    tmp[input] = true;
    return tmp;
  }
  if (isArray12(input)) {
    return input.reduce((h2, s3) => {
      h2[s3] = true;
      return h2;
    }, {});
  }
  return input || {};
};
var isUnit = function(doc, input = {}) {
  input = coerceToObject(input);
  return doc.filter((p5) => {
    const { unit } = parse_default5(p5);
    if (unit && input[unit] === true) {
      return true;
    }
    return false;
  });
};
var isUnit_default = isUnit;

// reducer/node_modules/compromise/src/3-three/numbers/numbers/api.js
var addMethod = function(View2) {
  class Numbers extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Numbers";
    }
    parse(n3) {
      return this.getNth(n3).map(parse_default5);
    }
    get(n3) {
      return this.getNth(n3).map(parse_default5).map((o2) => o2.num);
    }
    json(n3) {
      const opts2 = typeof n3 === "object" ? n3 : {};
      return this.getNth(n3).map((p5) => {
        const json = p5.toView().json(opts2)[0];
        const parsed = parse_default5(p5);
        json.number = {
          prefix: parsed.prefix,
          num: parsed.num,
          suffix: parsed.suffix,
          hasComma: parsed.hasComma,
          unit: parsed.unit
        };
        return json;
      }, []);
    }
    /** any known measurement unit, for the number */
    units() {
      return this.growRight("#Unit").match("#Unit$");
    }
    /** return values that match a given unit */
    isUnit(allowed) {
      return isUnit_default(this, allowed);
    }
    /** return only ordinal numbers */
    isOrdinal() {
      return this.if("#Ordinal");
    }
    /** return only cardinal numbers*/
    isCardinal() {
      return this.if("#Cardinal");
    }
    /** convert to numeric form like '8' or '8th' */
    toNumber() {
      const res = this.map((val) => {
        if (!this.has("#TextValue")) {
          return val;
        }
        const obj = parse_default5(val);
        if (obj.num === null) {
          return val;
        }
        const fmt2 = val.has("#Ordinal") ? "Ordinal" : "Cardinal";
        const str = format_default(obj, fmt2);
        val.replaceWith(str, { tags: true });
        return val.tag("NumericValue");
      });
      return new Numbers(res.document, res.pointer);
    }
    /** add commas, or nicer formatting for numbers */
    toLocaleString() {
      const m3 = this;
      m3.forEach((val) => {
        const obj = parse_default5(val);
        if (obj.num === null) {
          return;
        }
        let num = obj.num.toLocaleString();
        if (val.has("#Ordinal")) {
          const str = format_default(obj, "Ordinal");
          const end2 = str.match(/[a-z]+$/);
          if (end2) {
            num += end2[0] || "";
          }
        }
        val.replaceWith(num, { tags: true });
      });
      return this;
    }
    /** convert to numeric form like 'eight' or 'eighth' */
    toText() {
      const m3 = this;
      const res = m3.map((val) => {
        if (val.has("#TextValue")) {
          return val;
        }
        const obj = parse_default5(val);
        if (obj.num === null) {
          return val;
        }
        const fmt2 = val.has("#Ordinal") ? "TextOrdinal" : "TextCardinal";
        const str = format_default(obj, fmt2);
        val.replaceWith(str, { tags: true });
        val.tag("TextValue");
        return val;
      });
      return new Numbers(res.document, res.pointer);
    }
    /** convert ordinal to cardinal form, like 'eight', or '8' */
    toCardinal() {
      const m3 = this;
      const res = m3.map((val) => {
        if (!val.has("#Ordinal")) {
          return val;
        }
        const obj = parse_default5(val);
        if (obj.num === null) {
          return val;
        }
        const fmt2 = val.has("#TextValue") ? "TextCardinal" : "Cardinal";
        const str = format_default(obj, fmt2);
        val.replaceWith(str, { tags: true });
        val.tag("Cardinal");
        return val;
      });
      return new Numbers(res.document, res.pointer);
    }
    /** convert cardinal to ordinal form, like 'eighth', or '8th' */
    toOrdinal() {
      const m3 = this;
      const res = m3.map((val) => {
        if (val.has("#Ordinal")) {
          return val;
        }
        const obj = parse_default5(val);
        if (obj.num === null) {
          return val;
        }
        const fmt2 = val.has("#TextValue") ? "TextOrdinal" : "Ordinal";
        const str = format_default(obj, fmt2);
        val.replaceWith(str, { tags: true });
        val.tag("Ordinal");
        return val;
      });
      return new Numbers(res.document, res.pointer);
    }
    /** return only numbers that are == n */
    isEqual(n3) {
      return this.filter((val) => {
        const num = parse_default5(val).num;
        return num === n3;
      });
    }
    /** return only numbers that are > n*/
    greaterThan(n3) {
      return this.filter((val) => {
        const num = parse_default5(val).num;
        return num > n3;
      });
    }
    /** return only numbers that are < n*/
    lessThan(n3) {
      return this.filter((val) => {
        const num = parse_default5(val).num;
        return num < n3;
      });
    }
    /** return only numbers > min and < max */
    between(min2, max3) {
      return this.filter((val) => {
        const num = parse_default5(val).num;
        return num > min2 && num < max3;
      });
    }
    /** set these number to n */
    set(n3) {
      if (n3 === void 0) {
        return this;
      }
      if (typeof n3 === "string") {
        n3 = parse_default5(n3).num;
      }
      const m3 = this;
      const res = m3.map((val) => {
        const obj = parse_default5(val);
        obj.num = n3;
        if (obj.num === null) {
          return val;
        }
        let fmt2 = val.has("#Ordinal") ? "Ordinal" : "Cardinal";
        if (val.has("#TextValue")) {
          fmt2 = val.has("#Ordinal") ? "TextOrdinal" : "TextCardinal";
        }
        let str = format_default(obj, fmt2);
        if (obj.hasComma && fmt2 === "Cardinal") {
          str = Number(str).toLocaleString();
        }
        val = val.not("#Currency");
        val.replaceWith(str, { tags: true });
        return val;
      });
      return new Numbers(res.document, res.pointer);
    }
    add(n3) {
      if (!n3) {
        return this;
      }
      if (typeof n3 === "string") {
        n3 = parse_default5(n3).num;
      }
      const m3 = this;
      const res = m3.map((val) => {
        const obj = parse_default5(val);
        if (obj.num === null) {
          return val;
        }
        obj.num += n3;
        let fmt2 = val.has("#Ordinal") ? "Ordinal" : "Cardinal";
        if (obj.isText) {
          fmt2 = val.has("#Ordinal") ? "TextOrdinal" : "TextCardinal";
        }
        const str = format_default(obj, fmt2);
        val.replaceWith(str, { tags: true });
        return val;
      });
      return new Numbers(res.document, res.pointer);
    }
    /** decrease each number by n*/
    subtract(n3, agree) {
      return this.add(n3 * -1, agree);
    }
    /** increase each number by 1 */
    increment(agree) {
      return this.add(1, agree);
    }
    /** decrease each number by 1 */
    decrement(agree) {
      return this.add(-1, agree);
    }
    // overloaded - keep Numbers class
    update(pointer) {
      const m3 = new Numbers(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  Numbers.prototype.toNice = Numbers.prototype.toLocaleString;
  Numbers.prototype.isBetween = Numbers.prototype.between;
  Numbers.prototype.minus = Numbers.prototype.subtract;
  Numbers.prototype.plus = Numbers.prototype.add;
  Numbers.prototype.equals = Numbers.prototype.isEqual;
  View2.prototype.numbers = function(n3) {
    let m3 = find_default3(this);
    m3 = m3.getNth(n3);
    return new Numbers(this.document, m3.pointer);
  };
  View2.prototype.percentages = function(n3) {
    let m3 = find_default3(this);
    m3 = m3.filter((v2) => v2.has("#Percent") || v2.after("^percent"));
    m3 = m3.getNth(n3);
    return new Numbers(this.document, m3.pointer);
  };
  View2.prototype.money = function(n3) {
    let m3 = find_default3(this);
    m3 = m3.filter((v2) => v2.has("#Money") || v2.after("^#Currency"));
    m3 = m3.getNth(n3);
    return new Numbers(this.document, m3.pointer);
  };
  View2.prototype.values = View2.prototype.numbers;
};
var api_default16 = addMethod;

// reducer/node_modules/compromise/src/3-three/numbers/plugin.js
var api14 = function(View2) {
  api_default15(View2);
  api_default16(View2);
};
var plugin_default25 = {
  api: api14
  // add @greaterThan, @lessThan
  // mutate: world => {
  //   let termMethods = world.methods.one.termMethods
  //   termMethods.lessThan = function (term) {
  //     return false //TODO: implement
  //     // return /[aeiou]/.test(term.text)
  //   }
  // },
};

// reducer/node_modules/compromise/src/3-three/redact/plugin.js
var defaults3 = {
  people: true,
  emails: true,
  phoneNumbers: true,
  places: true
};
var redact = function(opts2 = {}) {
  opts2 = Object.assign({}, defaults3, opts2);
  if (opts2.people !== false) {
    this.people().replaceWith("\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588");
  }
  if (opts2.emails !== false) {
    this.emails().replaceWith("\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588");
  }
  if (opts2.places !== false) {
    this.places().replaceWith("\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588");
  }
  if (opts2.phoneNumbers !== false) {
    this.phoneNumbers().replaceWith("\u2588\u2588\u2588\u2588\u2588\u2588\u2588");
  }
  return this;
};
var plugin4 = {
  api: function(View2) {
    View2.prototype.redact = redact;
  }
};
var plugin_default26 = plugin4;

// reducer/node_modules/compromise/src/3-three/sentences/questions.js
var isQuestion = function(doc) {
  const clauses2 = doc.clauses();
  if (/\.\.$/.test(doc.out("text"))) {
    return false;
  }
  if (doc.has("^#QuestionWord") && doc.has("@hasComma")) {
    return false;
  }
  if (doc.has("or not$")) {
    return true;
  }
  if (doc.has("^#QuestionWord")) {
    return true;
  }
  if (doc.has("^(do|does|did|is|was|can|could|will|would|may) #Noun")) {
    return true;
  }
  if (doc.has("^(have|must) you")) {
    return true;
  }
  if (clauses2.has("(do|does|is|was) #Noun+ #Adverb? (#Adjective|#Infinitive)$")) {
    return true;
  }
  return false;
};
var findQuestions = function(view) {
  const hasQ = /\?/;
  const { document } = view;
  return view.filter((m3) => {
    const terms = m3.docs[0] || [];
    const lastTerm = terms[terms.length - 1];
    if (!lastTerm || document[lastTerm.index[0]].length !== terms.length) {
      return false;
    }
    if (hasQ.test(lastTerm.post)) {
      return true;
    }
    return isQuestion(m3);
  });
};
var questions_default = findQuestions;

// reducer/node_modules/compromise/src/3-three/sentences/parse/mainClause.js
var subordinate = `(after|although|as|because|before|if|since|than|that|though|when|whenever|where|whereas|wherever|whether|while|why|unless|until|once)`;
var relative = `(that|which|whichever|who|whoever|whom|whose|whomever)`;
var mainClause = function(s3) {
  let m3 = s3;
  if (m3.length === 1) {
    return m3;
  }
  m3 = m3.if("#Verb");
  if (m3.length === 1) {
    return m3;
  }
  m3 = m3.ifNo(subordinate);
  m3 = m3.ifNo("^even (if|though)");
  m3 = m3.ifNo("^so that");
  m3 = m3.ifNo("^rather than");
  m3 = m3.ifNo("^provided that");
  if (m3.length === 1) {
    return m3;
  }
  m3 = m3.ifNo(relative);
  if (m3.length === 1) {
    return m3;
  }
  m3 = m3.ifNo("(^despite|^during|^before|^through|^throughout)");
  if (m3.length === 1) {
    return m3;
  }
  m3 = m3.ifNo("^#Gerund");
  if (m3.length === 1) {
    return m3;
  }
  if (m3.length === 0) {
    m3 = s3;
  }
  return m3.eq(0);
};
var mainClause_default = mainClause;

// reducer/node_modules/compromise/src/3-three/sentences/parse/index.js
var grammar = function(vb3) {
  let tense = null;
  if (vb3.has("#PastTense")) {
    tense = "PastTense";
  } else if (vb3.has("#FutureTense")) {
    tense = "FutureTense";
  } else if (vb3.has("#PresentTense")) {
    tense = "PresentTense";
  }
  return {
    tense
  };
};
var parse5 = function(s3) {
  const clauses2 = s3.clauses();
  const main = mainClause_default(clauses2);
  const chunks2 = main.chunks();
  let subj = s3.none();
  let verb = s3.none();
  let pred = s3.none();
  chunks2.forEach((ch, i3) => {
    if (i3 === 0 && !ch.has("<Verb>")) {
      subj = ch;
      return;
    }
    if (!verb.found && ch.has("<Verb>")) {
      verb = ch;
      return;
    }
    if (verb.found) {
      pred = pred.concat(ch);
    }
  });
  if (verb.found && !subj.found) {
    subj = verb.before("<Noun>+").first();
  }
  return {
    subj,
    verb,
    pred,
    grammar: grammar(verb)
  };
};
var parse_default6 = parse5;

// reducer/node_modules/compromise/src/3-three/sentences/conjugate/toPast.js
var toPast2 = function(s3) {
  let verbs = s3.verbs();
  const first = verbs.eq(0);
  if (first.has("#PastTense")) {
    return s3;
  }
  first.toPastTense();
  if (verbs.length > 1) {
    verbs = verbs.slice(1);
    verbs = verbs.filter((v2) => !v2.lookBehind("to$").found);
    verbs = verbs.if("#PresentTense");
    verbs = verbs.notIf("#Gerund");
    const list4 = s3.match("to #Verb+ #Conjunction #Verb").terms();
    verbs = verbs.not(list4);
    if (verbs.found) {
      verbs.verbs().toPastTense();
    }
  }
  return s3;
};
var toPast_default = toPast2;

// reducer/node_modules/compromise/src/3-three/sentences/conjugate/toPresent.js
var toPresent2 = function(s3) {
  let verbs = s3.verbs();
  const first = verbs.eq(0);
  first.toPresentTense();
  if (verbs.length > 1) {
    verbs = verbs.slice(1);
    verbs = verbs.filter((v2) => !v2.lookBehind("to$").found);
    verbs = verbs.notIf("#Gerund");
    if (verbs.found) {
      verbs.verbs().toPresentTense();
    }
  }
  return s3;
};
var toPresent_default = toPresent2;

// reducer/node_modules/compromise/src/3-three/sentences/conjugate/toFuture.js
var toFuture = function(s3) {
  let verbs = s3.verbs();
  const first = verbs.eq(0);
  first.toFutureTense();
  s3 = s3.fullSentence();
  verbs = s3.verbs();
  if (verbs.length > 1) {
    verbs = verbs.slice(1);
    const toChange = verbs.filter((vb3) => {
      if (vb3.lookBehind("to$").found) {
        return false;
      }
      if (vb3.has("#Copula #Gerund")) {
        return true;
      }
      if (vb3.has("#Gerund")) {
        return false;
      }
      if (vb3.has("#Copula")) {
        return true;
      }
      if (vb3.has("#PresentTense") && !vb3.has("#Infinitive") && vb3.lookBefore("(he|she|it|that|which)$").found) {
        return false;
      }
      return true;
    });
    if (toChange.found) {
      toChange.forEach((m3) => {
        if (m3.has("#Copula")) {
          m3.match("was").replaceWith("is");
          m3.match("is").replaceWith("will be");
          return;
        }
        m3.toInfinitive();
      });
    }
  }
  return s3;
};
var toFuture_default = toFuture;

// reducer/node_modules/compromise/src/3-three/sentences/conjugate/toNegative.js
var toNegative = function(s3) {
  s3.verbs().first().toNegative().compute("chunks");
  return s3;
};
var toPositive = function(s3) {
  s3.verbs().first().toPositive().compute("chunks");
  return s3;
};

// reducer/node_modules/compromise/src/3-three/sentences/conjugate/toInfinitive.js
var toInfinitive2 = function(s3) {
  s3.verbs().toInfinitive();
  return s3;
};
var toInfinitive_default2 = toInfinitive2;

// reducer/node_modules/compromise/src/3-three/sentences/api.js
var api15 = function(View2) {
  class Sentences extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Sentences";
    }
    json(opts2 = {}) {
      return this.map((m3) => {
        const json = m3.toView().json(opts2)[0] || {};
        const { subj, verb, pred, grammar: grammar2 } = parse_default6(m3);
        json.sentence = {
          subject: subj.text("normal"),
          verb: verb.text("normal"),
          predicate: pred.text("normal"),
          grammar: grammar2
        };
        return json;
      }, []);
    }
    toPastTense(n3) {
      return this.getNth(n3).map((s3) => {
        const parsed = parse_default6(s3);
        return toPast_default(s3, parsed);
      });
    }
    toPresentTense(n3) {
      return this.getNth(n3).map((s3) => {
        const parsed = parse_default6(s3);
        return toPresent_default(s3, parsed);
      });
    }
    toFutureTense(n3) {
      return this.getNth(n3).map((s3) => {
        const parsed = parse_default6(s3);
        s3 = toFuture_default(s3, parsed);
        return s3;
      });
    }
    toInfinitive(n3) {
      return this.getNth(n3).map((s3) => {
        const parsed = parse_default6(s3);
        return toInfinitive_default2(s3, parsed);
      });
    }
    toNegative(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default6(vb3);
        return toNegative(vb3, parsed);
      });
    }
    toPositive(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default6(vb3);
        return toPositive(vb3, parsed);
      });
    }
    isQuestion(n3) {
      return this.questions(n3);
    }
    isExclamation(n3) {
      const res = this.filter((s3) => s3.lastTerm().has("@hasExclamation"));
      return res.getNth(n3);
    }
    isStatement(n3) {
      const res = this.filter((s3) => !s3.isExclamation().found && !s3.isQuestion().found);
      return res.getNth(n3);
    }
    // overloaded - keep Sentences class
    update(pointer) {
      const m3 = new Sentences(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  Sentences.prototype.toPresent = Sentences.prototype.toPresentTense;
  Sentences.prototype.toPast = Sentences.prototype.toPastTense;
  Sentences.prototype.toFuture = Sentences.prototype.toFutureTense;
  const methods17 = {
    sentences: function(n3) {
      let m3 = this.map((s3) => s3.fullSentence());
      m3 = m3.getNth(n3);
      return new Sentences(this.document, m3.pointer);
    },
    questions: function(n3) {
      const m3 = questions_default(this);
      return m3.getNth(n3);
    }
  };
  Object.assign(View2.prototype, methods17);
};
var api_default17 = api15;

// reducer/node_modules/compromise/src/3-three/sentences/plugin.js
var plugin_default27 = { api: api_default17 };

// reducer/node_modules/compromise/src/3-three/topics/people/find.js
var find5 = function(doc) {
  let m3 = doc.splitAfter("@hasComma");
  m3 = m3.match("#Honorific+? #Person+");
  const poss = m3.match("#Possessive").notIf("(his|her)");
  m3 = m3.splitAfter(poss);
  return m3;
};
var find_default4 = find5;

// reducer/node_modules/compromise/src/3-three/topics/people/parse.js
var parse6 = function(m3) {
  const res = {};
  res.firstName = m3.match("#FirstName+");
  res.lastName = m3.match("#LastName+");
  res.honorific = m3.match("#Honorific+");
  const last = res.lastName;
  const first = res.firstName;
  if (!first.found || !last.found) {
    if (!first.found && !last.found && m3.has("^#Honorific .$")) {
      res.lastName = m3.match(".$");
      return res;
    }
  }
  return res;
};
var parse_default7 = parse6;

// reducer/node_modules/compromise/src/3-three/topics/people/gender.js
var m2 = "male";
var f2 = "female";
var honorifics = {
  mr: m2,
  mrs: f2,
  miss: f2,
  madam: f2,
  // british stuff
  king: m2,
  queen: f2,
  duke: m2,
  duchess: f2,
  baron: m2,
  baroness: f2,
  count: m2,
  countess: f2,
  prince: m2,
  princess: f2,
  sire: m2,
  dame: f2,
  lady: f2,
  ayatullah: m2,
  //i think?
  congressman: m2,
  congresswoman: f2,
  "first lady": f2,
  // marked as non-binary
  mx: null
};
var predictGender = function(parsed, person) {
  const { firstName, honorific } = parsed;
  if (firstName.has("#FemaleName")) {
    return f2;
  }
  if (firstName.has("#MaleName")) {
    return m2;
  }
  if (honorific.found) {
    let hon = honorific.text("normal");
    hon = hon.replace(/\./g, "");
    if (honorifics.hasOwnProperty(hon)) {
      return honorifics[hon];
    }
    if (/^her /.test(hon)) {
      return f2;
    }
    if (/^his /.test(hon)) {
      return m2;
    }
  }
  const after2 = person.after();
  if (!after2.has("#Person") && after2.has("#Pronoun")) {
    const pro = after2.match("#Pronoun");
    if (pro.has("(they|their)")) {
      return null;
    }
    const hasMasc = pro.has("(he|his)");
    const hasFem = pro.has("(she|her|hers)");
    if (hasMasc && !hasFem) {
      return m2;
    }
    if (hasFem && !hasMasc) {
      return f2;
    }
  }
  return null;
};
var gender_default = predictGender;

// reducer/node_modules/compromise/src/3-three/topics/people/api.js
var addMethod2 = function(View2) {
  class People extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "People";
    }
    parse(n3) {
      return this.getNth(n3).map(parse_default7);
    }
    json(n3) {
      const opts2 = typeof n3 === "object" ? n3 : {};
      return this.getNth(n3).map((p5) => {
        const json = p5.toView().json(opts2)[0];
        const parsed = parse_default7(p5);
        json.person = {
          firstName: parsed.firstName.text("normal"),
          lastName: parsed.lastName.text("normal"),
          honorific: parsed.honorific.text("normal"),
          presumed_gender: gender_default(parsed, p5)
        };
        return json;
      }, []);
    }
    // used for co-reference resolution only
    presumedMale() {
      return this.filter((m3) => {
        return m3.has("(#MaleName|mr|mister|sr|jr|king|pope|prince|sir)");
      });
    }
    presumedFemale() {
      return this.filter((m3) => {
        return m3.has("(#FemaleName|mrs|miss|queen|princess|madam)");
      });
    }
    // overloaded - keep People class
    update(pointer) {
      const m3 = new People(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  View2.prototype.people = function(n3) {
    let m3 = find_default4(this);
    m3 = m3.getNth(n3);
    return new People(this.document, m3.pointer);
  };
};
var api_default18 = addMethod2;

// reducer/node_modules/compromise/src/3-three/topics/places/find.js
var find6 = function(doc) {
  let m3 = doc.match("(#Place|#Address)+");
  let splits = m3.match("@hasComma");
  splits = splits.filter((c2) => {
    if (c2.has("(asia|africa|europe|america)$")) {
      return true;
    }
    if (c2.has("(#City|#Region|#ProperNoun)$") && c2.after("^(#Country|#Region)").found) {
      return false;
    }
    return true;
  });
  m3 = m3.splitAfter(splits);
  return m3;
};
var find_default5 = find6;

// reducer/node_modules/compromise/src/3-three/topics/places/api.js
var addMethod3 = function(View2) {
  View2.prototype.places = function(n3) {
    let m3 = find_default5(this);
    m3 = m3.getNth(n3);
    return new View2(this.document, m3.pointer);
  };
};
var api_default19 = addMethod3;

// reducer/node_modules/compromise/src/3-three/topics/orgs/api.js
var api16 = function(View2) {
  View2.prototype.organizations = function(n3) {
    const m3 = this.match("#Organization+");
    return m3.getNth(n3);
  };
};
var api_default20 = api16;

// reducer/node_modules/compromise/src/3-three/topics/topics.js
var find7 = function(n3) {
  const r2 = this.clauses();
  let m3 = r2.people();
  m3 = m3.concat(r2.places());
  m3 = m3.concat(r2.organizations());
  m3 = m3.not("(someone|man|woman|mother|brother|sister|father)");
  m3 = m3.sort("seq");
  m3 = m3.getNth(n3);
  return m3;
};
var api17 = function(View2) {
  View2.prototype.topics = find7;
};
var topics_default = api17;

// reducer/node_modules/compromise/src/3-three/topics/plugin.js
var api18 = function(View2) {
  api_default18(View2);
  api_default19(View2);
  api_default20(View2);
  topics_default(View2);
};
var plugin_default28 = { api: api18 };

// reducer/node_modules/compromise/src/3-three/verbs/find.js
var findVerbs = function(doc) {
  let m3 = doc.match("<Verb>");
  m3 = m3.not("#Conjunction");
  m3 = m3.not("#Preposition");
  m3 = m3.splitAfter("@hasComma");
  m3 = m3.splitAfter("[(do|did|am|was|is|will)] (is|was)", 0);
  m3 = m3.splitBefore("(#Verb && !#Copula) [being] #Verb", 0);
  m3 = m3.splitBefore("#Verb [to be] #Verb", 0);
  m3 = m3.splitAfter("[help] #PresentTense", 0);
  m3 = m3.splitBefore("(#PresentTense|#PastTense) [#Copula]$", 0);
  m3 = m3.splitBefore("(#PresentTense|#PastTense) [will be]$", 0);
  m3 = m3.splitBefore("(#PresentTense|#PastTense) [(had|has)]", 0);
  m3 = m3.not("#Reflexive$");
  m3 = m3.not("#Adjective");
  m3 = m3.splitAfter("[#PastTense] #PastTense", 0);
  m3 = m3.splitAfter("[#PastTense] #Auxiliary+ #PastTense", 0);
  m3 = m3.splitAfter("#Copula [#Gerund] #PastTense", 0);
  m3 = m3.if("#Verb");
  if (m3.has("(#Verb && !#Auxiliary) #Adverb+? #Copula")) {
    m3 = m3.splitBefore("#Copula");
  }
  return m3;
};
var find_default6 = findVerbs;

// reducer/node_modules/compromise/src/3-three/verbs/api/parse/root.js
var getMain = function(vb3) {
  let root = vb3;
  if (vb3.wordCount() > 1) {
    root = vb3.not("(#Negative|#Auxiliary|#Modal|#Adverb|#Prefix)");
  }
  if (root.length > 1 && !root.has("#Phrasal #Particle")) {
    root = root.last();
  }
  root = root.not("(want|wants|wanted) to");
  if (!root.found) {
    root = vb3.not("#Negative");
    return root;
  }
  return root;
};
var root_default2 = getMain;

// reducer/node_modules/compromise/src/3-three/verbs/api/parse/adverbs.js
var getAdverbs = function(vb3, root) {
  const res = {
    pre: vb3.none(),
    post: vb3.none()
  };
  if (!vb3.has("#Adverb")) {
    return res;
  }
  const parts = vb3.splitOn(root);
  if (parts.length === 3) {
    return {
      pre: parts.eq(0).adverbs(),
      post: parts.eq(2).adverbs()
    };
  }
  if (parts.eq(0).isDoc(root)) {
    res.post = parts.eq(1).adverbs();
    return res;
  }
  res.pre = parts.eq(0).adverbs();
  return res;
};
var adverbs_default = getAdverbs;

// reducer/node_modules/compromise/src/3-three/verbs/api/parse/index.js
var getAuxiliary = function(vb3, root) {
  const parts = vb3.splitBefore(root);
  if (parts.length <= 1) {
    return vb3.none();
  }
  let aux = parts.eq(0);
  aux = aux.not("(#Adverb|#Negative|#Prefix)");
  return aux;
};
var getNegative = function(vb3) {
  return vb3.match("#Negative");
};
var getPhrasal = function(root) {
  if (!root.has("(#Particle|#PhrasalVerb)")) {
    return {
      verb: root.none(),
      particle: root.none()
    };
  }
  const particle = root.match("#Particle$");
  return {
    verb: root.not(particle),
    particle
  };
};
var parseVerb = function(view) {
  const vb3 = view.clone();
  vb3.contractions().expand();
  const root = root_default2(vb3);
  const res = {
    root,
    prefix: vb3.match("#Prefix"),
    adverbs: adverbs_default(vb3, root),
    auxiliary: getAuxiliary(vb3, root),
    negative: getNegative(vb3),
    phrasal: getPhrasal(root)
  };
  return res;
};
var parse_default8 = parseVerb;

// reducer/node_modules/compromise/src/3-three/verbs/api/parse/grammar/forms.js
var present = { tense: "PresentTense" };
var conditional = { conditional: true };
var future = { tense: "FutureTense" };
var prog = { progressive: true };
var past2 = { tense: "PastTense" };
var complete = { complete: true, progressive: false };
var passive = { passive: true };
var plural = { plural: true };
var singular = { plural: false };
var getData = function(tags) {
  const data = {};
  tags.forEach((o2) => {
    Object.assign(data, o2);
  });
  return data;
};
var verbForms = {
  // === Simple ===
  "imperative": [
    // walk!
    ["#Imperative", []]
  ],
  "want-infinitive": [
    ["^(want|wants|wanted) to #Infinitive$", [present]],
    ["^wanted to #Infinitive$", [past2]],
    ["^will want to #Infinitive$", [future]]
  ],
  "gerund-phrase": [
    // started looking
    ["^#PastTense #Gerund$", [past2]],
    // starts looking
    ["^#PresentTense #Gerund$", [present]],
    // start looking
    ["^#Infinitive #Gerund$", [present]],
    // will start looking
    ["^will #Infinitive #Gerund$", [future]],
    // have started looking
    ["^have #PastTense #Gerund$", [past2]],
    // will have started looking
    ["^will have #PastTense #Gerund$", [past2]]
  ],
  "simple-present": [
    // he walks',
    ["^#PresentTense$", [present]],
    // we walk
    ["^#Infinitive$", [present]]
  ],
  "simple-past": [
    // he walked',
    ["^#PastTense$", [past2]]
  ],
  "simple-future": [
    // he will walk
    ["^will #Adverb? #Infinitive", [future]]
  ],
  // === Progressive ===
  "present-progressive": [
    // he is walking
    ["^(is|are|am) #Gerund$", [present, prog]]
  ],
  "past-progressive": [
    // he was walking
    ["^(was|were) #Gerund$", [past2, prog]]
  ],
  "future-progressive": [
    // he will be
    ["^will be #Gerund$", [future, prog]]
  ],
  // === Perfect ===
  "present-perfect": [
    // he has walked
    ["^(has|have) #PastTense$", [past2, complete]]
    //past?
  ],
  "past-perfect": [
    // he had walked
    ["^had #PastTense$", [past2, complete]],
    // had been to see
    ["^had #PastTense to #Infinitive", [past2, complete]]
  ],
  "future-perfect": [
    // he will have
    ["^will have #PastTense$", [future, complete]]
  ],
  // === Progressive-perfect ===
  "present-perfect-progressive": [
    // he has been walking
    ["^(has|have) been #Gerund$", [past2, prog]]
    //present?
  ],
  "past-perfect-progressive": [
    // he had been
    ["^had been #Gerund$", [past2, prog]]
  ],
  "future-perfect-progressive": [
    // will have been
    ["^will have been #Gerund$", [future, prog]]
  ],
  // ==== Passive ===
  "passive-past": [
    // got walked, was walked, were walked
    ["(got|were|was) #Passive", [past2, passive]],
    // was being walked
    ["^(was|were) being #Passive", [past2, passive]],
    // had been walked, have been eaten
    ["^(had|have) been #Passive", [past2, passive]]
  ],
  "passive-present": [
    // is walked, are stolen
    ["^(is|are|am) #Passive", [present, passive]],
    // is being walked
    ["^(is|are|am) being #Passive", [present, passive]],
    // has been cleaned
    ["^has been #Passive", [present, passive]]
  ],
  "passive-future": [
    // will have been walked
    ["will have been #Passive", [future, passive, conditional]],
    // will be cleaned
    ["will be being? #Passive", [future, passive, conditional]]
  ],
  // === Conditional ===
  "present-conditional": [
    // would be walked
    ["would be #PastTense", [present, conditional]]
  ],
  "past-conditional": [
    // would have been walked
    ["would have been #PastTense", [past2, conditional]]
  ],
  // ==== Auxiliary ===
  "auxiliary-future": [
    // going to drink
    ["(is|are|am|was) going to (#Infinitive|#PresentTense)", [future]]
  ],
  "auxiliary-past": [
    // he did walk
    ["^did #Infinitive$", [past2, singular]],
    // used to walk
    ["^used to #Infinitive$", [past2, complete]]
  ],
  "auxiliary-present": [
    // we do walk
    ["^(does|do) #Infinitive$", [present, complete, plural]]
  ],
  // === modals ===
  "modal-past": [
    // he could have walked
    ["^(could|must|should|shall) have #PastTense$", [past2]]
  ],
  "modal-infinitive": [
    // he can walk
    ["^#Modal #Infinitive$", []]
  ],
  "infinitive": [
    // walk
    ["^#Infinitive$", []]
  ]
};
var list3 = [];
Object.keys(verbForms).map((k2) => {
  verbForms[k2].forEach((a2) => {
    list3.push({
      name: k2,
      match: a2[0],
      data: getData(a2[1])
    });
  });
});
var forms_default = list3;

// reducer/node_modules/compromise/src/3-three/verbs/api/parse/grammar/index.js
var cleanUp2 = function(vb3, res) {
  vb3 = vb3.clone();
  if (res.adverbs.post && res.adverbs.post.found) {
    vb3.remove(res.adverbs.post);
  }
  if (res.adverbs.pre && res.adverbs.pre.found) {
    vb3.remove(res.adverbs.pre);
  }
  if (vb3.has("#Negative")) {
    vb3 = vb3.remove("#Negative");
  }
  if (vb3.has("#Prefix")) {
    vb3 = vb3.remove("#Prefix");
  }
  if (res.root.has("#PhrasalVerb #Particle")) {
    vb3.remove("#Particle$");
  }
  vb3 = vb3.not("#Adverb");
  return vb3;
};
var isInfinitive = function(vb3) {
  if (vb3.has("#Infinitive")) {
    const m3 = vb3.growLeft("to");
    if (m3.has("^to #Infinitive")) {
      return true;
    }
  }
  return false;
};
var getGrammar = function(vb3, res) {
  const grammar2 = {};
  vb3 = cleanUp2(vb3, res);
  for (let i3 = 0; i3 < forms_default.length; i3 += 1) {
    const todo = forms_default[i3];
    if (vb3.has(todo.match) === true) {
      grammar2.form = todo.name;
      Object.assign(grammar2, todo.data);
      break;
    }
  }
  if (!grammar2.form) {
    if (vb3.has("^#Verb$")) {
      grammar2.form = "infinitive";
    }
  }
  if (!grammar2.tense) {
    grammar2.tense = res.root.has("#PastTense") ? "PastTense" : "PresentTense";
  }
  grammar2.copula = res.root.has("#Copula");
  grammar2.isInfinitive = isInfinitive(vb3);
  return grammar2;
};
var grammar_default = getGrammar;

// reducer/node_modules/compromise/src/3-three/verbs/api/parse/getSubject.js
var shouldSkip = function(last) {
  if (last.length <= 1) {
    return false;
  }
  const obj = last.parse()[0] || {};
  return obj.isSubordinate;
};
var noSubClause = function(before2) {
  let parts = before2.clauses();
  parts = parts.filter((m3, i3) => {
    if (m3.has("^(if|unless|while|but|for|per|at|by|that|which|who|from)")) {
      return false;
    }
    if (i3 > 0 && m3.has("^#Verb . #Noun+$")) {
      return false;
    }
    if (i3 > 0 && m3.has("^#Adverb")) {
      return false;
    }
    return true;
  });
  if (parts.length === 0) {
    return before2;
  }
  return parts;
};
var lastNoun2 = function(vb3) {
  let before2 = vb3.before();
  before2 = noSubClause(before2);
  const nouns = before2.nouns();
  let last = nouns.last();
  const pronoun = last.match("(i|he|she|we|you|they)");
  if (pronoun.found) {
    return pronoun.nouns();
  }
  let det = nouns.if("^(that|this|those)");
  if (det.found) {
    return det;
  }
  if (nouns.found === false) {
    det = before2.match("^(that|this|those)");
    if (det.found) {
      return det;
    }
  }
  last = nouns.last();
  if (shouldSkip(last)) {
    nouns.remove(last);
    last = nouns.last();
  }
  if (shouldSkip(last)) {
    nouns.remove(last);
    last = nouns.last();
  }
  return last;
};
var isPlural3 = function(subj, vb3) {
  if (vb3.has("(are|were|does)")) {
    return true;
  }
  if (subj.has("(those|they|we)")) {
    return true;
  }
  if (subj.found && subj.isPlural) {
    return subj.isPlural().found;
  }
  return false;
};
var getSubject = function(vb3) {
  const subj = lastNoun2(vb3);
  return {
    subject: subj,
    plural: isPlural3(subj, vb3)
  };
};
var getSubject_default = getSubject;

// reducer/node_modules/compromise/src/3-three/verbs/api/lib.js
var noop = (vb3) => vb3;
var isPlural4 = (vb3, parsed) => {
  const subj = getSubject_default(vb3, parsed);
  const m3 = subj.subject;
  if (m3.has("i") || m3.has("we")) {
    return true;
  }
  return subj.plural;
};
var wasWere = (vb3, parsed) => {
  const { subject, plural: plural2 } = getSubject_default(vb3, parsed);
  if (plural2 || subject.has("we")) {
    return "were";
  }
  return "was";
};
var isAreAm = function(vb3, parsed) {
  if (vb3.has("were")) {
    return "are";
  }
  const { subject, plural: plural2 } = getSubject_default(vb3, parsed);
  if (subject.has("i")) {
    return "am";
  }
  if (subject.has("we") || plural2) {
    return "are";
  }
  return "is";
};
var doDoes = function(vb3, parsed) {
  const subj = getSubject_default(vb3, parsed);
  const m3 = subj.subject;
  if (m3.has("i") || m3.has("we")) {
    return "do";
  }
  if (subj.plural) {
    return "do";
  }
  return "does";
};
var getTense2 = function(m3) {
  if (m3.has("#Infinitive")) {
    return "Infinitive";
  }
  if (m3.has("#Participle")) {
    return "Participle";
  }
  if (m3.has("#PastTense")) {
    return "PastTense";
  }
  if (m3.has("#Gerund")) {
    return "Gerund";
  }
  if (m3.has("#PresentTense")) {
    return "PresentTense";
  }
  return void 0;
};
var toInf = function(vb3, parsed) {
  const { toInfinitive: toInfinitive3 } = vb3.methods.two.transform.verb;
  let str = parsed.root.text({ keepPunct: false });
  str = toInfinitive3(str, vb3.model, getTense2(vb3));
  if (str) {
    vb3.replace(parsed.root, str);
  }
  return vb3;
};
var noWill = (vb3) => {
  if (vb3.has("will not")) {
    return vb3.replace("will not", "have not");
  }
  return vb3.remove("will");
};

// reducer/node_modules/compromise/src/3-three/verbs/api/toJSON.js
var toArray3 = function(m3) {
  if (!m3 || !m3.isView) {
    return [];
  }
  const opts2 = { normal: true, terms: false, text: false };
  return m3.json(opts2).map((s3) => s3.normal);
};
var toText4 = function(m3) {
  if (!m3 || !m3.isView) {
    return "";
  }
  return m3.text("normal");
};
var toInf2 = function(root) {
  const { toInfinitive: toInfinitive3 } = root.methods.two.transform.verb;
  const str = root.text("normal");
  return toInfinitive3(str, root.model, getTense2(root));
};
var toJSON3 = function(vb3) {
  const parsed = parse_default8(vb3);
  vb3 = vb3.clone().toView();
  const info = grammar_default(vb3, parsed);
  return {
    root: parsed.root.text(),
    preAdverbs: toArray3(parsed.adverbs.pre),
    postAdverbs: toArray3(parsed.adverbs.post),
    auxiliary: toText4(parsed.auxiliary),
    negative: parsed.negative.found,
    prefix: toText4(parsed.prefix),
    infinitive: toInf2(parsed.root),
    grammar: info
  };
};
var toJSON_default2 = toJSON3;

// reducer/node_modules/compromise/src/3-three/verbs/api/conjugate/toInfinitive.js
var keep3 = { tags: true };
var toInf3 = function(vb3, parsed) {
  const { toInfinitive: toInfinitive3 } = vb3.methods.two.transform.verb;
  const { root, auxiliary } = parsed;
  const aux = auxiliary.terms().harden();
  let str = root.text("normal");
  str = toInfinitive3(str, vb3.model, getTense2(root));
  if (str) {
    vb3.replace(root, str, keep3).tag("Verb").firstTerm().tag("Infinitive");
  }
  if (aux.found) {
    vb3.remove(aux);
  }
  if (parsed.negative.found) {
    if (!vb3.has("not")) {
      vb3.prepend("not");
    }
    const does = doDoes(vb3, parsed);
    vb3.prepend(does);
  }
  vb3.fullSentence().compute(["freeze", "lexicon", "preTagger", "postTagger", "unfreeze", "chunks"]);
  return vb3;
};
var toInfinitive_default3 = toInf3;

// reducer/node_modules/compromise/src/3-three/verbs/api/conjugate/toPast.js
var keep4 = { tags: true };
var fns6 = {
  noAux: (vb3, parsed) => {
    if (parsed.auxiliary.found) {
      vb3 = vb3.remove(parsed.auxiliary);
    }
    return vb3;
  },
  // walk->walked
  simple: (vb3, parsed) => {
    const { conjugate: conjugate2, toInfinitive: toInfinitive3 } = vb3.methods.two.transform.verb;
    const root = parsed.root;
    if (root.has("#Modal")) {
      return vb3;
    }
    let str = root.text({ keepPunct: false });
    str = toInfinitive3(str, vb3.model, getTense2(root));
    const all4 = conjugate2(str, vb3.model);
    str = all4.PastTense;
    str = str === "been" ? "was" : str;
    if (str === "was") {
      str = wasWere(vb3, parsed);
    }
    if (str) {
      vb3.replace(root, str, keep4);
    }
    return vb3;
  },
  both: function(vb3, parsed) {
    if (parsed.negative.found) {
      vb3.replace("will", "did");
      return vb3;
    }
    vb3 = fns6.simple(vb3, parsed);
    vb3 = fns6.noAux(vb3, parsed);
    return vb3;
  },
  hasHad: (vb3) => {
    vb3.replace("has", "had", keep4);
    return vb3;
  },
  // some verbs have this weird past-tense form
  // drive -> driven, (!drove)
  hasParticiple: (vb3, parsed) => {
    const { conjugate: conjugate2, toInfinitive: toInfinitive3 } = vb3.methods.two.transform.verb;
    const root = parsed.root;
    let str = root.text("normal");
    str = toInfinitive3(str, vb3.model, getTense2(root));
    return conjugate2(str, vb3.model).Participle;
  }
};
var forms = {
  // walk -> walked
  "infinitive": fns6.simple,
  // he walks -> he walked
  "simple-present": fns6.simple,
  // he walked
  "simple-past": noop,
  // he will walk -> he walked
  "simple-future": fns6.both,
  // he is walking
  "present-progressive": (vb3) => {
    vb3.replace("are", "were", keep4);
    vb3.replace("(is|are|am)", "was", keep4);
    return vb3;
  },
  // he was walking
  "past-progressive": noop,
  // he will be walking
  "future-progressive": (vb3, parsed) => {
    vb3.match(parsed.root).insertBefore("was");
    vb3.remove("(will|be)");
    return vb3;
  },
  // has walked -> had walked (?)
  "present-perfect": fns6.hasHad,
  // had walked
  "past-perfect": noop,
  // will have walked -> had walked
  "future-perfect": (vb3, parsed) => {
    vb3.match(parsed.root).insertBefore("had");
    if (vb3.has("will")) {
      vb3 = noWill(vb3);
    }
    vb3.remove("have");
    return vb3;
  },
  // has been walking -> had been
  "present-perfect-progressive": fns6.hasHad,
  // had been walking
  "past-perfect-progressive": noop,
  // will have been -> had
  "future-perfect-progressive": (vb3) => {
    vb3.remove("will");
    vb3.replace("have", "had", keep4);
    return vb3;
  },
  // got walked
  "passive-past": (vb3) => {
    vb3.replace("have", "had", keep4);
    return vb3;
  },
  // is being walked  -> 'was being walked'
  "passive-present": (vb3) => {
    vb3.replace("(is|are)", "was", keep4);
    return vb3;
  },
  // will be walked -> had been walked
  "passive-future": (vb3, parsed) => {
    if (parsed.auxiliary.has("will be")) {
      vb3.match(parsed.root).insertBefore("had been");
      vb3.remove("(will|be)");
    }
    if (parsed.auxiliary.has("will have been")) {
      vb3.replace("have", "had", keep4);
      vb3.remove("will");
    }
    return vb3;
  },
  // would be walked -> 'would have been walked'
  "present-conditional": (vb3) => {
    vb3.replace("be", "have been");
    return vb3;
  },
  // would have been walked
  "past-conditional": noop,
  // is going to drink -> was going to drink
  "auxiliary-future": (vb3) => {
    vb3.replace("(is|are|am)", "was", keep4);
    return vb3;
  },
  // used to walk
  "auxiliary-past": noop,
  // we do walk -> we did walk
  "auxiliary-present": (vb3) => {
    vb3.replace("(do|does)", "did", keep4);
    return vb3;
  },
  // must walk -> 'must have walked'
  "modal-infinitive": (vb3, parsed) => {
    if (vb3.has("can")) {
      vb3.replace("can", "could", keep4);
    } else {
      fns6.simple(vb3, parsed);
      vb3.match("#Modal").insertAfter("have").tag("Auxiliary");
    }
    return vb3;
  },
  // must have walked
  "modal-past": noop,
  // wanted to walk
  "want-infinitive": (vb3) => {
    vb3.replace("(want|wants)", "wanted", keep4);
    vb3.remove("will");
    return vb3;
  },
  // started looking
  "gerund-phrase": (vb3, parsed) => {
    parsed.root = parsed.root.not("#Gerund$");
    fns6.simple(vb3, parsed);
    noWill(vb3);
    return vb3;
  }
};
var toPast3 = function(vb3, parsed, form) {
  if (forms.hasOwnProperty(form)) {
    vb3 = forms[form](vb3, parsed);
    vb3.fullSentence().compute(["tagger", "chunks"]);
    return vb3;
  }
  return vb3;
};
var toPast_default2 = toPast3;

// reducer/node_modules/compromise/src/3-three/verbs/api/conjugate/toParticiple.js
var haveHas = function(vb3, parsed) {
  const subj = getSubject_default(vb3, parsed);
  const m3 = subj.subject;
  if (m3.has("(i|we|you)")) {
    return "have";
  }
  if (subj.plural === false) {
    return "has";
  }
  if (m3.has("he") || m3.has("she") || m3.has("#Person")) {
    return "has";
  }
  return "have";
};
var simple = (vb3, parsed) => {
  const { conjugate: conjugate2, toInfinitive: toInfinitive3 } = vb3.methods.two.transform.verb;
  const { root, auxiliary } = parsed;
  if (root.has("#Modal")) {
    return vb3;
  }
  let str = root.text({ keepPunct: false });
  str = toInfinitive3(str, vb3.model, getTense2(root));
  const all4 = conjugate2(str, vb3.model);
  str = all4.Participle || all4.PastTense;
  if (str) {
    vb3 = vb3.replace(root, str);
    const have = haveHas(vb3, parsed);
    vb3.prepend(have).match(have).tag("Auxiliary");
    vb3.remove(auxiliary);
  }
  return vb3;
};
var forms2 = {
  // walk -> walked
  "infinitive": simple,
  // he walks -> he walked
  "simple-present": simple,
  // he walked
  // 'simple-past': noop,
  // he will walk -> he walked
  "simple-future": (vb3, parsed) => vb3.replace("will", haveHas(vb3, parsed)),
  // he is walking
  // 'present-progressive': noop,
  // he was walking
  // 'past-progressive': noop,
  // he will be walking
  // 'future-progressive': noop,
  // has walked -> had walked (?)
  "present-perfect": noop,
  // had walked
  "past-perfect": noop,
  // will have walked -> had walked
  "future-perfect": (vb3, parsed) => vb3.replace("will have", haveHas(vb3, parsed)),
  // has been walking -> had been
  "present-perfect-progressive": noop,
  // had been walking
  "past-perfect-progressive": noop,
  // will have been -> had
  "future-perfect-progressive": noop
  // got walked
  // 'passive-past': noop,
  // is being walked  -> 'was being walked'
  // 'passive-present': noop,
  // will be walked -> had been walked
  // 'passive-future': noop,
  // would be walked -> 'would have been walked'
  // 'present-conditional': noop,
  // would have been walked
  // 'past-conditional': noop,
  // is going to drink -> was going to drink
  // 'auxiliary-future': noop,
  // used to walk
  // 'auxiliary-past': noop,
  // we do walk -> we did walk
  // 'auxiliary-present': noop,
  // must walk -> 'must have walked'
  // 'modal-infinitive': noop,
  // must have walked
  // 'modal-past': noop,
  // wanted to walk
  // 'want-infinitive': noop,
  // started looking
  // 'gerund-phrase': noop,
};
var toPast4 = function(vb3, parsed, form) {
  if (forms2.hasOwnProperty(form)) {
    vb3 = forms2[form](vb3, parsed);
    vb3.fullSentence().compute(["tagger", "chunks"]);
    return vb3;
  }
  vb3 = simple(vb3, parsed, form);
  vb3.fullSentence().compute(["tagger", "chunks"]);
  return vb3;
};
var toParticiple_default = toPast4;

// reducer/node_modules/compromise/src/3-three/verbs/api/conjugate/toPresent.js
var keep5 = { tags: true };
var simple2 = (vb3, parsed) => {
  const { conjugate: conjugate2, toInfinitive: toInfinitive3 } = vb3.methods.two.transform.verb;
  const root = parsed.root;
  let str = root.text("normal");
  str = toInfinitive3(str, vb3.model, getTense2(root));
  if (isPlural4(vb3, parsed) === false) {
    str = conjugate2(str, vb3.model).PresentTense;
  }
  if (root.has("#Copula")) {
    str = isAreAm(vb3, parsed);
  }
  if (str) {
    vb3 = vb3.replace(root, str, keep5);
    vb3.not("#Particle").tag("PresentTense");
  }
  return vb3;
};
var toGerund2 = (vb3, parsed) => {
  const { conjugate: conjugate2, toInfinitive: toInfinitive3 } = vb3.methods.two.transform.verb;
  const root = parsed.root;
  let str = root.text("normal");
  str = toInfinitive3(str, vb3.model, getTense2(root));
  if (isPlural4(vb3, parsed) === false) {
    str = conjugate2(str, vb3.model).Gerund;
  }
  if (str) {
    vb3 = vb3.replace(root, str, keep5);
    vb3.not("#Particle").tag("Gerund");
  }
  return vb3;
};
var vbToInf = (vb3, parsed) => {
  const { toInfinitive: toInfinitive3 } = vb3.methods.two.transform.verb;
  const root = parsed.root;
  let str = parsed.root.text("normal");
  str = toInfinitive3(str, vb3.model, getTense2(root));
  if (str) {
    vb3 = vb3.replace(parsed.root, str, keep5);
  }
  return vb3;
};
var forms3 = {
  // walk
  "infinitive": simple2,
  // he walks -> he walked
  "simple-present": (vb3, parsed) => {
    const { conjugate: conjugate2 } = vb3.methods.two.transform.verb;
    const { root } = parsed;
    if (root.has("#Infinitive")) {
      const subj = getSubject_default(vb3, parsed);
      const m3 = subj.subject;
      if (isPlural4(vb3, parsed) || m3.has("i")) {
        return vb3;
      }
      const str = root.text("normal");
      const pres = conjugate2(str, vb3.model).PresentTense;
      if (str !== pres) {
        vb3.replace(root, pres, keep5);
      }
    } else {
      return simple2(vb3, parsed);
    }
    return vb3;
  },
  // he walked
  "simple-past": simple2,
  // he will walk -> he walked
  "simple-future": (vb3, parsed) => {
    const { root, auxiliary } = parsed;
    if (auxiliary.has("will") && root.has("be")) {
      const str = isAreAm(vb3, parsed);
      vb3.replace(root, str);
      vb3 = vb3.remove("will");
      vb3.replace("not " + str, str + " not");
    } else {
      simple2(vb3, parsed);
      vb3 = vb3.remove("will");
    }
    return vb3;
  },
  // is walking ->
  "present-progressive": noop,
  // was walking -> is walking
  "past-progressive": (vb3, parsed) => {
    const str = isAreAm(vb3, parsed);
    return vb3.replace("(were|was)", str, keep5);
  },
  // will be walking -> is walking
  "future-progressive": (vb3) => {
    vb3.match("will").insertBefore("is");
    vb3.remove("be");
    return vb3.remove("will");
  },
  // has walked ->  (?)
  "present-perfect": (vb3, parsed) => {
    simple2(vb3, parsed);
    vb3 = vb3.remove("(have|had|has)");
    return vb3;
  },
  // had walked -> has walked
  "past-perfect": (vb3, parsed) => {
    const subj = getSubject_default(vb3, parsed);
    const m3 = subj.subject;
    if (isPlural4(vb3, parsed) || m3.has("i")) {
      vb3 = toInf(vb3, parsed);
      vb3.remove("had");
      return vb3;
    }
    vb3.replace("had", "has", keep5);
    return vb3;
  },
  // will have walked -> has walked
  "future-perfect": (vb3) => {
    vb3.match("will").insertBefore("has");
    return vb3.remove("have").remove("will");
  },
  // has been walking
  "present-perfect-progressive": noop,
  // had been walking
  "past-perfect-progressive": (vb3) => vb3.replace("had", "has", keep5),
  // will have been -> has been
  "future-perfect-progressive": (vb3) => {
    vb3.match("will").insertBefore("has");
    return vb3.remove("have").remove("will");
  },
  // got walked -> is walked
  // was walked -> is walked
  // had been walked -> is walked
  "passive-past": (vb3, parsed) => {
    const str = isAreAm(vb3, parsed);
    if (vb3.has("(had|have|has)") && vb3.has("been")) {
      vb3.replace("(had|have|has)", str, keep5);
      vb3.replace("been", "being");
      return vb3;
    }
    return vb3.replace("(got|was|were)", str);
  },
  // is being walked  ->
  "passive-present": noop,
  // will be walked -> is being walked
  "passive-future": (vb3) => {
    vb3.replace("will", "is");
    return vb3.replace("be", "being");
  },
  // would be walked ->
  "present-conditional": noop,
  // would have been walked ->
  "past-conditional": (vb3) => {
    vb3.replace("been", "be");
    return vb3.remove("have");
  },
  // is going to drink -> is drinking
  "auxiliary-future": (vb3, parsed) => {
    toGerund2(vb3, parsed);
    vb3.remove("(going|to)");
    return vb3;
  },
  // used to walk -> is walking
  // did walk -> is walking
  "auxiliary-past": (vb3, parsed) => {
    if (parsed.auxiliary.has("did")) {
      const str = doDoes(vb3, parsed);
      vb3.replace(parsed.auxiliary, str);
      return vb3;
    }
    toGerund2(vb3, parsed);
    vb3.replace(parsed.auxiliary, "is");
    return vb3;
  },
  // we do walk ->
  "auxiliary-present": noop,
  // must walk -> 'must have walked'
  "modal-infinitive": noop,
  // must have walked
  "modal-past": (vb3, parsed) => {
    vbToInf(vb3, parsed);
    return vb3.remove("have");
  },
  // started looking
  "gerund-phrase": (vb3, parsed) => {
    parsed.root = parsed.root.not("#Gerund$");
    simple2(vb3, parsed);
    return vb3.remove("(will|have)");
  },
  // wanted to walk
  "want-infinitive": (vb3, parsed) => {
    let str = "wants";
    if (isPlural4(vb3, parsed)) {
      str = "want";
    }
    vb3.replace("(want|wanted|wants)", str, keep5);
    vb3.remove("will");
    return vb3;
  }
};
var toPresent3 = function(vb3, parsed, form) {
  if (forms3.hasOwnProperty(form)) {
    vb3 = forms3[form](vb3, parsed);
    vb3.fullSentence().compute(["tagger", "chunks"]);
    return vb3;
  }
  return vb3;
};
var toPresent_default2 = toPresent3;

// reducer/node_modules/compromise/src/3-three/verbs/api/conjugate/toFuture.js
var keep6 = { tags: true };
var simple3 = (vb3, parsed) => {
  const { toInfinitive: toInfinitive3 } = vb3.methods.two.transform.verb;
  const { root, auxiliary } = parsed;
  if (root.has("#Modal")) {
    return vb3;
  }
  let str = root.text("normal");
  str = toInfinitive3(str, vb3.model, getTense2(root));
  if (str) {
    vb3 = vb3.replace(root, str, keep6);
    vb3.not("#Particle").tag("Verb");
  }
  vb3.prepend("will").match("will").tag("Auxiliary");
  vb3.remove(auxiliary);
  return vb3;
};
var progressive = (vb3, parsed) => {
  const { conjugate: conjugate2, toInfinitive: toInfinitive3 } = vb3.methods.two.transform.verb;
  const { root, auxiliary } = parsed;
  let str = root.text("normal");
  str = toInfinitive3(str, vb3.model, getTense2(root));
  if (str) {
    str = conjugate2(str, vb3.model).Gerund;
    vb3.replace(root, str, keep6);
    vb3.not("#Particle").tag("PresentTense");
  }
  vb3.remove(auxiliary);
  vb3.prepend("will be").match("will be").tag("Auxiliary");
  return vb3;
};
var forms4 = {
  // walk ->
  "infinitive": simple3,
  // he walks ->
  "simple-present": simple3,
  // he walked
  "simple-past": simple3,
  // he will walk ->
  "simple-future": noop,
  // is walking ->
  "present-progressive": progressive,
  // was walking ->
  "past-progressive": progressive,
  // will be walking ->
  "future-progressive": noop,
  // has walked ->
  "present-perfect": (vb3) => {
    vb3.match("(have|has)").replaceWith("will have");
    return vb3;
  },
  // had walked ->
  "past-perfect": (vb3) => vb3.replace("(had|has)", "will have"),
  // will have walked ->
  "future-perfect": noop,
  // has been walking
  "present-perfect-progressive": (vb3) => vb3.replace("has", "will have"),
  // had been walking
  "past-perfect-progressive": (vb3) => vb3.replace("had", "will have"),
  // will have been ->
  "future-perfect-progressive": noop,
  // got walked ->
  // was walked ->
  // was being walked ->
  // had been walked ->
  "passive-past": (vb3) => {
    if (vb3.has("got")) {
      return vb3.replace("got", "will get");
    }
    if (vb3.has("(was|were)")) {
      vb3.replace("(was|were)", "will be");
      return vb3.remove("being");
    }
    if (vb3.has("(have|has|had) been")) {
      return vb3.replace("(have|has|had) been", "will be");
    }
    return vb3;
  },
  // is being walked  ->
  "passive-present": (vb3) => {
    vb3.replace("being", "will be");
    vb3.remove("(is|are|am)");
    return vb3;
  },
  // will be walked ->
  "passive-future": noop,
  // would be walked ->
  "present-conditional": (vb3) => vb3.replace("would", "will"),
  // would have been walked ->
  "past-conditional": (vb3) => vb3.replace("would", "will"),
  // is going to drink ->
  "auxiliary-future": noop,
  // used to walk -> is walking
  // did walk -> is walking
  "auxiliary-past": (vb3) => {
    if (vb3.has("used") && vb3.has("to")) {
      vb3.replace("used", "will");
      return vb3.remove("to");
    }
    vb3.replace("did", "will");
    return vb3;
  },
  // we do walk ->
  // he does walk ->
  "auxiliary-present": (vb3) => {
    return vb3.replace("(do|does)", "will");
  },
  // must walk ->
  "modal-infinitive": noop,
  // must have walked
  "modal-past": noop,
  // started looking
  "gerund-phrase": (vb3, parsed) => {
    parsed.root = parsed.root.not("#Gerund$");
    simple3(vb3, parsed);
    return vb3.remove("(had|have)");
  },
  // wanted to walk
  "want-infinitive": (vb3) => {
    vb3.replace("(want|wants|wanted)", "will want");
    return vb3;
  }
};
var toFuture2 = function(vb3, parsed, form) {
  if (vb3.has("will") || vb3.has("going to")) {
    return vb3;
  }
  if (forms4.hasOwnProperty(form)) {
    vb3 = forms4[form](vb3, parsed);
    vb3.fullSentence().compute(["tagger", "chunks"]);
    return vb3;
  }
  return vb3;
};
var toFuture_default2 = toFuture2;

// reducer/node_modules/compromise/src/3-three/verbs/api/conjugate/toGerund.js
var keep7 = { tags: true };
var toGerund3 = function(vb3, parsed) {
  const { toInfinitive: toInfinitive3, conjugate: conjugate2 } = vb3.methods.two.transform.verb;
  const { root, auxiliary } = parsed;
  if (vb3.has("#Gerund")) {
    return vb3;
  }
  let str = root.text("normal");
  str = toInfinitive3(str, vb3.model, getTense2(root));
  const gerund = conjugate2(str, vb3.model).Gerund;
  if (gerund) {
    const aux = isAreAm(vb3, parsed);
    vb3.replace(root, gerund, keep7);
    vb3.remove(auxiliary);
    vb3.prepend(aux);
  }
  vb3.replace("not is", "is not");
  vb3.replace("not are", "are not");
  vb3.fullSentence().compute(["tagger", "chunks"]);
  return vb3;
};
var toGerund_default = toGerund3;

// reducer/node_modules/compromise/src/3-three/verbs/api/conjugate/toNegative.js
var keep8 = { tags: true };
var doesNot = function(vb3, parsed) {
  const does = doDoes(vb3, parsed);
  vb3.prepend(does + " not");
  return vb3;
};
var isWas = function(vb3) {
  let m3 = vb3.match("be");
  if (m3.found) {
    m3.prepend("not");
    return vb3;
  }
  m3 = vb3.match("(is|was|am|are|will|were)");
  if (m3.found) {
    m3.append("not");
    return vb3;
  }
  return vb3;
};
var hasCopula = (vb3) => vb3.has("(is|was|am|are|will|were|be)");
var forms5 = {
  // he walks' -> 'he does not walk'
  "simple-present": (vb3, parsed) => {
    if (hasCopula(vb3) === true) {
      return isWas(vb3, parsed);
    }
    vb3 = toInf(vb3, parsed);
    vb3 = doesNot(vb3, parsed);
    return vb3;
  },
  // 'he walked' -> 'he did not walk'
  "simple-past": (vb3, parsed) => {
    if (hasCopula(vb3) === true) {
      return isWas(vb3, parsed);
    }
    vb3 = toInf(vb3, parsed);
    vb3.prepend("did not");
    return vb3;
  },
  // walk! -> 'do not walk'
  "imperative": (vb3) => {
    vb3.prepend("do not");
    return vb3;
  },
  // walk -> does not walk
  "infinitive": (vb3, parsed) => {
    if (hasCopula(vb3) === true) {
      return isWas(vb3, parsed);
    }
    return doesNot(vb3, parsed);
  },
  "passive-past": (vb3) => {
    if (vb3.has("got")) {
      vb3.replace("got", "get", keep8);
      vb3.prepend("did not");
      return vb3;
    }
    const m3 = vb3.match("(was|were|had|have)");
    if (m3.found) {
      m3.append("not");
    }
    return vb3;
  },
  "auxiliary-past": (vb3) => {
    if (vb3.has("used")) {
      vb3.prepend("did not");
      return vb3;
    }
    const m3 = vb3.match("(did|does|do)");
    if (m3.found) {
      m3.append("not");
    }
    return vb3;
  },
  // wants to walk
  "want-infinitive": (vb3, parsed) => {
    vb3 = doesNot(vb3, parsed);
    vb3 = vb3.replace("wants", "want", keep8);
    return vb3;
  }
};
var toNegative2 = function(vb3, parsed, form) {
  if (vb3.has("#Negative")) {
    return vb3;
  }
  if (forms5.hasOwnProperty(form)) {
    vb3 = forms5[form](vb3, parsed);
    return vb3;
  }
  let m3 = vb3.matchOne("be");
  if (m3.found) {
    m3.prepend("not");
    return vb3;
  }
  if (hasCopula(vb3) === true) {
    return isWas(vb3, parsed);
  }
  m3 = vb3.matchOne("(will|had|have|has|did|does|do|#Modal)");
  if (m3.found) {
    m3.append("not");
    return vb3;
  }
  return vb3;
};
var toNegative_default = toNegative2;

// reducer/node_modules/compromise/src/3-three/verbs/api/api.js
var api19 = function(View2) {
  class Verbs extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Verbs";
    }
    parse(n3) {
      return this.getNth(n3).map(parse_default8);
    }
    json(opts2, n3) {
      const m3 = this.getNth(n3);
      const arr = m3.map((vb3) => {
        const json = vb3.toView().json(opts2)[0] || {};
        json.verb = toJSON_default2(vb3);
        return json;
      }, []);
      return arr;
    }
    subjects(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default8(vb3);
        return getSubject_default(vb3, parsed).subject;
      });
    }
    adverbs(n3) {
      return this.getNth(n3).map((vb3) => vb3.match("#Adverb"));
    }
    isSingular(n3) {
      return this.getNth(n3).filter((vb3) => {
        return getSubject_default(vb3).plural !== true;
      });
    }
    isPlural(n3) {
      return this.getNth(n3).filter((vb3) => {
        return getSubject_default(vb3).plural === true;
      });
    }
    isImperative(n3) {
      return this.getNth(n3).filter((vb3) => vb3.has("#Imperative"));
    }
    toInfinitive(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default8(vb3);
        const info = grammar_default(vb3, parsed);
        return toInfinitive_default3(vb3, parsed, info.form);
      });
    }
    toPresentTense(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default8(vb3);
        const info = grammar_default(vb3, parsed);
        if (info.isInfinitive) {
          return vb3;
        }
        return toPresent_default2(vb3, parsed, info.form);
      });
    }
    toPastTense(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default8(vb3);
        const info = grammar_default(vb3, parsed);
        if (info.isInfinitive) {
          return vb3;
        }
        return toPast_default2(vb3, parsed, info.form);
      });
    }
    toFutureTense(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default8(vb3);
        const info = grammar_default(vb3, parsed);
        if (info.isInfinitive) {
          return vb3;
        }
        return toFuture_default2(vb3, parsed, info.form);
      });
    }
    toGerund(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default8(vb3);
        const info = grammar_default(vb3, parsed);
        if (info.isInfinitive) {
          return vb3;
        }
        return toGerund_default(vb3, parsed, info.form);
      });
    }
    toPastParticiple(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default8(vb3);
        const info = grammar_default(vb3, parsed);
        if (info.isInfinitive) {
          return vb3;
        }
        return toParticiple_default(vb3, parsed, info.form);
      });
    }
    conjugate(n3) {
      const { conjugate: conjugate2, toInfinitive: toInfinitive3 } = this.world.methods.two.transform.verb;
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default8(vb3);
        const info = grammar_default(vb3, parsed);
        if (info.form === "imperative") {
          info.form = "simple-present";
        }
        let inf = parsed.root.text("normal");
        if (!parsed.root.has("#Infinitive")) {
          const tense = getTense2(parsed.root);
          inf = toInfinitive3(inf, vb3.model, tense) || inf;
        }
        return conjugate2(inf, vb3.model);
      }, []);
    }
    /** return only verbs with 'not'*/
    isNegative() {
      return this.if("#Negative");
    }
    /**  return only verbs without 'not'*/
    isPositive() {
      return this.ifNo("#Negative");
    }
    /** remove 'not' from these verbs */
    toPositive() {
      const m3 = this.match("do not #Verb");
      if (m3.found) {
        m3.remove("do not");
      }
      return this.remove("#Negative");
    }
    toNegative(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default8(vb3);
        const info = grammar_default(vb3, parsed);
        return toNegative_default(vb3, parsed, info.form);
      });
    }
    // overloaded - keep Verb class
    update(pointer) {
      const m3 = new Verbs(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  Verbs.prototype.toPast = Verbs.prototype.toPastTense;
  Verbs.prototype.toPresent = Verbs.prototype.toPresentTense;
  Verbs.prototype.toFuture = Verbs.prototype.toFutureTense;
  View2.prototype.verbs = function(n3) {
    let vb3 = find_default6(this);
    vb3 = vb3.getNth(n3);
    return new Verbs(this.document, vb3.pointer);
  };
};
var api_default21 = api19;

// reducer/node_modules/compromise/src/3-three/verbs/plugin.js
var plugin_default29 = {
  api: api_default21
};

// reducer/node_modules/compromise/src/3-three/coreference/compute/lib.js
var findChained = function(want, s3) {
  const m3 = s3.match(want);
  if (m3.found) {
    const ref = m3.pronouns().refersTo();
    if (ref.found) {
      return ref;
    }
  }
  return s3.none();
};
var prevSentence = function(m3) {
  if (!m3.found) {
    return m3;
  }
  const [n3] = m3.fullPointer[0];
  if (n3 && n3 > 0) {
    return m3.update([[n3 - 1]]);
  }
  return m3.none();
};

// reducer/node_modules/compromise/src/3-three/coreference/compute/findPerson.js
var byGender = function(ppl, gender) {
  if (gender === "m") {
    return ppl.filter((m3) => !m3.presumedFemale().found);
  } else if (gender === "f") {
    return ppl.filter((m3) => !m3.presumedMale().found);
  }
  return ppl;
};
var getPerson = function(s3, gender) {
  let people = s3.people();
  people = byGender(people, gender);
  if (people.found) {
    return people.last();
  }
  people = s3.nouns("#Actor");
  if (people.found) {
    return people.last();
  }
  if (gender === "f") {
    return findChained("(she|her|hers)", s3);
  }
  if (gender === "m") {
    return findChained("(he|him|his)", s3);
  }
  return s3.none();
};
var findPerson_default = getPerson;

// reducer/node_modules/compromise/src/3-three/coreference/compute/findThey.js
var getThey = function(s3) {
  const nouns = s3.nouns();
  let things = nouns.isPlural().notIf("#Pronoun");
  if (things.found) {
    return things.last();
  }
  const chain = findChained("(they|their|theirs)", s3);
  if (chain.found) {
    return chain;
  }
  things = nouns.match("(somebody|nobody|everybody|anybody|someone|noone|everyone|anyone)");
  if (things.found) {
    return things.last();
  }
  return s3.none();
};
var findThey_default = getThey;

// reducer/node_modules/compromise/src/3-three/coreference/compute/index.js
var addReference = function(pron, m3) {
  if (m3 && m3.found) {
    const term = pron.docs[0][0];
    term.reference = m3.ptrs[0];
  }
};
var stepBack = function(m3, cb) {
  let s3 = m3.before();
  let res = cb(s3);
  if (res.found) {
    return res;
  }
  s3 = prevSentence(m3);
  res = cb(s3);
  if (res.found) {
    return res;
  }
  s3 = prevSentence(s3);
  res = cb(s3);
  if (res.found) {
    return res;
  }
  return m3.none();
};
var coreference = function(view) {
  const pronouns = view.pronouns().if("(he|him|his|she|her|hers|they|their|theirs|it|its)");
  pronouns.forEach((pron) => {
    let res = null;
    if (pron.has("(he|him|his)")) {
      res = stepBack(pron, (m3) => findPerson_default(m3, "m"));
    } else if (pron.has("(she|her|hers)")) {
      res = stepBack(pron, (m3) => findPerson_default(m3, "f"));
    } else if (pron.has("(they|their|theirs)")) {
      res = stepBack(pron, findThey_default);
    }
    if (res && res.found) {
      addReference(pron, res);
    }
  });
};
var compute_default13 = coreference;

// reducer/node_modules/compromise/src/3-three/coreference/api/pronouns.js
var api20 = function(View2) {
  class Pronouns extends View2 {
    constructor(document, pointer, groups) {
      super(document, pointer, groups);
      this.viewType = "Pronouns";
    }
    hasReference() {
      this.compute("coreference");
      return this.filter((m3) => {
        const term = m3.docs[0][0];
        return term.reference;
      });
    }
    // get the noun-phrase this pronoun refers to
    refersTo() {
      this.compute("coreference");
      return this.map((m3) => {
        if (!m3.found) {
          return m3.none();
        }
        const term = m3.docs[0][0];
        if (term.reference) {
          return m3.update([term.reference]);
        }
        return m3.none();
      });
    }
    // overloaded - keep Numbers class
    update(pointer) {
      const m3 = new Pronouns(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  View2.prototype.pronouns = function(n3) {
    let m3 = this.match("#Pronoun");
    m3 = m3.getNth(n3);
    return new Pronouns(m3.document, m3.pointer);
  };
};
var pronouns_default = api20;

// reducer/node_modules/compromise/src/3-three/coreference/plugin.js
var plugin_default30 = {
  compute: { coreference: compute_default13 },
  api: pronouns_default
};

// reducer/node_modules/compromise/src/three.js
two_default.plugin(plugin_default19);
two_default.plugin(plugin_default20);
two_default.plugin(plugin_default21);
two_default.plugin(plugin_default30);
two_default.plugin(plugin_default22);
two_default.plugin(plugin_default23);
two_default.plugin(plugin_default24);
two_default.plugin(plugin_default25);
two_default.plugin(plugin_default26);
two_default.plugin(plugin_default27);
two_default.plugin(plugin_default28);
two_default.plugin(plugin_default29);
var three_default = two_default;
export {
  three_default as default
};
