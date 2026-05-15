# Experiment Config Validation Spec

This document defines what `validateExperiment` should check, why each check matters,
and what error code to emit. Checks are grouped by concern and ordered from broadest to most specific.

---

## 1. Node identity

### 1.1 Unique node IDs

Every node in `nodes[]` must have a unique `id`.

- **Code:** `duplicate-node-id`
- **Why:** The flow engine looks up nodes by ID. A duplicate means one node silently shadows the other; edges that reference the shadowed ID route to the wrong node.

### 1.2 At least one start node

`nodes[]` must contain at least one node with `type: "start"`.

- **Code:** `missing-start`
- **Why:** `traverse` with an `"initial"` state and no `startName` searches for a start node. Zero means the flow can never start. Multiple start nodes are intentionally valid: they support multi-entry-point experiments where the active start node is selected at runtime (e.g. based on URL parameters).
- **Note:** The `multiple-start` error code does not exist. Two or more start nodes is a valid configuration.

---

## 2. Edge endpoints

### 2.1 Edge source node exists

The node ID extracted from `edge.from` (stripping `.branchId` / `.forkId` suffixes) must exist in `nodes[]`.

- **Code:** `unknown-node`
- **Why:** Every edge lookup in the flow engine assumes both endpoints are valid nodes. An unknown source silently drops the edge from routing.

### 2.2 Edge target node exists

`edge.to` must exist in `nodes[]`.

- **Code:** `unknown-node`
- **Why:** Same as above — following an edge to a non-existent node throws at runtime or produces an `undefined` node silently treated as the end of the flow.

---

## 3. Node-to-edge wiring

Each node type requires specific outgoing edge types to function. The flow engine throws or silently terminates when these are missing.

### 3.1 `start` — must have exactly one `sequential` edge out

`flow.ts:traverseInNode` throws `"Start node must have a next node"` when there is no sequential edge.

- **Code:** `missing-edge`

### 3.2 `checkpoint` — must have at most one `sequential` edge out

A checkpoint with no sequential edge is treated as the terminal node and transitions to `{ type: "end" }`. This is valid (e.g. a final checkpoint). Multiple sequential edges would be ambiguous — only the first found is used.

- No error for zero sequential edges (valid terminal).
- **Code:** `ambiguous-edge` if more than one sequential edge exists from the same checkpoint.

### 3.3 `branch` — must have exactly one `branch-default` edge

`getDefaultBranchNode` returns `null` when there is no `branch-default` edge. `traverseInNode` then throws `"Branch node must have a next node for the winning branch"` whenever all conditions evaluate to false.

- **Code:** `missing-edge`

### 3.4 `branch` — each branch ID in `props.branches` must have a matching `branch-condition` edge

`from` on a `branch-condition` edge is `"nodeId.branchId"`. If a branch ID in `props.branches` has no corresponding edge, that branch condition can never route anywhere — it will silently fall through to the default on every traversal.

- **Code:** `unrouted-branch`

### 3.5 `branch-condition` edge — the branch ID must exist in the node's `props.branches`

A `branch-condition` edge whose `from` is `"nodeId.branchId"` where `branchId` is not in the branch node's `props.branches` array is dead — it can never be selected because no condition evaluates it.

- **Code:** `invalid-edge`

### 3.6 `fork` — must have at least two `fork-edge`s out, one per fork ID in `props.forks`

A fork with a single arm is semantically meaningless — the outcome is deterministic. Two rules apply independently:

1. The fork node must have **at least two** `fork-edge`s total.
2. Each fork ID in `props.forks` must have **exactly one** corresponding `fork-edge`.

`getForkEdgeNode` returns `null` when there is no edge for the selected fork. `traverseInNode` then throws `"Fork node must have a next node for the winning fork"`.

- **Code:** `missing-edge` if any fork ID has no corresponding `fork-edge`, or if the total number of fork-edges is fewer than two.
- **Code:** `invalid-edge` if a `fork-edge` references a fork ID not in `props.forks`.

### 3.7 `path` — must have at least one `path-contains` edge

`getChildNodes` returns `null` for a path with no children. `initialState` throws `"Path node must have child nodes"`.

- **Code:** `missing-edge`

### 3.7a `path` — must have exactly one `sequential` exit edge

After all child nodes are visited, the flow engine follows the sequential edge out of the path node to continue the flow. A path with no sequential exit edge has no way to continue after the path completes.

- **Code:** `missing-edge` if the path node has no outgoing `sequential` edge.
- **Code:** `ambiguous-edge` if the path node has more than one outgoing `sequential` edge.

### 3.8 `path-contains` edge — `from` must reference a `path` node

A `path-contains` edge whose source is not a path node would orphan a screen (it would never appear in any path's child list, since the flow engine filters by `isPathEdge` and the source node ID).

- **Code:** `invalid-edge`

### 3.9 `loop` — must have exactly one `loop-template` edge

`getTemplateNode` uses `.find()` and silently ignores any duplicate. `initialState` throws `"Loop node must have a template node"` when there are zero.

- **Code:** `missing-edge` for zero.
- **Code:** `duplicate-edge` for more than one.

### 3.10 `loop-template` edge — `from` must reference a `loop` node

- **Code:** `invalid-edge`

---

## 4. Screen definitions

### 4.1 Every screen node must have a matching screen definition

Every node with `type: "screen"` has `props.slug`. A screen definition with that slug must exist in `flow.screens`.

- **Code:** `missing-screen`
- **Why:** The renderer looks up the screen definition by slug. A missing definition means the screen renders nothing and submitting the form writes no data.

### 4.2 Screen slugs must be unique

Two screen definitions with the same `slug` means one is never reachable — all screen node lookups return the first match.

- **Code:** `duplicate-screen`

### 4.3 Every screen definition must be referenced by at least one screen node

A screen definition that no node references is dead configuration — dead data accumulates and makes the config harder to maintain.

- **Code:** `unreferenced-screen`
- **Severity:** Warning (does not break the flow, just clutters config).

---

## 5. `$$` reference availability

Walk the flow graph forward from the start node, tracking the set of data paths guaranteed to be written at each point. A data path is a dot-joined string matching how the runtime nests screen data:

- Top-level screen `"welcome"` with `dataKey: "name"` → `"welcome.name"`
- Screen inside path `"path-profile"` → `"path-profile.demographics.age"`
- Loop template screens are walked for `@`-ref validation only — their data is keyed by the runtime value, which is unknown statically, so they are not added to the available set.
- Branches are conservative: each branch target is walked in isolation. Data written by only one branch is not guaranteed to be available after the branch join.

### 5.1 `$$` token in a component label or content must be available

If a `$$path.to.value` token appears in a component's `label`, `content`, or `text` prop, the path `path.to.value` must be in the available set at that point in the walk.

- **Code:** `unavailable-reference`

### 5.2 `@` token in a component label or content must be inside a loop template

An `@value` or `@index` token is only valid when the screen is a direct or indirect child of a loop node. Using it outside a loop means `context.currentItem` is `undefined` at runtime.

- **Code:** `invalid-reference`

---

## 6. Condition `$$` reference availability

Branch `props.branches[].config.dataKey` is a `$$`-prefixed path evaluated at runtime when the branch node is traversed. It is subject to the same availability rules as component labels.

### 6.1 Condition `dataKey` must be available when the branch is evaluated

Walk to the branch node and check whether the condition's data path is in the available set.

- **Code:** `unavailable-reference`

### 6.2 Condition `dataKey` starting with `@` is only valid inside a loop

Same rule as component references — `@`-keyed conditions only make sense inside a loop template subgraph.

- **Code:** `invalid-reference`

---

## Error code summary

| Code                    | Description                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `duplicate-node-id`     | Two nodes share the same `id`                                                             |
| `missing-start`         | No start node in the flow                                                                 |
| `unknown-node`          | An edge references a node ID that does not exist                                          |
| `missing-edge`          | A node is missing a required outgoing edge                                                |
| `duplicate-edge`        | A node has more than one edge where exactly one is required (e.g. loop-template)          |
| `ambiguous-edge`        | A node has multiple edges where at most one is expected (e.g. sequential from checkpoint, sequential exit from path) |
| `invalid-edge`          | An edge references a branch/fork ID that does not exist on the node                       |
| `unrouted-branch`       | A branch ID in `props.branches` has no corresponding `branch-condition` edge              |
| `missing-screen`        | A screen node references a slug with no screen definition                                 |
| `duplicate-screen`      | Two screen definitions share the same slug                                                |
| `unreferenced-screen`   | A screen definition is not referenced by any screen node                                  |
| `unavailable-reference` | A `$$` token references data not guaranteed to be written at that point                   |
| `invalid-reference`     | An `@` token is used outside a loop context                                               |
