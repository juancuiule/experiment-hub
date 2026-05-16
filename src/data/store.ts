import { recordEnteredAt, startExperiment, traverseWithTiming } from "@/lib/flow";
import { FlowStep } from "@/lib/types";
import { create } from "zustand";
import { experiment } from "./experiment";

type ExperimentStore = {
  step: FlowStep | null;
  isLoading: boolean;
  start: (startNodeId?: string) => Promise<void>;
  next: (data?: Record<string, any>) => Promise<void>;
};

export const useExperimentStore = create<ExperimentStore>()(
  (set, get) => ({
    step: null,
    isLoading: false,
    start: async (startNodeId?: string) => {
      set({ isLoading: true });
      try {
        const rawStep = await startExperiment(experiment, startNodeId);
        const step = recordEnteredAt(rawStep);
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
        const rawNext = await traverseWithTiming(step, data);
        const nextStep = recordEnteredAt(rawNext);
        set({ step: nextStep });
      } catch (err) {
        throw err;
      } finally {
        set({ isLoading: false });
      }
    },
  }),
);
