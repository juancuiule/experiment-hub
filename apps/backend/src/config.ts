import { Config, Context, Effect, Layer, Option, Redacted } from "effect";

export class BackendConfig extends Context.Service<
  BackendConfig,
  {
    port: number;
    dbPath: string;
    exportToken: Redacted.Redacted<string>;
    nodeEnv: string;
  }
>()("backend/BackendConfig") {
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const nodeEnv = yield* Config.String("NODE_ENV").pipe(
        Config.withDefault("development"),
      );
      const port = yield* Config.Int("PORT").pipe(Config.withDefault(3000));
      const dbPath = yield* Config.String("DB_PATH").pipe(
        Config.withDefault("./data/experiment-hub.sqlite"),
      );
      const exportToken = yield* Config.Redacted("EXPORT_TOKEN").pipe(
        Config.option,
        Effect.flatMap((token) => {
          if (Option.isSome(token)) return Effect.succeed(token.value);
          if (nodeEnv === "production") {
            return Effect.fail(
              new Error(
                "EXPORT_TOKEN must be set in production (used to gate the export endpoint)",
              ),
            );
          }
          // No fixed dev credential: an unset token in a reachable
          // dev-mode deployment would otherwise open every export.
          return Effect.logWarning(
            "EXPORT_TOKEN unset — generated an ephemeral token for this boot",
          ).pipe(
            Effect.as(Redacted.make(`dev-${crypto.randomUUID()}`)),
          );
        }),
      );

      return Layer.succeed(BackendConfig, {
        port,
        dbPath,
        exportToken,
        nodeEnv,
      });
    }),
  );
}
