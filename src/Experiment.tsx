'use client';
import { getActiveState } from '@/lib/flow';
import { ExperimentFlow } from '@/lib/types';
import { Screen } from '@/src/Screen';
import Stepper from '@/src/components/Stepper';
import { useExperimentStore } from '@/src/data/store';
import { useEffect } from 'react';

type Props = {
  startingNode?: string;
  experiment: ExperimentFlow;
};

export default function Experiment(props: Props) {
  const { startingNode, experiment } = props;
  const { step, isLoading, start, next } = useExperimentStore();

  useEffect(() => {
    if (!step) {
      start(experiment, startingNode);
    }
  }, [step, startingNode, experiment]);

  if (!step) {
    return <></>;
  }

  const activeState = getActiveState(step.state);

  if (activeState.type === 'end') {
    return (
      <>
        <h1 className="mb-2 text-2xl font-semibold">All done!</h1>
        <p className="text-content-secondary mb-8">
          Thanks for completing the experiment.
        </p>
      </>
    );
  }

  if (activeState.type === 'in-node' && activeState.node.type === 'screen') {
    const slug = activeState.node.props.slug;
    const screen = step.experiment.screens?.find((s) => s.slug === slug);
    return (
      <>
        {step.state.type === 'in-path' && step.state.node.props.stepper && (
          <Stepper
            config={step.state.node.props.stepper}
            step={step.state.visibleStep}
            total={step.state.visibleTotal}
          />
        )}
        {step.state.type === 'in-loop' && step.state.node.props.stepper && (
          <Stepper
            config={step.state.node.props.stepper}
            step={step.state.index}
            total={step.state.values.length}
          />
        )}
        {screen ? (
          <Screen
            key={[
              screen.slug,
              ...Object.entries(step.context.loopData ?? {}).map(
                ([id, item]) => `${id}:${item.index}`,
              ),
            ].join('|')}
            screen={screen}
            isLoading={isLoading}
            onNext={next}
            context={step.context}
            sharedOptions={step.experiment.options}
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
