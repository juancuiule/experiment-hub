# Flow Builder (`src/builder/`)

A visual module for inspecting and configuring experiment flows — nodes, edges,
and screen components. Reachable at `/builder` (index) and `/builder/[slug]`.

This is a **prototype**: it loads the real `EXPERIMENTS` definitions and lets you
edit a structured-cloned copy in memory. Nothing is persisted and the real
experiment files are never mutated. There is no export/save step yet.

## Layout (3 panes)

```
┌──────────┬─────────────────────┬──────────────┐
│ Palette  │       Canvas        │  Inspector   │
│ add node │  auto-laid-out DAG  │ per-node form│
└──────────┴─────────────────────┴──────────────┘
```

- **Palette** (`Palette.tsx`) — buttons to append a node. If a node is selected,
  the new node is wired to it with a `sequential` edge.
- **Canvas** (`Canvas.tsx` + `NodeCard.tsx`) — renders nodes and edges using the
  pure layout in `layout.ts`. Edges are color/dash-coded by type; branch/fork
  sub-ids are labelled on the connector. Click a node to select it.
- **Inspector** (`Inspector.tsx`) — a typed form per node type, plus a **Raw JSON**
  editor fallback for anything the forms don't cover (e.g. compute formulas,
  branch conditions). Screen nodes embed `ScreenEditor.tsx` to add/reorder/remove
  components and quick-edit their string props.

A live `validateExperiment()` badge and error strip sit in the toolbar, so a
malformed edit is flagged immediately.

## Design boundaries

- `layout.ts` is **pure** (no React) — mirrors the `lib/` engine's isolation so
  the layered-DAG layout can be unit-tested without a renderer.
- All editing state lives in `useFlowEditor.ts` (a `useState`-backed hook). The
  real engine types from `lib/` are the single source of truth — the builder
  never redefines node/edge/screen shapes.

## Not yet implemented (intentional, prototype scope)

- Drag-to-reposition / drag-to-connect on the canvas (layout is automatic).
- Full structured editors for compute formulas and branch/fork conditions
  (use Raw JSON for now).
- Persistence / export back to a `src/data/experiments/*.ts` entry.
- Deleting/redrawing specific edge types from the UI.
