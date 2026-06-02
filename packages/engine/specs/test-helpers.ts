import { ExperimentFlow } from "../types";

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
