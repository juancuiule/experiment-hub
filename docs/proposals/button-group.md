# `button-group` — trivia-style choice buttons with answer feedback

key files (proposed): `lib/components/response.ts`, `lib/screen-validation.ts`, `lib/screen-defaults.ts`, `lib/flow-validation.ts`, `src/components/response/ButtonGroup.tsx`, `src/components/RenderComponent.tsx`, `src/Screen.tsx`

## Motivation

Building trivia or knowledge-testing experiments currently requires workarounds: a `radio` + `button` (two interactions) or multiple payload `button`s (see issue #15) with no awareness of which answer is correct.

What's missing is a component that:
1. Presents labeled choices as large, tappable buttons — not radio circles
2. Captures a single value at `dataKey` and submits on click, optionally after a feedback window
3. Can **reveal correct/wrong feedback** on the clicked button before advancing
4. Stores the selected value for downstream `branch` and `compute` nodes

**Concrete example**: A trivia screen with 4 city options. Participant taps one → it turns green (correct) or red (wrong) → after 1.5 s the flow advances automatically. A `branch` node afterwards routes to a "¡Bien!" screen or an explanation screen.

---

## Component spec

**Family**: `response` (captures a value, same as `radio`)
**Template**: `button-group`

```ts
// lib/components/response.ts

export interface ButtonGroupComponent extends BaseResponseComponent<
  "button-group",
  {
    options: OptionsSource;      // same type as radio/checkboxes — supports inline array, $$ref, @shared, $piped, %loop
    correctKey?: string;         // value of the correct answer; omit for unscored use
    showFeedback?: boolean;      // default: false — highlight picked button as correct (green) or wrong (red)
    advanceAfterMs?: number;     // if set, auto-submits after Nms post-click; if absent, an external button advances the screen
    randomize?: boolean;
    reshuffleInLoop?: boolean;
    storeIsCorrect?: boolean;    // if true, also writes a boolean to `${dataKey}:correct`
  }
> {}
```

**Stored value at `dataKey`**: `string` — the `value` of the clicked option, same shape as `radio`.

**`storeIsCorrect`**: when `true` and `correctKey` is set, also writes `true`/`false` to `${dataKey}:correct`. For example, `dataKey: "capitalAnswer"` → also stores `"capitalAnswer:correct"`. Useful for `branch` nodes and `compute` scores that need a boolean rather than a string comparison.

---

## Advance behavior

The two props `showFeedback` and `advanceAfterMs` are independent and compose freely:

| `showFeedback` | `advanceAfterMs` | Behavior after click |
|---|---|---|
| `false` (default) | absent | Disable all buttons → wait for screen's `button` to submit |
| `false` | e.g. `500` | Disable all buttons → auto-submit after 500 ms |
| `true` | absent | Show feedback colors → wait for screen's `button` to submit |
| `true` | e.g. `1500` | Show feedback colors → auto-submit after 1500 ms |

When `advanceAfterMs` is absent the screen is expected to have a `button` layout component. The validator emits `button-group-needs-button` if neither `advanceAfterMs` nor a `button` component is present on the same screen.

---

## Full example

```ts
// Screen definition — feedback shown, auto-advances after 1200 ms
{
  slug: "trivia-capital",
  components: [
    {
      componentFamily: "content",
      template: "rich-text",
      props: { content: "## ¿Cuál es la capital de Argentina?" }
    },
    {
      componentFamily: "response",
      template: "button-group",
      props: {
        dataKey: "capitalAnswer",
        correctKey: "buenos-aires",
        showFeedback: true,
        advanceAfterMs: 1200,
        storeIsCorrect: true,
        randomize: true,
        options: [
          { label: "Córdoba",       value: "cordoba"      },
          { label: "Buenos Aires",  value: "buenos-aires" },
          { label: "Rosario",       value: "rosario"      },
          { label: "Mendoza",       value: "mendoza"      }
        ]
      }
    }
  ]
}

// Branch node — reads the boolean stored at "capitalAnswer:correct"
{
  id: "branch-trivia-result",
  type: "branch",
  props: {
    name: "trivia-capital-result",
    branches: [
      {
        id: "correct",
        config: {
          type: "simple",
          dataKey: "$$trivia-capital.capitalAnswer:correct",
          operator: "eq",
          value: true
        }
      }
    ]
  }
}
```

```ts
// Screen definition — feedback shown, participant must tap Continue to advance
{
  slug: "trivia-capital",
  components: [
    {
      componentFamily: "content",
      template: "rich-text",
      props: { content: "## ¿Cuál es la capital de Argentina?" }
    },
    {
      componentFamily: "response",
      template: "button-group",
      props: {
        dataKey: "capitalAnswer",
        correctKey: "buenos-aires",
        showFeedback: true,
        // no advanceAfterMs — external button advances
        options: [ /* ... */ ]
      }
    },
    {
      componentFamily: "layout",
      template: "button",
      props: { text: "Continuar", alignBottom: true }
    }
  ]
}
```

---

## UX behavior

```
Before pick              After wrong pick             After correct pick
┌──────────────────┐     ┌──────────────────┐         ┌──────────────────┐
│   Córdoba        │     │   Córdoba        │         │   Córdoba        │
├──────────────────┤     ├──────────────────┤         ├──────────────────┤
│   Buenos Aires   │  →  │   Buenos Aires   │    →    │ ✓ Buenos Aires   │ ← green
├──────────────────┤     ├──────────────────┤         ├──────────────────┤
│   Rosario        │     │ ✗ Rosario        │← red    │   Rosario        │
├──────────────────┤     ├──────────────────┤         ├──────────────────┤
│   Mendoza        │     │   Mendoza        │         │   Mendoza        │
└──────────────────┘     └──────────────────┘         └──────────────────┘
                         all disabled; if advanceAfterMs set, auto-advances
```

When `showFeedback: false`, no correct/wrong colors are applied — the picked button shows an active/selected state and all other buttons are disabled and appear unselected.

---

## Answer piping

Option `label`s support `{{...}}` interpolation via `resolveValuesInString`, same as `radio` and `checkboxes`. This means labels can reference context values:

```ts
options: [
  { label: "{{$$trial.optionA}}", value: "a" },
  { label: "{{$$trial.optionB}}", value: "b" },
]
```

Piping applies at render time, before the participant sees the buttons.

---

## Randomization

`randomize: true` shuffles the options once on mount, same as `radio`. The rendered order is stored in `context.data` under `${dataKey}:order` (consistent with how radio/checkboxes record shuffle order for analysis).

`reshuffleInLoop: true` re-shuffles on each loop iteration, same as the existing pattern.

---

## Keyboard navigation

The component manages focus within the button list:

- `↑` / `↓` move focus to the previous / next button (wraps around).
- `Enter` or `Space` selects the focused button and triggers the same click handler.
- After a pick, all buttons are disabled; focus remains on the selected button.

The button list uses `role="group"` with an `aria-label` derived from the screen's question content (or a default `"Choose an answer"`).

---

## Implementation sketch

### Type changes
- `lib/components/response.ts`: add `ButtonGroupComponent`, add to `ResponseComponent` union. No new option type needed — reuses `OptionsSource`.

### Validation
- `lib/screen-validation.ts`: `button-group` registers a `z.string()` field at `dataKey`. If `storeIsCorrect: true`, also registers `z.boolean()` at `${dataKey}:correct`.
- `lib/screen-defaults.ts`: no default value — participant must click.
- `lib/flow-validation.ts`:
  - `feedback-without-correct-key`: warn when `showFeedback: true` but `correctKey` is absent.
  - `button-group-needs-button`: warn when `advanceAfterMs` is absent and no `button` component is present on the same screen.

### Runtime: `src/components/response/ButtonGroup.tsx`
New component using `useController(form, dataKey)` to register the field.

On click:
1. Call `field.onChange(value)` to set the form value.
2. Set local `picked` state (disables all buttons, drives feedback colors).
3. If `advanceAfterMs` is set → `setTimeout(triggerSubmit, advanceAfterMs)`. Clean up on unmount.
4. If `advanceAfterMs` is absent → do nothing; the screen's `button` submits via the normal form submit path.

### `triggerSubmit`
Thread `form.handleSubmit(onSubmit)` as a new `triggerSubmit?: () => void` field on `RenderProps` from `Screen.tsx`. `Screen.tsx` already defines `const onSubmit = (data) => onNext(...)` — passing `form.handleSubmit(onSubmit)` through is explicit, requires no new abstractions, and is ignored by all other components.

When `storeIsCorrect: true`, `ButtonGroup` calls `form.setValue(\`${dataKey}:correct\`, pickedValue === correctKey)` before calling `triggerSubmit` or before the external button submits.

### `src/components/RenderComponent.tsx`
Add `button-group` case under `case 'response'`, passing `triggerSubmit` alongside the standard props.

