import { augmentSubmitData } from '@/lib/screen-bindings';
import { Context } from '@/lib/types';
import { describe, expect, it } from 'vitest';

describe('augmentSubmitData', () => {
  it('returns data unchanged when context has no shuffled options', () => {
    const data = { rating: '3' };
    const context: Context = {};
    expect(augmentSubmitData(data, context)).toEqual({ rating: '3' });
  });

  it('returns data unchanged when shuffledOptions is empty', () => {
    const data = { rating: '3' };
    const context: Context = { screenData: { shuffledOptions: {} } };
    expect(augmentSubmitData(data, context)).toEqual({ rating: '3' });
  });

  it('appends :order key for each shuffled field present in data', () => {
    const data = { rating: '2' };
    const context: Context = {
      screenData: {
        shuffledOptions: {
          rating: [
            { label: 'Low', value: '1' },
            { label: 'High', value: '3' },
            { label: 'Med', value: '2' },
          ],
        },
      },
    };
    expect(augmentSubmitData(data, context)).toEqual({
      rating: '2',
      'rating:order': ['1', '3', '2'],
    });
  });

  it('skips shuffled fields not present in data', () => {
    const data = { other: 'x' };
    const context: Context = {
      screenData: {
        shuffledOptions: {
          rating: [
            { label: 'Low', value: '1' },
            { label: 'High', value: '3' },
          ],
        },
      },
    };
    expect(augmentSubmitData(data, context)).toEqual({ other: 'x' });
  });

  it('handles multiple shuffled fields in a single submission', () => {
    const data = { q1: 'a', q2: 'b' };
    const context: Context = {
      screenData: {
        shuffledOptions: {
          q1: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
          q2: [
            { label: 'Y', value: 'y' },
            { label: 'B', value: 'b' },
          ],
        },
      },
    };
    expect(augmentSubmitData(data, context)).toEqual({
      q1: 'a',
      'q1:order': ['a', 'b'],
      q2: 'b',
      'q2:order': ['y', 'b'],
    });
  });

  it('does not mutate the original data object', () => {
    const data = { rating: '1' };
    const context: Context = {
      screenData: {
        shuffledOptions: {
          rating: [{ label: 'Low', value: '1' }],
        },
      },
    };
    augmentSubmitData(data, context);
    expect(data).toEqual({ rating: '1' });
  });
});
