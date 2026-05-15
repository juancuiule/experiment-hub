# Experiment Runner

An adaptive experiment runner for behavioral research. Define branching, looping, and randomized participant flows as typed graph configs; render them as structured multi-screen web studies.

---

## The Problem

Researchers running online behavioral studies — psychology experiments, UX tests, clinical screeners — face a difficult tradeoff:

**Commercial survey tools** (Qualtrics, SurveyMonkey, Gorilla) offer drag-and-drop authoring but fall short on complex adaptive designs: multi-level loops, probability-weighted random assignment, composite branching conditions across many responses, or nested path structures with per-path progress indicators.

**Custom code** offers full flexibility but requires developer involvement for every new study, making iteration slow and error-prone.

This project occupies the space between them: a typed, declarative experiment schema expressive enough to handle complex adaptive designs, paired with a React participant UI and a static validator that catches misconfigured flows before anyone runs them.

---

## Core Ideas

### Experiments as graphs

An experiment is a directed graph of **nodes** connected by **edges**. The researcher defines the graph; the engine traverses it as a state machine.

```
start → screen[welcome] → branch[age-check] → screen[adult-path]
                                            ↘ screen[minor-path]
```

Nodes represent steps; edges define how the engine moves between them.

### Node types

| Node | Purpose |
|---|---|
| `start` | Entry point. Supports multiple named entry points via URL parameters. |
| `screen` | Displays a screen to the participant. Each screen is a list of components. |
| `branch` | Evaluates conditions against collected data and routes to the first matching arm (or a default). |
| `fork` | Random assignment. Each arm has a weight; the engine selects one probabilistically. |
| `path` | A sequential group of child nodes, optionally randomized. Supports a progress stepper. |
| `loop` | Repeats a template node over a list of values — either static or drawn from collected data. |
| `checkpoint` | Triggers a data submission at a specific point in the flow (useful for long studies). |

### Screen components

Each screen is composed of typed components across four families:

- **Content** — `rich-text`, `image`, `video`, `audio`. Display only, no data collected.
- **Response** — `slider`, `radio`, `checkboxes`, `likert-scale`, `text-input`, `text-area`, `numeric-input`, `date-input`, `time-input`, `single-checkbox`, `dropdown`. Each stores its value under a typed `dataKey`.
- **Layout** — `button` (advances the screen), `group` (wraps child components).
- **Control** — `conditional` (shows a component only when a condition is met), `for-each` (renders a component template once per item in a list).

### Data references

Collected values are referenced using a prefix notation:

| Prefix | Scope | Example |
|---|---|---|
| `$$` | Experiment-wide collected data | `$$demographics.age` |
| `@` | Current loop iteration | `@value`, `@index` |
| `$` | Current screen's live form values | `$hasChildren` |

These references are used in branch conditions, answer piping (string interpolation inside labels and content), and conditional rendering.

### Answer piping

Any string prop — labels, rich-text content — can interpolate collected values using `{{ }}` template syntax:

```
"How are you feeling about {{$$welcome.name}}'s results?"
"Rate your experience with {{@value}}"
```

### Conditions

Branch conditions and `conditional` components use a composable condition structure:

```ts
// simple comparison
{ type: "simple", operator: "gte", dataKey: "$$screening.age", value: 18 }

// compound
{ type: "and", conditions: [
  { type: "simple", operator: "eq", dataKey: "$$consent.agreed", value: true },
  { type: "simple", operator: "gte", dataKey: "$$screening.age", value: 18 },
]}
```

Available operators: `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `contains`, `length-eq`, `length-lt`, `length-gt`, and their variants.

### Static validation

`validateExperiment(flow)` walks the graph before the participant ever sees it and returns typed errors for:

- Duplicate node IDs, missing start node
- Edges referencing nodes that don't exist
- Branch nodes missing a default arm
- Screen nodes with no matching screen definition
- `$$` references used before the corresponding data is collected in the flow
- `@` references used outside a loop context

This makes misconfigured experiments a build-time problem rather than a runtime surprise.

---

## Architecture

```
lib/                    # Pure, framework-agnostic engine
  flow.ts               # State machine: traverse, enterStep, traverseInPath/Loop
  types.ts              # ExperimentFlow, FlowStep, State, Context
  nodes.ts              # Node type definitions
  edges.ts              # Edge type definitions
  conditions.ts         # Condition evaluation
  resolve.ts            # Data key resolution and string interpolation
  validation.ts         # Zod schema builder for per-screen form validation
  validate.ts           # Static experiment graph validator
  screen.ts             # FrameworkScreen type
  components/           # Component type definitions (content, response, layout, control)

src/                    # Next.js React application
  Experiment.tsx        # Top-level experiment runner component
  Screen.tsx            # Screen renderer with react-hook-form integration
  data/
    experiment.ts       # Active experiment config (currently a dev fixture)
    store.ts            # Zustand store: step, start(), next()
  components/
    RenderComponent.tsx # Component dispatcher
    content/            # RichText, Image, Video, Audio
    response/           # All response input components
    layout/             # Button, Group
    control/            # Conditional, ForEach
    Stepper.tsx         # Progress indicator

app/                    # Next.js App Router
  page.tsx              # Mounts the Experiment component
  layout.tsx            # Root layout

docs/                   # Domain reference documentation
specs/                  # Feature specs (draft)
```

The flow engine in `lib/` has no React dependency and is fully unit-tested. The React layer drives it by calling `startExperiment()` once and `traverse(step, formData)` on each screen submission.

---

## Current State

This project is an **early-stage working prototype**. The flow engine and component library are functional; the infrastructure around them is scaffolding.

### What works

- Full flow traversal: branch, fork, path, loop, checkpoint
- All 11 response component types with Zod-based form validation
- Answer piping in labels and rich-text content
- Conditional rendering within screens (`conditional`, `for-each`)
- Static experiment validator with 14 error codes
- Unit test suite for the flow engine

### What is missing or incomplete

**Session persistence** — Zustand's `persist` middleware is present in `src/data/store.ts` but commented out. Any browser refresh resets the experiment from the beginning. Spec: `specs/session-persistence.md`.

**Data submission** — `send()` in `lib/utils.ts` is a 1ms timeout stub. Checkpoint and end-of-experiment data never reaches any backend. Replacing this with a real POST to a configurable endpoint is the first required step before running real studies.

**Visual flow builder** — Experiments are currently defined as TypeScript object literals in `src/data/experiment.ts`. A drag-and-drop canvas editor using `@xyflow/react` is specced but not started. Spec: `specs/visual-flow-builder.md`.

**Score variables** — There is no way to compute derived values (e.g. sum of five Likert items) and branch on them. Spec: `specs/score-variables.md`.

**Back navigation** — Participants cannot go back to a previous screen. Spec: `specs/back-navigation.md`.

**Answer piping coverage** — Interpolation works in `rich-text` content and component labels, but not yet in option labels, placeholders, or button text. Spec: `specs/answer-piping.md`.

**Debug artifacts** — The current UI renders raw JSON debug panels (flow state, form values) directly on screen. These exist for development only and must be removed before any participant-facing deployment.

---

## Running locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The active experiment is defined in `src/data/experiment.ts`.

### Tests

```bash
pnpm test
```

Unit tests live in `lib/specs/` and `src/specs/`. The flow engine tests cover branch, fork, path, loop, integration, and validation scenarios.

---

## Defining an experiment

An experiment config is an `ExperimentFlow` object:

```ts
import { ExperimentFlow } from "@/lib/types";

export const experiment: ExperimentFlow = {
  nodes: [
    { id: "start", type: "start" },
    { id: "screen-welcome", type: "screen", props: { slug: "welcome" } },
    {
      id: "branch-age",
      type: "branch",
      props: {
        name: "Age gate",
        branches: [
          {
            id: "adult",
            name: "Adult",
            config: { type: "simple", operator: "gte", dataKey: "$$welcome.age", value: 18 },
          },
        ],
      },
    },
    { id: "screen-adult", type: "screen", props: { slug: "adult-content" } },
    { id: "screen-ineligible", type: "screen", props: { slug: "ineligible" } },
  ],
  edges: [
    { type: "sequential", from: "start", to: "screen-welcome" },
    { type: "sequential", from: "screen-welcome", to: "branch-age" },
    { type: "branch-condition", from: "branch-age.adult", to: "screen-adult" },
    { type: "branch-default", from: "branch-age", to: "screen-ineligible" },
  ],
  screens: [
    {
      slug: "welcome",
      components: [
        { componentFamily: "content", template: "rich-text", props: { content: "## Welcome\nHow old are you?" } },
        { componentFamily: "response", template: "numeric-input", props: { label: "Age", dataKey: "age", min: 0, max: 120 } },
        { componentFamily: "layout", template: "button", props: { text: "Continue" } },
      ],
    },
    // ...
  ],
};
```

Before using a config in production, run:

```ts
import { validateExperiment } from "@/lib/validate";

const errors = validateExperiment(experiment);
if (errors.length > 0) {
  console.error(errors);
}
```
