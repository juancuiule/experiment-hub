# Preview Mode

> **Status:** Draft
> **Author:** —
> **Created:** 2026-03-12
> **Last updated:** 2026-03-12
> **Linked issue:** —

---

## 1. Summary

Add a `/preview` route that lets researchers render any screen in isolation — without navigating through the full experiment flow — and seed a mock context to test answer piping and conditional rendering.

---

## 2. Problem Statement

**Current state:** The only way to view a screen is to run the full experiment from the start and click through every preceding screen. For a screen buried behind a branch, a loop, or a multi-step path, this means fabricating answers to several prior questions on every iteration. There is no way to jump directly to a screen during authoring.

**Desired state:** A `/preview/[slug]` route renders any screen by slug with a minimal context. A JSON seed panel lets the researcher inject mock `$$` values to test label interpolation and conditional rendering without running through the flow.

**Impact:** Any researcher iterating on screen layout, component ordering, or conditional logic spends the majority of their authoring time clicking through setup screens that are irrelevant to the change they are making. This is the second-largest authoring friction after the raw TypeScript edge syntax.

---

## 3. User Story

> As a **researcher authoring a screen**,
> I want to **preview it instantly without running through the entire experiment**,
> so that **I can iterate on layout, labels, and conditionals quickly**.

### Scenario A – Checking answer piping

A researcher adds `$$welcome.name` to a screen label. Instead of starting the experiment, entering their name, and navigating to the screen, they open `/preview/screen-welcome-back`, paste `{ "data": { "welcome": { "name": "Juan" } } }` into the seed panel, and immediately see "Hello, Juan!" in the label.

### Scenario B – Testing a conditional component

A screen has a `ConditionalComponent` that shows a follow-up question when `$hasPets === "yes"`. The researcher previews the screen, toggles the seed panel to set `screenData: { hasPets: "yes" }`, and confirms the follow-up appears.

### Scenario C – Browsing all screens

A researcher opens `/preview` (the index) and sees all screens listed as cards with their slugs and component counts. Clicking one opens the preview.

---

## 4. Acceptance Criteria

- [ ] A `/preview` route lists all screens from `experiment.screens` as a grid of cards (slug + component count).
- [ ] A `/preview/[slug]` route renders the matching screen using the existing `<Screen>` component.
- [ ] The preview renders the screen with an empty `context` by default.
- [ ] A collapsible JSON seed panel allows the researcher to input a JSON object that is parsed and used as the `context`. Changes apply immediately (no page reload).
- [ ] Invalid JSON in the seed panel shows an inline parse error; the last valid context is retained.
- [ ] `onNext` is a no-op in preview mode — the continue button triggers a toast notification `"Form submitted — preview only"` instead of advancing.
- [ ] The screen is surrounded by a visual "Preview" banner or badge so it is clearly distinguishable from the live experiment.
- [ ] The preview route is currently accessible without an environment guard. Future iterations will add role-based access control.
- [ ] Navigation between screens via `/preview/[slug]` uses the Next.js app router; slug is part of the URL so it is bookmarkable.

---

## 5. UI / UX

### 5.1 Layout

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to screen list    [PREVIEW MODE]    Slug: welcome │  ← Header bar
├──────────────────────────────────────────────────────────┤
│                                                          │
│              [ Screen renders here ]                     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  ▼ Seed Context                                          │  ← Collapsible
│  ┌────────────────────────────────────────────────────┐  │
│  │ {                                                  │  │
│  │   "data": { "welcome": { "name": "Juan" } }        │  │
│  │ }                                                  │  │
│  └────────────────────────────────────────────────────┘  │
│  [Apply]  Parse error: unexpected token at line 3         │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Interaction Flow

1. Researcher opens `/preview`.
2. A grid of all screen slugs is shown. Each card shows: slug, component count, component family icons.
3. Researcher clicks a card → navigates to `/preview/[slug]`.
4. Screen renders with `context = {}`.
5. Researcher expands the seed panel, types or pastes a JSON context.
6. On every valid JSON change, the screen re-renders with the new context (live update).
7. Researcher fills out the form and clicks the continue button.
8. A toast notification: `"Form submitted — preview only"`. The screen resets to its default state.

### 5.3 States

| State | Description |
|---|---|
| Default | Screen renders with `context = {}`. All interpolation tokens that can't resolve are shown literally (existing behavior). |
| Seeded context | Screen renders with the provided context. Answer piping and conditionals respond to the seed values. |
| Invalid JSON | Parse error shown inline; screen continues rendering with the last valid context. |
| Form submitted | Toast shown; screen resets. |

### 5.4 Copy

| Location | String |
|---|---|
| Preview banner | `"PREVIEW MODE"` |
| Submit toast | `"Form submitted — preview only. In the live experiment, this would advance to the next step."` |
| Seed panel label | `"Seed Context (JSON)"` |
| Seed panel hint | `"Provide a mock Context object to test answer piping and conditional rendering."` |
| Back link | `"← All screens"` |

### 5.5 Figma Reference

- [ ] Figma link: Not yet designed.
- [ ] The preview banner should use an amber/yellow color to clearly distinguish the preview frame from the live UI.

---

## 6. Technical Notes

### 6.1 Affected Areas

- `app/preview/page.tsx` — new route: screen list
- `app/preview/[slug]/page.tsx` — new route: single screen preview
- `src/preview/PreviewWrapper.tsx` — wrapper that adds the banner, seed panel, and submit interception

### 6.2 Data / State

**Screen lookup:**

```tsx
// app/preview/[slug]/page.tsx
import { experiment } from "@/src/data/experiment";

export default function PreviewPage({ params }: { params: { slug: string } }) {
  const screen = experiment.screens?.find(s => s.slug === params.slug);
  if (!screen) return <p>Screen "{params.slug}" not found.</p>;
  return <PreviewWrapper screen={screen} />;
}
```

**Seed panel state:**

```tsx
const [seedText, setSeedText] = useState("{}");
const [context, setContext] = useState<Context>({});
const [parseError, setParseError] = useState<string | null>(null);

function handleSeedChange(text: string) {
  setSeedText(text);
  try {
    setContext(JSON.parse(text));
    setParseError(null);
  } catch (e) {
    setParseError((e as Error).message);
    // retain last valid context
  }
}
```

**`onNext` interception:**

```tsx
const [showToast, setShowToast] = useState(false);

function handleNext(_data: unknown) {
  setShowToast(true);
  setTimeout(() => setShowToast(false), 3000);
  // Reset form by remounting Screen with a new key
  setResetKey(k => k + 1);
}

// ...
<Screen key={resetKey} screen={screen} context={context} onNext={handleNext} isLoading={false} />
```

No changes to `Screen.tsx` or the flow engine are needed.

### 6.3 Validation

No `validateExperiment` changes.

### 6.4 Constraints & Risks

- Screens that depend on `context.data` from prior screens (e.g. answer-piped labels, `conditional` components using `$$` references) will render with blank/literal tokens unless the seed context is populated. This is expected and documented in the UI.
- The `<Screen>` component uses `react-hook-form`. Resetting the form after a preview submit requires remounting via a React `key` change — the `key={resetKey}` pattern handles this cleanly.
- The preview route imports the experiment directly from `src/data/experiment.ts`. If the experiment config has validation errors, the screen may still render (the preview doesn't block on `validateExperiment`). A warning banner should appear if the experiment fails validation.

---

## 7. Test Plan

### 7.1 Unit Tests

- [ ] `/preview` renders a card for each screen in `experiment.screens`.
- [ ] `/preview/[slug]` renders the correct screen for a valid slug.
- [ ] `/preview/[slug]` shows a "not found" message for an unknown slug.
- [ ] Seed panel: valid JSON updates the context; invalid JSON shows parse error without crashing.
- [ ] `onNext` triggers a toast and resets the form.

### 7.2 Integration / Flow Tests

- [ ] Seed context with `{ "data": { "screen-slug": { "name": "Test" } } }` — `$$screen-slug.name` resolves in labels.
- [ ] Seed `screenData: { hasPets: "yes" }` — a `ConditionalComponent` checking `$hasPets === "yes"` shows its child.

### 7.3 Manual / QA Checks

- [ ] Open `/preview`, confirm all screens are listed.
- [ ] Click a screen card, confirm the screen renders.
- [ ] Fill in the seed panel with a valid context, confirm labels update.
- [ ] Submit the form, confirm the toast appears and the form resets.

---

## 8. Out of Scope

- Previewing screens in the context of their parent path or loop (stepper rendering during preview).
- Stepping through multiple screens in sequence in preview mode (use the live experiment for that).
- Editing screen components from within the preview (that's the screen editor, a future feature).
- Preview mode on mobile.

---

## 9. Open Questions

| # | Question | Owner | Resolution |
|---|---|---|---|
| 1 | Should the seed panel be pre-populated with a skeleton of the context shape for the current screen (based on `dataKey`s)? | — | Open — proposed: yes, a "Generate skeleton" button that auto-fills the seed with all `dataKey`s set to `null`. |
| 2 | Should the preview route be accessible in production for authorized researchers, or always dev-only? | — | **Resolved:** Always accessible for now (no environment guard). Future: gated by user roles. |
| 3 | Should `/preview` show screens from the current experiment only, or support loading an arbitrary JSON file? | — | Open — proposed: current experiment only for simplicity; arbitrary JSON import is a follow-up. |

---

## 10. Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-12 | — | Initial draft |
