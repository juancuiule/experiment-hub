import type { ExperimentFlow } from '@experiment-hub/engine/types';
import { describe, expect, it } from 'vitest';
import {
  conditionToString,
  layoutFlow,
  toFlowGraph,
} from '@/src/editor/adapter';

const fixture: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'screen-consent', type: 'screen', props: { slug: 'consent' } },
    {
      id: 'branch-age',
      type: 'branch',
      props: {
        name: 'Age check',
        branches: [
          {
            id: 'adult',
            name: 'Adult',
            config: {
              type: 'simple',
              operator: 'gte',
              dataKey: '$$consent.age',
              value: 18,
            },
          },
          {
            id: 'minor',
            name: 'Minor',
            config: {
              type: 'simple',
              operator: 'lt',
              dataKey: '$$consent.age',
              value: 18,
            },
          },
        ],
      },
    },
    {
      id: 'fork-groups',
      type: 'fork',
      props: {
        name: 'Condition',
        forks: [
          { id: 'a', name: 'Group A', weight: 1 },
          { id: 'b', name: 'Group B', weight: 2 },
        ],
      },
    },
    { id: 'path-steps', type: 'path', props: { name: 'Steps' } },
    { id: 'screen-a', type: 'screen', props: { slug: 'a' } },
    { id: 'screen-b', type: 'screen', props: { slug: 'b' } },
    {
      id: 'loop-trials',
      type: 'loop',
      props: { type: 'static', values: ['x', 'y', 'z'] },
    },
    { id: 'screen-trial', type: 'screen', props: { slug: 'trial' } },
    {
      id: 'compute-score',
      type: 'compute',
      props: {
        name: 'Score',
        computations: [
          {
            outputKey: 'total',
            formula: { type: 'sum', inputs: ['$$trial.value'] },
          },
        ],
      },
    },
    { id: 'checkpoint-1', type: 'checkpoint', props: { name: 'mid' } },
    { id: 'config', type: 'data', props: { name: 'Cfg', data: { n: 1 } } },
    { id: 'end', type: 'end' },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'screen-consent' },
    { type: 'sequential', from: 'screen-consent', to: 'branch-age' },
    { type: 'branch-condition', from: 'branch-age.adult', to: 'fork-groups' },
    { type: 'branch-condition', from: 'branch-age.minor', to: 'screen-a' },
    { type: 'branch-default', from: 'branch-age', to: 'end' },
    { type: 'fork-edge', from: 'fork-groups.a', to: 'path-steps' },
    { type: 'fork-edge', from: 'fork-groups.b', to: 'screen-b' },
    { type: 'path-contains', from: 'path-steps', to: 'screen-a', order: 0 },
    { type: 'path-contains', from: 'path-steps', to: 'screen-b', order: 1 },
    { type: 'sequential', from: 'path-steps', to: 'loop-trials' },
    { type: 'loop-template', from: 'loop-trials', to: 'screen-trial' },
    { type: 'sequential', from: 'loop-trials', to: 'compute-score' },
    { type: 'sequential', from: 'compute-score', to: 'checkpoint-1' },
    { type: 'sequential', from: 'checkpoint-1', to: 'end' },
    { type: 'sequential', from: 'config', to: 'end' },
  ],
  screens: [
    {
      slug: 'consent',
      components: [
        {
          componentFamily: 'response',
          template: 'numeric-input',
          props: { dataKey: 'age', label: 'Age' },
        },
        {
          componentFamily: 'response',
          template: 'single-checkbox',
          props: { dataKey: 'ok', label: 'Agree', defaultValue: false },
        },
      ],
    },
  ],
};

describe('toFlowGraph', () => {
  const { nodes, edges } = toFlowGraph(fixture);

  it('maps every node to an editor node typed by node type', () => {
    expect(nodes).toHaveLength(fixture.nodes.length);
    expect(nodes.find((n) => n.id === 'branch-age')?.type).toBe('branch');
  });

  it('generates unique edge ids', () => {
    expect(new Set(edges.map((e) => e.id)).size).toBe(edges.length);
  });

  it('routes branch-condition edges through per-arm handles', () => {
    const edge = edges.find((e) => e.id === 'branch-condition:branch-age.adult->fork-groups');
    expect(edge?.source).toBe('branch-age');
    expect(edge?.sourceHandle).toBe('branch.adult');
    expect(edge?.targetHandle).toBe('in');
    expect(edge?.data?.label).toBe('Adult');
    expect(edge?.data?.dashed).toBeFalsy();
  });

  it('routes branch-default through the default handle with an else label', () => {
    const edge = edges.find((e) => e.id === 'branch-default:branch-age->end');
    expect(edge?.sourceHandle).toBe('default');
    expect(edge?.data?.label).toBe('else');
    expect(edge?.data?.dashed).toBe(true);
  });

  it('routes fork edges through per-arm handles with weight labels', () => {
    const edge = edges.find((e) => e.id === 'fork-edge:fork-groups.b->screen-b');
    expect(edge?.sourceHandle).toBe('fork.b');
    expect(edge?.data?.label).toBe('Group B ×2');
  });

  it('routes containment and template edges through structural handles', () => {
    const contains = edges.find((e) => e.id === 'path-contains:path-steps->screen-b');
    expect(contains?.sourceHandle).toBe('children');
    expect(contains?.data?.label).toBe('2');

    const template = edges.find((e) => e.id === 'loop-template:loop-trials->screen-trial');
    expect(template?.sourceHandle).toBe('template');
  });

  it('routes sequential edges through the next handle', () => {
    const edge = edges.find((e) => e.id === 'sequential:start->screen-consent');
    expect(edge?.sourceHandle).toBe('next');
    expect(edge?.data?.label).toBeUndefined();
  });

  it('collects screen fields and node outputs for data sockets', () => {
    const screen = nodes.find((n) => n.id === 'screen-consent');
    expect(screen?.data.fields).toEqual(['age', 'ok']);

    const compute = nodes.find((n) => n.id === 'compute-score');
    expect(compute?.data.outputs).toEqual(['total']);

    const data = nodes.find((n) => n.id === 'config');
    expect(data?.data.outputs).toEqual(['n']);
  });
});

describe('layoutFlow', () => {
  it('assigns finite positions left-to-right', () => {
    const { nodes, edges } = toFlowGraph(fixture);
    const laid = layoutFlow(nodes, edges);
    for (const node of laid) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
    const byId = new Map(laid.map((n) => [n.id, n]));
    expect(byId.get('start')!.position.x).toBeLessThan(
      byId.get('end')!.position.x,
    );
  });
});

describe('conditionToString', () => {
  it('renders simple conditions compactly', () => {
    expect(
      conditionToString({
        type: 'simple',
        operator: 'gte',
        dataKey: '$$s.age',
        value: 18,
      }),
    ).toBe('$$s.age ≥ 18');
  });

  it('renders compound conditions', () => {
    expect(
      conditionToString({
        type: 'and',
        conditions: [
          { type: 'simple', operator: 'eq', dataKey: '$$a.x', value: true },
          {
            type: 'not',
            condition: {
              type: 'simple',
              operator: 'contains',
              dataKey: '$$b.y',
              value: 'z',
            },
          },
        ],
      }),
    ).toBe('$$a.x = true ∧ ¬($$b.y ∋ "z")');
  });
});
