import { Context } from '@experiment-hub/engine/types';

// This is a dev stub for simulating async persistence in the flow.
// It should be replaced with a real API call (the backend checkpoint POST)
// or removed in production.
export async function send(context: Context, ms?: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(context);
    }, ms || 100); // Minimal delay — replace with a real API call in production
  });
}
