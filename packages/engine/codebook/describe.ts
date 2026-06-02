import { Condition, Operator } from '../conditions';
import {
  Option,
  OptionsSource,
  ResponseComponent,
} from '../components/response';
import { FieldType, OptionsRef } from './types';

// Metadata view of a response component — the codebook counterpart to the Zod
// schema built in field-schema.ts. Types, options and constraints are read
// straight from props; labels are kept raw (interpolation tokens left visible).
export type FieldDescriptor = {
  type: FieldType;
  label?: string;
  required: boolean;
  options?: Option[] | OptionsRef;
  constraints?: Record<string, unknown>;
};

// Drops undefined entries so constraints only carry what's actually set.
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  );
}

function withConstraints(
  base: FieldDescriptor,
  constraints: Record<string, unknown>,
): FieldDescriptor {
  const compacted = compact(constraints);
  return Object.keys(compacted).length > 0
    ? { ...base, constraints: compacted }
    : base;
}

// Inline Option[] becomes {value,label}[]; a reference source becomes {ref}.
function describeOptions(options: OptionsSource): Option[] | OptionsRef {
  if (Array.isArray(options)) {
    return options.map((o) => ({ value: o.value, label: o.label }) as Option);
  }
  return { ref: options };
}

export function describeField(component: ResponseComponent): FieldDescriptor {
  const props = component.props as Record<string, any>;
  const required = props.required ?? true;
  const label = typeof props.label === 'string' ? props.label : undefined;
  const base: FieldDescriptor = { type: 'unknown', label, required };

  switch (component.template) {
    case 'text-input':
    case 'text-area':
      return withConstraints({ ...base, type: 'string' }, {
        minLength: props.minLength?.value,
        maxLength: props.maxLength?.value,
        pattern: props.pattern?.value,
      });

    case 'date-input':
      return { ...base, type: 'date' };
    case 'time-input':
      return { ...base, type: 'time' };

    case 'radio':
    case 'dropdown':
      return { ...base, type: 'enum', options: describeOptions(props.options) };

    case 'likert-scale':
      return {
        ...base,
        type: 'enum',
        options: describeOptions(props.options),
      };

    case 'checkboxes':
      return withConstraints(
        { ...base, type: 'enum[]', options: describeOptions(props.options) },
        { minSelect: props.min, maxSelect: props.max },
      );

    case 'numeric-input':
      return withConstraints({ ...base, type: 'number' }, {
        min: props.min,
        max: props.max,
        step: props.step,
      });

    case 'slider':
      return withConstraints({ ...base, type: 'number' }, {
        min: props.min,
        max: props.max,
        minValue: props.minValue?.value,
        maxValue: props.maxValue?.value,
      });

    case 'single-checkbox':
      return withConstraints({ ...base, type: 'boolean' }, {
        shouldBe: props.shouldBe,
      });

    default:
      return base;
  }
}

const OPERATOR_TEXT: Record<Operator, string> = {
  eq: '=',
  neq: '≠',
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
  contains: 'contains',
  'length-eq': 'length =',
  'length-neq': 'length ≠',
  'length-lt': 'length <',
  'length-lte': 'length ≤',
  'length-gt': 'length >',
  'length-gte': 'length ≥',
};

// Renders a Condition AST as a compact human-readable string for the codebook's
// "collected only when …" column.
export function conditionToText(condition: Condition): string {
  if (condition.type === 'simple') {
    const { dataKey, operator, value } = condition;
    if (operator.startsWith('length-')) {
      const symbol = OPERATOR_TEXT[operator].replace('length ', '');
      return `length(${dataKey}) ${symbol} ${value}`;
    }
    return `${dataKey} ${OPERATOR_TEXT[operator]} ${value}`;
  }
  if (condition.type === 'not') {
    return `NOT (${conditionToText(condition.condition)})`;
  }
  const joiner = condition.type === 'and' ? ' AND ' : ' OR ';
  return `(${condition.conditions.map(conditionToText).join(joiner)})`;
}
