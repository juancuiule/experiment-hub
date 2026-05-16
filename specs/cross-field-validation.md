# Cross-Field Validation

> **Status:** Phase 1 implemented (2026-05-16). Phase 2 (value-to-value comparison operators) is designed but not yet implemented.  
> **Created:** 2026-05-15  

---

## Phase 1 — `required-if` (Implemented)

### Problem

Every response component is validated in isolation. There is no way to express "this field is required only when another field has a specific value." Workarounds using `ConditionalComponent` hide/show fields but don't enforce validation correctly.

### Solution

Add a `crossValidation` prop to response components. Each rule has `operator: "required-if"` and a `condition` (the existing `Condition` type from `conditions.ts`). At submit time, if the condition evaluates to true against the current form state, the field must be non-empty.

### Type Design

`CrossValidationRule` and the updated `ResponseComponentBaseProps` live in `lib/components/response.ts`:

```ts
import { Condition } from "../conditions";

export type CrossValidationRule = {
  operator: "required-if";
  condition: Condition;    // $key references point to same-screen fields
  errorMessage?: string;
};

type ResponseComponentBaseProps = {
  dataKey: string;
  required?: boolean;
  errorMessage?: string;
  crossValidation?: CrossValidationRule[];  // new
};
```

**`Condition` reuse:** The full `Condition` type is used, supporting `simple`, `and`, `or`, and `not`. Only `$key` references (same-screen fields) are valid. `$$key` references are a static error — experiment-level data is not in scope for cross-validation in this iteration (future work: extend `buildSchema` to accept experiment context and lift this restriction).

**`required: true` + `crossValidation`:** When a field has `required: true`, the base Zod schema already enforces non-emptiness unconditionally. The `superRefine` cross-validation pass skips `required-if` isEmpty checks for such fields to avoid duplicate errors. This skip is **specific to `required-if`** — Phase 2 value comparison rules must still run even when `required: true` (see Phase 2 constraint below).

### Examples

```ts
// Scenario A: numberOfChildren required only when $hasChildren === "yes"
crossValidation: [{
  operator: "required-if",
  condition: { type: "simple", operator: "eq", dataKey: "$hasChildren", value: "yes" },
  errorMessage: "Please enter the number of children."
}]

// Required when $confidence > 50
crossValidation: [{
  operator: "required-if",
  condition: { type: "simple", operator: "gt", dataKey: "$confidence", value: 50 }
}]

// Compound: required when $hasJob is "yes" AND $yearsWorked > 0
crossValidation: [{
  operator: "required-if",
  condition: {
    type: "and",
    conditions: [
      { type: "simple", operator: "eq", dataKey: "$hasJob", value: "yes" },
      { type: "simple", operator: "gt", dataKey: "$yearsWorked", value: 0 }
    ]
  }
}]
```

### Runtime: buildSchema

`lib/validation.ts` is extended in two steps.

#### Step 1 — New collector

```ts
type CrossValidationEntry = {
  component: ResponseComponent;
  guardCondition?: Condition;
};

function collectCrossValidationTargets(
  components: ScreenComponent[],
  guard?: Condition,
  acc: CrossValidationEntry[] = []
): CrossValidationEntry[] {
  for (const c of components) {
    if (c.componentFamily === "response" && c.props.crossValidation?.length) {
      acc.push({ component: c, guardCondition: guard });
    } else if (c.componentFamily === "layout" && c.template === "group") {
      collectCrossValidationTargets(c.props.components, guard, acc);
    } else if (c.componentFamily === "control" && c.template === "conditional") {
      const innerGuard: Condition = guard
        ? { type: "and", conditions: [guard, c.props.if] }
        : c.props.if;
      collectCrossValidationTargets([c.props.component], innerGuard, acc);
      if (c.props.else) {
        const elseGuard: Condition = guard
          ? { type: "and", conditions: [guard, { type: "not", condition: c.props.if }] }
          : { type: "not", condition: c.props.if };
        collectCrossValidationTargets([c.props.else], elseGuard, acc);
      }
    }
    // Known limitation: for-each components are not recursed here.
  }
  return acc;
}
```

`guardCondition` is the `ConditionalComponent`'s `if` condition (composed with any outer guard via `and`). When a field is inside a hidden conditional, its cross-validation is skipped.

#### Step 2 — Extended superRefine

`buildSchema` runs cross-validation in the same `superRefine` pass as the existing conditional enforcement, after the existing conditionals loop:

```ts
for (const { component, guardCondition } of crossValidationTargets) {
  if (guardCondition) {
    const guardMet = evaluateCondition(guardCondition, { screenData: data, data: {}, loopData: {} });
    if (!guardMet) continue;
  }

  // Fields with required: true are already enforced by the base schema —
  // skip only the required-if isEmpty check to avoid duplicate errors.
  // Value comparison rules (Phase 2) must NOT be skipped here.
  if (component.props.required) continue;  // Phase 2: change to per-rule check

  for (const rule of component.props.crossValidation!) {
    const conditionMet = evaluateCondition(rule.condition, { screenData: data, data: {}, loopData: {} });
    if (!conditionMet) continue;

    const value = data[component.props.dataKey];
    const isEmpty =
      value === undefined || value === null || value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: rule.errorMessage ?? "This field is required",
        path: [component.props.dataKey],
      });
    }
  }
}
```

### Static Validation: validateExperiment

`checkCrossValidationReferences` in `lib/validate.ts` walks each screen's component tree to collect all `dataKey` values, then for each `crossValidation` rule calls `collectConditionDataKeys` to find all `$key` references. Two categories of error:

- `$key` not matching any field on the same screen → `invalid-reference` error
- `$$key` reference → `invalid-reference` error (experiment context is out of scope)

```
code: "invalid-reference"
message: `Screen "<slug>" field "<dataKey>" crossValidation references "$<key>" which is not a field on this screen`

code: "invalid-reference"
message: `Screen "<slug>" field "<dataKey>" crossValidation references "$$<key>"; experiment-level data is not supported in crossValidation conditions`
```

### Test Plan

**Unit — `lib/specs/validation.test.ts`**
- `required-if` with `eq` condition: passes when condition not met, fails when met and field empty
- `required-if` with `gt` condition: fails when `$confidence > 50` and field empty
- Multiple rules on one field: all failing rules add issues (not first-failure-only)
- Field inside `ConditionalComponent` with false guard: cross-validation skipped
- `errorMessage` omitted: default `"This field is required"` appears in error
- `required: true` + `crossValidation`: exactly one error, no duplicate

**Unit — `lib/specs/validate.test.ts`**
- `crossValidation` referencing a valid `$key` on the same screen: no error
- `crossValidation` referencing a `$key` not on the screen: `invalid-reference` error
- `crossValidation` referencing a `$$key`: `invalid-reference` error

**Integration — `src/specs/Screen.test.tsx`**
- Submit with trigger condition met + dependent field empty → error on dependent field
- Submit with trigger condition not met + dependent field empty → no error, screen advances
- Error message falls back to default when `errorMessage` not set

### Files Changed

| File | Change |
|---|---|
| `lib/components/response.ts` | Add `CrossValidationRule` type; add `crossValidation?` to `ResponseComponentBaseProps` |
| `lib/validation.ts` | Add `collectCrossValidationTargets`; extend `buildSchema` superRefine; fix numeric-input coercion |
| `lib/validate.ts` | Add `collectScreenDataKeys`; add `checkCrossValidationReferences`; call from `validateExperiment` |
| `lib/specs/validation.test.ts` | Unit tests for `buildSchema` cross-validation |
| `lib/specs/validate.test.ts` | Unit tests for `validateExperiment` cross-validation reference check |
| `src/specs/Screen.test.tsx` | Integration tests |

---

## Phase 2 — Value-to-Value Comparison Operators (Planned)

### Problem

There is no way to express constraints between two field values on the same screen, such as "end age must be greater than start age" or "confirm email must equal email." These are value constraints on the field itself, not conditional requirements.

### Solution

Extend `CrossValidationRule` into a discriminated union by adding `CompareToFieldRule`. Each rule names a comparison `operator` and a `compareToKey` (`$key` reference to another same-screen field). At submit time, the field's own value is compared against the referenced field's value using the given operator.

### Type Design

`CrossValidationRule` in `lib/components/response.ts` becomes a discriminated union:

```ts
export type RequiredIfRule = {
  operator: "required-if";
  condition: Condition;
  errorMessage?: string;
};

export type CompareToFieldRule = {
  operator: "gt" | "lt" | "gte" | "lte" | "eq" | "neq";
  compareToKey: string;   // $key reference to a same-screen field
  errorMessage?: string;
};

export type CrossValidationRule = RequiredIfRule | CompareToFieldRule;
```

**Operator semantics:**

| Operator | Meaning | Field types |
|---|---|---|
| `gt` | this field > compareToKey field | numeric |
| `lt` | this field < compareToKey field | numeric |
| `gte` | this field ≥ compareToKey field | numeric |
| `lte` | this field ≤ compareToKey field | numeric |
| `eq` | this field === compareToKey field | string or numeric |
| `neq` | this field !== compareToKey field | string or numeric |

Numeric coercion uses `Number()`. Non-numeric string values for `gt`/`lt`/`gte`/`lte` should emit a static error from `validateExperiment` (future: validate component template compatibility).

### Examples

```ts
// endAge must be greater than $startAge
// on the endAge field:
crossValidation: [{
  operator: "gt",
  compareToKey: "$startAge",
  errorMessage: "End age must be greater than start age."
}]

// confirmEmail must equal $email
crossValidation: [{
  operator: "eq",
  compareToKey: "$email",
  errorMessage: "Emails must match."
}]

// Combined with required-if on the same field
crossValidation: [
  {
    operator: "required-if",
    condition: { type: "simple", operator: "eq", dataKey: "$hasEndAge", value: "yes" }
  },
  {
    operator: "gt",
    compareToKey: "$startAge",
    errorMessage: "End age must be greater than start age."
  }
]
```

### Runtime: buildSchema changes

In the `superRefine` loop, add a branch for `CompareToFieldRule` after the existing `required-if` branch:

```ts
for (const rule of component.props.crossValidation!) {
  if (rule.operator === "required-if") {
    // existing required-if logic (skip if component.props.required)
  } else {
    // value comparison: runs even when required: true
    const thisValue = Number(data[component.props.dataKey]);
    const otherKey = rule.compareToKey.slice(1);  // strip $
    const otherValue = Number(data[otherKey]);
    const passes = compare(rule.operator, thisValue, otherValue);
    if (!passes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: rule.errorMessage ?? defaultCompareMessage(rule.operator, rule.compareToKey),
        path: [component.props.dataKey],
      });
    }
  }
}
```

**Important constraint:** The `if (component.props.required) continue` short-circuit currently sits outside the per-rule loop, which means it would incorrectly skip value comparison rules on `required: true` fields. When Phase 2 is implemented, move that check inside the loop and scope it only to `required-if` rules:

```ts
// Before (Phase 1):
if (component.props.required) continue;
for (const rule of component.props.crossValidation!) { ... }

// After (Phase 2):
for (const rule of component.props.crossValidation!) {
  if (rule.operator === "required-if" && component.props.required) continue;
  // ...
}
```

### Static Validation: validateExperiment changes

`checkCrossValidationReferences` already validates `$key` references inside `Condition` trees (via `collectConditionDataKeys`). For `CompareToFieldRule`, add a parallel check on `rule.compareToKey`:

```ts
if (rule.operator !== "required-if") {
  const refKey = rule.compareToKey.startsWith("$$")
    ? null  // $$key → invalid-reference error (same as required-if)
    : rule.compareToKey.startsWith("$")
    ? rule.compareToKey.slice(1)
    : null;  // missing $ prefix → invalid-reference error

  if (!refKey || !screenDataKeys.has(refKey)) {
    errors.push({ code: "invalid-reference", message: `...` });
  }
}
```

### Known Constraints Carried Forward

- `$$key` (experiment-level data) in `compareToKey` remains a static error until `buildSchema` is extended to accept experiment context.
- `for-each` children are not walked by `collectCrossValidationTargets` or `collectScreenDataKeys` — value comparison rules inside `for-each` are silently ignored.
- No cross-screen validation is in scope.

---

## Out of Scope (both phases)

- `$$key` (experiment-level data) in cross-validation conditions — future work: extend `buildSchema` to accept experiment context
- `for-each` components containing cross-validation rules
- Cross-screen validation
