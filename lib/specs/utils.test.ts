import { describe, it, expect } from 'vitest';
import { shuffleAnchored } from '@/lib/utils';

describe('shuffleAnchored', () => {
  it('places anchor:last options at the end', () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'None', value: 'none', anchor: 'last' as const },
    ];
    const result = shuffleAnchored(options);
    expect(result[result.length - 1].value).toBe('none');
  });

  it('places anchor:first options at the beginning', () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'All', value: 'all', anchor: 'first' as const },
    ];
    const result = shuffleAnchored(options);
    expect(result[0].value).toBe('all');
  });

  it('preserves relative order of multiple anchor:last options', () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'None', value: 'none', anchor: 'last' as const },
      { label: 'Other', value: 'other', anchor: 'last' as const },
    ];
    const result = shuffleAnchored(options);
    const lastTwo = result.slice(-2).map((o) => o.value);
    expect(lastTwo).toEqual(['none', 'other']);
  });

  it('preserves relative order of multiple anchor:first options', () => {
    const options = [
      { label: 'All', value: 'all', anchor: 'first' as const },
      { label: 'Most', value: 'most', anchor: 'first' as const },
      { label: 'A', value: 'a' },
    ];
    const result = shuffleAnchored(options);
    const firstTwo = result.slice(0, 2).map((o) => o.value);
    expect(firstTwo).toEqual(['all', 'most']);
  });

  it('includes all unanchored options in the middle', () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
      { label: 'None', value: 'none', anchor: 'last' as const },
    ];
    const result = shuffleAnchored(options);
    const middle = result.slice(0, -1).map((o) => o.value);
    expect(middle).toHaveLength(3);
    expect(middle).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });

  it('returns an empty array for an empty input', () => {
    expect(shuffleAnchored([])).toEqual([]);
  });

  it('works when all options are anchored', () => {
    const options = [
      { label: 'First', value: 'f', anchor: 'first' as const },
      { label: 'Last', value: 'l', anchor: 'last' as const },
    ];
    const result = shuffleAnchored(options);
    expect(result[0].value).toBe('f');
    expect(result[1].value).toBe('l');
  });

  it('leaves a fully-unanchored array with all items present', () => {
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];
    const result = shuffleAnchored(options);
    expect(result).toHaveLength(3);
    expect(result.map((o) => o.value)).toEqual(
      expect.arrayContaining(['a', 'b', 'c']),
    );
  });
});
