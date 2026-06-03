import { describe, expect, it } from 'vitest';
import { startExperiment, traverse } from '@experiment-hub/engine/flow';

import { makeScreen, seq } from '../test-helpers';
import { ExperimentFlow } from '@experiment-hub/engine/types';

describe('path', () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: 'start', type: 'start' },
      { id: 'path-q', type: 'path', props: { name: 'Questions' } },
      makeScreen('screen-q1', 'q1'),
      makeScreen('screen-q2', 'q2'),
      makeScreen('screen-q3', 'q3'),
      makeScreen('screen-end', 'end'),
    ],
    edges: [
      seq('start', 'path-q'),
      { type: 'path-contains', from: 'path-q', to: 'screen-q1', order: 0 },
      { type: 'path-contains', from: 'path-q', to: 'screen-q2', order: 1 },
      { type: 'path-contains', from: 'path-q', to: 'screen-q3', order: 2 },
      seq('path-q', 'screen-end'),
    ],
  };

  it('starts on the first child of the path', async () => {
    const step = await startExperiment(flow, 'start');
    expect(step.state.type).toBe('in-path');
    expect((step.state as any).innerState.node.id).toBe('screen-q1');
  });

  it('advances through path children in order', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { a: 1 });
    expect((step.state as any).innerState.node.id).toBe('screen-q2');
    step = await traverse(step, { a: 2 });
    expect((step.state as any).innerState.node.id).toBe('screen-q3');
  });

  it('exits the path after the last child and advances to the next sequential node', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { a: 1 });
    step = await traverse(step, { a: 2 });
    step = await traverse(step, { a: 3 }); // q3 done → exit path
    expect((step.state as any).node.id).toBe('screen-end');
  });

  it('tracks visited node ids in context.paths[nodeId].order', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { a: 1 });
    step = await traverse(step, { a: 2 });
    step = await traverse(step, { a: 3 });
    expect(step.context.paths?.['path-q']?.order).toEqual([
      'screen-q1',
      'screen-q2',
      'screen-q3',
    ]);
  });

  it('preserves screen data collected inside the path, nested under the path id', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { answer: 'yes' });
    step = await traverse(step, { answer: 'no' });
    step = await traverse(step, { answer: 'maybe' });
    expect(step.context.data?.['path-q']?.['q1']).toEqual({ answer: 'yes' });
    expect(step.context.data?.['path-q']?.['q2']).toEqual({ answer: 'no' });
    expect(step.context.data?.['path-q']?.['q3']).toEqual({ answer: 'maybe' });
  });
});

describe('path with randomized children', () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: 'start', type: 'start' },
      {
        id: 'path-r',
        type: 'path',
        props: { name: 'Random', randomized: true },
      },
      makeScreen('s1', 'slug1'),
      makeScreen('s2', 'slug2'),
      makeScreen('s3', 'slug3'),
    ],
    edges: [
      seq('start', 'path-r'),
      { type: 'path-contains', from: 'path-r', to: 's1', order: 0 },
      { type: 'path-contains', from: 'path-r', to: 's2', order: 1 },
      { type: 'path-contains', from: 'path-r', to: 's3', order: 2 },
    ],
  };

  it('visits all children exactly once even when randomized', async () => {
    let step = await startExperiment(flow, 'start');
    const seen: string[] = [];
    while (step.state.type === 'in-path') {
      seen.push((step.state as any).innerState.node.props.slug);
      step = await traverse(step, {});
    }
    expect(seen.sort()).toEqual(['slug1', 'slug2', 'slug3']);
  });

  it('tracks all slugs in context.paths order regardless of shuffle', async () => {
    let step = await startExperiment(flow, 'start');
    while (step.state.type === 'in-path') step = await traverse(step, {});
    const order = step.context.paths?.['path-r']?.order ?? [];
    expect(order.sort()).toEqual(['s1', 's2', 's3']);
  });
});

describe('path with a branch node as a child', () => {
  // The branch auto-traverses when reached inside the path, routing to a
  // screen that is NOT in the path-contains list. The path advances its step
  // counter once the routed-to screen signals "done" (no sequential edge out).
  const flow: ExperimentFlow = {
    nodes: [
      { id: 'start', type: 'start' },
      { id: 'path-quiz', type: 'path', props: { name: 'Adaptive quiz' } },
      makeScreen('screen-intro', 'intro'),
      {
        id: 'branch-skill',
        type: 'branch',
        props: {
          name: 'Skill level router',
          branches: [
            {
              id: 'beginner',
              name: 'Beginner',
              config: {
                type: 'simple',
                operator: 'eq',
                value: 'beginner',
                dataKey: '$$path-quiz.intro.level',
              },
            },
            {
              id: 'expert',
              name: 'Expert',
              config: {
                type: 'simple',
                operator: 'eq',
                value: 'expert',
                dataKey: '$$path-quiz.intro.level',
              },
            },
          ],
        },
      },
      makeScreen('screen-beginner', 'beginner-q'),
      makeScreen('screen-expert', 'expert-q'),
      makeScreen('screen-end', 'end'),
    ],
    edges: [
      seq('start', 'path-quiz'),
      {
        type: 'path-contains',
        from: 'path-quiz',
        to: 'screen-intro',
        order: 0,
      },
      {
        type: 'path-contains',
        from: 'path-quiz',
        to: 'branch-skill',
        order: 1,
      },
      // Branch routes to screens that are NOT path children — no path-contains edge
      {
        type: 'branch-condition',
        from: 'branch-skill.beginner',
        to: 'screen-beginner',
      },
      {
        type: 'branch-condition',
        from: 'branch-skill.expert',
        to: 'screen-expert',
      },
      { type: 'branch-default', from: 'branch-skill', to: 'screen-expert' },
      seq('path-quiz', 'screen-end'),
    ],
  };

  it('after submitting the intro screen the branch auto-traverses and lands on the selected screen', async () => {
    let step = await startExperiment(flow, 'start'); // in-path, step=0, innerState=screen-intro
    step = await traverse(step, { level: 'beginner' });
    // branch-skill is the next path child and auto-traverses immediately via enterStep
    expect(step.state.type).toBe('in-path');
    expect((step.state as any).innerState.node.id).toBe('screen-beginner');
    expect(step.context.branches?.['branch-skill']).toBe('beginner');
  });

  it('branch resolves using previously collected context data in the same traverse call', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { level: 'beginner' }); // intro + branch resolved in one step
    expect((step.state as any).innerState.node.id).toBe('screen-beginner');
    expect(step.context.branches?.['branch-skill']).toBe('beginner');
  });

  it("routes to the expert screen when context says 'expert'", async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { level: 'expert' }); // intro + branch resolved in one step
    expect((step.state as any).innerState.node.id).toBe('screen-expert');
    expect(step.context.branches?.['branch-skill']).toBe('expert');
  });

  it('path exits to the next sequential node after the branch-target screen is submitted', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { level: 'expert' }); // intro + branch resolved in one step
    step = await traverse(step, { done: true }); // submit screen-expert → path done → screen-end
    expect((step.state as any).node.id).toBe('screen-end');
  });

  it('path order records the declared path children by node id', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { level: 'beginner' }); // intro + branch → screen-beginner
    step = await traverse(step, { done: true }); // screen-beginner → path done → screen-end
    expect(step.context.paths?.['path-quiz']?.order).toEqual([
      'screen-intro',
      'branch-skill',
    ]);
  });
});

describe('path with a checkpoint node as a child', () => {
  // Checkpoint auto-traverses (records timestamp + advances via its sequential
  // edge). The sequential edge points to a screen that is NOT a path child.
  // The path step advances once that screen signals "done".
  const flow: ExperimentFlow = {
    nodes: [
      { id: 'start', type: 'start' },
      { id: 'path-cp', type: 'path', props: { name: 'Path with checkpoint' } },
      makeScreen('screen-q1', 'q1'),
      { id: 'cp-inner', type: 'checkpoint', props: { name: 'mid-checkpoint' } },
      makeScreen('screen-after', 'after-cp'),
      makeScreen('screen-end', 'end'),
    ],
    edges: [
      seq('start', 'path-cp'),
      { type: 'path-contains', from: 'path-cp', to: 'screen-q1', order: 0 },
      { type: 'path-contains', from: 'path-cp', to: 'cp-inner', order: 1 },
      // Checkpoint's sequential edge leads to a screen that is NOT a path child
      seq('cp-inner', 'screen-after'),
      seq('path-cp', 'screen-end'),
    ],
  };

  it('the checkpoint auto-traverses and its timestamp is recorded in context', async () => {
    const before = Date.now();
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { a: 1 }); // submit q1 → path advances to cp-inner (pending)
    step = await traverse(step, {}); // trigger cp auto-traverse → screen-after
    const after = Date.now();
    const ts = step.context.checkpoints?.['mid-checkpoint'];
    expect(ts).toBeDefined();
    expect(new Date(ts!).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(ts!).getTime()).toBeLessThanOrEqual(after);
  });

  it('checkpoint as path child auto-traverses and lands on its sequential-edge target', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { a: 1 }); // q1 → cp auto-traverses → screen-after
    expect((step.state as any).innerState.node.id).toBe('screen-after');
  });

  it('path exits to screen-end after the post-checkpoint screen is submitted', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { a: 1 }); // q1 → cp auto-traverses → screen-after
    step = await traverse(step, { b: 2 }); // submit screen-after → path done → screen-end
    expect((step.state as any).node.id).toBe('screen-end');
  });
});

describe('path order tracks all child node types', () => {
  // path children: screen → branch → checkpoint
  const flow: ExperimentFlow = {
    nodes: [
      { id: 'start', type: 'start' },
      { id: 'path-all', type: 'path', props: { name: 'Mixed' } },
      makeScreen('s-q1', 'q1'),
      {
        id: 'branch-lvl',
        type: 'branch',
        props: {
          name: 'Level',
          branches: [
            {
              id: 'easy',
              name: 'Easy',
              config: {
                type: 'simple',
                operator: 'eq',
                value: 'easy',
                dataKey: '$$path-all.q1.level',
              },
            },
          ],
        },
      },
      makeScreen('s-easy', 'easy-screen'),
      { id: 'cp-mid', type: 'checkpoint', props: { name: 'mid' } },
      makeScreen('s-after-cp', 'after-cp'),
      makeScreen('s-end', 'end'),
    ],
    edges: [
      seq('start', 'path-all'),
      { type: 'path-contains', from: 'path-all', to: 's-q1', order: 0 },
      { type: 'path-contains', from: 'path-all', to: 'branch-lvl', order: 1 },
      { type: 'path-contains', from: 'path-all', to: 'cp-mid', order: 2 },
      { type: 'branch-condition', from: 'branch-lvl.easy', to: 's-easy' },
      { type: 'branch-default', from: 'branch-lvl', to: 's-easy' },
      seq('cp-mid', 's-after-cp'),
      seq('path-all', 's-end'),
    ],
  };

  it('order contains node ids for all child types (screen, branch, checkpoint)', async () => {
    let step = await startExperiment(flow, 'start'); // on s-q1
    step = await traverse(step, { level: 'easy' }); // q1 done → branch auto-traverses → s-easy
    step = await traverse(step, {}); // s-easy done → cp-mid auto-traverses → s-after-cp
    step = await traverse(step, {}); // s-after-cp done → path exits → s-end
    const order = step.context.paths?.['path-all']?.order ?? [];
    expect(order).toEqual(['s-q1', 'branch-lvl', 'cp-mid']);
  });
});

describe('loop as a path child', () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: 'start', type: 'start' },
      { id: 'path-outer', type: 'path', props: { name: 'Outer' } },
      makeScreen('s-before', 'before'),
      {
        id: 'loop-inner',
        type: 'loop',
        props: { type: 'static', values: ['a', 'b'] },
      },
      makeScreen('s-loop-item', 'item'),
      makeScreen('s-end', 'end'),
    ],
    edges: [
      seq('start', 'path-outer'),
      { type: 'path-contains', from: 'path-outer', to: 's-before', order: 0 },
      { type: 'path-contains', from: 'path-outer', to: 'loop-inner', order: 1 },
      { type: 'loop-template', from: 'loop-inner', to: 's-loop-item' },
      seq('path-outer', 's-end'),
    ],
  };

  it('enters the loop after the preceding screen completes', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, {}); // submit s-before → path advances to loop-inner
    expect(step.state.type).toBe('in-path');
    expect((step.state as any).innerState.type).toBe('in-loop');
  });

  it('iterates through all loop values before exiting the path', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, {}); // before → loop (a)
    step = await traverse(step, {}); // item a → item b
    step = await traverse(step, {}); // item b → loop exits → path exits → s-end
    expect((step.state as any).node.id).toBe('s-end');
  });

  it('tracks the loop node id in context.paths order', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, {}); // before
    step = await traverse(step, {}); // item a
    step = await traverse(step, {}); // item b → exit
    expect(step.context.paths?.['path-outer']?.order).toEqual([
      's-before',
      'loop-inner',
    ]);
  });

  it('also populates context.loops for the inner loop', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, {});
    step = await traverse(step, {});
    step = await traverse(step, {});
    expect(step.context.loops?.['loop-inner']?.order).toEqual(['a', 'b']);
  });
});

describe('loop as the first child of a path (order: 0)', () => {
  // Regression: when a loop is the literal first child (order: 0) of a path,
  // context.loops[loopId] must be populated immediately after startExperiment —
  // not only after advancing past a preceding screen.
  const items = [
    { id: '1', correctAnswer: 'yes' },
    { id: '2', correctAnswer: 'yes' },
  ];
  const flow: ExperimentFlow = {
    nodes: [
      { id: 'start', type: 'start' },
      { id: 'p', type: 'path', props: { name: 'P' } },
      {
        id: 'loop',
        type: 'loop',
        props: { type: 'static', values: items, itemKey: 'id' },
      },
      makeScreen('trial', 'trial'),
      makeScreen('end-screen', 'end'),
    ],
    edges: [
      seq('start', 'p'),
      { type: 'path-contains', from: 'p', to: 'loop', order: 0 },
      { type: 'loop-template', from: 'loop', to: 'trial' },
      seq('p', 'end-screen'),
    ],
  };

  it('context.loops[loopId] is defined immediately after startExperiment', async () => {
    const step = await startExperiment(flow, 'start');
    expect(step.context.loops?.['loop']).toBeDefined();
    expect(step.context.loops?.['loop']?.order).toEqual(['1', '2']);
  });

  it('context.loops[loopId] remains populated throughout all iterations', async () => {
    let step = await startExperiment(flow, 'start');
    expect(step.context.loops?.['loop']?.order).toEqual(['1', '2']);
    step = await traverse(step, {}); // trial(1) → trial(2)
    expect(step.context.loops?.['loop']?.order).toEqual(['1', '2']);
    step = await traverse(step, {}); // trial(2) → loop exits → path exits → end
    expect((step.state as any).node.id).toBe('end-screen');
  });

  it('iterates through all loop values and exits path correctly', async () => {
    let step = await startExperiment(flow, 'start');
    expect(step.state.type).toBe('in-path');
    expect((step.state as any).innerState.type).toBe('in-loop');
    step = await traverse(step, { answer: 'yes' }); // trial(1) → trial(2)
    step = await traverse(step, { answer: 'yes' }); // trial(2) → exit loop → end
    expect((step.state as any).node.id).toBe('end-screen');
  });
});

describe('path with branch-default pointing to a later path child', () => {
  // Regression: when branch-default navigates to a node that is also a path
  // child at a later index, that child must not be shown twice.
  //
  // Layout: start → pre-screen → path[screen-a(0), branch(1), screen-b(2), screen-c(3)] → end
  //   branch-condition → screen-extra  (NOT a path child)
  //   branch-default   → screen-b      (IS path child at index 2)
  //
  // The branch reads $$pre.flag — data from pre-screen which is collected
  // BEFORE the path, so the branch can be resolved at path initialization time.
  const flow: ExperimentFlow = {
    nodes: [
      { id: 'start', type: 'start' },
      makeScreen('pre-screen', 'pre'),
      { id: 'path-p', type: 'path', props: { name: 'P' } },
      makeScreen('screen-a', 'a'),
      {
        id: 'branch-x',
        type: 'branch',
        props: {
          name: 'x',
          branches: [
            {
              id: 'match',
              name: 'match',
              config: {
                type: 'simple',
                operator: 'eq',
                value: 'yes',
                dataKey: '$$pre.flag',
              },
            },
          ],
        },
      },
      makeScreen('screen-extra', 'extra'),
      makeScreen('screen-b', 'b'),
      makeScreen('screen-c', 'c'),
      makeScreen('screen-end', 'end'),
    ],
    edges: [
      seq('start', 'pre-screen'),
      seq('pre-screen', 'path-p'),
      { type: 'path-contains', from: 'path-p', to: 'screen-a', order: 0 },
      { type: 'path-contains', from: 'path-p', to: 'branch-x', order: 1 },
      { type: 'path-contains', from: 'path-p', to: 'screen-b', order: 2 },
      { type: 'path-contains', from: 'path-p', to: 'screen-c', order: 3 },
      { type: 'branch-condition', from: 'branch-x.match', to: 'screen-extra' },
      { type: 'branch-default', from: 'branch-x', to: 'screen-b' },
      seq('path-p', 'screen-end'),
    ],
  };

  it('branch-default skips to screen-b then advances to screen-c without revisiting screen-b', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { flag: 'no' }); // pre-screen → path → screen-a
    step = await traverse(step, {}); // screen-a → branch (default) → screen-b
    expect((step.state as any).innerState.node.id).toBe('screen-b');

    step = await traverse(step, {}); // screen-b done → must advance to screen-c, not screen-b again
    expect((step.state as any).innerState.node.id).toBe('screen-c');
  });

  it('branch-condition routes to screen-extra then continues through screen-b and screen-c', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { flag: 'yes' }); // pre-screen → path → screen-a
    step = await traverse(step, {}); // screen-a → branch (condition match) → screen-extra
    expect((step.state as any).innerState.node.id).toBe('screen-extra');

    step = await traverse(step, {}); // screen-extra done → screen-b (next after branch at index 1)
    expect((step.state as any).innerState.node.id).toBe('screen-b');

    step = await traverse(step, {}); // screen-b done → screen-c
    expect((step.state as any).innerState.node.id).toBe('screen-c');
  });

  it('path exits to screen-end after screen-c regardless of which branch was taken', async () => {
    for (const flag of ['no', 'yes']) {
      let step = await startExperiment(flow, 'start');
      step = await traverse(step, { flag }); // pre-screen
      step = await traverse(step, {}); // screen-a → branch resolves
      if (flag === 'yes') step = await traverse(step, {}); // extra screen
      step = await traverse(step, {}); // screen-b
      step = await traverse(step, {}); // screen-c → exit path
      expect((step.state as any).node.id).toBe('screen-end');
    }
  });

  it('stepper: branch-default path — total is pre-computed as 3 at path entry, no shift', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { flag: 'no' }); // pre-screen; path now initializes

    // Path is now active; branch resolves at init: branch-default → screen-b (path child) → total=3
    expect((step.state as any).visibleStep).toBe(0);
    expect((step.state as any).visibleTotal).toBe(3);

    step = await traverse(step, {}); // screen-a → branch (default) → screen-b
    expect((step.state as any).visibleStep).toBe(1);
    expect((step.state as any).visibleTotal).toBe(3);

    step = await traverse(step, {}); // → screen-c
    expect((step.state as any).visibleStep).toBe(2);
    expect((step.state as any).visibleTotal).toBe(3);
  });

  it('stepper: branch-condition path — total is pre-computed as 4 at path entry, no shift', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { flag: 'yes' }); // pre-screen; path initializes with flag in context

    // Branch resolves at init: branch-condition → screen-extra (not a path child) → total=4
    expect((step.state as any).visibleStep).toBe(0);
    expect((step.state as any).visibleTotal).toBe(4);

    step = await traverse(step, {}); // screen-a → branch (condition) → screen-extra
    expect((step.state as any).visibleStep).toBe(1);
    expect((step.state as any).visibleTotal).toBe(4); // already 4, no shift

    step = await traverse(step, {}); // → screen-b
    expect((step.state as any).visibleStep).toBe(2);
    expect((step.state as any).visibleTotal).toBe(4);

    step = await traverse(step, {}); // → screen-c
    expect((step.state as any).visibleStep).toBe(3);
    expect((step.state as any).visibleTotal).toBe(4);
  });
});

describe('path with branch contributing a chain of screens', () => {
  // Layout: start → pre-screen → path[screen-a(0), branch-y(1), screen-z(2)] → end
  //   branch-y condition (resolvable via pre-path data $$pre.flag) → screen-1 → screen-2 (no seq edge)
  //   branch-y default → screen-z (path child at index 2)
  //
  // Condition true:  total = 1 (screen-a) + 2 (screen-1 + screen-2 chain) + 1 (screen-z) = 4
  // Condition false: total = 1 (screen-a) + 0 (default → path child)      + 1 (screen-z) = 2
  const flow: ExperimentFlow = {
    nodes: [
      { id: 'start', type: 'start' },
      makeScreen('pre-screen', 'pre'),
      { id: 'path-p', type: 'path', props: { name: 'P' } },
      makeScreen('screen-a', 'a'),
      {
        id: 'branch-y',
        type: 'branch',
        props: {
          name: 'y',
          branches: [
            {
              id: 'chain',
              name: 'chain',
              config: {
                type: 'simple',
                operator: 'eq',
                value: 'yes',
                dataKey: '$$pre.flag',
              },
            },
          ],
        },
      },
      makeScreen('screen-1', 'one'),
      makeScreen('screen-2', 'two'),
      makeScreen('screen-z', 'z'),
      makeScreen('screen-end', 'end'),
    ],
    edges: [
      seq('start', 'pre-screen'),
      seq('pre-screen', 'path-p'),
      { type: 'path-contains', from: 'path-p', to: 'screen-a', order: 0 },
      { type: 'path-contains', from: 'path-p', to: 'branch-y', order: 1 },
      { type: 'path-contains', from: 'path-p', to: 'screen-z', order: 2 },
      { type: 'branch-condition', from: 'branch-y.chain', to: 'screen-1' },
      seq('screen-1', 'screen-2'),
      { type: 'branch-default', from: 'branch-y', to: 'screen-z' },
      seq('path-p', 'screen-end'),
    ],
  };

  it('condition true: visibleTotal = 4 pre-computed (chain of 2 counted at init)', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { flag: 'yes' }); // pre-screen → path at screen-a
    expect((step.state as any).visibleStep).toBe(0);
    expect((step.state as any).visibleTotal).toBe(4);

    step = await traverse(step, {}); // screen-a → branch → screen-1
    expect((step.state as any).innerState.node.id).toBe('screen-1');
    expect((step.state as any).visibleStep).toBe(1);
    expect((step.state as any).visibleTotal).toBe(4);

    step = await traverse(step, {}); // screen-1 → screen-2 (sequential in chain)
    expect((step.state as any).innerState.node.id).toBe('screen-2');
    expect((step.state as any).visibleStep).toBe(1); // path step didn't advance
    expect((step.state as any).visibleTotal).toBe(4);

    step = await traverse(step, {}); // screen-2 done → screen-z
    expect((step.state as any).innerState.node.id).toBe('screen-z');
    expect((step.state as any).visibleStep).toBe(2);
    expect((step.state as any).visibleTotal).toBe(4);
  });

  it('condition false: visibleTotal = 2 pre-computed (default → path child, no chain)', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { flag: 'no' }); // pre-screen → path at screen-a
    expect((step.state as any).visibleStep).toBe(0);
    expect((step.state as any).visibleTotal).toBe(2);

    step = await traverse(step, {}); // screen-a → branch (default) → screen-z
    expect((step.state as any).innerState.node.id).toBe('screen-z');
    expect((step.state as any).visibleStep).toBe(1);
    expect((step.state as any).visibleTotal).toBe(2);
  });
});

describe('path with branch whose condition depends on in-path data', () => {
  // Layout: start → path[screen-a(0), branch-y(1), screen-b(2), screen-c(3)] → end
  //   branch-y condition uses $$path-p.a.flag (in-path data, absent at path init)
  //   branch-y condition → screen-extra (not a path child)
  //   branch-y default → screen-b (path child at index 2)
  //
  // At init:              contribution = 0 → visibleTotal = 3
  // Runtime (flag='yes'): actual = 1 (screen-extra) → delta +1 → visibleTotal = 4
  // Runtime (flag='no'):  actual = 0 (default → path child) → delta 0 → visibleTotal = 3
  const flow: ExperimentFlow = {
    nodes: [
      { id: 'start', type: 'start' },
      { id: 'path-p', type: 'path', props: { name: 'P' } },
      makeScreen('screen-a', 'a'),
      {
        id: 'branch-y',
        type: 'branch',
        props: {
          name: 'y',
          branches: [
            {
              id: 'in-path',
              name: 'in-path',
              config: {
                type: 'simple',
                operator: 'eq',
                value: 'yes',
                dataKey: '$$path-p.a.flag',
              },
            },
          ],
        },
      },
      makeScreen('screen-extra', 'extra'),
      makeScreen('screen-b', 'b'),
      makeScreen('screen-c', 'c'),
      makeScreen('screen-end', 'end'),
    ],
    edges: [
      seq('start', 'path-p'),
      { type: 'path-contains', from: 'path-p', to: 'screen-a', order: 0 },
      { type: 'path-contains', from: 'path-p', to: 'branch-y', order: 1 },
      { type: 'path-contains', from: 'path-p', to: 'screen-b', order: 2 },
      { type: 'path-contains', from: 'path-p', to: 'screen-c', order: 3 },
      { type: 'branch-condition', from: 'branch-y.in-path', to: 'screen-extra' },
      { type: 'branch-default', from: 'branch-y', to: 'screen-b' },
      seq('path-p', 'screen-end'),
    ],
  };

  it('init: visibleTotal = 3 (unresolvable branch contributes 0, not branch-default)', async () => {
    const step = await startExperiment(flow, 'start');
    expect((step.state as any).visibleStep).toBe(0);
    expect((step.state as any).visibleTotal).toBe(3);
  });

  it('condition true at runtime: visibleTotal corrected to 4', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { flag: 'yes' }); // screen-a → branch → screen-extra
    expect((step.state as any).innerState.node.id).toBe('screen-extra');
    expect((step.state as any).visibleStep).toBe(1);
    expect((step.state as any).visibleTotal).toBe(4);
  });

  it('condition false at runtime: visibleTotal stays 3 (branch-default → path child)', async () => {
    let step = await startExperiment(flow, 'start');
    step = await traverse(step, { flag: 'no' }); // screen-a → branch (default) → screen-b
    expect((step.state as any).innerState.node.id).toBe('screen-b');
    expect((step.state as any).visibleStep).toBe(1);
    expect((step.state as any).visibleTotal).toBe(3);
  });
});
