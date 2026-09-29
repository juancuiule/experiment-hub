import { NodeFileSystem } from "@effect/platform-node";
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node";
import { Effect, FileSystem, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";
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
    "0003_visit_seq": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      // The client-assigned visit ordinal replaces the context hash as the
      // dedupe key: hashing couldn't tell a retry from a repeat visit with
      // identical answers. Pre-existing rows keep seq NULL, which SQLite's
      // unique index treats as distinct.
      yield* sql`ALTER TABLE checkpoints ADD COLUMN seq INTEGER`;
      yield* sql`DROP INDEX idx_checkpoints_dedupe`;
      yield* sql`
        CREATE UNIQUE INDEX idx_checkpoints_visit
        ON checkpoints (run_id, seq)
      `;
    }),
    "0004_export_cursor": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      // Export pagination filters `experiment = ? AND id > ? ORDER BY id` —
      // this index serves all three clauses, where (experiment, run_id)
      // forced a sort per batch. context_hash has been dead since
      // (run_id, seq) replaced it as the dedupe key in 0003.
      yield* sql`DROP INDEX idx_checkpoints_experiment`;
      yield* sql`
        CREATE INDEX idx_checkpoints_export
        ON checkpoints (experiment, id)
      `;
      yield* sql`ALTER TABLE checkpoints DROP COLUMN context_hash`;
    }),
    "0005_experiments": Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      // Experiment configs move out of the frontend bundle and into the DB.
      // Config rows are content-addressed within their slug — sha256 of
      // canonical JSON keyed (slug, hash) — and immutable: republishing
      // identical content is a no-op, a change creates a new row, and
      // `experiments` just points each slug at the current hash. Scoping
      // the key by slug matters: identical content published under two
      // slugs must register for each (runs verify hash membership under
      // the slug they're for). Runs pin the version they were issued
      // under, so republishing can never retroactively rebind in-flight
      // checkpoint data to a different config.
      yield* sql`
        CREATE TABLE IF NOT EXISTS experiment_configs (
          slug TEXT NOT NULL,
          hash TEXT NOT NULL,
          config TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (slug, hash)
        )
      `;
      yield* sql`
        CREATE TABLE IF NOT EXISTS experiments (
          slug TEXT PRIMARY KEY,
          config_hash TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (slug, config_hash)
            REFERENCES experiment_configs (slug, hash)
        )
      `;
      // Nullable for pre-existing runs, same precedent as checkpoints.seq.
      // No FK here — composite references can't be expressed on ALTER ADD
      // COLUMN; createRun validates membership before inserting anyway.
      yield* sql`
        ALTER TABLE runs ADD COLUMN config_hash TEXT
      `;
    }),
  }),
});

export const makeSqlLive = (filename: string) =>
  MigratorLive.pipe(
    Layer.provideMerge(
      Layer.unwrap(
        Effect.gen(function* () {
          // ":memory:" needs no directory — skip the fs touch entirely.
          const dir = dirname(filename);
          if (dir !== ".") {
            const fs = yield* FileSystem.FileSystem;
            yield* fs.makeDirectory(dir, { recursive: true });
          }
          return SqliteClient.layer({ filename });
        }),
      ).pipe(Layer.provide(NodeFileSystem.layer)),
    ),
  );

export const SqlLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* BackendConfig;
    return makeSqlLive(config.dbPath);
  }),
);
