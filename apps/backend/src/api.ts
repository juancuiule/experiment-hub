import { Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from "effect/unstable/httpapi";

// Slugs are public (they're URL paths), so this can't verify identity — it
// only bounds the shape so junk identifiers can't pollute exports.
const SlugSchema = Schema.String.check(
  Schema.isPattern(/^[a-z0-9][a-z0-9-_]{0,99}$/),
);

const BoundedString = (max: number) =>
  Schema.String.check(Schema.isLengthBetween(1, max));

export const CheckpointPayload = Schema.Struct({
  experiment: SlugSchema,
  checkpoint: BoundedString(200),
  // Ordinal of this checkpoint visit within the run, assigned by the client
  // and reused verbatim on network retries. It is the dedupe key: retries
  // collapse, genuine repeat visits (even with identical answers) don't.
  seq: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 9999 })),
  context: Schema.Unknown,
  at: BoundedString(64),
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

export class TooManyCheckpoints extends Schema.TaggedError<TooManyCheckpoints>()(
  "TooManyCheckpoints",
  { runId: Schema.String },
  { httpApiStatus: 429 },
) {}

export class InvalidRunToken extends Schema.TaggedError<InvalidRunToken>()(
  "InvalidRunToken",
  { runId: Schema.String },
  { httpApiStatus: 401 },
) {}

export class UnknownExperiment extends Schema.TaggedError<UnknownExperiment>()(
  "UnknownExperiment",
  { experiment: Schema.String },
  { httpApiStatus: 404 },
) {}

export class CheckpointTooLarge extends Schema.TaggedError<CheckpointTooLarge>()(
  "CheckpointTooLarge",
  { runId: Schema.String },
  { httpApiStatus: 413 },
) {}

// Runs are server-issued: createRun mints the runId and a token signed over
// (runId, experiment). Checkpoint writes must present it, so clients can no
// longer pick arbitrary run ids or write under a slug they didn't register.
export class RunsApiGroup extends HttpApiGroup.make("runs")
  .add(
    HttpApiEndpoint.post("createRun", "/runs", {
      payload: Schema.Struct({ experiment: SlugSchema }),
      success: Schema.Struct({ runId: Schema.String, token: Schema.String }),
      error: UnknownExperiment,
    }),
  )
  .add(
    HttpApiEndpoint.post("recordCheckpoint", "/runs/:runId/checkpoints", {
      params: { runId: BoundedString(200) },
      headers: { "x-run-token": BoundedString(200) },
      payload: CheckpointPayload,
      success: Schema.Struct({ ok: Schema.Literal(true) }),
      error: [TooManyCheckpoints, InvalidRunToken, CheckpointTooLarge],
    }),
  )
  .prefix("/api") {}

export class ExportApiGroup extends HttpApiGroup.make("export")
  .add(
    HttpApiEndpoint.get("experiment", "/experiments/:slug/export", {
      params: { slug: SlugSchema },
      success: HttpApiSchema.StreamUint8Array({
        contentType: "application/x-ndjson",
      }),
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
