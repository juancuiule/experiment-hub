# Score Variables

> **Status:** Draft
> **Author:** —
> **Created:** 2026-03-12
> **Last updated:** 2026-03-12
> **Linked issue:** —

---

## 1. Summary

Introduce a `score` node type that computes named derived variables (aggregations, arithmetic) over collected response data, writes them into `context.scores`, and makes them available to branch conditions and answer piping — without introducing a general expression language.

---

## 2. Problem Statement

**Current state:** `context.data` stores only raw submitted form values. There is no concept of a derived or computed variable. Branch conditions (`lib/conditions.ts`) can only compare a single stored value against a constant. `evaluateBaseOperator` computes `a op b` where `b` is always a literal from the config — it is never another collected value or an expression.

**Desired state:** Researchers can declare named score variables in the experiment config. Each score is computed from a set of `$$` data paths using an aggregation function (e.g. `sum`, `mean`, `min`, `max`, `count`). Scores are computed at a `score` node and become available for branch conditions and label interpolation downstream.

**Impact:** Experiments that use composite scales (e.g. anxiety scores from 5 items, cognitive load from 3 sliders) cannot branch on their results today. Researchers must post-process data to compute scores, which prevents real-time adaptive routing.

---

## 3. User Story

> As a **researcher building an adaptive experiment**,
> I want to **compute a composite score from multiple responses and branch on it**,
> so that **participants receive follow-up questions or interventions tailored to their score**.

### Scenario A – Clinical anxiety screener

Five `slider` components each capture a GAD-7 item (0–3). After the section, a `score` node computes `totalAnxiety = sum($$gad.q1, $$gad.q2, ..., $$gad.q5)`. A `branch` node then routes participants with `$$scores.totalAnxiety >= 10` to a clinical referral screen.

### Scenario B – Cognitive load index

Three `likert-scale` items capture NASA-TLX subscales. A `score` node computes `cognitiveLoad = mean($$tlx.mental, $$tlx.temporal, $$tlx.effort)`. A subsequent screen pipes the score into its label: `"Your cognitive load index was $$scores.cognitiveLoad."`.

### Scenario C – Completion counter

A `for-each` loop generates 10 binary yes/no questions. A `score` node computes `endorsedCount = count($$endorsements.*, true)` — the number of items where the participant answered "yes". A branch routes participants who endorsed 3 or more to an extended questionnaire.

---

## 4. Acceptance Criteria

- [ ] A new node type `score` is added to `lib/nodes.ts` with an auto-traverse behavior (no participant interaction).
- [ ] `ScoreNode.props.variables` is an array of `ScoreVariable` definitions (see Technical Notes).
- [ ] Each `ScoreVariable` has: `name: string`, `operator: ScoreOperator`, `sources: string[]` (array of `$$`-prefixed data paths).
- [ ] Supported `ScoreOperator` values: `sum`, `mean`, `min`, `max`, `count`.
- [ ] For `count`, an additional `value` field specifies what value to count (e.g. count how many sources equal `"yes"`).
- [ ] Computed scores are written into `context.scores: Record<string, number>`.
- [ ] Scores are accessible in branch conditions via `$$scores.variableName`.
- [ ] Scores are accessible in answer piping (label interpolation) via `$$scores.variableName`.
- [ ] `validateExperiment` validates that each `source` in a `ScoreVariable` resolves to a `dataKey` that is guaranteed to be available before the `score` node in the flow walk.
- [ ] `validateExperiment` emits `unavailable-reference` if a score source references data not yet collected.
- [ ] Unit tests cover all operators, missing source values (treated as 0 / excluded), and branch conditions on scores.

---

## 5. UI / UX

No participant-facing UI. The `score` node is auto-traversed transparently.

---

## 6. Technical Notes

### 6.1 Affected Areas

- `lib/nodes.ts` — add `ScoreNode` type with `props.variables: ScoreVariable[]`
- `lib/types.ts` — add `scores?: Record<string, number>` to `Context`; add `ScoreVariable` and `ScoreOperator` types
- `lib/flow.ts` — add `score` case in `traverseInNode()`: evaluate each variable, write to `context.scores`, advance via sequential edge
- `lib/validate.ts` — extend `checkReferences` to walk score node sources as `$$` references
- `lib/conditions.ts:68` — extend `getValue()` to handle `$$scores.*` paths (already works if `context.scores` is populated and `getValue` walks `context.data` — but `scores` lives at the top-level `context`, not in `context.data`, so the resolver needs updating)
- `lib/resolve.ts` — `resolveValuesInString` should resolve `$$scores.variableName` (same update as above)

### 6.2 Data / State

**`ScoreVariable` type:**

```ts
type ScoreOperator = "sum" | "mean" | "min" | "max" | "count";

type ScoreVariable = {
  name: string;
  operator: ScoreOperator;
  sources: `$$${string}`[];
  // for "count" only: the value to count occurrences of
  value?: string | number | boolean;
};
```

**Evaluation:**

```ts
function evaluateScore(variable: ScoreVariable, context: Context): number {
  const values = variable.sources
    .map(src => getValue(src, context))
    .filter(v => v !== undefined);

  switch (variable.operator) {
    case "sum":  return values.reduce((a, b) => a + Number(b), 0);
    case "mean": return values.length ? values.reduce((a, b) => a + Number(b), 0) / values.length : 0;
    case "min":  return Math.min(...values.map(Number));
    case "max":  return Math.max(...values.map(Number));
    case "count": return values.filter(v => v == variable.value).length;
  }
}
```

**`getValue` extension:** `context.scores` lives at the root of `Context`, separate from `context.data`. The `$$` resolver in `getValue` currently walks `context.data`. It should be updated to first check `context.scores` for paths matching `$$scores.*`, and fall back to `context.data` for all other `$$` paths.

### 6.3 Validation

| Rule | Error code | Severity |
|---|---|---|
| A `ScoreVariable.source` references a `$$` path not guaranteed to be collected before the `score` node | `unavailable-reference` | Error |
| A branch condition references `$$scores.name` where `name` is not defined in any upstream `score` node | `unavailable-reference` | Error |

### 6.4 Constraints & Risks

- `mean` with zero available sources returns `0` rather than `NaN`. This is a deliberate choice to avoid propagating `NaN` into branch conditions.
- `min`/`max` with zero values return `Infinity`/`-Infinity`. A guard should clamp to `0` or emit a warning if the source list is empty.
- `count` uses loose equality (`==`) consistent with the rest of the condition system. A `count("yes")` will also match the number `0` if coerced — document this clearly.
- Score variables are computed once at the `score` node and not recomputed if earlier data changes (e.g. after back navigation). If back navigation is enabled, a `score` node should only be in history at a position where all its sources are already collected — the flow structure enforces this naturally since the `score` node is downstream of its data sources.

---

## 7. Test Plan

### 7.1 Unit Tests

- [ ] `evaluateScore` with `sum` over 3 numeric sliders returns their sum.
- [ ] `evaluateScore` with `mean` over 5 sliders returns the correct average.
- [ ] `evaluateScore` with `count` and `value: "yes"` over 10 radio responses returns the correct count.
- [ ] `evaluateScore` with missing source (undefined) — excluded from calculation, not treated as 0.
- [ ] `validateExperiment` emits `unavailable-reference` when a score source is not collected upstream.
- [ ] Branch condition `$$scores.totalAnxiety >= 10` evaluates correctly after a score node.

### 7.2 Integration / Flow Tests

- [ ] Flow: 5 slider screens → score node → branch on `$$scores.total` — routing is correct for both branches.
- [ ] Score value is included in `send()` payload inside `context.scores`.

### 7.3 Manual / QA Checks

- [ ] Complete 5 slider screens, verify `context.scores` in the debug panel shows the computed value.
- [ ] Branch routing based on score value is confirmed correct for threshold cases.

---

## 8. Out of Scope

- General arithmetic expressions (e.g. `(a + b) * c / d`).
- String operations (concatenation, substring).
- Conditional scoring (score different values based on selected option — use a separate lookup table approach).
- Per-item scoring with a lookup map (e.g. Likert reverse-scoring) — this would require a `map` source transform, deferred to a follow-up.

---

## 9. Open Questions

| # | Question | Owner | Resolution |
|---|---|---|---|
| 1 | Should scores be re-evaluated automatically when the participant goes back and changes a source value? | — | **Resolved:** Yes — when the participant re-traverses the score node after back navigation, the score is recomputed with the current source values. |
| 2 | Should `$$scores.*` be in the always-available set for `validateExperiment`, or should the reference walker track which score names are defined at each point? | — | Proposed: track per-score-node, consistent with how `$$` data paths are tracked. |
| 3 | Should scores be writable via a `setScore` mechanism (manually overriding a computed value)? | — | Out of scope. |

---

## 10. Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-12 | — | Initial draft |
