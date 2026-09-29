'use client';
import '@xyflow/react/dist/style.css';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Node,
  type OnNodeDrag,
  type OnNodesChange,
  type OnSelectionChangeParams,
  type XYPosition,
} from '@xyflow/react';
import { validateExperiment } from '@experiment-hub/engine/experiment-validation';
import type { NodeType } from '@experiment-hub/engine/nodes';
import type { ExperimentFlow } from '@experiment-hub/engine/types';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useRef, useState } from 'react';
import LiveScreenPreview from './LiveScreenPreview';
import { clearPositions, loadPositions, savePositions } from './positions';
import {
  addArm,
  addNode,
  canConnect,
  connect,
  deleteEdgeIds,
  deleteNodes,
  reconnect,
  removeArm,
  setNodeName,
  setScreenSlug,
} from './mutations';
import {
  CONTAINER_COLORS,
  layoutFlow,
  toFlowGraph,
  type ContainerNodeData,
  type EditorEdge,
  type EditorNode,
} from './adapter';
import ContainerNode from './ContainerNode';
import FlowEdge from './FlowEdge';
import FlowNode from './FlowNode';
import {
  DEFAULT_VIEW_OPTIONS,
  ViewOptionsContext,
  type ViewOptions,
} from './view-options';

const NODE_TYPES: NodeType[] = [
  'start',
  'screen',
  'branch',
  'fork',
  'path',
  'loop',
  'checkpoint',
  'compute',
  'data',
  'end',
];

const nodeTypes = {
  ...Object.fromEntries(NODE_TYPES.map((t) => [t, FlowNode])),
  container: ContainerNode,
};

const edgeTypes = { pill: FlowEdge };

const TYPE_COLORS: Record<NodeType, string> = {
  start: '#64748b',
  screen: '#60a6bc',
  branch: '#8b5cf6',
  fork: '#f97316',
  path: '#14b8a6',
  loop: '#ec4899',
  checkpoint: '#0cc084',
  compute: '#f59e0b',
  data: '#0ea5e9',
  end: '#64748b',
};

const minimapColor = (node: EditorNode) =>
  node.type === 'container'
    ? CONTAINER_COLORS[(node.data as ContainerNodeData).kind]
    : TYPE_COLORS[node.type as NodeType];

/** Re-runs dagre (clears saved manual positions) then refits the view. */
function TidyButton({ onTidy }: { onTidy: () => void }) {
  const rf = useReactFlow();
  return (
    <button
      type="button"
      onClick={() => {
        onTidy();
        // fitView after the relayout lands in state
        setTimeout(() => rf.fitView({ duration: 200 }), 60);
      }}
      className="text-content-secondary border-border-default hover:bg-content-primary/5 hover:text-content-primary mt-0.5 cursor-pointer rounded-md border px-2 py-1 text-left text-xxs"
    >
      Tidy layout
    </button>
  );
}

/** "+ Node" menu — adds a node at the viewport center. */
function AddNodeMenu({ onAdd }: { onAdd: (type: NodeType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-content-secondary border-border-default hover:bg-content-primary/5 hover:text-content-primary cursor-pointer rounded-md border px-2 py-1 text-left text-xxs"
      >
        + node
      </button>
      {open && (
        <div className="bg-background-surface border-border-default absolute bottom-full left-0 z-10 mb-1 flex w-32 flex-col overflow-hidden rounded-lg border shadow-md">
          {NODE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onAdd(t);
                setOpen(false);
              }}
              className="text-content-primary hover:bg-content-primary/5 cursor-pointer px-2.5 py-1 text-left text-xs capitalize"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FlowCanvas({
  slug,
  experiment,
}: {
  slug: string;
  experiment: ExperimentFlow;
}) {
  // Draft flow — the canvas edits this copy, never the fetched config.
  const [draft, setDraft] = useState(experiment);
  const past = useRef<ExperimentFlow[]>([]);
  const future = useRef<ExperimentFlow[]>([]);
  const [depth, setDepth] = useState({ undo: 0, redo: 0 });
  const syncDepth = () =>
    setDepth({ undo: past.current.length, redo: future.current.length });

  const mutate = (fn: (f: ExperimentFlow) => ExperimentFlow) => {
    setDraft((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      past.current.push(prev);
      future.current = [];
      return next;
    });
    syncDepth();
  };

  const undo = () => {
    setDraft((prev) => {
      const p = past.current.pop();
      if (!p) return prev;
      future.current.push(prev);
      return p;
    });
    syncDepth();
  };

  const redo = () => {
    setDraft((prev) => {
      const f = future.current.pop();
      if (!f) return prev;
      past.current.push(prev);
      return f;
    });
    syncDepth();
  };

  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EditorEdge>([]);
  const [view, setView] = useState<ViewOptions>(DEFAULT_VIEW_OPTIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'raw' | 'live'>('raw');
  const [layoutVersion, setLayoutVersion] = useState(0);
  const { resolvedTheme } = useTheme();

  const toggle = (key: keyof ViewOptions) =>
    setView((v) => ({ ...v, [key]: !v[key] }));

  const graph = useMemo(() => {
    const g = toFlowGraph(draft);
    const laid = layoutFlow(g.nodes, g.edges);
    const saved = loadPositions(slug);
    return {
      ...g,
      nodes: laid.map((n) =>
        saved[n.id] ? { ...n, position: saved[n.id] } : n,
      ),
    };
  }, [draft, slug, layoutVersion]); // layoutVersion: "Tidy" re-runs layout

  const issues = useMemo(() => validateExperiment(draft), [draft]);

  // Live positions — updated on every position change so draft edits rebuild
  // nodes without losing where the user put things.
  const posRef = useRef<Record<string, XYPosition>>({});
  const selRef = useRef<string | null>(null);

  const handleNodesChange: OnNodesChange<EditorNode> = (changes) => {
    for (const c of changes)
      if (c.type === 'position' && c.position) posRef.current[c.id] = c.position;
    onNodesChange(changes);
  };

  // Rebuild nodes only when the graph changes (draft edits, layout re-runs).
  // Positions come from posRef (authoritative in-session) → saved → dagre.
  useEffect(() => {
    setNodes(
      graph.nodes.map((n) => ({
        ...n,
        position: posRef.current[n.id] ?? n.position,
        selected: n.id === selRef.current || undefined,
      })),
    );
  }, [graph, setNodes]);

  useEffect(() => {
    setEdges(view.dataFlow ? [...graph.edges, ...graph.dataEdges] : graph.edges);
  }, [graph, view.dataFlow, setEdges]);

  // ── Edit callbacks ─────────────────────────────────────────────────────────

  const isValidConnection: IsValidConnection = (conn) =>
    !!(
      conn.source &&
      conn.target &&
      conn.sourceHandle &&
      conn.targetHandle &&
      canConnect(draft, {
        source: conn.source,
        sourceHandle: conn.sourceHandle,
        target: conn.target,
      })
    );

  const onConnect = (conn: Connection) => {
    const { source, target, sourceHandle } = conn;
    if (!source || !target || !sourceHandle || !conn.targetHandle) return;
    mutate((f) => connect(f, { source, sourceHandle, target }));
  };

  const onReconnect = (oldEdge: Edge, conn: Connection) => {
    const { source, target, sourceHandle } = conn;
    if (!source || !target || !sourceHandle || !conn.targetHandle) return;
    mutate((f) => reconnect(f, oldEdge.id, { source, sourceHandle, target }));
  };

  const onNodesDelete = (deleted: Node[]) => {
    if (deleted.length) mutate((f) => deleteNodes(f, deleted.map((n) => n.id)));
  };

  const onEdgesDelete = (deleted: Edge[]) => {
    if (deleted.length) mutate((f) => deleteEdgeIds(f, deleted.map((e) => e.id)));
  };

  const onNodeDragStop: OnNodeDrag = (_e, node) => {
    posRef.current[node.id] = node.position;
    savePositions(slug, posRef.current);
  };

  const tidy = () => {
    clearPositions(slug);
    posRef.current = {};
    setLayoutVersion((v) => v + 1);
  };

  // ── Selection / inspector ──────────────────────────────────────────────────

  const raw = useMemo(() => {
    if (!selectedId) return null;
    const node = draft.nodes.find((n) => n.id === selectedId);
    if (!node) return null;
    const screen =
      node.type === 'screen'
        ? draft.screens?.find((s) => s.slug === node.props.slug)
        : undefined;
    const touching = draft.edges.filter(
      (e) => e.from.split('.')[0] === node.id || e.to === node.id,
    );
    return { node, screen, edges: touching };
  }, [selectedId, draft]);

  const onSelectionChange = ({ nodes: sel }: OnSelectionChangeParams) => {
    const id = sel[0]?.id ?? null;
    selRef.current = id;
    setSelectedId(id);
    const node = id ? draft.nodes.find((n) => n.id === id) : null;
    setInspectorTab(node?.type === 'screen' ? 'live' : 'raw');
  };

  // ── Keyboard: undo/redo ────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const errors = issues.filter((i) => i.severity !== 'warning');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const toggles: { key: keyof ViewOptions; label: string; hint?: string }[] = [
    { key: 'dataFlow', label: 'Data flow', hint: `${graph.dataEdges.length}` },
    { key: 'fields', label: 'Fields' },
    { key: 'preview', label: 'Screen preview' },
    { key: 'labels', label: 'Edge labels' },
    { key: 'details', label: 'Prop details' },
  ];

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const selected = raw?.node;
  const selectedHasName =
    selected && 'props' in selected && 'name' in (selected.props ?? {});

  return (
    <div className="border-border-default bg-background h-[75vh] w-full overflow-hidden rounded-xl border">
      <ViewOptionsContext.Provider value={view}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.2}
          isValidConnection={isValidConnection}
          onConnect={onConnect}
          onReconnect={onReconnect}
          reconnectRadius={20}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          deleteKeyCode={['Backspace', 'Delete']}
          onNodeDragStop={onNodeDragStop}
          onSelectionChange={onSelectionChange}
          colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={minimapColor}
            pannable
            zoomable
            className="!bg-background-surface"
          />

          <Panel position="top-left">
            <div className="bg-background-surface border-border-default flex flex-col gap-1 rounded-lg border p-2.5 shadow-sm">
              {toggles.map(({ key, label, hint }) => (
                <label
                  key={key}
                  className="text-content-primary flex cursor-pointer items-center gap-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={view[key]}
                    onChange={() => toggle(key)}
                    className="accent-[#a78bfa]"
                  />
                  {label}
                  {hint && (
                    <span className="text-content-secondary font-mono text-xxs">
                      {hint}
                    </span>
                  )}
                </label>
              ))}
              <div className="border-border-default mt-1 flex flex-col gap-1 border-t pt-1.5">
                <AddNodeMenu
                  onAdd={(type) => {
                    const { flow, id } = addNode(draft, type);
                    mutate(() => flow);
                    setSelectedId(id);
                  }}
                />
                <TidyButton onTidy={tidy} />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={!depth.undo}
                    className="text-content-secondary border-border-default hover:bg-content-primary/5 hover:text-content-primary flex-1 cursor-pointer rounded-md border px-2 py-1 text-xxs disabled:opacity-40"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={!depth.redo}
                    className="text-content-secondary border-border-default hover:bg-content-primary/5 hover:text-content-primary flex-1 cursor-pointer rounded-md border px-2 py-1 text-xxs disabled:opacity-40"
                  >
                    Redo
                  </button>
                </div>
                <button
                  type="button"
                  onClick={downloadJson}
                  className="text-content-secondary border-border-default hover:bg-content-primary/5 hover:text-content-primary cursor-pointer rounded-md border px-2 py-1 text-left text-xxs"
                >
                  Download JSON
                </button>
              </div>
              <p className="text-content-secondary border-border-default mt-1 border-t pt-1.5 text-xxs">
                Click a node to inspect
              </p>
            </div>
          </Panel>

          {(raw || issues.length > 0) && (
            <Panel
              position="top-right"
              className="flex w-96 max-w-96 flex-col gap-2"
            >
              {raw && selected && (
                <div className="bg-background-surface border-border-default overflow-hidden rounded-lg border shadow-sm">
                  <div className="border-border-default flex items-center justify-between gap-2 border-b px-3 py-1.5">
                    <span className="text-content-primary min-w-0 truncate font-mono text-xs font-semibold">
                      {selected.id}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {raw.screen && (
                        <div className="border-border-default mr-1 flex overflow-hidden rounded-md border text-xxs">
                          {(['live', 'raw'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setInspectorTab(t)}
                              className={`cursor-pointer px-2 py-0.5 ${
                                inspectorTab === t
                                  ? 'bg-content-primary/10 text-content-primary font-medium'
                                  : 'text-content-secondary'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="text-content-secondary hover:text-content-primary cursor-pointer text-xs"
                        aria-label="Close inspector"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* ── edit affordances ── */}
                  <div className="border-border-default flex flex-col gap-1.5 border-b px-3 py-2">
                    {selectedHasName && (
                      <label className="flex items-center gap-2 text-xxs">
                        <span className="text-content-secondary w-12 shrink-0">
                          name
                        </span>
                        <input
                          className="border-border-default bg-background text-content-primary min-w-0 flex-1 rounded border px-1.5 py-0.5 font-mono"
                          value={(selected.props as { name: string }).name}
                          onChange={(e) =>
                            setDraft((d) =>
                              setNodeName(d, selected.id, e.target.value),
                            )
                          }
                        />
                      </label>
                    )}
                    {selected.type === 'screen' && (
                      <label className="flex items-center gap-2 text-xxs">
                        <span className="text-content-secondary w-12 shrink-0">
                          screen
                        </span>
                        <select
                          className="border-border-default bg-background text-content-primary min-w-0 flex-1 rounded border px-1.5 py-0.5 font-mono"
                          value={selected.props.slug}
                          onChange={(e) =>
                            setDraft((d) =>
                              setScreenSlug(d, selected.id, e.target.value),
                            )
                          }
                        >
                          {(draft.screens ?? []).map((s) => (
                            <option key={s.slug} value={s.slug}>
                              {s.slug}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {(selected.type === 'branch' ||
                      selected.type === 'fork') && (
                      <div className="flex items-center gap-2 text-xxs">
                        <span className="text-content-secondary w-12 shrink-0">
                          arms
                        </span>
                        <div className="flex flex-wrap items-center gap-1">
                          {(
                            (selected.type === 'branch'
                              ? selected.props.branches
                              : selected.props.forks) as {
                              id: string;
                              name: string;
                            }[]
                          ).map((arm) => (
                            <span
                              key={arm.id}
                              className="border-border-default bg-background flex items-center gap-1 rounded-full border px-1.5 py-px font-mono"
                            >
                              {arm.name}
                              <button
                                type="button"
                                aria-label={`Remove arm ${arm.name}`}
                                onClick={() =>
                                  mutate((f) =>
                                    removeArm(f, selected.id, arm.id),
                                  )
                                }
                                className="text-content-secondary hover:text-error cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => mutate((f) => addArm(f, selected.id))}
                            className="border-border-default text-content-secondary hover:text-content-primary cursor-pointer rounded-full border border-dashed px-1.5 py-px"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {inspectorTab === 'live' && raw.screen ? (
                    <div className="max-h-[70vh] overflow-auto p-3">
                      <LiveScreenPreview flow={draft} screen={raw.screen} />
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-auto p-3">
                      <pre className="text-content-primary font-mono text-xxs leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(
                          {
                            id: selected.id,
                            type: selected.type,
                            props:
                              'props' in selected ? selected.props : undefined,
                          },
                          null,
                          2,
                        )}
                      </pre>
                      {raw.screen && (
                        <>
                          <p className="text-content-secondary border-border-default mt-2 border-t pt-2 font-mono text-xxs">
                            screen — {raw.screen.slug}
                          </p>
                          <pre className="text-content-primary font-mono text-xxs leading-relaxed whitespace-pre-wrap">
                            {JSON.stringify(raw.screen.components, null, 2)}
                          </pre>
                        </>
                      )}
                      {raw.edges.length > 0 && (
                        <>
                          <p className="text-content-secondary border-border-default mt-2 border-t pt-2 font-mono text-xxs">
                            edges
                          </p>
                          <pre className="text-content-primary font-mono text-xxs leading-relaxed whitespace-pre-wrap">
                            {JSON.stringify(raw.edges, null, 2)}
                          </pre>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {issues.length > 0 && (
                <details className="bg-background-surface border-border-default rounded-lg border p-3 shadow-sm">
                  <summary className="text-content-primary cursor-pointer text-xs font-semibold">
                    {errors.length} errors · {warnings.length} warnings
                  </summary>
                  <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-auto">
                    {issues.map((issue, i) => (
                      <li key={i} className="text-xxs leading-snug">
                        <span
                          className={
                            issue.severity === 'warning'
                              ? 'text-warning'
                              : 'text-error'
                          }
                        >
                          [{issue.code}]
                        </span>{' '}
                        <span className="text-content-secondary">
                          {issue.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Panel>
          )}
        </ReactFlow>
      </ViewOptionsContext.Provider>
    </div>
  );
}
