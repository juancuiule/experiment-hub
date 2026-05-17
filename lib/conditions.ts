import { getValue, resolveValuesInString } from './resolve';
import { Context } from './types';

export type BaseOperator = 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq';

export type ArrayOperator = 'contains' | `length-${BaseOperator}`;

export type Operator = BaseOperator | ArrayOperator;

export type SimpleCondition = {
  type: 'simple';
  operator: Operator;
  dataKey: `$$${string}` | `@${string}` | `$${string}`;
  value: string | number | boolean;
};

export type CompoundCondition =
  | { type: 'and'; conditions: Condition[] }
  | { type: 'or'; conditions: Condition[] }
  | { type: 'not'; condition: Condition };

export type Condition = SimpleCondition | CompoundCondition;

function evaluateBaseOperator(op: BaseOperator, a: any, b: any): boolean {
  switch (op) {
    case 'eq':
      return a == b;
    case 'neq':
      return a != b;
    case 'lt':
      return Number(a) < Number(b);
    case 'lte':
      return Number(a) <= Number(b);
    case 'gt':
      return Number(a) > Number(b);
    case 'gte':
      return Number(a) >= Number(b);
  }
}

export function isBaseOperator(operator: Operator): operator is BaseOperator {
  return ['lt', 'lte', 'gt', 'gte', 'eq', 'neq'].includes(operator);
}

// Resolves {{...}} interpolations in dataKeys within a condition tree before evaluation
export function resolveCondition(
  condition: Condition,
  context: Context,
): Condition {
  if (condition.type === 'simple') {
    return {
      ...condition,
      dataKey: resolveValuesInString(
        condition.dataKey,
        context,
      ) as SimpleCondition['dataKey'],
    };
  }
  if (condition.type === 'and' || condition.type === 'or') {
    return {
      ...condition,
      conditions: condition.conditions.map((c) => resolveCondition(c, context)),
    };
  }
  if (condition.type === 'not') {
    return {
      ...condition,
      condition: resolveCondition(condition.condition, context),
    };
  }
  return condition;
}

export function evaluateCondition(
  condition: Condition,
  context: Context,
): boolean {
  if (condition.type === 'simple') {
    const value = getValue(condition.dataKey, context);

    if (condition.operator === 'contains') {
      return Array.isArray(value) && value.includes(condition.value);
    }

    if (condition.operator.startsWith('length-')) {
      const op = condition.operator.slice('length-'.length) as BaseOperator;
      const len = Array.isArray(value)
        ? value.length
        : String(value ?? '').length;
      return evaluateBaseOperator(op, len, Number(condition.value));
    }

    if (isBaseOperator(condition.operator)) {
      if (value === undefined) return false;
      return evaluateBaseOperator(condition.operator, value, condition.value);
    }

    return false;
  }

  if (condition.type === 'and') {
    return condition.conditions.every((c) => evaluateCondition(c, context));
  }

  if (condition.type === 'or') {
    return condition.conditions.some((c) => evaluateCondition(c, context));
  }

  if (condition.type === 'not') {
    return !evaluateCondition(condition.condition, context);
  }

  return false;
}
