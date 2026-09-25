import { Effect, Layer, Redacted } from "effect";
import { timingSafeEqual } from "node:crypto";
import { ExportToken, Unauthorized } from "./api.js";
import { BackendConfig } from "./config.js";

export const ExportTokenLive = Layer.effect(
  ExportToken,
  Effect.gen(function* () {
    const config = yield* BackendConfig;
    const expected = Buffer.from(Redacted.value(config.exportToken));

    return ExportToken.of({
      bearer: Effect.fnUntraced(function* (httpEffect, { credential }) {
        const provided = Buffer.from(Redacted.value(credential));
        if (
          provided.length !== expected.length ||
          !timingSafeEqual(provided, expected)
        ) {
          return yield* new Unauthorized({
            message: "Missing or invalid bearer token",
          });
        }
        return yield* httpEffect;
      }),
    });
  }),
);
