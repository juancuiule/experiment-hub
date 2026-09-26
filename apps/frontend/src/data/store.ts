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
    // Reuse the runId only when retrying start() for the same experiment: if
    // the first checkpoint POST committed but its response was lost, minting
    // a new id would orphan the earlier row into a second run. A different
    // slug means a genuinely different run — mint a fresh id so the backend's
    // run/experiment binding doesn't reject the new experiment's writes.
    const prev = get();
    const runId =
      prev.runId !== null && prev.slug === (slug ?? null)
        ? prev.runId
        : crypto.randomUUID();
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
      // Persist before committing an ended step — a failed final POST must
      // leave the run retryable rather than reporting "done" with unsaved
      // data.
      if (isEnded(step)) {
        await send(step.context, {
          runId,
          experiment: slug ?? 'unknown',
          checkpoint: END_CHECKPOINT,
        });
      }
      set({ step });
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
      // Experiments without checkpoint nodes would otherwise persist
      // nothing: a completed run always writes its final context. Persist
      // before committing the ended step — if the POST fails, the current
      // screen stays put and a resubmit retries (server-side dedupe makes
      // a lost-response retry safe).
      if (isEnded(nextStep)) {
        await send(nextStep.context, {
          runId: runId ?? 'unknown',
          experiment: slug ?? 'unknown',
          checkpoint: END_CHECKPOINT,
        });
      }
      set({ step: nextStep });
    } catch (err) {
      console.error('Failed to advance experiment:', err);
      set({ error: 'Something went wrong while saving your answer. Please try again.' });
    } finally {
      set({ isLoading: false });
    }
  },
}));
