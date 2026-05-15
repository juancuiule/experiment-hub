# Randomize Options Implementation

> **Status:** Draft
> **Author:** —
> **Created:** 2026-03-12
> **Last updated:** 2026-03-12
> **Linked issue:** —

---

## 1. Summary

Implement the `randomize: true` prop on `radio`, `dropdown`, and `checkboxes` response components. The types and documentation already define this prop, but the render components do not shuffle options and do not record the presented order alongside the collected value.

---

## 2. Problem Statement

**Current state:** `RadioComponent`, `DropdownComponent`, and `CheckboxesComponent` all have `randomize?: boolean` in their TypeScript types (`lib/components/response.ts`) and the feature is documented in `docs/components.md`. However, none of the corresponding React components (`src/components/response/Radio.tsx`, `Dropdown.tsx`, `Checkboxes.tsx`) implement any shuffle logic. Setting `randomize: true` on any of these components has no effect — options are always rendered in their original declaration order.

Additionally, the docs state: *"The presented order is saved alongside the collected value"*. There is currently no mechanism to record the order in which options were shown to a participant.

**Desired state:** When `randomize: true` is set, options are shuffled once when the component mounts. The shuffled order is stable for the lifetime of that screen render (re-renders do not re-shuffle). The presented order is recorded in the submitted data alongside the collected value so that researchers can account for order effects in their analysis.

**Impact:** Any experiment that relies on `randomize: true` to control for option-order bias is currently broken silently. Researchers may not notice because there is no error or warning — options just always appear in the same order.

---

## 3. User Story

> As a **researcher authoring an experiment**,
> I want **response options to be shuffled when `randomize: true` is set**,
> so that **order effects are controlled across participants and the presented order is available for analysis**.

### Scenario A – Randomized radio buttons

A screen asks participants to rank their preferred learning style from a list of 5 options. Setting `randomize: true` on the `radio` component ensures each participant sees the options in a different order, preventing first-option bias.

### Scenario B – Order recorded for analysis

After the experiment, the researcher wants to check whether option order influenced selections. The submitted data includes both the selected value and the order in which options were presented.

### Scenario C – Stable order within a session

A participant goes back and forth within a path. The option order should remain the same throughout that path so the participant is not confused by options moving around.

---

## 4. Acceptance Criteria

- [ ] When `randomize: true` is set on a `radio`, `dropdown`, or `checkboxes` component, options are shuffled when the component mounts.
- [ ] The shuffle uses the existing `lib/utils.ts:shuffle` utility.
- [ ] The shuffled order is computed once on mount and does not change on re-renders.
- [ ] The submitted value for `radio`, `dropdown`, and `checkboxes` is always a nested object `{ value: selectedValue }` — never a plain scalar.
- [ ] When `randomize: true`, an additional `order: string[]` field is included: `{ value: selectedValue, order: string[] }`. When `randomize` is false or omitted, the object contains only `value`.
- [ ] This consistent shape means callers never need to branch on value type when reading results.
- [ ] `buildSchema` validates the `value` sub-key of the nested object; the `order` sub-key is metadata and not validated.
- [ ] The feature is covered by unit tests.

---

## 5. UI / UX

### 5.1 Entry Point

Config-level: the researcher sets `randomize: true` in the component definition. No change to the participant-facing UI except the order of options.

### 5.2 Interaction Flow

1. Screen renders.
2. On mount, if `randomize: true`, options are shuffled once.
3. Participant selects an option (or options, for checkboxes).
4. Participant clicks next.
5. Submitted data includes: the selected value(s) under `dataKey`, and the presented option order under `[dataKey]__order`.

### 5.3 States

| State | Description |
|---|---|
| `randomize: false` / omitted | Options render in declaration order; no `__order` key written. |
| `randomize: true` | Options render in a shuffled order; `[dataKey]__order` is written with the shuffled sequence. |

### 5.4 Copy

No participant-facing copy changes.

### 5.5 Figma Reference

- [ ] N/A — visual appearance is identical to today.

---

## 6. Technical Notes

### 6.1 Affected Areas

- `src/components/response/Radio.tsx` — add shuffle logic on mount
- `src/components/response/Dropdown.tsx` — add shuffle logic on mount
- `src/components/response/Checkboxes.tsx` — add shuffle logic on mount
- `src/Screen.tsx` — `buildDefaultValues` needs to add a default for `[dataKey]__order` (empty array `[]`) when `randomize: true`, so the key is registered with `react-hook-form`
- `lib/validation.ts` — `buildSchema` must skip `[dataKey]__order` entries (or ignore unknown keys — check current `zod` schema `strip` vs `strict` setting)
- `lib/specs/validation.test.ts` — confirm `__order` keys don't cause schema failures

### 6.2 Data / State

**Shuffle on mount:**

```tsx
const [displayedOptions, setDisplayedOptions] = useState(() =>
  component.props.randomize ? shuffle([...component.props.options]) : component.props.options
);
```

`useState` initializer runs once on mount. Using `shuffle([...options])` (copy to avoid mutating the config) ensures a new random order per mount.

**Recording the order:**

The field's submitted value is always `{ value: selectedValue }`. When `randomize: true`, `order` is added. The `order` array is set once on mount via `form.setValue`:

```tsx
// Always initialise with a { value } wrapper
useEffect(() => {
  const current = form.getValues(dataKey);
  const base = { value: current?.value ?? undefined };
  form.setValue(dataKey, component.props.randomize
    ? { ...base, order: displayedOptions.map(o => o.value) }
    : base
  );
}, [displayedOptions]);
```

Downstream consumers (branch conditions, score variables) always reference `$$screen.dataKey.value` — the shape is consistent regardless of whether `randomize` is set.

### 6.3 Validation

No new `validateExperiment` checks. The `__order` field is internal metadata — it should not be subject to the `$$` reference availability walk in `checkReferences`.

The `checkReferences` function in `lib/validate.ts` walks branch condition `dataKey`s and component label text. Neither of those would reference `__order` keys directly. However, if the static analysis for `$$` references is extended in the future, it should explicitly ignore keys ending in `__order`.

### 6.4 Constraints & Risks

- `shuffle` in `lib/utils.ts` uses `Math.random()`. If the experiment is using deterministic randomization (a separate proposed feature based on deleted `proposals/PROPOSAL-deterministic-randomization.md`), this shuffle should use the same seeded random function. Consider accepting an optional seed parameter in `shuffle`.
- `useState` initializer order: the shuffle is computed client-side. If the component is server-rendered (Next.js SSR), the server and client will produce different orders, causing a hydration mismatch. The component should use `useEffect` + local state or mark the shuffle as client-only (e.g., via `useState` with `null` initial value and a `useEffect` to set the shuffled order). Given the app is an interactive experiment runner, this is likely already client-only, but confirm.
- The `__order` key must be excluded from data validation and from `$$` reference availability tracking in `validateExperiment`.

---

## 7. Test Plan

### 7.1 Unit Tests

- [ ] `Radio` with `randomize: true`: rendered options are a permutation of the original options.
- [ ] `Radio` with `randomize: true`: re-rendering the same component does not produce a new shuffle (stable within a mount).
- [ ] `Radio` with `randomize: false`: options are in the original declaration order.
- [ ] `Dropdown` and `Checkboxes` — same three tests as above.
- [ ] Submitted data includes `[dataKey]__order` array when `randomize: true`.
- [ ] Submitted data does not include `[dataKey]__order` when `randomize: false`.
- [ ] `buildSchema` does not emit a validation error for `[dataKey]__order`.

### 7.2 Integration / Flow Tests

- [ ] Screen with a randomized `radio` — participant selects an option, submits — `context.data` contains both the selected value and the `__order` array.

### 7.3 Manual / QA Checks

- [ ] Run the experiment multiple times in different browser tabs and verify that options appear in different orders.
- [ ] Navigate away from and back to a screen within a path — confirm options do not re-shuffle.

---

## 8. Out of Scope

- Seeded / deterministic randomization (consistent order per participant across sessions) — addressed by the separate deterministic randomization proposal.
- Randomization of `likert-scale` options — the scale order is semantically meaningful and should not be shuffled.
- Saving the presented order for non-randomized components.

---

## 9. Open Questions

| # | Question | Owner | Resolution |
|---|---|---|---|
| 1 | Should the order metadata be documented in `docs/components.md` so researchers know about the `{ value, order }` shape? | — | **Resolved:** Yes — document the consistent `{ value }` wrapper shape. Since the shape is always `{ value }` (with optional `order`), researchers always reference `$$screen.dataKey.value` regardless of `randomize`. |
| 2 | Should the shuffle be stable across a full session (e.g. if a path loops back to the same screen twice), or should it re-shuffle on each mount? | — | Open — proposed: re-shuffle on each mount. Same-screen revisits within a path are rare and the `__order` key captures the order each time. |
| 3 | Is the `__order` key naming convention acceptable, or should it use a nested object (e.g. `{ value: "...", order: [...] }`)? A nested object would change the data shape. | — | **Resolved:** Always use a nested `{ value }` wrapper (with or without `randomize`). When `randomize: true`, `order` is added. This keeps the type consistent — callers always read `$$screen.dataKey.value` and never branch on value type. |

---

## 10. Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-12 | — | Initial draft |
