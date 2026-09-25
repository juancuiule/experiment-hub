'use client';
import { getScreenView, isEnded } from '@experiment-hub/engine/flow';
import { ExperimentFlow } from '@experiment-hub/engine/types';
import { Screen } from '@/src/Screen';
import Stepper from '@/src/components/Stepper';
import { useExperimentStore } from '@/src/data/store';
import { useEffect } from 'react';

type Props = {
  startingNode?: string;
  experiment: ExperimentFlow;
  locale?: string;
  slug: string;
};

export default function Experiment(props: Props) {
  const { startingNode, experiment, locale, slug } = props;
  const { step, isLoading, error, start, next } = useExperimentStore();
  const reset = useExperimentStore((s) => s.reset);

  useEffect(() => {
    if (!step || step.experiment !== experiment) {
      start(experiment, startingNode, locale, slug);
    }
  }, [experiment, startingNode, locale, slug]);

  useEffect(() => reset, [reset]);

  if (!step || step.experiment !== experiment) {
    // A failed start() leaves step null — surface the error with a retry
    // instead of rendering an empty page.
    if (error && !isLoading) {
      return (
        <div className="flex-1">
          <p className="text-error mb-4">{error}</p>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => start(experiment, startingNode, locale, slug)}
            className="border-edge text-content hover:bg-surface-raised cursor-pointer rounded-md border px-4 py-2"
          >
            Try again
          </button>
        </div>
      );
    }
    return <div className="flex-1"></div>;
  }

  if (isEnded(step)) {
    return (
      <>
        <h1 className="mb-2 text-2xl font-semibold">All done!</h1>
        <p className="text-content-secondary mb-8">
          Thanks for completing the experiment.
        </p>
        {error && <p className="text-error">{error}</p>}
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
