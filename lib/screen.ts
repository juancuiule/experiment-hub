import { ScreenComponent } from './components';
import { Condition } from './conditions';

export type FieldRef = `$${string}` | `$$${string}`;

type CrossFieldRuleBase = {
  errorMessage?: string;
  attachTo?: `$${string}`;
};

export type SumEqualsRule = CrossFieldRuleBase & {
  type: 'sum-equals';
  fields: FieldRef[];
  target: number;
};

export type SumBetweenRule = CrossFieldRuleBase & {
  type: 'sum-between';
  fields: FieldRef[];
  min?: number;
  max?: number;
};

export type AtLeastOneRule = CrossFieldRuleBase & {
  type: 'at-least-one';
  fields: FieldRef[];
};

export type CountBetweenRule = CrossFieldRuleBase & {
  type: 'count-between';
  fields: FieldRef[];
  min?: number;
  max?: number;
};

export type ExactlyNRule = CrossFieldRuleBase & {
  type: 'exactly-n';
  fields: FieldRef[];
  n: number;
};

export type MutuallyExclusiveRule = CrossFieldRuleBase & {
  type: 'mutually-exclusive';
  fields: FieldRef[];
};

export type AllOrNoneRule = CrossFieldRuleBase & {
  type: 'all-or-none';
  fields: FieldRef[];
};

export type MatchesRule = CrossFieldRuleBase & {
  type: 'matches';
  a: FieldRef;
  b: FieldRef;
};

export type OrderedRule = CrossFieldRuleBase & {
  type: 'ordered';
  a: FieldRef;
  b: FieldRef;
  operator: 'lt' | 'lte';
};

export type ConditionalRangeRule = CrossFieldRuleBase & {
  type: 'conditional-range';
  field: FieldRef;
  condition: Condition;
  min?: number;
  max?: number;
};

export type UniqueAcrossForeachRule = CrossFieldRuleBase & {
  type: 'unique-across-foreach';
  foreachId: string;
  dataKeyPattern: string;
};

export type CrossFieldRule =
  | SumEqualsRule
  | SumBetweenRule
  | AtLeastOneRule
  | CountBetweenRule
  | ExactlyNRule
  | MutuallyExclusiveRule
  | AllOrNoneRule
  | MatchesRule
  | OrderedRule
  | ConditionalRangeRule
  | UniqueAcrossForeachRule;

export type FrameworkScreen = {
  slug: string;
  components: ScreenComponent[];
  validate?: CrossFieldRule[];
};
