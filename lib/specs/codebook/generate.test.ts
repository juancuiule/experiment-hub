import { describe, expect, it } from 'vitest';
import { generateCodebook } from '../../codebook/generate';
import { ExperimentFlow } from '../../types';
import { makeScreen, seq } from '../test-helpers';

const start = { id: 'start', type: 'start' as const };
const end = { id: 'end', type: 'end' as const };

function find(vars: { key: string }[], key: string) {
  return vars.find((v) => v.key === key);
}

describe('generateCodebook — collected section', () => {
  it('emits a collected variable per response field with full key + metadata', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s', 'survey'), end],
      edges: [seq('start', 's'), seq('s', 'end')],
      screens: [
        {
          slug: 'survey',
          components: [
            {
              componentFamily: 'response',
              template: 'radio',
              props: {
                label: 'How clear?',
                dataKey: 'clarity',
                options: [
                  { label: 'Clear', value: 'clear' },
                  { label: 'Murky', value: 'murky' },
                ],
              },
            },
          ],
        },
      ],
    };
    const cb = generateCodebook(flow);
    const v = find(cb.collected, 'survey.clarity');
    expect(v).toBeDefined();
    expect(v?.type).toBe('enum');
    expect(v?.label).toBe('How clear?');
    expect(v?.screen).toBe('survey');
    expect(v?.repetition).toEqual({ kind: 'none' });
    expect(v?.options).toEqual([
      { value: 'clear', label: 'Clear' },
      { value: 'murky', label: 'Murky' },
    ]);
  });

  it('prefixes the key with the enclosing path id', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'path-p', type: 'path', props: { name: 'P' } },
        makeScreen('s', 'demo'),
        end,
      ],
      edges: [
        seq('start', 'path-p'),
        { type: 'path-contains', from: 'path-p', to: 's', order: 0 },
        seq('path-p', 'end'),
      ],
      screens: [
        {
          slug: 'demo',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { label: 'Name', dataKey: 'name' },
            },
          ],
        },
      ],
    };
    const cb = generateCodebook(flow);
    expect(find(cb.collected, 'path-p.demo.name')).toBeDefined();
  });

  it('represents a dynamic for-each field as a dynamic template row', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s', 'pec'), end],
      edges: [seq('start', 's'), seq('s', 'end')],
      screens: [
        {
          slug: 'pec',
          components: [
            {
              componentFamily: 'control',
              template: 'for-each',
              props: {
                id: 'fe',
                type: 'dynamic',
                dataKey: '$$items',
                component: {
                  componentFamily: 'response',
                  template: 'slider',
                  props: {
                    label: 'Rate {{#fe.value}}',
                    dataKey: 'rating-{{#fe.value}}',
                    min: 0,
                    max: 10,
                  },
                },
              },
            },
          ],
        },
      ],
    };
    const cb = generateCodebook(flow);
    const v = find(cb.collected, 'pec.rating-{{#fe.value}}');
    expect(v).toBeDefined();
    expect(v?.type).toBe('number');
    expect(v?.repetition).toEqual({
      kind: 'dynamic',
      over: '$$items',
      loopIds: ['fe'],
    });
  });

  it('records a human-readable condition for conditionally-shown fields', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s', 'c'), end],
      edges: [seq('start', 's'), seq('s', 'end')],
      screens: [
        {
          slug: 'c',
          components: [
            {
              componentFamily: 'control',
              template: 'conditional',
              props: {
                if: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$hasKids',
                  value: 'yes',
                },
                then: {
                  componentFamily: 'response',
                  template: 'numeric-input',
                  props: { label: 'How many?', dataKey: 'count' },
                },
              },
            },
          ],
        },
      ],
    };
    const cb = generateCodebook(flow);
    const v = find(cb.collected, 'c.count');
    expect(v?.conditional).toBe('$hasKids = yes');
  });
});

describe('generateCodebook — derived section', () => {
  it('emits a derived variable per compute output', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'score',
          type: 'compute',
          props: {
            name: 'Score',
            computations: [
              {
                outputKey: 'total',
                formula: { type: 'sum', inputs: ['$$a', '$$b'] },
              },
            ],
          },
        },
        makeScreen('s', 's'),
        end,
      ],
      edges: [seq('start', 'score'), seq('score', 's'), seq('s', 'end')],
    };
    const cb = generateCodebook(flow);
    const v = find(cb.derived, 'score.total');
    expect(v).toBeDefined();
    expect(v?.section).toBe('derived');
    expect(v?.template).toBe('compute:sum');
    expect(v?.type).toBe('number');
  });
});

describe('generateCodebook — system section', () => {
  it('includes branch, checkpoint, and assignment variables', () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: 'start-a', type: 'start', props: { name: 'A', param: { key: 'g', value: 'a' } } },
        { id: 'start-b', type: 'start', props: { name: 'B', param: { key: 'g', value: 'b' } } },
        { id: 'cp', type: 'checkpoint', props: { name: 'midpoint' } },
        {
          id: 'br',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: { type: 'simple', operator: 'eq', dataKey: '$$x', value: 1 },
              },
            ],
          },
        },
        makeScreen('s', 's'),
        makeScreen('s2', 's2'),
        end,
      ],
      edges: [
        seq('start-a', 'cp'),
        seq('start-b', 'cp'),
        seq('cp', 'br'),
        { type: 'branch-condition', from: 'br.yes', to: 's' },
        { type: 'branch-default', from: 'br', to: 's2' },
        seq('s', 'end'),
        seq('s2', 'end'),
      ],
    };
    const cb = generateCodebook(flow);
    expect(find(cb.system, 'start.group')).toBeDefined();
    expect(find(cb.system, 'branches.br')).toBeDefined();
    expect(find(cb.system, 'checkpoints.midpoint')).toBeDefined();
  });

  it('omits assignment when there is a single start node', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s', 's'), end],
      edges: [seq('start', 's'), seq('s', 'end')],
    };
    const cb = generateCodebook(flow);
    expect(find(cb.system, 'start.group')).toBeUndefined();
  });
});

describe('generateCodebook — real experiments smoke test', () => {
  it('generates a non-empty codebook for every registered experiment without throwing', async () => {
    const { EXPERIMENTS } = await import('@/src/data/experiments');
    for (const [slug, experiment] of Object.entries(EXPERIMENTS)) {
      const cb = generateCodebook(experiment, slug);
      const total =
        cb.collected.length + cb.derived.length + cb.system.length;
      expect(total, `experiment "${slug}" produced no variables`).toBeGreaterThan(0);
    }
  });

  it('captures the pecados dynamic for-each as a template row', async () => {
    const { EXPERIMENTS } = await import('@/src/data/experiments');
    const cb = generateCodebook(EXPERIMENTS['pecados'], 'pecados');
    const dynamic = cb.collected.filter((v) => v.repetition.kind === 'dynamic');
    expect(dynamic.length).toBeGreaterThan(0);
  });
});
