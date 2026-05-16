import { Option } from './components/response';
import { FrameworkEdge } from './edges';
import { FrameworkNode, PathNode, LoopNode } from './nodes';
import { FrameworkScreen } from './screen';

export type ExperimentFlow = {
  nodes: FrameworkNode[];
  edges: FrameworkEdge[];
  screens?: FrameworkScreen[];
};

type IterativeItem = { value: any; index: number };
type ScreenData = Record<string, any> & {
  foreachData?: { [foreachId: string]: IterativeItem };
  shuffledOptions?: { [dataKey: string]: Array<Option> };
};

export type TimingEntry = { enteredAt: string; submittedAt: string };

export type Context = Partial<{
  start: { group: string };
  checkpoints: { [checkpointName: string]: string };
  data: Record<string, any>;
  // In the store this only holds foreachData from the engine.
  // RenderComponent merges live form values (form.watch()) into this key at render time
  // so that $ prefix references ({{$fieldName}}) resolve correctly inside components
  // without requiring a separate key in resolveValuesInString / getValue / conditions.
  screenData: ScreenData;
  branches: Record<string, string>;
  forks: Record<string, string>;
  paths: { [pathNodeId: string]: { order: string[] } };
  loops: { [loopNodeId: string]: { order: string[] } };
  loopData: { [loopNodeId: string]: IterativeItem };
  timings: Record<string, Partial<TimingEntry>>;
}>;

export type InitialState = { type: 'initial' };
export type InNodeState = {
  type: 'in-node';
  node: Exclude<FrameworkNode, PathNode | LoopNode>;
};
export type InPathState = {
  type: 'in-path';
  node: PathNode;
  children: FrameworkNode[];
  step: number;
  innerState: State;
};
export type InLoopState = {
  type: 'in-loop';
  node: LoopNode;
  values: string[];
  template: FrameworkNode;
  index: number;
  innerState: State;
};
export type EndState = { type: 'end' };

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
