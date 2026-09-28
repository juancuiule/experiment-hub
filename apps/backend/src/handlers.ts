import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
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
            runId: params.runId,
            token: headers["x-run-token"],
            experiment: payload.experiment,
            checkpoint: payload.checkpoint,
            seq: payload.seq,
            context: payload.context,
            at: payload.at,
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
    return handlers.handleAll({
      health: () => Effect.succeed({ status: "ok" as const }),
    });
  }),
);
