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
} from '@xyflow/react';
import type { NodeType } from '@experiment-hub/engine/nodes';
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
            </div>
          </Panel>

          {issues.length > 0 && (
            <Panel position="top-right" className="max-w-80">
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
            </Panel>
          )}
        </ReactFlow>
      </ViewOptionsContext.Provider>
    </div>
  );
}
