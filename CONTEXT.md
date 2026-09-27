# Experiment Hub

An adaptive experiment runner for behavioral research: a researcher authors a branching participant flow as a typed object literal (`ExperimentFlow`), and the engine traverses it node by node — rendering screens, collecting responses into `Context`, and checkpointing partial data.

## Language

### Authoring — the flow graph

**Experiment**:
A complete study definition — one `ExperimentFlow` object literal pairing a node/edge graph with the screens it renders. Registered in `EXPERIMENTS` under a slug, which is also its URL.
_Avoid_: study, survey, questionnaire.

**Node**:
A single step in the experiment graph. Only `screen` nodes render participant UI; every other node type is auto-traversed control or data plumbing. For the ten node types, see the Node types section below.
_Avoid_: step (reserved for a position inside a path/loop, as in stepper labels), page, stage.

**Edge**:
A typed connection between two nodes. The edge *type* (sequential, branch-condition, branch-default, path-containment, loop-template, fork-edge) carries the traversal semantics — the node pair alone does not.
_Avoid_: link, transition.

**Screen**:
A `slug`-keyed, ordered list of components rendered as one participant-facing form page. Defined once in `screens` and referenced by `screen` nodes via `props.slug`.
_Avoid_: page, view.

**Component**:
A UI element inside a screen, identified by `componentFamily` + `template` (e.g. `response`/`slider`). Families: `content` (display), `response` (collects an answer), `layout` (button, group), `control` (conditional, for-each).
_Avoid_: widget, question, input.

**Field**:
The `dataKey` a response component writes its answer under — the addressable unit of collected data.
_Avoid_: answer, variable.

**Option**:
One choice in a `radio`/`checkboxes`/`dropdown`/`likert-scale` list. May carry `anchor: "first" | "last"` to pin its position when the list is shuffled.
_Avoid_: choice, answer option.

### Node types

**start**:
Entry point of a run. When several exist, the runner picks the one whose `props.param` matches the URL query string (`?condition=A` → `param: {key: 'condition', value: 'A'}`) — this is the condition-assignment mechanism.
_Avoid_: root, entry node.

**checkpoint**:
Persistence point: calls `send()` with the Context collected so far, so partial data survives participant abandonment.
_Avoid_: save node, submission.

**screen**:
Renders its referenced Screen's components; advancing submits the screen's form data into Context.
_Avoid_: page node, question node.

**branch**:
Conditional split: takes the first arm (by edge order) whose `Condition` evaluates true. Reconvergence is not enforced.
_Avoid_: decision, if-node.

**fork**:
Random split: picks one `Fork` outcome, weighted by each fork's `weight`. A branch is conditional; a fork is random — don't conflate them.
_Avoid_: randomizer, lottery.

**path**:
A fixed sequence of nodes traversed in order. `randomized` shuffles the contained steps once on entry; `stepper` adds a progress indicator.
_Avoid_: section, block.

**loop**:
Repeats its template nodes once per item — `static` (inline `values`) or `dynamic` (items resolved at runtime from a `$$` array). Per-iteration data nests under `context.data.<loopId>.<iterKey>`; `itemKey` chooses the key for object items.
_Avoid_: repeat, iterator.

**compute**:
Derives values from already-collected data via named `Computation`s (formulas: sum, mean, count, lookup, sample, split, collect-loop, …). Outputs are reachable as `$$<computeId>.<outputKey>`; sibling computations can't see each other's outputs, so chained derivations need separate compute nodes.
_Avoid_: calculator, scoring node.

**data**:
Injects static key/value data into `context.data` under the node id, making every key reachable as `$$<nodeId>.<key>`.
_Avoid_: constants node, config node.

**end**:
Terminates the run. No props, no UI.
_Avoid_: finish, completion.

### Runtime — one participant's traversal

**Run**:
One participant's traversal of the experiment, from start-node selection to end. Held in the Zustand store; a browser refresh resets it (no resume). Registered with the backend via `POST /api/runs`, which issues the `runId` and a run token bound to the experiment slug; every checkpoint write presents both.
_Avoid_: session, playthrough.

**FlowStep**:
The engine's unit of traversal: the current `State` plus the `ExperimentFlow`, `Context`, and `dataPath`. `traverse(step, formData)` consumes one FlowStep and produces the next.
_Avoid_: state (alone — `State` is one field of a FlowStep).

**State**:
Where a run sits: `initial`, `in-node`, `in-path`, `in-loop`, or `end`. Path and loop states carry a recursive `innerState` of the same type.
_Avoid_: phase, status.

**Context**:
The accumulated record of a run: collected `data`, `branches`/`forks` taken, `paths`/`loops` orders, `checkpoints` timestamps, `timings`, active `locale`/`messages`. Everything a `$$` reference can read.
_Avoid_: state (that's the traversal position), store (the Zustand store holds both).

**dataPath**:
The nesting path under which the current screen's data lands in `context.data` — empty at top level, prepended with enclosing path/loop ids inside them.
_Avoid_: namespace.

**Start group**:
The `props.name` of the start node selected for this run, recorded as `context.start.group`. The query-param key is arbitrary; the group name is what gets stored.
_Avoid_: condition, cohort.

**Stepper**:
The progress indicator over a path's or loop's steps; `{index}`/`{total}` substitution (single braces — deliberately distinct from `{{ }}` answer piping).
_Avoid_: progress bar (the `dashed` style isn't a bar).

### Data references and interpolation

**Data key**:
A prefixed reference to a value. Five sigils scope it: `$$` experiment data, `@` loop item (`@loopId.value`/`.index`), `$` current screen (inside compute formulas, `$` instead means an earlier output of the same compute node), `#` for-each item, `%` shared options (authoring-time, not a runtime ref).
_Avoid_: binding, variable.

**Shared options**:
A named `Option[]` in `ExperimentFlow.options`, referenced as `%name` — one reusable choice list across components.
_Avoid_: global options.

**Answer piping**:
`{{ }}` interpolation inside labels and content, resolved against Context (and live form values via `$`) at render time.
_Avoid_: templating, mustache.

**Dictionary**:
The per-locale `MessageTree` sets on `ExperimentFlow.dictionary`. `defaultLocale` is both the `?lang=` fallback and the source of messages missing in the active locale; `[[dotted.key]]` tokens resolve against it.
_Avoid_: translations, string table.

### Persistence — the backend

**Checkpoint record**:
The durable form of hitting a checkpoint node: an append-only row (`run_id`, `experiment`, `checkpoint`, `seq`, `at`, `received_at`, `context` JSON) written by `POST /api/runs/:runId/checkpoints`. `seq` is the visit's ordinal within the run: retries of one visit share it and collapse; a run hitting the same checkpoint again (e.g. in a loop) gets a new `seq` and a new record.
_Avoid_: save, submission.

**Export**:
The researcher-facing pull of collected data: `GET /api/experiments/:slug/export` streams all checkpoint records for a slug as NDJSON, gated by a bearer token (`EXPORT_TOKEN`).
_Avoid_: download, dump.
