import { DateTime, Effect, Layer, Option, Redacted, Stream } from "effect";
import { HttpClientRequest } from "effect/unstable/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/unstable/httpapi";
import { Api, ExportToken } from "./api.js";
import { ExportTokenLive } from "./auth.js";
import { Checkpoints } from "./checkpoints.js";
import { BackendConfig } from "./config.js";
import { makeSqlLive } from "./db.js";
import { Experiments } from "./experiments.js";
import {
  ExperimentsAdminHandlers,
  ExperimentsHandlers,
  ExportHandlers,
  RunsHandlers,
  SystemHandlers,
} from "./handlers.js";

export const testConfig = (allowed?: ReadonlyArray<string>) =>
  Layer.succeed(BackendConfig, {
    port: 0,
    host: "127.0.0.1",
    dbPath: ":memory:",
    exportToken: Redacted.make("test-token"),
    runTokenSecret: Redacted.make("test-run-secret"),
    allowedExperiments: allowed
      ? Option.some<ReadonlySet<string>>(new Set(allowed))
      : Option.none(),
    seedConfigsDir: Option.none<string>(),
    nodeEnv: "test",
  });

// Minimal flow that passes validateExperiment — used whenever a test needs
// a registered experiment rather than a specific graph.
export const STUB_FLOW = {
  nodes: [
    { id: "start", type: "start" },
    { id: "end", type: "end" },
  ],
  edges: [{ from: "start", to: "end", type: "sequential" }],
  screens: [],
};

// A second valid flow whose content differs, so republishing under the same
// slug produces a different content hash.
export const STUB_FLOW_V2 = {
  nodes: [
    { id: "start", type: "start" },
    { id: "s", type: "screen", props: { slug: "v2-screen" } },
    { id: "end", type: "end" },
  ],
  edges: [
    { from: "start", to: "s", type: "sequential" },
    { from: "s", to: "end", type: "sequential" },
  ],
  screens: [
    {
      slug: "v2-screen",
      components: [
        {
          componentFamily: "layout",
          template: "button",
          props: { text: "ok" },
        },
      ],
    },
  ],
};

export const handlersLive = (allowed?: ReadonlyArray<string>) => {
  // One shared in-memory DB: services and the health probe must see the
  // same SqlClient (each makeSqlLive call would open a separate database).
  const sqlLive = makeSqlLive(":memory:");
  return Layer.mergeAll(
    RunsHandlers,
    ExportHandlers,
    ExperimentsHandlers,
    ExperimentsAdminHandlers,
    SystemHandlers,
  ).pipe(
    Layer.provide(Checkpoints.layerNoDeps),
    Layer.provideMerge(Experiments.layerNoDeps),
    Layer.provideMerge(ExportTokenLive),
    Layer.provideMerge(sqlLive),
    Layer.provide(testConfig(allowed)),
  );
};

export const makeClient = HttpApiTest.groups(Api, [
  "runs",
  "export",
  "experiments",
  "experimentsAdmin",
  "system",
]);

export const AuthGood = HttpApiMiddleware.layerClient(
  ExportToken,
  ({ next, request }) =>
    next(HttpClientRequest.bearerToken(request, "test-token")),
);

export const AuthBad = HttpApiMiddleware.layerClient(
  ExportToken,
  ({ next, request }) => next(request),
);

export type TestClient = Effect.Success<typeof makeClient>;
export type Run = { runId: string; token: string; experiment: string };

export const publish = (
  client: TestClient,
  slug: string,
  config: unknown = STUB_FLOW,
) =>
  client.experimentsAdmin.publishExperiment({
    params: { slug },
    payload: config,
  });

export const createRun = Effect.fnUntraced(function* (
  client: TestClient,
  experiment: string,
) {
  // Runs only exist for registered experiments — seed a stub config first.
  // Idempotent: identical content hashes to the same version.
  const { version } = yield* publish(client, experiment);
  const run = yield* client.runs.createRun({
    payload: { experiment, version },
  });
  return { ...run, experiment } satisfies Run;
});

export const record = (
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
      at: DateTime.makeUnsafe("2026-09-25T12:00:00.000Z"),
    },
  });

export const exportNdjson = Effect.fnUntraced(function* (
  client: TestClient,
  slug: string,
) {
  const stream = yield* client.export.experiment({ params: { slug } });
  return yield* stream.pipe(Stream.decodeText(), Stream.mkString);
});

export const lines = (ndjson: string) =>
  ndjson
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
