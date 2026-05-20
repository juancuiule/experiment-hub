# Score Variables

key files (proposed): `lib/nodes.ts`, `lib/flow.ts`, `lib/flow-validation.ts`

Score variables let researchers compute derived values from collected data at a specific point in the flow and store the result under a new `$$`-referenceable key. This makes branching on aggregated psychometric scores, percentage cutoffs, or composite classifications possible without custom code.

## The `compute` node

A `compute` node is a non-interactive graph node — like `branch` or `fork`, it auto-traverses without waiting for participant input. It reads from `$$` references, applies a formula, and writes the result into `context.data` under an `outputKey`.

```ts
export interface ComputeNode extends BaseNode {
  type: "compute";
  props: {
    name: string;
    description?: string;
    computations: Computation[];
  };
}
```

Each computation produces one output value:

```ts
export type Computation = {
  outputKey: string; // written to context.data[outputKey]
  formula: Formula;
};
```

### Edges

A `compute` node has exactly one outgoing `sequential` edge (same rule as `screen` and `checkpoint`). The static validator enforces this.

---

## Formula DSL

Formulas are a typed union, not arbitrary expressions. This keeps them statically validatable and serializable.

```ts
export type Formula =
  | SumFormula
  | MeanFormula
  | MinFormula
  | MaxFormula
  | CountFormula
  | ConditionalFormula
  | LookupFormula;
```

### `sum`

Adds a list of numeric `$$` references.

```ts
type SumFormula = {
  type: "sum";
  inputs: `$$${string}`[];
};
```

```ts
// PHQ-9 total score
{ type: "sum", inputs: ["$$q1.rating", "$$q2.rating", "$$q3.rating", "$$q4.rating", "$$q5.rating", "$$q6.rating", "$$q7.rating", "$$q8.rating", "$$q9.rating"] }
```

### `mean`

Arithmetic mean of a list of numeric `$$` references.

```ts
type MeanFormula = {
  type: "mean";
  inputs: `$$${string}`[];
};
```

### `min` / `max`

Minimum or maximum across a list of numeric `$$` references.

```ts
type MinFormula = { type: "min"; inputs: `$$${string}`[] };
type MaxFormula = { type: "max"; inputs: `$$${string}`[] };
```

### `count`

Counts how many of the listed `$$` references satisfy an optional condition. Without a condition, counts how many are non-null/non-empty. Useful for "how many symptoms endorsed?" patterns.

```ts
type CountFormula = {
  type: "count";
  inputs: `$$${string}`[];
  where?: Condition; // condition evaluated per input — use "@current" as a special ref
};
```

```ts
// Count how many Likert responses are >= 3
{ type: "count", inputs: ["$$q1.rating", "$$q2.rating", "$$q3.rating"], where: { type: "simple", operator: "gte", dataKey: "@current", value: 3 } }
```

### `conditional`

Evaluates a `Condition` and resolves to one of two scalar values. The condition runs against `context` at the point the node is traversed, so previously computed `outputKey`s within the same `compute` node are available if they appear earlier in the `computations` array.

```ts
type ConditionalFormula = {
  type: "conditional";
  condition: Condition;
  then: string | number | boolean;
  else: string | number | boolean;
};
```

```ts
// Classify severity after summing
{
  outputKey: "severity",
  formula: {
    type: "conditional",
    condition: { type: "simple", operator: "gte", dataKey: "$$scores.phq9Total", value: 15 },
    then: "severe",
    else: "moderate",
  }
}
```

### `lookup`

Maps a `$$` reference value against a lookup table and returns the corresponding output value. Useful for norm-referenced scoring (raw score → percentile, grade → risk tier).

```ts
type LookupFormula = {
  type: "lookup";
  input: `$$${string}`;
  table: Array<{ when: string | number; then: string | number }>;
  default?: string | number; // returned when no entry matches
};
```

```ts
{
  type: "lookup",
  input: "$$scores.phq9Total",
  table: [
    { when: 0,  then: "none" },
    { when: 5,  then: "mild" },
    { when: 10, then: "moderate" },
    { when: 15, then: "moderately-severe" },
    { when: 20, then: "severe" },
  ],
  default: "unknown",
}
```

The lookup matches the first entry whose `when` value is ≤ the input (i.e. floor match), consistent with how clinical cutoffs are applied.

---

## Context storage

Computations write into `context.data` using the same nesting logic as screen data. A `compute` node at the top level writes to `context.data[outputKey]`. Inside a path `"path-a"`, it writes to `context.data["path-a"][outputKey]`, referenced as `$$path-a.outputKey`.

Computations within a single node are evaluated in array order. Later computations can reference the `outputKey` of earlier ones via `$$`.

---

## Full example

```ts
// PHQ-9 scoring
{
  id: "score-phq9",
  type: "compute",
  props: {
    name: "PHQ-9 scoring",
    computations: [
      {
        outputKey: "phq9Total",
        formula: {
          type: "sum",
          inputs: [
            "$$phq.q1", "$$phq.q2", "$$phq.q3", "$$phq.q4",
            "$$phq.q5", "$$phq.q6", "$$phq.q7", "$$phq.q8", "$$phq.q9",
          ],
        },
      },
      {
        outputKey: "phq9Severity",
        formula: {
          type: "lookup",
          input: "$$phq9Total",
          table: [
            { when: 0,  then: "none" },
            { when: 5,  then: "mild" },
            { when: 10, then: "moderate" },
            { when: 15, then: "moderately-severe" },
            { when: 20, then: "severe" },
          ],
        },
      },
    ],
  },
}

// Edge out
{ type: "sequential", from: "score-phq9", to: "branch-severity" }

// Branch on computed value
{
  id: "branch-severity",
  type: "branch",
  props: {
    name: "Severity routing",
    branches: [
      {
        id: "high-risk",
        name: "Moderately severe or severe",
        config: {
          type: "or",
          conditions: [
            { type: "simple", operator: "eq", dataKey: "$$phq9Severity", value: "moderately-severe" },
            { type: "simple", operator: "eq", dataKey: "$$phq9Severity", value: "severe" },
          ],
        },
      },
    ],
  },
}
```

---

## Static validation

The flow validator (`lib/flow-validation.ts`) would extend its reference-tracking walk to handle `compute` nodes:

- All `$$` references in `inputs` and `condition.dataKey` fields must be in the available set at the node's position in the graph. **Code:** `unavailable-reference`.
- `outputKey`s produced by the node are added to the available set for all downstream nodes.
- Within a single `compute` node, each `outputKey` is added to the available set immediately after its computation, so later computations in the same array can reference earlier ones.
- A `compute` node must have exactly one outgoing `sequential` edge. **Code:** `missing-edge` / `ambiguous-edge`.
- `lookup` table `when` values should be unique within a table. **Code:** (new) `duplicate-lookup-key`.

---

## What this does not cover

- **Expressions over dynamic arrays** — e.g. "sum all ratings collected inside a loop". This requires iterating over `context.loops[loopId].order` and aggregating loop-keyed data. A `reduce` formula type could handle this but adds significant complexity and is left for a future iteration.
- **Writing back into existing screen data** — `outputKey` always creates a new top-level (or path-scoped) key. It cannot patch a previously submitted screen's data.
- **Reactive recomputation** — scores are computed once when the node is traversed. If a participant could go back and change earlier answers (back navigation), `compute` nodes would need to be re-evaluated. This is a dependency on the back-navigation feature.
