// scripts/constellation.test.mjs — run the registrar tool's selftest under the house runner, so
// it fails the suite rather than only when someone remembers to pass --selftest.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
execFileSync("node", [join(here, "constellation.mjs"), "--selftest"], { stdio: "inherit" });
