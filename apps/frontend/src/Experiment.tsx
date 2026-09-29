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
  // The config hash the page loaded — runs pin it so a republish between
  // load and register can't mislabel this run's checkpoints.
  version: string;
};

export default function Experiment(props: Props) {
  const { startingNode, experiment, locale, slug, version } = props;
  // Per-field selectors: run/seq churn on every checkpoint must not
  // re-render the screen subtree.
  const step = useExperimentStore((s) => s.step);
  const isLoading = useExperimentStore((s) => s.isLoading);
  const error = useExperimentStore((s) => s.error);
  const start = useExperimentStore((s) => s.start);
  const next = useExperimentStore((s) => s.next);
  const reset = useExperimentStore((s) => s.reset);

  useEffect(() => {
    if (!step || step.experiment !== experiment) {
      start(experiment, startingNode, locale, slug, version);
    }
  }, [experiment, startingNode, locale, slug, version]);

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
            onClick={() =>
              start(experiment, startingNode, locale, slug, version)
            }
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
