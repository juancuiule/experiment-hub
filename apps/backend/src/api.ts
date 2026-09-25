import { Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from "effect/unstable/httpapi";

export const CheckpointPayload = Schema.Struct({
  experiment: Schema.NonEmptyString,
  checkpoint: Schema.NonEmptyString,
  context: Schema.Unknown,
  at: Schema.NonEmptyString,
});
export type CheckpointPayload = typeof CheckpointPayload.Type;

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  { message: Schema.String },
  { httpApiStatus: 401 },
) {}

export class ExperimentNotFound extends Schema.TaggedError<ExperimentNotFound>()(
  "ExperimentNotFound",
  { slug: Schema.String },
  { httpApiStatus: 404 },
) {}

export class ExportToken extends HttpApiMiddleware.Service<ExportToken>()(
  "backend/ExportToken",
  {
    requiredForClient: true,
    security: { bearer: HttpApiSecurity.bearer },
    error: Unauthorized,
  },
) {}

export class RunsApiGroup extends HttpApiGroup.make("runs")
  .add(
    HttpApiEndpoint.post("recordCheckpoint", "/runs/:runId/checkpoints", {
      params: { runId: Schema.NonEmptyString },
      payload: CheckpointPayload,
      success: Schema.Struct({ ok: Schema.Literal(true) }),
    }),
  )
  .prefix("/api") {}

export class ExportApiGroup extends HttpApiGroup.make("export")
  .add(
    HttpApiEndpoint.get("experiment", "/experiments/:slug/export", {
      params: { slug: Schema.NonEmptyString },
      success: Schema.String.pipe(
        HttpApiSchema.asText({ contentType: "application/x-ndjson" }),
      ),
      error: ExperimentNotFound,
    }),
  )
  .middleware(ExportToken)
  .prefix("/api") {}

export class SystemApiGroup extends HttpApiGroup.make("system")
  .add(
    HttpApiEndpoint.get("health", "/health", {
      success: Schema.Struct({ status: Schema.Literal("ok") }),
    }),
  )
  .prefix("/api") {}

export class Api extends HttpApi.make("experiment-hub")
  .add(RunsApiGroup)
  .add(ExportApiGroup)
  .add(SystemApiGroup) {}
