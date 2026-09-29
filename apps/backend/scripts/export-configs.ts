// Writes each authored experiment to configs/<slug>.json in canonical form —
// the artifacts the runtime image backfills from via SEED_CONFIGS_DIR.
// Regenerate after editing authored configs: pnpm --filter
// @experiment-hub/backend export:configs (configs-sync.test.ts fails on
// drift). The e2e fixture is excluded — prod doesn't serve it.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalize } from "../src/experiments.js";

// Same CJS interop note as seed.ts — createRequire reaches module.exports.
const require = createRequire(import.meta.url);
const { EXPERIMENTS } = require(
  "../../frontend/src/data/experiments/index.ts",
) as typeof import("../../frontend/src/data/experiments/index.js");

const outDir = new URL("../configs/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

for (const [slug, config] of Object.entries(EXPERIMENTS)) {
  writeFileSync(join(outDir, `${slug}.json`), canonicalize(config));
  console.log(`exported ${slug}.json`);
}
