import { validateExperiment } from '@experiment-hub/engine/experiment-validation';
import { describe, expect, it } from 'vitest';

// These integration tests validate the frontend's authored experiment
// configs against the engine validator — the same gate the backend publish
// path runs. They live in the frontend (not the engine package) so the
// engine stays independent of app data. Every entry must validate: the
// corpus is the seed source, and an invalid file previously shipped while
// only a subset was covered here.
describe('authored experiments', () => {
  it('all validate with no errors or warnings', async () => {
    const { EXPERIMENTS } = await import('@/src/data/experiments');
    for (const [slug, experiment] of Object.entries(EXPERIMENTS)) {
      expect(validateExperiment(experiment), `slug "${slug}"`).toEqual([]);
    }
  });
});
