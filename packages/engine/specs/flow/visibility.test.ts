import { describe, expect, it } from 'vitest';
import { Condition } from '../../conditions';
import { Context } from '../../types';
import { isConditionDataAvailable } from '../../flow/visibility';

const ctx: Context = {
  data: { profile: { age: 25 }, consent: { agreed: true } },
};

describe('isConditionDataAvailable', () => {
  describe('simple', () => {
    it('is true when the referenced key resolves to a defined value', () => {
      expect(
        isConditionDataAvailable(
          {
            type: 'simple',
            operator: 'eq',
            dataKey: '$$profile.age',
            value: 1,
          },
          ctx,
        ),
      ).toBe(true);
    });

    it('is false when the referenced key is absent', () => {
      expect(
        isConditionDataAvailable(
          {
            type: 'simple',
            operator: 'eq',
            dataKey: '$$profile.missing',
            value: 1,
          },
          ctx,
        ),
      ).toBe(false);
    });

    it('is false (caught) when the key format is invalid', () => {
      expect(
        isConditionDataAvailable(
          {
            type: 'simple',
            operator: 'eq',
            dataKey: 'bad-key' as never,
            value: 1,
          },
          ctx,
        ),
      ).toBe(false);
    });
  });

  describe('and / or', () => {
    const both: Condition = {
      type: 'and',
      conditions: [
        { type: 'simple', operator: 'eq', dataKey: '$$profile.age', value: 1 },
        {
          type: 'simple',
          operator: 'eq',
          dataKey: '$$consent.agreed',
          value: true,
        },
      ],
    };

    it('and — true only when every child key is available', () => {
      expect(isConditionDataAvailable(both, ctx)).toBe(true);
    });

    it('and — false when any child key is missing', () => {
      const withMissing: Condition = {
        type: 'and',
        conditions: [
          {
            type: 'simple',
            operator: 'eq',
            dataKey: '$$profile.age',
            value: 1,
          },
          { type: 'simple', operator: 'eq', dataKey: '$$nope', value: 1 },
        ],
      };
      expect(isConditionDataAvailable(withMissing, ctx)).toBe(false);
    });

    it('or — also requires every child key to be available', () => {
      const orCond: Condition = { ...both, type: 'or' };
      expect(isConditionDataAvailable(orCond, ctx)).toBe(true);
    });
  });

  describe('not', () => {
    it('delegates to the wrapped condition', () => {
      expect(
        isConditionDataAvailable(
          {
            type: 'not',
            condition: {
              type: 'simple',
              operator: 'eq',
              dataKey: '$$profile.age',
              value: 1,
            },
          },
          ctx,
        ),
      ).toBe(true);
    });

    it('is false when the wrapped key is missing', () => {
      expect(
        isConditionDataAvailable(
          {
            type: 'not',
            condition: {
              type: 'simple',
              operator: 'eq',
              dataKey: '$$gone',
              value: 1,
            },
          },
          ctx,
        ),
      ).toBe(false);
    });
  });
});
