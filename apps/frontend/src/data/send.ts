import { Context } from '@experiment-hub/engine/types';

export type CheckpointMeta = {
  runId: string;
  experiment: string;
  checkpoint: string;
};

// Persists a checkpoint snapshot to the backend. Same-origin: in production
// nginx routes /api/* to the backend container; in dev, Next rewrites
// proxy /api/* to BACKEND_URL (default http://localhost:3100).
export async function send(context: Context, meta: CheckpointMeta) {
  const response = await fetch(
    `/api/runs/${encodeURIComponent(meta.runId)}/checkpoints`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experiment: meta.experiment,
        checkpoint: meta.checkpoint,
        context,
        at: new Date().toISOString(),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to persist checkpoint "${meta.checkpoint}": HTTP ${response.status}`,
    );
  }
}
