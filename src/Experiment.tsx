"use client";
import { getActiveState } from "@/lib/flow";
import { ExperimentFlow } from "@/lib/types";
import { Screen } from "@/src/Screen";
import Stepper from "@/src/components/Stepper";
import { useExperimentStore } from "@/src/data/store";
import { useEffect } from "react";

type Props = {
  startingNode?: string;
  experiment?: ExperimentFlow;
};

export default function Experiment(props: Props) {
  const { startingNode, experiment: experimentProp } = props;
  const { step, isLoading, start, next } = useExperimentStore();

  useEffect(() => {
    if (!step) {
      start(startingNode, experimentProp);
    }
  }, [step, startingNode, experimentProp]);

  if (!step) {
    return (
      <>
        <h1 className="text-2xl font-semibold mb-6">Experiment</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(startingNode, experimentProp);
          }}
        >
          <button
            type="submit"
            className="w-full h-10 bg-background-inverted text-content-inverted uppercase text-sm font-medium tracking-wide rounded-sm hover:bg-background-inverted/80 active:scale-[0.98] disabled:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition duration-150 ease-out"
          >
            Start
          </button>
        </form>
      </>
    );
  }

  const activeState = getActiveState(step.state);

  if (activeState.type === "end") {
    return (
      <>
        <h1 className="text-2xl font-semibold mb-2">All done!</h1>
        <p className="text-content-secondary mb-8">
          Thanks for completing the experiment.
        </p>
      </>
    );
  }

  if (activeState.type === "in-node" && activeState.node.type === "screen") {
    const slug = activeState.node.props.slug;
    const screen = step.experiment.screens?.find((s) => s.slug === slug);
    return (
      <>
        {step.state.type === "in-path" && step.state.node.props.stepper && (
          <Stepper
            config={step.state.node.props.stepper}
            step={step.state.step}
            total={step.state.children.length}
          />
        )}
        {step.state.type === "in-loop" && step.state.node.props.stepper && (
          <Stepper
            config={step.state.node.props.stepper}
            step={step.state.index}
            total={step.state.values.length}
          />
        )}
        {screen ? (
          <Screen
            key={[screen.slug, ...Object.entries(step.context.loopData ?? {}).map(([id, item]) => `${id}:${item.index}`)].join("|")}
            screen={screen}
            isLoading={isLoading}
            onNext={next}
            context={step.context}
          />
        ) : (
          <p className="text-error">Screen not found: {slug}</p>
        )}
      </>
    );
  }

  // Fallback for any auto-traversal states still in flight
  return (
    <>
      <p className="text-content-secondary">Loading…</p>
    </>
  );
}
