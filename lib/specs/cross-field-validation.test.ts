import { describe, expect, it } from 'vitest';
import {
  evaluateCrossFieldRule,
  isEmpty,
  resolveFieldRef,
} from '@/lib/cross-field-validation';

// ─── helpers ─────────────────────────────────────────────────────────────────

describe('isEmpty', () => {
  it('returns true for null', () => expect(isEmpty(null)).toBe(true));
  it('returns true for undefined', () => expect(isEmpty(undefined)).toBe(true));
  it('returns true for empty string', () => expect(isEmpty('')).toBe(true));
  it('returns true for whitespace string', () => expect(isEmpty('  ')).toBe(true));
  it('returns true for empty array', () => expect(isEmpty([])).toBe(true));
  it('returns false for 0', () => expect(isEmpty(0)).toBe(false));
  it('returns false for false', () => expect(isEmpty(false)).toBe(false));
  it('returns false for non-empty string', () => expect(isEmpty('hi')).toBe(false));
  it('returns false for non-empty array', () => expect(isEmpty(['a'])).toBe(false));
});

describe('resolveFieldRef', () => {
  it('resolves $-prefix from formData', () => {
    expect(resolveFieldRef('$name', { name: 'Alice' }, {})).toBe('Alice');
  });
  it('resolves $$-prefix from contextData (dotted path)', () => {
    expect(resolveFieldRef('$$welcome.name', {}, { welcome: { name: 'Bob' } })).toBe('Bob');
  });
  it('returns undefined for missing $-key', () => {
    expect(resolveFieldRef('$missing', {}, {})).toBeUndefined();
  });
});

// ─── rule evaluation ─────────────────────────────────────────────────────────

const form = (vals: Record<string, unknown>) => vals;
const ctx = (data: Record<string, any> = {}) => data;

describe('sum-equals', () => {
  it('returns null when fields sum to target', () => {
    const rule = { type: 'sum-equals' as const, fields: ['$a', '$b', '$c'] as any, target: 100 };
    expect(evaluateCrossFieldRule(rule, form({ a: 50, b: 30, c: 20 }), ctx())).toBeNull();
  });
  it('returns error when sum does not match target', () => {
    const rule = { type: 'sum-equals' as const, fields: ['$a', '$b'] as any, target: 100 };
    const result = evaluateCrossFieldRule(rule, form({ a: 40, b: 40 }), ctx());
    expect(result).not.toBeNull();
    expect(result!.message).toContain('100');
  });
  it('uses custom errorMessage', () => {
    const rule = { type: 'sum-equals' as const, fields: ['$a'] as any, target: 10, errorMessage: 'Must be 10' };
    const result = evaluateCrossFieldRule(rule, form({ a: 5 }), ctx());
    expect(result!.message).toBe('Must be 10');
  });
  it('strips $ from attachTo', () => {
    const rule = { type: 'sum-equals' as const, fields: ['$a'] as any, target: 10, attachTo: '$a' as const };
    const result = evaluateCrossFieldRule(rule, form({ a: 5 }), ctx());
    expect(result!.attachTo).toBe('a');
  });
  it('resolves $$-prefixed field from contextData', () => {
    const rule = { type: 'sum-equals' as const, fields: ['$$prev.x', '$b'] as any, target: 100 };
    expect(evaluateCrossFieldRule(rule, form({ b: 60 }), ctx({ prev: { x: 40 } }))).toBeNull();
  });
});

describe('sum-between', () => {
  it('returns null when sum is within range', () => {
    const rule = { type: 'sum-between' as const, fields: ['$a', '$b'] as any, min: 10, max: 20 };
    expect(evaluateCrossFieldRule(rule, form({ a: 8, b: 7 }), ctx())).toBeNull();
  });
  it('returns error when sum is below min', () => {
    const rule = { type: 'sum-between' as const, fields: ['$a'] as any, min: 10 };
    expect(evaluateCrossFieldRule(rule, form({ a: 5 }), ctx())).not.toBeNull();
  });
  it('returns error when sum exceeds max', () => {
    const rule = { type: 'sum-between' as const, fields: ['$a'] as any, max: 10 };
    expect(evaluateCrossFieldRule(rule, form({ a: 15 }), ctx())).not.toBeNull();
  });
});

describe('at-least-one', () => {
  it('returns null when at least one field is filled', () => {
    const rule = { type: 'at-least-one' as const, fields: ['$a', '$b'] as any };
    expect(evaluateCrossFieldRule(rule, form({ a: '', b: 'yes' }), ctx())).toBeNull();
  });
  it('returns error when all fields are empty', () => {
    const rule = { type: 'at-least-one' as const, fields: ['$a', '$b'] as any };
    expect(evaluateCrossFieldRule(rule, form({ a: '', b: '' }), ctx())).not.toBeNull();
  });
});

describe('count-between', () => {
  it('returns null when count is in range', () => {
    const rule = { type: 'count-between' as const, fields: ['$a', '$b', '$c'] as any, min: 1, max: 2 };
    expect(evaluateCrossFieldRule(rule, form({ a: 'x', b: '', c: '' }), ctx())).toBeNull();
  });
  it('returns error when count is below min', () => {
    const rule = { type: 'count-between' as const, fields: ['$a', '$b'] as any, min: 2 };
    expect(evaluateCrossFieldRule(rule, form({ a: 'x', b: '' }), ctx())).not.toBeNull();
  });
  it('returns error when count exceeds max', () => {
    const rule = { type: 'count-between' as const, fields: ['$a', '$b', '$c'] as any, max: 2 };
    expect(evaluateCrossFieldRule(rule, form({ a: 'x', b: 'y', c: 'z' }), ctx())).not.toBeNull();
  });
  it('returns null when no bounds set and some fields are filled', () => {
    const rule = { type: 'count-between' as const, fields: ['$a', '$b'] as any };
    expect(evaluateCrossFieldRule(rule, form({ a: '', b: '' }), ctx())).toBeNull();
  });
});

describe('exactly-n', () => {
  it('returns null when exactly n fields are filled', () => {
    const rule = { type: 'exactly-n' as const, fields: ['$a', '$b', '$c'] as any, n: 2 };
    expect(evaluateCrossFieldRule(rule, form({ a: 'x', b: 'y', c: '' }), ctx())).toBeNull();
  });
  it('returns error when fewer than n fields are filled', () => {
    const rule = { type: 'exactly-n' as const, fields: ['$a', '$b'] as any, n: 2 };
    expect(evaluateCrossFieldRule(rule, form({ a: 'x', b: '' }), ctx())).not.toBeNull();
  });
  it('returns error when more than n fields are filled', () => {
    const rule = { type: 'exactly-n' as const, fields: ['$a', '$b', '$c'] as any, n: 1 };
    expect(evaluateCrossFieldRule(rule, form({ a: 'x', b: 'y', c: '' }), ctx())).not.toBeNull();
  });
});

describe('mutually-exclusive', () => {
  it('returns null when zero fields are filled', () => {
    const rule = { type: 'mutually-exclusive' as const, fields: ['$a', '$b'] as any };
    expect(evaluateCrossFieldRule(rule, form({ a: '', b: '' }), ctx())).toBeNull();
  });
  it('returns null when exactly one field is filled', () => {
    const rule = { type: 'mutually-exclusive' as const, fields: ['$a', '$b'] as any };
    expect(evaluateCrossFieldRule(rule, form({ a: 'x', b: '' }), ctx())).toBeNull();
  });
  it('returns error when more than one field is filled', () => {
    const rule = { type: 'mutually-exclusive' as const, fields: ['$a', '$b'] as any };
    expect(evaluateCrossFieldRule(rule, form({ a: 'x', b: 'y' }), ctx())).not.toBeNull();
  });
});

describe('all-or-none', () => {
  it('returns null when all fields are empty', () => {
    const rule = { type: 'all-or-none' as const, fields: ['$a', '$b'] as any };
    expect(evaluateCrossFieldRule(rule, form({ a: '', b: '' }), ctx())).toBeNull();
  });
  it('returns null when all fields are filled', () => {
    const rule = { type: 'all-or-none' as const, fields: ['$a', '$b'] as any };
    expect(evaluateCrossFieldRule(rule, form({ a: 'x', b: 'y' }), ctx())).toBeNull();
  });
  it('returns error when some but not all fields are filled', () => {
    const rule = { type: 'all-or-none' as const, fields: ['$a', '$b', '$c'] as any };
    expect(evaluateCrossFieldRule(rule, form({ a: 'x', b: '', c: '' }), ctx())).not.toBeNull();
  });
});

describe('matches', () => {
  it('returns null when values are equal', () => {
    const rule = { type: 'matches' as const, a: '$email' as const, b: '$confirm' as const };
    expect(evaluateCrossFieldRule(rule, form({ email: 'a@b.com', confirm: 'a@b.com' }), ctx())).toBeNull();
  });
  it('returns error when values differ', () => {
    const rule = { type: 'matches' as const, a: '$email' as const, b: '$confirm' as const };
    expect(evaluateCrossFieldRule(rule, form({ email: 'a@b.com', confirm: 'x@b.com' }), ctx())).not.toBeNull();
  });
  it('returns null when cross-screen values match', () => {
    const rule = { type: 'matches' as const, a: '$$intake.email' as const, b: '$confirm' as const };
    expect(evaluateCrossFieldRule(rule, form({ confirm: 'a@b.com' }), ctx({ intake: { email: 'a@b.com' } }))).toBeNull();
  });
  it('returns error when cross-screen values differ', () => {
    const rule = { type: 'matches' as const, a: '$$intake.email' as const, b: '$confirm' as const };
    expect(evaluateCrossFieldRule(rule, form({ confirm: 'wrong@b.com' }), ctx({ intake: { email: 'a@b.com' } }))).not.toBeNull();
  });
});

describe('ordered', () => {
  it('returns null when a < b (lt)', () => {
    const rule = { type: 'ordered' as const, a: '$start' as const, b: '$end' as const, operator: 'lt' as const };
    expect(evaluateCrossFieldRule(rule, form({ start: 10, end: 20 }), ctx())).toBeNull();
  });
  it('returns error when a >= b (lt)', () => {
    const rule = { type: 'ordered' as const, a: '$start' as const, b: '$end' as const, operator: 'lt' as const };
    expect(evaluateCrossFieldRule(rule, form({ start: 20, end: 10 }), ctx())).not.toBeNull();
  });
  it('returns null when a <= b (lte)', () => {
    const rule = { type: 'ordered' as const, a: '$min' as const, b: '$max' as const, operator: 'lte' as const };
    expect(evaluateCrossFieldRule(rule, form({ min: 10, max: 10 }), ctx())).toBeNull();
  });
  it('returns error when a > b (lte)', () => {
    const rule = { type: 'ordered' as const, a: '$min' as const, b: '$max' as const, operator: 'lte' as const };
    expect(evaluateCrossFieldRule(rule, form({ min: 11, max: 10 }), ctx())).not.toBeNull();
  });
  it('resolves $$-prefix for cross-screen ordered check', () => {
    const rule = { type: 'ordered' as const, a: '$$baseline.estimate' as const, b: '$current' as const, operator: 'lte' as const };
    expect(evaluateCrossFieldRule(rule, form({ current: 50 }), ctx({ baseline: { estimate: 30 } }))).toBeNull();
  });
});

describe('conditional-range', () => {
  const cond = { type: 'simple' as const, operator: 'eq' as const, dataKey: '$drinks', value: true };
  it('skips validation when condition is false', () => {
    const rule = { type: 'conditional-range' as const, field: '$perWeek' as const, condition: cond, min: 1, max: 50 };
    expect(evaluateCrossFieldRule(rule, form({ drinks: false, perWeek: 0 }), ctx())).toBeNull();
  });
  it('validates range when condition is true and value in range', () => {
    const rule = { type: 'conditional-range' as const, field: '$perWeek' as const, condition: cond, min: 1, max: 50 };
    expect(evaluateCrossFieldRule(rule, form({ drinks: true, perWeek: 10 }), ctx())).toBeNull();
  });
  it('returns error when condition is true and value out of range', () => {
    const rule = { type: 'conditional-range' as const, field: '$perWeek' as const, condition: cond, min: 1, max: 50 };
    expect(evaluateCrossFieldRule(rule, form({ drinks: true, perWeek: 0 }), ctx())).not.toBeNull();
  });
});

describe('unique-across-foreach', () => {
  it('returns null when all values are distinct', () => {
    const rule = { type: 'unique-across-foreach' as const, foreachId: 'fe', dataKeyPattern: 'rank-{{#fe.value}}' };
    expect(evaluateCrossFieldRule(rule, form({ 'rank-a': '1', 'rank-b': '2', 'rank-c': '3' }), ctx())).toBeNull();
  });
  it('returns error when duplicate values exist', () => {
    const rule = { type: 'unique-across-foreach' as const, foreachId: 'fe', dataKeyPattern: 'rank-{{#fe.value}}' };
    expect(evaluateCrossFieldRule(rule, form({ 'rank-a': '1', 'rank-b': '1', 'rank-c': '3' }), ctx())).not.toBeNull();
  });
  it('ignores empty values when checking uniqueness', () => {
    const rule = { type: 'unique-across-foreach' as const, foreachId: 'fe', dataKeyPattern: 'rank-{{#fe.value}}' };
    expect(evaluateCrossFieldRule(rule, form({ 'rank-a': '', 'rank-b': '', 'rank-c': '1' }), ctx())).toBeNull();
  });
});
