import { FrameworkEdge } from "./edges";
import { FrameworkNode, PathNode, LoopNode } from "./nodes";
import { FrameworkScreen } from "./screen";
import { ExperimentTheme } from "./theme";

export type ExperimentFlow = {
  nodes: FrameworkNode[];
  edges: FrameworkEdge[];
  screens?: FrameworkScreen[];
  theme?: ExperimentTheme;
};

type IterativeItem = { value: any; index: number };

export type Context = Partial<{
  start: { group: string };
  checkpoints: { [checkpointName: string]: string };
  data: Record<string, any>;
  screenData: Record<string, any> & {
    foreachData?: { [foreachId: string]: IterativeItem };
  };
  branches: Record<string, string>;
  forks: Record<string, string>;
  paths: { [pathNodeId: string]: { order: string[] } };
  loops: { [loopNodeId: string]: { order: string[] } };
  loopData: { [loopNodeId: string]: IterativeItem };
}>;

export type InitialState = { type: "initial" };
export type InNodeState = {
  type: "in-node";
  node: Exclude<FrameworkNode, PathNode | LoopNode>;
};
export type InPathState = {
  type: "in-path";
  node: PathNode;
  children: FrameworkNode[];
  step: number;
  innerState: State;
};
export type InLoopState = {
  type: "in-loop";
  node: LoopNode;
  values: string[];
  template: FrameworkNode;
  index: number;
  innerState: State;
};
export type EndState = { type: "end" };

export type State =
  | InitialState
  | InNodeState
  | InPathState
  | InLoopState
  | EndState;

// This is a step in the traversal process.
export type FlowStep<S extends State = State> = {
  state: S; // current state in the traversal
  experiment: ExperimentFlow; // the experiment flow being traversed
  context: Context;
  dataPath?: string[]; // nesting path for screen data writes (e.g. ["path-regressors"])
};
