import { ExperimentFlow } from '../types';
import { ValidationError } from './types';

export function checkCycles(experiment: ExperimentFlow): ValidationError[] {
  const { nodes, edges } = experiment;
  const errors: ValidationError[] = [];

  const nodeIds = new Set(nodes.map((n) => n.id));

  const neighbors = new Map<string, string[]>();
  for (const node of nodes) neighbors.set(node.id, []);
  for (const edge of edges) {
    const fromId = edge.from.split('.')[0];
    if (nodeIds.has(fromId) && nodeIds.has(edge.to)) {
      neighbors.get(fromId)!.push(edge.to);
    }
  }

  // 3-color DFS: white=unvisited, gray=on current path, black=done
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, 0 | 1 | 2>();
  for (const node of nodes) color.set(node.id, WHITE);

  const reported = new Set<string>();

  function dfs(nodeId: string): void {
    const c = color.get(nodeId);
    if (c === BLACK) return;
    if (c === GRAY) {
      if (!reported.has(nodeId)) {
        reported.add(nodeId);
        errors.push({
          code: 'cyclic-flow',
          category: 'node',
          message: `Node "${nodeId}" is part of a cycle in the flow graph`,
        });
      }
      return;
    }

    color.set(nodeId, GRAY);
    for (const neighbor of neighbors.get(nodeId) ?? []) {
      dfs(neighbor);
    }
    color.set(nodeId, BLACK);
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) dfs(node.id);
  }

  return errors;
}
