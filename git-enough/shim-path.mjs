// git-enough/shim-path.mjs — the node:path alias target: the posix path from node-compat, as default + named.
import { path } from "./node-compat.mjs";
export const { sep, join, resolve, dirname, basename, extname } = path;
export default path;
