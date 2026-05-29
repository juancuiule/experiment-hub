import { FrameworkNode, isAutoTraverseNode, StepperConfig } from '../nodes';
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
  getNode,
  getStartNode,
  getTemplateNode,
  getWinnerFork,
  getWinnerNode,
} from './graph';
import { computeScreenShuffles } from './shuffles';
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
  return state.type === 'in-node' && isAutoTraverseNode(state.node);
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
        step: 0,
        innerState: initialState(experiment, context, childrenInOrder[0]),
        visibleStep: 0,
        visibleTotal,
        visibleBranchContributions,
      };
    }
    case 'end': {
      return { type: 'end' };
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
    const { shuffledOptions, shuffledForeachOrders } = computeScreenShuffles(
      step.experiment,
      step.context,
      step.state.node.props.slug,
    );
    const screenData: {
      shuffledOptions?: typeof shuffledOptions;
      shuffledForeachOrders?: typeof shuffledForeachOrders;
    } = {};
    if (Object.keys(shuffledOptions).length > 0) {
      screenData.shuffledOptions = shuffledOptions;
    }
    if (Object.keys(shuffledForeachOrders).length > 0) {
      screenData.shuffledForeachOrders = shuffledForeachOrders;
    }
    if (Object.keys(screenData).length > 0) {
      return {
        ...step,
        context: mergeContext(step.context, { screenData }),
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
        ? getNode(experiment, startNodeId)
        : getStartNode(experiment);

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
      const nContext = nestData(
        context,
        step.dataPath,
        state.node.props.slug,
        data ?? {},
      );
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
      const nContext = nestData(
        context,
        step.dataPath,
        state.node.id,
        nodeOutputs,
      );
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
    case 'end': {
      return { ...step, state: { type: 'end' } };
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
    // A branch inside the path may have navigated us directly to a later path
    // child (e.g. via branch-default). In that case state.step still points to
    // the branch's index, but the node that just ended is further ahead in
    // children. Advance from that child's position to avoid revisiting it.
    let effectiveStep = state.step;
    if (state.innerState.type === 'in-node') {
      const endedNodeId = state.innerState.node.id;
      const childIndex = state.children.findIndex((c) => c.id === endedNodeId);
      if (childIndex > effectiveStep) {
        effectiveStep = childIndex;
      }
    }
    const nextStep = effectiveStep + 1;
    if (nextStep < state.children.length) {
      const nextNode = state.children[nextStep];
      const nextInnerState = initialState(experiment, nContext, nextNode);
      const innerStep = await enterStep({
        state: nextInnerState,
        experiment,
        context: nContext,
        dataPath: [...(step.dataPath ?? []), state.node.id],
        handlers: step.handlers,
      });

      // If the entered child immediately auto-traversed to end (e.g. a compute
      // node with no outgoing sequential edge), recurse to advance past it.
      if (innerStep.state.type === 'end') {
        return traverseInPath(
          {
            ...step,
            state: { ...state, step: nextStep, innerState: innerStep.state },
            context: innerStep.context,
          },
          {},
        );
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
          step: nextStep,
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

export async function traverseInLoop(
  step: FlowStep<InLoopState>,
  data: ContextData,
): Promise<FlowStep> {
  const { state, experiment, context } = step;

  // __currentItem is already in context, injected by autoTraverse on entry
  // and updated here whenever advancing to the next iteration
  const iterKey =
    typeof state.values[state.index] === 'object' &&
    state.values[state.index] !== null
      ? String(state.index + 1)
      : state.values[state.index];
  const { state: nInnerState, context: nContext } = await traverse(
    {
      state: state.innerState,
      experiment,
      context,
      dataPath: [...(step.dataPath ?? []), state.node.id, iterKey],
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
      const nextIterKey =
        typeof state.values[nextIteration] === 'object' &&
        state.values[nextIteration] !== null
          ? String(nextIteration + 1)
          : state.values[nextIteration];
      const innerStep = await enterStep({
        state: nextInnerState,
        experiment,
        context: contextWithNextItem,
        dataPath: [...(step.dataPath ?? []), state.node.id, nextIterKey],
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

export function selectStartNode(
  params: Record<string, string | string[] | undefined>,
  experiment: ExperimentFlow,
): string {
  const startNodes = experiment.nodes.filter((n) => n.type === 'start');
  for (const node of startNodes) {
    if (
      node.props &&
      Object.prototype.hasOwnProperty.call(params, node.props.param.key)
    ) {
      if (
        !node.props.param.value ||
        params[node.props.param.key] === node.props.param.value
      ) {
        return node.id;
      }
    }
  }
  return startNodes[0].id;
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

export type ScreenView = {
  slug: string;
  screenKey: string;
  stepper: { config: StepperConfig; step: number; total: number } | null;
};

export function isEnded(step: FlowStep): boolean {
  const { leaf } = getLeafState(step.state);
  return leaf.type === 'end';
}

export function getScreenView(step: FlowStep): ScreenView | null {
  const { leaf: active } = getLeafState(step.state);
  if (active.type !== 'in-node' || active.node.type !== 'screen') return null;

  const slug = active.node.props.slug;
  const screenKey = [
    slug,
    ...Object.entries(step.context.loopData ?? {}).map(
      ([id, item]) => `${id}:${item.index}`,
    ),
  ].join('|');

  return { slug, screenKey, stepper: stepperPropsFromState(step.state) };
}

function stepperPropsFromState(
  state: State,
): { config: StepperConfig; step: number; total: number } | null {
  if (state.type === 'in-path' && state.node.props.stepper)
    return {
      config: state.node.props.stepper,
      step: state.visibleStep,
      total: state.visibleTotal,
    };
  if (state.type === 'in-loop' && state.node.props.stepper)
    return {
      config: state.node.props.stepper,
      step: state.index,
      total: state.values.length,
    };
  return null;
}

export function getLeafState(state: State): {
  segments: string[];
  leaf: State;
} {
  switch (state.type) {
    case 'in-path': {
      const { segments, leaf } = getLeafState(state.innerState);
      return {
        segments: [state.node.id, ...segments],
        leaf,
      };
    }
    case 'in-loop': {
      const iterKey =
        typeof state.values[state.index] === 'object' &&
        state.values[state.index] !== null
          ? String(state.index + 1)
          : state.values[state.index];
      const { segments, leaf } = getLeafState(state.innerState);
      return {
        segments: [state.node.id, iterKey, ...segments],
        leaf,
      };
    }
    default: {
      return { segments: [], leaf: state };
    }
  }
}
