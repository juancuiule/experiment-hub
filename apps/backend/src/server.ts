import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { createServer } from "node:http";
import { Api } from "./api.js";
import { ExportTokenLive } from "./auth.js";
import { BackendConfig } from "./config.js";
import { Checkpoints } from "./checkpoints.js";
import { ExportHandlers, RunsHandlers, SystemHandlers } from "./handlers.js";

const HandlersLive = Layer.mergeAll(
  RunsHandlers,
  ExportHandlers,
  SystemHandlers,
).pipe(
  Layer.provide(Checkpoints.layer),
  Layer.provideMerge(ExportTokenLive),
  Layer.provide(BackendConfig.layer),
);

const ApiLive = HttpApiBuilder.layer(Api, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(HandlersLive));

const ServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* BackendConfig;
    return HttpRouter.serve(ApiLive).pipe(
      Layer.provide(NodeHttpServer.layer(createServer, { port: config.port })),
    );
  }),
).pipe(Layer.provide(BackendConfig.layer));

Layer.launch(ServerLive).pipe(NodeRuntime.runMain);
