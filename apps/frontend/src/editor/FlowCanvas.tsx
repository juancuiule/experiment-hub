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
  type OnSelectionChangeParams,
} from '@xyflow/react';
import type { FrameworkNode, NodeType } from '@experiment-hub/engine/nodes';
import type { ExperimentFlow } from '@experiment-hub/engine/types';
import type { ValidationError } from '@experiment-hub/engine/experiment-validation/types';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';
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

export default function FlowCanvas({
  experiment,
  issues,
}: {
  experiment: ExperimentFlow;
  issues: ValidationError[];
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EditorEdge>([]);
  const [view, setView] = useState<ViewOptions>(DEFAULT_VIEW_OPTIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  const toggle = (key: keyof ViewOptions) =>
    setView((v) => ({ ...v, [key]: !v[key] }));

  const graph = useMemo(() => {
    const g = toFlowGraph(experiment);
    return { ...g, nodes: layoutFlow(g.nodes, g.edges) };
  }, [experiment]);

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

  const onSelectionChange = ({ nodes: sel }: OnSelectionChangeParams) =>
    setSelectedId(sel[0]?.id ?? null);

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
            </div>
          </Panel>

          {(raw || issues.length > 0) && (
            <Panel
              position="top-right"
              className="flex w-96 max-w-96 flex-col gap-2"
            >
              {raw && (
                <div className="bg-background-surface border-border-default overflow-hidden rounded-lg border shadow-sm">
                  <div className="border-border-default flex items-center justify-between border-b px-3 py-1.5">
                    <span className="text-content-primary font-mono text-xs font-semibold">
                      {raw.node.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="text-content-secondary hover:text-content-primary cursor-pointer text-xs"
                      aria-label="Close raw view"
                    >
                      ✕
                    </button>
                  </div>
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
