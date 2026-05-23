import {
  recordEnteredAt,
  startExperiment,
  traverseWithTiming,
} from '@/lib/flow';
import { ExperimentFlow, FlowStep, ScreenFormData } from '@/lib/types';
import { create } from 'zustand';

type ExperimentStore = {
  step: FlowStep | null;
  isLoading: boolean;
  start: (experiment: ExperimentFlow, startNodeId?: string) => Promise<void>;
  next: (data?: ScreenFormData) => Promise<void>;
};

export const useExperimentStore = create<ExperimentStore>()((set, get) => ({
  step: null,
  isLoading: false,
  start: async (experiment: ExperimentFlow, startNodeId?: string) => {
    set({ isLoading: true });
    try {
      const step = await startExperiment(experiment, startNodeId).then(
        recordEnteredAt,
      );
      set({ step });
    } finally {
      set({ isLoading: false });
    }
  },
  next: async (data?: ScreenFormData) => {
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
