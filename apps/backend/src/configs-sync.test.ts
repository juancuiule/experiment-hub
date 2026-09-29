import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
// The sync contract is the point: the committed canonical JSONs are what a
// production image backfills from, so they must track the authored corpus
// exactly. Regenerate with `pnpm --filter @experiment-hub/backend
// export:configs` — this test fails on drift.
import { EXPERIMENTS } from "../../frontend/src/data/experiments/index.js";
import { canonicalize } from "./experiments.js";

const configsDir = new URL("../configs/", import.meta.url).pathname;

describe("configs/ backfill artifacts", () => {
  it("cover exactly the authored corpus", () => {
    const files = readdirSync(configsDir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    expect(files).toEqual(
      Object.keys(EXPERIMENTS)
        .map((slug) => `${slug}.json`)
        .sort(),
    );
  });

  it("each file holds the canonical form of its authored config", () => {
    for (const [slug, config] of Object.entries(EXPERIMENTS)) {
      const stored = readFileSync(
        join(configsDir, `${slug}.json`),
        "utf8",
      );
      expect(stored, `configs/${slug}.json`).toBe(canonicalize(config));
    }
  });
});
