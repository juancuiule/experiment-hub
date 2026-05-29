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
});
