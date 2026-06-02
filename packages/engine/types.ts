import { Option } from './components/response';
import { FrameworkEdge } from './edges';
import { FrameworkNode, PathNode, LoopNode } from './nodes';
import { FrameworkScreen } from './screen';

// A tree of localized messages. Leaves are message strings; branches nest
// further keys. Addressed by [[dotted.key]] tokens, e.g. { welcome: { title } }
// is referenced as [[welcome.title]]. Flat dotted keys are also allowed and may
// be mixed with nesting.
export type MessageTree = { [key: string]: string | MessageTree };

// i18n dictionary: locale → message tree.
// e.g. { en: { welcome: { title: "Hello" } }, es: { welcome: { title: "Hola" } } }.
// Messages may themselves contain {{ }} answer-piping and nested [[ ]] references.
export type Dictionary = Record<string, MessageTree>;

export type ExperimentFlow = {
  nodes: FrameworkNode[];
  edges: FrameworkEdge[];
  screens?: FrameworkScreen[];
  options?: Record<string, Option[]>;
  // Localized message sets keyed by locale. Referenced via [[key]] tokens.
  dictionary?: Dictionary;
  // Locale used when the ?lang= param is absent or invalid, and the source of
  // fallback messages for keys missing in the active locale. Must be a key of
  // `dictionary` when a dictionary is present.
  defaultLocale?: string;
};

type IterativeItem = { value: any; index: number };
type ScreenData = Record<string, any> & {
  foreachData?: { [foreachId: string]: IterativeItem };
  shuffledOptions?: { [dataKey: string]: Array<Option> };
  shuffledForeachOrders?: { [foreachId: string]: string[] };
};

export type TimingEntry = { enteredAt: string; submittedAt: string };

export type ContextData = Record<string, any>;

export type Context = Partial<{
  start: { group: string };
  checkpoints: { [checkpointName: string]: string };
  data: ContextData;
  // In the store this only holds foreachData from the engine.
  // RenderComponent merges live form values (form.watch()) into this key at render time
  // so that $ prefix references ({{$fieldName}}) resolve correctly inside components
  // without requiring a separate key in resolveValuesInString / getValue / conditions.
  screenData: ScreenData;
  branches: Record<string, string>;
  forks: Record<string, string>;
  paths: { [pathNodeId: string]: { order: string[] } };
  loops: {
    [loopNodeId: string]: {
      order: string[];
      // Resolved iteration values aligned 1:1 with `order` (post-shuffle for
      // randomized loops). Lets loop-aggregate recover each iteration's item
      // without re-resolving the loop source or reconstructing keys.
      values: (string | Record<string, unknown>)[];
    };
  };
  loopData: { [loopNodeId: string]: IterativeItem };
  timings: Record<string, Partial<TimingEntry>>;
  // Active locale selected for this run (e.g. "es"). Informational; resolution
  // reads `messages`, which already has default-locale fallback merged in.
  locale: string;
  // Flattened messages for the active locale with default-locale fallback
  // merged underneath. Consumed by [[key]] resolution in resolveValuesInString.
  messages: Record<string, string>;
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
  visibleStep: number;
  visibleTotal: number;
  visibleBranchContributions: Record<string, number>;
};
export type InLoopState = {
  type: 'in-loop';
  node: LoopNode;
  values: (string | Record<string, unknown>)[];
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

export type FlowHandlers = {
  onCheckpoint?: (context: Context, name: string) => Promise<void>;
};

// This is a step in the traversal process.
export type FlowStep<S extends State = State> = {
  state: S; // current state in the traversal
  experiment: ExperimentFlow; // the experiment flow being traversed
  context: Context;
  dataPath?: string[]; // nesting path for screen data writes (e.g. ["path-regressors"])
  handlers?: FlowHandlers;
};
