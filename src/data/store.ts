import { startExperiment, traverse } from "@/lib/flow";
import { FlowStep } from "@/lib/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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
        const step = await startExperiment(experiment, startNodeId);
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
        const nextStep = await traverse(step, data);
        set({ step: nextStep });
      } catch (err) {
        throw err;
      } finally {
        set({ isLoading: false });
      }
    },
  }),
  // persist(
  //   {
  //     name: "experiment",
  //     // storage: createJSONStorage(() => sessionStorage),
  //     partialize: (state) => ({ step: state.step }),
  //   },
  // ),
);
