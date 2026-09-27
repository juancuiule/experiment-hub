import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option, Redacted, Stream } from "effect";
import { HttpClientRequest, HttpServer } from "effect/unstable/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/unstable/httpapi";
import { Api, ExportToken } from "./api.js";
import { ExportTokenLive } from "./auth.js";
import { Checkpoints } from "./checkpoints.js";
import { BackendConfig } from "./config.js";
import { makeSqlLive } from "./db.js";
import { ExportHandlers, RunsHandlers, SystemHandlers } from "./handlers.js";

const testConfig = (allowed?: ReadonlyArray<string>) =>
  Layer.succeed(BackendConfig, {
    port: 0,
    host: "127.0.0.1",
    dbPath: ":memory:",
    exportToken: Redacted.make("test-token"),
    runTokenSecret: Redacted.make("test-run-secret"),
    allowedExperiments: allowed
      ? Option.some<ReadonlySet<string>>(new Set(allowed))
      : Option.none(),
    nodeEnv: "test",
  });

const handlersLive = (allowed?: ReadonlyArray<string>) =>
  Layer.mergeAll(RunsHandlers, ExportHandlers, SystemHandlers).pipe(
    Layer.provide(
      Checkpoints.layerNoDeps.pipe(Layer.provide(makeSqlLive(":memory:"))),
    ),
    Layer.provideMerge(ExportTokenLive),
    Layer.provide(testConfig(allowed)),
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
type Run = { runId: string; token: string; experiment: string };

const createRun = Effect.fnUntraced(function* (
  client: TestClient,
  experiment: string,
) {
  const run = yield* client.runs.createRun({ payload: { experiment } });
  return { ...run, experiment } satisfies Run;
});

const record = (
  client: TestClient,
  run: Run,
  seq: number,
  options: {
    checkpoint?: string;
    context?: unknown;
    experiment?: string;
    token?: string;
  } = {},
) =>
  client.runs.recordCheckpoint({
    params: { runId: run.runId },
    headers: { "x-run-token": options.token ?? run.token },
    payload: {
      experiment: options.experiment ?? run.experiment,
      checkpoint: options.checkpoint ?? "mid",
      seq,
      context: options.context ?? { data: { intro: { answer: 5 } } },
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

const lines = (ndjson: string) =>
  ndjson
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

layer(Layer.mergeAll(handlersLive(), HttpServer.layerServices))(
  "CheckpointsApi",
  (it) => {
    it.effect("records a checkpoint and exports it as NDJSON", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const run = yield* createRun(client, "ocean");

        const res = yield* record(client, run, 0);
        assert.deepStrictEqual(res, { ok: true });

        const rows = lines(yield* exportNdjson(client, "ocean"));
        assert.strictEqual(rows.length, 1);
        assert.strictEqual(rows[0].runId, run.runId);
        assert.strictEqual(rows[0].checkpoint, "mid");
        assert.strictEqual(rows[0].seq, 0);
        assert.deepStrictEqual(rows[0].context, {
          data: { intro: { answer: 5 } },
        });
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("a retry of the same visit keeps one row", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const run = yield* createRun(client, "retry");
        const context = { data: { q: { answer: 5 } } };

        yield* record(client, run, 0, { context });
        yield* record(client, run, 0, { context });

        const rows = lines(yield* exportNdjson(client, "retry"));
        assert.strictEqual(rows.length, 1);
        assert.deepStrictEqual(rows[0].context, context);
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("a retry with edited answers replaces the stored snapshot", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const run = yield* createRun(client, "edited");

        // The first POST committed but its response was lost; the
        // participant edits the form and resubmits the same visit.
        yield* record(client, run, 0, { context: { data: { q: 5 } } });
        yield* record(client, run, 0, { context: { data: { q: 7 } } });

        const rows = lines(yield* exportNdjson(client, "edited"));
        assert.strictEqual(rows.length, 1);
        assert.deepStrictEqual(rows[0].context, { data: { q: 7 } });
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("streams exports larger than one batch in order", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const run = yield* createRun(client, "paged");

        // 40 rows spans three 16-row batches, including a partial last one.
        yield* Effect.forEach(
          Array.from({ length: 40 }, (_, i) => i),
          (seq) => record(client, run, seq, { context: { data: { seq } } }),
          { discard: true },
        );

        const rows = lines(yield* exportNdjson(client, "paged"));
        assert.deepStrictEqual(
          rows.map((r) => r.seq),
          Array.from({ length: 40 }, (_, i) => i),
        );
        assert.deepStrictEqual(rows[39].context, { data: { seq: 39 } });
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("keeps repeat visits with identical answers", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const run = yield* createRun(client, "visits");
        const context = { data: { same: "answer" } };

        yield* record(client, run, 0, { context });
        yield* record(client, run, 1, { context });

        const rows = lines(yield* exportNdjson(client, "visits"));
        assert.deepStrictEqual(
          rows.map((r) => r.seq),
          [0, 1],
        );
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("rejects a checkpoint with a forged run token", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const run = yield* createRun(client, "ocean");

        const error = yield* record(client, run, 0, {
          token: "forged",
        }).pipe(Effect.flip);
        assert.strictEqual(error._tag, "InvalidRunToken");
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("rejects a checkpoint for an unregistered run id", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const run = yield* createRun(client, "ocean");

        const error = yield* record(
          client,
          { ...run, runId: "attacker-picked-id" },
          0,
        ).pipe(Effect.flip);
        assert.strictEqual(error._tag, "InvalidRunToken");
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("rejects reusing a run token under a different experiment", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const run = yield* createRun(client, "ocean");

        const error = yield* record(client, run, 0, {
          experiment: "other-study",
        }).pipe(Effect.flip);
        assert.strictEqual(error._tag, "InvalidRunToken");

        const exportError = yield* client.export
          .experiment({ params: { slug: "other-study" } })
          .pipe(Effect.flip);
        assert.strictEqual(exportError._tag, "ExperimentNotFound");
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

layer(Layer.mergeAll(handlersLive(["ocean"]), HttpServer.layerServices))(
  "CheckpointsApi with an experiment allowlist",
  (it) => {
    it.effect("refuses to issue runs for unlisted experiments", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        yield* createRun(client, "ocean");
        const error = yield* client.runs
          .createRun({ payload: { experiment: "made-up" } })
          .pipe(Effect.flip);
        assert.strictEqual(error._tag, "UnknownExperiment");
      }).pipe(Effect.provide(AuthGood)),
    );
  },
);

layer(
  Checkpoints.layerNoDeps.pipe(
    Layer.provide(makeSqlLive(":memory:")),
    Layer.provide(testConfig()),
  ),
)("Checkpoints service", (it) => {
  it.effect("refuses new visits past the per-run cap but accepts retries", () =>
    Effect.gen(function* () {
      const checkpoints = yield* Checkpoints;
      const { runId, token } = yield* checkpoints.createRun("ocean");
      const write = (seq: number) =>
        checkpoints.record({
          runId,
          token,
          experiment: "ocean",
          checkpoint: `cp-${seq}`,
          seq,
          context: { seq },
          at: "2026-09-25T12:00:00.000Z",
        });

      yield* Effect.forEach(
        Array.from({ length: 500 }, (_, i) => i),
        write,
        { discard: true },
      );
      const error = yield* write(500).pipe(Effect.flip);
      assert.strictEqual(error._tag, "TooManyCheckpoints");

      // A lost response to the 500th write must not strand the participant.
      yield* write(499);
    }),
  );

  it.effect("rejects contexts over the size cap", () =>
    Effect.gen(function* () {
      const checkpoints = yield* Checkpoints;
      const { runId, token } = yield* checkpoints.createRun("ocean");
      const error = yield* checkpoints
        .record({
          runId,
          token,
          experiment: "ocean",
          checkpoint: "big",
          seq: 0,
          context: { blob: "x".repeat(1_000_001) },
          at: "2026-09-25T12:00:00.000Z",
        })
        .pipe(Effect.flip);
      assert.strictEqual(error._tag, "CheckpointTooLarge");
    }),
  );
});
