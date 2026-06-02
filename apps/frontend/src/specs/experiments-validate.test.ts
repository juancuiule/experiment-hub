import { validateExperiment } from '@experiment-hub/engine/experiment-validation';
import { describe, expect, it } from 'vitest';

// These integration tests validate the frontend's real experiment configs
// against the engine validator. They live in the frontend (not the engine
// package) so the engine stays independent of app data.
describe('actual experiment', () => {
  it('has no validation errors', async () => {
    const { default: experiment } =
      await import('@/src/data/experiments/pandemic');
    expect(validateExperiment(experiment)).toEqual([]);
  });
});

describe('i18n-demo example experiment', () => {
  it('validates with no errors', async () => {
    const { EXPERIMENTS } = await import('@/src/data/experiments');
    expect(validateExperiment(EXPERIMENTS['i18n-demo'])).toEqual([]);
  });
});
