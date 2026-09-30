'use client';
import type {
  Condition,
  Operator,
  SimpleCondition,
} from '@experiment-hub/engine/conditions';
import { useId } from 'react';

const OPERATORS: { value: Operator; label: string }[] = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'contains', label: 'contains' },
  { value: 'length-eq', label: 'count =' },
  { value: 'length-neq', label: 'count ≠' },
  { value: 'length-lt', label: 'count <' },
  { value: 'length-lte', label: 'count ≤' },
  { value: 'length-gt', label: 'count >' },
  { value: 'length-gte', label: 'count ≥' },
];

const newSimple = (): SimpleCondition => ({
  type: 'simple',
  dataKey: '$$' as SimpleCondition['dataKey'],
  operator: 'eq',
  value: '',
});

/** Coerce the input text into a Condition value (number/boolean/string). */
const parseValue = (s: string): string | number | boolean =>
  s === 'true'
    ? true
    : s === 'false'
      ? false
      : s !== '' && !Number.isNaN(Number(s))
        ? Number(s)
        : s;

const displayValue = (v: string | number | boolean): string => String(v);

const kindOf = (c: Condition): 'simple' | 'and' | 'or' | 'not' => c.type;

/** Rebuild a condition node as another shape, keeping as much as possible. */
function convert(c: Condition, to: 'simple' | 'and' | 'or' | 'not'): Condition {
  if (kindOf(c) === to) return c;
  switch (to) {
    case 'simple':
      return newSimple();
    case 'not':
      return { type: 'not', condition: c.type === 'not' ? c.condition : c };
    case 'and':
    case 'or': {
      const children =
        c.type === to
          ? c.conditions
          : c.type === 'not'
            ? [c.condition]
            : [c, newSimple()];
      return { type: to, conditions: children.length ? children : [newSimple()] };
    }
  }
}

type Props = {
  condition: Condition;
  refs: string[];
  onChange: (c: Condition) => void;
  onRemove?: () => void;
  depth?: number;
};

const inputClass =
  'border-border-default bg-background text-content-primary min-w-0 rounded border px-1.5 py-0.5 font-mono text-xxs';
const selectClass =
  'border-border-default bg-background text-content-primary rounded border px-1 py-0.5 text-xxs';

export default function ConditionEditor({
  condition,
  refs,
  onChange,
  onRemove,
  depth = 0,
}: Props) {
  const listId = useId();

  const kindSelect = (
    <select
      className={selectClass}
      value={kindOf(condition)}
      onChange={(e) =>
        onChange(convert(condition, e.target.value as 'simple' | 'and' | 'or' | 'not'))
      }
      aria-label="Condition kind"
    >
      <option value="simple">if</option>
      <option value="and">all of</option>
      <option value="or">any of</option>
      <option value="not">not</option>
    </select>
  );

  if (condition.type === 'simple') {
    return (
      <div className="flex items-center gap-1">
        {kindSelect}
        <input
          list={listId}
          className={`${inputClass} w-28`}
          value={condition.dataKey}
          onChange={(e) =>
            onChange({
              ...condition,
              dataKey: e.target.value as SimpleCondition['dataKey'],
            })
          }
          placeholder="$$screen.field"
        />
        <datalist id={listId}>
          {refs.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <select
          className={selectClass}
          value={condition.operator}
          onChange={(e) =>
            onChange({ ...condition, operator: e.target.value as Operator })
          }
        >
          {OPERATORS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          className={`${inputClass} w-14`}
          value={displayValue(condition.value)}
          onChange={(e) =>
            onChange({ ...condition, value: parseValue(e.target.value) })
          }
          placeholder="value"
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove condition"
            className="text-content-secondary hover:text-error cursor-pointer text-xs"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  if (condition.type === 'not') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          {kindSelect}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove group"
              className="text-content-secondary hover:text-error ml-auto cursor-pointer text-xs"
            >
              ×
            </button>
          )}
        </div>
        <div className="border-border-default ml-1 border-l-2 pl-2">
          <ConditionEditor
            condition={condition.condition}
            refs={refs}
            depth={depth + 1}
            onChange={(c) => onChange({ ...condition, condition: c })}
          />
        </div>
      </div>
    );
  }

  // and / or
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        {kindSelect}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove group"
            className="text-content-secondary hover:text-error ml-auto cursor-pointer text-xs"
          >
            ×
          </button>
        )}
      </div>
      <div className="border-border-default ml-1 flex flex-col gap-1 border-l-2 pl-2">
        {condition.conditions.map((child, i) => (
          <ConditionEditor
            key={i}
            condition={child}
            refs={refs}
            depth={depth + 1}
            onChange={(c) =>
              onChange({
                ...condition,
                conditions: condition.conditions.map((x, j) =>
                  j === i ? c : x,
                ),
              })
            }
            onRemove={
              condition.conditions.length > 1
                ? () =>
                    onChange({
                      ...condition,
                      conditions: condition.conditions.filter(
                        (_, j) => j !== i,
                      ),
                    })
                : undefined
            }
          />
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...condition,
              conditions: [...condition.conditions, newSimple()],
            })
          }
          className="border-border-default text-content-secondary hover:text-content-primary w-fit cursor-pointer rounded-md border border-dashed px-1.5 py-px text-xxs"
        >
          + row
        </button>
      </div>
    </div>
  );
}
