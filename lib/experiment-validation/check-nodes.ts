import { BranchNode, ComputeNode, ForkNode, FrameworkNode } from '../nodes';
import { ExperimentFlow } from '../types';
import { ValidationError } from './types';
import { validateConditionStructure } from './validate-condition-structure';

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

// Structural validation of compute nodes that is independent of the data flow:
// duplicate output keys within a node, duplicate lookup-table keys, and invalid
// sample sizes. Reference availability inside formulas is handled separately by
// check-references, which needs the walk to know what data is in scope.
function checkComputeNodes(nodes: FrameworkNode[]): ValidationError[] {
  const errors: ValidationError[] = [];

  nodes
    .filter((n): n is ComputeNode => n.type === 'compute')
    .forEach((node) => {
      const seenOutputKeys = new Set<string>();
      for (const { outputKey, formula } of node.props.computations) {
        if (seenOutputKeys.has(outputKey)) {
          errors.push({
            code: 'duplicate-output-key',
            category: 'node',
            nodeType: 'compute',
            message: `Compute "${node.id}" has duplicate outputKey "${outputKey}"`,
          });
        }
        seenOutputKeys.add(outputKey);

        if (formula.type === 'lookup') {
          const seenWhen = new Set<number>();
          for (const entry of formula.table) {
            const key = Number(entry.when);
            if (seenWhen.has(key)) {
              errors.push({
                code: 'duplicate-lookup-key',
                category: 'node',
                nodeType: 'compute',
                message: `Compute "${node.id}" output "${outputKey}" has duplicate lookup key "${entry.when}"`,
              });
            }
            seenWhen.add(key);
          }
        }

        if (
          formula.type === 'sample' &&
          (!Number.isInteger(formula.n) || formula.n <= 0)
        ) {
          errors.push({
            code: 'invalid-sample-size',
            category: 'node',
            nodeType: 'compute',
            message: `Compute "${node.id}" output "${outputKey}" has sample size n="${formula.n}", but n must be a positive integer`,
          });
        }
      }
    });

  return errors;
}

const REQUIRE_AT_LEAST_ONE: FrameworkNode['type'][] = ['start', 'end'];

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

  REQUIRE_AT_LEAST_ONE.forEach((type) => {
    if (!nodes.some((node) => node.type === type)) {
      errors.push({
        code: `missing-${type}`,
        category: 'node',
        message: `Flow has no ${type} node`,
        nodeType: type,
      });
    }
  });

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

  errors.push(...branchErrors, ...forkErrors, ...checkComputeNodes(nodes));

  return errors;
}
