import { Config, Context, Effect, Layer, Option, Redacted } from "effect";

// Secrets are required in production; in development an unset value gets a
// random per-boot secret — never a fixed, guessable default. Empty strings
// count as unset.
const secret = (name: string, nodeEnv: string) =>
  Config.Redacted(name).pipe(
    Config.option,
    Effect.map(Option.filter((t) => Redacted.value(t).length > 0)),
    Effect.flatMap((token) => {
      if (Option.isSome(token)) return Effect.succeed(token.value);
      if (nodeEnv === "production") {
        return Effect.fail(new Error(`${name} must be set in production`));
      }
      return Effect.logWarning(
        `${name} unset — generated an ephemeral value for this boot`,
      ).pipe(Effect.as(Redacted.make(`dev-${crypto.randomUUID()}`)));
    }),
  );

export class BackendConfig extends Context.Service<
  BackendConfig,
  {
    port: number;
    host: string;
    dbPath: string;
    exportToken: Redacted.Redacted<string>;
    runTokenSecret: Redacted.Redacted<string>;
    allowedExperiments: Option.Option<ReadonlySet<string>>;
    nodeEnv: string;
  }
>()("backend/BackendConfig") {
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const nodeEnv = yield* Config.String("NODE_ENV").pipe(
        Config.withDefault("development"),
      );
      const port = yield* Config.Int("PORT").pipe(Config.withDefault(3000));
      // Loopback by default so a dev server is never reachable off-machine
      // (it has no edge rate limits); the container sets HOST=0.0.0.0 and
      // sits behind nginx.
      const host = yield* Config.String("HOST").pipe(
        Config.withDefault("127.0.0.1"),
      );
      const dbPath = yield* Config.String("DB_PATH").pipe(
        Config.withDefault("./data/experiment-hub.sqlite"),
      );
      const exportToken = yield* secret("EXPORT_TOKEN", nodeEnv);
      const runTokenSecret = yield* secret("RUN_TOKEN_SECRET", nodeEnv);
      const allowedExperiments = yield* Config.String(
        "ALLOWED_EXPERIMENTS",
      ).pipe(
        Config.option,
        Effect.map(
          Option.flatMap((raw) => {
            const slugs = raw
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            return slugs.length > 0
              ? Option.some<ReadonlySet<string>>(new Set(slugs))
              : Option.none();
          }),
        ),
      );

      return Layer.succeed(BackendConfig, {
        port,
        host,
        dbPath,
        exportToken,
        runTokenSecret,
        allowedExperiments,
        nodeEnv,
      });
    }),
  );
}
