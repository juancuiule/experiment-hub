import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { SqlClient } from "effect/unstable/sql";
import { Api } from "./api.js";
import { Checkpoints } from "./checkpoints.js";

export const RunsHandlers = HttpApiBuilder.group(
  Api,
  "runs",
  Effect.fn(function* (handlers) {
    const checkpoints = yield* Checkpoints;
    return handlers.handleAll({
      createRun: ({ payload }) => checkpoints.createRun(payload.experiment),
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
