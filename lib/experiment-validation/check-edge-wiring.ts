import {
  FrameworkEdge,
  isBranchConditionEdge,
  isBranchDefaultEdge,
  isForkEdge,
  isLoopEdge,
  isPathEdge,
  isSequentialEdge,
} from '../edges';
import { FrameworkNode } from '../nodes';
import { ExperimentFlow } from '../types';
import { isFrom } from './edge-helpers';
import { ValidationError } from './types';

function isNested(node: FrameworkNode, edges: FrameworkEdge[]): boolean {
  // A node is considered to be inside a path or loop (nested)
  // if there is a path-contains or loop-template from any ancestor
  // path or loop to it, even if the node is not a direct child of the
  // template (i.e. nested multiple levels deep inside the template)

  // These are edges that define nested-like relations without being
  // paths or loops themselves; we need to follow these edges transitively
  // to find all nested nodes.
  const routingEdges = edges.filter(
    (e) =>
      e.type === 'branch-condition' ||
      e.type === 'branch-default' ||
      e.type === 'fork-edge',
  );

  // Start from direct children of paths and loops (targets of path-contains
  // and loop-template edges)
  const seed = new Set(
    edges.filter((e) => isPathEdge(e) || isLoopEdge(e)).map(({ to }) => to),
  );

  // Expand by one step: add targets of routing edges whose source is already
  // nested. Recurse until fixpoint (set stops growing).
  // Sequential edges are skipped (they can exit the container).
  // path-contains / loop-template are skipped (they open a new container).
  function expand(current: Set<string>): Set<string> {
    const next = new Set([
      ...current,
      ...routingEdges
        .filter((e) => current.has(e.from.split('.')[0]))
        .map((e) => e.to),
    ]);
    return next.size === current.size ? current : expand(next);
  }

  return expand(seed).has(node.id);
}

const WITHOUT_SEQUENTIAL: FrameworkNode['type'][] = ['branch', 'fork', 'end'];
const WITH_OPTIONAL_SEQUENTIAL: FrameworkNode['type'][] = [
  'checkpoint',
  'screen',
  'compute',
  'path',
  'loop',
];

const REQUIRED_SOURCE_TYPE: Partial<
  Record<FrameworkEdge['type'], FrameworkNode['type']>
> = {
  'branch-condition': 'branch',
  'branch-default': 'branch',
  'path-contains': 'path',
  'loop-template': 'loop',
  'fork-edge': 'fork',
};

export function checkEdgeWiring(flow: ExperimentFlow): ValidationError[] {
  const errors: ValidationError[] = [];

  const { nodes, edges } = flow;

  const nodesMap = new Map(nodes.map((n) => [n.id, n]));

  // 1. Check sequential edges from each node:
  nodes.forEach((node) => {
    const outgoingSequential = edges
      .filter(isSequentialEdge)
      .filter(isFrom(node));

    const requiresSequential =
      node.type === 'start' ||
      (WITH_OPTIONAL_SEQUENTIAL.includes(node.type) && !isNested(node, edges));

    if (requiresSequential && outgoingSequential.length === 0) {
      errors.push({
        code: 'missing-edge',
        category: 'edge',
        nodeType: node.type,
        message: `${node.type} node "${node.id}" has no sequential outgoing edge`,
      });
    }

    if (
      WITHOUT_SEQUENTIAL.includes(node.type) &&
      outgoingSequential.length > 0
    ) {
      errors.push({
        code: 'invalid-edge',
        category: 'edge',
        nodeType: node.type,
        message: `${node.type} node "${node.id}" has ${outgoingSequential.length} sequential outgoing edge(s), but nodes of type "${node.type}" cannot have sequential edges`,
      });
    }

    if (
      !WITHOUT_SEQUENTIAL.includes(node.type) &&
      outgoingSequential.length > 1
    ) {
      errors.push({
        code: 'ambiguous-edge',
        category: 'edge',
        nodeType: node.type,
        message: `${node.type} node "${node.id}" has ${outgoingSequential.length} sequential outgoing edges; at most one is allowed`,
      });
    }
  });

  // 2. Check path-contains, loop-template, branch-condition/default, and fork edges from each node:
  nodes.forEach((node) => {
    switch (node.type) {
      case 'path': {
        const contains = edges.filter(isFrom(node)).filter(isPathEdge);
        if (contains.length === 0) {
          errors.push({
            code: 'missing-edge',
            category: 'edge',
            nodeType: 'path',
            message: `Path node "${node.id}" has no path-contains outgoing edges`,
          });
        }
        break;
      }

      case 'loop': {
        const templates = edges.filter(isFrom(node)).filter(isLoopEdge);
        if (templates.length !== 1) {
          const missing = templates.length == 0;
          errors.push({
            code: missing ? 'missing-edge' : 'duplicate-edge',
            category: 'edge',
            nodeType: 'loop',
            message: `Loop node "${node.id}" has ${missing ? 'no' : 'more than one'} loop-template outgoing edge`,
          });
        }
        break;
      }

      case 'fork': {
        const forkEdges = edges.filter(isFrom(node)).filter(isForkEdge);
        if (forkEdges.length < 2) {
          errors.push({
            code: 'missing-edge',
            category: 'edge',
            nodeType: 'fork',
            message: `Fork node "${node.id}" has ${forkEdges.length} fork-edge outgoing edges; at least two are required`,
          });
        }

        const forksIds = node.props.forks.map((f) => f.id);

        forkEdges.forEach((edge) => {
          const forkId = edge.from.split('.')[1];
          if (!forksIds.includes(forkId)) {
            errors.push({
              code: 'invalid-edge',
              category: 'edge',
              nodeType: 'fork',
              message: `Fork-edge "${edge.from}" references fork id "${forkId}" which does not exist in fork node "${node.id}"`,
            });
          }
        });

        forksIds.forEach((forkId) => {
          const hasForkEdge = forkEdges.some(
            (e) => e.from === `${node.id}.${forkId}`,
          );
          if (!hasForkEdge) {
            errors.push({
              code: 'unrouted-fork',
              category: 'fork',
              nodeType: 'fork',
              message: `Fork "${node.id}" has fork "${forkId}" with no corresponding fork-edge`,
            });
          }
        });
        break;
      }

      case 'branch': {
        const defaultEdges = edges
          .filter(isBranchDefaultEdge)
          .filter(isFrom(node));

        const conditionEdges = edges
          .filter(isBranchConditionEdge)
          .filter(isFrom(node));

        if (defaultEdges.length !== 1) {
          const missing = defaultEdges.length == 0;
          errors.push({
            code: missing ? 'missing-edge' : 'ambiguous-edge',
            category: 'edge',
            nodeType: 'branch',
            message: `Branch node "${node.id}" has ${missing ? 'no' : 'more than one'} branch-default outgoing edge`,
          });
        }

        if (conditionEdges.length === 0) {
          errors.push({
            code: 'missing-edge',
            category: 'edge',
            nodeType: 'branch',
            message: `Branch node "${node.id}" has no branch-condition outgoing edges`,
          });
        }

        const branchesIds = node.props.branches.map((b) => b.id);

        conditionEdges.forEach((edge) => {
          const branchId = edge.from.split('.')[1];
          if (!branchesIds.includes(branchId)) {
            errors.push({
              code: 'invalid-edge',
              category: 'edge',
              nodeType: 'branch',
              message: `Branch-condition edge "${edge.from}" references branch id "${branchId}" which does not exist in branch node "${node.id}"`,
            });
          }
        });

        branchesIds.forEach((branchId) => {
          const hasConditionEdge = conditionEdges.some(
            (e) => e.from === `${node.id}.${branchId}`,
          );
          if (!hasConditionEdge) {
            errors.push({
              code: 'unrouted-branch',
              category: 'branch',
              nodeType: 'branch',
              message: `Branch "${node.id}" has branch "${branchId}" with no corresponding branch-condition edge`,
            });
          }
        });

        break;
      }
    }
  });

  edges.forEach((edge) => {
    const [nodeId] = edge.from.split('.');
    const node = nodesMap.get(nodeId);
    const requiredType = REQUIRED_SOURCE_TYPE[edge.type];
    if (node && requiredType && node.type !== requiredType) {
      errors.push({
        code: 'invalid-edge',
        category: 'edge',
        nodeType: node.type,
        message: `Edge of type "${edge.type}" has source "${edge.from}" which is a node of type "${node.type}", but it must source from a node of type "${requiredType}"`,
      });
    }
  });

  return errors;
}
