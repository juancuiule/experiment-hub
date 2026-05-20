import { evaluateCondition } from './conditions';
import { getPath } from './resolve';
import { CrossFieldRule } from './screen';
import { Context } from './types';

export type RuleError = { message: string; attachTo?: string };

export function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function resolveFieldRef(
  ref: string,
  formData: Record<string, unknown>,
  contextData: Record<string, any>,
): unknown {
  if (ref.startsWith('$$')) return getPath(ref.slice(2), contextData);
  return formData[ref.slice(1)];
}

export function evaluateCrossFieldRule(
  rule: CrossFieldRule,
  formData: Record<string, unknown>,
  contextData: Record<string, any>,
): RuleError | null {
  const msg = (fallback: string) => rule.errorMessage ?? fallback;
  const attachTo = rule.attachTo?.slice(1);
  const rv = (ref: string) => resolveFieldRef(ref, formData, contextData);

  switch (rule.type) {
    case 'sum-equals': {
      const sum = rule.fields.reduce((acc, f) => acc + (Number(rv(f)) || 0), 0);
      return sum !== rule.target
        ? { message: msg(`Fields must sum to ${rule.target}`), attachTo }
        : null;
    }

    case 'sum-between': {
      const sum = rule.fields.reduce((acc, f) => acc + (Number(rv(f)) || 0), 0);
      if (rule.min !== undefined && sum < rule.min)
        return { message: msg(`Total must be at least ${rule.min}`), attachTo };
      if (rule.max !== undefined && sum > rule.max)
        return { message: msg(`Total must be at most ${rule.max}`), attachTo };
      return null;
    }

    case 'at-least-one': {
      const filled = rule.fields.filter((f) => !isEmpty(rv(f)));
      return filled.length === 0
        ? { message: msg('At least one field must be filled'), attachTo }
        : null;
    }

    case 'count-between': {
      const count = rule.fields.filter((f) => !isEmpty(rv(f))).length;
      if (rule.min !== undefined && count < rule.min)
        return { message: msg(`At least ${rule.min} fields must be filled`), attachTo };
      if (rule.max !== undefined && count > rule.max)
        return { message: msg(`At most ${rule.max} fields may be filled`), attachTo };
      return null;
    }

    case 'exactly-n': {
      const count = rule.fields.filter((f) => !isEmpty(rv(f))).length;
      return count !== rule.n
        ? { message: msg(`Exactly ${rule.n} fields must be filled`), attachTo }
        : null;
    }

    case 'mutually-exclusive': {
      const filled = rule.fields.filter((f) => !isEmpty(rv(f)));
      return filled.length > 1
        ? { message: msg('Only one field may be filled at a time'), attachTo }
        : null;
    }

    case 'all-or-none': {
      const filled = rule.fields.filter((f) => !isEmpty(rv(f)));
      return filled.length > 0 && filled.length < rule.fields.length
        ? { message: msg('Either fill all fields or leave all blank'), attachTo }
        : null;
    }

    case 'matches': {
      const aVal = rv(rule.a);
      const bVal = rv(rule.b);
      return JSON.stringify(aVal) !== JSON.stringify(bVal)
        ? { message: msg('Fields must match'), attachTo }
        : null;
    }

    case 'ordered': {
      const aVal = Number(rv(rule.a));
      const bVal = Number(rv(rule.b));
      const ok = rule.operator === 'lt' ? aVal < bVal : aVal <= bVal;
      return !ok
        ? {
            message: msg(
              rule.operator === 'lt'
                ? 'First value must be less than second'
                : 'First value must be less than or equal to second',
            ),
            attachTo,
          }
        : null;
    }

    case 'conditional-range': {
      const evalCtx: Context = { screenData: formData as any, data: contextData };
      if (!evaluateCondition(rule.condition, evalCtx)) return null;
      const val = Number(rv(rule.field));
      if (rule.min !== undefined && val < rule.min)
        return { message: msg(`Value must be at least ${rule.min}`), attachTo };
      if (rule.max !== undefined && val > rule.max)
        return { message: msg(`Value must be at most ${rule.max}`), attachTo };
      return null;
    }

    case 'unique-across-foreach': {
      const placeholder = `{{#${rule.foreachId}.value}}`;
      const idx = rule.dataKeyPattern.indexOf(placeholder);
      if (idx === -1) return null;
      const prefix = rule.dataKeyPattern.slice(0, idx);
      const suffix = rule.dataKeyPattern.slice(idx + placeholder.length);
      const keys = Object.keys(formData).filter(
        (k) =>
          k.startsWith(prefix) &&
          k.endsWith(suffix) &&
          k.length > prefix.length + suffix.length,
      );
      const vals = keys.map((k) => formData[k]).filter((v) => !isEmpty(v));
      const unique = new Set(vals.map((v) => JSON.stringify(v)));
      return unique.size < vals.length
        ? { message: msg('Each item must have a unique value'), attachTo }
        : null;
    }
  }
}
