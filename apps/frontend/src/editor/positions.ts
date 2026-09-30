import type { XYPosition } from '@xyflow/react';

const KEY = 'eh-flow-positions';

type Store = Record<string, Record<string, XYPosition>>;

const readStore = (): Store => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store;
  } catch {
    return {};
  }
};

/** Saved manual positions for one experiment (nodeId → position). */
export function loadPositions(slug: string): Record<string, XYPosition> {
  if (typeof window === 'undefined') return {};
  return readStore()[slug] ?? {};
}

export function savePositions(
  slug: string,
  positions: Record<string, XYPosition>,
) {
  if (typeof window === 'undefined') return;
  const store = readStore();
  store[slug] = { ...store[slug], ...positions };
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function removePositions(slug: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  const store = readStore();
  const cur = store[slug] ?? {};
  for (const id of ids) delete cur[id];
  store[slug] = cur;
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function clearPositions(slug: string) {
  if (typeof window === 'undefined') return;
  const store = readStore();
  delete store[slug];
  localStorage.setItem(KEY, JSON.stringify(store));
}
