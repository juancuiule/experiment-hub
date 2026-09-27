import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentFlow, InNodeState } from '@experiment-hub/engine/types';
import { useExperimentStore } from '@/src/data/store';

vi.mock('@/src/data/send', () => ({
  send: vi.fn().mockResolvedValue(undefined),
  createRun: vi.fn(),
}));
import { createRun, send } from '@/src/data/send';

let runCounter = 0;
const resetStore = () => {
  useExperimentStore.setState({
    step: null,
    run: null,
    slug: null,
    seq: 0,
    isLoading: false,
    error: null,
  });
  vi.mocked(send).mockReset().mockResolvedValue(undefined);
  vi.mocked(createRun)
    .mockReset()
    .mockImplementation(async () => {
      runCounter += 1;
      return { runId: `run-${runCounter}`, token: `token-${runCounter}` };
    });
};

const flow: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'cp', type: 'checkpoint', props: { name: 'cp1' } },
    { id: 'screen-1', type: 'screen', props: { slug: 'one' } },
    { id: 'screen-2', type: 'screen', props: { slug: 'two' } },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'cp' },
    { type: 'sequential', from: 'cp', to: 'screen-1' },
    { type: 'sequential', from: 'screen-1', to: 'screen-2' },
  ],
};

const nodeId = (state: InNodeState | unknown) => (state as InNodeState).node.id;

describe('useExperimentStore', () => {
  beforeEach(resetStore);

  it('starts on a null step that is not loading', () => {
    const { step, isLoading } = useExperimentStore.getState();
    expect(step).toBeNull();
    expect(isLoading).toBe(false);
  });

  it('start() auto-advances past start/checkpoint onto the first screen', async () => {
    await useExperimentStore.getState().start(flow);
    const { step, isLoading } = useExperimentStore.getState();
    expect(step?.state.type).toBe('in-node');
    expect(nodeId(step?.state)).toBe('screen-1');
    expect(isLoading).toBe(false);
  });

  it('start() records an enteredAt timing for the entered screen', async () => {
    await useExperimentStore.getState().start(flow);
    const { step } = useExperimentStore.getState();
    const timings = step?.context.timings ?? {};
    const entries = Object.values(timings);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toMatchObject({ enteredAt: expect.any(String) });
  });

  it('start() honors an explicit startNodeId', async () => {
    await useExperimentStore.getState().start(flow, 'start');
    expect(nodeId(useExperimentStore.getState().step?.state)).toBe('screen-1');
  });

  it('next() advances to the following screen', async () => {
    await useExperimentStore.getState().start(flow);
    await useExperimentStore.getState().next({ one: 'answer' });
    const { step, isLoading } = useExperimentStore.getState();
    expect(nodeId(step?.state)).toBe('screen-2');
    expect(isLoading).toBe(false);
  });

  it('next() is a no-op when there is no current step', async () => {
    await useExperimentStore.getState().next({ anything: 1 });
    const { step } = useExperimentStore.getState();
    expect(step).toBeNull();
  });

  it('resets isLoading to false even after start completes', async () => {
    const promise = useExperimentStore.getState().start(flow);
    expect(useExperimentStore.getState().isLoading).toBe(true);
    await promise;
    expect(useExperimentStore.getState().isLoading).toBe(false);
  });

  it('reset() clears step, isLoading, and error after a start()', async () => {
    await useExperimentStore.getState().start(flow);
    expect(useExperimentStore.getState().step).not.toBeNull();

    useExperimentStore.getState().reset();

    const { step, isLoading, error } = useExperimentStore.getState();
    expect(step).toBeNull();
    expect(isLoading).toBe(false);
    expect(error).toBeNull();
  });

  it('reuses runId when retrying the same slug, mints a new one on change', async () => {
    await useExperimentStore.getState().start(flow, undefined, undefined, 'a');
    const first = useExperimentStore.getState().run?.runId;

    await useExperimentStore.getState().start(flow, undefined, undefined, 'a');
    expect(useExperimentStore.getState().run?.runId).toBe(first);

    await useExperimentStore.getState().start(flow, undefined, undefined, 'b');
    const second = useExperimentStore.getState().run?.runId;
    expect(second).not.toBe(first);
  });

  it('does not pair a stale run with a new slug when createRun fails', async () => {
    await useExperimentStore.getState().start(flow, undefined, undefined, 'a');
    vi.mocked(createRun).mockRejectedValueOnce(new Error('network error'));

    await useExperimentStore.getState().start(flow, undefined, undefined, 'b');
    expect(useExperimentStore.getState().run).toBeNull();
    expect(useExperimentStore.getState().error).not.toBeNull();
  });

  it('sends the run token and a per-visit seq with each checkpoint', async () => {
    await useExperimentStore.getState().start(flow, undefined, undefined, 'a');
    expect(send).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        runId: expect.stringMatching(/^run-/),
        token: expect.stringMatching(/^token-/),
        experiment: 'a',
        checkpoint: 'cp1',
        seq: 0,
      }),
    );
    expect(useExperimentStore.getState().seq).toBe(1);
  });

  it('keeps the pre-end step retryable when the final persist fails', async () => {
    const terminalFlow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'screen-1', type: 'screen', props: { slug: 'only' } },
      ],
      edges: [{ type: 'sequential', from: 'start', to: 'screen-1' }],
    };
    await useExperimentStore.getState().start(terminalFlow);

    vi.mocked(send).mockRejectedValueOnce(new Error('network error'));
    await useExperimentStore.getState().next({ only: 'answer' });
    const { step, error } = useExperimentStore.getState();
    expect(nodeId(step?.state)).toBe('screen-1');
    expect(error).not.toBeNull();

    await useExperimentStore.getState().next({ only: 'answer' });
    const after = useExperimentStore.getState();
    expect(after.error).toBeNull();
    expect(send).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ checkpoint: 'end' }),
    );
  });
});

const flowWithCheckpointAfterFirst: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'screen-1', type: 'screen', props: { slug: 'one' } },
    { id: 'cp-mid', type: 'checkpoint', props: { name: 'mid' } },
    { id: 'screen-2', type: 'screen', props: { slug: 'two' } },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'screen-1' },
    { type: 'sequential', from: 'screen-1', to: 'cp-mid' },
    { type: 'sequential', from: 'cp-mid', to: 'screen-2' },
  ],
};

describe('error state', () => {
  beforeEach(resetStore);

  it('next() failure sets error and resets isLoading to false', async () => {
    await useExperimentStore.getState().start(flowWithCheckpointAfterFirst);
    vi.mocked(send).mockRejectedValueOnce(new Error('network error'));
    await useExperimentStore.getState().next({ one: 'answer' });
    const { error, isLoading } = useExperimentStore.getState();
    expect(error).toBe('Something went wrong while saving your answer. Please try again.');
    expect(isLoading).toBe(false);
  });

  it('a subsequent successful next() clears the error', async () => {
    await useExperimentStore.getState().start(flow);
    useExperimentStore.setState({ error: 'previous error' });
    await useExperimentStore.getState().next({ one: 'answer' });
    expect(useExperimentStore.getState().error).toBeNull();
  });

  it('a retried checkpoint resends the same seq; the next visit gets a new one', async () => {
    await useExperimentStore.getState().start(flowWithCheckpointAfterFirst);
    vi.mocked(send).mockRejectedValueOnce(new Error('network error'));

    await useExperimentStore.getState().next({ one: 'answer' });
    await useExperimentStore.getState().next({ one: 'answer' });

    const seqs = vi.mocked(send).mock.calls.map(([, meta]) => meta.seq);
    expect(seqs).toEqual([0, 0]);
    expect(useExperimentStore.getState().seq).toBe(1);
  });
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

describe('overlapping starts', () => {
  beforeEach(resetStore);

  it('a stale start resolving late cannot overwrite the newer run', async () => {
    const runA = deferred<{ runId: string; token: string }>();
    vi.mocked(createRun)
      .mockImplementationOnce(() => runA.promise)
      .mockImplementationOnce(async () => ({ runId: 'run-b', token: 'token-b' }));

    const startA = useExperimentStore.getState().start(flow, undefined, undefined, 'a');
    await useExperimentStore.getState().start(flow, undefined, undefined, 'b');

    runA.resolve({ runId: 'run-a', token: 'token-a' });
    await startA;

    const state = useExperimentStore.getState();
    expect(state.slug).toBe('b');
    expect(state.run?.runId).toBe('run-b');
    expect(nodeId(state.step?.state)).toBe('screen-1');
    expect(state.isLoading).toBe(false);

    // Every checkpoint went out with the run + slug it was issued for.
    for (const [, meta] of vi.mocked(send).mock.calls) {
      expect(meta.runId).toBe('run-b');
      expect(meta.token).toBe('token-b');
      expect(meta.experiment).toBe('b');
    }
  });

  it('a stale traversal binds its later checkpoints to its own run', async () => {
    const twoCheckpoints: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'cp-1', type: 'checkpoint', props: { name: 'first' } },
        { id: 'cp-2', type: 'checkpoint', props: { name: 'second' } },
        { id: 'screen-1', type: 'screen', props: { slug: 'one' } },
      ],
      edges: [
        { type: 'sequential', from: 'start', to: 'cp-1' },
        { type: 'sequential', from: 'cp-1', to: 'cp-2' },
        { type: 'sequential', from: 'cp-2', to: 'screen-1' },
      ],
    };
    const cpA = deferred<void>();
    vi.mocked(createRun)
      .mockImplementationOnce(async () => ({ runId: 'run-a', token: 'token-a' }))
      .mockImplementationOnce(async () => ({ runId: 'run-b', token: 'token-b' }));
    vi.mocked(send).mockImplementationOnce(() => cpA.promise);

    // A stalls on its first checkpoint; B takes over the store meanwhile.
    const startA = useExperimentStore
      .getState()
      .start(twoCheckpoints, undefined, undefined, 'a');
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    await useExperimentStore
      .getState()
      .start(twoCheckpoints, undefined, undefined, 'b');
    cpA.resolve();
    await startA;

    // A's second checkpoint fires after B owns the store — it must still
    // carry run A, not B's run or slug.
    const aCalls = vi
      .mocked(send)
      .mock.calls.map(([, meta]) => meta)
      .filter((meta) => meta.runId === 'run-a');
    expect(aCalls.map((m) => m.checkpoint)).toEqual(['first', 'second']);
    for (const meta of aCalls) {
      expect(meta).toMatchObject({ token: 'token-a', experiment: 'a' });
    }
    for (const [, meta] of vi.mocked(send).mock.calls) {
      if (meta.experiment === 'b') expect(meta.runId).toBe('run-b');
    }
    expect(useExperimentStore.getState().run?.runId).toBe('run-b');
  });

  it('a start that settles after reset() leaves the store cleared', async () => {
    const runA = deferred<{ runId: string; token: string }>();
    vi.mocked(createRun).mockImplementationOnce(() => runA.promise);

    const startA = useExperimentStore.getState().start(flow, undefined, undefined, 'a');
    useExperimentStore.getState().reset();
    runA.resolve({ runId: 'run-a', token: 'token-a' });
    await startA;

    const state = useExperimentStore.getState();
    expect(state.step).toBeNull();
    expect(state.run).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('next() on a stale step is ignored while a newer start is pending', async () => {
    await useExperimentStore
      .getState()
      .start(flowWithCheckpointAfterFirst, undefined, undefined, 'a');
    const runB = deferred<{ runId: string; token: string }>();
    vi.mocked(createRun).mockImplementationOnce(() => runB.promise);

    const startB = useExperimentStore
      .getState()
      .start(flowWithCheckpointAfterFirst, undefined, undefined, 'b');
    vi.mocked(send).mockClear();
    await useExperimentStore.getState().next({ one: 'answer' });
    expect(send).not.toHaveBeenCalled();
    expect(useExperimentStore.getState().error).toBeNull();

    runB.resolve({ runId: 'run-b', token: 'token-b' });
    await startB;
    expect(useExperimentStore.getState().run?.runId).toBe('run-b');
    expect(nodeId(useExperimentStore.getState().step?.state)).toBe('screen-1');
  });
});

