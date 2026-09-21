// press/pile.mjs — A PILE YOU PRINT INTO: a git-enough repository held on this device.
//
// "We want to be an anecdote printing press to our own piles." A pile here is exactly what the viewer
// already lists (viewer/repos.mjs): a repository, local, yours. Printing a sheet into it is a COMMIT — the
// steady beat of docs/git-enough.md — so a pile's history is what was printed and when, readable by any
// real `git`, and the unit a bottle is later poured from.
//
// commitFiles() stages exactly the files it is given, so a strike carries the tip's tree forward and adds
// to it; git's content addressing makes re-staging the unchanged files free.
//
// Persistence is the injected { get, set, delete } store (reducer/store.mjs: memoryStore in tests, idbStore
// on device) holding the object map and refs as they are. No persist(): a pile kept only here is as durable
// as the browser lets it be, and the press says so rather than implying a vault (vault/ is the vault).

import { repo as newRepo } from "../git-enough/repo.mjs";
import { filesAt, parseCommit } from "../git-enough/read.mjs";
import { isLabel } from "./hosts.mjs";

const KEY = (id) => "anecdote.press.pile/v1:" + id;
const REF = "refs/heads/main";

export async function openPile(store, id) {
  if (!isLabel(id)) throw new Error("pile: the name must be a DNS-legal label — it is also the pile's address");
  const r = newRepo();
  const saved = await store.get(KEY(id));
  if (saved) {
    for (const [oid, o] of saved.objects) r.objects.set(oid, o);
    for (const [name, oid] of saved.refs) r.refs.set(name, oid);
  }
  const save = () => store.set(KEY(id), { objects: [...r.objects], refs: [...r.refs] });

  const files = () => { const tip = r.readRef(REF); return tip ? filesAt(r.objects, tip) : []; };

  // Print: add `sheets` ([{ path, content }]) on top of what the pile already holds, as one commit.
  async function strike(sheets, { author, message }) {
    const carried = files().filter((f) => !sheets.some((s) => s.path === f.path))
      .map((f) => ({ path: f.path, content: r.objects.get(f.oid).content }));
    const oid = await r.commitFiles([...carried, ...sheets], { author, message, ref: REF });
    await save();
    return oid;
  }

  function history(limit = 50) {
    const out = [];
    let oid = r.readRef(REF);
    while (oid && out.length < limit) {
      const o = r.objects.get(oid); if (!o || o.type !== "commit") break;
      const c = parseCommit(o.content);
      out.push({ oid, message: c.message.trim(), author: c.author });
      oid = c.parents[0];
    }
    return out;
  }

  // The pile read as a bottle would be: path -> text | null. This is what makes a pile openable by the same
  // face resolver that opens a neighbour over HTTP — one reader, whatever the bytes came from.
  const td = new TextDecoder();
  async function fetchText(path) {
    const f = files().find((x) => x.path === path);
    return f ? td.decode(r.objects.get(f.oid).content) : null;
  }

  return { id, repo: r, strike, files, history, fetchText, tip: () => r.readRef(REF) };
}

export async function dropPile(store, id) { await store.delete(KEY(id)); }
