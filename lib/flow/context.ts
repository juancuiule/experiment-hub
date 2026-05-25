import { Context } from '../types';

// Arrays are replaced wholesale, not recursively merged.
export function deepMerge<T extends object>(target: T, source: object): T {
  const result = { ...target } as T;
  for (const key of Object.keys(source) as (keyof T & string)[]) {
    const val = (source as any)[key];
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      result[key] = deepMerge((target[key] ?? {}) as any, val as any);
    } else {
      result[key] = val as T[typeof key];
    }
  }
  return result;
}

export function mergeContext(context: Context, toMerge: Context): Context {
  return deepMerge(context, toMerge);
}

export function withCurrentItem(
  context: Context,
  loopId: string,
  values: string[],
  index: number,
): Context {
  return mergeContext(context, {
    loopData: {
      [loopId]: { value: values[index], index },
    },
  });
}
