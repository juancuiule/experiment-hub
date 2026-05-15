# Nested Component Schema Inclusion

> **Status:** Draft
> **Author:** —
> **Created:** 2026-03-12
> **Last updated:** 2026-03-12
> **Linked issue:** —

---

## 1. Summary

Make `buildSchema` and `buildDefaultValues` recursively traverse `GroupComponent`, `ConditionalComponent`, and `ForEachComponent` so that response components nested inside these containers are included in the zod validation schema and have correct default values registered in `react-hook-form`.

---

## 2. Problem Statement

**Current state:** `buildSchema` in `lib/validation.ts` iterates only over the top-level `screen.components` array. Response components nested inside `GroupComponent.props.components`, `ConditionalComponent.props.component`, or `ForEachComponent.props.component` are silently excluded from the schema. This means:

1. Their `required` rules, `minLength`, `pattern`, and any other validation constraints are **never enforced** — the participant can submit the screen without filling them in.
2. `buildDefaultValues` in `Screen.tsx` has the same shallow scan, so nested response components have no entry in `react-hook-form`'s `defaultValues`. This causes React to warn about switching between uncontrolled and controlled inputs, and may cause stale/undefined values to be submitted.
3. Data submitted by nested response components is collected (via `form.register` in the leaf component), but the schema never validates it, creating an inconsistency between what is displayed and what is enforced.

**Desired state:** Every response component on a screen, regardless of nesting depth, is included in the zod schema with its correct validation rules and in `defaultValues` with its correct initial value.

**Impact:** Any screen that uses `GroupComponent` or `ConditionalComponent` around response components is affected. Since `ConditionalComponent` is a primary building block for skip logic, this likely affects the majority of non-trivial screens.

---

## 3. User Story

> As a **researcher authoring an experiment**,
> I want **validation rules on nested components to be enforced when the participant submits a screen**,
> so that **invalid data is never accepted just because a field happened to be inside a group or conditional**.

### Scenario A – Required field inside a group

A screen groups demographic fields (`age`, `gender`, `country`) inside a `GroupComponent`. All are `required: true`. Today, none of them are enforced at submit — the participant can advance without filling any of them.

### Scenario B – Conditional field with its own validation

A screen shows a `text-input` asking for a doctor's name only when `$hasMedicalCondition === "yes"`. That field has `required: true` and `minLength: { value: 3 }`. Today, neither rule is enforced. A participant who selects "yes" can submit an empty or one-character doctor name.

### Scenario C – For-each dynamic fields

A `for-each` component generates one `text-input` per item in a list, with a dynamic `dataKey` (`"comment-@index"`). Today none of those fields are in the schema. They submit their values but validation is bypassed entirely.

---

## 4. Acceptance Criteria

- [ ] `buildSchema` recursively descends into `GroupComponent.props.components`.
- [ ] `buildSchema` recursively descends into `ConditionalComponent.props.component`.
- [ ] `buildSchema` recursively descends into `ForEachComponent.props.component` for **static** `for-each` (where `values` is known at config time), generating one schema entry per item using the resolved `dataKey`.
- [ ] For **dynamic** `for-each` (where `dataKey` drives the list from runtime data), schema generation is skipped for the template component and a note is added to this spec as a known limitation.
- [ ] `buildDefaultValues` in `Screen.tsx` is updated with the same recursive logic to ensure default values are registered for all nested response components.
- [ ] A response component inside a `ConditionalComponent` is enforced correctly: required when its condition is true at submit time, not required when the condition is false. This is implemented via a `z.superRefine` pass that reads the live form values at submit time.
- [ ] All existing tests continue to pass.
- [ ] New tests cover nested group, conditional (shown), conditional (hidden), and static for-each validation.

---

## 5. UI / UX

### 5.1 Entry Point

Invisible to participants — this is a correctness fix. The only visible change is that submitting a screen with an unfilled required field inside a group or conditional now shows a validation error, just as if the field were top-level.

### 5.2 Interaction Flow

Same as today's validation flow — no interaction changes.

### 5.3 States

| State | Description |
|---|---|
| Valid nested field | No visible change from today. |
| Invalid nested field (required, not filled) | Error message appears below the field inside the group or conditional container. |
| Hidden conditional field | No error is shown; the hidden field is not required. |

### 5.4 Copy

No new copy — existing `errorMessage` and default messages are used.

### 5.5 Figma Reference

- [ ] N/A — no visual design changes.

---

## 6. Technical Notes

### 6.1 Affected Areas

- `lib/validation.ts` — `buildSchema`: make field collection recursive
- `src/Screen.tsx` — `buildDefaultValues`: make default value collection recursive
- `lib/specs/validation.test.ts` — new tests for nested component schemas
- `src/specs/Screen.test.tsx` — integration tests for validation of nested fields

### 6.2 Data / State

**Proposed `collectFields` helper (replaces the inline loop in `buildSchema`):**

```ts
function collectFields(
  components: ScreenComponent[],
  acc: Record<string, z.ZodTypeAny> = {}
): Record<string, z.ZodTypeAny> {
  for (const component of components) {
    if (component.componentFamily === "response") {
      acc[component.props.dataKey] = buildFieldSchema(component);
    } else if (component.template === "group") {
      collectFields(component.props.components, acc);
    } else if (component.template === "conditional") {
      // Include nested field as optional in the base schema.
      // A superRefine pass (added after collectFields) enforces required rules
      // dynamically at submit time based on the condition's runtime evaluation.
      const inner = component.props.component;
      if (inner.componentFamily === "response") {
        acc[inner.props.dataKey] = buildFieldSchema(inner).optional();
      } else {
        collectFields([inner], acc);
      }
    } else if (component.template === "for-each" && component.props.type === "static") {
      const template = component.props.component;
      if (template.componentFamily === "response") {
        for (let i = 0; i < component.props.values.length; i++) {
          const resolvedKey = template.props.dataKey.replace("@index", String(i));
          acc[resolvedKey] = buildFieldSchema(template);
        }
      }
    }
    // dynamic for-each: skip — dataKey is not statically resolvable
  }
  return acc;
}
```

**`buildDefaultValues` needs the same recursion** — today it is a simple `Object.fromEntries` over `screen.components`; it should call the same `collectFields`-style traversal.

### 6.3 Validation

No new `validateExperiment` checks introduced by this feature. The nested component schema inclusion is purely a runtime fix.

### 6.4 Constraints & Risks

- **Dynamic `for-each`**: When `type === "dynamic"`, the list of items is not known until the screen renders (it comes from collected form data). The number of generated fields is unknown at schema-build time. Proper validation of dynamic for-each fields requires either a `superRefine` that reads the live array length at submit time, or a separate schema built after the form mounts. This is deferred.
- **Conditional field enforcement**: A `superRefine` pass is added to the schema to evaluate conditional field requirements dynamically at submit time. For each `ConditionalComponent`, the refine evaluates the condition against the submitted form values: if the condition is true and the nested field is required and empty, an issue is added for that field's key.
- **`react-hook-form` field registration**: Fields registered dynamically (inside `ForEach` at render time) are registered by the leaf component via `form.register(resolvedDataKey)`. Static for-each fields will now also have `defaultValues` entries, which prevents the controlled/uncontrolled warning.

---

## 7. Test Plan

### 7.1 Unit Tests

- [ ] `buildSchema` with a `GroupComponent` containing a required `text-input` — schema includes the nested field's key.
- [ ] `buildSchema` with a `ConditionalComponent` wrapping a required `text-input` — schema includes the field (as optional).
- [ ] `buildSchema` with a static `ForEachComponent` with 3 values — schema includes 3 entries with resolved keys.
- [ ] `buildSchema` with a dynamic `ForEachComponent` — no entries added for the template field (gracefully skipped).
- [ ] `buildSchema` with deep nesting (group → conditional → response) — all leaf response fields are collected.

### 7.2 Integration / Flow Tests

- [ ] Screen with a required field inside a `GroupComponent` — submitting without filling it shows a validation error.
- [ ] Screen with a required field inside a `ConditionalComponent` — when the condition is true and the field is visible, submitting without filling it shows an error.
- [ ] Screen with a required field inside a `ConditionalComponent` — when the condition is false and the field is hidden, submitting does not show an error for that field.
- [ ] Screen with a static for-each of 2 items, each with a required `text-input` — submitting with one unfilled shows an error on that field.

### 7.3 Manual / QA Checks

- [ ] Confirm no `Warning: A component is changing an uncontrolled input` console warnings for grouped or conditional fields.
- [ ] Confirm submitted data includes values from nested fields.

---

## 8. Out of Scope

- Dynamic `for-each` schema (item count unknown at build time) — deferred to a follow-up.
- Fully correct enforcement for `ConditionalComponent` nested inside another `ConditionalComponent` (double-nested conditions) — the `superRefine` approach handles single nesting; deeply nested conditional required enforcement is a follow-up.
- Nested `ConditionalComponent` inside `ConditionalComponent` — the recursive traversal handles the component collection correctly, but the optionality logic becomes complex. Treat all conditionally-nested response fields as `.optional()` for now.

---

## 9. Open Questions

| # | Question | Owner | Resolution |
|---|---|---|---|
| 1 | Should we use `superRefine` at the schema level to dynamically enforce conditional field requirements based on live form values at submit time? This would close the "required when shown" gap cleanly. | — | **Resolved:** Implement `superRefine` in this feature — not deferred. The base schema marks conditional fields as `.optional()`; the `superRefine` pass re-enforces required constraints when the condition evaluates to true at submit time. |
| 2 | For static `for-each`, should `@index` be the only supported placeholder in `dataKey`, or should `@value` also be resolved statically (it is the string value at that index)? | — | Open |
| 3 | If a `GroupComponent` is inside a `ConditionalComponent`, are all of its children marked `.optional()`? | — | Proposed: yes — the whole group is conditionally shown, so all its children should be treated as optional. |

---

## 10. Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-12 | — | Initial draft |
