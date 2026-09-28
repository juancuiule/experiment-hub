// Seeds the experiments DB from the repo's authored configs — the same
// publish path the PUT endpoint uses, minus HTTP and auth (a dev DB may
// have an ephemeral token the script can't know). Authors keep writing
// typed TS literals under apps/frontend; this crosses the package boundary
// deliberately, by relative path, so seeding exercises exactly what gets
// deployed. Run: pnpm --filter @experiment-hub/backend seed
import { Cause, Effect, Exit, Layer } from "effect";
import { createRequire } from "node:module";
import { makeSqlLive } from "../src/db.js";
import { Experiments } from "../src/experiments.js";

// The frontend package is CJS-contexted (no "type": "module"), so tsx
// serves these as CJS modules — ESM namespace bindings come back unbound
// for them. createRequire reaches module.exports directly.
const require = createRequire(import.meta.url);
const { EXPERIMENTS } = require(
  "../../frontend/src/data/experiments/index.ts",
) as typeof import("../../frontend/src/data/experiments/index.js");
const { testExperiment } = require(
  "../../frontend/e2e/test-experiment.ts",
) as typeof import("../../frontend/e2e/test-experiment.js");

const dbPath = process.env.DB_PATH ?? "./data/experiment-hub.sqlite";
const layer = Experiments.layerNoDeps.pipe(Layer.provide(makeSqlLive(dbPath)));

const program = Effect.gen(function* () {
  const experiments = yield* Experiments;
  const entries = Object.entries({ ...EXPERIMENTS, e2e: testExperiment });
  yield* Effect.forEach(
    entries,
    ([slug, config]) =>
      experiments.publish(slug, config).pipe(
        Effect.tap(({ version, warnings }) =>
          Effect.sync(() =>
            console.log(
              `${slug} -> ${version.slice(0, 12)}` +
                (warnings.length > 0 ? ` (${warnings.length} warnings)` : ""),
            ),
          ),
        ),
        Effect.tapErrorTag("InvalidExperiment", (e) =>
          Effect.sync(() =>
            console.error(
              `${slug} REJECTED: ${e.errors
                .map((i) => `${i.code} ${i.message}`)
                .join("; ")}`,
            ),
          ),
        ),
      ),
    { discard: true },
  );
});

const exit = await Effect.runPromiseExit(
  Effect.scoped(Effect.provide(program, layer)),
);
if (Exit.isFailure(exit)) {
  console.error(Cause.pretty(exit.cause));
  process.exit(1);
}
console.log(`seeded ${Object.keys(EXPERIMENTS).length + 1} experiments`);
