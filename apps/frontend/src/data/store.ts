import {
  isEnded,
  recordEnteredAt,
  startExperiment,
  traverseWithTiming,
} from '@experiment-hub/engine/flow';
import { Context, ExperimentFlow, FlowStep } from '@experiment-hub/engine/types';
import { send } from './send';
import { create } from 'zustand';

type ExperimentStore = {
  step: FlowStep | null;
  runId: string | null;
  slug: string | null;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
  start: (
    experiment: ExperimentFlow,
    startNodeId?: string,
    locale?: string,
    slug?: string,
  ) => Promise<void>;
  next: (data?: Context['data']) => Promise<void>;
};

const END_CHECKPOINT = 'end';

export const useExperimentStore = create<ExperimentStore>()((set, get) => ({
  step: null,
  runId: null,
  slug: null,
  isLoading: false,
  error: null,
  reset: () =>
    set({ step: null, runId: null, slug: null, isLoading: false, error: null }),
  start: async (
    experiment: ExperimentFlow,
    startNodeId?: string,
    locale?: string,
    slug?: string,
  ) => {
    // Reuse the runId across start() retries: if the first checkpoint POST
    // committed but its response was lost, minting a new id would orphan the
    // earlier row into a second run.
    const runId = get().runId ?? crypto.randomUUID();
    set({ isLoading: true, error: null, runId, slug: slug ?? null });
    try {
      const step = await startExperiment(
        experiment,
        startNodeId,
        {
          onCheckpoint: async (context, name) => {
            await send(context, {
              runId,
              experiment: slug ?? 'unknown',
              checkpoint: name,
            });
          },
        },
        locale,
      ).then(recordEnteredAt);
      set({ step });
      if (isEnded(step)) {
        await send(step.context, {
          runId,
          experiment: slug ?? 'unknown',
          checkpoint: END_CHECKPOINT,
        });
      }
    } catch (err) {
      console.error('Failed to load experiment:', err);
      set({ error: 'Something went wrong while loading the experiment.' });
    } finally {
      set({ isLoading: false });
    }
  },
  next: async (data?: Context['data']) => {
    const { step, runId, slug } = get();
    if (!step) return;
    set({ isLoading: true, error: null });
    try {
      const nextStep = await traverseWithTiming(step, data).then(
        recordEnteredAt,
      );
      set({ step: nextStep });
      // Experiments without checkpoint nodes would otherwise persist
      // nothing: a completed run always writes its final context.
      if (isEnded(nextStep)) {
        await send(nextStep.context, {
          runId: runId ?? 'unknown',
          experiment: slug ?? 'unknown',
          checkpoint: END_CHECKPOINT,
        });
      }
    } catch (err) {
      console.error('Failed to advance experiment:', err);
      set({ error: 'Something went wrong while saving your answer. Please try again.' });
    } finally {
      set({ isLoading: false });
    }
  },
}));
