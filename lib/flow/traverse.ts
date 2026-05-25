import { FrameworkNode } from '../nodes';
import { getValue } from '../resolve';
import {
  Context,
  ContextData,
  ExperimentFlow,
  FlowHandlers,
  FlowStep,
  InLoopState,
  InNodeState,
  InPathState,
  State,
} from '../types';
import { shuffle } from '../utils';
import { mergeContext, withCurrentItem } from './context';
import { evaluateFormula } from './formulas';
import {
  getChildNodes,
  getNextSequentialNode,
  getTemplateNode,
  getWinnerFork,
  getWinnerNode,
} from './graph';
import { computeShuffledOptions } from './shuffles';
import { computePathVisibility, countChainFromNode } from './visibility';

export type { FlowHandlers };

function nestData(
  context: Context,
  dataPath: string[] | undefined,
  key: string,
  data: Record<string, unknown>,
): Context {
  const keys = [...(dataPath ?? []), key];
  const nested = keys.reduceRight<Record<string, unknown>>(
    (acc, k) => ({ [k]: acc }),
    data,
  );
  return mergeContext(context, { data: nested });
}

function shouldAutoTraverse(step: FlowStep): boolean {
  const { state } = step;

  const isAutoNode =
    state.type === 'in-node' &&
    ['start', 'checkpoint', 'branch', 'fork', 'compute'].includes(
      state.node.type,
    );

  return isAutoNode;
}

function initialState(
  experiment: ExperimentFlow,
  context: Context,
  node: FrameworkNode,
): State {
  switch (node.type) {
    case 'start':
    case 'checkpoint':
    case 'screen':
    case 'compute':
    case 'branch':
    case 'fork': {
      return { type: 'in-node' as const, node };
    }
    case 'loop': {
      const template = getTemplateNode(experiment, node.id);

      if (!template) {
        throw new Error('Loop node must have a template node');
      }

      const values =
        node.props.type === 'static'
          ? node.props.values
          : ((getValue(node.props.dataKey, context) as string[]) ?? []);

      return {
        type: 'in-loop' as const,
        node,
        values,
        template,
        index: 0,
        innerState: initialState(experiment, context, template),
      };
    }
    case 'path': {
      const children = getChildNodes(experiment, node.id);

      if (!children || children.length === 0) {
        throw new Error('Path node must have child nodes');
      }

      const childrenInOrder = node.props.randomized
        ? shuffle(children)
        : children;

      const {
        total: visibleTotal,
        branchContributions: visibleBranchContributions,
      } = computePathVisibility(experiment, context, childrenInOrder);

      return {
        type: 'in-path' as const,
        node,
        children: childrenInOrder,
        currentChildId: childrenInOrder[0].id,
        innerState: initialState(experiment, context, childrenInOrder[0]),
        visibleStep: 0,
        visibleTotal,
        visibleBranchContributions,
      };
    }
  }
}

async function enterStep(step: FlowStep): Promise<FlowStep> {
  if (step.state.type === 'in-loop') {
    const { index, node, template } = step.state;

    // Recompute values using the current context — critical for nested loops
    // where the dataKey references a parent loop's item via @, since the parent's
    // loopData is only available in context at enterStep time, not at initialState time.
    const values =
      node.props.type === 'static'
        ? node.props.values
        : ((getValue(node.props.dataKey, step.context) as string[]) ?? []);

    // Skip the loop entirely when there are no values to iterate
    if (values.length === 0) {
      const ctx = mergeContext(step.context, {
        loops: { [node.id]: { order: [] } },
      });
      return exitToNextNode(
        step.experiment,
        ctx,
        node.id,
        step.dataPath ?? [],
        step.handlers,
      );
    }

    const contextWithItem = mergeContext(
      withCurrentItem(step.context, node.id, values, index),
      { loops: { [node.id]: { order: values } } },
    );

    // On first entry, reinitialize innerState with the updated context so nested
    // loops can correctly resolve their own dataKey against this loop's current item.
    // Then recursively call enterStep on it so nested loops also inject their
    // current item into context (otherwise loopData for the inner loop is never set).
    const freshInnerState =
      index === 0
        ? initialState(step.experiment, contextWithItem, template)
        : step.state.innerState;

    const innerStep = await enterStep({
      state: freshInnerState,
      experiment: step.experiment,
      context: contextWithItem,
      dataPath: step.dataPath,
      handlers: step.handlers,
    });

    return {
      ...step,
      state: { ...step.state, values, innerState: innerStep.state },
      context: innerStep.context,
    };
  }
  if (step.state.type === 'in-path') {
    const { node, children } = step.state;
    return {
      ...step,
      context: mergeContext(step.context, {
        paths: {
          [node.id]: { order: children.map((child) => child.id) },
        },
      }),
    };
  }
  if (shouldAutoTraverse(step)) return await traverse(step);

  if (step.state.type === 'in-node' && step.state.node.type === 'screen') {
    const shuffledOptions = computeShuffledOptions(
      step.experiment,
      step.context,
      step.state.node.props.slug,
    );
    if (Object.keys(shuffledOptions).length > 0) {
      return {
        ...step,
        context: mergeContext(step.context, {
          screenData: { shuffledOptions },
        }),
      };
    }
  }

  return step;
}

async function exitToNextNode(
  experiment: ExperimentFlow,
  context: Context,
  nodeId: string,
  dataPath: string[],
  handlers?: FlowHandlers,
): Promise<FlowStep> {
  const nNode = getNextSequentialNode(experiment, nodeId);
  if (!nNode) {
    return { experiment, state: { type: 'end' }, context, dataPath, handlers };
  }
  const nState = initialState(experiment, context, nNode);
  return enterStep({ state: nState, experiment, context, dataPath, handlers });
}

export async function traverse(
  step: FlowStep,
  data?: ContextData,
): Promise<FlowStep> {
  const { state, experiment, context } = step;

  switch (state.type) {
    case 'end': {
      return step; // no-op, already at the end
    }
    case 'initial': {
      const startNodeId = data?.startNodeId as string | undefined;
      const startNode = startNodeId
        ? experiment.nodes.find((n) => n.id === startNodeId)
        : experiment.nodes.find((n) => n.type === 'start');

      if (!startNode || startNode.type !== 'start') {
        throw new Error(
          startNodeId
            ? `Start node not found: ${startNodeId}`
            : 'No start node found in experiment',
        );
      }

      return await enterStep({
        state: initialState(experiment, context, startNode),
        experiment,
        context,
        handlers: step.handlers,
      });
    }
    case 'in-node': {
      return await traverseInNode({ ...step, state }, data ?? {});
    }
    case 'in-path': {
      return await traverseInPath({ ...step, state }, data ?? {});
    }
    case 'in-loop': {
      return await traverseInLoop({ ...step, state }, data ?? {});
    }
  }
}

export async function traverseInNode(
  step: FlowStep<InNodeState>,
  data: ContextData,
): Promise<FlowStep> {
  const { state, experiment, context } = step;
  switch (state.node.type) {
    case 'start': {
      const nNode = getNextSequentialNode(experiment, state.node.id);
      if (!nNode) {
        throw new Error('Start node must have a next node');
      }

      const nState = initialState(experiment, context, nNode);
      const nContext = mergeContext(context, {
        start: {
          group: state.node.props
            ? `${state.node.props.param.key}=${state.node.props.param.value}`
            : 'default',
        },
      });

      return await enterStep({
        state: nState,
        experiment,
        context: nContext,
        handlers: step.handlers,
      });
    }
    case 'checkpoint': {
      await step.handlers?.onCheckpoint?.(context, state.node.props.name);
      const nNode = getNextSequentialNode(experiment, state.node.id);

      const nContext = mergeContext(context, {
        checkpoints: {
          [state.node.props.name]: new Date().toISOString(),
        },
      });

      if (!nNode) return { ...step, context: nContext, state: { type: 'end' } };

      const nState = initialState(experiment, nContext, nNode);
      return await enterStep({
        state: nState,
        experiment,
        context: nContext,
        handlers: step.handlers,
      });
    }
    case 'branch': {
      const { nNode, winnerId } = getWinnerNode(
        experiment,
        state.node,
        context,
      );

      if (!nNode) {
        throw new Error(
          'Branch node must have a next node for the winning branch',
        );
      }

      return await enterStep({
        experiment,
        state: initialState(experiment, context, nNode),
        context: mergeContext(context, {
          branches: {
            [state.node.id]: winnerId,
          },
        }),
        handlers: step.handlers,
      });
    }
    case 'fork': {
      const { nNode, winnerId } = await getWinnerFork(experiment, state.node);

      if (!nNode) {
        throw new Error('Fork node must have a next node for the winning fork');
      }

      return await enterStep({
        experiment,
        state: initialState(experiment, context, nNode),
        context: mergeContext(context, {
          forks: {
            [state.node.id]: winnerId,
          },
        }),
        handlers: step.handlers,
      });
    }
    case 'screen': {
      const nContext = nestData(context, step.dataPath, state.node.props.slug, data ?? {});
      const nNode = getNextSequentialNode(experiment, state.node.id);
      if (!nNode) return { ...step, context: nContext, state: { type: 'end' } };

      const nState = initialState(experiment, nContext, nNode);
      return await enterStep({
        state: nState,
        experiment,
        context: nContext,
        dataPath: step.dataPath,
        handlers: step.handlers,
      });
    }
    case 'compute': {
      const nodeOutputs: Record<string, unknown> = {};
      for (const computation of state.node.props.computations) {
        nodeOutputs[computation.outputKey] = evaluateFormula(
          computation.formula,
          context,
          nodeOutputs,
        );
      }
      const nContext = nestData(context, step.dataPath, state.node.id, nodeOutputs);
      const nNode = getNextSequentialNode(experiment, state.node.id);
      if (!nNode) return { ...step, context: nContext, state: { type: 'end' } };
      const nState = initialState(experiment, nContext, nNode);
      return await enterStep({
        state: nState,
        experiment,
        context: nContext,
        dataPath: step.dataPath,
        handlers: step.handlers,
      });
    }
  }
}

export async function traverseInPath(
  step: FlowStep<InPathState>,
  data: ContextData,
): Promise<FlowStep> {
  const { state, experiment, context } = step;

  // when we receive a "next" action being in a path
  // we traverse the inner state
  const { state: nInnerState, context: nContext } = await traverse(
    {
      state: state.innerState,
      experiment,
      context,
      dataPath: [...(step.dataPath ?? []), state.node.id],
      handlers: step.handlers,
    },
    data,
  );

  // If the inner state returns "end" it means we completed the current
  // child node and should move to the next one in the path
  if (nInnerState.type === 'end') {
    // currentChildId always names the path child we are executing (even when
    // innerState is a non-path-child node such as a branch target or a node
    // reached via a checkpoint's sequential edge). Derive the position from it
    // so there is never a stale index to patch up.
    const currentIndex = state.children.findIndex(
      (c) => c.id === state.currentChildId,
    );

    // Advance through children, skipping any that immediately auto-traverse to
    // end (e.g. a compute node with no outgoing sequential edge within the path).
    let nextIndex = currentIndex + 1;
    let currentCtx = nContext;

    while (nextIndex < state.children.length) {
      const nextNode = state.children[nextIndex];
      const nextInnerState = initialState(experiment, currentCtx, nextNode);
      const innerStep = await enterStep({
        state: nextInnerState,
        experiment,
        context: currentCtx,
        dataPath: [...(step.dataPath ?? []), state.node.id],
        handlers: step.handlers,
      });

      if (innerStep.state.type === 'end') {
        currentCtx = innerStep.context;
        nextIndex++;
        continue;
      }

      // If the entered child is a branch that jumped to a later path child via
      // branch-default, track that child as the new current position so that
      // subsequent advances start from there rather than re-entering it.
      let nextChildId = nextNode.id;
      const is = innerStep.state;
      if (is.type === 'in-node' || is.type === 'in-path' || is.type === 'in-loop') {
        const laterIdx = state.children.findIndex((c) => c.id === is.node.id);
        if (laterIdx > nextIndex) nextChildId = is.node.id;
      }

      // When the next path child is a branch, apply a delta between the pre-computed
      // contribution (which may be 0 for unresolvable conditions) and the actual chain
      // length determined now that the branch has been evaluated with real data.
      let visibleTotalDelta = 0;
      if (nextNode.type === 'branch') {
        const precomputed = state.visibleBranchContributions[nextNode.id] ?? 0;
        const actual =
          innerStep.state.type === 'in-node'
            ? countChainFromNode(
                experiment,
                innerStep.state.node.id,
                state.children,
              )
            : 0;
        visibleTotalDelta = actual - precomputed;
      }

      return {
        experiment,
        state: {
          ...state,
          currentChildId: nextChildId,
          innerState: innerStep.state,
          visibleStep: state.visibleStep + 1,
          visibleTotal: state.visibleTotal + visibleTotalDelta,
        },
        context: innerStep.context,
        dataPath: step.dataPath,
        handlers: step.handlers,
      };
    }

    return exitToNextNode(
      experiment,
      currentCtx,
      state.node.id,
      step.dataPath ?? [],
      step.handlers,
    );
  }

  // Keep currentChildId up-to-date: if the inner traversal has moved to a
  // later path child (branch-default → path child at higher index), record it
  // so subsequent end-path advances start from the correct position.
  let nextChildId = state.currentChildId;
  const currentIdx = state.children.findIndex((c) => c.id === state.currentChildId);
  if (
    nInnerState.type === 'in-node' ||
    nInnerState.type === 'in-path' ||
    nInnerState.type === 'in-loop'
  ) {
    const laterIdx = state.children.findIndex((c) => c.id === nInnerState.node.id);
    if (laterIdx > currentIdx) nextChildId = nInnerState.node.id;
  }

  return {
    experiment,
    state: { ...state, currentChildId: nextChildId, innerState: nInnerState },
    context: nContext,
    dataPath: step.dataPath,
    handlers: step.handlers,
  };
}

export async function traverseInLoop(
  step: FlowStep<InLoopState>,
  data: ContextData,
): Promise<FlowStep> {
  const { state, experiment, context } = step;

  // __currentItem is already in context, injected by autoTraverse on entry
  // and updated here whenever advancing to the next iteration
  const { state: nInnerState, context: nContext } = await traverse(
    {
      state: state.innerState,
      experiment,
      context,
      dataPath: [
        ...(step.dataPath ?? []),
        state.node.id,
        state.values[state.index],
      ],
      handlers: step.handlers,
    },
    data,
  );

  // Same signal mechanism as in-path: end inner → advance iteration.
  if (nInnerState.type === 'end') {
    const nextIteration = state.index + 1;
    if (nextIteration < state.values.length) {
      const contextWithNextItem = withCurrentItem(
        nContext,
        state.node.id,
        state.values,
        nextIteration,
      );
      const nextInnerState = initialState(
        experiment,
        contextWithNextItem,
        state.template,
      );
      const innerStep = await enterStep({
        state: nextInnerState,
        experiment,
        context: contextWithNextItem,
        dataPath: [
          ...(step.dataPath ?? []),
          state.node.id,
          state.values[nextIteration],
        ],
        handlers: step.handlers,
      });
      return {
        experiment,
        state: { ...state, index: nextIteration, innerState: innerStep.state },
        context: innerStep.context,
        dataPath: step.dataPath,
        handlers: step.handlers,
      };
    }

    // Clear currentItem when exiting the loop
    return exitToNextNode(
      experiment,
      nContext,
      state.node.id,
      step.dataPath ?? [],
      step.handlers,
    );
  }

  return {
    experiment,
    state: { ...state, innerState: nInnerState },
    context: nContext,
    dataPath: step.dataPath,
    handlers: step.handlers,
  };
}

// Curried helper for .then()-based chaining:
export function next(data?: ContextData) {
  return (step: FlowStep) => traverse(step, data);
}

export async function startExperiment(
  experiment: ExperimentFlow,
  startNodeId?: string,
  handlers?: FlowHandlers,
): Promise<FlowStep> {
  return await traverse(
    { state: { type: 'initial' }, experiment, context: {}, handlers },
    startNodeId ? { startNodeId } : undefined,
  );
}

// Resolves the innermost active state by unwrapping in-path / in-loop wrappers.
export function getActiveState(state: State): State {
  if (state.type === 'in-path') return getActiveState(state.innerState);
  if (state.type === 'in-loop') return getActiveState(state.innerState);
  return state;
}
