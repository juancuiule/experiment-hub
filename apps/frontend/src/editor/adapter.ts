import dagre from '@dagrejs/dagre';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Condition } from '@experiment-hub/engine/conditions';
import type { FrameworkEdge } from '@experiment-hub/engine/edges';
import { collectFields } from '@experiment-hub/engine/fields';
import type {
  FrameworkNode,
  LoopNode,
  PathNode,
  ScreenNode,
} from '@experiment-hub/engine/nodes';
import type { FrameworkScreen } from '@experiment-hub/engine/screen';
import type { ScreenComponent } from '@experiment-hub/engine/components';
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
  /** Flattened component skeleton for screen nodes (preview + field map). */
  components: ComponentRow[];
  /** Declared member position inside the parent container (layout ordering). */
  memberIndex?: number;
  /** Position badge for ordered (non-randomized) path children. */
  childIndex?: number;
};

export type ComponentRow = {
  /** Indent level within the component tree. */
  depth: number;
  family: string;
  template: string;
  /** Field keys this component produces — raw `dataKey`/`payload.dataKey` props
   *  (may contain `{{ }}` templates), plus the `:order` shadow for randomized
   *  option lists. */
  keys: string[];
};

export type ContainerNodeData = {
  /** The path/loop node this frame represents. */
  node: PathNode | LoopNode;
  kind: 'path' | 'loop';
  /** Declared member position inside the parent container (layout ordering). */
  memberIndex?: number;
};

export type EditorNode = Node<EditorNodeData | ContainerNodeData, string>;

export type EditorEdgeData = {
  edge?: FrameworkEdge;
  /** Pill label rendered mid-edge (arm name, "else"…). */
  label?: string;
  color: string;
  dashed?: boolean;
  /** Data-dependency overlay edge (not a flow edge). */
  dataflow?: boolean;
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
export const EDGE_DEFAULT_ARM = '#6b7280';
export const EDGE_DATAFLOW = '#a78bfa';

export const CONTAINER_COLORS = {
  path: '#14b8a6',
  loop: '#ec4899',
} as const;

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

function arms(node: FrameworkNode | undefined): { id: string; name: string }[] {
  if (node?.type === 'branch') return node.props.branches;
  if (node?.type === 'fork') return node.props.forks;
  return [];
}

function armIndex(node: FrameworkNode | undefined, subId: string): number {
  const i = arms(node).findIndex((a) => a.id === subId);
  return i === -1 ? 0 : i;
}

function armLabel(node: FrameworkNode | undefined, subId: string): string {
  const arm = arms(node).find((a) => a.id === subId);
  const weight =
    node?.type === 'fork'
      ? node.props.forks.find((f) => f.id === subId)?.weight
      : undefined;
  return (arm?.name ?? subId) + (weight != null ? ` ×${weight}` : '');
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
      label = armLabel(source, subId!);
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
      label = armLabel(source, subId!);
      color = ARM_COLORS[armIndex(source, subId!) % ARM_COLORS.length];
      break;
    // containment edges never reach here — they render as container membership
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

type NestableProps = {
  components?: ScreenComponent[];
  then?: ScreenComponent;
  else?: ScreenComponent;
  component?: ScreenComponent;
  dataKey?: string;
  randomize?: boolean;
  payload?: { dataKey?: string };
};

/**
 * Flatten a screen's component tree into depth-marked rows, pairing each
 * component with the field key(s) it produces (`dataKey`, `:order` shadow,
 * button `payload.dataKey`). dataKeys are shown as authored — token templates
 * like `{{#fe.value}}` stay visible.
 */
function componentRows(components: ScreenComponent[] | undefined): ComponentRow[] {
  const rows: ComponentRow[] = [];
  const walk = (c: ScreenComponent, depth: number) => {
    const p = c.props as NestableProps;
    const keys: string[] = [];
    if (c.componentFamily === 'response' && p.dataKey) {
      keys.push(p.dataKey);
      if (p.randomize) keys.push(`${p.dataKey}:order`);
    }
    if (c.template === 'button' && p.payload?.dataKey)
      keys.push(p.payload.dataKey);
    rows.push({ depth, family: c.componentFamily, template: c.template, keys });
    for (const child of p.components ?? []) walk(child, depth + 1);
    if (p.then) walk(p.then, depth + 1);
    if (p.else) walk(p.else, depth + 1);
    if (p.component) walk(p.component, depth + 1);
  };
  for (const c of components ?? []) walk(c, 0);
  return rows;
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

// ─── Data-dependency edges ───────────────────────────────────────────────────

const DATA_REF_RE = /\$\$[\w-]+(?:\.[\w-]+)*/g;
const LOOP_REF_RE = /@[\w-]+/g;

/**
 * Resolve a `$$a.b.c` reference to the node that produces it.
 * First segment is a node id (compute/data/loop/path) or a screen slug; for
 * paths/loops we descend one level so `$$pathId.slug.field` links to the
 * screen node rather than the container.
 */
function resolveProducer(
  ref: string,
  nodesById: Map<string, FrameworkNode>,
  nodesBySlug: Map<string, FrameworkNode>,
): string | null {
  const segs = ref.split('.');
  const head = nodesById.get(segs[0]);
  if (head) {
    if ((head.type === 'path' || head.type === 'loop') && segs.length > 1) {
      // $$pathId.slug.field / $$loopId.iterKey.slug.field
      const slugSeg = head.type === 'loop' ? segs[2] : segs[1];
      const inner = slugSeg ? nodesBySlug.get(slugSeg) : undefined;
      return inner?.id ?? head.id;
    }
    return head.id;
  }
  return nodesBySlug.get(segs[0])?.id ?? null;
}

/**
 * Scan every node's props (and its screen's components) for `$$`/`@` refs and
 * derive producer → consumer overlay edges. Never serialized — visualization
 * only. `$$path.to.x` (loop dataKeys, formula inputs, conditions, {{}} pipes)
 * and `@loopId` refs both map onto the producing node.
 */
function buildDataEdges(flow: ExperimentFlow): EditorEdge[] {
  const nodesById = new Map(flow.nodes.map((n) => [n.id, n]));
  const nodesBySlug = new Map(
    flow.nodes
      .filter((n): n is ScreenNode => n.type === 'screen')
      .map((n) => [n.props.slug, n] as const),
  );
  const screensBySlug = new Map((flow.screens ?? []).map((s) => [s.slug, s]));

  // producer -> consumer -> refs seen
  const deps = new Map<string, Set<string>>();

  const record = (consumerId: string, producerId: string, ref: string) => {
    if (producerId === consumerId) return;
    const key = `${producerId}->${consumerId}`;
    if (!deps.has(key)) deps.set(key, new Set());
    deps.get(key)!.add(ref);
  };

  const scan = (consumerId: string, json: string) => {
    for (const m of json.matchAll(DATA_REF_RE)) {
      const producer = resolveProducer(m[0].slice(2), nodesById, nodesBySlug);
      if (producer) record(consumerId, producer, m[0]);
    }
    for (const m of json.matchAll(LOOP_REF_RE)) {
      const producer = nodesById.get(m[0].slice(1));
      if (producer) record(consumerId, producer.id, m[0]);
    }
  };

  for (const node of flow.nodes) {
    scan(node.id, JSON.stringify('props' in node ? node.props : {}));
    if (node.type === 'screen') {
      const screen = screensBySlug.get(node.props.slug);
      if (screen) scan(node.id, JSON.stringify(screen.components));
    }
  }

  return [...deps.entries()].map(([key, refs]) => {
    const [source, target] = key.split('->');
    const refList = [...refs];
    const label =
      refs.size === 1 ? refList[0].replace(/^\$\$|^@/, '') : `${refs.size} refs`;
    return {
      id: `dataflow:${key}`,
      type: 'pill',
      source,
      target,
      targetHandle: HANDLE_IN,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: EDGE_DATAFLOW,
        width: 14,
        height: 14,
      },
      data: {
        label,
        color: EDGE_DATAFLOW,
        dashed: true,
        dataflow: true,
      },
    };
  });
}

// ─── Container membership ────────────────────────────────────────────────────

/** path-contains / loop-template edges → { containerId: [childIds in order] } */
export function containerMembers(
  edges: FrameworkEdge[],
): Map<string, string[]> {
  const members = new Map<string, { id: string; order: number }[]>();
  for (const e of edges) {
    if (e.type !== 'path-contains' && e.type !== 'loop-template') continue;
    if (!members.has(e.from)) members.set(e.from, []);
    members.get(e.from)!.push({
      id: e.to,
      order: e.type === 'path-contains' ? e.order : 0,
    });
  }
  return new Map(
    [...members.entries()].map(([id, list]) => [
      id,
      list.sort((a, b) => a.order - b.order).map((c) => c.id),
    ]),
  );
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

const isContainment = (t: FrameworkEdge['type']) =>
  t === 'path-contains' || t === 'loop-template';

export function toFlowGraph(flow: ExperimentFlow): {
  nodes: EditorNode[];
  edges: EditorEdge[];
  dataEdges: EditorEdge[];
} {
  const nodesById = new Map(flow.nodes.map((n) => [n.id, n]));
  const screensBySlug = new Map((flow.screens ?? []).map((s) => [s.slug, s]));
  const members = containerMembers(flow.edges);
  const childToParent = new Map<string, string>();
  for (const [parent, children] of members)
    for (const c of children) childToParent.set(c, parent);

  // Depth = number of ancestor containers — parents must precede children in
  // the nodes array (React Flow requirement).
  const depth = (id: string): number => {
    let d = 0;
    let cur = childToParent.get(id);
    while (cur) {
      d++;
      cur = childToParent.get(cur);
    }
    return d;
  };

  const nodes: EditorNode[] = [...flow.nodes]
    .sort((a, b) => depth(a.id) - depth(b.id))
    .map((node) => {
      const parent = childToParent.get(node.id);
      const isContainer = members.has(node.id);
      const base = {
        id: node.id,
        position: { x: 0, y: 0 }, // replaced by layoutFlow
        ...(parent
          ? {
              parentId: parent,
              extent: 'parent' as const,
              expandParent: true,
            }
          : {}),
      };
      const memberIndex = parent
        ? members.get(parent)!.indexOf(node.id)
        : undefined;
      if (isContainer) {
        return {
          ...base,
          type: 'container',
          data: {
            node: node as PathNode | LoopNode,
            kind: node.type === 'loop' ? 'loop' : 'path',
            memberIndex,
          } satisfies ContainerNodeData,
        };
      }
      const parentNode = parent ? nodesById.get(parent) : undefined;
      const childIndex =
        parentNode?.type === 'path' && !parentNode.props.randomized
          ? memberIndex
          : undefined;
      return {
        ...base,
        type: node.type,
        data: {
          node,
          fields:
            node.type === 'screen'
              ? screenFields(screensBySlug.get(node.props.slug))
              : [],
          outputs: nodeOutputs(node),
          components:
            node.type === 'screen'
              ? componentRows(screensBySlug.get(node.props.slug)?.components)
              : [],
          memberIndex,
          childIndex,
        } satisfies EditorNodeData,
      };
    });

  const edges = flow.edges
    .filter((e) => !isContainment(e.type))
    .map((e) => toEditorEdge(e, nodesById));

  return { nodes, edges, dataEdges: buildDataEdges(flow) };
}

// ─── Layout ──────────────────────────────────────────────────────────────────

const NODE_WIDTH = 240;
const ROW_HEIGHT = 24;
const CONTAINER_PAD = 30;
const CONTAINER_GAP = 14;
const CARD_BASE = 42;

/** Extra lines a long unbreakable-ish string may wrap to (w-60 ≈ 30 mono xxs chars). */
const wrapLines = (s: string) => Math.min(2, Math.max(0, Math.ceil((s.length - 30) / 30)));

function estimateHeight(node: EditorNode): number {
  const data = node.data as EditorNodeData;
  const n = data.node;
  let lines = 0;
  switch (n.type) {
    case 'branch':
      for (const b of n.props.branches)
        lines += 1 + wrapLines(conditionToString(b.config));
      lines += 1; // else row
      break;
    case 'fork':
      lines = n.props.forks.length;
      break;
    case 'path':
    case 'loop':
      lines = containerPropRows(n);
      break;
    case 'screen':
      lines =
        1 +
        (data.components ?? []).reduce(
          (s, r) =>
            s + 1 + r.keys.reduce((k, key) => k + wrapLines(key), 0),
          0,
        );
      break;
    case 'compute':
    case 'data':
      lines = (data.outputs ?? [])
        .slice(0, 5)
        .reduce((s, k) => s + 1 + wrapLines(k), 0);
      break;
    case 'checkpoint':
      lines = 1 + wrapLines(n.props.name);
      break;
    case 'start':
      lines = n.props ? 1 + wrapLines(`${n.props.param.key}=${n.props.param.value}`) : 1;
      break;
    default:
      lines = 1;
  }
  return CARD_BASE + lines * ROW_HEIGHT;
}

/** Prop rows a path/loop card renders (shared between layout + component). */
function containerPropRows(node: PathNode | LoopNode): number {
  let rows = 0;
  if (node.type === 'loop') {
    rows += 1; // items
    if (node.props.itemKey) rows += 1;
    if (
      node.props.type === 'dynamic' &&
      node.props.dataKey.length > 30
    )
      rows += 1; // wrapped line
  }
  if (node.props.randomized) rows += 1;
  if (node.props.stepper) rows += 1;
  return Math.max(1, rows);
}

/** Height of the card portion of a container node (children render below it). */
export function containerCardHeight(node: PathNode | LoopNode): number {
  return CARD_BASE + containerPropRows(node) * ROW_HEIGHT + 8;
}

type Size = { width: number; height: number };

function dagreLayout(
  ids: string[],
  sizes: Map<string, Size>,
  edges: { source: string; target: string }[],
  opts: { nodesep: number; ranksep: number },
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    nodesep: opts.nodesep,
    ranksep: opts.ranksep,
    edgesep: 14,
    marginx: 0,
    marginy: 0,
  });
  g.setDefaultEdgeLabel(() => ({}));
  for (const id of ids) {
    const s = sizes.get(id)!;
    g.setNode(id, { width: s.width, height: s.height });
  }
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  const positions = new Map<string, { x: number; y: number }>();
  for (const id of ids) {
    const n = g.node(id);
    const s = sizes.get(id)!;
    positions.set(id, { x: n.x - s.width / 2, y: n.y - s.height / 2 });
  }
  return positions;
}

/** Dagre left-to-right layout with container sub-layouts (path/loop frames). */
export function layoutFlow(
  nodes: EditorNode[],
  edges: EditorEdge[],
): EditorNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childToParent = new Map(
    nodes.filter((n) => n.parentId).map((n) => [n.id, n.parentId!]),
  );
  const members = new Map<string, string[]>();
  for (const [child, parent] of childToParent) {
    if (!members.has(parent)) members.set(parent, []);
    members.get(parent)!.push(child);
  }
  // Declared member order (path-contains `order`) — parentId insertion order
  // follows the node array, not the edges.
  for (const list of members.values()) {
    list.sort(
      (a, b) =>
        ((byId.get(a)!.data as EditorNodeData).memberIndex ?? 0) -
        ((byId.get(b)!.data as EditorNodeData).memberIndex ?? 0),
    );
  }

  // Leaf sizes
  const sizes = new Map<string, Size>();
  for (const n of nodes) {
    if (n.type !== 'container')
      sizes.set(n.id, { width: NODE_WIDTH, height: estimateHeight(n) });
  }

  // Inner layouts, innermost containers first (a container's size must be
  // known before its parent's layout can consume it).
  const depth = (id: string): number => {
    let n = 0;
    let p = childToParent.get(id);
    while (p) {
      n++;
      p = childToParent.get(p);
    }
    return n;
  };
  const containersByDepth = [...members.keys()].sort(
    (a, b) => depth(b) - depth(a),
  );

  const childPositions = new Map<string, { x: number; y: number }>();
  for (const containerId of containersByDepth) {
    const children = members.get(containerId)!;
    // Order children: path members keep their edge order (children were
    // appended in `order` sequence); internal flow edges feed dagre.
    const innerEdges = edges
      .filter((e) => children.includes(e.source) && children.includes(e.target))
      .map((e) => ({ source: e.source, target: e.target }));
    // Virtual chain preserves declared order when no internal edges exist.
    if (innerEdges.length === 0 && children.length > 1) {
      for (let i = 0; i < children.length - 1; i++)
        innerEdges.push({ source: children[i], target: children[i + 1] });
    }
    const positions = dagreLayout(children, sizes, innerEdges, {
      nodesep: 28,
      ranksep: 70,
    });
    const cardH = containerCardHeight(
      (byId.get(containerId)!.data as ContainerNodeData).node,
    );
    let w = 0;
    let h = 0;
    for (const child of children) {
      const p = positions.get(child)!;
      const s = sizes.get(child)!;
      childPositions.set(child, {
        x: p.x + CONTAINER_PAD,
        y: p.y + cardH + CONTAINER_GAP,
      });
      w = Math.max(w, p.x + s.width);
      h = Math.max(h, p.y + s.height);
    }
    sizes.set(containerId, {
      width: w + CONTAINER_PAD * 2,
      height: cardH + CONTAINER_GAP + h + CONTAINER_PAD,
    });
  }

  // Outer layout: top-level nodes only; boundary-crossing edges are remapped
  // to the outermost ancestor so the container ranks correctly.
  const topAncestor = (id: string): string => {
    let cur = id;
    while (childToParent.has(cur)) cur = childToParent.get(cur)!;
    return cur;
  };
  const topIds = nodes.filter((n) => !n.parentId).map((n) => n.id);
  const outerEdges = edges.map((e) => ({
    source: topAncestor(e.source),
    target: topAncestor(e.target),
  }));
  const positions = dagreLayout(topIds, sizes, outerEdges, {
    nodesep: 40,
    ranksep: 120,
  });

  return nodes.map((node) => {
    if (node.parentId) {
      return { ...node, position: childPositions.get(node.id)! };
    }
    const size = sizes.get(node.id)!;
    return {
      ...node,
      position: positions.get(node.id)!,
      style:
        node.type === 'container'
          ? { width: size.width, height: size.height }
          : undefined,
    };
  });
}
