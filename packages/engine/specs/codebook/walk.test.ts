import { describe, expect, it } from 'vitest';
import { walkExperiment } from '../../codebook/walk';
import { ExperimentFlow } from '../../types';
import { getValue } from '../../resolve';
import { makeScreen, seq } from '../test-helpers';

const start = { id: 'start', type: 'start' as const };
const end = { id: 'end', type: 'end' as const };

describe('walkExperiment', () => {
  it('lists screens in order for a flat sequential flow', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'a'), makeScreen('s2', 'b'), end],
      edges: [seq('start', 's1'), seq('s1', 's2'), seq('s2', 'end')],
    };
    const { screens } = walkExperiment(flow);
    expect(screens.map((s) => s.slug)).toEqual(['a', 'b']);
    expect(screens.every((s) => s.dataPath.length === 0)).toBe(true);
  });

  it('prefixes dataPath with the enclosing path id', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'path-p', type: 'path', props: { name: 'P' } },
        makeScreen('s1', 'a'),
        makeScreen('s2', 'b'),
        makeScreen('after', 'after'),
        end,
      ],
      edges: [
        seq('start', 'path-p'),
        { type: 'path-contains', from: 'path-p', to: 's1', order: 0 },
        { type: 'path-contains', from: 'path-p', to: 's2', order: 1 },
        seq('path-p', 'after'),
        seq('after', 'end'),
      ],
    };
    const { screens } = walkExperiment(flow);
    const byslug = Object.fromEntries(screens.map((s) => [s.slug, s.dataPath]));
    expect(byslug['a']).toEqual(['path-p']);
    expect(byslug['b']).toEqual(['path-p']);
    expect(byslug['after']).toEqual([]); // sequential after the path, outer level
  });

  it('enumerates a static loop into one occurrence per item', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'loop-c',
          type: 'loop',
          props: { type: 'static', values: ['NYC', 'LA'] },
        },
        makeScreen('item', 'item'),
        end,
      ],
      edges: [
        seq('start', 'loop-c'),
        { type: 'loop-template', from: 'loop-c', to: 'item' },
        seq('loop-c', 'end'),
      ],
    };
    const { screens } = walkExperiment(flow);
    // Plain-string items key on the value itself (matches resolveIterKey).
    expect(screens.map((s) => s.dataPath)).toEqual([
      ['loop-c', 'NYC'],
      ['loop-c', 'LA'],
    ]);
    // Each occurrence binds its loop item so @loop-c.value resolves.
    expect(getValue('@loop-c.value', screens[0].context)).toBe('NYC');
    expect(getValue('@loop-c.value', screens[1].context)).toBe('LA');
    expect(screens[0].loop).toEqual({
      kind: 'static',
      count: 2,
      loopId: 'loop-c',
    });
  });

  it('uses itemKey for the static loop iteration key when set', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'loop-c',
          type: 'loop',
          props: {
            type: 'static',
            itemKey: 'id',
            values: [{ id: 'x' }, { id: 'y' }],
          },
        },
        makeScreen('item', 'item'),
        end,
      ],
      edges: [
        seq('start', 'loop-c'),
        { type: 'loop-template', from: 'loop-c', to: 'item' },
        seq('loop-c', 'end'),
      ],
    };
    const { screens } = walkExperiment(flow);
    expect(screens.map((s) => s.dataPath)).toEqual([
      ['loop-c', 'x'],
      ['loop-c', 'y'],
    ]);
  });

  it('represents a dynamic loop as a single template occurrence', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'loop-d',
          type: 'loop',
          props: { type: 'dynamic', dataKey: '$$items' },
        },
        makeScreen('item', 'item'),
        end,
      ],
      edges: [
        seq('start', 'loop-d'),
        { type: 'loop-template', from: 'loop-d', to: 'item' },
        seq('loop-d', 'end'),
      ],
    };
    const { screens } = walkExperiment(flow);
    expect(screens).toHaveLength(1);
    expect(screens[0].dataPath).toEqual(['loop-d', '<iter>']);
    expect(screens[0].loop).toEqual({
      kind: 'dynamic',
      over: '$$items',
      loopId: 'loop-d',
    });
  });

  it('walks every arm of a branch and its default', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'br',
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
                  dataKey: '$$x',
                  value: 1,
                },
              },
            ],
          },
        },
        makeScreen('yes-screen', 'yes-screen'),
        makeScreen('default-screen', 'default-screen'),
        end,
      ],
      edges: [
        seq('start', 'br'),
        { type: 'branch-condition', from: 'br.yes', to: 'yes-screen' },
        { type: 'branch-default', from: 'br', to: 'default-screen' },
        seq('yes-screen', 'end'),
        seq('default-screen', 'end'),
      ],
    };
    const { screens, visitedNodeIds } = walkExperiment(flow);
    expect(screens.map((s) => s.slug).sort()).toEqual([
      'default-screen',
      'yes-screen',
    ]);
    expect(visitedNodeIds.has('br')).toBe(true);
  });

  it('collects compute nodes with their dataPath', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'cmp',
          type: 'compute',
          props: {
            name: 'C',
            computations: [
              { outputKey: 'total', formula: { type: 'sum', inputs: ['$$a'] } },
            ],
          },
        },
        makeScreen('s', 's'),
        end,
      ],
      edges: [seq('start', 'cmp'), seq('cmp', 's'), seq('s', 'end')],
    };
    const { computes } = walkExperiment(flow);
    expect(computes).toHaveLength(1);
    expect(computes[0].node.id).toBe('cmp');
    expect(computes[0].dataPath).toEqual([]);
  });

  it('nests dataPath as [pathId, loopId, iterKey] for a loop inside a path', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'path-p', type: 'path', props: { name: 'P' } },
        {
          id: 'loop-l',
          type: 'loop',
          props: { type: 'static', values: ['a'] },
        },
        makeScreen('item', 'item'),
        end,
      ],
      edges: [
        seq('start', 'path-p'),
        { type: 'path-contains', from: 'path-p', to: 'loop-l', order: 0 },
        { type: 'loop-template', from: 'loop-l', to: 'item' },
        seq('loop-l', 'end'), // exit of the loop, still inside the path
        seq('path-p', 'end'),
      ],
    };
    const { screens } = walkExperiment(flow);
    expect(screens.map((s) => s.dataPath)).toEqual([['path-p', 'loop-l', 'a']]);
  });

  it('yields distinct occurrences when one screen sits in two paths', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'path-a', type: 'path', props: { name: 'A' } },
        { id: 'path-b', type: 'path', props: { name: 'B' } },
        makeScreen('shared', 'shared'),
        end,
      ],
      edges: [
        seq('start', 'path-a'),
        { type: 'path-contains', from: 'path-a', to: 'shared', order: 0 },
        seq('path-a', 'path-b'),
        { type: 'path-contains', from: 'path-b', to: 'shared', order: 0 },
        seq('path-b', 'end'),
      ],
    };
    const { screens } = walkExperiment(flow);
    expect(screens.map((s) => s.dataPath)).toEqual([['path-a'], ['path-b']]);
  });

  it('does not revisit a node at the same dataPath (cycle guard)', () => {
    // Pathological self-loop via sequential edge; the walk must terminate.
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s', 's')],
      edges: [seq('start', 's'), seq('s', 's')],
    };
    const { screens } = walkExperiment(flow);
    expect(screens).toHaveLength(1);
  });
});
