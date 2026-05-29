import { getLeafState, next, startExperiment, traverse } from '@/lib/flow';
import { ExperimentFlow, InNodeState } from '@/lib/types';
import { describe, expect, it } from 'vitest';
import { makeScreen, seq } from '../test-helpers';

describe('startExperiment', () => {
  const flow: ExperimentFlow = {
    nodes: [
      {
        id: 'start-a',
        type: 'start',
        props: { name: 'A', param: { key: 'source', value: 'a' } },
      },
      {
        id: 'start-b',
        type: 'start',
        props: { name: 'B', param: { key: 'source', value: 'b' } },
      },
      makeScreen('screen-1'),
      makeScreen('screen-2'),
    ],
    edges: [seq('start-a', 'screen-1'), seq('start-b', 'screen-2')],
  };

  it('auto-advances past the start node and lands on the first screen', async () => {
    const step = await startExperiment(flow, 'start-a');
    expect(step.state.type).toBe('in-node');
    expect((step.state as InNodeState).node.id).toBe('screen-1');
  });

  it('records the start group in context', async () => {
    const step = await startExperiment(flow, 'start-a');
    expect(step.context.start?.group).toBe('source=a');
  });

  it('picks the correct start node when two exist', async () => {
    const step = await startExperiment(flow, 'start-b');
    expect((step.state as InNodeState).node.id).toBe('screen-2');
    expect(step.context.start?.group).toBe('source=b');
  });

  it('falls back to the first start node when no id is given', async () => {
    const step = await startExperiment(flow);
    expect((step.state as InNodeState).node.id).toBe('screen-1');
  });

  it('throws when the given startNodeId does not exist', async () => {
    await expect(startExperiment(flow, 'nope')).rejects.toThrow(
      'Start node not found: nope',
    );
  });

  it('keeps first sequential edge when malformed flow has duplicate from nodes', async () => {
    const malformedFlow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        makeScreen('screen-1'),
        makeScreen('screen-2'),
      ],
      edges: [seq('start', 'screen-1'), seq('start', 'screen-2')],
    };

    const step = await startExperiment(malformedFlow, 'start');
    expect((step.state as InNodeState).node.id).toBe('screen-1');
  });
});

describe('start node without props', () => {
  it("records 'default' as the group when start node has no props", async () => {
    const flow: ExperimentFlow = {
      nodes: [{ id: 'start', type: 'start' }, makeScreen('s1', 's1')],
      edges: [seq('start', 's1')],
    };
    const step = await startExperiment(flow, 'start');
    expect(step.context.start?.group).toBe('default');
  });
});

describe('traverse no-op on end state', () => {
  const flow: ExperimentFlow = {
    nodes: [{ id: 'start', type: 'start' }, makeScreen('s1', 's1')],
    edges: [seq('start', 's1')],
  };

  it('returns the same step reference when already at end', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, {}); // s1 → end (no sequential edge out)
    expect(step.state.type).toBe('end');
    const again = await traverse(step, { extra: true });
    expect(again).toBe(step);
  });
});

describe('next() — .then() chaining helper', () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: 'start', type: 'start' },
      makeScreen('s-a', 'a'),
      makeScreen('s-b', 'b'),
      makeScreen('s-c', 'c'),
    ],
    edges: [seq('start', 's-a'), seq('s-a', 's-b'), seq('s-b', 's-c')],
  };

  it('chains three screens with .then(next(...))', async () => {
    const step = await startExperiment(flow, 'start')
      .then(next({ answer: 1 })) // s-a → s-b
      .then(next({ answer: 2 })) // s-b → s-c
      .then(next({ answer: 3 })); // s-c → end
    expect(step.state.type).toBe('end');
    expect(step.context.data?.['a']).toEqual({ answer: 1 });
    expect(step.context.data?.['b']).toEqual({ answer: 2 });
    expect(step.context.data?.['c']).toEqual({ answer: 3 });
  });

  it('next() with no argument still advances (passes empty data)', async () => {
    const step = await startExperiment(flow, 'start')
      .then(next())
      .then(next())
      .then(next());
    expect(step.state.type).toBe('end');
  });

  it('mixing .then(next()) with manual await traverse() produces the same result', async () => {
    const chained = await startExperiment(flow, 'start')
      .then(next({ x: 1 }))
      .then(next({ x: 2 }))
      .then(next({ x: 3 }));

    let manual = await startExperiment(flow, 'start');
    manual = await traverse(manual, { x: 1 });
    manual = await traverse(manual, { x: 2 });
    manual = await traverse(manual, { x: 3 });

    expect(chained.state).toEqual(manual.state);
    expect(chained.context).toEqual(manual.context);
  });
});

describe('getLeafState', () => {
  it('returns an in-node state unchanged', async () => {
    const flow: ExperimentFlow = {
      nodes: [{ id: 'start', type: 'start' }, makeScreen('s1', 's1')],
      edges: [seq('start', 's1')],
    };
    const step = await startExperiment(flow, 'start');
    const { leaf } = getLeafState(step.state);
    expect(leaf).toBe(step.state);
    expect(leaf.type).toBe('in-node');
  });

  it('unwraps in-path to the innermost screen state', async () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'path-p', type: 'path', props: { name: 'P' } },
        makeScreen('s1', 's1'),
        makeScreen('s2', 's2'),
      ],
      edges: [
        seq('start', 'path-p'),
        { type: 'path-contains', from: 'path-p', to: 's1', order: 0 },
        { type: 'path-contains', from: 'path-p', to: 's2', order: 1 },
      ],
    };
    const step = await startExperiment(flow, 'start');
    expect(step.state.type).toBe('in-path');
    const { leaf: active } = getLeafState(step.state);
    expect(active.type).toBe('in-node');
    expect((active as InNodeState).node.id).toBe('s1');
  });

  it('unwraps in-loop to the innermost screen state', async () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        {
          id: 'loop-l',
          type: 'loop',
          props: { type: 'static', values: ['a', 'b'] },
        },
        makeScreen('s-item', 'item'),
        makeScreen('s-end', 'end'),
      ],
      edges: [
        seq('start', 'loop-l'),
        { type: 'loop-template', from: 'loop-l', to: 's-item' },
        seq('loop-l', 's-end'),
      ],
    };
    const step = await startExperiment(flow, 'start');
    expect(step.state.type).toBe('in-loop');
    const { leaf: active } = getLeafState(step.state);
    expect(active.type).toBe('in-node');
    expect((active as InNodeState).node.id).toBe('s-item');
  });

  it('returns end state unchanged', async () => {
    const flow: ExperimentFlow = {
      nodes: [{ id: 'start', type: 'start' }, makeScreen('s1', 's1')],
      edges: [seq('start', 's1')],
    };
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, {});
    const { leaf } = getLeafState(step.state);

    expect(step.state.type).toBe('end');
    expect(leaf).toBe(step.state);
  });
});
