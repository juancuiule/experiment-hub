# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

An adaptive experiment runner for behavioral research. Researchers define branching, looping, and randomized participant flows as typed TypeScript object literals; the engine renders them as structured multi-screen web studies.

## Stack

- Next.js 16.1.6 (App Router), React 19, TypeScript 5 (strict)
- Tailwind CSS 4, Radix UI primitives
- Zustand 5 (experiment state), react-hook-form + Zod (per-screen validation)
- Vitest 4 + happy-dom (unit tests), Playwright (e2e)
- pnpm 9 is the canonical package manager (CI uses it; ignore `package-lock.json`)

## Essential commands

```bash
pnpm dev           # start dev server
pnpm build         # Next.js production build
pnpm lint          # eslint (eslint.config.mjs)
pnpm test          # vitest run — all unit tests
pnpm test:watch    # vitest — watch mode
pnpm test:e2e      # playwright test — e2e suite
```

Run a single test file:
```bash
pnpm vitest run lib/specs/flow.test.ts
pnpm vitest run lib/specs/flow-validation.test.ts
```

Vitest accepts a file path or pattern as a positional argument. Test files live under `lib/specs/` (engine) and `src/specs/` (React components).

## Architecture

The codebase has two distinct layers that must stay decoupled:

```
lib/           # Pure TypeScript engine — zero React imports
  flow.ts      # State machine: traverse(), enterStep(), traverseInPath/Loop()
  types.ts     # ExperimentFlow, FlowStep, State, Context — all core types
  nodes.ts     # Node type interfaces (start, checkpoint, screen, branch, path, fork, loop, compute)
  edges.ts     # Edge type definitions (sequential, branch-*, path-contains, loop-template, fork-edge)
  conditions.ts       # Condition evaluation
  resolve.ts          # Data key resolution and {{ }} string interpolation
  flow-validation.ts  # validateExperiment() — static graph validator, 15 error codes
  screen-schema.ts    # buildSchema() — Zod schema builder for per-screen form validation
  field-schema.ts     # Field schema extraction from screen component definitions
  fields.ts           # collectFields() — flat field descriptor list from screen components
  component-walker.ts # flatMap() — tree-shaped traversal over screen components
  components/         # Component type definitions (content, response, layout, control)
  specs/              # Unit tests for the engine

src/           # Next.js React application
  Experiment.tsx         # Runner: reads store, dispatches start()/next(), renders Screen
  Screen.tsx             # Per-screen form: react-hook-form + zodResolver(buildSchema(...))
  data/
    experiment.ts        # EXPERIMENTS record keyed by slug — all active experiment configs
    store.ts             # Zustand store with start(startNodeId?, experimentOverride?) and next(data?)
  components/
    RenderComponent.tsx  # Dispatcher: routes by componentFamily + template to concrete components
    content/             # RichText, Image, Video, Audio
    response/            # 11 response input components (slider, radio, checkboxes, etc.)
    layout/              # Button, Group
    control/             # Conditional, ForEach

app/                     # Next.js App Router
  experiments/[slug]/page.tsx  # Validates experiment, selects start node, mounts Experiment
  page.tsx / layout.tsx
e2e/                     # Playwright tests
docs/                    # Reference documentation (see below)
```

The flow engine (`lib/`) has no React dependency and is fully unit-tested. The React layer drives it by calling `startExperiment()` once and `traverse(step, formData)` on each screen submission.

## How experiments are defined

All experiments live in `src/data/experiment.ts` as entries in the `EXPERIMENTS` record:

```ts
export const EXPERIMENTS: Record<string, ExperimentFlow> = {
  "my-study": { nodes: [...], edges: [...], screens: [...], options: {...} }
};
```

The route `app/experiments/[slug]/page.tsx` looks up `EXPERIMENTS[slug]`, calls `validateExperiment()`, and renders `<ValidationErrors>` if any errors are returned — so misconfigured graphs are caught before the participant sees anything.

Start node selection is driven by query-string params: `?condition=A` matches a `StartNode` whose `props.param` equals `{ key: "condition", value: "A" }`. This enables within-experiment condition assignment without separate URLs.

## Non-obvious conventions

**`shouldUnregister: true`** in `Screen.tsx`'s `useForm` call is intentional: unmounted components (those hidden by `conditional`) do not retain their values in the submitted form data.

**`Zustand persist` is commented out** in `src/data/store.ts`. Browser refresh resets the experiment. This is a known limitation, not a bug to fix casually — re-enabling it requires implementing session resume logic.

**`send()` in `lib/utils.ts` is a stub.** `checkpoint` nodes call `send(context)` to persist data — currently a 100ms `setTimeout`. Replace with a real API POST before running participant-facing studies.

**Debug panels are always visible.** `<StateDebug>`, `<DataDebug>`, and the form data `<DataSection>` in `Screen.tsx` render as `<details>` elements with no dev-only guard. They expose raw JSON to participants in the current state.

**Option anchoring** — response options accept `anchor: "first" | "last"` to pin specific choices to the ends of a shuffled list. Handled by `shuffleAnchored()` in `lib/utils.ts`.

**pnpm is the canonical package manager.** A `package-lock.json` exists in the repo but is stale. Always use `pnpm`; the CI pipeline uses pnpm 9 exclusively.

## Anti-patterns

**Do not import React anywhere inside `lib/`.** The engine is deliberately framework-agnostic. Tests in `lib/specs/` run without a DOM renderer. Any React import in that layer breaks the isolation.

**Do not use `$fieldName` references outside `RenderComponent`.** `RenderComponent.tsx` merges `form.watch()` into context before resolving props. The engine's `resolve.ts` and condition evaluator never have access to live form state — `$` references in branch conditions or loop `dataKey` fields silently resolve to nothing.

**Do not uncomment `Zustand persist` without implementing session resume.** Restoring persisted state mid-experiment requires knowing which step to re-enter and which context to restore. It's not a one-line change.

**Do not ship the current UI to participants without removing debug panels.** There is no environment flag guarding `<StateDebug>` or `<DataSection>`. They must be explicitly removed or conditionally gated before any participant-facing deployment.

## Agent workflow

When picking up an issue:

1. Branch from `main` as `feature/<name>` or `fix/<name>`.
2. Implement. Keep changes scoped to the issue.
3. Run `pnpm lint && pnpm test` before committing. Both must pass.
4. Use conventional commit prefixes: `feat:`, `fix:`, `test:`, `refactor:`.
5. Open a PR against `main` with `gh pr create`, referencing the issue number.
6. CI runs `pnpm test` and `pnpm test:e2e` automatically — both must pass before merge.

## Commit and branch conventions

From git history:
- Feature branches: `feature/<name>` (e.g. `feature/compute-node`, `feature/shared-options`)
- Bug fix branches: `fix/<name>` (e.g. `fix/in-path-stepper`)
- Commit messages use `feat:`, `fix:`, `test:`, `refactor:` prefixes for new work; plain imperatives for small changes
- All PRs target `main`
- CI runs `pnpm test` and `pnpm test:e2e` on every PR before merge

## Environment variables

The application reads no environment variables at runtime. The E2E CI job sets `NODE_ENV=test`. There is no `.env.example` or any `process.env` access in the codebase.

## Sensitive files

Changing these incorrectly breaks participant-facing behavior:

- `src/data/experiment.ts` — the `EXPERIMENTS` dict; removing or renaming a key breaks its route
- `lib/flow.ts` — the traversal state machine; affects path step counting and all data nesting
- `lib/flow-validation.ts` — any regression here silently allows malformed experiments through
- `lib/screen-schema.ts` — `buildSchema()` failing silently disables all per-screen form validation

## Documentation

The `docs/` folder contains precise reference documentation — use it before reading source code for domain questions:

| File | Contents |
|---|---|
| `docs/experiment.md` | `ExperimentFlow` top-level structure |
| `docs/nodes.md` | All 7 node types with full property docs |
| `docs/edges.md` | All edge types and node-to-edge validation rules |
| `docs/components.md` | All component types and their props (content, response, layout, control) |
| `docs/data-keys.md` | The 5 reference prefixes: `$$`, `@`, `$`, `#`, `%` |
| `docs/answer-piping.md` | String interpolation in labels and content (`{{ }}` syntax) |
| `docs/codebook.md` | Auto-generated data dictionary derived from the typed config |
| `docs/validate.md` | All 15 validation error codes with explanations |

## Where to look first

| Question | Start here |
|---|---|
| How the state machine works | `lib/flow.ts` — `traverse()`, `enterStep()`, `traverseInNode/Path/Loop()` |
| All core type definitions | `lib/types.ts` — `ExperimentFlow`, `State`, `Context`, `FlowStep` |
| What node types exist | `lib/nodes.ts` |
| What validation checks run | `lib/flow-validation.ts` — `validateExperiment()` |
| How a screen form is wired | `src/Screen.tsx` — `useForm` + `buildSchema` + `buildDefaultValues` |
| How a component gets rendered | `src/components/RenderComponent.tsx` — switch on `componentFamily` + `template` |
| Where experiments are registered | `src/data/experiment.ts` — `EXPERIMENTS` |
| How a URL maps to an experiment | `app/experiments/[slug]/page.tsx` |
| Engine behavior examples | `lib/specs/flow/` — traversal tests covering branch, path, loop, fork |
