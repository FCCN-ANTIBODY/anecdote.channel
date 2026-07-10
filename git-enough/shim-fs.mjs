// git-enough/shim-fs.mjs — the node:fs alias target for a bundled action (actions-enough phase 2). State
// lives in a GLOBAL so the runner and the bundled copy share ONE virtual tree regardless of module
// identity; useActionFs(fs) binds it. Only the sync surface bin/*.mjs use; async/promises is a named gap.
export function useActionFs(fs) { globalThis.__ACTION_FS__ = fs; }
const cur = () => { const f = globalThis.__ACTION_FS__; if (!f) throw new Error("actions-enough: no fs bound (useActionFs)"); return f; };
export const readFileSync = (...a) => cur().readFileSync(...a);
export const writeFileSync = (...a) => cur().writeFileSync(...a);
export const existsSync = (...a) => cur().existsSync(...a);
export const mkdirSync = (...a) => cur().mkdirSync(...a);
export const readdirSync = (...a) => cur().readdirSync(...a);
export const statSync = (...a) => cur().statSync(...a);
export const rmSync = (...a) => cur().rmSync(...a);
export default { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync };
