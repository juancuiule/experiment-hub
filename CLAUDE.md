# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

An adaptive experiment runner for behavioral research. Researchers define branching, looping, and randomized participant flows as typed TypeScript object literals; the engine renders them as structured multi-screen web studies.

## Stack

- Next.js 16.1.6 (App Router), React 19, TypeScript 5 (strict)
- Tailwind CSS 4, Radix UI primitives
- Zustand 5 (experiment state), react-hook-form + Zod (per-screen validation)
- Vitest 4 + happy-dom (unit tests), Playwright (e2e)
- Effect 4 RC (`effect`, `@effect/platform-node`, `@effect/sql-sqlite-node`) for `apps/backend`; Vitest 5 + `@effect/vitest` there
- pnpm 9 is the canonical package manager (CI uses it)

## Essential commands

```bash
pnpm dev           # start dev server (runs from repo root)
pnpm dev:backend   # start backend dev server on :3100 (tsx watch)
pnpm --filter @experiment-hub/backend seed   # publish the authored experiment
                   # corpus into the dev DB — required once before experiment
                   # pages work locally (page.tsx fetches configs from the API)
pnpm build         # Next.js production build
pnpm lint          # eslint (eslint.config.mjs)
pnpm test          # vitest run — all unit tests (engine + frontend + backend)
pnpm test:watch    # vitest — watch mode
pnpm test:e2e      # playwright test — e2e suite
pnpm typecheck     # tsc --noEmit across all workspace packages (pnpm -r typecheck)
```

Run a single test file:
```bash
pnpm --filter @experiment-hub/engine exec vitest run specs/conditions.test.ts
pnpm --filter @experiment-hub/frontend exec vitest run src/specs/store.test.ts
```

Vitest accepts a file path or pattern as a positional argument. Test files live under `packages/engine/specs/` (engine) and `apps/frontend/src/specs/` (React components). E2E tests live under `apps/frontend/e2e/`.

## Architecture

This is a pnpm workspace with two packages that must stay decoupled:

```
packages/engine/             # Pure TypeScript engine — zero React imports
                             # Published in-workspace as @experiment-hub/engine
  flow/                      # State machine (directory)
    traverse.ts              # traverse(), enterStep(), traverseInPath/Loop()
    graph.ts                 # Graph helpers
    context.ts               # Context construction
    formulas.ts              # Formula evaluation
    timing.ts                # Timing utilities
    shuffles.ts              # Shuffle helpers
    visibility.ts            # Visibility evaluation
    index.ts                 # Re-exports
  experiment-validation/     # Static graph validator (directory)
    index.ts                 # validateExperiment() — exports ValidationError[]
    check-*.ts               # 10 individual check modules
    validate-condition-structure.ts
  types.ts                   # ExperimentFlow, FlowStep, State, Context — all core types
  nodes.ts                   # Node type interfaces (start, checkpoint, screen, branch,
                             #   path, fork, loop, compute, data)
  edges.ts                   # Edge type definitions (sequential, branch-*, path-contains,
                             #   loop-template, fork-edge)
  conditions.ts              # Condition evaluation
  resolve.ts                 # Data key resolution and {{ }} string interpolation
  screen-schema.ts           # buildSchema() — Zod schema builder for per-screen form validation
  screen-bindings.ts         # Screen binding helpers
  field-schema.ts            # Field schema extraction from screen component definitions
  fields.ts                  # collectFields() — flat field descriptor list from screen components
  component-walker.ts        # flatMap() — tree-shaped traversal over screen components
  tokens.ts                  # Token definitions
  i18n.ts                    # i18n helpers
  utils.ts                   # Shared utilities incl. shuffleAnchored()
  screen.ts                  # Screen-level utilities
  components/                # Component type definitions (content, response, layout, control)
  specs/                     # Unit tests for the engine

apps/frontend/               # Next.js React application
                             # Published in-workspace as @experiment-hub/frontend
  app/
    (experiments-layout)/
      experiments/[slug]/
        page.tsx             # Validates experiment, selects start node, mounts Experiment
    page.tsx / layout.tsx
  src/
    Experiment.tsx           # Runner: reads store, dispatches start()/next(), renders Screen
    Screen.tsx               # Per-screen form: react-hook-form + zodResolver(buildSchema(...))
    data/
      experiments/           # EXPERIMENTS record — one file per experiment
        index.ts             # Exports the EXPERIMENTS record keyed by slug
        ocean.ts, emociones.ts, pandemic.ts, …
      store.ts               # Zustand store — start(experiment, startNodeId?, locale?, slug?)
                             #   registers a run (createRun) and next(data?)
      send.ts                # createRun() + checkpoint POSTs to /api/runs/:runId/checkpoints
    components/
      RenderComponent.tsx    # Dispatcher: routes by componentFamily + template to concrete components
      content/               # RichText, Image, Video, Audio
      response/              # 12 response input components (slider, radio, checkboxes, etc.)
      layout/                # Button, Group
      control/               # Conditional, ForEach
    specs/                   # Unit tests for React components
  e2e/                       # Playwright tests

apps/backend/                # Effect 4 HTTP API — checkpoint persistence + export
  src/
    api.ts                   # HttpApi contract: runs / export / experiments / admin / system
    config.ts                # BackendConfig — PORT, HOST, DB_PATH, EXPORT_TOKEN, RUN_TOKEN_SECRET, ALLOWED_EXPERIMENTS, NODE_ENV
    db.ts                    # SqliteClient + SqliteMigrator (runs, checkpoints, experiments tables)
    checkpoints.ts           # Checkpoints service — record + exportByExperiment
    experiments.ts           # Experiments service — publish (validateExperiment gate),
                             #   publishIfMissing, getBySlug, list, content-hash versioning
    backfill.ts              # Boot seeding — reads SEED_CONFIGS_DIR, registers absent slugs
    auth.ts                  # ExportToken middleware impl (timingSafeEqual)
    handlers.ts              # HttpApiBuilder groups wiring services to routes
    server.ts                # Entrypoint — HttpRouter.serve + NodeHttpServer + Layer.launch
    test-helpers.ts          # Shared test layers/clients (seeded in-memory sqlite)
    checkpoints.test.ts      # HttpApiTest suite
    experiments.test.ts      # Publish/serve/version-pinning suite
  scripts/
    seed.ts                  # Publishes the authored corpus into DB_PATH via the
                             #   service layer (no HTTP/token needed)
    export-configs.ts        # Writes configs/<slug>.json canonical artifacts
                             #   (what the prod image backfills from)
  configs/                   # Committed canonical JSON of the authored corpus —
                             #   regenerated by export:configs, checked by
                             #   configs-sync.test.ts, shipped in the image

infra/nginx/default.conf     # Single-origin path split: / -> frontend, /api/* -> backend
docker-compose.yml           # Pi deployment: backend + frontend + nginx + cloudflared
docs/                        # Reference documentation (see below)
agents.sh                    # Fan-out script (see Agent workflow below) (untracked)
```

The flow engine (`packages/engine/`) has no React dependency and is fully unit-tested. The React layer drives it by calling `startExperiment()` once and `traverse(step, formData)` on each screen submission.

## How experiments are defined

Experiments are **authored** as typed `ExperimentFlow` literals in `apps/frontend/src/data/experiments/` (one file per experiment, collected into the `EXPERIMENTS` record) — but the runtime source of truth is the **backend database**. Publishing stores the config as immutable, content-addressed JSON and points the slug at it:

- `pnpm --filter @experiment-hub/backend seed` publishes the whole authored corpus plus the e2e fixture into `DB_PATH` (dev seeding)
- `PUT /api/experiments/:slug` publishes one config over HTTP, gated by the researcher bearer token; it runs the same `validateExperiment()` the render path uses and rejects invalid configs

The route `apps/frontend/app/(experiments-layout)/experiments/[slug]/page.tsx` fetches `GET /api/experiments/:slug` server-side (`BACKEND_URL` env — dev defaults to `http://localhost:3100`), 404s when unpublished, then calls `validateExperiment()` and renders `<ValidationErrors>` on errors — so misconfigured graphs are caught before the participant sees anything.

Runs pin the config version (sha256) the **client loaded**, sent with `POST /api/runs` — any version ever published under the slug is accepted, so a republish can neither rebind in-flight data nor mislabel a run that registered after it. Export rows carry `configVersion`.

Upgrades: the image ships canonical config artifacts under `apps/backend/configs/` (generated by `pnpm --filter @experiment-hub/backend export:configs`, kept honest by `configs-sync.test.ts`); with `SEED_CONFIGS_DIR` set the backend backfills *missing* slugs at boot, so existing experiment URLs keep working and researcher-published versions are preserved.

Start node selection is driven by query-string params: `?condition=A` matches a `StartNode` whose `props.param` equals `{ key: "condition", value: "A" }`. This enables within-experiment condition assignment without separate URLs.

## Non-obvious conventions

**`shouldUnregister: true`** in `apps/frontend/src/Screen.tsx`'s `useForm` call is intentional: unmounted components (those hidden by `conditional`) do not retain their values in the submitted form data.

**`Zustand persist` is not enabled** in `apps/frontend/src/data/store.ts`. Browser refresh resets the experiment. This is a known limitation, not a bug to fix casually — re-enabling it requires implementing session resume logic.

**Checkpoint persistence lives in `apps/frontend/src/data/send.ts` + `store.ts`.** `store.start()` calls `createRun(slug)` → `POST /api/runs`, which returns a server-minted `runId` and a token signed over (runId, experiment). Every checkpoint (and the synthesized `"end"` snapshot) POSTs to `/api/runs/:runId/checkpoints` with that token in `X-Run-Token` and a `seq` — the visit's ordinal within the run. A failed attempt is replayed from the last committed `seq`, so retries resend identical `seq` values and the backend dedupes on `(run_id, seq)`; genuine repeat visits get new ones. A failed POST throws and surfaces as the screen-level error state. In dev, the backend must be running (`pnpm dev:backend`) or Next's `/api/*` rewrite has nothing to hit.

**Debug panels are gated behind `process.env.NODE_ENV === 'development'`** (build-time in Next.js production builds). Keep that gate intact when touching `apps/frontend/app/(experiments-layout)/experiments/[slug]/page.tsx` or `apps/frontend/src/Screen.tsx`.

**Option anchoring** — response options accept `anchor: "first" | "last"` to pin specific choices to the ends of a shuffled list. Handled by `shuffleAnchored()` in `packages/engine/utils.ts`.

**pnpm is the canonical package manager.** Always use `pnpm`; the CI pipeline uses pnpm 9 exclusively.

## Anti-patterns

**Do not import React anywhere inside `packages/engine/`.** The engine is deliberately framework-agnostic. Tests in `packages/engine/specs/` run without a DOM renderer. Any React import in that layer breaks the isolation.

**Do not use `$fieldName` references outside `RenderComponent`.** `apps/frontend/src/components/RenderComponent.tsx` merges `form.watch()` into context before resolving props. The engine's `resolve.ts` and condition evaluator never have access to live form state — `$` references in branch conditions or loop `dataKey` fields silently resolve to nothing.

**Do not enable `Zustand persist` without implementing session resume.** Restoring persisted state mid-experiment requires knowing which step to re-enter and which context to restore. It's not a one-line change.

**Do not remove or bypass the `process.env.NODE_ENV === 'development'` guard** on debug panels. In production Next.js builds this dead-code-eliminates the panels; removing the guard exposes raw JSON context to participants.

## Agent workflow

When picking up an issue:

1. Branch from `main` as `feature/<name>` or `fix/<name>`.
2. Implement. Keep changes scoped to the issue.
3. Run `pnpm lint && pnpm test` before committing. Both must pass.
4. Use conventional commit prefixes: `feat:`, `fix:`, `test:`, `refactor:`.
5. Open a PR against `main` with `gh pr create`, referencing the issue number.
6. CI runs `pnpm test` and `pnpm test:e2e` automatically — both must pass before merge.

**`agents.sh`** at the repo root (untracked; present only in the maintainer's local checkout) is a fan-out script that launches one Claude Code agent per GitHub issue in a tmux grid, each in its own git worktree, for parallel multi-issue development.

**Workspace filter commands**: use `pnpm --filter @experiment-hub/engine <script>` or `pnpm --filter @experiment-hub/frontend <script>` to run scripts in a single package without affecting the other.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (juancuiule/experiment-hub), using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical label vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Commit and branch conventions

From git history:
- Feature branches: `feature/<name>` (e.g. `feature/compute-node`, `feature/shared-options`)
- Bug fix branches: `fix/<name>` (e.g. `fix/in-path-stepper`)
- Commit messages use `feat:`, `fix:`, `test:`, `refactor:` prefixes for new work; plain imperatives for small changes
- All PRs target `main`
- CI runs `pnpm test` and `pnpm test:e2e` on every PR before merge

## Environment variables

The frontend server reads `BACKEND_URL` — server components fetch experiment configs from it (`next.config.ts` also uses it for the dev-only `/api/*` rewrite). The E2E CI job sets `NODE_ENV=test`.

The backend reads `PORT`, `HOST` (default `127.0.0.1` — the dev server is loopback-only; compose sets `0.0.0.0`), `DB_PATH`, `NODE_ENV`, `EXPORT_TOKEN` (gates the researcher endpoints: export + experiment publish), `RUN_TOKEN_SECRET` (HMAC key for run tokens — rotating it invalidates in-flight runs), and optional `ALLOWED_EXPERIMENTS` (comma-separated extra allowlist on top of the published-config registry), and `SEED_CONFIGS_DIR` (compose sets `/app/configs` — the image's canonical artifacts; backfills absent slugs at boot, preserving researcher-published versions). Both secrets are required in production; dev gets random per-boot values. Its production build is an esbuild bundle (`dist/server.js`) that inlines the engine workspace package while keeping `effect`/`@effect/*` external — the deploy stage still only needs `dist` + prod deps.

`docker-compose.yml` interpolates the backend secrets from a gitignored `.env`; see `.env.example`. The Cloudflare Tunnel is locally managed — `infra/cloudflared/config.yml` holds the ingress rules and `.cloudflared/credentials.json` (gitignored) authenticates the connector.

## Sensitive files

Changing these incorrectly breaks participant-facing behavior:

- `apps/frontend/src/data/experiments/index.ts` — the authored corpus + seed source; a renamed key publishes under a different slug and orphans the old one
- `apps/backend/src/experiments.ts` — the publish/serve path; the versioning rules here are what keep in-flight run data consistent
- `packages/engine/flow/traverse.ts` — the traversal state machine; affects path step counting and all data nesting
- `packages/engine/experiment-validation/` — any regression here silently allows malformed experiments through
- `packages/engine/screen-schema.ts` — `buildSchema()` failing silently disables all per-screen form validation

## Documentation

The `docs/` folder contains precise reference documentation — use it before reading source code for domain questions:

| File | Contents |
|---|---|
| `docs/experiment.md` | `ExperimentFlow` top-level structure |
| `docs/nodes.md` | Node type reference — all ten node types |
| `docs/edges.md` | All edge types and node-to-edge validation rules |
| `docs/components.md` | All component types and their props (content, response, layout, control) |
| `docs/data-keys.md` | The 5 reference prefixes: `$$`, `@`, `$`, `#`, `%` |
| `docs/answer-piping.md` | String interpolation in labels and content (`{{ }}` syntax) |
| `docs/i18n.md` | Localized message dictionary and the `[[ ]]` token |
| `docs/validate.md` | All validation error codes with explanations |
| `CONTEXT.md` | Domain glossary — canonical vocabulary for experiments, nodes, and runtime (repo root) |
| `docs/agents/` | Agent conventions: issue tracker ops, triage labels, domain-doc consumption |

## Where to look first

| Question | Start here |
|---|---|
| How the state machine works | `packages/engine/flow/traverse.ts` — `traverse()`, `enterStep()`, `traverseInNode/Path/Loop()` |
| All core type definitions | `packages/engine/types.ts` — `ExperimentFlow`, `State`, `Context`, `FlowStep` |
| What node types exist | `packages/engine/nodes.ts` |
| What validation checks run | `packages/engine/experiment-validation/index.ts` — `validateExperiment()` |
| How a screen form is wired | `apps/frontend/src/Screen.tsx` — `useForm` + `buildSchema` + `buildDefaultValues` |
| How a component gets rendered | `apps/frontend/src/components/RenderComponent.tsx` — switch on `componentFamily` + `template` |
| Where experiments are authored | `apps/frontend/src/data/experiments/` — `EXPERIMENTS` (publish via seed/`PUT`) |
| How a URL maps to an experiment | `apps/frontend/app/(experiments-layout)/experiments/[slug]/page.tsx` |
| Engine behavior examples | `packages/engine/specs/flow/` — traversal tests covering branch, path, loop, fork |
