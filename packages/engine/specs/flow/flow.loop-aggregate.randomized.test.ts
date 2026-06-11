import { describe, expect, it, vi } from "vitest";
import { startExperiment, traverse } from "@experiment-hub/engine/flow";
import { ExperimentFlow } from "@experiment-hub/engine/types";
import { makeScreen, seq } from "../test-helpers";

// Force a deterministic, non-identity reorder so the test proves that
// loop-aggregate pairs each iteration's data with the right item even when the
// loop presents items in a shuffled order. It recovers the item from
// context.loops[loopId].values (aligned with the shuffled order), so the
// pairing is exact regardless of randomization.
vi.mock("@experiment-hub/engine/utils", async (importActual) => {
  const actual = await importActual<typeof import("@experiment-hub/engine/utils")>();
  return { ...actual, shuffle: <T>(a: T[]): T[] => [...a].reverse() };
});

function makeCompute(
  id: string,
  computations: any[],
): ExperimentFlow["nodes"][0] {
  return { id, type: "compute" as const, props: { name: id, computations } };
}

describe("loop-aggregate — count over a randomized loop", () => {
  const items = [
    { id: "a", correctAnswer: "A" },
    { id: "b", correctAnswer: "B" },
    { id: "c", correctAnswer: "C" },
  ];

  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      {
        id: "loop",
        type: "loop",
        props: { type: "static", values: items, itemKey: "id", randomized: true },
      },
      makeScreen("trial", "trial"),
      makeCompute("score", [
        {
          outputKey: "total",
          formula: {
            type: "loop-aggregate",
            loopId: "loop",
            op: "count",
            where: {
              type: "simple",
              operator: "eq",
              dataKey: "@loop.trial.answer",
              value: "@loop.value.correctAnswer",
            },
          },
        },
      ]),
      makeScreen("end", "end"),
    ],
    edges: [
      seq("start", "loop"),
      { type: "loop-template", from: "loop", to: "trial" },
      seq("loop", "score"),
      seq("score", "end"),
    ],
    screens: [{ slug: "trial", components: [] }, { slug: "end", components: [] }],
  };

  it("counts only the correct subset when some answers are wrong", async () => {
    let step = await startExperiment(flow, "start");
    // Reversed order: [c, b, a]; give correct answers for c and a, wrong for b
    const correct: Record<string, string> = { a: "A", c: "C" };
    while (step.state.type === "in-loop") {
      const item = (step.context.loopData as any)?.["loop"]?.value;
      step = await traverse(step, { answer: correct[item.id] ?? "WRONG" });
    }
    expect(step.context.loops?.["loop"]?.order).toEqual(["c", "b", "a"]);
    expect(step.context.data?.["score"]?.["total"]).toBe(2);
  });

  it("presents items reversed but still scores every correct answer", async () => {
    let step = await startExperiment(flow, "start");
    while (step.state.type === "in-loop") {
      const item = (step.context.loopData as any)?.["loop"]?.value;
      step = await traverse(step, { answer: item.correctAnswer });
    }
    // The loop reordered (proves randomization happened)...
    expect(step.context.loops?.["loop"]?.order).toEqual(["c", "b", "a"]);
    // ...and all three answers were still credited to the right item.
    expect(step.context.data?.["score"]?.["total"]).toBe(3);
  });
});
