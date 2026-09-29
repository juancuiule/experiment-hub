import type { ExperimentFlow } from '@experiment-hub/engine/types';

// Server-side fetch of the published config. Experiment storage lives in
// the backend DB now — the EXPERIMENTS record under src/data/experiments/
// remains only as the authoring format that seeding publishes from.
// BACKEND_URL is the same env var the dev /api rewrite uses; compose
// points it at http://backend:3000 over the internal network.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3100';
const FETCH_TIMEOUT_MS = 10_000;

export type LoadedExperiment = { config: ExperimentFlow; version: string };

// version is the config's content hash — createRun pins it so the run's
// data is provably collected under the graph the participant loaded.
export async function fetchExperiment(
  slug: string,
): Promise<LoadedExperiment | null> {
  const res = await fetch(`${BACKEND_URL}/api/experiments/${slug}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`experiment fetch failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as {
    config: ExperimentFlow;
    version: string;
  };
  return { config: body.config, version: body.version };
}

export type PublishedExperiment = { slug: string; version: string };

export async function listExperiments(): Promise<PublishedExperiment[]> {
  const res = await fetch(`${BACKEND_URL}/api/experiments`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`experiment list failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as { experiments: PublishedExperiment[] };
  return body.experiments;
}
