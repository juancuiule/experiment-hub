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

// One start() attempt and the traversal it produces. The checkpoint handler
// closes over its session, so every POST carries the run/token/slug that
// traversal was issued — never whatever the store holds at request time.
type Session = {
  slug: string | null;
  run: Run | null;
  // Seq for the next checkpoint visit in the in-flight attempt.
  cursor: number;
  // Synchronous lock for next(): set before reading step/seq, cleared when
  // the attempt settles. Separate from rendered isLoading, which a React
  // commit may not have applied yet when a second submit fires.
  inFlight: boolean;
};

export const useExperimentStore = create<ExperimentStore>()((set, get) => {
  // The session allowed to write store state. start() replaces it and reset()
  // clears it; a start/next whose session is no longer active discards its
  // results, so overlapping or post-navigation completions can't clobber a
  // newer run.
  let active: Session | null = null;
  // The session whose traversal produced the step currently in the store.
  let committed: Session | null = null;

  const owns = (session: Session) => active === session;

  const persistFor =
    (session: Session) => async (context: Context, checkpoint: string) => {
      if (!session.run) throw new Error('No active run');
      const seq = session.cursor;
      await send(context, {
        ...session.run,
        experiment: session.slug ?? 'unknown',
        checkpoint,
        seq,
      });
      session.cursor = seq + 1;
    };

  return {
    step: null,
    run: null,
    slug: null,
    seq: 0,
    isLoading: false,
    error: null,
    reset: () => {
      active = null;
      committed = null;
      set({
        step: null,
        run: null,
        slug: null,
        seq: 0,
        isLoading: false,
        error: null,
      });
    },
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
      const session: Session = {
        slug: slugKey,
        run: prev.slug === slugKey ? prev.run : null,
        cursor: 0,
        inFlight: false,
      };
      active = session;
      set({
        isLoading: true,
        error: null,
        slug: slugKey,
        run: session.run,
        seq: 0,
      });
      try {
        if (!session.run) {
          const run = await createRun(slug ?? 'unknown');
          if (!owns(session)) return;
          session.run = run;
          set({ run });
        }
        const persist = persistFor(session);
        const step = await startExperiment(
          experiment,
          startNodeId,
          { onCheckpoint: persist },
          locale,
        ).then(recordEnteredAt);
        if (!owns(session)) return;
        // Persist before committing an ended step — a failed final POST must
        // leave the run retryable rather than reporting "done" unsaved. Only
        // the owner writes "end": a superseded session must not record a
        // completed run for a participant who never reached it.
        if (isEnded(step)) await persist(step.context, END_CHECKPOINT);
        if (!owns(session)) return;
        committed = session;
        set({ step, seq: session.cursor });
      } catch (err) {
        if (!owns(session)) return;
        console.error('Failed to load experiment:', err);
        set({ error: 'Something went wrong while loading the experiment.' });
      } finally {
        if (owns(session)) set({ isLoading: false });
      }
    },
    next: async (data?: Context['data']) => {
      // Only advance a step produced by the active session — if a newer
      // start() is in flight, this step is stale and must not be committed.
      const session = committed;
      // Overlapping submits would replay the same step and seq with
      // different answers; only one attempt per session may be in flight.
      if (!session || !owns(session) || session.inFlight) return;
      const { step, seq } = get();
      if (!step) return;
      session.inFlight = true;
      set({ isLoading: true, error: null });
      session.cursor = seq;
      try {
        const nextStep = await traverseWithTiming(step, data).then(
          recordEnteredAt,
        );
        if (!owns(session)) return;
        // Experiments without checkpoint nodes would otherwise persist
        // nothing: a completed run always writes its final context, before
        // the ended step is committed so a failure keeps the last screen
        // retryable. Only the owner writes "end" — a superseded session
        // must not record completion for an abandoned traversal.
        if (isEnded(nextStep)) {
          await persistFor(session)(nextStep.context, END_CHECKPOINT);
        }
        if (!owns(session)) return;
        set({ step: nextStep, seq: session.cursor });
      } catch (err) {
        if (!owns(session)) return;
        console.error('Failed to advance experiment:', err);
        set({
          error:
            'Something went wrong while saving your answer. Please try again.',
        });
      } finally {
        session.inFlight = false;
        if (owns(session)) set({ isLoading: false });
      }
    },
  };
});
