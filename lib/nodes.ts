import { Condition } from './conditions';

export type NodeType =
  | 'start'
  | 'screen'
  | 'branch'
  | 'path'
  | 'fork'
  | 'loop'
  | 'checkpoint'
  | 'compute';

interface BaseNode {
  id: string;
  type: NodeType;
}

export interface StartNode extends BaseNode {
  type: 'start';
  props?: {
    name: string;
    param: { key: string; value: string };
  };
}

export interface CheckpointNode extends BaseNode {
  type: 'checkpoint';
  props: {
    name: string;
  };
}

export interface ScreenNode extends BaseNode {
  type: 'screen';
  props: {
    slug: string;
  };
}

export type Branch = {
  id: string;
  name: string;
  description?: string;
  config: Condition;
};

export interface BranchNode extends BaseNode {
  type: 'branch';
  props: {
    name: string;
    description?: string;
    branches: Branch[];
  };
}

export type StepperConfig = { label?: string; style: 'continuous' | 'dashed' };

export interface PathNode extends BaseNode {
  type: 'path';
  props: {
    name: string;
    description?: string;
    randomized?: boolean;
    stepper?: StepperConfig;
  };
}

export type Fork = {
  id: string;
  name: string;
  description?: string;
  weight?: number;
};

export interface ForkNode extends BaseNode {
  type: 'fork';
  props: {
    name: string;
    description?: string;
    forks: Fork[];
  };
}

export interface LoopNode extends BaseNode {
  type: 'loop';
  props: (
    | { type: 'static'; values: string[] }
    | { type: 'dynamic'; dataKey: `$$${string}` }
  ) & { stepper?: StepperConfig };
}

export type FormulaInput = `$$${string}` | `$${string}`;

export type SumFormula = { type: 'sum'; inputs: FormulaInput[] };
export type MeanFormula = { type: 'mean'; inputs: FormulaInput[] };
export type MinFormula = { type: 'min'; inputs: FormulaInput[] };
export type MaxFormula = { type: 'max'; inputs: FormulaInput[] };
export type CountFormula = {
  type: 'count';
  inputs: FormulaInput[];
  where?: Condition;
};
export type ConditionalFormula = {
  type: 'conditional';
  condition: Condition;
  then: string | number | boolean;
  else: string | number | boolean;
};
export type LookupFormula = {
  type: 'lookup';
  input: FormulaInput;
  table: Array<{ when: number; then: string | number }>;
  default?: string | number;
};

export type SampleFormula = {
  type: 'sample';
  input: FormulaInput | (string | Record<string, unknown>)[];
  n: number;
};

/**
 * Counts how many loop iterations had the correct answer.
 * Requires the loop to iterate over object-valued items (not plain strings).
 * Object loops use 1-based string indices as iteration keys in context.data.
 */
export type CountCorrectFormula = {
  type: 'count-correct';
  /** $$ reference to the ordered array of sampled item objects (e.g. '$$pick.items') */
  itemsKey: `$$${string}`;
  /** ID of the loop node whose iteration data holds the answers */
  loopId: string;
  /** Slug of the screen inside the loop that collected the answer field */
  screenSlug: string;
  /** Form field key used for the participant's answer (dataKey on the response component) */
  answerKey: string;
  /** Property name on each item object that holds the correct answer */
  correctKey: string;
};

export type Formula =
  | SumFormula
  | MeanFormula
  | MinFormula
  | MaxFormula
  | CountFormula
  | ConditionalFormula
  | LookupFormula
  | SampleFormula
  | CountCorrectFormula;

export type Computation = {
  outputKey: string;
  formula: Formula;
};

export interface ComputeNode extends BaseNode {
  type: 'compute';
  props: {
    name: string;
    description?: string;
    computations: Computation[];
  };
}

export type FrameworkNode =
  | StartNode
  | CheckpointNode
  | ScreenNode
  | BranchNode
  | PathNode
  | ForkNode
  | LoopNode
  | ComputeNode;

const AUTO_TRAVERSE_TYPES = [
  'start',
  'checkpoint',
  'branch',
  'fork',
  'compute',
] as const;
type AutoTraverseNodeType = (typeof AUTO_TRAVERSE_TYPES)[number];

export function isAutoTraverseNode(
  node: FrameworkNode,
): node is Extract<FrameworkNode, { type: AutoTraverseNodeType }> {
  return (AUTO_TRAVERSE_TYPES as readonly string[]).includes(node.type);
}
