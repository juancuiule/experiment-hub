import { ExperimentFlow } from '../types';
import { ValidationError } from './types';

export function checkEdgeEndpoints(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];

  const nodeIds = new Set(flow.nodes.map((n) => n.id));

  flow.edges.forEach((edge) => {
    const [fromNodeId] = edge.from.split('.');

    if (
      edge.from.split('.').length > 1 &&
      edge.type !== 'fork-edge' &&
      edge.type !== 'branch-condition'
    ) {
      errors.push({
        code: 'invalid-edge',
        category: 'edge',
        message: `${edge.type} edge has invalid "from" reference "${edge.from}" with too many dot segments; only fork-edge and branch-condition edges can reference sub-elements of a node. ${JSON.stringify(edge)}`,
      });
    }

    if (!nodeIds.has(fromNodeId)) {
      errors.push({
        code: 'unknown-node',
        category: 'edge',
        message: `Edge references unknown source node "${fromNodeId}". ${JSON.stringify(edge)}`,
      });
    }
    if (!nodeIds.has(edge.to)) {
      errors.push({
        code: 'unknown-node',
        category: 'edge',
        message: `Edge references unknown target node "${edge.to}". ${JSON.stringify(edge)}`,
      });
    }
    if (edge.to.includes('.')) {
      errors.push({
        code: 'invalid-edge',
        category: 'edge',
        message: `Edge has invalid target "${edge.to}" with dot notation; edge targets must reference node ids only. ${JSON.stringify(edge)}`,
      });
    }
  });

  return errors;
}
