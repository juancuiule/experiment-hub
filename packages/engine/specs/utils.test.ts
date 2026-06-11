import { afterEach, describe, it, expect, vi } from 'vitest';
import { isDefined, shuffle, shuffleAnchored } from '@experiment-hub/engine/utils';
import { seedRandom } from './test-helpers';

describe('shuffleAnchored', () => {
  afterEach(() => vi.restoreAllMocks());

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

  it('shuffles the middle in seeded order while keeping anchors pinned', () => {
    seedRandom(42);
    const options = [
      { value: 'b', anchor: 'first' as const },
      { value: 'a' },
      { value: 'c' },
      { value: 'd' },
      { value: 'e', anchor: 'last' as const },
    ];
    expect(shuffleAnchored(options).map((o) => o.value)).toEqual(['b', 'c', 'd', 'a', 'e']);
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

describe('shuffle', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns a new array containing all original elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result).not.toBe(input);
    expect(result).toHaveLength(5);
    expect(result).toEqual(expect.arrayContaining(input));
  });

  it('does not mutate the input array', () => {
    const input = [1, 2, 3];
    shuffle(input);
    expect(input).toEqual([1, 2, 3]);
  });

  it('returns an empty array for an empty input', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('returns a single-element array unchanged', () => {
    expect(shuffle([42])).toEqual([42]);
  });

  it('produces a deterministic permutation under seed 42', () => {
    seedRandom(42);
    expect(shuffle([1, 2, 3, 4, 5])).toEqual([3, 4, 5, 1, 2]);
  });
});

describe('isDefined', () => {
  it('is false for null and undefined', () => {
    expect(isDefined(null)).toBe(false);
    expect(isDefined(undefined)).toBe(false);
  });

  it('is true for falsy-but-defined values', () => {
    expect(isDefined(0)).toBe(true);
    expect(isDefined('')).toBe(true);
    expect(isDefined(false)).toBe(true);
  });

  it('narrows the type so it can be used as an array filter', () => {
    const xs: (number | null)[] = [1, null, 2, undefined as never];
    const defined: number[] = xs.filter(isDefined);
    expect(defined).toEqual([1, 2]);
  });
});
