import { Context, DateTime, Effect, Layer, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import { ExperimentNotFound } from "./api.js";
import { BackendConfig } from "./config.js";
import { SqlLive } from "./db.js";

export type RecordCheckpointInput = {
  runId: string;
  experiment: string;
  checkpoint: string;
  context: unknown;
  at: string;
};

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const listRows = SqlSchema.findAll({
    Request: Schema.Struct({ slug: Schema.String }),
    Result: Schema.Struct({
      runId: Schema.String,
      experiment: Schema.String,
      checkpoint: Schema.String,
      at: Schema.String,
      receivedAt: Schema.String,
      context: Schema.String,
    }),
    execute: ({ slug }) => sql`
      SELECT run_id AS runId, experiment, checkpoint, at,
             received_at AS receivedAt, context
      FROM checkpoints
      WHERE experiment = ${slug}
      ORDER BY id
    `,
  });

  const record = Effect.fn("Checkpoints.record")(
    function* (input: RecordCheckpointInput) {
      const receivedAt = DateTime.formatIso(yield* DateTime.now);
      const contextJson = yield* Effect.sync(() =>
        JSON.stringify(input.context),
      );
      yield* sql`
        INSERT OR IGNORE INTO runs (run_id, experiment, first_seen_at)
        VALUES (${input.runId}, ${input.experiment}, ${receivedAt})
      `;
      yield* sql`
        INSERT INTO checkpoints (run_id, experiment, checkpoint, at, received_at, context)
        VALUES (${input.runId}, ${input.experiment}, ${input.checkpoint}, ${input.at}, ${receivedAt}, ${contextJson})
      `;
    },
    Effect.orDie,
  );

  const exportByExperiment = Effect.fn("Checkpoints.exportByExperiment")(
    function* (slug: string) {
      const rows = yield* listRows({ slug });
      if (rows.length === 0) {
        return yield* new ExperimentNotFound({ slug });
      }
      return yield* Effect.sync(() =>
        rows
          .map((row) =>
            JSON.stringify({
              runId: row.runId,
              experiment: row.experiment,
              checkpoint: row.checkpoint,
              at: row.at,
              receivedAt: row.receivedAt,
              context: JSON.parse(row.context),
            }),
          )
          .join("\n") + "\n",
      );
    },
    Effect.catchTags({
      SqlError: Effect.die,
      SchemaError: Effect.die,
    }),
  );

  return Checkpoints.of({ record, exportByExperiment });
});

export class Checkpoints extends Context.Service<
  Checkpoints,
  {
    record: (
      input: RecordCheckpointInput,
    ) => Effect.Effect<void>;
    exportByExperiment: (
      slug: string,
    ) => Effect.Effect<string, ExperimentNotFound>;
  }
>()("backend/Checkpoints") {
  static readonly layerNoDeps = Layer.effect(Checkpoints, make);

  static readonly layer = Checkpoints.layerNoDeps.pipe(
    Layer.provide(SqlLive),
    Layer.provide(BackendConfig.layer),
  );
}
