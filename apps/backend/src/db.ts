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
