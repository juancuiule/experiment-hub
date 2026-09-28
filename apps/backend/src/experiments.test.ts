import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";
import { HttpServer } from "effect/unstable/http";
import { Experiments } from "./experiments.js";
import {
  AuthBad,
  AuthGood,
  createRun,
  exportNdjson,
  handlersLive,
  lines,
  makeClient,
  publish,
  record,
  STUB_FLOW,
  STUB_FLOW_V2,
} from "./test-helpers.js";

layer(Layer.mergeAll(handlersLive(), HttpServer.layerServices))(
  "ExperimentsApi",
  (it) => {
    it.effect("publishes a config and serves it by slug", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const published = yield* publish(client, "study", STUB_FLOW_V2);
        assert.strictEqual(published.slug, "study");
        assert.match(published.version, /^[0-9a-f]{64}$/);
        assert.deepStrictEqual(published.warnings, []);

        const served = yield* client.experiments.getExperiment({
          params: { slug: "study" },
        });
        assert.strictEqual(served.version, published.version);
        assert.deepStrictEqual(served.config, STUB_FLOW_V2);
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("republishing identical content is idempotent", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const first = yield* publish(client, "idem");
        const second = yield* publish(client, "idem");
        assert.strictEqual(first.version, second.version);
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("identical content hashes the same under different slugs", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const a = yield* publish(client, "slug-a");
        const b = yield* publish(client, "slug-b");
        assert.strictEqual(a.version, b.version);
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("a changed config gets a new version and moves the pointer", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const v1 = yield* publish(client, "rev");
        const v2 = yield* publish(client, "rev", STUB_FLOW_V2);
        assert.notStrictEqual(v1.version, v2.version);

        const served = yield* client.experiments.getExperiment({
          params: { slug: "rev" },
        });
        assert.strictEqual(served.version, v2.version);
        assert.deepStrictEqual(served.config, STUB_FLOW_V2);
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("rejects a payload that isn't a config shape", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const error = yield* client.experimentsAdmin
          .publishExperiment({
            params: { slug: "bad-shape" },
            payload: { hello: "world" },
          })
          .pipe(Effect.flip);
        if (error._tag !== "InvalidExperiment") {
          assert.fail(`expected InvalidExperiment, got ${error._tag}`);
        }
        assert.strictEqual(error.errors[0].code, "INVALID_SHAPE");
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("rejects a config the engine validator rejects", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        // Edge targets a node that doesn't exist — structurally fine, but
        // the same validateExperiment() the render path runs must refuse it.
        const broken = {
          nodes: [
            { id: "start", type: "start" },
            { id: "end", type: "end" },
          ],
          edges: [{ from: "start", to: "ghost", type: "sequential" }],
          screens: [],
        };
        const error = yield* client.experimentsAdmin
          .publishExperiment({ params: { slug: "broken" }, payload: broken })
          .pipe(Effect.flip);
        if (error._tag !== "InvalidExperiment") {
          assert.fail(`expected InvalidExperiment, got ${error._tag}`);
        }
        assert.isTrue(error.errors.length > 0);

        // The failed publish must not have registered the slug at all.
        const getError = yield* client.experiments
          .getExperiment({ params: { slug: "broken" } })
          .pipe(Effect.flip);
        assert.strictEqual(getError._tag, "ExperimentNotFound");
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("rejects publish without a bearer token", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const error = yield* client.experimentsAdmin
          .publishExperiment({ params: { slug: "noauth" }, payload: STUB_FLOW })
          .pipe(Effect.flip);
        assert.strictEqual(error._tag, "Unauthorized");
      }).pipe(Effect.provide(AuthBad)),
    );

    it.effect("lists published slugs with their current versions", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        yield* publish(client, "listed-a");
        const v2 = yield* publish(client, "listed-b", STUB_FLOW_V2);

        const { experiments } = yield* client.experiments.listExperiments();
        const slugs = experiments.map((e) => e.slug);
        assert.isTrue(slugs.includes("listed-a"));
        assert.isTrue(slugs.includes("listed-b"));
        assert.strictEqual(
          experiments.find((e) => e.slug === "listed-b")?.version,
          v2.version,
        );
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("serving a config requires no auth but 404s when unknown", () =>
      Effect.gen(function* () {
        // Seeded through the service so the client below runs with no
        // middleware layer at all — a genuinely unauthenticated read.
        const experiments = yield* Experiments;
        yield* experiments.publish("public-study", STUB_FLOW);

        const client = yield* makeClient;
        const served = yield* client.experiments.getExperiment({
          params: { slug: "public-study" },
        });
        assert.strictEqual(served.slug, "public-study");

        const error = yield* client.experiments
          .getExperiment({ params: { slug: "unpublished" } })
          .pipe(Effect.flip);
        assert.strictEqual(error._tag, "ExperimentNotFound");
      }).pipe(Effect.provide(AuthBad)),
    );

    it.effect("refuses runs for experiments that were never published", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const error = yield* client.runs
          .createRun({ payload: { experiment: "ghost-study" } })
          .pipe(Effect.flip);
        assert.strictEqual(error._tag, "UnknownExperiment");
      }).pipe(Effect.provide(AuthGood)),
    );

    it.effect("runs pin the config version they were issued under", () =>
      Effect.gen(function* () {
        const client = yield* makeClient;
        const v1 = yield* publish(client, "pinned");
        const runV1 = yield* createRun(client, "pinned");
        yield* record(client, runV1, 0);

        // Republish under the same slug: new runs get the new version while
        // the existing run's checkpoints still report v1.
        const v2 = yield* publish(client, "pinned", STUB_FLOW_V2);
        assert.notStrictEqual(v1.version, v2.version);
        const runV2 = yield* client.runs.createRun({
          payload: { experiment: "pinned" },
        });
        yield* client.runs.recordCheckpoint({
          params: { runId: runV2.runId },
          headers: { "x-run-token": runV2.token },
          payload: {
            experiment: "pinned",
            checkpoint: "mid",
            seq: 0,
            context: { data: {} },
            at: DateTime.makeUnsafe("2026-09-25T12:00:00.000Z"),
          },
        });

        const rows = lines(yield* exportNdjson(client, "pinned"));
        const v1Row = rows.find((r) => r.runId === runV1.runId);
        const v2Row = rows.find((r) => r.runId === runV2.runId);
        assert.strictEqual(v1Row.configVersion, v1.version);
        assert.strictEqual(v2Row.configVersion, v2.version);
      }).pipe(Effect.provide(AuthGood)),
    );
  },
);
