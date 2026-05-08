# Design System — Visual Customization

**Date:** 2026-05-08
**Status:** Approved

## Problem

Experiments share a single visual layer. There is no way to change colors, typography, or component structure between experiments without editing source files. Different experiments need different looks — for branding, for ecological validity (making an experiment resemble a specific real-world interface), or both.

## Goals

- Researchers (non-developers) can apply a custom visual theme to an experiment via a JSON config field alongside nodes, edges, and screens.
- Developers can replace individual component implementations per experiment at render time.
- Experiments remain fully JSON-serializable so they can be stored in databases and version-controlled.
- Themes are scoped to the experiment wrapper — they cannot leak into the surrounding app or other experiments on the same page.
- All tokens fall back gracefully to sensible defaults when not specified.

## Non-Goals

- Global/deployment-level theming (one theme per app). Theming is per experiment only.
- Full headless mode (replacing the entire render layer). The escape hatch is slot-level, not wholesale.
- Font size customization in the initial implementation. This can be added later when a concrete use case is clear.

---

## Architecture

Three independent layers, each serving a different audience:

```
Layer 1 — ExperimentTheme (JSON)       → for researchers
Layer 2 — CSS variable injection       → runtime, scoped to wrapper
Layer 3 — ComponentRegistry            → for developers, never persisted
```

---

## Layer 1 — `ExperimentTheme` type

Added as an optional field on `ExperimentFlow`:

```typescript
export type ExperimentFlow = {
  nodes: FrameworkNode[]
  edges: FrameworkEdge[]
  screens?: FrameworkScreen[]
  theme?: ExperimentTheme        // new
}
```

The theme type:

```typescript
export type ExperimentTheme = {
  colors?: {
    primary?: string             // main interactive color — buttons, active states, focus indicators
    primaryForeground?: string   // text/icon color on primary backgrounds
    background?: string          // screen/page background
    surface?: string             // elevated surfaces — dropdown panels, cards
    surfaceHover?: string        // hover state for surface items
    foreground?: string          // default body text
    mutedForeground?: string     // secondary/placeholder/hint text
    border?: string              // input borders, dividers, unselected control borders
    error?: string               // validation error messages
  }
  typography?: {
    fontFamily?: string          // e.g. "Georgia, serif" or "Inter, sans-serif"
  }
  radius?: string                // base border radius, e.g. "0.375rem" or "0px"
  spacing?: {
    fieldGap?: string            // gap between top-level form components, e.g. "1.5rem"
    screenPadding?: string       // padding around the screen container
  }
}
```

**Token-to-component wiring:**

| Token | Where it applies |
|-------|-----------------|
| `colors.primary` | Button bg + hover, Slider thumb + range fill, Checkbox/Radio/Likert checked bg + border, Input/Dropdown focus border, Stepper progress fill |
| `colors.primaryForeground` | Button label text, LikertScale selected indicator number |
| `colors.background` | Experiment wrapper background |
| `colors.surface` | Dropdown content panel background |
| `colors.surfaceHover` | Dropdown item hover state |
| `colors.foreground` | Default body/label text |
| `colors.mutedForeground` | Input placeholder, Dropdown placeholder, Slider min/max labels, ChevronDown icon, LikertScale unselected number |
| `colors.border` | Input bottom border, Dropdown trigger + content border, Checkbox/Radio/Likert unselected border, Slider track background, Stepper track background |
| `colors.error` | `FieldError` message text |
| `typography.fontFamily` | Set as `fontFamily` on the experiment wrapper, cascades to all text |
| `radius` | Button corners, Checkbox box, Dropdown panel + items |
| `spacing.fieldGap` | `gap` on the `<form>` element in `Screen.tsx` |
| `spacing.screenPadding` | Padding on the experiment wrapper |

---

## Layer 2 — CSS variable injection

### Two-layer CSS system in `globals.css`

Runtime CSS vars with defaults (bottom layer — these are what get overridden at element level):

```css
:root {
  --primary:            #60a6bc;
  --primary-foreground: #ffffff;
  --background:         #ffffff;
  --surface:            #f9f9f9;
  --surface-hover:      #f3f4f6;
  --foreground:         #1d1d1d;
  --muted-foreground:   #6b7280;
  --border:             #d1d5db;
  --error:              #fc1400;
  --radius:             0.125rem;
  --field-gap:          1rem;
  --screen-padding:     1.5rem;
}
```

`@theme inline` mapping (top layer — generates clean Tailwind utilities):

```css
@theme inline {
  --color-primary:            var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-background:         var(--background);
  --color-surface:            var(--surface);
  --color-surface-hover:      var(--surface-hover);
  --color-foreground:         var(--foreground);
  --color-muted-foreground:   var(--muted-foreground);
  --color-border:             var(--border);
  --color-error:              var(--error);
}
```

Components use standard Tailwind utilities — no `[var(--...)]` syntax:
- `bg-primary`, `text-primary-foreground`
- `bg-surface`, `data-highlighted:bg-surface-hover`
- `border-border`, `text-muted-foreground`
- `bg-background`, `text-foreground`

### Injection in `Experiment.tsx`

```typescript
function themeToVars(theme?: ExperimentTheme): React.CSSProperties {
  const vars: Record<string, string> = {}
  if (theme?.colors?.primary)           vars["--primary"]            = theme.colors.primary
  if (theme?.colors?.primaryForeground) vars["--primary-foreground"] = theme.colors.primaryForeground
  if (theme?.colors?.background)        vars["--background"]         = theme.colors.background
  if (theme?.colors?.surface)           vars["--surface"]            = theme.colors.surface
  if (theme?.colors?.surfaceHover)      vars["--surface-hover"]      = theme.colors.surfaceHover
  if (theme?.colors?.foreground)        vars["--foreground"]         = theme.colors.foreground
  if (theme?.colors?.mutedForeground)   vars["--muted-foreground"]   = theme.colors.mutedForeground
  if (theme?.colors?.border)            vars["--border"]             = theme.colors.border
  if (theme?.colors?.error)             vars["--error"]              = theme.colors.error
  if (theme?.radius)                    vars["--radius"]             = theme.radius
  if (theme?.spacing?.fieldGap)         vars["--field-gap"]          = theme.spacing.fieldGap
  if (theme?.spacing?.screenPadding)    vars["--screen-padding"]     = theme.spacing.screenPadding
  return vars as React.CSSProperties
}
```

The wrapper element in `Experiment.tsx`:

```tsx
<div
  style={{
    ...themeToVars(step.experiment.theme),
    ...(step.experiment.theme?.typography?.fontFamily
      ? { fontFamily: step.experiment.theme.typography.fontFamily }
      : {}),
  }}
>
  {/* experiment content */}
</div>
```

Only defined tokens are written to the style attribute — undefined values never clobber `:root` defaults.

---

## Layer 3 — Component slot overrides

Not part of `ExperimentFlow`. Passed as a prop to `<Experiment>` at render time only — never stored or serialized.

### `ComponentRegistry` type

```typescript
type ComponentRegistry = Partial<{
  // response
  "text-input":      React.ComponentType<TextInputRenderProps>
  "text-area":       React.ComponentType<TextAreaRenderProps>
  "numeric-input":   React.ComponentType<NumericInputRenderProps>
  "date-input":      React.ComponentType<DateInputRenderProps>
  "time-input":      React.ComponentType<TimeInputRenderProps>
  "single-checkbox": React.ComponentType<SingleCheckboxRenderProps>
  "checkboxes":      React.ComponentType<CheckboxesRenderProps>
  "radio":           React.ComponentType<RadioRenderProps>
  "dropdown":        React.ComponentType<DropdownRenderProps>
  "slider":          React.ComponentType<SliderRenderProps>
  "likert-scale":    React.ComponentType<LikertScaleRenderProps>
  // layout
  "button":          React.ComponentType<ButtonRenderProps>
  // content
  "rich-text":       React.ComponentType<RichTextRenderProps>
}>
```

Each `*RenderProps` type exposes the same inputs the default component already receives: the component config, the form instance, and the context. Custom implementations are full replacements — they receive the form instance and can register fields and participate in validation.

All render props types follow this pattern (example for `radio`):

```typescript
type RadioRenderProps = {
  component: RadioComponent
  form: UseFormReturn<Record<string, any>>
  context: Context
}
```

The same shape applies to all response and layout slots. Content slots (`rich-text`) omit `form` since they don't collect data.

### Usage

```typescript
// stored experiment config (JSON-safe)
const myExperiment: ExperimentFlow = {
  nodes: [...],
  screens: [...],
  theme: {
    colors: { primary: "#e63946" },
    radius: "0px",
    typography: { fontFamily: "Georgia, serif" },
  }
}

// at render time — developer adds component overrides, never persisted
<Experiment
  flow={myExperiment}
  components={{
    radio: MyImageRadio,
    button: MyBrandedButton,
  }}
/>
```

### `ComponentRegistryContext`

A React context provides the registry to `RenderComponent`:

```typescript
const ComponentRegistryContext = createContext<ComponentRegistry>({})

export function useComponentRegistry() {
  return useContext(ComponentRegistryContext)
}
```

`Experiment.tsx` provides the context:

```tsx
<ComponentRegistryContext.Provider value={components ?? {}}>
  <div style={themeToVars(...)}>
    {/* experiment content */}
  </div>
</ComponentRegistryContext.Provider>
```

### Dispatch in `RenderComponent.tsx`

Before rendering any template, check the registry:

```typescript
const registry = useComponentRegistry()

// example for radio
const CustomRadio = registry["radio"]
if (CustomRadio) {
  return <CustomRadio component={component} form={form} context={context} />
}
return <Radio component={component} form={form} context={context} />
```

---

## File changes summary

| File | Change |
|------|--------|
| `lib/types.ts` | Add `theme?: ExperimentTheme` to `ExperimentFlow` |
| `lib/theme.ts` | New file — `ExperimentTheme` type + `themeToVars()` function |
| `lib/registry.ts` | New file — `ComponentRegistry` type + `*RenderProps` types + context |
| `app/globals.css` | Replace `@theme` block with `:root` defaults + `@theme inline` mapping |
| `src/Experiment.tsx` | Accept `components` prop, provide registry context, wrap with theme vars |
| `src/components/RenderComponent.tsx` | Consult registry before rendering each template |
| `src/components/Input.tsx` | Replace hardcoded colors with token utilities |
| `src/components/Label.tsx` | No change needed |
| `src/components/Stepper.tsx` | Replace hardcoded colors with token utilities |
| `src/components/layout/Button.tsx` | Replace hardcoded colors + radius with token utilities |
| `src/components/response/Radio.tsx` | Replace hardcoded colors with token utilities |
| `src/components/response/Checkboxes.tsx` | Replace hardcoded colors with token utilities |
| `src/components/response/SingleCheckbox.tsx` | Replace hardcoded colors with token utilities |
| `src/components/response/Dropdown.tsx` | Replace hardcoded colors with token utilities |
| `src/components/response/Slider.tsx` | Replace hardcoded colors with token utilities |
| `src/components/response/LikertScale.tsx` | Replace hardcoded colors with token utilities |
| `src/components/response/TextInput.tsx` | Inherits via `Input` — no direct change |
| `src/components/response/TextArea.tsx` | Inherits via shared input styles |
| `src/components/response/NumericInput.tsx` | Inherits via shared input styles |
| `src/components/response/DateInput.tsx` | Inherits via shared input styles |
| `src/components/response/TimeInput.tsx` | Inherits via shared input styles |

---

## Example experiment config with theme

```json
{
  "nodes": [...],
  "edges": [...],
  "screens": [...],
  "theme": {
    "colors": {
      "primary": "#e63946",
      "primaryForeground": "#ffffff",
      "background": "#fdf8f0",
      "border": "#d4c9b0",
      "mutedForeground": "#9c8f7a"
    },
    "typography": {
      "fontFamily": "Georgia, serif"
    },
    "radius": "0px",
    "spacing": {
      "fieldGap": "1.5rem"
    }
  }
}
```
