import {
  getChildNodes,
  getNextSequentialNode,
  getNode,
  getBranchNode,
  getDefaultBranchNode,
  getForkEdgeNode,
  getTemplateNode,
} from '../flow/graph';
import { mergeContext } from '../flow';
import { resolveIterKey } from '../flow/traverse';
import { ComputeNode } from '../nodes';
import { Context, ExperimentFlow } from '../types';

// Enclosing-loop repetition for fields collected inside a loop's template.
export type LoopRepetition =
  | { kind: 'static'; count: number; loopId: string }
  | { kind: 'dynamic'; over: string; loopId: string };

// One visit of a screen node at a concrete graph position. The same screen
// definition reached at two positions yields two occurrences (distinct dataPath).
export type ScreenOccurrence = {
  slug: string;
  dataPath: string[];
  // Loop bindings (loopData) for this position, so @loopId tokens in the
  // screen's field keys/labels resolve when collectFields runs.
  context: Context;
  // Innermost enclosing loop, if any.
  loop?: LoopRepetition;
};

export type ComputeOccurrence = { node: ComputeNode; dataPath: string[] };

export type WalkResult = {
  screens: ScreenOccurrence[];
  computes: ComputeOccurrence[];
  // Every node id reached from a start node — used to scope the system section
  // to branch/fork/path/loop/checkpoint nodes that actually run.
  visitedNodeIds: Set<string>;
};

// Static DFS over the graph from every start node, accumulating the data-path
// prefix (path/loop ids) the engine would nest data under. Unlike runtime
// traversal it follows ALL branch arms / fork outcomes and enumerates static
// loop iterations, since any of them can occur across participants.
export function walkExperiment(experiment: ExperimentFlow): WalkResult {
  const screens: ScreenOccurrence[] = [];
  const computes: ComputeOccurrence[] = [];
  const visitedNodeIds = new Set<string>();
  const seen = new Set<string>();

  function visit(
    nodeId: string,
    dataPath: string[],
    context: Context,
    loop: LoopRepetition | undefined,
  ): void {
    const visitKey = `${nodeId}|${dataPath.join('/')}`;
    if (seen.has(visitKey)) return;
    seen.add(visitKey);
    visitedNodeIds.add(nodeId);

    const node = getNode(experiment, nodeId);
    if (!node) return;

    const followSequential = () => {
      const next = getNextSequentialNode(experiment, nodeId);
      if (next) visit(next.id, dataPath, context, loop);
    };

    switch (node.type) {
      case 'screen':
        screens.push({ slug: node.props.slug, dataPath, context, loop });
        followSequential();
        return;

      case 'compute':
        computes.push({ node, dataPath });
        followSequential();
        return;

      case 'start':
      case 'checkpoint':
        followSequential();
        return;

      case 'end':
        return;

      case 'branch': {
        for (const branch of node.props.branches) {
          const target = getBranchNode(experiment, nodeId, branch.id);
          if (target) visit(target.id, dataPath, context, loop);
        }
        const def = getDefaultBranchNode(experiment, nodeId);
        if (def) visit(def.id, dataPath, context, loop);
        return;
      }

      case 'fork': {
        for (const fork of node.props.forks) {
          const target = getForkEdgeNode(experiment, nodeId, fork.id);
          if (target) visit(target.id, dataPath, context, loop);
        }
        return;
      }

      case 'path': {
        const children = getChildNodes(experiment, nodeId) ?? [];
        for (const child of children) {
          visit(child.id, [...dataPath, nodeId], context, loop);
        }
        followSequential(); // what comes after the path, at the outer level
        return;
      }

      case 'loop': {
        const template = getTemplateNode(experiment, nodeId);
        if (template) {
          if (node.props.type === 'static') {
            const values = node.props.values;
            const itemKey = node.props.itemKey;
            values.forEach((value, index) => {
              // Mirror the runtime exactly so codebook keys match export columns:
              // plain values key on the value itself, objects on itemKey, else
              // the 1-based index (reserved keys also fall back to the index).
              const iterKey = resolveIterKey(value, index, itemKey);
              const iterCtx = mergeContext(context, {
                loopData: { [nodeId]: { value, index } },
              });
              visit(template.id, [...dataPath, nodeId, iterKey], iterCtx, {
                kind: 'static',
                count: values.length,
                loopId: nodeId,
              });
            });
          } else {
            visit(template.id, [...dataPath, nodeId, '<iter>'], context, {
              kind: 'dynamic',
              over: node.props.dataKey,
              loopId: nodeId,
            });
          }
        }
        followSequential(); // what comes after the loop, at the outer level
        return;
      }
    }
  }

  for (const node of experiment.nodes) {
    if (node.type === 'start') visit(node.id, [], {}, undefined);
  }

  return { screens, computes, visitedNodeIds };
}
