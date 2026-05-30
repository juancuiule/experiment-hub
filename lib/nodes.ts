import { Condition } from './conditions';

export type NodeType =
  | 'start'
  | 'screen'
  | 'branch'
  | 'path'
  | 'fork'
  | 'loop'
  | 'checkpoint'
  | 'compute'
  | 'end';

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
    | { type: 'static'; values: (string | Record<string, unknown>)[] }
    | { type: 'dynamic'; dataKey: `$$${string}` }
  ) & {
    stepper?: StepperConfig;
    randomized?: boolean;
    /**
     * Property name to use as the iteration key for object-valued items.
     * When set and an item is an object, data lands at
     * context.data.<loopId>.<String(item[itemKey])> instead of the 1-based index.
     * No-op for plain-string items. Falls back to the 1-based index when the
     * property is missing at runtime (dynamic loops) — static loops are validated.
     */
    itemKey?: string;
  };
}

export type FormulaInput = `$$${string}` | `$${string}`;

export type SumFormula = { type: 'sum'; inputs: FormulaInput[] };
export type MeanFormula = { type: 'mean'; inputs: FormulaInput[] };
export type MinFormula = { type: 'min'; inputs: FormulaInput[] };
export type MaxFormula = { type: 'max'; inputs: FormulaInput[] };
export type CountFormula = {
  type: 'count';
  inputs: FormulaInput[];
  // Optional condition to count only inputs that satisfy a
  // certain condition (e.g. count how many inputs are greater than 5)
  // If no condition is provided, it will simply count the number of inputs
  // that are truthy (non-zero for numbers, non-empty for strings, true for booleans)
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
 * Splits a list into bins, so a dynamic loop can present a questionnaire across
 * several screens (one bin per screen). The output is an array of bins (each bin
 * an array of the original items), stored under the compute node id (for example,
 * `data.pages.bins`) and readable as `$$pages.bins`. Order is preserved — compose `sample` upstream to randomize.
 *
 * Two modes, discriminated:
 *   - `into: N`  — exactly N bins. base = floor(len/N) per bin; the LAST bin
 *                  absorbs the remainder (10 into 3 → [3,3,4]). When N > len at
 *                  runtime, empty bins are dropped (2 into 3 → [[a],[b]]); the
 *                  inline-array case is rejected by validation instead.
 *   - `size: N`  — bins of N items; the final bin holds the remainder
 *                  (10 size 3 → [3,3,3,1]).
 */
export type SplitFormula = {
  type: 'split';
  input: FormulaInput | (string | Record<string, unknown>)[];
} & ({ into: number } | { size: number });

/**
 * Aggregates a value across the iterations of a loop.
 *
 * Iterations are read from `context.loops[loopId].order` — the canonical,
 * already-resolved iteration keys produced by the loop itself — so this never
 * reconstructs keys and works uniformly for static/dynamic loops, plain-string
 * and object items, and itemKey'd loops.
 *
 * Per iteration the predicate (`where`) and aggregated `field` are evaluated
 * against a context where the aggregated loop's current iteration is exposed
 * under its own id, `@<loopId>`:
 *   - `@<loopId>.value[.prop]`        — the loop item object/value
 *   - `@<loopId>.index`               — the 0-based iteration index
 *   - `@<loopId>.<screenSlug>.<field>`— a response collected that iteration
 *
 * `$` keeps its normal meaning (this compute node's prior outputs); `value`
 * and `index` are reserved keys on `@<loopId>`, so a screen slug may not be
 * named `value` or `index`.
 *
 * The item is recovered from `context.loops[loopId].values` (aligned with
 * `order`), so scoring stays correct even when the loop is `randomized`, and
 * the iteration responses are read through the compute node's dataPath, so it
 * works for loops nested inside paths.
 *
 * Subsumes the former `count-correct`: scoring is `op: 'count'` with
 *   `where: @<loopId>.<screen>.answer == @<loopId>.value.correctAnswer`.
 */
export type LoopAggregateFormula =
  | {
      type: 'loop-aggregate';
      /** ID of the loop node whose iteration data is aggregated */
      loopId: string;
      /** Aggregation operation */
      op: 'count';
      /**
       * Optional per-iteration predicate. Counts/aggregates only iterations that
       * satisfy it. Both sides may be `@<loopId>` references resolved per iteration.
       */
      where?: Condition;
    }
  | {
      type: 'loop-aggregate';
      /** ID of the loop node whose iteration data is aggregated */
      loopId: string;
      /** Aggregation operation */
      op: 'sum' | 'mean' | 'min' | 'max';
      /**
       * Reference to the per-iteration numeric value to aggregate, e.g.
       * '@loopId.trial.rating'. Required for sum/mean/min/max.
       */
      field: string;
      /**
       * Optional per-iteration predicate. Counts/aggregates only iterations that
       * satisfy it. Both sides may be `@<loopId>` references resolved per iteration.
       */
      where?: Condition;
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
  | SplitFormula
  | LoopAggregateFormula;

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

export interface EndNode extends BaseNode {
  type: 'end';
}

export type FrameworkNode =
  | StartNode
  | CheckpointNode
  | ScreenNode
  | BranchNode
  | PathNode
  | ForkNode
  | LoopNode
  | ComputeNode
  | EndNode;

const AUTO_TRAVERSE_TYPES = [
  'start',
  'checkpoint',
  'branch',
  'fork',
  'compute',
  'end',
] as const;
type AutoTraverseNodeType = (typeof AUTO_TRAVERSE_TYPES)[number];

export function isAutoTraverseNode(
  node: FrameworkNode,
): node is Extract<FrameworkNode, { type: AutoTraverseNodeType }> {
  return (AUTO_TRAVERSE_TYPES as readonly string[]).includes(node.type);
}
