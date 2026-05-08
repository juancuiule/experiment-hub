# Design System Visual Customization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-experiment visual theming via a `theme` field in `ExperimentFlow` (CSS vars, JSON-safe) and an optional `components` prop on `<Experiment>` for developer-level slot overrides.

**Architecture:** A two-layer CSS system (`@theme inline` + `:root` defaults) lets Tailwind utilities like `bg-primary` resolve at runtime. `Experiment.tsx` injects the theme as scoped CSS vars on the wrapper element. A React context registry allows per-slot component replacement without touching `ExperimentFlow`.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4 (`@theme inline`), Radix UI, react-hook-form, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-08-design-system-design.md`

---

## File Map

| File | Action |
|------|--------|
| `lib/theme.ts` | **Create** — `ExperimentTheme` type + `themeToVars()` |
| `lib/registry.tsx` | **Create** — `ComponentRegistry` type + `*RenderProps` types + context + provider + hook |
| `lib/specs/theme.test.ts` | **Create** — unit tests for `themeToVars` |
| `src/specs/registry.test.tsx` | **Create** — tests for registry context |
| `lib/types.ts` | **Modify** — add `theme?: ExperimentTheme` to `ExperimentFlow` |
| `app/globals.css` | **Modify** — replace `@theme` block with `:root` defaults + `@theme inline` |
| `src/Experiment.tsx` | **Modify** — accept `components` prop, inject theme vars, provide registry context |
| `src/components/RenderComponent.tsx` | **Modify** — registry dispatch before each default render |
| `src/Screen.tsx` | **Modify** — use `gap-[var(--field-gap)]` instead of `gap-4` |
| `src/components/Input.tsx` | **Modify** — token utilities |
| `src/components/response/TextArea.tsx` | **Modify** — token utilities (has own inline styles, does not use `Input`) |
| `src/components/layout/Button.tsx` | **Modify** — token utilities + radius |
| `src/components/response/Radio.tsx` | **Modify** — token utilities |
| `src/components/response/Checkboxes.tsx` | **Modify** — token utilities |
| `src/components/response/SingleCheckbox.tsx` | **Modify** — token utilities |
| `src/components/response/Dropdown.tsx` | **Modify** — token utilities |
| `src/components/response/Slider.tsx` | **Modify** — token utilities |
| `src/components/response/LikertScale.tsx` | **Modify** — token utilities |
| `src/components/Stepper.tsx` | **Modify** — token utilities |
| `src/components/content/RichText.tsx` | **Modify** — token utilities |
| `src/components/response/NumericInput.tsx` | **No change** — delegates to `Input` |
| `src/components/response/DateInput.tsx` | **No change** — delegates to `Input` |
| `src/components/response/TimeInput.tsx` | **No change** — delegates to `Input` |
| `src/components/Label.tsx` | **No change** — no hardcoded colors |

---

## Task 1: Create `lib/theme.ts` and its tests

**Files:**
- Create: `lib/theme.ts`
- Create: `lib/specs/theme.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/specs/theme.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { themeToVars } from '../theme'

describe('themeToVars', () => {
  test('returns empty object for undefined', () => {
    expect(themeToVars(undefined)).toEqual({})
  })

  test('returns empty object for empty theme', () => {
    expect(themeToVars({})).toEqual({})
  })

  test('maps colors.primary to --primary', () => {
    expect(themeToVars({ colors: { primary: '#e63946' } }))
      .toMatchObject({ '--primary': '#e63946' })
  })

  test('maps all color tokens to correct var names', () => {
    const result = themeToVars({
      colors: {
        primary: '#111',
        primaryForeground: '#fff',
        background: '#fdf',
        surface: '#f9f',
        surfaceHover: '#f4f',
        foreground: '#1d1',
        mutedForeground: '#aaa',
        border: '#d4d',
        error: '#f00',
      },
    })
    expect(result['--primary']).toBe('#111')
    expect(result['--primary-foreground']).toBe('#fff')
    expect(result['--background']).toBe('#fdf')
    expect(result['--surface']).toBe('#f9f')
    expect(result['--surface-hover']).toBe('#f4f')
    expect(result['--foreground']).toBe('#1d1')
    expect(result['--muted-foreground']).toBe('#aaa')
    expect(result['--border']).toBe('#d4d')
    expect(result['--error']).toBe('#f00')
  })

  test('maps radius to --radius', () => {
    expect(themeToVars({ radius: '0px' })).toMatchObject({ '--radius': '0px' })
  })

  test('maps spacing tokens', () => {
    const result = themeToVars({ spacing: { fieldGap: '1.5rem', screenPadding: '2rem' } })
    expect(result['--field-gap']).toBe('1.5rem')
    expect(result['--screen-padding']).toBe('2rem')
  })

  test('omits undefined tokens — does not write keys for missing values', () => {
    const result = themeToVars({ colors: { primary: '#111' } })
    expect('--background' in result).toBe(false)
    expect('--border' in result).toBe(false)
    expect('--radius' in result).toBe(false)
  })

  test('typography.fontFamily is not included in CSS vars (handled separately)', () => {
    const result = themeToVars({ typography: { fontFamily: 'Georgia, serif' } })
    expect(Object.keys(result)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/specs/theme.test.ts
```

Expected: all tests fail with "Cannot find module '../theme'"

- [ ] **Step 3: Create `lib/theme.ts`**

```typescript
export type ExperimentTheme = {
  colors?: {
    primary?: string
    primaryForeground?: string
    background?: string
    surface?: string
    surfaceHover?: string
    foreground?: string
    mutedForeground?: string
    border?: string
    error?: string
  }
  typography?: {
    fontFamily?: string
  }
  radius?: string
  spacing?: {
    fieldGap?: string
    screenPadding?: string
  }
}

export function themeToVars(theme?: ExperimentTheme): Record<string, string> {
  if (!theme) return {}
  const vars: Record<string, string> = {}
  const c = theme.colors
  if (c?.primary)            vars['--primary']            = c.primary
  if (c?.primaryForeground)  vars['--primary-foreground'] = c.primaryForeground
  if (c?.background)         vars['--background']         = c.background
  if (c?.surface)            vars['--surface']            = c.surface
  if (c?.surfaceHover)       vars['--surface-hover']      = c.surfaceHover
  if (c?.foreground)         vars['--foreground']         = c.foreground
  if (c?.mutedForeground)    vars['--muted-foreground']   = c.mutedForeground
  if (c?.border)             vars['--border']             = c.border
  if (c?.error)              vars['--error']              = c.error
  if (theme.radius)          vars['--radius']             = theme.radius
  if (theme.spacing?.fieldGap)      vars['--field-gap']       = theme.spacing.fieldGap
  if (theme.spacing?.screenPadding) vars['--screen-padding']  = theme.spacing.screenPadding
  return vars
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/specs/theme.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/theme.ts lib/specs/theme.test.ts
git commit -m "feat: add ExperimentTheme type and themeToVars utility"
```

---

## Task 2: Add `theme` to `ExperimentFlow`

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Update `lib/types.ts`**

Add the import and field:

```typescript
import { FrameworkEdge } from "./edges";
import { FrameworkNode, PathNode, LoopNode } from "./nodes";
import { FrameworkScreen } from "./screen";
import { ExperimentTheme } from "./theme";

export type ExperimentFlow = {
  nodes: FrameworkNode[];
  edges: FrameworkEdge[];
  screens?: FrameworkScreen[];
  theme?: ExperimentTheme;
};
```

(All other types in the file remain unchanged.)

- [ ] **Step 2: Run full test suite to confirm nothing broke**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add theme field to ExperimentFlow"
```

---

## Task 3: Create `lib/registry.ts` and its tests

**Files:**
- Create: `lib/registry.tsx`
- Create: `src/specs/registry.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/specs/registry.test.tsx`:

```typescript
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComponentRegistryProvider, useComponentRegistry } from '@/lib/registry'

function RegistrySpy() {
  const registry = useComponentRegistry()
  return <div data-testid="keys">{Object.keys(registry).sort().join(',')}</div>
}

describe('ComponentRegistryProvider', () => {
  test('provides empty registry when none given', () => {
    render(
      <ComponentRegistryProvider registry={{}}>
        <RegistrySpy />
      </ComponentRegistryProvider>
    )
    expect(screen.getByTestId('keys').textContent).toBe('')
  })

  test('provides registry to consumers', () => {
    const MockButton = () => <button>mock</button>
    const MockRadio = () => <div>mock radio</div>
    render(
      <ComponentRegistryProvider registry={{ button: MockButton, radio: MockRadio }}>
        <RegistrySpy />
      </ComponentRegistryProvider>
    )
    expect(screen.getByTestId('keys').textContent).toBe('button,radio')
  })

  test('useComponentRegistry returns empty object when used outside provider', () => {
    render(<RegistrySpy />)
    expect(screen.getByTestId('keys').textContent).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/specs/registry.test.tsx
```

Expected: all tests fail with "Cannot find module '@/lib/registry'"

- [ ] **Step 3: Create `lib/registry.tsx`**

```typescript
import { createContext, useContext } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { Context } from './types'
import type {
  TextInputComponent,
  TextAreaComponent,
  NumericInputComponent,
  DateInputComponent,
  TimeInputComponent,
  SingleCheckboxComponent,
  CheckboxesComponent,
  RadioComponent,
  DropdownComponent,
  SliderComponent,
  LikertScaleComponent,
} from './components/response'
import type { ButtonComponent } from './components/layout'
import type { RichTextComponent } from './components/content'

type ResponseProps<C> = {
  component: C
  form: UseFormReturn<Record<string, any>>
  context: Context
}

export type TextInputRenderProps      = ResponseProps<TextInputComponent>
export type TextAreaRenderProps       = ResponseProps<TextAreaComponent>
export type NumericInputRenderProps   = ResponseProps<NumericInputComponent>
export type DateInputRenderProps      = ResponseProps<DateInputComponent>
export type TimeInputRenderProps      = ResponseProps<TimeInputComponent>
export type SingleCheckboxRenderProps = ResponseProps<SingleCheckboxComponent>
export type CheckboxesRenderProps     = ResponseProps<CheckboxesComponent>
export type RadioRenderProps          = ResponseProps<RadioComponent>
export type DropdownRenderProps       = ResponseProps<DropdownComponent>
export type SliderRenderProps         = ResponseProps<SliderComponent>
export type LikertScaleRenderProps    = ResponseProps<LikertScaleComponent>

export type ButtonRenderProps   = { component: ButtonComponent; isLoading: boolean }
export type RichTextRenderProps = { component: RichTextComponent; context: Context }

export type ComponentRegistry = Partial<{
  'text-input':      React.ComponentType<TextInputRenderProps>
  'text-area':       React.ComponentType<TextAreaRenderProps>
  'numeric-input':   React.ComponentType<NumericInputRenderProps>
  'date-input':      React.ComponentType<DateInputRenderProps>
  'time-input':      React.ComponentType<TimeInputRenderProps>
  'single-checkbox': React.ComponentType<SingleCheckboxRenderProps>
  'checkboxes':      React.ComponentType<CheckboxesRenderProps>
  'radio':           React.ComponentType<RadioRenderProps>
  'dropdown':        React.ComponentType<DropdownRenderProps>
  'slider':          React.ComponentType<SliderRenderProps>
  'likert-scale':    React.ComponentType<LikertScaleRenderProps>
  'button':          React.ComponentType<ButtonRenderProps>
  'rich-text':       React.ComponentType<RichTextRenderProps>
}>

const ComponentRegistryContext = createContext<ComponentRegistry>({})

export function ComponentRegistryProvider({
  registry,
  children,
}: {
  registry: ComponentRegistry
  children: React.ReactNode
}) {
  return (
    <ComponentRegistryContext.Provider value={registry}>
      {children}
    </ComponentRegistryContext.Provider>
  )
}

export function useComponentRegistry(): ComponentRegistry {
  return useContext(ComponentRegistryContext)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/specs/registry.test.tsx
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/registry.tsx src/specs/registry.test.tsx
git commit -m "feat: add ComponentRegistry context and RenderProps types"
```

---

## Task 4: Update `app/globals.css`

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the file contents**

```css
@import "tailwindcss";

/* Experiment design tokens — overridden per-experiment via wrapper inline style */
:root {
  --primary:            #60a6bc;
  --primary-foreground: #ffffff;
  --background:         #fafafa;
  --surface:            #ffffff;
  --surface-hover:      #f4f4f5;
  --foreground:         #1d1d1d;
  --muted-foreground:   #71717a;
  --border:             #d4d4d8;
  --error:              #fc1400;
  --radius:             0.125rem;
  --field-gap:          1rem;
  --screen-padding:     1.5rem;

  scroll-behavior: smooth;
}

/* Dynamic Tailwind utilities — resolved at runtime via CSS vars above */
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

/* Static design tokens */
@theme {
  --color-warning: #fcc500;
  --color-info:    #60a6bc;
  --color-black:   #1d1d1d;
  --color-light:   #fafafa;
  --color-success: #0cc084;
  --font-sans:     "Montserrat", sans-serif;
  --font-mono:     "Overpass Mono", monospace;
}

.debug {
  * {
    outline: 1px solid red;
  }
}
```

- [ ] **Step 2: Start the dev server and verify it compiles without errors**

```bash
npm run dev
```

Expected: server starts, no CSS compilation errors in terminal.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add @theme inline CSS vars for runtime theming"
```

---

## Task 5: Update `src/Experiment.tsx`

**Files:**
- Modify: `src/Experiment.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { getActiveState } from "@/lib/flow";
import { ComponentRegistryProvider } from "@/lib/registry";
import type { ComponentRegistry } from "@/lib/registry";
import { themeToVars } from "@/lib/theme";
import { Screen } from "@/src/Screen";
import Stepper from "@/src/components/Stepper";
import { useExperimentStore } from "@/src/data/store";
import { useEffect } from "react";

type Props = {
  startingNode?: string;
  components?: ComponentRegistry;
};

export default function Experiment({ startingNode, components = {} }: Props) {
  const { step, isLoading, start, next } = useExperimentStore();

  useEffect(() => {
    if (!step) {
      start(startingNode);
    }
  }, [step]);

  if (!step) {
    return (
      <>
        <h1 className="text-2xl font-semibold mb-6">Experiment</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(startingNode);
          }}
        >
          <button>start</button>
        </form>
      </>
    );
  }

  const activeState = getActiveState(step.state);
  const themeVars = themeToVars(step.experiment.theme) as React.CSSProperties;
  const fontFamily = step.experiment.theme?.typography?.fontFamily;

  return (
    <ComponentRegistryProvider registry={components}>
      <div style={{ ...themeVars, ...(fontFamily ? { fontFamily } : {}) }}>
        {activeState.type === "end" ? (
          <>
            <h1 className="text-2xl font-semibold mb-2">All done!</h1>
            <p className="text-zinc-500 mb-8">
              Thanks for completing the experiment.
            </p>
            <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4 overflow-auto max-h-64 text-zinc-700 dark:text-zinc-300">
              {JSON.stringify(step.context, null, 2)}
            </pre>
          </>
        ) : activeState.type === "in-node" && activeState.node.type === "screen" ? (
          <>
            {step.state.type === "in-path" && step.state.node.props.stepper && (
              <Stepper
                config={step.state.node.props.stepper}
                step={step.state.step}
                total={step.state.children.length}
              />
            )}
            {step.state.type === "in-loop" && step.state.node.props.stepper && (
              <Stepper
                config={step.state.node.props.stepper}
                step={step.state.index}
                total={step.state.values.length}
              />
            )}
            {(() => {
              const slug = activeState.node.props.slug;
              const screen = step.experiment.screens?.find((s) => s.slug === slug);
              return screen ? (
                <Screen
                  key={screen.slug}
                  screen={screen}
                  isLoading={isLoading}
                  onNext={next}
                  context={step.context}
                />
              ) : (
                <p className="text-red-500">Screen not found: {slug}</p>
              );
            })()}
            <div className="absolute w-[calc(100vw-512px)] h-[80svh] overflow-y-scroll right-0 top-0 p-2">
              <pre className="font-mono text-xs text-wrap">
                <code className="text-wrap">{JSON.stringify(step, null, 2)}</code>
              </pre>
            </div>
          </>
        ) : (
          <p className="text-zinc-400">Loading…</p>
        )}
      </div>
    </ComponentRegistryProvider>
  );
}
```

- [ ] **Step 2: Run test suite**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/Experiment.tsx
git commit -m "feat: inject theme CSS vars and registry context in Experiment"
```

---

## Task 6: Update `src/components/RenderComponent.tsx`

**Files:**
- Modify: `src/components/RenderComponent.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { Audio } from "./content/Audio";
import { Image } from "./content/Image";
import { RichText } from "./content/RichText";
import { Video } from "./content/Video";
import { Conditional } from "./control/Conditional";
import { ForEach } from "./control/ForEach";
import { Button } from "./layout/Button";
import { Group } from "./layout/Group";
import { Checkboxes } from "./response/Checkboxes";
import { DateInput } from "./response/DateInput";
import { Dropdown } from "./response/Dropdown";
import { LikertScale } from "./response/LikertScale";
import { NumericInput } from "./response/NumericInput";
import { Radio } from "./response/Radio";
import { SingleCheckbox } from "./response/SingleCheckbox";
import { Slider } from "./response/Slider";
import { TextArea } from "./response/TextArea";
import { TextInput } from "./response/TextInput";
import { TimeInput } from "./response/TimeInput";
import { RenderProps } from "./primitives";
import { deepMerge } from "@/lib/flow";
import { resolveValuesInString } from "@/lib/resolve";
import { useComponentRegistry } from "@/lib/registry";

const renderChild = (props: RenderProps) => <RenderComponent {...props} />;

export function RenderComponent({
  component,
  form,
  context: propContext,
  isLoading,
}: RenderProps) {
  const screenData = form.watch();
  const context = deepMerge(propContext, { screenData });
  const registry = useComponentRegistry();

  switch (component.componentFamily) {
    case "content": {
      switch (component.template) {
        case "rich-text": {
          const Custom = registry["rich-text"];
          const props = { component, context };
          return Custom ? <Custom {...props} /> : <RichText {...props} />;
        }
        case "image":
          return <Image component={component} />;
        case "video":
          return <Video component={component} />;
        case "audio":
          return <Audio component={component} />;
      }
    }

    case "response": {
      const resolvedComponent = deepMerge(component, {
        props: {
          dataKey: resolveValuesInString(component.props.dataKey, context),
        },
      });
      const props = { form, context, component: resolvedComponent };

      switch (component.template) {
        case "text-input": {
          const Custom = registry["text-input"];
          return Custom ? <Custom {...props} /> : <TextInput {...props} />;
        }
        case "text-area": {
          const Custom = registry["text-area"];
          return Custom ? <Custom {...props} /> : <TextArea {...props} />;
        }
        case "date-input": {
          const Custom = registry["date-input"];
          return Custom ? <Custom {...props} /> : <DateInput {...props} />;
        }
        case "time-input": {
          const Custom = registry["time-input"];
          return Custom ? <Custom {...props} /> : <TimeInput {...props} />;
        }
        case "numeric-input": {
          const Custom = registry["numeric-input"];
          return Custom ? <Custom {...props} /> : <NumericInput {...props} />;
        }
        case "single-checkbox": {
          const Custom = registry["single-checkbox"];
          return Custom ? <Custom {...props} /> : <SingleCheckbox {...props} />;
        }
        case "checkboxes": {
          const Custom = registry["checkboxes"];
          return Custom ? <Custom {...props} /> : <Checkboxes {...props} />;
        }
        case "radio": {
          const Custom = registry["radio"];
          return Custom ? <Custom {...props} /> : <Radio {...props} />;
        }
        case "dropdown": {
          const Custom = registry["dropdown"];
          return Custom ? <Custom {...props} /> : <Dropdown {...props} />;
        }
        case "slider": {
          const Custom = registry["slider"];
          return Custom ? <Custom {...props} /> : <Slider {...props} />;
        }
        case "likert-scale": {
          const Custom = registry["likert-scale"];
          return Custom ? <Custom {...props} /> : <LikertScale {...props} />;
        }
      }
    }

    case "layout": {
      switch (component.template) {
        case "button": {
          const Custom = registry["button"];
          const buttonProps = { component, isLoading };
          return Custom ? <Custom {...buttonProps} /> : <Button {...buttonProps} />;
        }
        case "group":
          return (
            <Group
              component={component}
              form={form}
              context={context}
              isLoading={isLoading}
              renderChild={renderChild}
            />
          );
      }
    }

    case "control": {
      switch (component.template) {
        case "conditional":
          return (
            <Conditional
              component={component}
              form={form}
              context={context}
              isLoading={isLoading}
              renderChild={renderChild}
            />
          );
        case "for-each":
          return (
            <ForEach
              component={component}
              form={form}
              context={context}
              isLoading={isLoading}
              renderChild={renderChild}
            />
          );
      }
    }
  }

  return (
    <pre className="text-xs my-2 bg-gray-50 p-2 rounded">
      <code>{JSON.stringify(component, null, 2)}</code>
    </pre>
  );
}
```

- [ ] **Step 2: Run test suite**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/RenderComponent.tsx
git commit -m "feat: check component registry before default render in RenderComponent"
```

---

## Task 7: Refactor `src/components/Input.tsx`

**Files:**
- Modify: `src/components/Input.tsx`

> After this task, `NumericInput`, `DateInput`, and `TimeInput` automatically inherit the token-based styling since they delegate to `Input`.

- [ ] **Step 1: Replace the file**

```typescript
import { twMerge } from "tailwind-merge";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: Props) {
  return (
    <input
      {...props}
      className={twMerge(
        "border-b border-border py-1 outline-none",
        "bg-transparent w-full placeholder:text-muted-foreground focus:border-primary",
        "transition-colors text-sm",
        props.className,
      )}
    />
  );
}
```

- [ ] **Step 2: Run test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/Input.tsx
git commit -m "refactor: use design tokens in Input component"
```

---

## Task 8: Refactor `src/components/response/TextArea.tsx`

**Files:**
- Modify: `src/components/response/TextArea.tsx`

> Note: `TextArea` has its own inline styles (does not delegate to `Input`). It also has a stale import of `inputBase` from `../primitives` — remove it.

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { TextAreaComponent } from "@/lib/components/response";
import { Context } from "@/lib/types";
import { UseFormReturn } from "react-hook-form";
import { twMerge } from "tailwind-merge";
import { Label } from "../Label";
import { FieldError } from "../primitives";

type Props = {
  component: TextAreaComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
};

export function TextArea({ component, form, context }: Props) {
  const {
    register,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={dataKey} context={context}>
        {component.props.label}
      </Label>
      <textarea
        id={dataKey}
        {...register(dataKey)}
        rows={component.props.lines ?? 4}
        placeholder={component.props.placeholder}
        className={twMerge(
          "border-b border-border py-1 outline-none",
          "bg-transparent w-full placeholder:text-muted-foreground focus:border-primary",
          "transition-colors text-sm resize-none",
        )}
      />
      <FieldError message={errors[dataKey]?.message as string | undefined} />
    </div>
  );
}
```

- [ ] **Step 2: Run test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/response/TextArea.tsx
git commit -m "refactor: use design tokens in TextArea, remove stale inputBase import"
```

---

## Task 9: Refactor `src/components/layout/Button.tsx`

**Files:**
- Modify: `src/components/layout/Button.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { twMerge } from "tailwind-merge";
import { ButtonComponent } from "@/lib/components/layout";

type Props = {
  component: ButtonComponent;
  isLoading: boolean;
};

export function Button({ component, isLoading }: Props) {
  return (
    <div className={twMerge(component.props.alignBottom ? "mt-auto pt-5" : "")}>
      <button
        type="submit"
        disabled={component.props.disabled || isLoading}
        className="w-full h-10 bg-primary text-primary-foreground uppercase text-sm font-medium tracking-wide rounded-[var(--radius)] hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        {isLoading ? "…" : (component.props.text ?? "Continue")}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Run test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Button.tsx
git commit -m "refactor: use design tokens in Button component"
```

---

## Task 10: Refactor `src/components/response/Radio.tsx`

**Files:**
- Modify: `src/components/response/Radio.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { RadioComponent } from "@/lib/components/response";
import { Context } from "@/lib/types";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Controller, UseFormReturn } from "react-hook-form";
import { Label } from "../Label";
import { FieldError, resolveOptions } from "../primitives";

type Props = {
  component: RadioComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
};

export function Radio({ component, form, context }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;

  return (
    <Controller
      control={control}
      name={dataKey}
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <Label context={context}>{component.props.label}</Label>
          <RadioGroupPrimitive.Root
            value={field.value}
            onValueChange={field.onChange}
            className="flex flex-col gap-2 mt-2"
          >
            {resolveOptions(component.props.options, context).map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupPrimitive.Item
                  id={`${dataKey}-${opt.value}`}
                  value={opt.value}
                  className="w-4 h-4 rounded-full border border-border flex items-center justify-center shrink-0 data-[state=checked]:border-primary transition-colors"
                >
                  <RadioGroupPrimitive.Indicator className="w-2 h-2 rounded-full bg-primary" />
                </RadioGroupPrimitive.Item>
                <Label
                  context={context}
                  className="text-sm"
                  htmlFor={`${dataKey}-${opt.value}`}
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroupPrimitive.Root>
          <FieldError
            message={errors[dataKey]?.message as string | undefined}
          />
        </div>
      )}
    />
  );
}
```

- [ ] **Step 2: Run test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/response/Radio.tsx
git commit -m "refactor: use design tokens in Radio component"
```

---

## Task 11: Refactor Checkboxes and SingleCheckbox

**Files:**
- Modify: `src/components/response/Checkboxes.tsx`
- Modify: `src/components/response/SingleCheckbox.tsx`

- [ ] **Step 1: Replace `src/components/response/Checkboxes.tsx`**

```tsx
"use client";

import { CheckboxesComponent } from "@/lib/components/response";
import { Context } from "@/lib/types";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Controller, UseFormReturn } from "react-hook-form";
import { twMerge } from "tailwind-merge";
import { Label } from "../Label";
import { CheckIcon, FieldError, resolveOptions } from "../primitives";

type Props = {
  component: CheckboxesComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
};

export function Checkboxes({ component, form, context }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;

  return (
    <Controller
      control={control}
      name={dataKey}
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <Label context={context}>{component.props.label}</Label>
          <div className="flex flex-col gap-2">
            {resolveOptions(component.props.options, context).map((opt) => {
              const checked =
                Array.isArray(field.value) && field.value.includes(opt.value);
              return (
                <div key={opt.value} className="flex items-center gap-2">
                  <CheckboxPrimitive.Root
                    id={`${dataKey}-${opt.value}`}
                    checked={checked}
                    onCheckedChange={(isChecked) => {
                      const current = Array.isArray(field.value)
                        ? field.value
                        : [];
                      field.onChange(
                        isChecked
                          ? [...current, opt.value]
                          : current.filter((v: string) => v !== opt.value),
                      );
                    }}
                    className={twMerge(
                      "size-4 border border-border rounded-[var(--radius)]",
                      "flex items-center justify-center shrink-0",
                      "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
                      "transition-colors duration-75",
                    )}
                  >
                    <CheckboxPrimitive.Indicator>
                      <CheckIcon />
                    </CheckboxPrimitive.Indicator>
                  </CheckboxPrimitive.Root>
                  <Label
                    className="text-sm"
                    htmlFor={`${dataKey}-${opt.value}`}
                  >
                    {opt.label}
                  </Label>
                </div>
              );
            })}
          </div>
          <FieldError
            message={errors[dataKey]?.message as string | undefined}
          />
        </div>
      )}
    />
  );
}
```

- [ ] **Step 2: Replace `src/components/response/SingleCheckbox.tsx`**

```tsx
"use client";

import { SingleCheckboxComponent } from "@/lib/components/response";
import { Context } from "@/lib/types";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Controller, UseFormReturn } from "react-hook-form";
import { twMerge } from "tailwind-merge";
import { Label } from "../Label";
import { CheckIcon, FieldError } from "../primitives";

type Props = {
  component: SingleCheckboxComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
};

export function SingleCheckbox({ component, form, context }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;

  return (
    <Controller
      control={control}
      name={dataKey}
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-2">
            <CheckboxPrimitive.Root
              id={`${dataKey}`}
              checked={field.value}
              onCheckedChange={field.onChange}
              className={twMerge(
                "size-4 border border-border rounded-[var(--radius)]",
                "flex items-center justify-center shrink-0",
                "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
                "transition-colors duration-75",
                "translate-y-0.5",
              )}
            >
              <CheckboxPrimitive.Indicator>
                <CheckIcon />
              </CheckboxPrimitive.Indicator>
            </CheckboxPrimitive.Root>
            <Label
              context={context}
              className="leading-tight text-sm"
              htmlFor={`${dataKey}`}
            >
              {component.props.label}
            </Label>
          </div>
          <FieldError
            message={errors[dataKey]?.message as string | undefined}
          />
        </div>
      )}
    />
  );
}
```

- [ ] **Step 3: Run test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/response/Checkboxes.tsx src/components/response/SingleCheckbox.tsx
git commit -m "refactor: use design tokens in Checkboxes and SingleCheckbox"
```

---

## Task 12: Refactor `src/components/response/Dropdown.tsx`

**Files:**
- Modify: `src/components/response/Dropdown.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { DropdownComponent } from "@/lib/components/response";
import { resolveValuesInString } from "@/lib/resolve";
import { Context } from "@/lib/types";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Controller, UseFormReturn } from "react-hook-form";
import { ChevronDownIcon, FieldError, resolveOptions } from "../primitives";
import { Label } from "../Label";

type Props = {
  component: DropdownComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
};

export function Dropdown({ component, form, context }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;

  return (
    <Controller
      control={control}
      name={dataKey}
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <Label htmlFor={dataKey} context={context}>
            {component.props.label}
          </Label>
          <SelectPrimitive.Root
            value={field.value}
            onValueChange={field.onChange}
          >
            <SelectPrimitive.Trigger
              id={dataKey}
              className="flex items-center justify-between border-b border-border pb-1 pt-1 w-full outline-none focus:border-primary transition-colors data-placeholder:text-muted-foreground text-sm"
            >
              <SelectPrimitive.Value placeholder="Select one" />
              <SelectPrimitive.Icon>
                <ChevronDownIcon />
              </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
              <SelectPrimitive.Content className="bg-surface border border-border shadow-md rounded-[var(--radius)] z-50 overflow-hidden">
                <SelectPrimitive.Viewport className="p-1">
                  {resolveOptions(component.props.options, context).map(
                    (opt) => (
                      <SelectPrimitive.Item
                        key={opt.value}
                        value={opt.value}
                        className="flex items-center px-3 py-2 text-sm cursor-pointer outline-none data-highlighted:bg-surface-hover rounded-[var(--radius)]"
                      >
                        <SelectPrimitive.ItemText>
                          {opt.label}
                        </SelectPrimitive.ItemText>
                      </SelectPrimitive.Item>
                    ),
                  )}
                </SelectPrimitive.Viewport>
              </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
          </SelectPrimitive.Root>
          <FieldError
            message={errors[dataKey]?.message as string | undefined}
          />
        </div>
      )}
    />
  );
}
```

- [ ] **Step 2: Run test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/response/Dropdown.tsx
git commit -m "refactor: use design tokens in Dropdown component"
```

---

## Task 13: Refactor `src/components/response/Slider.tsx`

**Files:**
- Modify: `src/components/response/Slider.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { SliderComponent } from "@/lib/components/response";
import { Context } from "@/lib/types";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Controller, UseFormReturn } from "react-hook-form";
import { Label } from "../Label";
import { FieldError } from "../primitives";

type Props = {
  component: SliderComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
};

export function Slider({ component, form, context }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;
  const min = component.props.min ?? 0;
  const max = component.props.max ?? 100;

  return (
    <Controller
      control={control}
      name={dataKey}
      render={({ field }) => {
        const value = field.value ?? min;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label context={context}>{component.props.label}</Label>
              {component.props.showValue && (
                <span className="text-sm font-medium tabular-nums">
                  {value}
                </span>
              )}
            </div>
            <div>
              <SliderPrimitive.Root
                value={[value]}
                min={min}
                max={max}
                step={component.props.step ?? 1}
                onValueChange={([val]) => field.onChange(val)}
                className="relative flex items-center w-full h-5 select-none touch-none"
              >
                <SliderPrimitive.Track className="relative h-px bg-border flex-1 rounded-full">
                  <SliderPrimitive.Range className="absolute h-full bg-primary rounded-full" />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className="block w-4 h-4 bg-primary rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/20 cursor-grab active:cursor-grabbing" />
              </SliderPrimitive.Root>
            </div>
            {(component.props.minLabel || component.props.maxLabel) && (
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {component.props.minLabel}
                </span>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {component.props.maxLabel}
                </span>
              </div>
            )}
            <FieldError
              message={errors[dataKey]?.message as string | undefined}
            />
          </div>
        );
      }}
    />
  );
}
```

- [ ] **Step 2: Run test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/response/Slider.tsx
git commit -m "refactor: use design tokens in Slider component"
```

---

## Task 14: Refactor `src/components/response/LikertScale.tsx`

**Files:**
- Modify: `src/components/response/LikertScale.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { LikertScaleComponent } from "@/lib/components/response";
import { Context } from "@/lib/types";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Controller, UseFormReturn } from "react-hook-form";
import { twMerge } from "tailwind-merge";
import { Label } from "../Label";
import { FieldError } from "../primitives";

type Props = {
  component: LikertScaleComponent;
  form: UseFormReturn<Record<string, any>>;
  context: Context;
};

export function LikertScale({ component, form, context }: Props) {
  const {
    control,
    formState: { errors },
  } = form;
  const { dataKey } = component.props;
  const options = component.props.options;

  return (
    <Controller
      control={control}
      name={dataKey}
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <Label id={`${dataKey}-label`} context={context}>
            {component.props.label}
          </Label>
          <RadioGroupPrimitive.Root
            value={field.value}
            onValueChange={field.onChange}
            aria-labelledby={`${dataKey}-label`}
            className="flex justify-between mt-3 flex-row gap-4 items-start"
          >
            {options.map((opt, i) => (
              <div
                key={opt.value}
                className="flex justify-center items-center flex-col flex-1 gap-1"
              >
                <RadioGroupPrimitive.Item
                  id={`${dataKey}-${opt.value}`}
                  value={opt.value}
                  aria-label={
                    opt.label
                      ? `${opt.value} — ${opt.label}`
                      : String(opt.value)
                  }
                  className="size-8 rounded-full relative border border-border flex items-center justify-center shrink-0 data-[state=checked]:border-primary transition-colors"
                >
                  <span className="text-xs absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 text-muted-foreground">
                    <span className="ml-0.5">{i + 1}</span>
                  </span>
                  <RadioGroupPrimitive.Indicator
                    className={twMerge(
                      "size-6 flex items-center justify-center text-xs rounded-full",
                      "bg-primary text-primary-foreground z-10 text-center",
                    )}
                  >
                    {i + 1}
                  </RadioGroupPrimitive.Indicator>
                </RadioGroupPrimitive.Item>
                {opt.label && (
                  <Label
                    htmlFor={`${dataKey}-${opt.value}`}
                    context={context}
                    className="text-xs w-full text-center text-balance"
                  >
                    {opt.label}
                  </Label>
                )}
              </div>
            ))}
          </RadioGroupPrimitive.Root>
          <FieldError
            message={errors[dataKey]?.message as string | undefined}
          />
        </div>
      )}
    />
  );
}
```

- [ ] **Step 2: Run test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/response/LikertScale.tsx
git commit -m "refactor: use design tokens in LikertScale component"
```

---

## Task 15: Refactor `src/components/Stepper.tsx`

**Files:**
- Modify: `src/components/Stepper.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { StepperConfig } from "@/lib/nodes";

type Props = {
  config: StepperConfig;
  step: number;
  total: number;
};

export default function Stepper({ config, step, total }: Props) {
  return (
    <div className="w-full mb-6">
      {config.label ? (
        <p className="text-sm text-muted-foreground mb-2">
          {config.label
            .replace("{index}", String(step + 1))
            .replace("{total}", String(total))}
        </p>
      ) : null}
      <div className="h-1 w-full bg-border rounded-full overflow-hidden">
        {config.style === "dashed" ? (
          <div className="h-full flex gap-0.5">
            {Array.from({ length: total }, (_, index) => (
              <div
                key={index}
                className={`h-full flex-1 ${index < step + 1 ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </div>
        ) : (
          <div
            className="h-full bg-primary"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/Stepper.tsx
git commit -m "refactor: use design tokens in Stepper component"
```

---

## Task 16: Refactor `src/components/content/RichText.tsx`

**Files:**
- Modify: `src/components/content/RichText.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { RichTextComponent } from "@/lib/components/content";
import { resolveValuesInString } from "@/lib/resolve";
import { Context } from "@/lib/types";
import Markdown from "react-markdown";

type Props = {
  component: RichTextComponent;
  context: Context;
};

export function RichText({ component, context }: Props) {
  const { content } = component.props;
  return (
    <div>
      <Markdown
        components={{
          h1: ({ node, ...props }) => (
            <h1 {...props} className="text-5xl font-bold mb-4" />
          ),
          h2: ({ node, ...props }) => (
            <h2 {...props} className="text-3xl font-bold mb-3" />
          ),
          h3: ({ node, ...props }) => (
            <h3 {...props} className="text-xl font-bold mb-2" />
          ),
          p: ({ node, ...props }) => (
            <p {...props} className="text-foreground mb-[1lh]" />
          ),
          a: ({ node, ...props }) => (
            <a {...props} className="text-info underline" />
          ),
          strong: ({ node, ...props }) => (
            <strong {...props} className="font-bold" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc list-inside mb-2" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal list-inside mb-2" />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              {...props}
              className="border-l-4 border-border pl-4 text-muted-foreground"
            />
          ),
          code: ({ node, ...props }) => (
            <code
              {...props}
              className="bg-surface text-foreground rounded p-1 text-sm whitespace-break-spaces"
            />
          ),
          pre: ({ node, ...props }) => (
            <pre
              {...props}
              className="bg-surface text-foreground rounded text-sm [&>code]:block [&>code]:bg-transparent"
            />
          ),
        }}
      >
        {resolveValuesInString(content, context)}
      </Markdown>
    </div>
  );
}
```

- [ ] **Step 2: Run test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/content/RichText.tsx
git commit -m "refactor: use design tokens in RichText component"
```

---

## Task 17: Update `src/Screen.tsx` for `fieldGap` token

**Files:**
- Modify: `src/Screen.tsx`

- [ ] **Step 1: Replace the `gap-4` class on the form element**

In `src/Screen.tsx`, change line 69:

```tsx
// Before
<form
  className="h-full flex-1 flex flex-col gap-4"

// After
<form
  className="h-full flex-1 flex flex-col gap-[var(--field-gap)]"
```

- [ ] **Step 2: Run test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/Screen.tsx
git commit -m "refactor: use --field-gap token for form spacing in Screen"
```

---

## Final Verification

- [ ] **Run full test suite one last time**

```bash
npm test
```

Expected: all tests pass, no regressions.

- [ ] **Smoke test in browser**

Start dev server (`npm run dev`) and manually verify:
1. Default experiment renders correctly — colors and styles match the original design
2. Adding a `theme` to the experiment config (e.g. `colors: { primary: "#e63946" }`) changes the button, slider, checkboxes, radio, and focus states
3. Changing `radius: "0.5rem"` rounds buttons, checkboxes, and dropdown panels
4. Changing `typography.fontFamily: "Georgia, serif"` changes all text
5. Changing `spacing.fieldGap: "2rem"` increases space between form fields
6. Passing `components={{ button: MyButton }}` to `<Experiment>` renders `MyButton` instead of the default
