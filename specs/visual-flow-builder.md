# Visual Flow Builder

> **Status:** Draft
> **Author:** —
> **Created:** 2026-03-12
> **Last updated:** 2026-03-12
> **Linked issue:** —

---

## 1. Summary

Add an `/editor` route that renders a react-flow canvas where researchers can visually construct experiment flows by dragging, connecting, and configuring nodes — without writing TypeScript config objects by hand.

---

## 2. Problem Statement

**Current state:** Experiments are authored as raw TypeScript object literals in `src/data/experiment.ts`. The edge syntax requires composite IDs (`"branch-psychedelics.consumed"`), `dataKey` paths must include the full runtime data path prefix (which requires mentally tracing `lib/flow.ts`'s path accumulation), and a branch node requires parallel, exactly-matched entries in both `nodes[]` and `edges[]`. There is no visual feedback during authoring — the only error surfacing is a blocking render in `app/page.tsx` after a page refresh.

**Desired state:** A drag-and-drop canvas where researchers add nodes from a palette, connect them by drawing edges between typed handles, configure node properties in a side panel, and get live validation feedback inline. The canvas serializes to the same `ExperimentFlow` schema — it is an authoring layer, not a separate format.

**Impact:** Every researcher authoring a new experiment currently needs developer-level familiarity with the TypeScript edge schema. The composite `from` syntax, the `path-contains` ordering semantics, and the `dataPath` prefix system for `$$` references are all invisible until something breaks. The visual builder eliminates the most error-prone authoring steps while keeping the underlying data model unchanged.

---

## 3. User Story

> As a **researcher building an experiment**,
> I want to **construct my flow visually on a canvas**,
> so that **I can design branching and looping structures without writing TypeScript edge definitions by hand**.

### Scenario A – Creating a simple branching flow

The researcher adds a `start` node, drags a `screen` node onto the canvas, connects them with a sequential edge, then adds a `branch` node. They open the branch's side panel to add two arms ("group-a" and "group-b"), then drag connections from each arm's handle to two separate `screen` nodes.

### Scenario B – Configuring a path with a stepper

The researcher adds a `path` node, drags three `screen` nodes into its child zone, and reorders them via drag handles. They enable the stepper in the side panel, set the label to `"Step {index} of {total}"` and the style to `"dashed"`.

### Scenario C – Validation error on the canvas

The researcher forgets to connect a `branch-default` edge. The branch node immediately shows a red validation badge. Hovering over the badge reveals: `"Branch node is missing a branch-default edge."`.

### Scenario D – Export and use

The researcher clicks "Export JSON". A JSON file is downloaded. They (or a developer) place it at `src/data/experiment.json` and the runner loads it.

---

## 4. Acceptance Criteria

- [ ] An `/editor` route exists, accessible without an environment guard. Future iterations will add role-based access control.
- [ ] The canvas renders using `@xyflow/react` (react-flow v12+).
- [ ] All 7 node types are represented as distinct custom react-flow nodes with correct visual handles (see Technical Notes).
- [ ] All 6 edge types are represented as distinct styled connections.
- [ ] A node palette panel (sidebar or floating toolbar) allows the researcher to drag new nodes onto the canvas.
- [ ] Clicking a node opens a configuration side panel for that node's props.
- [ ] Drawing an edge between two handles infers the correct edge type and `from`/`to` values automatically — the researcher never writes a composite ID.
- [ ] The canvas state is continuously serialized to a valid `ExperimentFlow` object (debounced 300ms).
- [ ] `validateExperiment` runs on every serialization. Nodes with validation errors show a red badge; hovering reveals the error message.
- [ ] An "Export" button downloads the current `ExperimentFlow` as a JSON file.
- [ ] An "Import" button accepts a JSON file, validates it, and loads it into the canvas.
- [ ] The canvas supports undo/redo (Ctrl+Z / Ctrl+Y).
- [ ] Deleting a node with `Backspace`/`Delete` also removes all connected edges.

---

## 5. UI / UX

### 5.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Import] [Export] [Validate]           [Undo] [Redo]       │  ← Toolbar
├──────────────┬──────────────────────────────────────────────┤
│              │                                               │
│  Node        │                                               │
│  Palette     │          React-Flow Canvas                    │
│              │                                               │
│  ○ Start     │                                               │
│  □ Screen    │                                               │
│  ◆ Checkpoint│                                               │
│  ⬡ Branch    │                                               │
│  ⬢ Fork      │                                               │
│  ⬜ Path      │                                               │
│  ↻ Loop      │                                               │
│              │                                               │
├──────────────┴──────────────────────────────────────────────┤
│  [ Node Properties Panel — shown when a node is selected ]  │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Node Visual Design

| Node type | Shape | Color accent | Handles |
|---|---|---|---|
| `start` | Rounded pill | Green | 1 output (bottom, sequential) |
| `checkpoint` | Diamond | Amber | 1 input (top), 1 output (bottom, sequential) |
| `screen` | Rectangle with slug + component count badge | Blue | 1 input (top), 1 output (bottom, sequential) |
| `branch` | Hexagon; lists each arm inside | Orange | 1 input (top), 1 handle per arm + 1 "default" handle (bottom) |
| `fork` | Octagon; lists each fork with weight | Purple | 1 input (top), 1 handle per fork (bottom, fan out) |
| `path` | Rounded rect with dashed border | Teal | 1 input (top), N child handles (side, `path-contains`), 1 output (bottom, sequential exit) |
| `loop` | Rect with loop icon | Indigo | 1 input (top), 1 template handle (side, `loop-template`), 1 output (bottom, sequential exit) |

### 5.3 Edge Visual Design

| Edge type | Style |
|---|---|
| `sequential` | Solid grey, arrow end |
| `branch-condition` | Solid colored, labeled with branch name |
| `branch-default` | Dashed grey, labeled "default" |
| `path-contains` | Dashed teal, labeled with `order` number |
| `loop-template` | Curved indigo arrow |
| `fork-edge` | Solid purple, labeled with fork weight |

### 5.4 Node Properties Panel

Each node type shows a different form in the properties panel:

- **`screen`**: slug input, link to screen component editor (future)
- **`branch`**: list of arms with add/remove/rename; each arm's `ConditionConfig` (operator, dataKey, value)
- **`fork`**: list of forks with add/remove/rename/weight slider; weights auto-normalize to 100%
- **`path`**: name, description, randomized toggle, stepper config (label, style)
- **`loop`**: static vs. dynamic toggle; if static, a list of values; if dynamic, a `dataKey` input
- **`checkpoint`**: name input
- **`start`**: optional name and param (key + value) for multi-start setups

### 5.5 Figma Reference

- [ ] Figma link: Not yet designed.
- [ ] Reference tools: Dify.AI workflow editor, n8n, and Retool's workflow builder as UX references for node-graph editors in research/data tools.

---

## 6. Technical Notes

### 6.1 Affected Areas

- `package.json` — add `@xyflow/react` dependency
- `app/editor/page.tsx` — new Next.js route (dev-only)
- `src/editor/` — new directory for editor-specific components:
  - `src/editor/FlowEditor.tsx` — root canvas component
  - `src/editor/nodes/` — custom node components (one per node type)
  - `src/editor/panels/NodePropertiesPanel.tsx` — side panel form
  - `src/editor/hooks/useFlowSerializer.ts` — converts react-flow state → `ExperimentFlow`
  - `src/editor/hooks/useFlowDeserializer.ts` — converts `ExperimentFlow` → react-flow state

### 6.2 Data / State

**Serialization (`ExperimentFlow` → react-flow nodes/edges):**

```ts
function deserialize(flow: ExperimentFlow): { nodes: RFNode[]; edges: RFEdge[] } {
  const rfNodes = flow.nodes.map(node => ({
    id: node.id,
    type: node.type,       // maps to custom node component name
    data: { node },        // the full FrameworkNode is the node's data payload
    position: { x: 0, y: 0 }, // layout algorithm fills this in
  }));

  const rfEdges = flow.edges.map(edge => ({
    id: `${edge.from}->${edge.to}`,
    source: extractNodeId(edge.from),   // strips ".armId" suffix
    target: edge.to,
    sourceHandle: extractHandleId(edge.from), // the arm/fork ID or null
    type: edge.type,
    data: { edge },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}
```

**Serialization (react-flow state → `ExperimentFlow`):**

```ts
function serialize(rfNodes: RFNode[], rfEdges: RFEdge[]): ExperimentFlow {
  const nodes = rfNodes.map(n => n.data.node as FrameworkNode);
  const edges = rfEdges.map(e => {
    const handle = e.sourceHandle;
    const from = handle ? `${e.source}.${handle}` : e.source;
    return { ...e.data.edge, from, to: e.target };
  });
  return { nodes, edges, screens: [] }; // screens come from a separate editor
}
```

**Key serialization challenges:**

1. **`path-contains` order**: react-flow edges don't have a native `order` field. The `order` value must be stored in `rfEdge.data.edge.order` and preserved through the serialize/deserialize cycle. When the researcher reorders children inside a `path` node, the editor re-assigns `order` values and updates the corresponding edges.

2. **`branch-condition` composite IDs**: The react-flow handle concept maps cleanly — `sourceHandle="consumed"` on an edge from node `"branch-psychedelics"` serializes to `from: "branch-psychedelics.consumed"`. The deserializer splits on `.` to recover the handle ID.

3. **Layout**: react-flow requires explicit `x/y` positions. The initial load should run an auto-layout algorithm (e.g., `dagre` or `elkjs`) to arrange nodes in a readable top-to-bottom hierarchy. Subsequent manual drags override the auto-layout positions. Node positions should be saved in `rfNode.data.position` as metadata (not part of `ExperimentFlow` but stored in a separate `editorMeta` sidecar in `localStorage`).

4. **Path children as sub-flows**: react-flow v11+ supports `parentId` on nodes for grouping. Path children should have `parentId` set to the path node's ID, which causes react-flow to render them within the path node's visual bounds. This requires `expandParent: true` on the path node.

5. **Loop template**: The `loop-template` edge is unusual — it goes from the loop node to another node that is also reachable by regular sequential edges. The template node is not "inside" the loop; it is referenced by it. The builder should render the template edge in a distinct curve style and allow the template node to exist anywhere on the canvas.

### 6.3 Validation

The editor runs `validateExperiment(serializedFlow)` on every change (debounced). Errors are indexed by the node ID mentioned in the error message and displayed as red badges on the corresponding nodes. This requires `validateExperiment` to include the `nodeId` in its error output — a minor extension to `ValidationError = { code, message, nodeId?: string }`.

### 6.4 Constraints & Risks

- **react-flow license**: `@xyflow/react` is MIT-licensed for non-commercial use; the Pro plan adds server-side rendering support and a minimap. Check license compatibility with the project's use case.
- **path-contains containment rendering**: react-flow's parent-child grouping (`parentId`) works but has known quirks with edge routing when child nodes are inside a parent. Extensive testing of the path node visual is needed.
- **Screen editor**: The visual builder proposed here covers flow structure only (nodes and edges). Screen content (the list of `ScreenComponent`s) is a separate editor that is out of scope for this spec. In the initial version, the screen's slug is shown in the node, and clicking "Edit screen" opens the `/preview/[slug]` route in a new tab.
- **Mobile**: The canvas editor is designed for desktop (mouse/trackpad) only. Mobile support is not required.
- **Performance**: react-flow handles hundreds of nodes efficiently. Experiments with 50+ nodes are expected to be rare; no custom virtualization is needed.

---

## 7. Test Plan

### 7.1 Unit Tests

- [ ] `serialize(deserialize(flow))` round-trips without loss for: a simple 3-node flow, a branching flow, a path flow, a loop flow.
- [ ] `extractNodeId("branch-foo.consumed")` returns `"branch-foo"`.
- [ ] `extractHandleId("branch-foo.consumed")` returns `"consumed"`.
- [ ] `serialize` produces a `branch-condition` edge with `from: "nodeId.armId"` when the source handle is set.
- [ ] `validateExperiment` is called after every serialization; errors are indexed by node ID.

### 7.2 Integration / Flow Tests

- [ ] Create a 3-node flow on the canvas, export JSON, import JSON — canvas matches original.
- [ ] Add a branch node with 2 arms, connect both arms and default — `validateExperiment` returns no errors.
- [ ] Add a branch node, leave default unconnected — validation badge appears on the branch node.
- [ ] Create a path node with 3 children, reorder — `path-contains` edges update with correct `order` values.

### 7.3 Manual / QA Checks

- [ ] Drag 5 different node types onto the canvas and connect them — no console errors.
- [ ] Import the live `experiment.ts` config as JSON — canvas renders the full flow correctly.
- [ ] Export the canvas state as JSON — the exported JSON is valid and loads back in.
- [ ] Undo/redo a node deletion — node is restored with its edges.

---

## 8. Out of Scope

- Screen content editor (editing `ScreenComponent[]` within a screen node) — separate feature.
- Collaborative editing (multiple researchers on the same canvas simultaneously).
- Cloud save / hosted experiment storage.
- Mobile canvas interaction.
- Visual diff between two experiment versions.
- Automatic layout algorithm updates after every edit (positions are fixed after initial auto-layout).

---

## 9. Open Questions

| # | Question | Owner | Resolution |
|---|---|---|---|
| 1 | Should the editor be dev-only or available in production for authorized researchers? | — | **Resolved:** Always accessible for now (no environment guard). Future: gated by user roles. |
| 2 | Should path children be visually embedded inside the path node (react-flow parent-child grouping) or shown as free nodes with labeled edges? | — | Open — embedded grouping is more intuitive but complex to implement; labeled edges are simpler. |
| 3 | Which auto-layout library to use: `dagre` (simpler, widely used with react-flow) or `elkjs` (more powerful, handles grouped nodes better)? | — | Open — proposed: `dagre` for the initial version, upgrade to `elkjs` when path/loop grouping is implemented. |
| 4 | Where are editor node positions stored? In `localStorage`? In a sidecar file? | — | Open — proposed: `localStorage` keyed by a hash of the experiment's node IDs. |
| 5 | Should the editor validate the flow in real-time (on every change) or only when the researcher clicks a "Validate" button? | — | Proposed: real-time with 300ms debounce. |

---

## 10. Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-12 | — | Initial draft |
