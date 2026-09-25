import {
  Context,
  DateTime,
  Effect,
  Layer,
  Option,
  Schema,
  Stream,
} from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import { createHash } from "node:crypto";
import { ExperimentNotFound, TooManyCheckpoints } from "./api.js";
import { BackendConfig } from "./config.js";
import { SqlLive } from "./db.js";

export type RecordCheckpointInput = {
  runId: string;
  experiment: string;
  checkpoint: string;
  context: unknown;
  at: string;
};

const MAX_CHECKPOINTS_PER_RUN = 500;
const EXPORT_BATCH_SIZE = 500;

const RowSchema = Schema.Struct({
  id: Schema.Int,
  runId: Schema.String,
  experiment: Schema.String,
  checkpoint: Schema.String,
  at: Schema.String,
  receivedAt: Schema.String,
  context: Schema.String,
});
type Row = typeof RowSchema.Type;

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const countForRun = SqlSchema.findOne({
    Request: Schema.Struct({ runId: Schema.String }),
    Result: Schema.Struct({ n: Schema.Int }),
    execute: ({ runId }) => sql`
      SELECT COUNT(*) AS n FROM checkpoints WHERE run_id = ${runId}
    `,
  });

  const batchAfter = SqlSchema.findAll({
    Request: Schema.Struct({ slug: Schema.String, cursor: Schema.Int }),
    Result: RowSchema,
    execute: ({ slug, cursor }) => sql`
      SELECT id, run_id AS runId, experiment, checkpoint, at,
             received_at AS receivedAt, context
      FROM checkpoints
      WHERE experiment = ${slug} AND id > ${cursor}
      ORDER BY id
      LIMIT ${EXPORT_BATCH_SIZE}
    `,
  });

  const record = Effect.fn("Checkpoints.record")(
    function* (input: RecordCheckpointInput) {
      const receivedAt = DateTime.formatIso(yield* DateTime.now);
      const contextJson = yield* Effect.sync(() =>
        JSON.stringify(input.context),
      );
      const contextHash = createHash("sha256")
        .update(contextJson)
        .digest("hex");

      const { n } = yield* countForRun({ runId: input.runId });
      if (n >= MAX_CHECKPOINTS_PER_RUN) {
        return yield* new TooManyCheckpoints({ runId: input.runId });
      }

      yield* sql`
        INSERT OR IGNORE INTO runs (run_id, experiment, first_seen_at)
        VALUES (${input.runId}, ${input.experiment}, ${receivedAt})
      `;
      yield* sql`
        INSERT OR IGNORE INTO checkpoints
          (run_id, experiment, checkpoint, at, received_at, context, context_hash)
        VALUES (${input.runId}, ${input.experiment}, ${input.checkpoint}, ${input.at}, ${receivedAt}, ${contextJson}, ${contextHash})
      `;
    },
    Effect.catchTags({
      SqlError: Effect.die,
      SchemaError: Effect.die,
      NoSuchElementError: Effect.die,
    }),
  );

  const exportByExperiment = Effect.fn("Checkpoints.exportByExperiment")(
    function* (slug: string) {
      const firstBatch = yield* batchAfter({ slug, cursor: 0 });
      if (firstBatch.length === 0) {
        return yield* new ExperimentNotFound({ slug });
      }
      const encoder = new TextEncoder();
      return Stream.paginate(0, (cursor) =>
        Effect.map(
          batchAfter({ slug, cursor }),
          (
            rows,
          ): [ReadonlyArray<Row>, Option.Option<number>] => [
            rows,
            rows.length < EXPORT_BATCH_SIZE
              ? Option.none()
              : Option.some(rows[rows.length - 1]!.id),
          ],
        ),
      ).pipe(
        Stream.map((row) =>
          encoder.encode(
            JSON.stringify({
              runId: row.runId,
              experiment: row.experiment,
              checkpoint: row.checkpoint,
              at: row.at,
              receivedAt: row.receivedAt,
              context: JSON.parse(row.context),
            }) + "\n",
          ),
        ),
      );
    },
    Effect.catchTags({ SqlError: Effect.die, SchemaError: Effect.die }),
  );

  return Checkpoints.of({ record, exportByExperiment });
});

export class Checkpoints extends Context.Service<
  Checkpoints,
  {
    record: (
      input: RecordCheckpointInput,
    ) => Effect.Effect<void, TooManyCheckpoints>;
    exportByExperiment: (
      slug: string,
    ) => Effect.Effect<Stream.Stream<Uint8Array, unknown>, ExperimentNotFound>;
  }
>()("backend/Checkpoints") {
  static readonly layerNoDeps = Layer.effect(Checkpoints, make);

  static readonly layer = Checkpoints.layerNoDeps.pipe(
    Layer.provide(SqlLive),
    Layer.provide(BackendConfig.layer),
  );
}
