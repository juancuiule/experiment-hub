import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";
import { HttpClientRequest, HttpServer } from "effect/unstable/http";
import { HttpApiMiddleware } from "effect/unstable/httpapi";
import { ExportToken } from "./api.js";
import { Checkpoints } from "./checkpoints.js";
import { makeSqlLive } from "./db.js";
import { Experiments } from "./experiments.js";
import {
  AuthBad,
  AuthGood,
  createRun,
  exportNdjson,
  handlersLive,
  lines,
  makeClient,
  record,
  STUB_FLOW,
  testConfig,
} from "./test-helpers.js";

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
        assert.strictEqual(rows[0].at, "2026-09-25T12:00:00.000Z");
        assert.match(
          rows[0].receivedAt,
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        );
        assert.deepStrictEqual(rows[0].context, {
          data: { intro: { answer: 5 } },
        });
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("export is scoped to the requested experiment", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const ocean = yield* createRun(client, "iso-ocean");
        const pandemic = yield* createRun(client, "iso-pandemic");

        yield* record(client, ocean, 0, { context: { data: { q: 1 } } });
        yield* record(client, ocean, 1, { context: { data: { q: 2 } } });
        yield* record(client, pandemic, 0, { context: { data: { q: 9 } } });

        // Rows for another slug must never leak into this export.
        const rows = lines(yield* exportNdjson(client, "iso-ocean"));
        assert.strictEqual(rows.length, 2);
        for (const row of rows) {
          assert.strictEqual(row.experiment, "iso-ocean");
          assert.strictEqual(row.runId, ocean.runId);
        }
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

    it.effect("rejects a checkpoint request with an empty run token", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const run = yield* createRun(client, "ocean");

        // x-run-token is BoundedString(1..200): an empty value is a decode
        // failure (400 shape), not InvalidRunToken. A truly absent header is
        // the same path but unreachable through the typed client.
        const exit = yield* record(client, run, 0, { token: "" }).pipe(
          Effect.exit,
        );
        assert.isTrue(exit._tag === "Failure");
        if (exit._tag === "Failure") {
          assert.notStrictEqual(
            (exit.cause as { _tag?: string })._tag,
            "InvalidRunToken",
          );
        }
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("rejects a seq outside the schema bounds", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const run = yield* createRun(client, "ocean");

        const exit = yield* record(client, run, 10_000).pipe(Effect.exit);
        assert.isTrue(exit._tag === "Failure");
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
          .createRun({
            payload: { experiment: "made-up", version: "0".repeat(64) },
          })
          .pipe(Effect.flip);
        assert.strictEqual(error._tag, "UnknownExperiment");
      }).pipe(Effect.provide(AuthGood)),
    );
  },
);

layer(
  Checkpoints.layerNoDeps.pipe(
    Layer.provideMerge(Experiments.layerNoDeps),
    Layer.provide(makeSqlLive(":memory:")),
    Layer.provide(testConfig()),
  ),
)("Checkpoints service", (it) => {
  it.effect("refuses new visits past the per-run cap but accepts retries", () =>
    Effect.gen(function* () {
      const experiments = yield* Experiments;
      const { version } = yield* experiments.publish("ocean", STUB_FLOW);
      const checkpoints = yield* Checkpoints;
      const { runId, token } = yield* checkpoints.createRun(
        "ocean",
        version,
      );
      const write = (seq: number) =>
        checkpoints.record({
          runId,
          token,
          experiment: "ocean",
          checkpoint: `cp-${seq}`,
          seq,
          context: { seq },
          at: DateTime.makeUnsafe("2026-09-25T12:00:00.000Z"),
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
      const experiments = yield* Experiments;
      const { version } = yield* experiments.publish("ocean", STUB_FLOW);
      const checkpoints = yield* Checkpoints;
      const { runId, token } = yield* checkpoints.createRun(
        "ocean",
        version,
      );
      const error = yield* checkpoints
        .record({
          runId,
          token,
          experiment: "ocean",
          checkpoint: "big",
          seq: 0,
          context: { blob: "x".repeat(1_000_001) },
          at: DateTime.makeUnsafe("2026-09-25T12:00:00.000Z"),
        })
        .pipe(Effect.flip);
      assert.strictEqual(error._tag, "CheckpointTooLarge");
    }),
  );
});
