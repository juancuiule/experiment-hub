import { FrameworkNode } from './nodes';
import { ExperimentFlow } from './types';
/*
Experiment validation:
- Flow => Nodes / Edges
- Screens => Components
- Options 
*/

/*
Nodes:
- At least one start node
- No duplicate ids
*/

function validate(flow: ExperimentFlow) {
  const errors: string[] = [];

  // 1. Check for at least one start node
  const startNodes = flow.nodes.filter((node) => node.type === 'start');
  if (startNodes.length === 0) {
    errors.push('Flow must have at least one start node.');
  }

  // 2. Check for duplicate node ids
  const ids = new Map<string, FrameworkNode[]>();
  const duplicateIds = new Set<string>();

  flow.nodes.forEach((node) => {
    const existing = ids.get(node.id);
    if (existing) {
      duplicateIds.add(node.id);
      existing.push(node);
    } else {
      ids.set(node.id, [node]);
    }
  });

  duplicateIds.forEach((id) => {
    const nodes = ids.get(id);
    if (nodes) {
      errors.push(
        `Duplicate node id "${id}" found in nodes: ${nodes.map((n) => n.type).join(', ')}.`,
      );
    }
  });

  // 3. Check edge endpoints
  flow.edges.forEach((edge) => {
    const from = edge.from.split('.')[0];
    if (!ids.has(from)) {
      errors.push(`Edge "from" references non-existent node id "${from}".`);
    }

    const to = edge.to.split('.')[0];
    if (!ids.has(to)) {
      errors.push(`Edge "to" references non-existent node id "${to}".`);
    }
  });

  return errors;
}
