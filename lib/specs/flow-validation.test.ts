import { describe, expect, it } from 'vitest';
import { ExperimentFlow } from '@/lib/types';
import { validateExperiment } from '@/lib/flow-validation';
import { makeScreen, seq } from './test-helpers';

const start = { id: 'start', type: 'start' as const };

function codes(flow: ExperimentFlow) {
  return validateExperiment(flow).map((e) => e.code);
}

function messages(flow: ExperimentFlow) {
  return validateExperiment(flow).map((e) => e.message);
}

function categories(flow: ExperimentFlow) {
  return validateExperiment(flow).map((e) => e.category);
}

// Minimal valid flow used as a baseline across tests
const minimalFlow: ExperimentFlow = {
  nodes: [start, makeScreen('s1', 'welcome')],
  edges: [seq('start', 's1')],
  screens: [
    {
      slug: 'welcome',
      components: [
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Go' },
        },
      ],
    },
  ],
};

describe('error categories', () => {
  it('assigns explicit categories to validation errors', () => {
    const missingStartFlow: ExperimentFlow = {
      nodes: [makeScreen('s1', 'welcome')],
      edges: [],
      screens: [],
    };
    expect(categories(missingStartFlow)).toContain('node');

    const missingEdgeFlow: ExperimentFlow = {
      nodes: [start],
      edges: [],
    };
    expect(categories(missingEdgeFlow)).toContain('edge');

    const missingScreenFlow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [],
    };
    expect(categories(missingScreenFlow)).toContain('screen');

    const branchFlow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$q.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s2', 'fallback'),
      ],
      edges: [seq('start', 's1'), seq('s1', 'b'), { type: 'branch-default', from: 'b', to: 's2' }],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'answer', label: '?' },
            },
          ],
        },
        { slug: 'fallback', components: [] },
      ],
    };
    expect(categories(branchFlow)).toContain('branch');

    const referenceFlow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'content',
              template: 'rich-text',
              props: { content: '{{$$missing.value}}' },
            },
          ],
        },
      ],
    };
    expect(categories(referenceFlow)).toContain('reference');
  });
});

describe('node identity', () => {
  it('passes a valid minimal flow', () => {
    expect(validateExperiment(minimalFlow)).toEqual([]);
  });

  it('reports duplicate-node-id', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'a'), makeScreen('s1', 'b')],
      edges: [],
    };
    expect(codes(flow)).toContain('duplicate-node-id');
  });

  it('reports missing-start', () => {
    const flow: ExperimentFlow = {
      nodes: [makeScreen('s1', 'welcome')],
      edges: [],
      screens: [],
    };
    expect(codes(flow)).toContain('missing-start');
  });

  it('accepts multiple start nodes (valid multi-entry-point design)', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { ...start, id: 'start2' },
        makeScreen('s1', 'welcome'),
        makeScreen('s2', 'other'),
      ],
      edges: [seq('start', 's1'), seq('start2', 's2')],
      screens: [
        { slug: 'welcome', components: [] },
        { slug: 'other', components: [] },
      ],
    };
    expect(codes(flow)).not.toContain('multiple-start');
    expect(codes(flow)).not.toContain('missing-start');
  });
});

describe('edge endpoints', () => {
  it('reports unknown source node', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [{ type: 'sequential', from: 'ghost', to: 's1' }],
      screens: [{ slug: 'welcome', components: [] }],
    };
    expect(codes(flow)).toContain('unknown-node');
    expect(messages(flow).some((m) => m.includes('"ghost"'))).toBe(true);
  });

  it('reports unknown target node', () => {
    const flow: ExperimentFlow = {
      nodes: [start],
      edges: [seq('start', 'ghost')],
    };
    expect(codes(flow)).toContain('unknown-node');
    expect(messages(flow).some((m) => m.includes('"ghost"'))).toBe(true);
  });
});

describe('start node wiring', () => {
  it('reports missing-edge when start has no sequential outgoing edge', () => {
    const flow: ExperimentFlow = {
      nodes: [start],
      edges: [],
    };
    expect(codes(flow)).toContain('missing-edge');
  });
});

describe('checkpoint wiring', () => {
  it('passes when checkpoint has no sequential edge (valid terminal)', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'welcome'),
        { id: 'cp', type: 'checkpoint', props: { name: 'done' } },
      ],
      edges: [seq('start', 's1'), seq('s1', 'cp')],
      screens: [{ slug: 'welcome', components: [] }],
    };
    expect(codes(flow)).not.toContain('ambiguous-edge');
  });

  it('reports ambiguous-edge when checkpoint has more than one sequential outgoing edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'cp', type: 'checkpoint', props: { name: 'done' } },
        makeScreen('s1', 'a'),
        makeScreen('s2', 'b'),
      ],
      edges: [seq('start', 'cp'), seq('cp', 's1'), seq('cp', 's2')],
      screens: [
        { slug: 'a', components: [] },
        { slug: 'b', components: [] },
      ],
    };
    expect(codes(flow)).toContain('ambiguous-edge');
  });
});

describe('branch wiring', () => {
  it('passes a fully wired branch', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'Test',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$q.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s1', 'q'),
        makeScreen('s-yes', 'yes-screen'),
        makeScreen('s-no', 'no-screen'),
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        { type: 'branch-default', from: 'b', to: 's-no' },
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'answer', label: '?' },
            },
          ],
        },
        { slug: 'yes-screen', components: [] },
        { slug: 'no-screen', components: [] },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('reports missing-edge when branch has no branch-default edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$s1.v',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s1', 'q'),
        makeScreen('s-yes', 'yes'),
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        // no branch-default
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'v', label: '?' },
            },
          ],
        },
        { slug: 'yes', components: [] },
      ],
    };
    expect(codes(flow)).toContain('missing-edge');
  });

  it('reports unrouted-branch when a branch condition has no branch-condition edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$s1.v',
                  value: 'y',
                },
              },
              {
                id: 'maybe',
                name: 'Maybe',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$s1.v',
                  value: 'm',
                },
              },
            ],
          },
        },
        makeScreen('s1', 'q'),
        makeScreen('s-yes', 'yes'),
        makeScreen('s-no', 'no'),
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        // "maybe" has no branch-condition edge
        { type: 'branch-default', from: 'b', to: 's-no' },
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'v', label: '?' },
            },
          ],
        },
        { slug: 'yes', components: [] },
        { slug: 'no', components: [] },
      ],
    };
    expect(codes(flow)).toContain('unrouted-branch');
    expect(messages(flow).some((m) => m.includes('"maybe"'))).toBe(true);
  });

  it('reports invalid-edge when branch-condition references a non-existent branch id', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$s1.v',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s1', 'q'),
        makeScreen('s-yes', 'yes'),
        makeScreen('s-no', 'no'),
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        { type: 'branch-condition', from: 'b.ghost', to: 's-no' }, // "ghost" doesn't exist
        { type: 'branch-default', from: 'b', to: 's-no' },
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'v', label: '?' },
            },
          ],
        },
        { slug: 'yes', components: [] },
        { slug: 'no', components: [] },
      ],
    };
    expect(codes(flow)).toContain('invalid-edge');
    expect(messages(flow).some((m) => m.includes('"ghost"'))).toBe(true);
  });
});

describe('fork wiring', () => {
  it('reports missing-edge when a fork id has no fork-edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'f',
          type: 'fork',
          props: {
            name: 'Variant fork',
            forks: [
              { id: 'a', name: 'A' },
              { id: 'b', name: 'B' },
            ],
          },
        },
        makeScreen('s-a', 'variant-a'),
        makeScreen('s-b', 'variant-b'),
      ],
      edges: [
        seq('start', 'f'),
        { type: 'fork-edge', from: 'f.a', to: 's-a' },
        // "b" has no fork-edge
      ],
      screens: [
        { slug: 'variant-a', components: [] },
        { slug: 'variant-b', components: [] },
      ],
    };
    expect(codes(flow)).toContain('missing-edge');
    expect(messages(flow).some((m) => m.includes('"b"'))).toBe(true);
  });

  it('reports missing-edge when fork has only 1 arm', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'f',
          type: 'fork',
          props: { name: 'Variant fork', forks: [{ id: 'a', name: 'A' }] },
        },
        makeScreen('s-a', 'variant-a'),
      ],
      edges: [seq('start', 'f'), { type: 'fork-edge', from: 'f.a', to: 's-a' }],
      screens: [{ slug: 'variant-a', components: [] }],
    };
    expect(codes(flow)).toContain('missing-edge');
    expect(messages(flow).some((m) => m.includes('at least two arms'))).toBe(
      true,
    );
  });

  it('does not report missing-edge for arm count when fork has 2 arms', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'f',
          type: 'fork',
          props: {
            name: 'Variant fork',
            forks: [
              { id: 'a', name: 'A' },
              { id: 'b', name: 'B' },
            ],
          },
        },
        makeScreen('s-a', 'variant-a'),
        makeScreen('s-b', 'variant-b'),
      ],
      edges: [
        seq('start', 'f'),
        { type: 'fork-edge', from: 'f.a', to: 's-a' },
        { type: 'fork-edge', from: 'f.b', to: 's-b' },
      ],
      screens: [
        { slug: 'variant-a', components: [] },
        { slug: 'variant-b', components: [] },
      ],
    };
    expect(messages(flow).some((m) => m.includes('at least two arms'))).toBe(
      false,
    );
  });

  it('reports invalid-edge when fork-edge references a non-existent fork id', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'f',
          type: 'fork',
          props: { name: 'Variant fork', forks: [{ id: 'a', name: 'A' }] },
        },
        makeScreen('s-a', 'variant-a'),
        makeScreen('s-ghost', 'ghost'),
      ],
      edges: [
        seq('start', 'f'),
        { type: 'fork-edge', from: 'f.a', to: 's-a' },
        { type: 'fork-edge', from: 'f.ghost', to: 's-ghost' }, // "ghost" not in forks
      ],
      screens: [
        { slug: 'variant-a', components: [] },
        { slug: 'ghost', components: [] },
      ],
    };
    expect(codes(flow)).toContain('invalid-edge');
    expect(messages(flow).some((m) => m.includes('"ghost"'))).toBe(true);
  });
});

describe('path wiring', () => {
  it('reports missing-edge when path has no path-contains edges', () => {
    const flow: ExperimentFlow = {
      nodes: [start, { id: 'p', type: 'path', props: { name: 'P' } }],
      edges: [seq('start', 'p')],
    };
    expect(codes(flow)).toContain('missing-edge');
  });

  it('reports missing-edge when path has no sequential exit edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'p', type: 'path', props: { name: 'P' } },
        makeScreen('s1', 'step-a'),
      ],
      edges: [
        seq('start', 'p'),
        { type: 'path-contains', from: 'p', to: 's1', order: 0 },
        // no sequential edge from "p"
      ],
      screens: [{ slug: 'step-a', components: [] }],
    };
    expect(codes(flow)).toContain('missing-edge');
    expect(
      messages(flow).some((m) => m.includes('no sequential exit edge')),
    ).toBe(true);
  });

  it('reports ambiguous-edge when path has more than one sequential exit edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'p', type: 'path', props: { name: 'P' } },
        makeScreen('s1', 'step-a'),
        makeScreen('s-after1', 'after1'),
        makeScreen('s-after2', 'after2'),
      ],
      edges: [
        seq('start', 'p'),
        { type: 'path-contains', from: 'p', to: 's1', order: 0 },
        seq('p', 's-after1'),
        seq('p', 's-after2'),
      ],
      screens: [
        { slug: 'step-a', components: [] },
        { slug: 'after1', components: [] },
        { slug: 'after2', components: [] },
      ],
    };
    expect(codes(flow)).toContain('ambiguous-edge');
    expect(
      messages(flow).some((m) =>
        m.includes('sequential exit edges; exactly one is required'),
      ),
    ).toBe(true);
  });

  it('reports invalid-edge when path-contains edge does not source from a path node', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'a'), makeScreen('s2', 'b')],
      edges: [
        seq('start', 's1'),
        { type: 'path-contains', from: 's1', to: 's2', order: 0 }, // s1 is a screen, not a path
      ],
      screens: [
        { slug: 'a', components: [] },
        { slug: 'b', components: [] },
      ],
    };
    expect(codes(flow)).toContain('invalid-edge');
  });
});

describe('loop wiring', () => {
  it('reports missing-edge when loop has no loop-template edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'loop', type: 'loop', props: { type: 'static', values: ['a'] } },
      ],
      edges: [seq('start', 'loop')],
    };
    expect(codes(flow)).toContain('missing-edge');
  });

  it('reports duplicate-edge when loop has more than one loop-template edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'loop', type: 'loop', props: { type: 'static', values: ['a'] } },
        makeScreen('s1', 'item-a'),
        makeScreen('s2', 'item-b'),
      ],
      edges: [
        seq('start', 'loop'),
        { type: 'loop-template', from: 'loop', to: 's1' },
        { type: 'loop-template', from: 'loop', to: 's2' },
      ],
      screens: [
        { slug: 'item-a', components: [] },
        { slug: 'item-b', components: [] },
      ],
    };
    expect(codes(flow)).toContain('duplicate-edge');
  });

  it('reports invalid-edge when loop-template does not source from a loop node', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'a'), makeScreen('s2', 'b')],
      edges: [
        seq('start', 's1'),
        { type: 'loop-template', from: 's1', to: 's2' }, // s1 is a screen, not a loop
      ],
      screens: [
        { slug: 'a', components: [] },
        { slug: 'b', components: [] },
      ],
    };
    expect(codes(flow)).toContain('invalid-edge');
  });
});

describe('screen definitions', () => {
  it('reports missing-screen when a screen node has no matching definition', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'missing-slug')],
      edges: [seq('start', 's1')],
      screens: [],
    };
    expect(codes(flow)).toContain('missing-screen');
    expect(messages(flow).some((m) => m.includes('"missing-slug"'))).toBe(true);
  });

  it('reports duplicate-screen when two definitions share a slug', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [
        { slug: 'welcome', components: [] },
        { slug: 'welcome', components: [] },
      ],
    };
    expect(codes(flow)).toContain('duplicate-screen');
  });

  it('reports unreferenced-screen when a definition has no matching screen node', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [
        { slug: 'welcome', components: [] },
        { slug: 'orphan', components: [] }, // no node references this
      ],
    };
    expect(codes(flow)).toContain('unreferenced-screen');
    expect(messages(flow).some((m) => m.includes('"orphan"'))).toBe(true);
  });
});

describe('@ reference checks', () => {
  it('accepts @value in a loop template screen', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'loop',
          type: 'loop',
          props: { type: 'static', values: ['a', 'b'] },
        },
        makeScreen('s-item', 'item'),
      ],
      edges: [
        seq('start', 'loop'),
        { type: 'loop-template', from: 'loop', to: 's-item' },
      ],
      screens: [
        {
          slug: 'item',
          components: [
            {
              componentFamily: 'response',
              template: 'likert-scale',
              props: {
                dataKey: 'score-{{@loop.value}}',
                label: 'Rate {{@loop.value}}',
                options: [
                  { label: 'Low', value: '1' },
                  { label: 'Medium', value: '2' },
                  { label: 'High', value: '3' },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('reports invalid-reference for @value used outside a loop', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'name', label: 'Hi {{@loop.value}}' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('invalid-reference');
    expect(messages(flow).some((m) => m.includes('not inside a loop'))).toBe(
      true,
    );
  });

  it('reports invalid-reference for @value in rich-text outside a loop', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'intro')],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'intro',
          components: [
            {
              componentFamily: 'content',
              template: 'rich-text',
              props: { content: '## {{@loop.value}}' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('invalid-reference');
  });
});

describe('$$ reference checks', () => {
  it('accepts a $$ reference to a screen that ran before', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome'), makeScreen('s2', 'profile')],
      edges: [seq('start', 's1'), seq('s1', 's2')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'name', label: 'Name' },
            },
          ],
        },
        {
          slug: 'profile',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'note', label: 'Hi {{$$welcome.name}}' },
            },
          ],
        },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('accepts a $$ reference to a field nested inside a group on a prior screen', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome'), makeScreen('s2', 'profile')],
      edges: [seq('start', 's1'), seq('s1', 's2')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'group',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'text-input',
                    props: { dataKey: 'name', label: 'Name' },
                  },
                ],
              },
            },
          ],
        },
        {
          slug: 'profile',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'note', label: 'Hi {{$$welcome.name}}' },
            },
          ],
        },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('reports unavailable-reference for a $$ token not yet written', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'name', label: 'Hi {{$$other.name}}' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('reports unwrapped-token for a bare $$ ref embedded in label text', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'name', label: 'Hello $$welcome.name' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unwrapped-token');
  });

  it('accepts a $$ reference to data written inside a path', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'path-info', type: 'path', props: { name: 'Info' } },
        makeScreen('s-age', 'demographics'),
        makeScreen('s-after', 'after'),
      ],
      edges: [
        seq('start', 'path-info'),
        { type: 'path-contains', from: 'path-info', to: 's-age', order: 0 },
        seq('path-info', 's-after'),
      ],
      screens: [
        {
          slug: 'demographics',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'age', label: 'Age' },
            },
          ],
        },
        {
          slug: 'after',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: {
                dataKey: 'note',
                label: '{{$$path-info.demographics.age}}',
              },
            },
          ],
        },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('reports unavailable-reference for data written only in one branch', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s-before', 'before'),
        {
          id: 'branch',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$before.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s-yes', 'branch-yes'),
        makeScreen('s-no', 'branch-no'),
        makeScreen('s-after', 'after'),
      ],
      edges: [
        seq('start', 's-before'),
        seq('s-before', 'branch'),
        { type: 'branch-condition', from: 'branch.yes', to: 's-yes' },
        { type: 'branch-default', from: 'branch', to: 's-no' },
        seq('s-yes', 's-after'),
        seq('s-no', 's-after'),
      ],
      screens: [
        {
          slug: 'before',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'answer', label: '?' },
            },
          ],
        },
        {
          slug: 'branch-yes',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'extra', label: 'Extra' },
            },
          ],
        },
        { slug: 'branch-no', components: [] },
        {
          slug: 'after',
          // "extra" is only written in the yes branch — not guaranteed
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'x', label: '{{$$branch-yes.extra}}' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('accepts a $$ reference to data written before a branch', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s-before', 'before'),
        {
          id: 'branch',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$before.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s-yes', 'branch-yes'),
        makeScreen('s-no', 'branch-no'),
        makeScreen('s-after', 'after'),
      ],
      edges: [
        seq('start', 's-before'),
        seq('s-before', 'branch'),
        { type: 'branch-condition', from: 'branch.yes', to: 's-yes' },
        { type: 'branch-default', from: 'branch', to: 's-no' },
        seq('s-yes', 's-after'),
        seq('s-no', 's-after'),
      ],
      screens: [
        {
          slug: 'before',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'answer', label: '?' },
            },
          ],
        },
        { slug: 'branch-yes', components: [] },
        { slug: 'branch-no', components: [] },
        {
          slug: 'after',
          // "answer" was written before the branch — always available
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'x', label: '{{$$before.answer}}' },
            },
          ],
        },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });
});

describe('condition reference checks', () => {
  it('accepts a valid $$ reference in a branch condition', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'welcome'),
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$welcome.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s-yes', 'yes'),
        makeScreen('s-no', 'no'),
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        { type: 'branch-default', from: 'b', to: 's-no' },
      ],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'answer', label: '?' },
            },
          ],
        },
        { slug: 'yes', components: [] },
        { slug: 'no', components: [] },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('reports unavailable-reference when condition references data not yet written', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            // References $$future.answer but no screen has run yet
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$future.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s-yes', 'yes'),
        makeScreen('s-no', 'no'),
      ],
      edges: [
        seq('start', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        { type: 'branch-default', from: 'b', to: 's-no' },
      ],
      screens: [
        { slug: 'yes', components: [] },
        { slug: 'no', components: [] },
      ],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('reports invalid-reference when condition uses @value outside a loop', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '@loop.value',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s-yes', 'yes'),
        makeScreen('s-no', 'no'),
      ],
      edges: [
        seq('start', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        { type: 'branch-default', from: 'b', to: 's-no' },
      ],
      screens: [
        { slug: 'yes', components: [] },
        { slug: 'no', components: [] },
      ],
    };
    expect(codes(flow)).toContain('invalid-reference');
  });
});

describe('actual experiment', () => {
  it('has no validation errors', async () => {
    const { default: experiment } = await import('@/src/data/experiments/pandemic');
    expect(validateExperiment(experiment)).toEqual([]);
  });
});

describe('shared option references', () => {
  function makeRadioScreen(optionsValue: string | object[]) {
    return {
      slug: 'q',
      components: [
        {
          componentFamily: 'response' as const,
          template: 'radio' as const,
          props: {
            dataKey: 'answer',
            label: 'Pick one',
            options: optionsValue as any,
          },
        },
      ],
    };
  }

  it('passes when %name resolves to a key in experiment.options', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'q')],
      edges: [seq('start', 's1')],
      options: { 'yes-no': [{ label: 'Yes', value: 'yes' }] },
      screens: [makeRadioScreen('%yes-no')],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('reports unknown-shared-options when %name is not in experiment.options', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'q')],
      edges: [seq('start', 's1')],
      screens: [makeRadioScreen('%missing')],
    };
    const errs = validateExperiment(flow);
    expect(errs.map((e) => e.code)).toContain('unknown-shared-options');
    expect(errs.find((e) => e.code === 'unknown-shared-options')!.message).toContain('%missing');
  });

  it('passes when options is an inline array (no % reference)', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'q')],
      edges: [seq('start', 's1')],
      screens: [makeRadioScreen([{ label: 'Yes', value: 'yes' }])],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('passes when options is a $$ reference (not a % reference)', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'q')],
      edges: [seq('start', 's1')],
      screens: [makeRadioScreen('$$other-screen.data-key' as any)],
    };
    const codes = validateExperiment(flow).map((e) => e.code);
    expect(codes).not.toContain('unknown-shared-options');
  });
});

// ─── Compute node ────────────────────────────────────────────────────────────

function makeCompute(id: string, computations: any[] = []): ExperimentFlow['nodes'][0] {
  return { id, type: 'compute' as const, props: { name: id, computations } };
}

describe('compute node wiring', () => {
  it('passes a valid compute node with sequential exit edge', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeCompute('c1'), makeScreen('s1', 'end')],
      edges: [seq('start', 'c1'), seq('c1', 's1')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('passes a compute node with no sequential exit edge (end of flow)', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'q'), makeCompute('c1')],
      edges: [seq('start', 's1'), seq('s1', 'c1')],
      screens: [{ slug: 'q', components: [] }],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });
});

describe('compute node reference checks', () => {
  it('reports unavailable-reference for a $$ ref not yet written', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          { outputKey: 'total', formula: { type: 'sum', inputs: ['$$q.score'] } },
        ]),
        makeScreen('s1', 'end'),
      ],
      edges: [seq('start', 'c1'), seq('c1', 's1')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('passes when $$ ref is available from a prior screen', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          { outputKey: 'total', formula: { type: 'sum', inputs: ['$$q.score'] } },
        ]),
        makeScreen('s2', 'end'),
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1'), seq('c1', 's2')],
      screens: [
        {
          slug: 'q',
          components: [
            { componentFamily: 'response', template: 'numeric-input', props: { dataKey: 'score', label: 'Score' } },
          ],
        },
        { slug: 'end', components: [] },
      ],
    };
    expect(codes(flow)).toEqual([]);
  });

  it('reports unavailable-reference when $outputKey references a key not yet defined in the same node', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          // level references $total but total is defined AFTER level — wrong order
          { outputKey: 'level', formula: { type: 'conditional', condition: { type: 'simple', operator: 'gte', dataKey: '$total', value: 10 }, then: 'high', else: 'low' } },
          { outputKey: 'total', formula: { type: 'sum', inputs: ['$$q.score'] } },
        ]),
        makeScreen('s2', 'end'),
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1'), seq('c1', 's2')],
      screens: [
        {
          slug: 'q',
          components: [
            { componentFamily: 'response', template: 'numeric-input', props: { dataKey: 'score', label: 'Score' } },
          ],
        },
        { slug: 'end', components: [] },
      ],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('passes when $outputKey references an earlier output in the same node', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          { outputKey: 'total', formula: { type: 'sum', inputs: ['$$q.score'] } },
          { outputKey: 'level', formula: { type: 'conditional', condition: { type: 'simple', operator: 'gte', dataKey: '$total', value: 10 }, then: 'high', else: 'low' } },
        ]),
        makeScreen('s2', 'end'),
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1'), seq('c1', 's2')],
      screens: [
        {
          slug: 'q',
          components: [
            { componentFamily: 'response', template: 'numeric-input', props: { dataKey: 'score', label: 'Score' } },
          ],
        },
        { slug: 'end', components: [] },
      ],
    };
    expect(codes(flow)).toEqual([]);
  });

  it('adds compute outputs to the available set for downstream nodes', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          { outputKey: 'total', formula: { type: 'sum', inputs: ['$$q.score'] } },
        ]),
        makeScreen('s2', 'result'),
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1'), seq('c1', 's2')],
      screens: [
        {
          slug: 'q',
          components: [
            { componentFamily: 'response', template: 'numeric-input', props: { dataKey: 'score', label: 'Score' } },
          ],
        },
        {
          slug: 'result',
          components: [
            { componentFamily: 'content', template: 'rich-text', props: { content: 'Your score: {{$$c1.total}}' } },
          ],
        },
      ],
    };
    expect(codes(flow)).toEqual([]);
  });

  it('reports duplicate-lookup-key when a lookup table has two entries with the same when value', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'level',
            formula: {
              type: 'lookup',
              input: '$$q.score',
              table: [
                { when: 5, then: 'mild' },
                { when: 5, then: 'moderate' },
              ],
            },
          },
        ]),
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1')],
      screens: [
        {
          slug: 'q',
          components: [
            { componentFamily: 'response', template: 'numeric-input', props: { dataKey: 'score', label: 'Score' } },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('duplicate-lookup-key');
  });

  it('scopes compute outputs under path id when inside a path', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'path-a', type: 'path' as const, props: { name: 'A' } },
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          { outputKey: 'total', formula: { type: 'sum', inputs: ['$$path-a.q.score'] } },
        ]),
        makeScreen('s2', 'result'),
      ],
      edges: [
        seq('start', 'path-a'),
        { type: 'path-contains', from: 'path-a', to: 's1', order: 0 },
        { type: 'path-contains', from: 'path-a', to: 'c1', order: 1 },
        seq('path-a', 's2'),
      ],
      screens: [
        {
          slug: 'q',
          components: [
            { componentFamily: 'response', template: 'numeric-input', props: { dataKey: 'score', label: 'Score' } },
          ],
        },
        {
          slug: 'result',
          components: [
            { componentFamily: 'content', template: 'rich-text', props: { content: '{{$$path-a.c1.total}}' } },
          ],
        },
      ],
    };
    expect(codes(flow)).toEqual([]);
  });

  it('reports duplicate-lookup-key when when values are equal after numeric coercion (5 vs "5")', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'level',
            formula: {
              type: 'lookup',
              input: '$$q.score',
              table: [
                { when: 5, then: 'mild' },
                { when: '5' as any, then: 'duplicate' },
              ],
            },
          },
        ]),
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1')],
      screens: [
        {
          slug: 'q',
          components: [
            { componentFamily: 'response', template: 'numeric-input', props: { dataKey: 'score', label: 'Score' } },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('duplicate-lookup-key');
  });

  it('reports duplicate-output-key when two computations share the same outputKey', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          { outputKey: 'total', formula: { type: 'sum', inputs: ['$$q.a'] } },
          { outputKey: 'total', formula: { type: 'sum', inputs: ['$$q.b'] } },
        ]),
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1')],
      screens: [
        {
          slug: 'q',
          components: [
            { componentFamily: 'response', template: 'numeric-input', props: { dataKey: 'a', label: 'A' } },
            { componentFamily: 'response', template: 'numeric-input', props: { dataKey: 'b', label: 'B' } },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('duplicate-output-key');
  });
});

describe('compute node — sample formula validation', () => {
  it('passes with a static inline pool', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          { outputKey: 'selected', formula: { type: 'sample', input: ['a', 'b', 'c'], n: 2 } },
        ]),
        makeScreen('s1', 'end'),
      ],
      edges: [seq('start', 'c1'), seq('c1', 's1')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('passes when $$ input is available from a prior screen', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          { outputKey: 'selected', formula: { type: 'sample', input: '$$q.pool', n: 3 } },
        ]),
        makeScreen('s2', 'end'),
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1'), seq('c1', 's2')],
      screens: [
        {
          slug: 'q',
          components: [
            { componentFamily: 'response', template: 'text-input', props: { dataKey: 'pool', label: 'Pool' } },
          ],
        },
        { slug: 'end', components: [] },
      ],
    };
    expect(codes(flow)).toEqual([]);
  });

  it('reports unavailable-reference when $$ input is not yet written', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          { outputKey: 'selected', formula: { type: 'sample', input: '$$q.pool', n: 3 } },
        ]),
        makeScreen('s1', 'end'),
      ],
      edges: [seq('start', 'c1'), seq('c1', 's1')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });
});

describe('unknown-template', () => {
  function flowWithComponents(
    components: ExperimentFlow['screens'][0]['components'],
  ): ExperimentFlow {
    return {
      nodes: [start, makeScreen('s1', 'pg')],
      edges: [seq('start', 's1')],
      screens: [{ slug: 'pg', components }],
    };
  }

  it('passes valid templates for all families', () => {
    const flow = flowWithComponents([
      { componentFamily: 'content', template: 'rich-text', props: { content: 'hello' } },
      { componentFamily: 'content', template: 'image', props: { url: 'x.png', alt: '' } },
      { componentFamily: 'content', template: 'video', props: { url: 'v.mp4' } },
      { componentFamily: 'content', template: 'audio', props: { url: 'a.mp3' } },
      { componentFamily: 'response', template: 'text-input', props: { dataKey: 'a', label: 'A' } },
      { componentFamily: 'response', template: 'text-area', props: { dataKey: 'b', label: 'B' } },
      { componentFamily: 'response', template: 'numeric-input', props: { dataKey: 'c', label: 'C' } },
      { componentFamily: 'response', template: 'slider', props: { dataKey: 'd', label: 'D' } },
      { componentFamily: 'response', template: 'radio', props: { dataKey: 'e', label: 'E', options: [] } },
      { componentFamily: 'response', template: 'checkboxes', props: { dataKey: 'f', label: 'F', options: [] } },
      { componentFamily: 'response', template: 'dropdown', props: { dataKey: 'g', label: 'G', options: [] } },
      { componentFamily: 'response', template: 'single-checkbox', props: { dataKey: 'h', label: 'H', defaultValue: false } },
      { componentFamily: 'response', template: 'date-input', props: { dataKey: 'i', label: 'I' } },
      { componentFamily: 'response', template: 'time-input', props: { dataKey: 'j', label: 'J' } },
      { componentFamily: 'response', template: 'likert-scale', props: { dataKey: 'k', label: 'K', options: [] } },
      { componentFamily: 'layout', template: 'button', props: {} },
    ]);
    expect(codes(flow).filter((c) => c === 'unknown-template')).toEqual([]);
  });

  it('reports unknown-template for an unknown componentFamily', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'pg')],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'pg',
          components: [
            // @ts-expect-error intentionally invalid
            { componentFamily: 'display', template: 'card', props: {} },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unknown-template');
    expect(messages(flow).some((m) => m.includes('"display"'))).toBe(true);
  });

  it('reports unknown-template for an unknown template within a known family', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'pg')],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'pg',
          components: [
            // @ts-expect-error intentionally invalid
            { componentFamily: 'content', template: 'carousel', props: {} },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unknown-template');
    expect(messages(flow).some((m) => m.includes('"carousel"'))).toBe(true);
  });

  it('reports unknown-template for unknown template in each family', () => {
    const cases: Array<ExperimentFlow['screens'][0]['components'][0]> = [
      // @ts-expect-error intentionally invalid
      { componentFamily: 'content', template: 'nonexistent', props: {} },
      // @ts-expect-error intentionally invalid
      { componentFamily: 'response', template: 'nonexistent', props: { dataKey: 'x', label: 'X' } },
      // @ts-expect-error intentionally invalid
      { componentFamily: 'layout', template: 'nonexistent', props: {} },
      // @ts-expect-error intentionally invalid
      { componentFamily: 'control', template: 'nonexistent', props: {} },
    ];
    for (const component of cases) {
      const flow = flowWithComponents([component]);
      expect(codes(flow)).toContain('unknown-template');
    }
  });

  it('detects unknown template nested inside a group', () => {
    const flow = flowWithComponents([
      {
        componentFamily: 'layout',
        template: 'group',
        props: {
          name: 'g',
          components: [
            // @ts-expect-error intentionally invalid
            { componentFamily: 'content', template: 'unknown', props: {} },
          ],
        },
      },
    ]);
    expect(codes(flow)).toContain('unknown-template');
  });

  it('detects unknown template nested inside a conditional', () => {
    const flow = flowWithComponents([
      {
        componentFamily: 'control',
        template: 'conditional',
        props: {
          if: { type: 'simple', operator: 'eq', dataKey: '$$pg.x', value: '1' },
          // @ts-expect-error intentionally invalid
          component: { componentFamily: 'content', template: 'unknown', props: {} },
        },
      },
    ]);
    expect(codes(flow)).toContain('unknown-template');
  });

  it('detects unknown template nested inside a for-each', () => {
    const flow = flowWithComponents([
      {
        componentFamily: 'control',
        template: 'for-each',
        props: {
          type: 'static',
          id: 'iter',
          values: ['a', 'b'],
          // @ts-expect-error intentionally invalid
          component: { componentFamily: 'response', template: 'unknown', props: { dataKey: 'x', label: 'X' } },
        },
      },
    ]);
    expect(codes(flow)).toContain('unknown-template');
  });

  it('reports the screen slug in the error message', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'my-screen')],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'my-screen',
          components: [
            // @ts-expect-error intentionally invalid
            { componentFamily: 'content', template: 'bad', props: {} },
          ],
        },
      ],
    };
    expect(messages(flow).some((m) => m.includes('"my-screen"'))).toBe(true);
  });
});
