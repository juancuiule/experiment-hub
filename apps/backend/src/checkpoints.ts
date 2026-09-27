import {
  Context,
  DateTime,
  Effect,
  Layer,
  Option,
  Redacted,
  Schema,
  Stream,
} from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  CheckpointTooLarge,
  ExperimentNotFound,
  InvalidRunToken,
  TooManyCheckpoints,
  UnknownExperiment,
} from "./api.js";
import { BackendConfig } from "./config.js";
import { SqlLive } from "./db.js";

export type RecordCheckpointInput = {
  runId: string;
  token: string;
  experiment: string;
  checkpoint: string;
  seq: number;
  context: unknown;
  at: string;
};

const MAX_CHECKPOINTS_PER_RUN = 500;
const EXPORT_BATCH_SIZE = 500;
// nginx caps /api/runs/* bodies at 1m (1,048,576 bytes). The body carries the
// context plus bounded metadata (slug <=100, checkpoint <=200, at <=64, seq,
// JSON framing), so the context cap sits 48 KiB below that — every context
// the app accepts also fits through the proxy. It also bounds writes when the
// edge isn't in front (direct dev access).
const MAX_CONTEXT_BYTES = 1_000_000;

const RowSchema = Schema.Struct({
  id: Schema.Int,
  runId: Schema.String,
  experiment: Schema.String,
  checkpoint: Schema.String,
  seq: Schema.NullOr(Schema.Int),
  at: Schema.String,
  receivedAt: Schema.String,
  context: Schema.String,
});
type Row = typeof RowSchema.Type;

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const config = yield* BackendConfig;
  const secret = Redacted.value(config.runTokenSecret);

  const sign = (runId: string, experiment: string) =>
    createHmac("sha256", secret)
      .update(`${runId}\n${experiment}`)
      .digest("base64url");

  const tokenMatches = (runId: string, experiment: string, token: string) => {
    const expected = Buffer.from(sign(runId, experiment));
    const provided = Buffer.from(token);
    return (
      provided.length === expected.length && timingSafeEqual(provided, expected)
    );
  };

  const countForRun = SqlSchema.findOne({
    Request: Schema.Struct({ runId: Schema.String }),
    Result: Schema.Struct({ n: Schema.Int }),
    execute: ({ runId }) => sql`
      SELECT COUNT(*) AS n FROM checkpoints WHERE run_id = ${runId}
    `,
  });

  const visitExists = SqlSchema.findOneOption({
    Request: Schema.Struct({ runId: Schema.String, seq: Schema.Int }),
    Result: Schema.Struct({ id: Schema.Int }),
    execute: ({ runId, seq }) => sql`
      SELECT id FROM checkpoints WHERE run_id = ${runId} AND seq = ${seq}
    `,
  });

  const batchAfter = SqlSchema.findAll({
    Request: Schema.Struct({ slug: Schema.String, cursor: Schema.Int }),
    Result: RowSchema,
    execute: ({ slug, cursor }) => sql`
      SELECT id, run_id AS runId, experiment, checkpoint, seq, at,
             received_at AS receivedAt, context
      FROM checkpoints
      WHERE experiment = ${slug} AND id > ${cursor}
      ORDER BY id
      LIMIT ${EXPORT_BATCH_SIZE}
    `,
  });

  const createRun = Effect.fn("Checkpoints.createRun")(
    function* (experiment: string) {
      if (
        Option.isSome(config.allowedExperiments) &&
        !config.allowedExperiments.value.has(experiment)
      ) {
        return yield* new UnknownExperiment({ experiment });
      }
      const runId = randomUUID();
      const firstSeenAt = DateTime.formatIso(yield* DateTime.now);
      yield* sql`
        INSERT INTO runs (run_id, experiment, first_seen_at)
        VALUES (${runId}, ${experiment}, ${firstSeenAt})
      `;
      return { runId, token: sign(runId, experiment) };
    },
    Effect.catchTag("SqlError", Effect.die),
  );

  const record = Effect.fn("Checkpoints.record")(
    function* (input: RecordCheckpointInput) {
      // The token binds the run to the experiment it was issued for, so a
      // forged run id or a slug swap both fail here.
      if (!tokenMatches(input.runId, input.experiment, input.token)) {
        return yield* new InvalidRunToken({ runId: input.runId });
      }

      const contextJson = yield* Effect.sync(() =>
        JSON.stringify(input.context),
      );
      if (Buffer.byteLength(contextJson, "utf8") > MAX_CONTEXT_BYTES) {
        return yield* new CheckpointTooLarge({ runId: input.runId });
      }

      // Dedupe before the cap: a retried visit is an idempotent no-op even
      // on a full run, so a lost response never strands the participant.
      const existing = yield* visitExists({
        runId: input.runId,
        seq: input.seq,
      });
      if (Option.isSome(existing)) return;

      const { n } = yield* countForRun({ runId: input.runId });
      if (n >= MAX_CHECKPOINTS_PER_RUN) {
        return yield* new TooManyCheckpoints({ runId: input.runId });
      }

      const receivedAt = DateTime.formatIso(yield* DateTime.now);
      yield* sql`
        INSERT OR IGNORE INTO checkpoints
          (run_id, experiment, checkpoint, seq, at, received_at, context)
        VALUES (${input.runId}, ${input.experiment}, ${input.checkpoint}, ${input.seq}, ${input.at}, ${receivedAt}, ${contextJson})
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
          (rows): [ReadonlyArray<Row>, Option.Option<number>] => [
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
              seq: row.seq,
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

  return Checkpoints.of({ createRun, record, exportByExperiment });
});

export class Checkpoints extends Context.Service<
  Checkpoints,
  {
    createRun: (
      experiment: string,
    ) => Effect.Effect<{ runId: string; token: string }, UnknownExperiment>;
    record: (
      input: RecordCheckpointInput,
    ) => Effect.Effect<
      void,
      TooManyCheckpoints | InvalidRunToken | CheckpointTooLarge
    >;
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
