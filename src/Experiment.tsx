'use client';
import { getScreenView, isEnded } from '@/lib/flow';
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

  if (isEnded(step)) {
    return (
      <>
        <h1 className="mb-2 text-2xl font-semibold">All done!</h1>
        <p className="text-content-secondary mb-8">
          Thanks for completing the experiment.
        </p>
      </>
    );
  }

  const view = getScreenView(step);

  if (!view) {
    return (
      <>
        <p className="text-content-secondary">Loading…</p>
      </>
    );
  }

  const screen = step.experiment.screens?.find((s) => s.slug === view.slug);

  return (
    <>
      {view.stepper && <Stepper {...view.stepper} />}
      {screen ? (
        <Screen
          key={view.screenKey}
          screen={screen}
          isLoading={isLoading}
          onNext={next}
          context={step.context}
          sharedOptions={step.experiment.options}
        />
      ) : (
        <p className="text-error">Screen not found: {view.slug}</p>
      )}
    </>
  );
}
