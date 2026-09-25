import { assert, it, layer } from "@effect/vitest";
import { Effect, Layer, Redacted, Stream } from "effect";
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
  context: unknown = { data: { intro: { answer: 5 } } },
) =>
  client.runs.recordCheckpoint({
    params: { runId },
    payload: {
      experiment: slug,
      checkpoint,
      context,
      at: "2026-09-25T12:00:00.000Z",
    },
  });

const exportNdjson = Effect.fnUntraced(function* (
  client: TestClient,
  slug: string,
) {
  const stream = yield* client.export.experiment({ params: { slug } });
  return yield* stream.pipe(Stream.decodeText(), Stream.mkString);
});

layer(Layer.mergeAll(HandlersLive, HttpServer.layerServices))(
  "CheckpointsApi",
  (it) => {
    it.effect("records a checkpoint and exports it as NDJSON", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;

        const res = yield* record(client, "run-1", "mid");
        assert.deepStrictEqual(res, { ok: true });

        const ndjson = yield* exportNdjson(client, "ocean");
        const rows = ndjson.trim().split("\n").map((l) => JSON.parse(l));
        assert.strictEqual(rows.length, 1);
        assert.strictEqual(rows[0].runId, "run-1");
        assert.strictEqual(rows[0].checkpoint, "mid");
        assert.deepStrictEqual(rows[0].context, {
          data: { intro: { answer: 5 } },
        });
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("dedupes retrying an identical checkpoint POST", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;

        yield* record(client, "run-2", "mid", "retry");
        yield* record(client, "run-2", "mid", "retry");

        const ndjson = yield* exportNdjson(client, "retry");
        assert.strictEqual(ndjson.trim().split("\n").length, 1);
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("keeps repeat visits whose context has grown", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;

        yield* record(client, "run-3", "mid", "visits", { round: 1 });
        yield* record(client, "run-3", "mid", "visits", { round: 2 });

        const ndjson = yield* exportNdjson(client, "visits");
        assert.strictEqual(ndjson.trim().split("\n").length, 2);
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

layer(Checkpoints.layerNoDeps.pipe(Layer.provide(makeSqlLive(":memory:"))))(
  "Checkpoints service",
  (it) => {
    it.effect("refuses checkpoints past the per-run cap", () =>
      Effect.gen(function* () {
        const checkpoints = yield* Checkpoints;
        yield* Effect.forEach(
          Array.from({ length: 500 }, (_, i) => i),
          (i) =>
            checkpoints.record({
              runId: "big-run",
              experiment: "ocean",
              checkpoint: `cp-${i}`,
              context: { i },
              at: "2026-09-25T12:00:00.000Z",
            }),
          { discard: true },
        );
        const error = yield* checkpoints
          .record({
            runId: "big-run",
            experiment: "ocean",
            checkpoint: "cp-501",
            context: { i: 501 },
            at: "2026-09-25T12:00:01.000Z",
          })
          .pipe(Effect.flip);
        assert.strictEqual(error._tag, "TooManyCheckpoints");
      }),
    );
  },
);
