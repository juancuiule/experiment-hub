# Nodes

key files: `lib/nodes.ts`

Nodes are the fundamental building blocks of an experiment flow. There are a series of node types that can be used to create a flow, and each node type has a specific function. They are connected to each other through edges, which define the flow of the experiment.

All nodes have an id:string and a type:string. The id is a unique identifier for the node, and the type is the type of node it is.

The available types of nodes are:

- `start`
- `checkpoint`
- `screen`
- `branch`
- `path`
- `fork`
- `loop`

Each of those nodes has a specific configuration or series of props.

## Start Node

The `start` node is the entry point of the experiment flow. It is the first node that is executed when the experiment is run. Most experiments will have only one start node, but it is possible to have multiple start nodes if needed to create multiple entry points for the experiment based on url parameters.

To have multiple start nodes one should use the props with `name` (to determine the name of that group) and `param` (to determine the url parameter `key` and `value` that will be used to determine which start node to use). `param` is an object with the keys `key` and `value`.

## Checkpoint Node

The `checkpoint` node is used to save the state of the experiment at a specific point in time. This can be useful to ensure that if a participant leaves the experiment we've already collected some data until that point. It has a `name` prop that is used to identify the checkpoint.

## Screen Node

The `screen` node is used to display a screen to the participant. It has a `slug` prop that is used to identify the screen to be displayed. The `slug` should correspond to a screen that has been defined in the experiment.

Each screen consists of a series of components that are rendered in a specific order. The components can be anything from text, images, videos, or interactive elements like buttons or sliders.

## Branch Node

The `branch` node is used to create a branching point in the experiment flow. It has a `name` prop that is used to identify the branch, a `description` prop that is used to provide a description of the branch, and a `branches` props that is an array of objects that define the different branches that can be taken from this point.

Each branch object has an `id` and a `name` prop that is used to identify the branch, an optional `description` prop that is used to provide a description of the branch, and a `config` prop that is used to configure under which condition the branch should be taken.

The `config` prop accepts the full composable `Condition` type — the same type used by the `conditional` component. This means it supports `SimpleCondition` (`{ type: "simple", operator, dataKey, value }`) as well as compound types: `{ type: "and", conditions: [...] }`, `{ type: "or", conditions: [...] }`, and `{ type: "not", condition: ... }`. The `dataKey` in a simple condition accepts `$$`, `@`, or `$` prefixed references. See ConditionConfig Operators in the [Components](./components.md) section for the full operator list.

If there are multiple branch conditions that are true at the same time, the branch node will take the first one that is defined in the edges array. This means that the order of the edges in the experiment configuration can affect the flow of the experiment.

Branch reconvergence is not required, many branches can lead to different or same nodes but it is not the responsibility of the branch to check that. The connected nodes will determine the flow after the branch node, not the branch node itself.

## Path Node

The `path` node is used to create a path in the experiment flow. It has a `name` prop that is used to identify the path, a `description` prop that is used to provide a description of the path, a `randomized` prop that is used to determine if the path should be randomized or not, and a `stepper` props that allows to configure and optional stepper to be shown at the top of the screen to indicate the progress of the participant in that path.

The only required props is the `name` prop. The stepper configuration is an object with the `StepperConfig` type that has two properties: `label?` and `style`. The `label` property is a string that defines the label to be shown in the stepper, and the `style` property is a string that defines the style of the stepper (e.g. `continuous` or `dashed`). In the label prop `{index}` will be replaced by the current step index, and `{total}` will be replaced by the total number of steps in that path.

> **Note:** The `{index}` / `{total}` substitution syntax in stepper labels is an accidental divergence from the `{{ }}` double-brace syntax used by answer piping. These will be unified in a future cleanup — stepper labels will use `{{index}}` and `{{total}}` instead.

## Fork Node

The `fork` node is used to create a fork in the experiment flow. It has a `name` prop that is used to identify the fork, a `description` prop that is used to provide a description of the fork, and a `forks` props that is an array of objects that define the different paths that can be taken from this point. Each fork object is of type `Fork`.

The `Fork` type has an `id` and a `name` prop that is used to identify the fork, an optional `description` prop that is used to provide a description of the fork, and a `weight` prop that is used to determine the probability of that fork being taken. To determine the fork to be taken we should sum the weights of all the forks and then generate a random number based on that distribution.

Fork nodes should not have sequential edges connecting them to other nodes, since the flow after a fork node is determined by the nodes connected fork edges.

## Loop Node

The `loop` node is used to create a loop in the experiment flow. It can be one of two types: `static` or `dynamic`.

The `static` loop node has a `values` prop (`(string | Record<string, unknown>)[]`) that is used to define the different values that will be iterated over in the loop. Values may be plain strings or objects.

The `dynamic` loop node has a `dataKey` prop (must be `$$`-prefixed, e.g. `$$screenSlug.myList`) that references an array collected earlier in the experiment (e.g. via a `sample` formula). Each element of that array becomes one loop iteration value, and elements may be strings or objects.

Both types of loop have a `stepper?` prop that allows to configure an optional stepper to be shown at the top of the screen to indicate the progress of the participant in that loop. This stepper is exactly the same as the one used in the `path` node, with the same `StepperConfig` type.

Both types also accept an optional `randomized?` (boolean) prop. When `true`, the values are shuffled once at the moment the loop is first entered, producing a presentation order that is stable across all iterations of that run (it is not re-shuffled per iteration). For `dynamic` loops the values are resolved from context first, then shuffled. The resulting order is written to `context.loops[loopId].order`. When `randomized` is omitted or `false`, the loop iterates in its defined/resolved order. This mirrors the `randomized` flag on the `path` node.

### `itemKey` — iteration key for object values

Both loop types also accept an optional `itemKey?: string` prop. By default an object-valued iteration is keyed by its 1-based index, so its data lands at `context.data.<loopId>["1"]`, `["2"]`, etc. Setting `itemKey` to a property name keys each object iteration by `String(item[itemKey])` instead — e.g. with `itemKey: "id"` and items `[{ id: "cat" }, { id: "dog" }]`, data lands at `context.data.<loopId>.cat` and `context.data.<loopId>.dog`.

- `itemKey` is a **no-op for plain-string values** — the string itself is used as the key, as before.
- `$$loops.<loopId>.order` stores the resolved **key strings** (`["cat", "dog"]` above; the string values themselves for string loops).
- `@loopId.value` still exposes the **full object** during iteration — `itemKey` only affects the data-path key.
- For `static` loops, every object value must contain the `itemKey` property; a missing property is caught by `validateExperiment()` (error code `loop-item-key-missing`).
- For `dynamic` loops, a missing property at runtime **silently falls back** to the 1-based index for that iteration.

A `loop-aggregate` formula reads `context.loops[loopId].order` directly to find each iteration's data, so it works against `itemKey`'d loops with no extra configuration — there are no iteration keys to reconstruct or keep in sync.

### `split` formula — paginate a list across loop screens

A compute `split` formula chops a list into bins so a dynamic loop can present a long questionnaire across several screens (one bin per screen). Its output — an **array of bins** (each bin an array of the original items) — is stored at `data[outputKey]` and read by a dynamic loop via `$$outputKey`.

```ts
{ outputKey: 'bins', formula: { type: 'split', input: '$$intro.questions', size: 5 } }
```

- `input` is a `$$`/`$` reference to a context array, or an inline array — same shape as `sample`.
- **Mode `size: N`** — bins of N items; the final bin holds the remainder (10 items, `size: 3` → `[3,3,3,1]`).
- **Mode `into: N`** — exactly N bins; each bin gets `floor(len/N)` items and the **last bins absorb the remainder** (10 items, `into: 3` → `[3,3,4]`). When `N` exceeds the item count at runtime, empty bins are dropped (`2 into 3` → `[[a],[b]]`); the inline-array overflow case is rejected by `validateExperiment()` (`split-bins-exceed-items`).
- Order is preserved — compose a `sample` formula upstream to randomize first.
- Non-positive / non-integer `size`/`into` is caught by validation (`invalid-split-size`).

A non-array `input` (e.g. an unresolved reference) yields `[]`, so the dynamic loop is skipped rather than crashing.

**Rendering a bin's items** — inside the loop, the current bin is the loop item, referenced as `@loopId.value`. Use a `forEach` control with `dataKey: '@loopId.value'` to render one input per question in that bin.
