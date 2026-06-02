import { ExperimentFlow } from '../types';
import { ValidationError } from './types';

export function checkUnreachableNodes(
  experiment: ExperimentFlow,
): ValidationError[] {
  const { nodes, edges } = experiment;
  const errors: ValidationError[] = [];

  const reachable = new Set<string>();

  function walk(nodeId: string): void {
    if (reachable.has(nodeId)) return;
    reachable.add(nodeId);
    for (const edge of edges) {
      if (edge.from.split('.')[0] === nodeId) walk(edge.to);
    }
  }

  for (const node of nodes.filter((n) => n.type === 'start')) {
    walk(node.id);
  }

  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      errors.push({
        code: 'unreachable-node',
        category: 'node',
        nodeType: node.type,
        message: `Node "${node.id}" is not reachable from any start node`,
      });
    }
  }

  return errors;
}
