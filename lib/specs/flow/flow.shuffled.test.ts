import { ScreenComponent } from '@/lib/components';
import { Option } from '@/lib/components/response';
import { startExperiment, traverse } from '@/lib/flow';
import { ExperimentFlow } from '@/lib/types';
import { describe, expect, it } from 'vitest';
import { seq } from '../test-helpers';

const OPTIONS = [
  { label: 'A', value: 'a' },
  { label: 'B', value: 'b' },
  { label: 'C', value: 'c' },
];

function makeFlow(
  components: ScreenComponent[],
  values?: string[],
): ExperimentFlow {
  const nodes: ExperimentFlow['nodes'] = values
    ? [
        { id: 'start', type: 'start' },
        { id: 'loop-1', type: 'loop', props: { type: 'static', values } },
        { id: 's1', type: 'screen', props: { slug: 'test' } },
      ]
    : [
        { id: 'start', type: 'start' },
        { id: 's1', type: 'screen', props: { slug: 'test' } },
      ];

  const edges: ExperimentFlow['edges'] = values
    ? [
        seq('start', 'loop-1'),
        { type: 'loop-template', from: 'loop-1', to: 's1' },
      ]
    : [seq('start', 's1')];

  return {
    nodes,
    edges,
    screens: [{ slug: 'test', components }],
  };
}

const ANCHORED_OPTIONS = [
  { label: 'A', value: 'a' },
  { label: 'B', value: 'b' },
  { label: 'C', value: 'c' },
  { label: 'None of the above', value: 'none', anchor: 'last' as const },
  { label: 'Other', value: 'other', anchor: 'last' as const },
];

describe('option anchoring', () => {
  it('keeps anchor:last options at the end after shuffle', async () => {
    const flow = makeFlow([
      {
        componentFamily: 'response',
        template: 'radio',
        props: {
          dataKey: 'choice',
          label: 'Choice',
          options: ANCHORED_OPTIONS,
          randomize: true,
        },
      },
    ]);
    const step = await startExperiment(flow, 'start');
    const shuffled = step.context.screenData?.shuffledOptions?.['choice'];
    expect(shuffled).toHaveLength(5);
    const lastTwo = shuffled?.slice(-2).map((o: Option) => o.value);
    expect(lastTwo).toEqual(['none', 'other']);
  });

  it('keeps anchor:first options at the beginning after shuffle', async () => {
    const options = [
      { label: 'All', value: 'all', anchor: 'first' as const },
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
    ];
    const flow = makeFlow([
      {
        componentFamily: 'response',
        template: 'radio',
        props: {
          dataKey: 'choice',
          label: 'Choice',
          options,
          randomize: true,
        },
      },
    ]);
    const step = await startExperiment(flow, 'start');
    const shuffled = step.context.screenData?.shuffledOptions?.['choice'];
    expect(shuffled![0].value).toBe('all');
  });

  it('preserves relative order of multiple anchor:last options', async () => {
    const flow = makeFlow([
      {
        componentFamily: 'response',
        template: 'checkboxes',
        props: {
          dataKey: 'topics',
          label: 'Topics',
          options: ANCHORED_OPTIONS,
          randomize: true,
        },
      },
    ]);
    const step = await startExperiment(flow, 'start');
    const shuffled = step.context.screenData?.shuffledOptions?.['topics'];
    const lastTwo = shuffled?.slice(-2).map((o: Option) => o.value);
    expect(lastTwo).toEqual(['none', 'other']);
    const middle = shuffled?.slice(0, -2).map((o: Option) => o.value);
    expect(middle).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });
});

describe('shuffled options injected by enterStep', () => {
  it('injects a shuffled permutation for randomize:true radio', async () => {
    const flow = makeFlow([
      {
        componentFamily: 'response',
        template: 'radio',
        props: {
          dataKey: 'choice',
          label: 'Choice',
          options: OPTIONS,
          randomize: true,
        },
      },
    ]);
    const step = await startExperiment(flow, 'start');
    const shuffled = step.context.screenData?.shuffledOptions?.['choice'];
    expect(shuffled).toHaveLength(3);
    expect(shuffled?.map((o: Option) => o.value)).toEqual(
      expect.arrayContaining(['a', 'b', 'c']),
    );
  });

  it('injects shuffled options for dropdown and checkboxes', async () => {
    const flow = makeFlow([
      {
        componentFamily: 'response',
        template: 'dropdown',
        props: {
          dataKey: 'dd',
          label: 'DD',
          options: OPTIONS.slice(0, 2),
          randomize: true,
        },
      },
      {
        componentFamily: 'response',
        template: 'checkboxes',
        props: {
          dataKey: 'cb',
          label: 'CB',
          options: OPTIONS.slice(0, 2),
          randomize: true,
        },
      },
    ]);
    const step = await startExperiment(flow, 'start');
    expect(step.context.screenData?.shuffledOptions?.['dd']).toHaveLength(2);
    expect(step.context.screenData?.shuffledOptions?.['cb']).toHaveLength(2);
  });

  it('does not inject shuffledOptions when no components have randomize:true', async () => {
    const flow = makeFlow([
      {
        componentFamily: 'response',
        template: 'radio',
        props: { dataKey: 'choice', label: 'Choice', options: OPTIONS },
      },
    ]);
    const step = await startExperiment(flow, 'start');
    expect(step.context.screenData?.shuffledOptions).toBeUndefined();
  });

  it('does not inject shuffledOptions when screens is undefined', async () => {
    const flow = makeFlow([]);
    flow.screens = undefined;
    const step = await startExperiment(flow, 'start');
    expect(step.context.screenData?.shuffledOptions).toBeUndefined();
  });

  it('injects shuffledOptions for randomized component inside dynamic for-each', async () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        { id: 's1', type: 'screen', props: { slug: 'test' } },
      ],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'test',
          components: [
            {
              componentFamily: 'control',
              template: 'for-each',
              props: {
                type: 'dynamic',
                id: 'items',
                dataKey: '$$items',
                component: {
                  componentFamily: 'response',
                  template: 'radio',
                  props: {
                    dataKey: 'pick_{{#items.index}}',
                    label: 'Pick',
                    options: OPTIONS,
                    randomize: true,
                  },
                },
              },
            },
          ],
        },
      ],
    };
    const step = await traverse(
      {
        state: { type: 'initial' },
        experiment: flow,
        context: { data: { items: ['x', 'y'] } },
      },
      { startNodeId: 'start' },
    );
    expect(step.context.screenData?.shuffledOptions?.['pick_0']).toHaveLength(
      3,
    );
    expect(step.context.screenData?.shuffledOptions?.['pick_1']).toHaveLength(
      3,
    );
  });

  it('preserves order in loops when reshuffleInLoop:false', async () => {
    const flow = makeFlow(
      [
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'choice',
            label: 'Choice',
            options: OPTIONS,
            randomize: true,
            reshuffleInLoop: false,
          },
        },
      ],
      ['first', 'second'],
    );

    const step1 = await startExperiment(flow, 'start');
    const order1 = step1.context.screenData?.shuffledOptions?.['choice'];

    const step2 = await traverse(step1, { choice: 'a' });
    const order2 = step2.context.screenData?.shuffledOptions?.['choice'];

    expect(order2).toBe(order1);
  });

  it('preserves order across loop iterations by default (reshuffleInLoop not set)', async () => {
    const flow = makeFlow(
      [
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'choice',
            label: 'Choice',
            options: OPTIONS,
            randomize: true,
          },
        },
      ],
      ['first', 'second'],
    );

    const step1 = await startExperiment(flow, 'start');
    const order1 = step1.context.screenData?.shuffledOptions?.['choice'];

    const step2 = await traverse(step1, { choice: 'a' });
    const order2 = step2.context.screenData?.shuffledOptions?.['choice'];

    expect(order2).toBe(order1);
  });

  it('reshuffles across loop iterations when reshuffleInLoop:true', async () => {
    const flow = makeFlow(
      [
        {
          componentFamily: 'response',
          template: 'radio',
          props: {
            dataKey: 'choice',
            label: 'Choice',
            options: OPTIONS,
            randomize: true,
            reshuffleInLoop: true,
          },
        },
      ],
      ['first', 'second'],
    );

    const step1 = await startExperiment(flow, 'start');
    const order1 = step1.context.screenData?.shuffledOptions?.['choice'];

    const step2 = await traverse(step1, { choice: 'a' });
    const order2 = step2.context.screenData?.shuffledOptions?.['choice'];

    expect(order2).not.toBe(order1);
  });
});
