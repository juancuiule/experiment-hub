# Answer Piping — Full String Interpolation

> **Status:** Draft
> **Author:** —
> **Created:** 2026-03-12
> **Last updated:** 2026-03-12
> **Linked issue:** —

---

## 1. Summary

Extend answer piping (token interpolation of `$$`, `@`, and `$` references) to all string props on screen components — option labels, placeholders, slider min/max labels, and button text — and consolidate the two diverged interpolation implementations into a single shared function.

---

## 2. Problem Statement

**Current state:** Two interpolation implementations exist in parallel:

- `lib/resolve.ts:resolveValuesInString` — handles `$$` and `@` only. Regex: `/(\$\$[\w.-]+|@[\w.]+)/g` (supports hyphens).
- `src/components/primitives.tsx:resolveString` — handles `$$`, `@`, and `$`. Regex: `/(\$\$[\w.]+|@\w+|\$[\w.]+)/g` (no hyphens).

The `resolveString` function is called on `component.props.label` in all 11 response components. However, several string props are rendered raw without interpolation:

| Prop | Components affected |
|---|---|
| `options[].label` | `radio`, `dropdown`, `checkboxes`, `likert-scale` |
| `placeholder` | `text-input`, `text-area`, `numeric-input` |
| `minLabel` / `maxLabel` | `slider` |
| `button.text` | `button` (layout component) |

**Desired state:** Every user-visible string prop on every component goes through interpolation. A single `resolveString` function in `lib/resolve.ts` is the canonical implementation, used by both the lib layer and the React layer.

**Impact:** A researcher using a `for-each` or `loop` to render items from a list cannot pipe the current item's value (`@value`) into option labels. A researcher cannot pipe a previously collected name (`$$welcome.name`) into a placeholder like `"e.g. describe $$welcome.name's experience"`. These are reasonable use cases that appear to be intentionally supported by the type system but silently do nothing.

---

## 3. User Story

> As a **researcher building a dynamic survey**,
> I want **all text strings in my components to support token interpolation**,
> so that **I can reference collected data or loop context anywhere the participant can read text**.

### Scenario A – Looped option labels

A `for-each` iterates over a participant's list of reported activities (`$$hobbies`). For each, it renders a `likert-scale` asking "How often do you engage in @value?". The scale options are `[{ label: "Never", value: "1" }, ...]`. Currently the label works, but if the researcher adds a contextual option like `{ label: "I don't do @value anymore", value: "0" }`, the `@value` in `opt.label` is rendered literally.

### Scenario B – Personalized placeholder

A screen collects the participant's name in `$$welcome.name`. A later screen has a `text-area` with `placeholder: "Describe how $$welcome.name's childhood shaped this..."`. Currently the placeholder shows the literal `$$welcome.name` string.

### Scenario C – Dynamic button label

A screen inside a path loop has a `button` with `text: "Continue to @value"` to reinforce which item the participant is responding to. Currently, `"Continue to @value"` is shown literally.

---

## 4. Acceptance Criteria

- [ ] `lib/resolve.ts:resolveValuesInString` is updated to support `$` (screen-scoped) tokens in addition to `$$` and `@`.
- [ ] The regex in `lib/resolve.ts` is unified with the one in `src/components/primitives.tsx` — one regex, one implementation.
- [ ] The hyphen-in-key support (`[\w.-]+`) from `lib/resolve.ts` is preserved in the unified regex.
- [ ] `src/components/primitives.tsx:resolveString` is replaced with a re-export or thin wrapper around the lib function to avoid duplication.
- [ ] `options[].label` is interpolated via `resolveString` in: `Radio.tsx`, `Dropdown.tsx`, `Checkboxes.tsx`, `LikertScale.tsx`.
- [ ] `placeholder` is interpolated via `resolveString` in: `TextInput.tsx`, `TextArea.tsx`, `NumericInput.tsx`.
- [ ] `minLabel` and `maxLabel` are interpolated via `resolveString` in `Slider.tsx`.
- [ ] `button.text` is interpolated via `resolveString` in `Button.tsx`.
- [ ] `validateExperiment` existing reference checks are unaffected (they already use the lib-layer regex).
- [ ] All new interpolation points are covered by unit tests.

---

## 5. UI / UX

No structural UI changes — interpolated strings render identically to literal strings when no tokens are present. The only visible change is that tokens that previously appeared literally (e.g. `@value`) now resolve to their actual values.

---

## 6. Technical Notes

### 6.1 Affected Areas

- `lib/resolve.ts` — update regex to include `$` tokens; keep as the single source of truth
- `src/components/primitives.tsx` — replace `resolveString` implementation with import from `lib/resolve.ts`
- `src/components/response/Radio.tsx` — interpolate `opt.label`
- `src/components/response/Dropdown.tsx` — interpolate `opt.label`
- `src/components/response/Checkboxes.tsx` — interpolate `opt.label`
- `src/components/response/LikertScale.tsx` — interpolate `opt.label`
- `src/components/response/TextInput.tsx` — interpolate `placeholder`
- `src/components/response/TextArea.tsx` — interpolate `placeholder`
- `src/components/response/NumericInput.tsx` — interpolate `placeholder`
- `src/components/response/Slider.tsx` — interpolate `minLabel`, `maxLabel`
- `src/components/layout/Button.tsx` — interpolate `text`
- `lib/specs/resolve.test.ts` — add tests for `$` prefix interpolation
- `src/specs/Screen.test.tsx` — add tests for interpolated option labels, placeholders

### 6.2 Data / State

**Unified regex:**

```ts
// Matches $$key.path (global data), $key (screen data), @key (loop item)
// Longest match first to prevent $$ being matched as $ + $key
const TOKEN_REGEX = /(\$\$[\w.-]+|\$[\w.-]+|@[\w.]+)/g;
```

The `$$` alternative must precede `$` to prevent a `$$foo` token being captured as `$` + ` $foo` (the `$` alternative would consume the first `$` and leave an orphaned second `$`). With the alternatives ordered longest-first, `$$foo` is always matched as a single token.

**`$` prefix in `getValue`:** The `$` prefix is already handled in `lib/conditions.ts:getValue` (reads from `context.screenData`). For interpolation, the same resolver is used. The `context` passed to `resolveString` in React components already contains `screenData` (it is populated in `Conditional.tsx` via `useWatch`). However, in non-conditional components, `context.screenData` may be `undefined`. The resolver should treat `undefined` gracefully — leaving the token literal (the existing behavior for unresolvable `$$` tokens).

### 6.3 Validation

`validateExperiment:checkText` uses its own regex (currently `$$` and `@` only). Once `lib/resolve.ts` is the canonical implementation, `checkText` should import the same `TOKEN_REGEX`. The `$` prefix is intentionally excluded from `validateExperiment` reference checks (it is screen-scoped and not statically resolvable) — this behavior is unchanged; the regex update in `lib/resolve.ts` does not affect `validateExperiment`.

### 6.4 Constraints & Risks

- **Hyphen support**: `lib/resolve.ts` uses `[\w.-]+` (allows hyphens). `src/components/primitives.tsx` uses `[\w.]+` (does not). The live experiment config uses hyphenated `dataKey`s like `"prayer-frequency"`. The unified regex must use `[\w.-]+` to support these keys. This is a bugfix as well as a unification.
- **`$` in button text**: The `ButtonComponent` receives only `text?: string` — it does not receive a `context` prop today. Context must be threaded through `RenderComponent` → `Button`. Add `context` to `ButtonComponent`'s props.
- **Performance**: `resolveString` is called on every render. For option arrays with many items, it is called once per option label. This is a tiny string operation and not a performance concern.
- **Fallback for unresolved tokens**: The existing behavior — leave the token literal if it cannot be resolved — is preserved. This is the correct fallback since it makes typos visible to the researcher during testing.

---

## 7. Test Plan

### 7.1 Unit Tests

- [ ] `resolveValuesInString("Rate $opinion", { screenData: { opinion: "great" } })` → `"Rate great"`.
- [ ] `resolveValuesInString("$$a.b-c", ctx)` resolves correctly (hyphenated key).
- [ ] `resolveValuesInString("$$foo", {})` → `"$$foo"` (unresolved token remains literal).
- [ ] `resolveValuesInString("$$foo and $bar", ctx)` resolves both tokens independently.

### 7.2 Integration / Flow Tests

- [ ] `Radio` component with `options: [{ label: "About @value", value: "1" }]` inside a loop — option label shows the resolved value.
- [ ] `TextInput` with `placeholder: "Hello $$welcome.name"` — placeholder shows the name.
- [ ] `Slider` with `minLabel: "$$scale.low"` — label resolves correctly.

### 7.3 Manual / QA Checks

- [ ] Loop over a static list of 3 items, render a `radio` with `opt.label: "@value choice"` — each radio renders the correct item value in the label.
- [ ] Inspect browser to confirm no literal `@value`, `$$`, or `$` strings appear in rendered HTML when tokens are resolvable.

---

## 8. Out of Scope

- Interpolation in `alt` text on `image` components (accessibility improvement, separate feature).
- Interpolation in `url` props (`image.url`, `video.url`, `audio.url`) — dynamic media URLs are a separate, potentially risky feature.
- `validateExperiment` support for `$` token validation — remains excluded by design (screen-scoped, not statically resolvable).

---

## 9. Open Questions

| # | Question | Owner | Resolution |
|---|---|---|---|
| 1 | Should `$` tokens in option labels resolve from the live `screenData` (requiring `useWatch` in every option-bearing component)? Or should they only resolve from the static `context` prop? | — | **Resolved:** Use live form values via `useWatch` in every option-bearing component (`Radio`, `Dropdown`, `Checkboxes`, `LikertScale`). |
| 2 | Should the `ButtonComponent` receive `context` as a prop? It currently does not. | — | **Resolved:** Yes — thread `context` from `RenderComponent` to `Button`, consistent with all other components. |

---

## 10. Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-12 | — | Initial draft |
