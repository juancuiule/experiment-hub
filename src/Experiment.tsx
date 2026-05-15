"use client";

import { getActiveState } from "@/lib/flow";
import { Screen } from "@/src/Screen";
import Stepper from "@/src/components/Stepper";
import { useExperimentStore } from "@/src/data/store";
import { useEffect } from "react";

type Props = {
  startingNode?: string;
};

export default function Experiment(props: Props) {
  const { startingNode } = props;
  const { step, isLoading, start, next } = useExperimentStore();

  useEffect(() => {
    if (!step) {
      start(startingNode);
    }
  }, [step]);

  if (!step) {
    return (
      <>
        <h1 className="text-2xl font-semibold mb-6">Experiment</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(startingNode);
          }}
        >
          <button>start</button>
        </form>
      </>
    );
  }

  const activeState = getActiveState(step.state);

  if (activeState.type === "end") {
    return (
      <>
        <h1 className="text-2xl font-semibold mb-2">All done!</h1>
        <p className="text-zinc-500 mb-8">
          Thanks for completing the experiment.
        </p>
        <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4 overflow-auto max-h-64 text-zinc-700 dark:text-zinc-300">
          {JSON.stringify(step.context, null, 2)}
        </pre>
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
            key={screen.slug}
            screen={screen}
            isLoading={isLoading}
            onNext={next}
            context={step.context}
          />
        ) : (
          <p className="text-red-500">Screen not found: {slug}</p>
        )}
        <div className="absolute w-[calc(100vw-512px)] h-[80svh] overflow-y-scroll right-0 top-0 p-2">
          <pre className="font-mono text-xs text-wrap">
            <code className="text-wrap">{JSON.stringify(step, null, 2)}</code>
          </pre>
        </div>
      </>
    );
  }

  // Fallback for any auto-traversal states still in flight
  return (
    <>
      <p className="text-zinc-400">Loading…</p>
    </>
  );
}
