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
  type OnNodeDrag,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import type { FrameworkNode, NodeType } from '@experiment-hub/engine/nodes';
import type { ExperimentFlow } from '@experiment-hub/engine/types';
import type { ValidationError } from '@experiment-hub/engine/experiment-validation/types';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';
import LiveScreenPreview from './LiveScreenPreview';
import { clearPositions, loadPositions, savePositions } from './positions';
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

export default function FlowCanvas({
  slug,
  experiment,
  issues,
}: {
  slug: string;
  experiment: ExperimentFlow;
  issues: ValidationError[];
}) {
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
    const g = toFlowGraph(experiment);
    const laid = layoutFlow(g.nodes, g.edges);
    const saved = loadPositions(slug);
    return {
      ...g,
      nodes: laid.map((n) =>
        saved[n.id] ? { ...n, position: saved[n.id] } : n,
      ),
    };
  }, [experiment, slug, layoutVersion]); // layoutVersion: "Tidy" re-runs layout

  const onNodeDragStop: OnNodeDrag = (_event, node) => {
    const positions = Object.fromEntries(
      nodes.map((n) => [n.id, n.position]),
    );
    positions[node.id] = node.position;
    savePositions(slug, positions);
  };

  const tidy = () => {
    clearPositions(slug);
    setLayoutVersion((v) => v + 1);
  };

  useEffect(() => {
    setNodes(graph.nodes);
  }, [graph, setNodes]);

  useEffect(() => {
    setEdges(view.dataFlow ? [...graph.edges, ...graph.dataEdges] : graph.edges);
  }, [graph, view.dataFlow, setEdges]);

  const errors = issues.filter((i) => i.severity !== 'warning');
  const warnings = issues.filter((i) => i.severity === 'warning');

  // Raw inspector payload for the selected node — real engine JSON.
  const raw = useMemo(() => {
    if (!selectedId) return null;
    const editorNode = graph.nodes.find((n) => n.id === selectedId);
    if (!editorNode) return null;
    const node = (editorNode.data as { node: FrameworkNode }).node;
    const screen =
      node.type === 'screen'
        ? experiment.screens?.find((s) => s.slug === node.props.slug)
        : undefined;
    const touching = experiment.edges.filter(
      (e) => e.from.split('.')[0] === node.id || e.to === node.id,
    );
    return { node, screen, edges: touching };
  }, [selectedId, graph, experiment]);

  const onSelectionChange = ({ nodes: sel }: OnSelectionChangeParams) => {
    const id = sel[0]?.id ?? null;
    setSelectedId(id);
    // Default to the live preview when a screen node is selected.
    const node = id
      ? (graph.nodes.find((n) => n.id === id)?.data as { node: FrameworkNode })
          ?.node
      : null;
    setInspectorTab(node?.type === 'screen' ? 'live' : 'raw');
  };

  const toggles: { key: keyof ViewOptions; label: string; hint?: string }[] = [
    { key: 'dataFlow', label: 'Data flow', hint: `${graph.dataEdges.length}` },
    { key: 'fields', label: 'Fields' },
    { key: 'preview', label: 'Screen preview' },
    { key: 'labels', label: 'Edge labels' },
    { key: 'details', label: 'Prop details' },
  ];

  return (
    <div className="border-border-default bg-background h-[75vh] w-full overflow-hidden rounded-xl border">
      <ViewOptionsContext.Provider value={view}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.2}
          nodesConnectable={false}
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
              <p className="text-content-secondary border-border-default mt-1 border-t pt-1.5 text-xxs">
                Click a node for raw JSON
              </p>
              <TidyButton onTidy={tidy} />
            </div>
          </Panel>

          {(raw || issues.length > 0) && (
            <Panel
              position="top-right"
              className="flex w-96 max-w-96 flex-col gap-2"
            >
              {raw && (
                <div className="bg-background-surface border-border-default overflow-hidden rounded-lg border shadow-sm">
                  <div className="border-border-default flex items-center justify-between gap-2 border-b px-3 py-1.5">
                    <span className="text-content-primary min-w-0 truncate font-mono text-xs font-semibold">
                      {raw.node.id}
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

                  {inspectorTab === 'live' && raw.screen ? (
                    <div className="max-h-[70vh] overflow-auto p-3">
                      <LiveScreenPreview flow={experiment} screen={raw.screen} />
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-auto p-3">
                      <pre className="text-content-primary font-mono text-xxs leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(
                          {
                            id: raw.node.id,
                            type: raw.node.type,
                            props:
                              'props' in raw.node ? raw.node.props : undefined,
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
