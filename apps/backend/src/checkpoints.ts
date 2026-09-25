import {
  Context,
  DateTime,
  Effect,
  Layer,
  Option,
  Predicate,
  Schema,
  Stream,
} from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import { createHash } from "node:crypto";
import {
  ExperimentNotFound,
  RunExperimentMismatch,
  TooManyCheckpoints,
} from "./api.js";
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

// Dedupe key for checkpoint retries. Volatile values (timing entries and
// checkpoint timestamps change on every traversal attempt) are stripped to
// their key sets; data and everything else is kept. A retry then hashes
// identically to the original, while a genuine repeat visit differs in
// collected data or in which screens/checkpoints have been recorded.
const deepSort = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(deepSort);
  if (Predicate.isObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, deepSort(value[key])]),
    );
  }
  return value;
};

const normalizedContextJson = (context: unknown): string => {
  if (!Predicate.isObject(context)) return JSON.stringify(context);
  const { checkpoints, timings, ...rest } = context;
  return JSON.stringify(
    deepSort({
      ...rest,
      checkpoints: Predicate.isObject(checkpoints)
        ? Object.keys(checkpoints)
        : checkpoints,
      timings: Predicate.isObject(timings) ? Object.keys(timings) : timings,
    }),
  );
};

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

  const runExperiment = SqlSchema.findOneOption({
    Request: Schema.Struct({ runId: Schema.String }),
    Result: Schema.Struct({ experiment: Schema.String }),
    execute: ({ runId }) => sql`
      SELECT experiment FROM runs WHERE run_id = ${runId}
    `,
  });

  const record = Effect.fn("Checkpoints.record")(
    function* (input: RecordCheckpointInput) {
      const receivedAt = DateTime.formatIso(yield* DateTime.now);
      const contextJson = yield* Effect.sync(() =>
        JSON.stringify(input.context),
      );
      const contextHash = createHash("sha256")
        .update(normalizedContextJson(input.context))
        .digest("hex");

      // A runId belongs to one experiment. Reject checkpoint writes that try
      // to reuse a run under a different slug rather than silently mixing
      // them into another experiment's export.
      const registered = yield* runExperiment({ runId: input.runId });
      if (Option.isSome(registered)) {
        if (registered.value.experiment !== input.experiment) {
          return yield* new RunExperimentMismatch({
            runId: input.runId,
            experiment: input.experiment,
          });
        }
      } else {
        yield* sql`
          INSERT OR IGNORE INTO runs (run_id, experiment, first_seen_at)
          VALUES (${input.runId}, ${input.experiment}, ${receivedAt})
        `;
      }

      const { n } = yield* countForRun({ runId: input.runId });
      if (n >= MAX_CHECKPOINTS_PER_RUN) {
        return yield* new TooManyCheckpoints({ runId: input.runId });
      }

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
    ) => Effect.Effect<void, TooManyCheckpoints | RunExperimentMismatch>;
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
