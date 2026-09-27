import {
  isEnded,
  recordEnteredAt,
  startExperiment,
  traverseWithTiming,
} from '@experiment-hub/engine/flow';
import { Context, ExperimentFlow, FlowStep } from '@experiment-hub/engine/types';
import { createRun, Run, send } from './send';
import { create } from 'zustand';

type ExperimentStore = {
  step: FlowStep | null;
  run: Run | null;
  slug: string | null;
  // Number of checkpoint visits committed so far. Each visit's seq is its
  // position in the run; an attempt that fails is replayed from here, so a
  // retry resends the same seq values and the backend dedupes them.
  seq: number;
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

export const useExperimentStore = create<ExperimentStore>()((set, get) => {
  // Seq to assign to the next checkpoint visit in the in-flight attempt. The
  // checkpoint handler is captured once by startExperiment, so it reads this
  // closure variable rather than store state.
  let cursor = 0;

  const persist = async (context: Context, checkpoint: string) => {
    const { run, slug } = get();
    if (!run) throw new Error('No active run');
    const seq = cursor;
    await send(context, {
      ...run,
      experiment: slug ?? 'unknown',
      checkpoint,
      seq,
    });
    cursor = seq + 1;
  };

  return {
    step: null,
    run: null,
    slug: null,
    seq: 0,
    isLoading: false,
    error: null,
    reset: () =>
      set({
        step: null,
        run: null,
        slug: null,
        seq: 0,
        isLoading: false,
        error: null,
      }),
    start: async (
      experiment: ExperimentFlow,
      startNodeId?: string,
      locale?: string,
      slug?: string,
    ) => {
      // Reuse the run only when retrying start() for the same experiment:
      // if its first checkpoint committed but the response was lost, a new
      // run would orphan that row. A different slug is a different run.
      const prev = get();
      const slugKey = slug ?? null;
      const reusable = prev.slug === slugKey ? prev.run : null;
      // Drop a run issued for another slug up front, so a failed createRun
      // can't leave it paired with the new slug for the next retry.
      set({
        isLoading: true,
        error: null,
        slug: slugKey,
        run: reusable,
        seq: 0,
      });
      try {
        const run = reusable ?? (await createRun(slug ?? 'unknown'));
        set({ run });
        cursor = 0;
        const step = await startExperiment(
          experiment,
          startNodeId,
          { onCheckpoint: persist },
          locale,
        ).then(recordEnteredAt);
        // Persist before committing an ended step — a failed final POST must
        // leave the run retryable rather than reporting "done" unsaved.
        if (isEnded(step)) await persist(step.context, END_CHECKPOINT);
        set({ step, seq: cursor });
      } catch (err) {
        console.error('Failed to load experiment:', err);
        set({ error: 'Something went wrong while loading the experiment.' });
      } finally {
        set({ isLoading: false });
      }
    },
    next: async (data?: Context['data']) => {
      const { step, seq } = get();
      if (!step) return;
      set({ isLoading: true, error: null });
      cursor = seq;
      try {
        const nextStep = await traverseWithTiming(step, data).then(
          recordEnteredAt,
        );
        // Experiments without checkpoint nodes would otherwise persist
        // nothing: a completed run always writes its final context, before
        // the ended step is committed so a failure keeps the last screen
        // retryable.
        if (isEnded(nextStep)) await persist(nextStep.context, END_CHECKPOINT);
        set({ step: nextStep, seq: cursor });
      } catch (err) {
        console.error('Failed to advance experiment:', err);
        set({
          error:
            'Something went wrong while saving your answer. Please try again.',
        });
      } finally {
        set({ isLoading: false });
      }
    },
  };
});
