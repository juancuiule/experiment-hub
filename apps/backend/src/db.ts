import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { BackendConfig } from "./config.js";

const MigratorLive = SqliteMigrator.layer({
  loader: SqliteMigrator.fromRecord({
    "0001_init": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        CREATE TABLE IF NOT EXISTS runs (
          run_id TEXT PRIMARY KEY,
          experiment TEXT NOT NULL,
          first_seen_at TEXT NOT NULL
        )
      `;
      yield* sql`
        CREATE TABLE IF NOT EXISTS checkpoints (
          id INTEGER PRIMARY KEY,
          run_id TEXT NOT NULL REFERENCES runs(run_id),
          experiment TEXT NOT NULL,
          checkpoint TEXT NOT NULL,
          at TEXT NOT NULL,
          received_at TEXT NOT NULL,
          context TEXT NOT NULL
        )
      `;
      yield* sql`
        CREATE INDEX IF NOT EXISTS idx_checkpoints_experiment
        ON checkpoints (experiment, run_id)
      `;
    }),
    "0002_dedupe_hash": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      // Retried checkpoint POSTs carry a byte-identical context, so a hash of
      // it distinguishes retries from legitimate repeat visits (whose context
      // has grown). Existing rows get a unique placeholder so they can never
      // be mistaken for duplicates of each other.
      yield* sql`
        ALTER TABLE checkpoints ADD COLUMN context_hash TEXT NOT NULL DEFAULT ''
      `;
      yield* sql`
        UPDATE checkpoints SET context_hash = 'preexisting-' || id
        WHERE context_hash = ''
      `;
      yield* sql`
        CREATE UNIQUE INDEX idx_checkpoints_dedupe
        ON checkpoints (run_id, checkpoint, context_hash)
      `;
    }),
  }),
});

export const makeSqlLive = (filename: string) =>
  MigratorLive.pipe(
    Layer.provideMerge(
      Layer.unwrap(
        Effect.gen(function* () {
          yield* Effect.sync(() =>
            mkdirSync(dirname(filename), { recursive: true }),
          );
          return SqliteClient.layer({ filename });
        }),
      ),
    ),
  );

export const SqlLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* BackendConfig;
    return makeSqlLive(config.dbPath);
  }),
);
