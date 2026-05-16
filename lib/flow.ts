import { evaluateCondition } from "./conditions";

import {
  isBranchConditionEdge,
  isBranchDefaultEdge,
  isForkEdge,
  isLoopEdge,
  isPathEdge,
  isSequentialEdge,
} from "./edges";
import { hasRandomizedOptions, Option } from "./components/response";
import { BranchNode, Fork, ForkNode, FrameworkNode } from "./nodes";
import { getValue, resolveOptionsSource } from "./resolve";
import {
  Context,
  ExperimentFlow,
  FlowStep,
  InLoopState,
  InNodeState,
  InPathState,
  State,
} from "./types";
import { isDefined, send, shuffle } from "./utils";

// This function determines if we should auto-traverse from
// the current step without waiting for external input.
function shouldAutoTraverse(step: FlowStep): boolean {
  const { state } = step;

  const isAutoNode =
    state.type === "in-node" &&
    ["start", "checkpoint", "branch", "fork"].includes(state.node.type);

  return isAutoNode;
}

// This function computes the initial state when entering a node.
// When we enter a path or a loop, we need to setup the inner state.
function initialState(
  experiment: ExperimentFlow,
  context: Context,
  node: FrameworkNode,
): State {
  switch (node.type) {
    case "start":
    case "checkpoint":
    case "screen":
    case "branch":
    case "fork": {
      return { type: "in-node" as const, node };
    }
    case "loop": {
      const template = getTemplateNode(experiment, node.id);

      if (!template) {
        throw new Error("Loop node must have a template node");
      }

      const values =
        node.props.type === "static"
          ? node.props.values
          : ((getValue(node.props.dataKey, context) as string[]) ?? []);

      return {
        type: "in-loop" as const,
        node,
        values,
        template,
        index: 0,
        innerState: initialState(experiment, context, template),
      };
    }
    case "path": {
      const children = getChildNodes(experiment, node.id);

      if (!children || children.length === 0) {
        throw new Error("Path node must have child nodes");
      }

      const childrenInOrder = node.props.randomized
        ? shuffle(children)
        : children;

      return {
        type: "in-path" as const,
        node,
        children: childrenInOrder,
        step: 0,
        innerState: initialState(experiment, context, childrenInOrder[0]),
      };
    }
  }
}

function computeShuffledOptions(
  experiment: ExperimentFlow,
  context: Context,
  slug: string,
): Record<string, Array<Option>> {
  const screen = experiment.screens?.find((s) => s.slug === slug);
  if (!screen) return {};

  const inLoop = Object.keys(context.loopData ?? {}).length > 0;
  const previous = context.screenData?.shuffledOptions ?? {};
  const result: Record<string, Array<Option>> = {};

  for (const component of screen.components) {
    if (
      component.componentFamily === "response" &&
      hasRandomizedOptions(component)
    ) {
      const { dataKey } = component.props;
      if (inLoop && !component.props.reshuffleInLoop && previous[dataKey]) {
        result[dataKey] = previous[dataKey];
      } else {
        result[dataKey] = shuffle(
          resolveOptionsSource(component.props.options, context),
        );
      }
    }
  }
  return result;
}

// This function handles entering a step, applying any auto-traversal logic if needed.
async function enterStep(step: FlowStep): Promise<FlowStep> {
  if (step.state.type === "in-loop") {
    const { index, node, template } = step.state;

    // Recompute values using the current context — critical for nested loops
    // where the dataKey references a parent loop's item via @, since the parent's
    // loopData is only available in context at enterStep time, not at initialState time.
    const values =
      node.props.type === "static"
        ? node.props.values
        : ((getValue(node.props.dataKey, step.context) as string[]) ?? []);

    // Skip the loop entirely when there are no values to iterate
    if (values.length === 0) {
      const ctx = mergeContext(step.context, {
        loops: { [node.id]: { order: [] } },
      });
      return exitToNextNode(step.experiment, ctx, node.id, step.dataPath ?? []);
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
    });

    return {
      ...step,
      state: { ...step.state, values, innerState: innerStep.state },
      context: innerStep.context,
    };
  }
  if (step.state.type === "in-path") {
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

  if (step.state.type === "in-node" && step.state.node.type === "screen") {
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

export async function traverse(
  step: FlowStep,
  data?: Record<string, any>,
): Promise<FlowStep> {
  const { state, experiment, context } = step;

  switch (state.type) {
    case "end": {
      return step; // no-op, already at the end
    }
    case "initial": {
      const startNodeId = data?.startNodeId as string | undefined;
      const startNode = startNodeId
        ? getNode(experiment, startNodeId)
        : experiment.nodes.find((n) => n.type === "start");

      if (!startNode || startNode.type !== "start") {
        throw new Error(
          startNodeId
            ? `Start node not found: ${startNodeId}`
            : "No start node found in experiment",
        );
      }

      return await enterStep({
        state: initialState(experiment, context, startNode),
        experiment,
        context,
      });
    }
    case "in-node": {
      return await traverseInNode({ ...step, state }, data ?? {});
    }
    case "in-path": {
      return await traverseInPath({ ...step, state }, data ?? {});
    }
    case "in-loop": {
      return await traverseInLoop({ ...step, state }, data ?? {});
    }
  }
}

function getNextSequentialNode(experiment: ExperimentFlow, fromNodeId: string) {
  const edge = experiment.edges
    .filter(isSequentialEdge)
    .find((e) => e.from === fromNodeId);
  if (!edge) return null;
  return getNode(experiment, edge.to);
}

function getTemplateNode(experiment: ExperimentFlow, nodeId: string) {
  const edge = experiment.edges
    .filter(isLoopEdge)
    .find((e) => e.from === nodeId);
  if (!edge) return null;
  return getNode(experiment, edge.to);
}

function getChildNodes(experiment: ExperimentFlow, nodeId: string) {
  const edges = experiment.edges
    .filter(isPathEdge)
    .filter((e) => e.from === nodeId)
    .sort((a, b) => a.order - b.order);
  if (edges.length === 0) return null;
  return edges
    .map((e) => getNode(experiment, e.to))
    .filter((n) => isDefined<FrameworkNode>(n));
}

function getBranchNode(
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

function getDefaultBranchNode(experiment: ExperimentFlow, nodeId: string) {
  const edge = experiment.edges
    .filter(isBranchDefaultEdge)
    .find((e) => e.from === nodeId);
  if (!edge) return null;
  return getNode(experiment, edge.to);
}

function getForkEdgeNode(
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

function getNode(experiment: ExperimentFlow, nodeId: string) {
  return experiment.nodes.find((n) => n.id === nodeId);
}

// Arrays are replaced wholesale, not recursively merged.
export function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      result[key] = deepMerge(target[key] ?? {}, val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export function mergeContext(context: Context, toMerge: Context): Context {
  return deepMerge(context, toMerge);
}

function withCurrentItem(
  context: Context,
  loopId: string,
  values: string[],
  index: number,
): Context {
  return mergeContext(context, {
    loopData: {
      [loopId]: { value: values[index], index },
    },
  });
}

async function exitToNextNode(
  experiment: ExperimentFlow,
  context: Context,
  nodeId: string,
  dataPath: string[],
): Promise<FlowStep> {
  const nNode = getNextSequentialNode(experiment, nodeId);
  if (!nNode) {
    return { experiment, state: { type: "end" }, context, dataPath };
  }
  const nState = initialState(experiment, context, nNode);
  return enterStep({ state: nState, experiment, context, dataPath });
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

// Curried helper for .then()-based chaining:
export function next(data?: Record<string, any>) {
  return (step: FlowStep) => traverse(step, data);
}

export async function startExperiment(
  experiment: ExperimentFlow,
  startNodeId?: string,
): Promise<FlowStep> {
  return await traverse(
    { state: { type: "initial" }, experiment, context: {} },
    startNodeId ? { startNodeId } : undefined,
  );
}

export async function traverseInNode(
  step: FlowStep<InNodeState>,
  data: Record<string, any>,
): Promise<FlowStep> {
  const { state, experiment, context } = step;
  switch (state.node.type) {
    case "start": {
      const nNode = getNextSequentialNode(experiment, state.node.id);
      if (!nNode) {
        throw new Error("Start node must have a next node");
      }

      const nState = initialState(experiment, context, nNode);
      const nContext = mergeContext(context, {
        start: {
          group: state.node.props
            ? `${state.node.props.param.key}=${state.node.props.param.value}`
            : "default",
        },
      });

      return await enterStep({ state: nState, experiment, context: nContext });
    }
    case "checkpoint": {
      await send(context); // retried on failure in a real implementation
      const nNode = getNextSequentialNode(experiment, state.node.id);

      const nContext = mergeContext(context, {
        checkpoints: {
          [state.node.props.name]: new Date().toISOString(),
        },
      });

      if (!nNode) return { ...step, context: nContext, state: { type: "end" } };

      const nState = initialState(experiment, nContext, nNode);
      return await enterStep({ state: nState, experiment, context: nContext });
    }
    case "branch": {
      const { nNode, winnerId } = getWinnerNode(
        experiment,
        state.node,
        context,
      );

      if (!nNode) {
        throw new Error(
          "Branch node must have a next node for the winning branch",
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
      });
    }
    case "fork": {
      const { nNode, winnerId } = await getWinnerFork(experiment, state.node);

      if (!nNode) {
        throw new Error("Fork node must have a next node for the winning fork");
      }

      return await enterStep({
        experiment,
        state: initialState(experiment, context, nNode),
        context: mergeContext(context, {
          forks: {
            [state.node.id]: winnerId,
          },
        }),
      });
    }
    case "screen": {
      const keys = [...(step.dataPath ?? []), state.node.props.slug];
      const nestedData = keys.reduceRight<Record<string, any>>(
        (acc, key) => ({ [key]: acc }),
        data ?? {},
      );
      const nContext = mergeContext(context, { data: nestedData });
      const nNode = getNextSequentialNode(experiment, state.node.id);
      if (!nNode) return { ...step, context: nContext, state: { type: "end" } };

      const nState = initialState(experiment, nContext, nNode);
      return await enterStep({
        state: nState,
        experiment,
        context: nContext,
        dataPath: step.dataPath,
      });
    }
  }
}

export async function traverseInPath(
  step: FlowStep<InPathState>,
  data: Record<string, any>,
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
    },
    data,
  );

  // If the inner state returns "end" it means we completed the current
  // child node and should move to the next one in the path
  if (nInnerState.type === "end") {
    const nextStep = state.step + 1;
    if (nextStep < state.children.length) {
      const nextNode = state.children[nextStep];
      const nextInnerState = initialState(experiment, nContext, nextNode);
      const innerStep = await enterStep({
        state: nextInnerState,
        experiment,
        context: nContext,
        dataPath: [...(step.dataPath ?? []), state.node.id],
      });
      return {
        experiment,
        state: { ...state, step: nextStep, innerState: innerStep.state },
        context: innerStep.context,
        dataPath: step.dataPath,
      };
    }

    return exitToNextNode(
      experiment,
      nContext,
      state.node.id,
      step.dataPath ?? [],
    );
  }

  return {
    experiment,
    state: { ...state, innerState: nInnerState },
    context: nContext,
    dataPath: step.dataPath,
  };
}

export async function traverseInLoop(
  step: FlowStep<InLoopState>,
  data: Record<string, any>,
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
    },
    data,
  );

  // Same signal mechanism as in-path: end inner → advance iteration.
  if (nInnerState.type === "end") {
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
      });
      return {
        experiment,
        state: { ...state, index: nextIteration, innerState: innerStep.state },
        context: innerStep.context,
        dataPath: step.dataPath,
      };
    }

    // Clear currentItem when exiting the loop
    return exitToNextNode(
      experiment,
      nContext,
      state.node.id,
      step.dataPath ?? [],
    );
  }

  return {
    experiment,
    state: { ...state, innerState: nInnerState },
    context: nContext,
    dataPath: step.dataPath,
  };
}

function getWinnerNode(
  experiment: ExperimentFlow,
  branchNode: BranchNode,
  context: Context,
) {
  const branches = branchNode.props.branches;
  const winner = branches.find((b) => evaluateCondition(b.config, context));

  const nNode = winner
    ? getBranchNode(experiment, branchNode.id, winner.id)
    : getDefaultBranchNode(experiment, branchNode.id);

  return { nNode, winnerId: winner?.id ?? "default" };
}

async function getWinnerFork(experiment: ExperimentFlow, forkNode: ForkNode) {
  const forks = forkNode.props.forks;
  const winner = selectForkByWeight(forks);

  const nNode = getForkEdgeNode(experiment, forkNode.id, winner.id);

  return { nNode, winnerId: winner.id };
}

// Resolves the innermost active state by unwrapping in-path / in-loop wrappers.
export function getActiveState(state: State): State {
  if (state.type === "in-path") return getActiveState(state.innerState);
  if (state.type === "in-loop") return getActiveState(state.innerState);
  return state;
}

// Builds a timing key from a FlowStep for tracking screen response times.
// Returns null for non-screen states, otherwise returns the slug or dataPath/slug.
// Walks in-path / in-loop state wrappers to derive the full nesting key so that
// the returned key matches context.data's nested structure (e.g. "path-a/q1").
export function buildTimingKey(step: FlowStep): string | null {
  const segments: string[] = [...(step.dataPath ?? [])];

  function walkState(state: State): State {
    if (state.type === "in-path") {
      segments.push(state.node.id);
      return walkState(state.innerState);
    }
    if (state.type === "in-loop") {
      segments.push(state.node.id, state.values[state.index]);
      return walkState(state.innerState);
    }
    return state;
  }

  const leaf = walkState(step.state);
  if (leaf.type !== "in-node") return null;
  if (leaf.node.type !== "screen") return null;
  segments.push(leaf.node.props.slug);
  return segments.join("/");
}

export async function traverseWithTiming(
  step: FlowStep,
  data?: Record<string, any>,
): Promise<FlowStep> {
  const key = buildTimingKey(step);
  const submittedAt = new Date().toISOString();
  const contextWithSubmit = key
    ? mergeContext(step.context, {
        timings: {
          [key]: {
            ...(step.context.timings?.[key] ?? {}),
            submittedAt,
          },
        },
      })
    : step.context;
  return traverse({ ...step, context: contextWithSubmit }, data);
}

export function recordEnteredAt(step: FlowStep): FlowStep {
  const key = buildTimingKey(step);
  if (!key) return step;
  const enteredAt = new Date().toISOString();
  return {
    ...step,
    context: mergeContext(step.context, {
      timings: {
        [key]: {
          ...(step.context.timings?.[key] ?? {}),
          enteredAt,
        },
      },
    }),
  };
}
