## Cross-Field Validation

Response components accept an optional `crossValidation` array. Each rule can make a field conditionally required based on another field's value.

### `required-if`

A field becomes required when the given `condition` evaluates to `true` against the current screen's form state.

**Type:**

```ts
type CrossValidationRule = {
  operator: "required-if";
  condition: Condition;      // $key references point to same-screen fields
  errorMessage?: string;     // falls back to "This field is required"
};
```

**Example — Scenario A (conditional required):**

```ts
// "How many children?" is required only when "Do you have children?" is "yes"
{
  componentFamily: "response",
  template: "numeric-input",
  props: {
    dataKey: "numberOfChildren",
    label: "How many?",
    required: false,
    crossValidation: [
      {
        operator: "required-if",
        condition: { type: "simple", operator: "eq", dataKey: "$hasChildren", value: "yes" },
        errorMessage: "Please enter the number of children.",
      },
    ],
  },
}
```

**Example — numeric threshold:**

```ts
// "Reasoning" is required when confidence > 50
crossValidation: [
  {
    operator: "required-if",
    condition: { type: "simple", operator: "gt", dataKey: "$confidence", value: 50 },
  },
]
```

**Compound conditions** use the full `Condition` type from `lib/conditions.ts`, including `and`, `or`, and `not`.

### Rules

- `$key` references must match a `dataKey` of another field on the **same screen** — `validateExperiment` reports an `invalid-reference` error if not.
- `$$key` (experiment-level data) is not supported in `crossValidation` conditions — use `BranchNode` or `ConditionalComponent` for flow-level conditions.
- If a field is inside a `ConditionalComponent` whose condition is false, its `crossValidation` rules are skipped.
- All failing rules add errors independently (not first-failure-only).
- A field may have both `required: true` and `crossValidation` — both are enforced.
