import { Context } from '@experiment-hub/engine/types';

// A hung request must not pin a session's in-flight lock forever: the
// store only clears it when the fetch settles, and there is no persisted
// session to resume after a reload.
const REQUEST_TIMEOUT_MS = 15_000;

export type Run = { runId: string; token: string };

export type CheckpointMeta = Run & {
  experiment: string;
  checkpoint: string;
  seq: number;
};

// Registers a run with the backend, which mints the runId and a token signed
// over (runId, experiment). Same-origin: in production nginx routes /api/* to
// the backend container; in dev, Next rewrites proxy /api/* to BACKEND_URL
// (default http://localhost:3100).
export async function createRun(experiment: string): Promise<Run> {
  const response = await fetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ experiment }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Failed to start run: HTTP ${response.status}`);
  }
  return (await response.json()) as Run;
}

// Persists a checkpoint snapshot. `seq` identifies the visit within the run;
// retries must resend the same seq so the backend can dedupe them.
export async function send(context: Context, meta: CheckpointMeta) {
  const response = await fetch(
    `/api/runs/${encodeURIComponent(meta.runId)}/checkpoints`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Run-Token': meta.token,
      },
      body: JSON.stringify({
        experiment: meta.experiment,
        checkpoint: meta.checkpoint,
        seq: meta.seq,
        context,
        at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to persist checkpoint "${meta.checkpoint}": HTTP ${response.status}`,
    );
  }
}
