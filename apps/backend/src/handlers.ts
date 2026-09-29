import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { SqlClient } from "effect/unstable/sql";
import { Api } from "./api.js";
import { Checkpoints } from "./checkpoints.js";
import { Experiments } from "./experiments.js";

export const RunsHandlers = HttpApiBuilder.group(
  Api,
  "runs",
  Effect.fn(function* (handlers) {
    const checkpoints = yield* Checkpoints;
    return handlers.handleAll({
      createRun: ({ payload }) =>
        checkpoints.createRun(payload.experiment, payload.version),
      recordCheckpoint: ({ params, headers, payload }) =>
        checkpoints
          .record({
            ...payload,
            runId: params.runId,
            token: headers["x-run-token"],
          })
          .pipe(Effect.map(() => ({ ok: true as const }))),
    });
  }),
);

export const ExportHandlers = HttpApiBuilder.group(
  Api,
  "export",
  Effect.fn(function* (handlers) {
    const checkpoints = yield* Checkpoints;
    return handlers.handleAll({
      experiment: ({ params }) =>
        checkpoints.exportByExperiment(params.slug),
    });
  }),
);

export const ExperimentsHandlers = HttpApiBuilder.group(
  Api,
  "experiments",
  Effect.fn(function* (handlers) {
    const experiments = yield* Experiments;
    return handlers.handleAll({
      getExperiment: ({ params }) => experiments.getBySlug(params.slug),
      listExperiments: () =>
        experiments.list().pipe(
          Effect.map((experiments) => ({ experiments })),
        ),
    });
  }),
);

export const ExperimentsAdminHandlers = HttpApiBuilder.group(
  Api,
  "experimentsAdmin",
  Effect.fn(function* (handlers) {
    const experiments = yield* Experiments;
    return handlers.handleAll({
      publishExperiment: ({ params, payload }) =>
        experiments.publish(params.slug, payload),
    });
  }),
);

export const SystemHandlers = HttpApiBuilder.group(
  Api,
  "system",
  Effect.fn(function* (handlers) {
    // Probe the database so compose healthchecks reflect readiness, not just
    // a live router — a dead DB should fail the check and trigger a restart.
    const sql = yield* SqlClient.SqlClient;
    return handlers.handleAll({
      health: () =>
        sql`SELECT 1`.pipe(Effect.as({ status: "ok" as const }), Effect.orDie),
    });
  }),
);
