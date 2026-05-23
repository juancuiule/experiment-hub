import { evaluateCondition } from '../conditions';
import {
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

export function getNextSequentialNode(
  experiment: ExperimentFlow,
  fromNodeId: string,
) {
  const edge = experiment.edges
    .filter(isSequentialEdge)
    .find((e) => e.from === fromNodeId);
  if (!edge) return null;
  return getNode(experiment, edge.to);
}

export function getTemplateNode(experiment: ExperimentFlow, nodeId: string) {
  const edge = experiment.edges
    .filter(isLoopEdge)
    .find((e) => e.from === nodeId);
  if (!edge) return null;
  return getNode(experiment, edge.to);
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
  const fromId = `${nodeId}.${winnerId}`;
  const edge = experiment.edges
    .filter(isBranchConditionEdge)
    .find((e) => e.from === fromId);
  if (!edge) return null;
  return getNode(experiment, edge.to);
}

export function getDefaultBranchNode(
  experiment: ExperimentFlow,
  nodeId: string,
) {
  const edge = experiment.edges
    .filter(isBranchDefaultEdge)
    .find((e) => e.from === nodeId);
  if (!edge) return null;
  return getNode(experiment, edge.to);
}

export function getForkEdgeNode(
  experiment: ExperimentFlow,
  nodeId: string,
  winnerId: string,
) {
  const fromId = `${nodeId}.${winnerId}`;
  const edge = experiment.edges
    .filter(isForkEdge)
    .find((e) => e.from === fromId);
  if (!edge) return null;
  return getNode(experiment, edge.to);
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
