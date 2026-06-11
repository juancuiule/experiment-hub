import { vi } from 'vitest';
import { ExperimentFlow } from "../types";

export function seedRandom(seed = 42) {
  let s = seed >>> 0;
  return vi.spyOn(Math, 'random').mockImplementation(() => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 2 ** 32;
  });
}

export function makeScreen(
  id: string,
  slug?: string,
): ExperimentFlow["nodes"][0] {
  return { id, type: "screen", props: { slug: slug ?? id } };
}

export function seq(
  from: string,
  to: string,
): ExperimentFlow["edges"][0] {
  return { type: "sequential", from, to };
}
