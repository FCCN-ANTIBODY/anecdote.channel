// git-enough/shim-os.mjs — the node:os alias target: a virtual tmp root (scratch lives in the tree too).
export const tmpdir = () => "/tmp";
export default { tmpdir };
