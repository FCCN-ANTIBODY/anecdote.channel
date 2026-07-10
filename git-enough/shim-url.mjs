// git-enough/shim-url.mjs — the node:url alias target: just the two functions the main-guards use.
export const fileURLToPath = (u) => String(u).replace(/^file:\/\//, "");
export const pathToFileURL = (p) => ({ href: "file://" + String(p) });
export default { fileURLToPath, pathToFileURL };
