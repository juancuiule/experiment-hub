import {
  recordEnteredAt,
  startExperiment,
  traverseWithTiming,
} from '@/lib/flow';
import { ExperimentFlow, FlowStep } from '@/lib/types';
import { create } from 'zustand';
import { experiment as defaultExperiment } from './experiment';

type ExperimentStore = {
  step: FlowStep | null;
  isLoading: boolean;
  start: (startNodeId?: string, experimentOverride?: ExperimentFlow) => Promise<void>;
  next: (data?: Record<string, any>) => Promise<void>;
};

export const useExperimentStore = create<ExperimentStore>()((set, get) => ({
  step: null,
  isLoading: false,
  start: async (startNodeId?: string, experimentOverride?: ExperimentFlow) => {
    const exp = experimentOverride ?? defaultExperiment;
    set({ isLoading: true });
    try {
      const step = await startExperiment(exp, startNodeId).then(
        recordEnteredAt,
      );
      set({ step });
    } catch (err) {
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },
  next: async (data?: Record<string, any>) => {
    const { step } = get();
    if (!step) return;
    set({ isLoading: true });
    try {
      const nextStep = await traverseWithTiming(step, data).then(
        recordEnteredAt,
      );
      set({ step: nextStep });
    } catch (err) {
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },
}));
