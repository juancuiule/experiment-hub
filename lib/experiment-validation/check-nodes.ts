import { Condition } from '../conditions';
import { BranchNode, ForkNode, FrameworkNode } from '../nodes';
import { ExperimentFlow } from '../types';
import { ErrorCategory, ValidationError } from './types';

function validateConditionStructure(
  condition: Condition,
  category: ErrorCategory,
): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (condition.type) {
    case 'and':
    case 'or': {
      if (condition.conditions.length === 0) {
        errors.push({
          code: 'condition-empty',
          category,
          message: `A "${condition.type}" condition has no children, but at least one condition is required`,
        });
      }

      errors.push(
        ...condition.conditions.flatMap((child) =>
          validateConditionStructure(child, category),
        ),
      );
      break;
    }
    case 'not': {
      errors.push(...validateConditionStructure(condition.condition, category));
    }
  }

  return errors;
}

function validateChildContainer<N extends BranchNode | ForkNode>(
  nodes: FrameworkNode[],
  nodeType: N['type'],
  getChildren: (node: N) => Array<{ id: string }>,
  childLabel: 'branch' | 'fork',
  childCollectionKey: 'branches' | 'forks',
) {
  const errors: ValidationError[] = [];
  nodes
    .filter((n): n is N => n.type === nodeType)
    .forEach((node) => {
      const children = getChildren(node);

      if (children.length === 0) {
        errors.push({
          code: `empty-${childLabel}`,
          category: childLabel,
          nodeType,
          message: `${nodeType} node "${node.id}" has no ${childCollectionKey} defined`,
        });
      }

      const seenIds = new Set<string>();
      children.forEach((child) => {
        if (seenIds.has(child.id)) {
          errors.push({
            code: `duplicate-${childLabel}-id`,
            category: childLabel,
            nodeType,
            message: `${nodeType} node "${node.id}" has duplicate ${childLabel} id "${child.id}" in ${childCollectionKey}: ${JSON.stringify(children)}`,
          });
        }
        seenIds.add(child.id);
      });
    });
  return errors;
}

export function checkNodes({ nodes }: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];

  const nodesById = new Map<string, FrameworkNode[]>();
  nodes.forEach((node) => {
    const existing = nodesById.get(node.id) ?? [];
    nodesById.set(node.id, [...existing, node]);
  });
  nodesById.forEach((group, id) => {
    if (group.length > 1) {
      errors.push({
        code: 'duplicate-node-id',
        category: 'node',
        message: `Duplicate node id "${id}" found in nodes: ${group.map((n) => JSON.stringify(n)).join(', ')}`,
      });
    }
  });

  if (!nodes.some((node) => node.type === 'start')) {
    errors.push({
      code: 'missing-start',
      category: 'node',
      message: 'Flow has no start node',
      nodeType: 'start',
    });
  }

  if (!nodes.some((node) => node.type === 'end')) {
    errors.push({
      code: 'missing-end',
      category: 'node',
      message: 'Flow has no end node',
      nodeType: 'end',
    });
  }

  const branchErrors = validateChildContainer<BranchNode>(
    nodes,
    'branch',
    (n) => n.props.branches,
    'branch',
    'branches',
  );

  nodes
    .filter((n): n is BranchNode => n.type === 'branch')
    .forEach((branchNode) => {
      branchNode.props.branches.forEach((branch) => {
        errors.push(...validateConditionStructure(branch.config, 'branch'));
      });
    });

  const forkErrors = validateChildContainer<ForkNode>(
    nodes,
    'fork',
    (n) => n.props.forks,
    'fork',
    'forks',
  );

  errors.push(...branchErrors, ...forkErrors);

  return errors;
}
