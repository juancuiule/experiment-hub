import { Context } from "./types";

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// This is a dev stub for simulating async operations in the flow.
// It should be replaced with real API calls or removed in production.
export async function send(context: Context, ms?: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(context);
    }, ms || 1000); // Minimal delay — replace with a real API call in production
  });
}
