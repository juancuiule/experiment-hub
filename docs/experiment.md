# Experiment

An experiment consists of a number of nodes and edges connected between them that define the flow of the experiment. The nodes represent the different steps or components of the experiment, while the edges represent the connections between those steps and how the participant will navigate through them.

From the user point of view the experiment consists of a series of screen nodes that are shown to the participant. Those nodes have a `slug` props that should be related to an screen in the screens list of the experiment config.

The top-level `ExperimentFlow` object has four fields:

- `nodes: FrameworkNode[]` — the graph nodes (see [Nodes](./nodes.md))
- `edges: FrameworkEdge[]` — the graph edges (see [Edges](./edges.md))
- `screens?: FrameworkScreen[]` — screen definitions keyed by `slug`, referenced by `screen` nodes
- `options?: Record<string, Option[]>` — named shared option sets. Reference them from any `radio`, `checkboxes`, `dropdown`, or `likert-scale` component using the `%name` prefix (e.g. `options: "%agreement-scale"`). Shared option sets must be defined here and the validator (`flow-validation.ts`) will emit `unknown-shared-options` for any `%name` reference that has no matching key.

## Experiment Flow

key files: `lib/types.ts` and `lib/flow.ts`

To be able to traverse the experiment flow we need to define a starting point we have a series of functions and logic. The most important abstraction is the idea of a `FlowStep`. The flow step integrates the idea of a `State` of the experiment at a specific point in time, the `experiment` config, the `Context` and a `dataPath`.

The `State` can be one of the following:

- Initial state: this is the state of the experiment before it starts. In this state we haven't executed any node yet, and we are waiting for the participant to start the experiment.
- In node state: this is the state of the experiment when we are executing a node. In this state we are currently executing a node, and we are waiting for the participant to interact with that node (e.g. by clicking a button, filling a form, etc.).
- In path state: this is the state of the experiment when we are executing a path node. In this state we have in context the children nodes of that path, the current step and the innerState of that path (shares the same type with this).
- In loop state: this is the state of the experiment when we are executing a loop node. In this state we have in context the template node of that loop, the current iteration and the innerState of that loop (shares the same type with this). We algo have the values that we are iterating over in that loop, either from the `values` prop in the static loop, or from the `dataKey` in the dynamic loop.
- End state: this is the state of the experiment when we have executed all the nodes and we have reached the end of the experiment.

The `Context` is a partial object that contains information under different keys. These keys are:

- `start`: contains the group name in which the participant started the experiment (if there are multiple start nodes). `{ group: string }`
- `checkpoints`: contains the ISO timestamps of the checkpoints that the participant has passed through. `{ [checkpointName: string]: string }`
- `loopData`: contains the current iteration item for each active loop node. `{ [loopNodeId: string]: { value: any; index: number } }`. Inside a loop with id `"loop-sports"`, the current value is accessed as `@loop-sports.value` and the index as `@loop-sports.index`.
- `branches`: contains the branch ID that was taken at each branch node. `{ [branchNodeId: string]: string }`
- `forks`: contains the fork ID that was taken at each fork node. `{ [forkNodeId: string]: string }`
- `paths`: contains the ordered list of child node IDs for each path node (after optional randomization). `{ [pathNodeId: string]: { order: string[] } }`
- `loops`: contains the ordered list of iteration values for each loop node. `{ [loopNodeId: string]: { order: string[] } }`
- `timings`: records entry and submission timestamps for each screen. `{ [timingKey: string]: { enteredAt?: string; submittedAt?: string } }`

The `dataPath` is a `string[]` that represents the nesting path under which the data collected for the current screen will be stored in `context.data`. When traversing a top-level screen the path is empty (`[]`) and data is stored as `context.data[screenSlug][dataKey]`. When inside a path or loop node, that node's `id` is prepended — e.g. inside path `"path-profile"` data becomes `context.data["path-profile"][screenSlug][dataKey]`, referenced in conditions as `$$path-profile.screenSlug.dataKey`.
