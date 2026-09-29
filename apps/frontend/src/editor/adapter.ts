import dagre from '@dagrejs/dagre';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Condition } from '@experiment-hub/engine/conditions';
import type { FrameworkEdge } from '@experiment-hub/engine/edges';
import { collectFields } from '@experiment-hub/engine/fields';
import type { FrameworkNode, NodeType } from '@experiment-hub/engine/nodes';
import type { FrameworkScreen } from '@experiment-hub/engine/screen';
import type { ExperimentFlow } from '@experiment-hub/engine/types';

// ─── Handles ─────────────────────────────────────────────────────────────────
// The engine encodes edge roles in `edge.type` (+ dotted `from` for arm edges);
// on the canvas each role becomes a named source handle on the node. Edge type
// is fully determined by (source node type, handle id) — see
// docs/proposals/node-graph-editor.md.

export const HANDLE_IN = 'in';
export const HANDLE_NEXT = 'next';
export const HANDLE_DEFAULT = 'default';
export const HANDLE_TEMPLATE = 'template';
export const HANDLE_CHILDREN = 'children';
export const branchHandle = (branchId: string) => `branch.${branchId}`;
export const forkHandle = (forkId: string) => `fork.${forkId}`;

// ─── Types ───────────────────────────────────────────────────────────────────

export type EditorNodeData = {
  node: FrameworkNode;
  /** Field keys the screen collects (response dataKeys, `:order` shadows, button payloads). */
  fields: string[];
  /** Output keys a compute/data node publishes as `$$<nodeId>.<key>`. */
  outputs: string[];
};

export type EditorNode = Node<EditorNodeData, NodeType>;

export type EditorEdgeData = {
  edge: FrameworkEdge;
  /** Pill label rendered mid-edge (arm name, "else", order…). */
  label?: string;
  /** Stroke + pill color. */
  color: string;
  dashed?: boolean;
};

export type EditorEdge = Edge<EditorEdgeData>;

// ─── Colors ──────────────────────────────────────────────────────────────────

/** Categorical ramp for branch/fork arms — arm index i gets ARM_COLORS[i % n]. */
export const ARM_COLORS = [
  '#0ea5e9', // sky
  '#8b5cf6', // violet
  '#f97316', // orange
  '#ec4899', // pink
  '#84cc16', // lime
  '#14b8a6', // teal
] as const;

export const EDGE_NEUTRAL = '#9ca3af';
export const EDGE_STRUCTURAL = '#a8a29e';
export const EDGE_DEFAULT_ARM = '#6b7280';

// ─── Edge mapping ────────────────────────────────────────────────────────────

/** Split a dotted `nodeId.subId` edge source into its parts. */
export function splitFrom(from: string): { nodeId: string; subId?: string } {
  const dot = from.indexOf('.');
  return dot === -1
    ? { nodeId: from }
    : { nodeId: from.slice(0, dot), subId: from.slice(dot + 1) };
}

export function edgeId(edge: FrameworkEdge): string {
  return `${edge.type}:${edge.from}->${edge.to}`;
}

function armIndex(node: FrameworkNode | undefined, subId: string): number {
  if (!node) return 0;
  const arms =
    node.type === 'branch'
      ? node.props.branches
      : node.type === 'fork'
        ? node.props.forks
        : [];
  const i = arms.findIndex((a) => a.id === subId);
  return i === -1 ? 0 : i;
}

function armName(node: FrameworkNode | undefined, subId: string): string {
  const arms =
    node?.type === 'branch'
      ? node.props.branches
      : node?.type === 'fork'
        ? node.props.forks
        : undefined;
  return arms?.find((a) => a.id === subId)?.name ?? subId;
}

function armWeight(node: FrameworkNode | undefined, subId: string): string {
  if (node?.type !== 'fork') return '';
  const w = node.props.forks.find((f) => f.id === subId)?.weight;
  return w == null ? '' : ` ×${w}`;
}

function toEditorEdge(
  edge: FrameworkEdge,
  nodesById: Map<string, FrameworkNode>,
): EditorEdge {
  const { nodeId, subId } = splitFrom(edge.from);
  const source = nodesById.get(nodeId);

  let sourceHandle = HANDLE_NEXT;
  let label: string | undefined;
  let color: string = EDGE_NEUTRAL;
  let dashed = false;

  switch (edge.type) {
    case 'branch-condition':
      sourceHandle = branchHandle(subId!);
      label = armName(source, subId!);
      color = ARM_COLORS[armIndex(source, subId!) % ARM_COLORS.length];
      break;
    case 'branch-default':
      sourceHandle = HANDLE_DEFAULT;
      label = 'else';
      color = EDGE_DEFAULT_ARM;
      dashed = true;
      break;
    case 'fork-edge':
      sourceHandle = forkHandle(subId!);
      label = armName(source, subId!) + armWeight(source, subId!);
      color = ARM_COLORS[armIndex(source, subId!) % ARM_COLORS.length];
      break;
    case 'path-contains':
      sourceHandle = HANDLE_CHILDREN;
      label = `${edge.order + 1}`;
      color = EDGE_STRUCTURAL;
      dashed = true;
      break;
    case 'loop-template':
      sourceHandle = HANDLE_TEMPLATE;
      label = 'each';
      color = EDGE_STRUCTURAL;
      dashed = true;
      break;
  }

  return {
    id: edgeId(edge),
    type: 'pill',
    source: nodeId,
    sourceHandle,
    target: edge.to,
    targetHandle: HANDLE_IN,
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
    data: { edge, label, color, dashed },
  };
}

// ─── Fields / outputs ────────────────────────────────────────────────────────

function screenFields(screen: FrameworkScreen | undefined): string[] {
  if (!screen) return [];
  return collectFields(screen.components, {}).map((f) =>
    f.kind === 'static' ? f.key : f.keyTemplate,
  );
}

function nodeOutputs(node: FrameworkNode): string[] {
  if (node.type === 'compute')
    return node.props.computations.map((c) => c.outputKey);
  if (node.type === 'data') return Object.keys(node.props.data);
  return [];
}

// ─── Condition summary ───────────────────────────────────────────────────────

const OP_SYMBOL: Record<string, string> = {
  eq: '=',
  neq: '≠',
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
  contains: '∋',
};

export function conditionToString(condition: Condition): string {
  switch (condition.type) {
    case 'simple': {
      const op = condition.operator.startsWith('length-')
        ? `length ${OP_SYMBOL[condition.operator.slice(7)] ?? condition.operator}`
        : (OP_SYMBOL[condition.operator] ?? condition.operator);
      return `${condition.dataKey} ${op} ${JSON.stringify(condition.value)}`;
    }
    case 'and':
    case 'or':
      return condition.conditions
        .map(conditionToString)
        .join(condition.type === 'and' ? ' ∧ ' : ' ∨ ');
    case 'not':
      return `¬(${conditionToString(condition.condition)})`;
  }
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export function toFlowGraph(flow: ExperimentFlow): {
  nodes: EditorNode[];
  edges: EditorEdge[];
} {
  const nodesById = new Map(flow.nodes.map((n) => [n.id, n]));
  const screensBySlug = new Map((flow.screens ?? []).map((s) => [s.slug, s]));

  const nodes: EditorNode[] = flow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: 0, y: 0 }, // replaced by layoutFlow
    data: {
      node,
      fields:
        node.type === 'screen'
          ? screenFields(screensBySlug.get(node.props.slug))
          : [],
      outputs: nodeOutputs(node),
    },
  }));

  const edges = flow.edges.map((e) => toEditorEdge(e, nodesById));
  return { nodes, edges };
}

// ─── Layout ──────────────────────────────────────────────────────────────────

const NODE_WIDTH = 240;
const ROW_HEIGHT = 26;

function estimateHeight(node: EditorNode): number {
  let rows = 1;
  const n = node.data.node;
  switch (n.type) {
    case 'branch':
      rows = n.props.branches.length + 1; // arms + else
      break;
    case 'fork':
      rows = n.props.forks.length;
      break;
    case 'path':
    case 'loop':
      rows = 3;
      break;
    case 'screen':
      rows = 1 + Math.min(node.data.fields.length, 4) + 1;
      break;
    case 'compute':
    case 'data':
      rows = 1 + Math.min(node.data.outputs.length, 4);
      break;
    default:
      rows = 1;
  }
  return 48 + rows * ROW_HEIGHT;
}

/** Dagre left-to-right layout — matches the "automation canvas" aesthetic. */
export function layoutFlow(
  nodes: EditorNode[],
  edges: EditorEdge[],
): EditorNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 32, ranksep: 110, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const height = estimateHeight(node);
    g.setNode(node.id, { width: NODE_WIDTH, height });
  }
  for (const edge of edges) g.setEdge(edge.source, edge.target);

  dagre.layout(g);

  return nodes.map((node) => {
    const gNode = g.node(node.id);
    return {
      ...node,
      position: {
        x: gNode.x - NODE_WIDTH / 2,
        y: gNode.y - gNode.height / 2,
      },
    };
  });
}
