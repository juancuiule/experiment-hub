import { describe, expect, it } from 'vitest';
import { startExperiment, traverse } from '@/lib/flow';
import { ExperimentFlow } from '@/lib/types';
import { makeScreen, seq } from '../test-helpers';

function makeCompute(id: string, computations: any[]): ExperimentFlow['nodes'][0] {
  return { id, type: 'compute' as const, props: { name: id, computations } };
}

// A loop whose iterations each collect a DIFFERENT field, then a collect-loop
// flattens them into one object, and a downstream node sums across them — the
// shape behind OCEAN category scoring (answers scattered across loop screens).
const flow: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'loop', type: 'loop', props: { type: 'static', values: ['x', 'y', 'z'] } },
    makeScreen('trial', 'trial'),
    makeCompute('collect', [
      { outputKey: 'ans', formula: { type: 'collect-loop', loopId: 'loop', screen: 'trial' } },
    ]),
    makeCompute('score', [
      {
        outputKey: 'total',
        formula: {
          type: 'sum',
          inputs: ['$$collect.ans.q1', '$$collect.ans.q2', '$$collect.ans.q3'],
        },
      },
    ]),
    makeScreen('end', 'end'),
  ],
  edges: [
    seq('start', 'loop'),
    { type: 'loop-template', from: 'loop', to: 'trial' },
    seq('loop', 'collect'),
    seq('collect', 'score'),
    seq('score', 'end'),
  ],
  screens: [
    { slug: 'trial', components: [] },
    { slug: 'end', components: [] },
  ],
};

describe('collect-loop formula', () => {
  it('flattens every iteration’s screen data into one object', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { q1: 10 }); // iter 1
    step = await traverse(step, { q2: 20 }); // iter 2
    step = await traverse(step, { q3: 30 }); // iter 3 -> collect -> score -> end

    expect(step.context.data?.['collect']?.['ans']).toEqual({
      q1: 10,
      q2: 20,
      q3: 30,
    });
  });

  it('lets a downstream node sum the flattened values', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { q1: 10 });
    step = await traverse(step, { q2: 20 });
    step = await traverse(step, { q3: 30 });

    expect(step.context.data?.['score']?.['total']).toBe(60);
  });
});
