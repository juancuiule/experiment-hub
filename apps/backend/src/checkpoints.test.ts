import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Redacted } from "effect";
import { HttpClientRequest, HttpServer } from "effect/unstable/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/unstable/httpapi";
import { Api, ExportToken } from "./api.js";
import { ExportTokenLive } from "./auth.js";
import { Checkpoints } from "./checkpoints.js";
import { BackendConfig } from "./config.js";
import { makeSqlLive } from "./db.js";
import { ExportHandlers, RunsHandlers, SystemHandlers } from "./handlers.js";

const TestConfig = Layer.succeed(BackendConfig, {
  port: 0,
  dbPath: ":memory:",
  exportToken: Redacted.make("test-token"),
  nodeEnv: "test",
});

const HandlersLive = Layer.mergeAll(
  RunsHandlers,
  ExportHandlers,
  SystemHandlers,
).pipe(
  Layer.provide(
    Checkpoints.layerNoDeps.pipe(Layer.provide(makeSqlLive(":memory:"))),
  ),
  Layer.provideMerge(ExportTokenLive),
  Layer.provide(TestConfig),
);

const makeClient = HttpApiTest.groups(Api, ["runs", "export", "system"]);

const AuthGood = HttpApiMiddleware.layerClient(
  ExportToken,
  ({ next, request }) =>
    next(HttpClientRequest.bearerToken(request, "test-token")),
);

const AuthBad = HttpApiMiddleware.layerClient(
  ExportToken,
  ({ next, request }) => next(request),
);

type TestClient = Effect.Success<typeof makeClient>;

const record = (
  client: TestClient,
  runId: string,
  checkpoint: string,
  slug = "ocean",
) =>
  client.runs.recordCheckpoint({
    params: { runId },
    payload: {
      experiment: slug,
      checkpoint,
      context: { data: { intro: { answer: 5 } } },
      at: "2026-09-25T12:00:00.000Z",
    },
  });

layer(Layer.mergeAll(HandlersLive, HttpServer.layerServices))(
  "CheckpointsApi",
  (it) => {
    it.effect("records a checkpoint and exports it as NDJSON", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;

        const res = yield* record(client, "run-1", "mid");
        assert.deepStrictEqual(res, { ok: true });

        const ndjson = yield* client.export.experiment({
          params: { slug: "ocean" },
        });
        const rows = ndjson.trim().split("\n").map((l) => JSON.parse(l));
        assert.strictEqual(rows.length, 1);
        assert.strictEqual(rows[0].runId, "run-1");
        assert.strictEqual(rows[0].checkpoint, "mid");
        assert.deepStrictEqual(rows[0].context, {
          data: { intro: { answer: 5 } },
        });
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("appends repeated checkpoints for the same run", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;

        yield* record(client, "run-2", "first", "append");
        yield* record(client, "run-2", "second", "append");
        yield* record(client, "run-2", "first", "append");

        const ndjson = yield* client.export.experiment({
          params: { slug: "append" },
        });
        const rows = ndjson.trim().split("\n");
        assert.strictEqual(rows.length, 3);
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("rejects export without a bearer token", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const error = yield* client.export
          .experiment({ params: { slug: "ocean" } })
          .pipe(Effect.flip);
        assert.strictEqual(error._tag, "Unauthorized");
      }).pipe(Effect.provide(AuthBad)),
    );

    it.effect("rejects export with a wrong bearer token", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const error = yield* client.export
          .experiment({ params: { slug: "ocean" } })
          .pipe(Effect.flip);
        assert.strictEqual(error._tag, "Unauthorized");
      }).pipe(
        Effect.provide(
          HttpApiMiddleware.layerClient(ExportToken, ({ next, request }) =>
            next(HttpClientRequest.bearerToken(request, "wrong-token")),
          ),
        ),
      ),
    );

    it.effect("returns 404 for an experiment with no data", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const error = yield* client.export
          .experiment({ params: { slug: "nonexistent" } })
          .pipe(Effect.flip);
        assert.strictEqual(error._tag, "ExperimentNotFound");
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("answers health", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const res = yield* client.system.health();
        assert.deepStrictEqual(res, { status: "ok" });
      }).pipe(Effect.provide(AuthGood)),
    );
  },
);
