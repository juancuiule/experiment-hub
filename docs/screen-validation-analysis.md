# Screen Validation — Deep Analysis

## Module Intention

The screen validation system enforces that a participant cannot advance past a screen until all visible, required response fields are correctly filled. It is driven by a two-phase architecture:

- **Phase 1 (Zod static schema):** Builds a `z.object()` schema from all statically-known fields on the screen. Fields inside conditionals are marked `.optional()` because they may or may not be present.
- **Phase 2 (superRefine):** A runtime pass that re-traverses the component tree with the actual submitted form data, evaluates conditions, and enforces required constraints on fields that Phase 1 cannot handle statically (conditionals, dynamic for-each).

`react-hook-form` connects the two: `zodResolver(buildSchema(screen))` drives the form's validation. Default values come from `collectDefaults` in `Screen.tsx`.

---

## Architecture Overview

```
lib/validation.ts
  buildSchema(screen)
    └── collectFields(components)        ← Phase 1: static Zod shape
          └── collectFieldEntries(c)     ← recursive collector
    └── superRefine(data, ctx)           ← Phase 2: runtime enforcement
          └── validateComponentTree(c)   ← recursive validator

src/Screen.tsx
  collectDefaults(components, context)   ← default form values
    └── resolveForEachComponent(c)       ← resolves {{#id.index/value}} for static for-each
  buildDefaultValues(screen, context)    ← calls collectDefaults
  Screen component
    useForm({ resolver: zodResolver(buildSchema(screen)), defaultValues })
    onSubmit → appends __order fields → calls onNext
```

---

## Component Type Matrix

| Component type | Phase 1 (static schema) | Phase 2 (superRefine) | Defaults |
|---|---|---|---|
| `response` (flat) | full Zod schema | early-return (handled by Phase 1) | by template |
| `group → response` | full Zod schema (flattened) | recurses into group children | recurses |
| `conditional → response` | `.optional()` | evaluates condition, validates if-branch | both branches visited |
| `conditional → group → response` | `.optional()` | evaluates condition, recurses group | both branches visited |
| `static for-each → response` | expands each iteration | iterates in dynamic mode | expands each iteration |
| `static for-each → group → response` | expands each iteration (recursive) | iterates + recurses group | `resolveForEachComponent` handles group |
| `dynamic for-each → response` | **skipped** (keys unknown) | resolves source, iterates in dynamic mode | not visited (bug — see below) |
| `conditional → for-each → response` | `.optional()` on all iterations | condition → iterates | both branches visited, iterations expanded |
| `for-each → conditional → response` | static: expands + marks optional; dynamic: skipped | iterates → evaluates condition | static: both branches visited per iteration; dynamic: skipped |

---

## Default Values by Response Type

| Template | Default |
|---|---|
| `text-input` | `''` |
| `text-area` | `''` |
| `date-input` | `''` |
| `time-input` | `''` |
| `likert-scale` | `''` |
| `radio` | `''` |
| `dropdown` | `''` |
| `checkboxes` | `[]` |
| `single-checkbox` | `props.defaultValue ?? false` |
| `slider` | `null` |
| `numeric-input` | `props.defaultValue ?? null` |

Defaults are computed once at mount (`buildDefaultValues`). A documented TODO acknowledges that defaults are **stale** if components are dynamically added/removed during a screen (e.g., a conditional reveals a new field after the form is initialized). `shouldUnregister: true` removes unmounted field values, but re-mounting a component leaves it with `undefined` rather than its default.

---

## Identified Bugs

### Bug 1 — Dynamic for-each uses empty `data`/`loopData` context (validation silently skips)

**Location:** `lib/validation.ts:264-275`, `validateComponentTree`, dynamic for-each branch.

```typescript
const context = {
  screenData: { ...screenData, foreachData: forEachCtx },
  data: {},        // ← always empty
  loopData: {},    // ← always empty
};
const values = getValue(component.props.dataKey, context);
if (!Array.isArray(values)) return; // ← silently skips ALL required field validation
```

If the dynamic for-each source is `$$previous.answers` or any `$$…` reference, `getValue` returns `undefined`, `!Array.isArray(undefined)` is `true`, and the function returns early. The rendered iterations on screen are never validated — required fields inside a dynamic for-each driven by experiment data pass silently.

**Impact:** Silent data loss. Users can submit screens with empty required fields inside dynamic for-each blocks backed by external data.

---

### Bug 2 — Conditional evaluation in `superRefine` uses empty `data`/`loopData`

**Location:** `lib/validation.ts:244-250`, `validateComponentTree`, conditional branch.

```typescript
const context = {
  screenData: { ...screenData, foreachData: forEachCtx },
  data: {},        // ← always empty
  loopData: {},    // ← always empty
};
const conditionMet = evaluateCondition(component.props.if, context);
```

A condition like `{ dataKey: '$$prev.status', operator: 'eq', value: 'active' }` will always evaluate to `false` during `superRefine` because `data` is empty. If the condition is actually `true` at render time (the field is visible), the required validation for its fields is skipped.

**Impact:** Required fields inside conditionals driven by `$$…` experiment data or `@loop` references are never enforced on submit.

---

### Bug 3 — `resolveForEachComponent` doesn't handle nested conditionals or nested for-each

**Location:** `src/Screen.tsx:20-52`, `resolveForEachComponent`.

The function resolves `{{#id.index}}` and `{{#id.value}}` placeholders in `dataKey` for static for-each iterations. It handles `response` and `group` templates, but falls through silently for `conditional` and `for-each`:

```typescript
function resolveForEachComponent(component, id, value, index) {
  if (component.componentFamily === 'response') { /* handles */ }
  if (component.componentFamily === 'layout' && component.template === 'group') { /* recurses */ }
  return component; // ← conditional/for-each templates returned unmodified
}
```

**Impact:** For a static for-each whose template is a `conditional`, the condition's `dataKey` and the inner component's `dataKey` will contain unresolved `{{#id.value}}` or `{{#id.index}}` placeholders. `collectDefaults` will store defaults under those unresolved keys (e.g. `answer-{{#fe.value}}`), causing a mismatch with the actual rendered form field keys.

---

### Bug 4 — `collectFieldDescriptions` (`getSchemaShape`) misses `for-each → group → response`

**Location:** `lib/validation.ts:424-443`, `collectFieldDescriptions`, static for-each branch.

```typescript
const template = component.props.component;
if (template.componentFamily === 'response') {   // ← only handles direct response
  for (let i = 0; i < component.props.values.length; i++) { ... }
}
// Group template inside for-each: silently ignored
```

`getSchemaShape` (which calls this function) is used for documentation/debug display. When a static for-each has a group template, the inner response fields are absent from the described shape.

Additionally, this function uses `.replace()` (single match) instead of `.replaceAll()`, so a dataKey with multiple `{{#id.index}}` tokens would only have the first replaced.

**Impact:** Documentation/debug output is incomplete. Not a runtime validation bug, but creates misleading schema descriptions.

---

### Bug 5 — `checkboxes` with `required: false` doesn't return `.optional()`

**Location:** `lib/validation.ts:50-66`, `buildFieldSchema`, checkboxes case.

```typescript
case 'checkboxes': {
  let base = z.array(z.string());
  if (required || (min !== undefined && min > 0)) {
    base = base.min(min ?? 1, ...);
  }
  return base; // ← never .optional()
}
```

All other field types return `base.optional()` when `required: false`. Checkboxes returns the raw array schema. In practice this is mitigated because:
- The default value is `[]`, which satisfies `z.array(z.string())`.
- When nested in a conditional, `collectFieldEntries` wraps the result with `.optional()`.

But a top-level optional checkboxes field that is somehow `undefined` (e.g. if `shouldUnregister` fires and re-mount happens before defaults rehydrate) would fail validation even though it's marked `required: false`. It also means the schema type is asymmetric with other fields.

---

### Bug 6 — `numeric-input` with `required: false` coerces `null` default to `0`

**Location:** `lib/validation.ts:73-81` and `src/Screen.tsx:101`.

Default for an optional `numeric-input` without a `defaultValue` is `null` (from `collectDefaults`). The schema is:

```typescript
return required ? base : base.optional(); // z.coerce.number().optional()
```

`z.coerce.number()` coerces `null` → `0`. Even though `.optional()` allows `undefined`, it does not short-circuit coercion for `null`. So submitting without touching the field yields `0` in the output data, not `null` or `undefined`.

**Impact:** Optional numeric fields that users never interact with submit as `0` instead of absent, which may contaminate experiment data.

---

### Bug 7 — `single-checkbox` with `shouldBe` ignores `required: false`

**Location:** `lib/validation.ts:123-133`.

```typescript
case 'single-checkbox': {
  const { shouldBe } = component.props;
  if (shouldBe !== undefined) {
    return z.boolean().refine((v) => v === shouldBe, { ... });
    // ← required is not consulted here
  }
  return required ? z.boolean().refine(...) : z.boolean();
}
```

If `shouldBe` is set and `required: false`, the field still enforces the `shouldBe` constraint. A design intent mismatch: an optional checkbox with a target value still acts as required.

---

## Missing Coverage / Untested Combinations

| Combination | Status |
|---|---|
| `conditional → conditional → response` (double nested) | ❌ No test |
| `conditional → static for-each → response` | ❌ No test |
| `static for-each → conditional → response` | ❌ No test |
| `group → group → response` (nested groups) | ❌ No test |
| `conditional → group → for-each → response` | ❌ No test |
| `dynamic for-each → required field` validation (external data) | ❌ Known bug, no test |
| `conditional` with `$$…` data reference in condition | ❌ Known bug, no test |
| Optional `checkboxes` re-mount (undefined scenario) | ❌ No test |
| Optional `numeric-input` submits as 0 | ❌ No test |

---

## Architectural Issues

### `passthrough()` weakens type safety
`buildSchema` uses `.passthrough()` to preserve dynamic for-each keys not in the static shape. This means any arbitrary extra field survives schema parsing without error. A stricter approach would be to explicitly add a `z.record(z.string(), z.unknown())` intersection only for the dynamic keys, but this isn't straightforward without knowing the keys at schema-build time.

### First-entry-wins for duplicate `dataKey`
In `collectFields`:
```typescript
if (dataKey in acc) continue; // first entry wins
```
The comment covers the intentional case (if/else branches sharing a key). But an accidental collision between two different components with the same `dataKey` (a schema author error) would silently use the first component's type, potentially mismatching the rendered field.

### `defaultValues` computed once at mount
The `TODO` in `Screen.tsx:120-124` documents this. With `shouldUnregister: true`, a field that is conditionally hidden and then re-shown starts with no value rather than its original default. The correct fix is to register defaults per-component when they mount, but this requires a significant refactor.

### `validateComponentTree` dynamic mode flag logic
The `dynamicMode` flag is `false` at the top level and becomes `true` the first time a conditional or dynamic for-each is entered. This prevents double-validation of static fields. However, this means a static for-each at the top level is validated in Phase 1 only, and its fields are **not re-validated by Phase 2**. If the for-each template dataKey resolution produces a key that Phase 1 registered but Phase 2 can't find (e.g., because `forEachCtx` needs a value to resolve), there is a silent gap. In practice this works because static for-each fields are fully expanded in Phase 1, but the conceptual boundary is fragile.

---

## What Works Well

- The two-phase design (static + superRefine) cleanly separates what can be known at schema-build time from what requires runtime data.
- `collectFieldEntries` correctly marks conditional fields as optional in the base schema, avoiding false "required" errors when conditions are false.
- `shouldUnregister: true` correctly removes field values when conditional components unmount.
- Static for-each is fully resolved in both Phase 1 and `collectDefaults`, with consistent key format (`{{#id.index}}` / `{{#id.value}}`).
- `slider` required validation correctly distinguishes "user hasn't touched" (`null`) from "user set a value" using a `preprocess` + `refine` + `pipe` chain.
- `__order` fields for randomized options (radio, checkboxes, dropdown) are preserved via `passthrough()` and appended to submit data in `onSubmit`.
- Integration tests cover the golden paths for all main component types.
