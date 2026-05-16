import { getActiveState, startExperiment, traverse } from "@/lib/flow";
import { hasRandomizedOptions } from "@/lib/components/response";
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

function isInLoop(state: FlowStep["state"]): boolean {
  return state.type === "in-loop" || (state.type === "in-path" && isInLoop(state.innerState));
}

export function computeShuffledOptions(
  step: FlowStep,
  previousShuffledOptions: Record<string, Array<{ label: string; value: string }>> = {},
): Record<string, Array<{ label: string; value: string }>> {
  const activeState = getActiveState(step.state);
  if (activeState.type !== "in-node" || activeState.node.type !== "screen") {
    return {};
  }
  const slug = activeState.node.props.slug;
  const screen = step.experiment.screens?.find((s) => s.slug === slug);
  if (!screen) return {};

  const result: Record<string, Array<{ label: string; value: string }>> = {};
  const inLoop = isInLoop(step.state);
  for (const component of screen.components) {
    if (component.componentFamily === "response" && hasRandomizedOptions(component)) {
      if (
        inLoop &&
        component.props.reshuffleInLoop === false &&
        previousShuffledOptions[component.props.dataKey]
      ) {
        result[component.props.dataKey] = previousShuffledOptions[component.props.dataKey];
        continue;
      }
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
        const shuffledOptions = computeShuffledOptions(
          nextStep,
          step.context.screenData?.shuffledOptions ?? {},
        );
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
