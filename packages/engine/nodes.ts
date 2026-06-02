import { Condition } from './conditions';
import { DataPrefix, ScreenPrefix } from './tokens';

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

/**
 * Entry point of the experiment flow — the first node executed on a run.
 * Most experiments have a single start node. To support multiple entry points
 * selected by URL query string, give each start node `props.name` (the group
 * name) and `props.param` (`{ key, value }`); the runner picks the start node
 * whose `param` matches the incoming query param (e.g. `?condition=A` →
 * `param: { key: 'condition', value: 'A' }`). Auto-traversed (no participant UI).
 */
export interface StartNode extends BaseNode {
  type: 'start';
  props?: {
    name: string;
    param: { key: string; value: string };
  };
}

/**
 * Persists the run's data collected up to this point (via `send()` in
 * `lib/utils.ts`), so partial data survives if a participant abandons the study.
 * `props.name` identifies the checkpoint. Auto-traversed (no participant UI).
 */
export interface CheckpointNode extends BaseNode {
  type: 'checkpoint';
  props: {
    name: string;
  };
}

/**
 * Renders a screen to the participant. `props.slug` references a screen defined
 * in the experiment's `screens` array; that screen's components are rendered in
 * order. Advancing submits the screen's form data into context.
 */
export interface ScreenNode extends BaseNode {
  type: 'screen';
  props: {
    slug: string;
  };
}

/**
 * One arm of a `branch` node. `config` is the `Condition` under which this arm
 * is taken; `id`/`name` identify it (`description` is optional).
 */
export type Branch = {
  id: string;
  name: string;
  description?: string;
  config: Condition;
};

/**
 * Conditional split. Each entry in `props.branches` carries a `Condition`; the
 * runner takes the first branch (by edge order) whose condition is true. The
 * `config` accepts the full composable `Condition` type and `$$`/`@`/`$`
 * references. Reconvergence is not enforced — the downstream nodes decide the
 * flow after the branch, not the branch node. Auto-traversed (no participant UI).
 */
export interface BranchNode extends BaseNode {
  type: 'branch';
  props: {
    name: string;
    description?: string;
    branches: Branch[];
  };
}

/**
 * Progress-stepper shown at the top of screens inside a `path` or `loop`.
 * `style` picks the visual treatment; `label` is optional text in which
 * `{index}` and `{total}` are substituted with the current step and total step
 * count. (Note: this `{ }` substitution differs from answer piping's `{{ }}` —
 * see docs/nodes.md.)
 */
export type StepperConfig = { label?: string; style: 'continuous' | 'dashed' };

/**
 * A fixed sequence of nodes traversed in order. `props.name` identifies it;
 * `randomized` shuffles the contained steps once on entry; `stepper` configures
 * an optional progress indicator. Only `name` is required.
 */
export interface PathNode extends BaseNode {
  type: 'path';
  props: {
    name: string;
    description?: string;
    randomized?: boolean;
    stepper?: StepperConfig;
  };
}

/**
 * One outcome of a `fork` node. `weight` sets its relative probability (the
 * runner normalizes weights across all forks); `id`/`name` identify it
 * (`description` is optional).
 */
export type Fork = {
  id: string;
  name: string;
  description?: string;
  weight?: number;
};

/**
 * Random split. The runner picks one entry from `props.forks` weighted by each
 * fork's `weight`. Flow afterward is determined by `fork-edge`s, not sequential
 * edges. Auto-traversed (no participant UI).
 */
export interface ForkNode extends BaseNode {
  type: 'fork';
  props: {
    name: string;
    description?: string;
    forks: Fork[];
  };
}

/**
 * Repeats its contained nodes once per item. A `static` loop lists its `values`
 * inline; a `dynamic` loop resolves them at runtime from a `$$`-prefixed
 * `dataKey` (an array collected earlier, e.g. via `sample`/`split`). Items may
 * be strings or objects. `randomized` shuffles the items once on entry (the
 * resulting order is published to `context.loops[loopId].order`); `stepper`
 * adds an optional progress indicator. Per-iteration data nests under
 * `context.data.<loopId>.<iterKey>` — see `itemKey` for how the key is chosen.
 */
export interface LoopNode extends BaseNode {
  type: 'loop';
  props: (
    | { type: 'static'; values: (string | Record<string, unknown>)[] }
    | { type: 'dynamic'; dataKey: `${DataPrefix}${string}` }
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

/**
 * A data reference accepted as a formula input: either `$$`-prefixed (a value
 * collected earlier in the experiment, e.g. `$$screenSlug.field`) or
 * `$`-prefixed (an output of the current compute node). See docs/data-keys.md
 * for the full prefix list.
 */
export type FormulaInput = `${DataPrefix | ScreenPrefix}${string}`;

/**
 * Sums the numeric values of every input. Each input is coerced with
 * `Number(...)`; anything non-numeric or missing contributes 0. Empty `inputs`
 * yields 0.
 */
export type SumFormula = { type: 'sum'; inputs: FormulaInput[] };
/**
 * Arithmetic mean of the inputs. Each input is coerced with `Number(...)`
 * (non-numeric/missing → 0, and still counts toward the denominator). Empty
 * `inputs` yields 0.
 */
export type MeanFormula = { type: 'mean'; inputs: FormulaInput[] };
/**
 * Smallest of the inputs (`Math.min`). Each input is coerced with `Number(...)`;
 * non-numeric/missing values become 0, so they can pull the result down. Empty
 * `inputs` yields 0.
 */
export type MinFormula = { type: 'min'; inputs: FormulaInput[] };
/**
 * Largest of the inputs (`Math.max`). Each input is coerced with `Number(...)`;
 * non-numeric/missing values become 0. Empty `inputs` yields 0.
 */
export type MaxFormula = { type: 'max'; inputs: FormulaInput[] };
/**
 * Counts how many inputs qualify.
 *
 * An input qualifies when it is *present* — not `null`/`undefined` and not the
 * empty string (so `0` and `false` are counted). With a `where` predicate, each
 * present input is additionally tested and only matching ones are counted; the
 * value under test is exposed to the condition as `@current`, e.g. count inputs
 * `>= 3` with `where: { type: 'simple', operator: 'gte', dataKey: '@current', value: 3 }`.
 */
export type CountFormula = {
  type: 'count';
  inputs: FormulaInput[];
  /**
   * Optional per-input predicate; only inputs satisfying it are counted. The
   * input under test is referenced as `@current`. Omit to count every present
   * input.
   */
  where?: Condition;
};
/**
 * Branches on a condition: returns `then` when `condition` holds, else `else`.
 * The condition is evaluated against the full context with this compute node's
 * prior outputs merged in (so `$` references to earlier outputs resolve).
 */
export type ConditionalFormula = {
  type: 'conditional';
  condition: Condition;
  then: string | number | boolean;
  else: string | number | boolean;
};
/**
 * Threshold / banding lookup. Coerces `input` to a number and returns the `then`
 * of the highest `when` entry that the value reaches (the matching band of a
 * `value >= when` scale). `table` order does not matter — entries are sorted by
 * `when` descending internally. Falls back to `default` when the value is below
 * every threshold. Useful for mapping a score onto a label/grade.
 */
export type LookupFormula = {
  type: 'lookup';
  input: FormulaInput;
  table: Array<{ when: number; then: string | number }>;
  default?: string | number;
};

/**
 * Randomly samples up to `n` items from `input` (a `$$`/`$` reference to a
 * context array, or an inline array). The pool is shuffled and the first `n`
 * taken, so `n` larger than the pool returns the whole pool shuffled. A
 * non-array `input` yields `[]`. Commonly composed upstream of a dynamic loop
 * or a `split` formula to randomize before paginating.
 */
export type SampleFormula = {
  type: 'sample';
  input: FormulaInput | any[];
  n: number;
};

/**
 * Splits a list into bins, so a dynamic loop can present a questionnaire across
 * several screens (one bin per screen). The output is an array of bins (each bin
 * an array of the original items), stored under the compute node id (for example,
 * `data.pages.bins`) and readable as `$$pages.bins`. Order is preserved — compose `sample` upstream to randomize.
 *
 * The mode is selected by `mode`, with `n` the bin count or bin size:
 *   - `mode: 'into'` — exactly `n` bins. base = floor(len/n) per bin; the LAST
 *                  bin absorbs the remainder (n=3 over 10 → [3,3,4]). When n > len
 *                  at runtime, empty bins are dropped (n=3 over 2 → [[a],[b]]); the
 *                  inline-array case is rejected by validation instead.
 *   - `mode: 'size'` — bins of `n` items; the final bin holds the remainder
 *                  (n=3 over 10 → [3,3,3,1]).
 */
export type SplitFormula = {
  type: 'split';
  input: FormulaInput | any[];
  mode: 'into' | 'size';
  n: number;
};

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

/**
 * Flattens a loop's per-iteration responses into a single object, so a
 * paginated questionnaire (split across loop screens) can be scored without
 * knowing which iteration each field landed in.
 *
 * Iteration data lives at `data[...dataPath][loopId][iterKey][screenSlug][field]`.
 * For each iteration (read from `context.loops[loopId].order`), the responses
 * under `screen` are merged into one flat object keyed by field name:
 *   collect-loop(loopId, screen) → { <field>: <value>, ... }
 *
 * With `screen` omitted, each iteration's full data object is merged instead
 * (keeping the screen-slug level). On a key collision the last iteration wins;
 * a `split`-paginated questionnaire never collides because each field appears
 * in exactly one iteration.
 *
 * The result is stored under the compute node's outputKey and read downstream
 * via `$$<computeId>.<outputKey>.<field>` — e.g. a `sum` over a category's
 * fields. (It can't be summed in the same node: a node's outputs aren't in
 * `context.data` until every computation has run.)
 */
export type CollectLoopFormula = {
  type: 'collect-loop';
  /** ID of the loop node whose iteration responses are flattened */
  loopId: string;
  /** Screen slug to scope to; omit to merge each iteration's whole data object */
  screen?: string;
  /** Optional list of field keys to omit from the collected output
   * (e.g. to exclude non-response fields like timestamps or
   * iteration-specific metadata) */
  omitKeys?: string[];
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
  | LoopAggregateFormula
  | CollectLoopFormula;

/**
 * A single named output of a compute node: `formula` is evaluated and its result
 * stored under `outputKey`, readable downstream as `$$<computeId>.<outputKey>`.
 */
export type Computation = {
  outputKey: string;
  formula: Formula;
};

/**
 * Derives values from already-collected data. Runs each entry in
 * `props.computations` and writes the results into context under the node id. A
 * node's own outputs are not visible to its sibling computations until the node
 * finishes, so chained derivations need separate compute nodes. Auto-traversed
 * (no participant UI).
 */
export interface ComputeNode extends BaseNode {
  type: 'compute';
  props: {
    name: string;
    description?: string;
    computations: Computation[];
  };
}

/** Terminates the flow. Auto-traversed; has no props and no participant UI. */
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
