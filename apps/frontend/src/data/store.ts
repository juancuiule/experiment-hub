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
    version?: string,
  ) => Promise<void>;
  next: (data?: Context['data']) => Promise<void>;
};

const END_CHECKPOINT = 'end';
// Slug fallback for callers that never supplied one — the backend token is
// signed over this string, so both call sites must agree.
const FALLBACK_SLUG = 'unknown';

// One start() attempt and the traversal it produces. The checkpoint handler
// closes over its session, so every POST carries the run/token/slug that
// traversal was issued — never whatever the store holds at request time.
type Session = {
  slug: string | null;
  run: Run | null;
  // Seq for the next checkpoint visit in the in-flight attempt.
  nextSeq: number;
  // Synchronous lock: held for the whole start() attempt and by next()
  // between reading step/seq and settling. Separate from rendered
  // isLoading, which a React commit may not have applied yet when a second
  // submit fires — and which can't dedupe overlapping start()s.
  inFlight: boolean;
  // Aborted when the session is superseded or reset, cancelling its
  // in-flight requests so a replaced session can't keep writing (or mint
  // an orphaned run on a StrictMode remount).
  controller: AbortController;
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
      const seq = session.nextSeq;
      await send(
        context,
        {
          ...session.run,
          experiment: session.slug ?? FALLBACK_SLUG,
          checkpoint,
          seq,
        },
        session.controller.signal,
      );
      session.nextSeq = seq + 1;
    };

  return {
    step: null,
    run: null,
    slug: null,
    seq: 0,
    isLoading: false,
    error: null,
    reset: () => {
      active?.controller.abort();
      committed?.controller.abort();
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
      version?: string,
    ) => {
      // Reuse the run only when retrying start() for the same experiment:
      // if its first checkpoint committed but the response was lost, a new
      // run would orphan that row. A different slug is a different run.
      const prev = get();
      const slugKey = slug ?? null;
      // A same-slug start while one is already in flight would mint a second
      // run and orphan the first (StrictMode remounts and retry clicks land
      // here). A different slug is a takeover, not a duplicate.
      if (active?.inFlight && active.slug === slugKey) return;
      const session: Session = {
        slug: slugKey,
        run: prev.slug === slugKey ? prev.run : null,
        nextSeq: 0,
        inFlight: true,
        controller: new AbortController(),
      };
      // Superseding cancels the previous session's pending requests.
      active?.controller.abort();
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
          const run = await createRun(
            slug ?? FALLBACK_SLUG,
            version,
            session.controller.signal,
          );
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
        set({ step, seq: session.nextSeq });
      } catch (err) {
        if (!owns(session)) return;
        console.error('Failed to load experiment:', err);
        // A failed start leaves no committable traversal: drop whatever the
        // previous session left on screen so it can't sit there accepting
        // submits that silently no-op.
        committed = null;
        set({
          step: null,
          error: 'Something went wrong while loading the experiment.',
        });
      } finally {
        session.inFlight = false;
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
      session.nextSeq = seq;
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
        set({ step: nextStep, seq: session.nextSeq });
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
