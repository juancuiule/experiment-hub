import {
  recordEnteredAt,
  startExperiment,
  traverseWithTiming,
} from '@experiment-hub/engine/flow';
import { Context, ExperimentFlow, FlowStep } from '@experiment-hub/engine/types';
import { send } from './send';
import { create } from 'zustand';

type ExperimentStore = {
  step: FlowStep | null;
  isLoading: boolean;
  start: (
    experiment: ExperimentFlow,
    startNodeId?: string,
    locale?: string,
  ) => Promise<void>;
  next: (data?: Context['data']) => Promise<void>;
};

export const useExperimentStore = create<ExperimentStore>()((set, get) => ({
  step: null,
  isLoading: false,
  start: async (
    experiment: ExperimentFlow,
    startNodeId?: string,
    locale?: string,
  ) => {
    set({ isLoading: true });
    try {
      const step = await startExperiment(
        experiment,
        startNodeId,
        {
          onCheckpoint: async (context) => {
            await send(context);
          },
        },
        locale,
      ).then(recordEnteredAt);
      set({ step });
    } finally {
      set({ isLoading: false });
    }
  },
  next: async (data?: Context['data']) => {
    const { step } = get();
    if (!step) return;
    set({ isLoading: true });
    try {
      const nextStep = await traverseWithTiming(step, data).then(
        recordEnteredAt,
      );
      set({ step: nextStep });
    } finally {
      set({ isLoading: false });
    }
  },
}));
