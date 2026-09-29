import type { ExperimentFlow } from '@experiment-hub/engine/types';
import { describe, expect, it } from 'vitest';
import {
  addArm,
  addNode,
  canConnect,
  connect,
  deleteEdgeIds,
  deleteNodes,
  edgeTypeFor,
  reconnect,
  removeArm,
  setNodeName,
  setScreenSlug,
} from '../editor/mutations';

const fixture: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 's-consent', type: 'screen', props: { slug: 'consent' } },
    {
      id: 'b-age',
      type: 'branch',
      props: {
        name: 'Age check',
        branches: [
          {
            id: 'adult',
            name: 'Adult',
            config: {
              type: 'simple',
              dataKey: '$$consent.age',
              operator: 'gte',
              value: 18,
            },
          },
        ],
      },
    },
    { id: 's-a', type: 'screen', props: { slug: 'a' } },
    { id: 's-b', type: 'screen', props: { slug: 'b' } },
    { id: 'end', type: 'end' },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 's-consent' },
    { type: 'sequential', from: 's-consent', to: 'b-age' },
    { type: 'branch-condition', from: 'b-age.adult', to: 's-a' },
    { type: 'branch-default', from: 'b-age', to: 's-b' },
    { type: 'sequential', from: 's-a', to: 'end' },
    { type: 'sequential', from: 's-b', to: 'end' },
  ],
};

describe('edgeTypeFor', () => {
  const node = (id: string) => fixture.nodes.find((n) => n.id === id)!;

  it('maps next → sequential on sequential-capable nodes', () => {
    expect(edgeTypeFor(node('s-consent'), 'next')).toBe('sequential');
  });
  it('maps branch.arm → branch-condition, default → branch-default', () => {
    expect(edgeTypeFor(node('b-age'), 'branch.adult')).toBe('branch-condition');
    expect(edgeTypeFor(node('b-age'), 'default')).toBe('branch-default');
  });
  it('rejects unknown arms and handles on the wrong node type', () => {
    expect(edgeTypeFor(node('b-age'), 'branch.nope')).toBeNull();
    expect(edgeTypeFor(node('s-consent'), 'default')).toBeNull();
    expect(edgeTypeFor(node('end'), 'next')).toBeNull();
  });
});

describe('canConnect', () => {
  it('rejects self-connections', () => {
    expect(
      canConnect(fixture, {
        source: 's-consent',
        sourceHandle: 'next',
        target: 's-consent',
      }),
    ).toBe(false);
  });

  it('rejects a second sequential edge from the same node', () => {
    expect(
      canConnect(fixture, {
        source: 's-consent',
        sourceHandle: 'next',
        target: 's-b',
      }),
    ).toBe(false);
  });

  it('rejects cycles', () => {
    expect(
      canConnect(fixture, {
        source: 's-a',
        sourceHandle: 'next',
        target: 's-consent',
      }),
    ).toBe(false);
  });

  it('accepts a legal arm → node connection', () => {
    const withArm = addArm(fixture, 'b-age'); // adds arm "b"
    expect(
      canConnect(withArm, {
        source: 'b-age',
        sourceHandle: 'branch.b',
        target: 's-b',
      }),
    ).toBe(true);
  });
});

describe('connect', () => {
  it('appends a dotted-from arm edge', () => {
    const withArm = addArm(fixture, 'b-age');
    const next = connect(withArm, {
      source: 'b-age',
      sourceHandle: 'branch.b',
      target: 's-b',
    });
    expect(next.edges.at(-1)).toEqual({
      type: 'branch-condition',
      from: 'b-age.b',
      to: 's-b',
    });
  });

  it('is a no-op on illegal connections', () => {
    const same = connect(fixture, {
      source: 'end',
      sourceHandle: 'next',
      target: 's-a',
    });
    expect(same.edges).toHaveLength(fixture.edges.length);
  });
});

describe('reconnect', () => {
  it('rewires an edge to a new target, freeing the old output slot', () => {
    // Re-point s-consent's sequential edge at s-b — legal only because the
    // old edge is removed first (otherwise max-1 sequential would reject).
    const next = reconnect(fixture, 'sequential:s-consent->b-age', {
      source: 's-consent',
      sourceHandle: 'next',
      target: 's-b',
    });
    expect(next.edges.some((e) => e.from === 's-consent' && e.to === 'b-age')).toBe(false);
    expect(next.edges.some((e) => e.from === 's-consent' && e.to === 's-b')).toBe(true);
  });

  it('no-ops when the new connection is illegal', () => {
    const next = reconnect(fixture, 'sequential:s-consent->b-age', {
      source: 's-consent',
      sourceHandle: 'next',
      target: 's-consent', // self
    });
    expect(next).toBe(fixture);
  });
});

describe('deleteNodes / deleteEdgeIds', () => {
  it('removes a node and all edges touching it', () => {
    const next = deleteNodes(fixture, ['s-a']);
    expect(next.nodes.some((n) => n.id === 's-a')).toBe(false);
    expect(next.edges.some((e) => e.to === 's-a' || e.from === 's-a')).toBe(
      false,
    );
  });

  it('removes edges by editor id', () => {
    const next = deleteEdgeIds(fixture, [
      'branch-condition:b-age.adult->s-a',
    ]);
    expect(next.edges).toHaveLength(fixture.edges.length - 1);
  });
});

describe('addNode / props / arms', () => {
  it('adds a node with a unique id and typed props', () => {
    const { flow, id } = addNode(fixture, 'loop');
    expect(flow.nodes.at(-1)!.id).toBe(id);
    expect(flow.nodes.at(-1)!.type).toBe('loop');
    const again = addNode(flow, 'loop');
    expect(again.id).not.toBe(id);
  });

  it('renames and re-slugs nodes', () => {
    const named = setNodeName(fixture, 'b-age', 'Renamed').nodes.find(
      (n) => n.id === 'b-age',
    )!;
    expect((named as { props: { name: string } }).props.name).toBe('Renamed');
    const reslugged = setScreenSlug(fixture, 's-a', 'consent').nodes.find(
      (n) => n.id === 's-a',
    )!;
    expect((reslugged as { props: { slug: string } }).props.slug).toBe(
      'consent',
    );
  });

  it('removing an arm drops its edges', () => {
    const next = removeArm(fixture, 'b-age', 'adult');
    expect(
      next.edges.some((e) => e.from === 'b-age.adult'),
    ).toBe(false);
  });
});
