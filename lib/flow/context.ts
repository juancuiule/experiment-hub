import { Context } from '../types';

// Arrays are replaced wholesale, not recursively merged.
export function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      result[key] = deepMerge(target[key] ?? {}, val);
    } else {
      result[key] = val;
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
