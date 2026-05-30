import { FrameworkEdge } from '@/lib/edges';
import { FrameworkNode } from '@/lib/nodes';
import { baseId, computeLayout } from '@/src/builder/layout';
import { describe, expect, it } from 'vitest';

const nodes: FrameworkNode[] = [
  { id: 'start', type: 'start' },
  { id: 'intro', type: 'screen', props: { slug: 'intro' } },
  {
    id: 'branch',
    type: 'branch',
    props: {
      name: 'B',
      branches: [
        {
          id: 'a',
          name: 'A',
          config: { type: 'simple', operator: 'eq', dataKey: '$$x', value: '1' },
        },
      ],
    },
  },
  { id: 'more', type: 'screen', props: { slug: 'more' } },
  { id: 'end', type: 'end' },
];

const edges: FrameworkEdge[] = [
  { type: 'sequential', from: 'start', to: 'intro' },
  { type: 'sequential', from: 'intro', to: 'branch' },
  { type: 'branch-condition', from: 'branch.a', to: 'more' },
  { type: 'branch-default', from: 'branch', to: 'end' },
  { type: 'sequential', from: 'more', to: 'end' },
];

describe('computeLayout', () => {
  it('layers nodes by longest path from the root', () => {
    const layout = computeLayout(nodes, edges);
    const layerOf = (id: string) =>
      layout.nodes.find((n) => n.node.id === id)!.layer;

    expect(layerOf('start')).toBe(0);
    expect(layerOf('intro')).toBe(1);
    expect(layerOf('branch')).toBe(2);
    expect(layerOf('more')).toBe(3);
    // `end` sits below both `branch` (default) and `more`; longest path wins.
    expect(layerOf('end')).toBe(4);
  });

  it('collapses sub-id edge endpoints to their base node and keeps the sub-id', () => {
    const layout = computeLayout(nodes, edges);
    const branchEdge = layout.edges.find(
      (e) => e.edge.type === 'branch-condition',
    )!;
    expect(branchEdge.fromId).toBe('branch');
    expect(branchEdge.subId).toBe('a');
    expect(branchEdge.toId).toBe('more');
  });

  it('does not hang on cyclic edges', () => {
    const cyclic: FrameworkEdge[] = [
      { type: 'sequential', from: 'a', to: 'b' },
      { type: 'sequential', from: 'b', to: 'a' },
    ];
    const cyclicNodes: FrameworkNode[] = [
      { id: 'a', type: 'screen', props: { slug: 'a' } },
      { id: 'b', type: 'screen', props: { slug: 'b' } },
    ];
    const layout = computeLayout(cyclicNodes, cyclic);
    expect(layout.nodes).toHaveLength(2);
  });

  it('baseId splits on the first dot', () => {
    expect(baseId('branch1.branchA')).toBe('branch1');
    expect(baseId('plain')).toBe('plain');
  });
});
