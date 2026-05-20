# Cross-Field Validation

key files (proposed): `lib/screen.ts`, `lib/field-schema.ts`, `lib/components/response.ts`, `src/Screen.tsx`

Cross-field validation is the family of constraints that can't be expressed per-field because their truth value depends on the value of at least one other field on the same screen. The current validation model builds a Zod schema independently per field; cross-field rules require a `z.superRefine()` or `z.refine()` applied to the whole form object.

## Where the rules live

Cross-field rules are declared in a `validate` array on the screen definition, separate from the component tree:

```ts
// lib/screen.ts
export type FrameworkScreen = {
  slug: string;
  components: ScreenComponent[];
  validate?: CrossFieldRule[];
};
```

This placement has three advantages:
- Rules are explicit about being cross-field — they don't hide inside component props.
- The static validator can verify that every `$field` reference in a rule corresponds to a `dataKey` that exists on the screen.
- The Zod integration is straightforward: after building the per-field schema with `buildSchema`, apply each rule as an additional `.superRefine()` pass.

### Field references

Rule fields accept two reference styles, consistent with the `FormulaInput` convention used in compute nodes:

| Prefix | Source | Example |
|---|---|---|
| `$field` | Current screen's submitted form values | `$housing` |
| `$$screen.field` | Previously collected data in `context.data` | `$$demographics.email` |

`$$`-prefixed references resolve from `context.data` (the experiment-wide accumulated data store). This enables cross-screen validation — rules that assert relationships between the current screen and data collected on earlier screens.

### Error display

Cross-field errors don't naturally belong to a single field. Each rule has an optional `attachTo: "$dataKey"` prop. When present the error is shown adjacent to that field (same mechanism as per-field errors). When absent a screen-level error zone at the top of the form renders the message. Both cases use the same `errorMessage` string.

---

## Rule catalogue

### `sum-equals` / `sum-between`

Asserts that a set of numeric fields sum to a fixed total or fall within a range. The canonical use case is allocation tasks: distribute a budget, assign 100 points, split percentages.

```ts
type SumEqualsRule = {
  type: "sum-equals";
  fields: (`$${string}` | `$$${string}`)[];
  target: number;
  errorMessage?: string;
  attachTo?: `$${string}`;
};

type SumBetweenRule = {
  type: "sum-between";
  fields: (`$${string}` | `$$${string}`)[];
  min?: number;
  max?: number;
  errorMessage?: string;
  attachTo?: `$${string}`;
};
```

```ts
// Budget allocation — three sliders must total 100
{
  type: "sum-equals",
  fields: ["$housing", "$food", "$transport"],
  target: 100,
  errorMessage: "Allocations must sum to 100%",
  attachTo: "$transport",
}
```

---

### `at-least-one`

One or more fields from a set must be non-empty (non-null, non-empty string, non-empty array). Neither field is individually required — the constraint is symmetric across the group.

```ts
type AtLeastOneRule = {
  type: "at-least-one";
  fields: (`$${string}` | `$$${string}`)[];
  errorMessage?: string;
  attachTo?: `$${string}`;
};
```

```ts
// Contact — phone OR email, at least one required
{
  type: "at-least-one",
  fields: ["$phone", "$email"],
  errorMessage: "Please provide at least one contact method",
}
```

---

### `count-between`

Between `min` and `max` fields (inclusive) from a set must be non-empty. Generalises `at-least-one` (min=1, no max) and `exactly-n` (min=max=n). Useful when the researcher wants participants to select a flexible range of options expressed as individual fields rather than a checkboxes component.

```ts
type CountBetweenRule = {
  type: "count-between";
  fields: (`$${string}` | `$$${string}`)[];
  min?: number;
  max?: number;
  errorMessage?: string;
  attachTo?: `$${string}`;
};
```

```ts
// Select between 2 and 4 priorities from 6 individual checkbox fields
{
  type: "count-between",
  fields: ["$p-a", "$p-b", "$p-c", "$p-d", "$p-e", "$p-f"],
  min: 2,
  max: 4,
  errorMessage: "Select between 2 and 4 priorities",
}
```

---

### `exactly-n`

Exactly N fields from a set must be non-empty. Useful when the researcher wants participants to prioritise a fixed number of items expressed as individual boolean or text fields rather than a checkboxes component.

```ts
type ExactlyNRule = {
  type: "exactly-n";
  fields: (`$${string}` | `$$${string}`)[];
  n: number;
  errorMessage?: string;
  attachTo?: `$${string}`;
};
```

```ts
// Choose exactly 3 priorities from 6 individual checkbox fields
{
  type: "exactly-n",
  fields: ["$priority-a", "$priority-b", "$priority-c", "$priority-d", "$priority-e", "$priority-f"],
  n: 3,
  errorMessage: "Select exactly 3 priorities",
}
```

---

### `mutually-exclusive`

At most one field in a set may be non-empty/checked. The canonical case is a "None of the above" checkbox in a group — if it is selected, no other option may be. This constraint is impossible to express per-field because each option would need to inspect all siblings.

```ts
type MutuallyExclusiveRule = {
  type: "mutually-exclusive";
  fields: (`$${string}` | `$$${string}`)[];
  errorMessage?: string;
  attachTo?: `$${string}`;
};
```

```ts
// "None of the above" exclusion
{
  type: "mutually-exclusive",
  fields: ["$symptom-fatigue", "$symptom-pain", "$symptom-none"],
  errorMessage: "'None of the above' cannot be combined with other selections",
  attachTo: "$symptom-none",
}
```

---

### `all-or-none`

Either all fields in the set must be non-empty, or none of them may be. This is the structured optional group: a participant can skip the entire block or fill it completely, but partial completion is invalid.

```ts
type AllOrNoneRule = {
  type: "all-or-none";
  fields: (`$${string}` | `$$${string}`)[];
  errorMessage?: string;
  attachTo?: `$${string}`;
};
```

```ts
// Secondary contact details — either fill all three or leave all three blank
{
  type: "all-or-none",
  fields: ["$alt-name", "$alt-phone", "$alt-email"],
  errorMessage: "Please fill in all secondary contact details or leave them all blank",
}
```

---

### `matches`

Two field references must resolve to equal values (deep equality for arrays, strict equality for scalars). The primary use case is a same-screen confirmation field (`$email` and `$confirmEmail`), but `$$`-prefixes make it equally useful for cross-screen consistency checks: re-asking a question and verifying the answer is consistent with what was collected earlier.

```ts
type MatchesRule = {
  type: "matches";
  a: `$${string}` | `$$${string}`;
  b: `$${string}` | `$$${string}`;
  errorMessage?: string;
  attachTo?: `$${string}`;
};
```

```ts
// Same-screen: confirm email matches the email field
{
  type: "matches",
  a: "$email",
  b: "$confirmEmail",
  errorMessage: "Email addresses do not match",
  attachTo: "$confirmEmail",
}

// Cross-screen: re-asked question must match the original answer
{
  type: "matches",
  a: "$$intake.email",
  b: "$emailConfirm",
  errorMessage: "This email doesn't match what you entered earlier",
  attachTo: "$emailConfirm",
}
```

---

### `ordered`

One field's value must be strictly less than (or less-than-or-equal to) another's. Covers date ranges, age bounds, numeric interval endpoints — any case where two separate fields form a pair that must be ordered.

The existing `minValue`/`maxValue` props on `slider` and `numeric-input` accept static literals only. `ordered` fills the gap when the bound is itself a collected value on the same screen — or, with `$$` references, a value from an earlier screen.

```ts
type OrderedRule = {
  type: "ordered";
  a: `$${string}` | `$$${string}`;
  b: `$${string}` | `$$${string}`;
  operator: "lt" | "lte"; // a [op] b must hold
  errorMessage?: string;
  attachTo?: `$${string}`;
};
```

```ts
// End date must be after start date
{
  type: "ordered",
  a: "$startDate",
  b: "$endDate",
  operator: "lt",
  errorMessage: "End date must be after start date",
  attachTo: "$endDate",
}

// Cross-screen: current estimate must be at least as large as the baseline
{
  type: "ordered",
  a: "$$baseline.estimate",
  b: "$currentEstimate",
  operator: "lte",
  errorMessage: "Your estimate must be at least as high as your baseline",
  attachTo: "$currentEstimate",
}
```

---

### `conditional-range`

A numeric field's valid range depends on the value of another field on the same screen. Extends the static `minValue`/`maxValue` per-field props to accept `$` references as dynamic bounds.

```ts
type ConditionalRangeRule = {
  type: "conditional-range";
  field: `$${string}` | `$$${string}`;
  condition: Condition; // evaluated against $-prefixed live screen values and $$-prefixed context.data
  min?: number;
  max?: number;
  errorMessage?: string;
  attachTo?: `$${string}`;
};
```

```ts
// Drinks-per-week only meaningful (and bounded) if participant drinks
{
  type: "conditional-range",
  field: "$drinksPerWeek",
  condition: { type: "simple", operator: "eq", dataKey: "$drinksAlcohol", value: true },
  min: 1,
  max: 50,
  errorMessage: "Please enter a value between 1 and 50",
  attachTo: "$drinksPerWeek",
}
```

---

### `unique-across-foreach`

Inside a `for-each` component, each iteration renders the same template with a dynamic `dataKey` like `"rank-{{#fe.value}}"`. When that component is a dropdown or radio used for ranking, participants may accidentally (or deliberately) assign the same rank to multiple items. This rule asserts that the collected values across all dynamically-keyed fields are distinct.

The field set is not statically known — it is determined at runtime by the for-each iteration values — so this rule takes a `pattern` instead of an explicit `fields` array.

```ts
type UniqueAcrossForeachRule = {
  type: "unique-across-foreach";
  foreachId: string;           // the `id` of the for-each component
  dataKeyPattern: string;      // the dataKey template, e.g. "rank-{{#fe.value}}"
  errorMessage?: string;
};
```

```ts
// Ranking — each item must get a unique rank
{
  type: "unique-across-foreach",
  foreachId: "fe",
  dataKeyPattern: "rank-{{#fe.value}}",
  errorMessage: "Each item must be assigned a unique rank",
}
```

Because the field set is dynamic, this rule cannot be validated statically against the component tree. The runtime implementation iterates over `context.screenData.foreachData` to build the actual key list, then checks for duplicates.

---

## Implementation sketch

### Type definitions

All rule types share a common base:

```ts
type CrossFieldRuleBase = {
  errorMessage?: string;
  attachTo?: `$${string}`;
};
```

Field references use the same two-prefix convention as `FormulaInput` in compute nodes:

```ts
type FieldRef = `$${string}` | `$$${string}`;
```

`$field` — read from the current screen's submitted form data (`data` argument to `superRefine`).
`$$screen.field` — read from `context.data` (experiment-wide accumulated data). This is what enables cross-screen rules.

### Value resolution

A pure helper `resolveFieldRef(ref, formData, contextData)` handles both prefixes:

```ts
function resolveFieldRef(
  ref: string,
  formData: Record<string, unknown>,
  contextData: Record<string, any>,
): unknown {
  if (ref.startsWith('$$')) {
    return getValue(ref.slice(2), contextData); // dotted-path lookup in context.data
  }
  return formData[ref.slice(1)]; // strip leading $, look up in form
}
```

### Schema integration

`buildSchema` in `lib/screen-validation.ts` chains cross-field rules after the per-field object is built:

```ts
export function buildSchema(screen: FrameworkScreen, context: Context) {
  let schema = buildSchemaFromDescriptors(
    collectDescriptors(screen.components, context, null),
    context,
  );

  for (const rule of screen.validate ?? []) {
    schema = schema.superRefine((data, ctx) => {
      const error = evaluateCrossFieldRule(rule, data, context.data ?? {});
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error.message,
          path: error.attachTo ? [error.attachTo] : [],
        });
      }
    }) as typeof schema;
  }

  return schema;
}
```

Each rule maps to a pure `evaluateCrossFieldRule(rule, formData, contextData)` that returns `null` (valid) or `{ message: string; attachTo?: string }`.

### Static validation

The flow validator walks each screen's `validate` array and checks:

- Every `$field` reference exists as a `dataKey` on a response component on that screen. **Code:** `invalid-cross-field-reference`.
- Every `$$screen.field` reference is available at the screen's position in the graph (same forward-walk that already checks `$$` in labels and conditions). **Code:** `unavailable-reference`.
- `unique-across-foreach` rules reference a `foreachId` that exists on the screen. **Code:** `invalid-cross-field-reference`.
- `ordered` / `conditional-range` rules reference numeric or date field types only. **Code:** `incompatible-cross-field-type`.

### Timing

Cross-field rules are evaluated on form submission only (same as per-field rules). They are not re-evaluated on each keystroke. Rules with `attachTo` surface their errors adjacent to the named field; rules without it require a screen-level error display zone rendered above the component list in `Screen.tsx`.

---

## What this does not cover

**Async validation** — checking uniqueness against a backend (e.g. "username not already taken"). Out of scope; the validation pipeline is synchronous.

**Cascading rules** — rule A's error state affecting whether rule B is evaluated. Not needed for any of the patterns above; each rule is independent.
