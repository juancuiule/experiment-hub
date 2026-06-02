import { Condition } from '../conditions';
import { BranchNode, FrameworkNode } from '../nodes';
import { getValue } from '../resolve';
import { Context, ExperimentFlow } from '../types';
import { getNode, getNextSequentialNode, getWinnerNode } from './graph';

// Returns false when any data key referenced by a condition is absent from context,
// meaning evaluateCondition would silently fall to branch-default for the wrong reason.
// Used to decide whether a branch contribution can be pre-computed at path init time.
export function isConditionDataAvailable(
  condition: Condition,
  context: Context,
): boolean {
  switch (condition.type) {
    case 'simple': {
      try {
        return getValue(condition.dataKey, context) !== undefined;
      } catch {
        return false;
      }
    }
    case 'and':
    case 'or': {
      return condition.conditions.every((c) =>
        isConditionDataAvailable(c, context),
      );
    }
    case 'not': {
      return isConditionDataAvailable(condition.condition, context);
    }
  }

  return false;
}

// Counts screens reachable from startNodeId by following sequential edges,
// stopping when a path child is hit or there is no further sequential edge.
// Used to count all extra screens a branch arm adds, not just the first one.
export function countChainFromNode(
  experiment: ExperimentFlow,
  startNodeId: string,
  pathChildren: FrameworkNode[],
): number {
  const node = getNode(experiment, startNodeId);
  if (!node || pathChildren.some((c) => c.id === startNodeId)) return 0;
  const next = getNextSequentialNode(experiment, startNodeId);
  return (
    (node.type === 'screen' ? 1 : 0) +
    (next ? countChainFromNode(experiment, next.id, pathChildren) : 0)
  );
}

// Pre-computes visible screen count and per-branch contributions at path entry.
// - screen children count directly
// - branch children: if all condition data is available, evaluate and count the
//   chain from the winner; if data is missing, contribute 0 and correct at traversal
// - checkpoint children: their sequential target contributes 1 if not a path child
// - loops/forks: counted via their own steppers, skipped here
export function computePathVisibility(
  experiment: ExperimentFlow,
  context: Context,
  children: FrameworkNode[],
): { total: number; branchContributions: Record<string, number> } {
  return children.reduce(
    (acc, child) => {
      if (child.type === 'screen') {
        return { ...acc, total: acc.total + 1 };
      }
      if (child.type === 'branch') {
        const branchNode = child as BranchNode;
        const allAvailable = branchNode.props.branches.every((b) =>
          isConditionDataAvailable(b.config, context),
        );
        const { nNode } = allAvailable
          ? getWinnerNode(experiment, branchNode, context)
          : { nNode: null };
        const contribution =
          nNode && !children.some((c) => c.id === nNode.id)
            ? countChainFromNode(experiment, nNode.id, children)
            : 0;
        return {
          total: acc.total + contribution,
          branchContributions: {
            ...acc.branchContributions,
            [branchNode.id]: contribution,
          },
        };
      }
      if (child.type === 'checkpoint') {
        const nNode = getNextSequentialNode(experiment, child.id);
        return nNode?.type === 'screen' &&
          !children.some((c) => c.id === nNode.id)
          ? { ...acc, total: acc.total + 1 }
          : acc;
      }
      return acc;
    },
    { total: 0, branchContributions: {} as Record<string, number> },
  );
}
