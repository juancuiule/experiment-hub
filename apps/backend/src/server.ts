import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { createServer } from "node:http";
import { Api } from "./api.js";
import { ExportTokenLive } from "./auth.js";
import { BackendConfig } from "./config.js";
import { Checkpoints } from "./checkpoints.js";
import { SqlLive } from "./db.js";
import { Experiments } from "./experiments.js";
import {
  ExperimentsAdminHandlers,
  ExperimentsHandlers,
  ExportHandlers,
  RunsHandlers,
  SystemHandlers,
} from "./handlers.js";

// SqlLive is merged in so SystemHandlers can probe the same connection; both
// it and the service layers expose their BackendConfig requirement upward so
// the single provision on ServerLive is shared by every consumer.
const HandlersLive = Layer.mergeAll(
  RunsHandlers,
  ExportHandlers,
  ExperimentsHandlers,
  ExperimentsAdminHandlers,
  SystemHandlers,
).pipe(
  Layer.provide(Checkpoints.layer),
  Layer.provide(Experiments.layer),
  Layer.provideMerge(ExportTokenLive),
  Layer.provideMerge(SqlLive),
);

const ApiLive = HttpApiBuilder.layer(Api, {
  openapiPath: "/api/openapi.json",
}).pipe(Layer.provide(HandlersLive));

const ServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* BackendConfig;
    return HttpRouter.serve(ApiLive).pipe(
      Layer.provide(NodeHttpServer.layer(createServer, {
        port: config.port,
        host: config.host,
      })),
    );
  }),
).pipe(Layer.provide(BackendConfig.layer));

Layer.launch(ServerLive).pipe(NodeRuntime.runMain);
