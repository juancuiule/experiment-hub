import { FrameworkEdge } from '@/lib/edges';
import { FrameworkNode } from '@/lib/nodes';

/**
 * Pure, framework-agnostic auto-layout for an experiment flow graph.
 *
 * It assigns every node a (layer, column) by longest-path layering over the
 * combined edge set, then converts that to pixel coordinates. Edge endpoints
 * referencing a sub-id (e.g. "branch1.branchA") are collapsed to their base
 * node for positioning, while the sub-id is preserved on the positioned edge
 * so the canvas can label the connector.
 *
 * No React, no DOM — this mirrors the `lib/` engine's isolation so the layout
 * can be unit-tested without a renderer.
 */

export const NODE_W = 184;
export const NODE_H = 64;
export const GAP_X = 40;
export const GAP_Y = 76;
export const PAD = 32;

export interface PositionedNode {
  node: FrameworkNode;
  layer: number;
  col: number;
  x: number;
  y: number;
}

export interface PositionedEdge {
  edge: FrameworkEdge;
  fromId: string;
  toId: string;
  /** sub-id after the dot in a branch/fork `from`, if any */
  subId?: string;
}

export interface FlowLayout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

/** "branch1.branchA" -> "branch1" */
export function baseId(ref: string): string {
  const dot = ref.indexOf('.');
  return dot === -1 ? ref : ref.slice(0, dot);
}

function subId(ref: string): string | undefined {
  const dot = ref.indexOf('.');
  return dot === -1 ? undefined : ref.slice(dot + 1);
}

export function computeLayout(
  nodes: FrameworkNode[],
  edges: FrameworkEdge[],
): FlowLayout {
  const ids = new Set(nodes.map((n) => n.id));
  const indexOf = new Map(nodes.map((n, i) => [n.id, i] as const));

  // Adjacency on base node ids (deduped), used for layering.
  const children = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  nodes.forEach((n) => {
    children.set(n.id, new Set());
    indegree.set(n.id, 0);
  });

  for (const edge of edges) {
    const from = baseId(edge.from);
    const to = baseId(edge.to);
    if (!ids.has(from) || !ids.has(to) || from === to) continue;
    const set = children.get(from)!;
    if (!set.has(to)) {
      set.add(to);
      indegree.set(to, (indegree.get(to) ?? 0) + 1);
    }
  }

  // Longest-path layering with a recursion guard against cycles (loops).
  const layerOf = new Map<string, number>();
  const visiting = new Set<string>();
  const resolveLayer = (id: string): number => {
    if (layerOf.has(id)) return layerOf.get(id)!;
    if (visiting.has(id)) return 0; // break cycle
    visiting.add(id);
    let layer = 0;
    for (const node of nodes) {
      if (children.get(node.id)!.has(id)) {
        layer = Math.max(layer, resolveLayer(node.id) + 1);
      }
    }
    visiting.delete(id);
    layerOf.set(id, layer);
    return layer;
  };
  nodes.forEach((n) => resolveLayer(n.id));

  // Group by layer, order columns by original declaration order for stability.
  const byLayer = new Map<number, FrameworkNode[]>();
  for (const n of nodes) {
    const l = layerOf.get(n.id)!;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(n);
  }

  const positioned: PositionedNode[] = [];
  let maxCols = 0;
  for (const [layer, layerNodes] of byLayer) {
    layerNodes.sort((a, b) => indexOf.get(a.id)! - indexOf.get(b.id)!);
    maxCols = Math.max(maxCols, layerNodes.length);
    layerNodes.forEach((node, col) => {
      positioned.push({
        node,
        layer,
        col,
        x: PAD + col * (NODE_W + GAP_X),
        y: PAD + layer * (NODE_H + GAP_Y),
      });
    });
  }

  const maxLayer = Math.max(0, ...positioned.map((p) => p.layer));
  const width = PAD * 2 + Math.max(1, maxCols) * (NODE_W + GAP_X) - GAP_X;
  const height = PAD * 2 + (maxLayer + 1) * (NODE_H + GAP_Y) - GAP_Y;

  const positionedEdges: PositionedEdge[] = edges
    .map((edge) => ({
      edge,
      fromId: baseId(edge.from),
      toId: baseId(edge.to),
      subId: subId(edge.from),
    }))
    .filter((e) => ids.has(e.fromId) && ids.has(e.toId));

  return { nodes: positioned, edges: positionedEdges, width, height };
}
