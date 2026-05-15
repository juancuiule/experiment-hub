import { getActiveState, startExperiment, traverse } from "@/lib/flow";
import { FlowStep } from "@/lib/types";
import { shuffle } from "@/lib/utils";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { resolveOptions } from "../components/primitives";
import { experiment } from "./experiment";

type ExperimentStore = {
  step: FlowStep | null;
  isLoading: boolean;
  start: (startNodeId?: string) => Promise<void>;
  next: (data?: Record<string, any>) => Promise<void>;
};

export function computeShuffledOptions(
  step: FlowStep,
): Record<string, Array<{ label: string; value: string }>> {
  const activeState = getActiveState(step.state);
  if (activeState.type !== "in-node" || activeState.node.type !== "screen") {
    return {};
  }
  const slug = activeState.node.props.slug;
  const screen = step.experiment.screens?.find((s) => s.slug === slug);
  if (!screen) return {};

  const result: Record<string, Array<{ label: string; value: string }>> = {};
  for (const component of screen.components) {
    if (
      component.componentFamily === "response" &&
      (component.template === "radio" ||
        component.template === "dropdown" ||
        component.template === "checkboxes") &&
      component.props.randomize
    ) {
      const resolved = resolveOptions(component.props.options, step.context);
      result[component.props.dataKey] = shuffle([...resolved]);
    }
  }
  return result;
}

export const useExperimentStore = create<ExperimentStore>()(
  (set, get) => ({
    step: null,
    isLoading: false,
    start: async (startNodeId?: string) => {
      set({ isLoading: true });
      try {
        const step = await startExperiment(experiment, startNodeId);
        const shuffledOptions = computeShuffledOptions(step);
        const enrichedStep: FlowStep = {
          ...step,
          context: {
            ...step.context,
            screenData: {
              ...step.context.screenData,
              shuffledOptions,
            },
          },
        };
        set({ step: enrichedStep });
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
        const shuffledOptions = computeShuffledOptions(nextStep);
        const enrichedStep: FlowStep = {
          ...nextStep,
          context: {
            ...nextStep.context,
            screenData: {
              ...nextStep.context.screenData,
              shuffledOptions,
            },
          },
        };
        set({ step: enrichedStep });
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
