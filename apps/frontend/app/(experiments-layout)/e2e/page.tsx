import { notFound } from 'next/navigation';
import { validateExperiment } from '@experiment-hub/engine/experiment-validation';
import { fetchExperiment } from '@/src/data/fetch-experiment';
import Experiment from '@/src/Experiment';
import { ValidationErrors } from '@/src/ValidationErrors';

export const revalidate = 0;

export default async function E2EPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  // The e2e fixture experiment is served from the backend like any other —
  // the playwright webServer seeds it under this slug before starting.
  const experiment = await fetchExperiment('e2e');
  if (!experiment) {
    notFound();
  }

  const errors = validateExperiment(experiment);
  if (errors.length > 0) {
    return <ValidationErrors errors={errors} />;
  }

  return <Experiment experiment={experiment} slug="e2e" />;
}
