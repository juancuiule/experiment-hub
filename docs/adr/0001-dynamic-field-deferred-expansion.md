# ADR-0001: Do not eliminate DynamicField — $-prefix for-each requires deferred expansion

**Status:** Accepted

## Context

`collectFields()` in `lib/fields.ts` returns `StaticField | DynamicField`. A `DynamicField` carries a `loops` chain that callers must expand via `iterateLoops()`. This looks like a leaky abstraction — callers need to understand loop mechanics.

The obvious deepening: replace the union with a single `resolveFields()` that returns only fully-expanded, concrete fields. Both `buildSchemaFromFields` and `defaultsFromFields` would then deal with a uniform type.

## Decision

Do not eliminate `DynamicField` or attempt to expand all loops at collection time.

`ForEachMeta.dataKey` is typed `$$${string} | $${string}`. The `$` prefix means the loop values come from live form data (`screenData`), which is only available inside `buildSchemaFromFields`'s `superRefine` callback — not at the point where `collectFields` is called.

Pre-expanding a `$`-prefix for-each would require the form to exist before the schema is built, which is circular. The deferred expansion inside `superRefine` is not incidental complexity; it is the correct model for dynamic schemas that depend on live form state.

## Consequences

- `DynamicField`, `ForEachMeta`, and `iterateLoops` remain exported from `lib/fields.ts`.
- `buildSchemaFromFields` calls `iterateLoops` inside `superRefine` with the merged live context. This is load-bearing.
- Future architecture reviews should not re-propose eliminating `DynamicField` unless the `$`-prefix for-each use-case is removed from the system.
- The seam that matters for `src/` callers is `buildScreenBindings` — `DynamicField` is an internal concern of `lib/`.
