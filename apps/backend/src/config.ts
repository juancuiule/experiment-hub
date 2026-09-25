import { Config, Context, Effect, Layer, Redacted } from "effect";

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
      const exportToken = yield* (
        nodeEnv === "production"
          ? Config.Redacted("EXPORT_TOKEN")
          : Config.Redacted("EXPORT_TOKEN").pipe(
              Config.withDefault(Redacted.make("dev-only-insecure-token")),
            )
      ).pipe(
        Effect.mapError(
          () =>
            new Error(
              "EXPORT_TOKEN must be set in production (used to gate the export endpoint)",
            ),
        ),
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
