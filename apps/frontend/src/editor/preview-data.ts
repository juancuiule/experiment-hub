import type { ContextData } from '@experiment-hub/engine/types';
import { useSyncExternalStore } from 'react';

const KEY = (slug: string) => `eh-preview-data:${slug}`;

/** Per-experiment preview answers — screenSlug → field → value. */
export type PreviewData = Record<string, ContextData>;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

// Cache keyed by raw string so getSnapshot returns a stable object while
// localStorage is unchanged (required by useSyncExternalStore).
const cache = new Map<string, { raw: string; data: PreviewData }>();
const EMPTY: PreviewData = {};

function getSnapshot(expSlug: string): PreviewData {
  if (typeof window === 'undefined') return EMPTY;
  const raw = localStorage.getItem(KEY(expSlug)) ?? '{}';
  const hit = cache.get(expSlug);
  if (hit && hit.raw === raw) return hit.data;
  try {
    const data = JSON.parse(raw) as PreviewData;
    cache.set(expSlug, { raw, data });
    return data;
  } catch {
    return EMPTY;
  }
}

function write(expSlug: string, data: PreviewData) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY(expSlug), JSON.stringify(data));
  emit();
}

export function loadPreviewData(expSlug: string): PreviewData {
  return getSnapshot(expSlug);
}

/** Merge live form values under the screen's slug and persist — values flow
 *  into `$$slug.field` refs in other screens' previews (and any open editor). */
export function saveScreenAnswers(
  expSlug: string,
  screenSlug: string,
  values: ContextData,
) {
  if (typeof window === 'undefined') return;
  write(expSlug, { ...getSnapshot(expSlug), [screenSlug]: values });
}

export function clearPreviewData(expSlug: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY(expSlug));
  emit();
}

/** Stored preview answers — SSR-safe (server snapshot is {}) and live:
 *  re-renders whenever answers are saved from any preview. */
export function usePreviewData(expSlug: string): PreviewData {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot(expSlug),
    () => EMPTY,
  );
}

/** Same as usePreviewData but exposes a setter (e.g. "reset data" UI). */
export function usePreviewDataState(
  expSlug: string,
): [PreviewData, (d: PreviewData) => void] {
  const data = usePreviewData(expSlug);
  return [data, (d) => write(expSlug, d)];
}
