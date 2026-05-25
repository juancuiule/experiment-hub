import { evaluateCondition } from '../conditions';
import { BranchNode, Fork, ForkNode, FrameworkNode } from '../nodes';
import { Context, ExperimentFlow } from '../types';
import { isDefined } from '../utils';

type ExperimentIndex = {
  nodes: Map<string, FrameworkNode>;
  startNode: FrameworkNode | undefined;
  sequential: Map<string, string>;
  loopTemplate: Map<string, string>;
  branchCondition: Map<string, string>;
  branchDefault: Map<string, string>;
  fork: Map<string, string>;
  // Pre-sorted by PathContainmentEdge.order
  pathChildren: Map<string, string[]>;
};

function setFirstEdge(
  edgeMap: Map<string, string>,
  fromId: string,
  toId: string,
) {
  if (!edgeMap.has(fromId)) {
    edgeMap.set(fromId, toId);
  }
}

function buildExperimentIndex(experiment: ExperimentFlow): ExperimentIndex {
  const nodes = new Map<string, FrameworkNode>();
  for (const node of experiment.nodes) {
    nodes.set(node.id, node);
  }

  const startNode = experiment.nodes.find((n) => n.type === 'start');

  const sequential = new Map<string, string>();
  const loopTemplate = new Map<string, string>();
  const branchCondition = new Map<string, string>();
  const branchDefault = new Map<string, string>();
  const fork = new Map<string, string>();
  const pathChildrenRaw = new Map<string, Array<{ order: number; to: string }>>();

  for (const edge of experiment.edges) {
    switch (edge.type) {
      case 'sequential':
        setFirstEdge(sequential, edge.from, edge.to);
        break;
      case 'loop-template':
        setFirstEdge(loopTemplate, edge.from, edge.to);
        break;
      case 'branch-condition':
        setFirstEdge(branchCondition, edge.from, edge.to);
        break;
      case 'branch-default':
        setFirstEdge(branchDefault, edge.from, edge.to);
        break;
      case 'fork-edge':
        setFirstEdge(fork, edge.from, edge.to);
        break;
      case 'path-contains': {
        const existing = pathChildrenRaw.get(edge.from) ?? [];
        existing.push({ order: edge.order, to: edge.to });
        pathChildrenRaw.set(edge.from, existing);
        break;
      }
    }
  }

  const pathChildren = new Map<string, string[]>();
  for (const [fromId, children] of pathChildrenRaw) {
    pathChildren.set(
      fromId,
      children.sort((a, b) => a.order - b.order).map((c) => c.to),
    );
  }

  return {
    nodes,
    startNode,
    sequential,
    loopTemplate,
    branchCondition,
    branchDefault,
    fork,
    pathChildren,
  };
}

// Built once per ExperimentFlow object reference; GC'd when the experiment is released.
const indexCache = new WeakMap<ExperimentFlow, ExperimentIndex>();

function getIndex(experiment: ExperimentFlow): ExperimentIndex {
  let index = indexCache.get(experiment);
  if (!index) {
    index = buildExperimentIndex(experiment);
    indexCache.set(experiment, index);
  }
  return index;
}

export function getNode(experiment: ExperimentFlow, nodeId: string) {
  return getIndex(experiment).nodes.get(nodeId);
}

export function getStartNode(experiment: ExperimentFlow) {
  return getIndex(experiment).startNode;
}

function findEdgeTo(
  index: ExperimentIndex,
  edgeMap: Map<string, string>,
  fromId: string,
): FrameworkNode | null {
  const toId = edgeMap.get(fromId);
  if (!toId) return null;
  return index.nodes.get(toId) ?? null;
}

export function getNextSequentialNode(
  experiment: ExperimentFlow,
  fromNodeId: string,
) {
  const index = getIndex(experiment);
  return findEdgeTo(index, index.sequential, fromNodeId);
}

export function getTemplateNode(experiment: ExperimentFlow, nodeId: string) {
  const index = getIndex(experiment);
  return findEdgeTo(index, index.loopTemplate, nodeId);
}

export function getChildNodes(experiment: ExperimentFlow, nodeId: string) {
  const index = getIndex(experiment);
  const toIds = index.pathChildren.get(nodeId);
  if (!toIds || toIds.length === 0) return null;
  return toIds
    .map((id) => index.nodes.get(id))
    .filter((n) => isDefined<FrameworkNode>(n));
}

export function getBranchNode(
  experiment: ExperimentFlow,
  nodeId: string,
  winnerId: string,
) {
  const index = getIndex(experiment);
  return findEdgeTo(index, index.branchCondition, `${nodeId}.${winnerId}`);
}

export function getDefaultBranchNode(
  experiment: ExperimentFlow,
  nodeId: string,
) {
  const index = getIndex(experiment);
  return findEdgeTo(index, index.branchDefault, nodeId);
}

export function getForkEdgeNode(
  experiment: ExperimentFlow,
  nodeId: string,
  winnerId: string,
) {
  const index = getIndex(experiment);
  return findEdgeTo(index, index.fork, `${nodeId}.${winnerId}`);
}

function selectForkByWeight(forks: Fork[]): Fork {
  const total = forks.reduce((sum, f) => sum + (f.weight ?? 1), 0);
  let rand = Math.random() * total;
  for (const fork of forks) {
    rand -= fork.weight ?? 1;
    if (rand <= 0) return fork;
  }
  return forks[forks.length - 1];
}

export function getWinnerNode(
  experiment: ExperimentFlow,
  branchNode: BranchNode,
  context: Context,
) {
  const branches = branchNode.props.branches;
  const winner = branches.find((b) => evaluateCondition(b.config, context));

  const nNode = winner
    ? getBranchNode(experiment, branchNode.id, winner.id)
    : getDefaultBranchNode(experiment, branchNode.id);

  return { nNode, winnerId: winner?.id ?? 'default' };
}

export async function getWinnerFork(
  experiment: ExperimentFlow,
  forkNode: ForkNode,
) {
  const forks = forkNode.props.forks;
  const winner = selectForkByWeight(forks);

  const nNode = getForkEdgeNode(experiment, forkNode.id, winner.id);

  return { nNode, winnerId: winner.id };
}
