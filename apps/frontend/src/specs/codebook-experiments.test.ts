import { describe, expect, it } from 'vitest';
import { generateCodebook } from '@experiment-hub/engine/codebook';
import { EXPERIMENTS } from '@/src/data/experiments';

// Smoke tests that run the engine's codebook generator over the real,
// app-registered experiments. They live in the frontend package because the
// experiment data is part of the app — the engine package stays app-agnostic.
describe('generateCodebook — real experiments smoke test', () => {
  it('generates a non-empty codebook for every registered experiment without throwing', () => {
    for (const [slug, experiment] of Object.entries(EXPERIMENTS)) {
      const cb = generateCodebook(experiment, slug);
      const total = cb.collected.length + cb.derived.length + cb.system.length;
      expect(total, `experiment "${slug}" produced no variables`).toBeGreaterThan(0);
    }
  });

  it('captures the pecados dynamic for-each as a template row', () => {
    const cb = generateCodebook(EXPERIMENTS['pecados'], 'pecados');
    const dynamic = cb.collected.filter((v) => v.repetition.kind === 'dynamic');
    expect(dynamic.length).toBeGreaterThan(0);
  });
});
