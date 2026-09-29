import { Effect, FileSystem } from "effect";
import { Experiments } from "./experiments.js";

// Fills the experiment registry from a directory of <slug>.json canonical
// configs — the image ships them under SEED_CONFIGS_DIR so an upgraded
// deployment serves its authored experiments without a manual publish.
// publishIfMissing only registers absent slugs: a config a researcher
// published post-upgrade is never overwritten by the backfill.
export const backfillConfigs = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const experiments = yield* Experiments;
    const files = yield* fs.readDirectory(dir);
    yield* Effect.forEach(
      files.filter((f) => f.endsWith(".json")),
      (file) =>
        Effect.gen(function* () {
          const slug = file.slice(0, -".json".length);
          const text = yield* fs.readFileString(`${dir}/${file}`);
          const config = yield* Effect.sync(() => JSON.parse(text));
          const res = yield* experiments.publishIfMissing(slug, config);
          yield* Effect.logInfo(
            res.created
              ? `backfilled experiment "${slug}" (${res.version.slice(0, 12)})`
              : `experiment "${slug}" already registered — kept published version`,
          );
        }),
      { discard: true },
    );
  });
