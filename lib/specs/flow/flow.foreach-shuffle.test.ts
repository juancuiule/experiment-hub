import { ScreenComponent } from '@/lib/components';
import { startExperiment, traverse } from '@/lib/flow';
import { ExperimentFlow } from '@/lib/types';
import { describe, expect, it } from 'vitest';
import { seq } from '../test-helpers';

const VALUES = ['tennis', 'golf', 'squash'];

// A for-each whose nested component is a simple rich-text so the only shuffle
// emitted is the for-each presentation order itself.
function foreach(
  props: Partial<{ randomized: boolean; reshuffleInLoop: boolean }> = {},
  source:
    | { type: 'static'; values: string[] }
    | { type: 'dynamic'; dataKey: `$$${string}` } = {
    type: 'static',
    values: VALUES,
  },
): ScreenComponent {
  return {
    componentFamily: 'control',
    template: 'for-each',
    props: {
      id: 'sport-items',
      ...source,
      ...props,
      component: {
        componentFamily: 'content',
        template: 'rich-text',
        props: { content: '{{#sport-items.value}}' },
      },
    },
  } as ScreenComponent;
}

function makeFlow(
  components: ScreenComponent[],
  loopValues?: string[],
): ExperimentFlow {
  const nodes: ExperimentFlow['nodes'] = loopValues
    ? [
        { id: 'start', type: 'start' },
        {
          id: 'loop-1',
          type: 'loop',
          props: { type: 'static', values: loopValues },
        },
        { id: 's1', type: 'screen', props: { slug: 'test' } },
      ]
    : [
        { id: 'start', type: 'start' },
        { id: 's1', type: 'screen', props: { slug: 'test' } },
      ];

  const edges: ExperimentFlow['edges'] = loopValues
    ? [
        seq('start', 'loop-1'),
        { type: 'loop-template', from: 'loop-1', to: 's1' },
      ]
    : [seq('start', 's1')];

  return { nodes, edges, screens: [{ slug: 'test', components }] };
}

describe('randomized for-each presentation order', () => {
  it('emits a stable shuffled order containing all static values', async () => {
    const flow = makeFlow([foreach({ randomized: true })]);
    const step = await startExperiment(flow, 'start');
    const order =
      step.context.screenData?.shuffledForeachOrders?.['sport-items'];
    expect(order).toHaveLength(3);
    expect(order).toEqual(expect.arrayContaining(VALUES));
  });

  it('resolves then shuffles a dynamic for-each with $$ prefix', async () => {
    const flow = makeFlow([
      foreach({ randomized: true }, { type: 'dynamic', dataKey: '$$items' }),
    ]);
    const step = await traverse(
      {
        state: { type: 'initial' },
        experiment: flow,
        context: { data: { items: VALUES } },
      },
      { startNodeId: 'start' },
    );
    const order =
      step.context.screenData?.shuffledForeachOrders?.['sport-items'];
    expect(order).toHaveLength(3);
    expect(order).toEqual(expect.arrayContaining(VALUES));
  });

  it('does not emit shuffledForeachOrders when randomized is absent', async () => {
    const flow = makeFlow([foreach()]);
    const step = await startExperiment(flow, 'start');
    expect(step.context.screenData?.shuffledForeachOrders).toBeUndefined();
  });

  it('preserves order across loop iterations by default (reshuffleInLoop not set)', async () => {
    const flow = makeFlow([foreach({ randomized: true })], ['a', 'b']);
    const step1 = await startExperiment(flow, 'start');
    const order1 =
      step1.context.screenData?.shuffledForeachOrders?.['sport-items'];

    const step2 = await traverse(step1, {});
    const order2 =
      step2.context.screenData?.shuffledForeachOrders?.['sport-items'];

    expect(order2).toBe(order1);
  });

  it('tracks the current loop item when the for-each iterates @loop.value', async () => {
    // Regression: a randomized for-each over @loop-1.value (which changes every
    // iteration) must present the CURRENT item's values, not stay pinned to the
    // first iteration's. The stability guard only applies when the resolved
    // values are unchanged across iterations.
    const bins = [
      ['a', 'b'],
      ['c', 'd', 'e'],
    ];
    const flow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        {
          id: 'loop-1',
          type: 'loop',
          props: {
            type: 'static',
            values: bins as unknown as (string | Record<string, unknown>)[],
          },
        },
        { id: 's1', type: 'screen', props: { slug: 'test' } },
      ],
      edges: [
        seq('start', 'loop-1'),
        { type: 'loop-template', from: 'loop-1', to: 's1' },
      ],
      screens: [
        {
          slug: 'test',
          components: [
            {
              componentFamily: 'control',
              template: 'for-each',
              props: {
                id: 'sport-items',
                type: 'dynamic',
                dataKey: '@loop-1.value',
                randomized: true,
                component: {
                  componentFamily: 'content',
                  template: 'rich-text',
                  props: { content: '{{#sport-items.value}}' },
                },
              },
            } as ScreenComponent,
          ],
        },
      ],
    };

    const step1 = await startExperiment(flow, 'start');
    const order1 =
      step1.context.screenData?.shuffledForeachOrders?.['sport-items'];
    expect([...(order1 ?? [])].sort()).toEqual(['a', 'b']);

    const step2 = await traverse(step1, {});
    const order2 =
      step2.context.screenData?.shuffledForeachOrders?.['sport-items'];
    expect([...(order2 ?? [])].sort()).toEqual(['c', 'd', 'e']);
  });

  it('reshuffles across loop iterations when reshuffleInLoop:true', async () => {
    const flow = makeFlow(
      [foreach({ randomized: true, reshuffleInLoop: true })],
      ['a', 'b'],
    );
    const step1 = await startExperiment(flow, 'start');
    const order1 =
      step1.context.screenData?.shuffledForeachOrders?.['sport-items'];

    const step2 = await traverse(step1, {});
    const order2 =
      step2.context.screenData?.shuffledForeachOrders?.['sport-items'];

    // A fresh shuffle produces a new array reference each iteration.
    expect(order2).not.toBe(order1);
    expect(order2).toEqual(expect.arrayContaining(VALUES));
  });

  it('clears a previous screen’s shuffled order when the next screen has none', async () => {
    // s1 has a randomized for-each; s2 has none. Because screenData is
    // deep-merged across the flow, s1's order must not leak into s2 (it would
    // otherwise be written as a stale <id>:order on s2's submission).
    const flow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        { id: 's1', type: 'screen', props: { slug: 'first' } },
        { id: 's2', type: 'screen', props: { slug: 'second' } },
      ],
      edges: [seq('start', 's1'), seq('s1', 's2')],
      screens: [
        { slug: 'first', components: [foreach({ randomized: true })] },
        {
          slug: 'second',
          components: [
            {
              componentFamily: 'content',
              template: 'rich-text',
              props: { content: 'plain screen' },
            },
          ],
        },
      ],
    };

    const step1 = await startExperiment(flow, 'start');
    expect(
      step1.context.screenData?.shuffledForeachOrders?.['sport-items'],
    ).toHaveLength(3);

    const step2 = await traverse(step1, {});
    expect(step2.context.screenData?.shuffledForeachOrders).toBeUndefined();
  });
});
