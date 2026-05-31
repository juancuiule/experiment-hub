import { beforeEach, describe, expect, it } from 'vitest';
import { ExperimentFlow, InNodeState } from '@/lib/types';
import { useExperimentStore } from '@/src/data/store';

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
  beforeEach(() => {
    useExperimentStore.setState({ step: null, isLoading: false });
  });

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
});
