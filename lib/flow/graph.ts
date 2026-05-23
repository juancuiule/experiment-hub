import { evaluateCondition } from '../conditions';
import {
  FrameworkEdge,
  isBranchConditionEdge,
  isBranchDefaultEdge,
  isForkEdge,
  isLoopEdge,
  isPathEdge,
  isSequentialEdge,
} from '../edges';
import { BranchNode, Fork, ForkNode, FrameworkNode } from '../nodes';
import { Context, ExperimentFlow } from '../types';
import { isDefined } from '../utils';

export function getNode(experiment: ExperimentFlow, nodeId: string) {
  return experiment.nodes.find((n) => n.id === nodeId);
}

function findEdgeTo(
  experiment: ExperimentFlow,
  guard: (e: FrameworkEdge) => boolean,
  fromId: string,
): FrameworkNode | null {
  const edge = experiment.edges.filter(guard).find((e) => e.from === fromId);
  if (!edge) return null;
  return getNode(experiment, edge.to) ?? null;
}

export function getNextSequentialNode(
  experiment: ExperimentFlow,
  fromNodeId: string,
) {
  return findEdgeTo(experiment, isSequentialEdge, fromNodeId);
}

export function getTemplateNode(experiment: ExperimentFlow, nodeId: string) {
  return findEdgeTo(experiment, isLoopEdge, nodeId);
}

export function getChildNodes(experiment: ExperimentFlow, nodeId: string) {
  const edges = experiment.edges
    .filter(isPathEdge)
    .filter((e) => e.from === nodeId)
    .sort((a, b) => a.order - b.order);
  if (edges.length === 0) return null;
  return edges
    .map((e) => getNode(experiment, e.to))
    .filter((n) => isDefined<FrameworkNode>(n));
}

export function getBranchNode(
  experiment: ExperimentFlow,
  nodeId: string,
  winnerId: string,
) {
  return findEdgeTo(experiment, isBranchConditionEdge, `${nodeId}.${winnerId}`);
}

export function getDefaultBranchNode(
  experiment: ExperimentFlow,
  nodeId: string,
) {
  return findEdgeTo(experiment, isBranchDefaultEdge, nodeId);
}

export function getForkEdgeNode(
  experiment: ExperimentFlow,
  nodeId: string,
  winnerId: string,
) {
  return findEdgeTo(experiment, isForkEdge, `${nodeId}.${winnerId}`);
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
