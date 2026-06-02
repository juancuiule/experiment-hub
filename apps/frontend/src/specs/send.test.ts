import { describe, expect, it } from 'vitest';
import { send } from '@/src/data/send';

describe('send', () => {
  it('resolves with the context it was given', async () => {
    const ctx = { data: { a: 1 } };
    await expect(send(ctx, 0)).resolves.toBe(ctx);
  });

  it('accepts a custom delay', async () => {
    const ctx = {};
    await expect(send(ctx, 1)).resolves.toBe(ctx);
  });
});
