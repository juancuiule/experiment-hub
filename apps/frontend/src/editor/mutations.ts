import type { FrameworkEdge } from '@experiment-hub/engine/edges';
import type { FrameworkNode, NodeType } from '@experiment-hub/engine/nodes';
import type { ExperimentFlow } from '@experiment-hub/engine/types';
import { HANDLE_NEXT, branchHandle, forkHandle } from './adapter';

export type ConnectSpec = {
  source: string;
  sourceHandle: string;
  target: string;
};

// ─── Connection rules ────────────────────────────────────────────────────────

const SEQUENTIAL_SOURCES: NodeType[] = [
  'start',
  'screen',
  'checkpoint',
  'compute',
  'data',
  'path',
  'loop',
];

/** Which FrameworkEdge a (source node, handle) pair would produce. */
export function edgeTypeFor(
  node: FrameworkNode,
  sourceHandle: string,
): FrameworkEdge['type'] | null {
  if (sourceHandle === HANDLE_NEXT)
    return SEQUENTIAL_SOURCES.includes(node.type) ? 'sequential' : null;
  if (node.type === 'branch') {
    if (sourceHandle === 'default') return 'branch-default';
    if (
      sourceHandle.startsWith('branch.') &&
      node.props.branches.some((b) => sourceHandle === branchHandle(b.id))
    )
      return 'branch-condition';
  }
  if (node.type === 'fork') {
    if (
      sourceHandle.startsWith('fork.') &&
      node.props.forks.some((f) => sourceHandle === forkHandle(f.id))
    )
      return 'fork-edge';
  }
  return null;
}

const hasPath = (
  edges: FrameworkEdge[],
  from: string,
  to: string,
): boolean => {
  // DFS over non-containment edges (containment is membership, not traversal —
  // a child can never reach its parent's upstream anyway).
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const src = e.from.split('.')[0];
    if (!adj.has(src)) adj.set(src, []);
    adj.get(src)!.push(e.to);
  }
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(adj.get(cur) ?? []));
  }
  return false;
};

/** Would connecting source→target be legal? Arity, arm validity, no cycles. */
export function canConnect(
  flow: ExperimentFlow,
  spec: ConnectSpec,
): boolean {
  if (spec.source === spec.target) return false;
  const source = flow.nodes.find((n) => n.id === spec.source);
  const target = flow.nodes.find((n) => n.id === spec.target);
  if (!source || !target) return false;

  const type = edgeTypeFor(source, spec.sourceHandle);
  if (!type) return false;

  // Max-1 outputs: sequential / branch-default / loop-template
  if (
    type === 'sequential' ||
    type === 'branch-default'
  ) {
    if (
      flow.edges.some((e) => e.type === type && e.from.split('.')[0] === spec.source)
    )
      return false;
  }

  // No cycles — a new edge must not let target reach source.
  return !hasPath(
    [...flow.edges, buildEdge(type, spec)],
    spec.target,
    spec.source,
  );
}

function buildEdge(
  type: FrameworkEdge['type'],
  spec: ConnectSpec,
): FrameworkEdge {
  if (type === 'branch-condition' || type === 'fork-edge') {
    return {
      type,
      from: `${spec.source}.${spec.sourceHandle.split('.')[1]}` as `${string}.${string}`,
      to: spec.target,
    };
  }
  return { type, from: spec.source, to: spec.target } as FrameworkEdge;
}

/** Re-point an existing edge: drop the old one first so max-1 outputs free up. */
export function reconnect(
  flow: ExperimentFlow,
  oldEdgeId: string,
  spec: ConnectSpec,
): ExperimentFlow {
  const without = deleteEdgeIds(flow, [oldEdgeId]);
  if (!canConnect(without, spec)) return flow;
  return connect(without, spec);
}

/** Build the framework edge a connection implies (null if illegal). */
export function connect(
  flow: ExperimentFlow,
  spec: ConnectSpec,
): ExperimentFlow {
  if (!canConnect(flow, spec)) return flow;
  const source = flow.nodes.find((n) => n.id === spec.source)!;
  const type = edgeTypeFor(source, spec.sourceHandle)!;
  return { ...flow, edges: [...flow.edges, buildEdge(type, spec)] };
}

// ─── Deletion ────────────────────────────────────────────────────────────────

export function deleteNodes(
  flow: ExperimentFlow,
  ids: string[],
): ExperimentFlow {
  const gone = new Set(ids);
  return {
    ...flow,
    nodes: flow.nodes.filter((n) => !gone.has(n.id)),
    edges: flow.edges.filter(
      (e) => !gone.has(e.from.split('.')[0]) && !gone.has(e.to),
    ),
  };
}

/** Delete by editor edge id ("type:from->to"). */
export function deleteEdgeIds(
  flow: ExperimentFlow,
  ids: string[],
): ExperimentFlow {
  const gone = new Set(ids);
  return {
    ...flow,
    edges: flow.edges.filter(
      (e) => !gone.has(`${e.type}:${e.from}->${e.to}`),
    ),
  };
}

// ─── Node creation ───────────────────────────────────────────────────────────

const uid = (flow: ExperimentFlow, base: string): string => {
  let i = 1;
  while (flow.nodes.some((n) => n.id === `${base}-${i}`)) i++;
  return `${base}-${i}`;
};

export function addNode(
  flow: ExperimentFlow,
  type: NodeType,
): { flow: ExperimentFlow; id: string } {
  const id = uid(flow, type);
  const node = ((): FrameworkNode => {
    switch (type) {
      case 'screen':
        return {
          id,
          type,
          props: { slug: flow.screens?.[0]?.slug ?? 'new-screen' },
        };
      case 'branch':
        return {
          id,
          type,
          props: {
            name: 'Branch',
            branches: [
              {
                id: 'a',
                name: 'A',
                config: {
                  type: 'simple' as const,
                  dataKey: '$$data',
                  operator: 'eq' as const,
                  value: '',
                },
              },
            ],
          },
        };
      case 'fork':
        return {
          id,
          type,
          props: {
            name: 'Fork',
            forks: [
              { id: 'a', name: 'A' },
              { id: 'b', name: 'B' },
            ],
          },
        };
      case 'path':
        return { id, type, props: { name: 'Path' } };
      case 'loop':
        return {
          id,
          type,
          props: {
            type: 'static',
            values: [] as (string | Record<string, unknown>)[],
          },
        };
      case 'compute':
        return { id, type, props: { name: 'Compute', computations: [] } };
      case 'data':
        return { id, type, props: { name: 'Data', data: {} } };
      case 'checkpoint':
        return { id, type, props: { name: 'checkpoint' } };
      case 'start':
        return {
          id,
          type,
          props: { name: 'Start', param: { key: 'condition', value: 'a' } },
        };
      case 'end':
        return { id, type };
    }
  })();
  return { flow: { ...flow, nodes: [...flow.nodes, node] }, id };
}

// ─── Prop edits ──────────────────────────────────────────────────────────────

export function setNodeName(
  flow: ExperimentFlow,
  id: string,
  name: string,
): ExperimentFlow {
  return {
    ...flow,
    nodes: flow.nodes.map((n) =>
      n.id === id && 'props' in n
        ? ({ ...n, props: { ...n.props, name } } as FrameworkNode)
        : n,
    ),
  };
}

export function setScreenSlug(
  flow: ExperimentFlow,
  id: string,
  slug: string,
): ExperimentFlow {
  return {
    ...flow,
    nodes: flow.nodes.map((n) =>
      n.id === id && n.type === 'screen'
        ? { ...n, props: { ...n.props, slug } }
        : n,
    ),
  };
}

// ─── Branch/fork arms ────────────────────────────────────────────────────────

export function addArm(flow: ExperimentFlow, nodeId: string): ExperimentFlow {
  return {
    ...flow,
    nodes: flow.nodes.map((n) => {
      if (n.id !== nodeId) return n;
      if (n.type === 'branch') {
        const next = String.fromCharCode(97 + n.props.branches.length); // a,b,c…
        return {
          ...n,
          props: {
            ...n.props,
            branches: [
              ...n.props.branches,
              {
                id: next,
                name: next.toUpperCase(),
                config: {
                  type: 'simple' as const,
                  dataKey: '$$data',
                  operator: 'eq' as const,
                  value: '',
                },
              },
            ],
          },
        };
      }
      if (n.type === 'fork') {
        const next = String.fromCharCode(97 + n.props.forks.length);
        return {
          ...n,
          props: {
            ...n.props,
            forks: [...n.props.forks, { id: next, name: next.toUpperCase() }],
          },
        };
      }
      return n;
    }),
  };
}

export function removeArm(
  flow: ExperimentFlow,
  nodeId: string,
  armId: string,
): ExperimentFlow {
  const from = `${nodeId}.${armId}`;
  return {
    ...flow,
    nodes: flow.nodes.map((n) => {
      if (n.id !== nodeId) return n;
      if (n.type === 'branch' && n.props.branches.length > 1)
        return {
          ...n,
          props: {
            ...n.props,
            branches: n.props.branches.filter((b) => b.id !== armId),
          },
        };
      if (n.type === 'fork' && n.props.forks.length > 2)
        return {
          ...n,
          props: {
            ...n.props,
            forks: n.props.forks.filter((f) => f.id !== armId),
          },
        };
      return n;
    }),
    // Drop edges that referenced the removed arm.
    edges: flow.edges.filter((e) => e.from !== from),
  };
}
