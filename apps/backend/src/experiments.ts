import { validateExperiment } from "@experiment-hub/engine/experiment-validation";
import type { ExperimentFlow } from "@experiment-hub/engine/types";
import {
  Context,
  DateTime,
  Effect,
  Exit,
  Layer,
  Option,
  Schema,
} from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import { createHash } from "node:crypto";
import { ExperimentNotFound, InvalidExperiment } from "./api.js";
import { SqlLive } from "./db.js";

// Configs are research artifacts — a generous ceiling, not a tight fit.
// nginx caps /api/ bodies at 5m, so anything larger never reaches us anyway.
const MAX_CONFIG_BYTES = 4_500_000;

// Deterministic serialization: object keys are sorted recursively so two
// submissions of the same config hash identically regardless of authoring
// key order or whitespace. Array order is semantic, so it's preserved.
// Depth is bounded — this walk runs before validateExperiment, so it is the
// resource bound for adversarial nesting, not just canonicalization.
export const MAX_CONFIG_DEPTH = 128;
export class ConfigTooDeep extends Error {
  readonly _tag = "ConfigTooDeep";
}

export const canonicalize = (value: unknown, depth = 0): string => {
  if (depth > MAX_CONFIG_DEPTH) throw new ConfigTooDeep();
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v, depth + 1)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key], depth + 1)}`,
      );
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
};

// Minimal structural gate before the deep validator: the semantic checks
// assume nodes/edges/screens are arrays, so junk shapes get a clean 400
// instead of a validator crash. Full shape fidelity lives in the render
// path's validateExperiment, which runs again here.
const ConfigShape = Schema.Struct({
  nodes: Schema.Array(Schema.Unknown),
  edges: Schema.Array(Schema.Unknown),
  screens: Schema.Array(Schema.Unknown),
});

const issue = (code: string, message: string) => ({
  code,
  category: "node",
  message,
});

export class Experiments extends Context.Service<
  Experiments,
  {
    publish: (
      slug: string,
      config: unknown,
    ) => Effect.Effect<
      { slug: string; version: string; warnings: ReadonlyArray<ConfigIssue> },
      InvalidExperiment
    >;
    getBySlug: (
      slug: string,
    ) => Effect.Effect<
      { slug: string; version: string; config: unknown },
      ExperimentNotFound
    >;
    list: () => Effect.Effect<
      ReadonlyArray<{ slug: string; version: string }>
    >;
    // The row a new run pins: which immutable config this slug currently
    // serves. None means the slug is unregistered.
    configForSlug: (
      slug: string,
    ) => Effect.Effect<Option.Option<{ hash: string }>>;
    // Was this exact content ever published under this slug? Runs pin a
    // historical version as happily as the current one — a participant's
    // already-loaded page must keep registering runs after a republish.
    hasVersion: (
      slug: string,
      hash: string,
    ) => Effect.Effect<boolean>;
    // Backfill semantics for boot-time seeding: fill the registry where it's
    // empty, never move a pointer a researcher already set.
    publishIfMissing: (
      slug: string,
      config: unknown,
    ) => Effect.Effect<
      { slug: string; version: string; created: boolean },
      InvalidExperiment
    >;
  }
>()("backend/Experiments") {
  static readonly layerNoDeps = Layer.effect(
    Experiments,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const findCurrent = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: Schema.Struct({
          hash: Schema.String,
          config: Schema.String,
        }),
        execute: (slug) => sql`
          SELECT c.hash, c.config
          FROM experiments e
          JOIN experiment_configs c ON c.hash = e.config_hash
          WHERE e.slug = ${slug}
        `,
      });

      const listAll = SqlSchema.findAll({
        Request: Schema.Void,
        Result: Schema.Struct({
          slug: Schema.String,
          version: Schema.String,
        }),
        execute: () => sql`
          SELECT slug, config_hash AS version
          FROM experiments
          ORDER BY slug
        `,
      });

      const list = () =>
        listAll(undefined).pipe(
          Effect.catchTags({ SqlError: Effect.die, SchemaError: Effect.die }),
        );

      const configForSlug = (slug: string) =>
        findCurrent(slug).pipe(
          Effect.map(Option.map(({ hash }) => ({ hash }))),
          Effect.catchTags({ SqlError: Effect.die, SchemaError: Effect.die }),
        );

      const hasVersion = (slug: string, hash: string) =>
        SqlSchema.findOneOption({
          Request: Schema.Struct({ slug: Schema.String, hash: Schema.String }),
          Result: Schema.Struct({ hash: Schema.String }),
          execute: ({ slug, hash }) => sql`
            SELECT hash FROM experiment_configs
            WHERE slug = ${slug} AND hash = ${hash}
          `,
        })({ slug, hash }).pipe(
          Effect.map(Option.isSome),
          Effect.catchTags({ SqlError: Effect.die, SchemaError: Effect.die }),
        );

      const getBySlug = Effect.fn("Experiments.getBySlug")(
        function* (slug: string) {
          const found = yield* findCurrent(slug);
          if (Option.isNone(found)) {
            return yield* new ExperimentNotFound({ slug });
          }
          const config = yield* Effect.sync(() =>
            JSON.parse(found.value.config),
          );
          return { slug, version: found.value.hash, config };
        },
        Effect.catchTags({ SqlError: Effect.die, SchemaError: Effect.die }),
      );

      const publish = Effect.fn("Experiments.publish")(
        function* (slug: string, config: unknown) {
          const shapeResult = Schema.decodeUnknownExit(ConfigShape)(config);
          if (Exit.isFailure(shapeResult)) {
            return yield* new InvalidExperiment({
              slug,
              errors: [
                issue(
                  "INVALID_SHAPE",
                  "config must be an object with nodes, edges and screens arrays",
                ),
              ],
            });
          }
          // Resource bounds come first: canonicalize walks the whole input
          // recursively, so the depth cap and byte cap run before the
          // validator's own traversal of untrusted nested JSON. The store
          // keeps the ORIGINAL value either way — the Struct decode above
          // drops sibling keys (options, messages, dictionary) that
          // validateExperiment needs and researchers authored.
          const canonical = yield* Effect.try({
            try: () => canonicalize(config),
            catch: (e) =>
              new InvalidExperiment({
                slug,
                errors: [
                  issue(
                    e instanceof ConfigTooDeep
                      ? "CONFIG_TOO_DEEP"
                      : "CONFIG_NOT_SERIALIZABLE",
                    `config could not be serialized: ${e}`,
                  ),
                ],
              }),
          });
          if (Buffer.byteLength(canonical, "utf8") > MAX_CONFIG_BYTES) {
            return yield* new InvalidExperiment({
              slug,
              errors: [issue("CONFIG_TOO_LARGE", "config exceeds the size cap")],
            });
          }

          const errors = yield* Effect.try({
            try: () => validateExperiment(config as ExperimentFlow),
            catch: (e) =>
              new InvalidExperiment({
                slug,
                errors: [issue("VALIDATOR_CRASH", String(e))],
              }),
          });
          const hard = errors.filter((e) => e.severity !== "warning");
          if (hard.length > 0) {
            return yield* new InvalidExperiment({
              slug,
              errors: hard.map(toIssue),
            });
          }
          const hash = createHash("sha256").update(canonical).digest("hex");
          const now = DateTime.formatIso(yield* DateTime.now);

          // Config rows are content-addressed and immutable: republishing
          // identical content is a no-op (same hash), and a change creates a
          // new row while the slug pointer moves. Runs pin the hash they
          // started under, so in-flight data never retroactively re-binds.
          yield* sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`
                INSERT OR IGNORE INTO experiment_configs (hash, slug, config, created_at)
                VALUES (${hash}, ${slug}, ${canonical}, ${now})
              `;
              yield* sql`
                INSERT INTO experiments (slug, config_hash, updated_at)
                VALUES (${slug}, ${hash}, ${now})
                ON CONFLICT (slug) DO UPDATE SET
                  config_hash = excluded.config_hash,
                  updated_at = excluded.updated_at
              `;
            }),
          );

          return {
            slug,
            version: hash,
            warnings: errors
              .filter((e) => e.severity === "warning")
              .map(toIssue),
          };
        },
        Effect.catchTag("SqlError", Effect.die),
      );

      const publishIfMissing = Effect.fn("Experiments.publishIfMissing")(
        function* (slug: string, config: unknown) {
          const current = yield* configForSlug(slug);
          if (Option.isSome(current)) {
            return { slug, version: current.value.hash, created: false };
          }
          const published = yield* publish(slug, config);
          return { slug, version: published.version, created: true };
        },
      );

      return Experiments.of({
        publish,
        publishIfMissing,
        getBySlug,
        list,
        configForSlug,
        hasVersion,
      });
    }),
  );

  static readonly layer = Experiments.layerNoDeps.pipe(
    Layer.provide(SqlLive),
  );
}

export type ConfigIssue = {
  code: string;
  category: string;
  message: string;
};

const toIssue = (e: {
  code: string;
  category: string;
  message: string;
}): ConfigIssue => ({
  code: e.code,
  category: e.category,
  message: e.message,
});
