import { describe, expect, it } from "vitest";
import { buildTimingKey, startExperiment, traverseWithTiming } from "@/lib/flow";
import { ExperimentFlow, FlowStep } from "@/lib/types";
import { makeScreen, seq } from "../test-helpers";

function makeStep(overrides: Partial<FlowStep>): FlowStep {
  return {
    state: { type: "end" },
    experiment: { nodes: [], edges: [] },
    context: {},
    ...overrides,
  };
}

describe("buildTimingKey", () => {
  it("returns null for non-screen states (end)", () => {
    const step = makeStep({ state: { type: "end" } });
    expect(buildTimingKey(step)).toBeNull();
  });

  it("returns null for non-screen in-node states (start)", () => {
    const step = makeStep({
      state: { type: "in-node", node: { id: "start", type: "start" } },
    });
    expect(buildTimingKey(step)).toBeNull();
  });

  it("returns slug for a top-level screen", () => {
    const step = makeStep({
      state: { type: "in-node", node: { id: "screen-a", type: "screen", props: { slug: "slug-a" } } },
      dataPath: [],
    });
    expect(buildTimingKey(step)).toBe("slug-a");
  });

  it("returns 'pathId/slug' for a screen inside a path", () => {
    const step = makeStep({
      state: { type: "in-node", node: { id: "screen-a", type: "screen", props: { slug: "slug-a" } } },
      dataPath: ["path-regressors"],
    });
    expect(buildTimingKey(step)).toBe("path-regressors/slug-a");
  });

  it("returns 'loopId/value/slug' for a screen inside a loop iteration", () => {
    const step = makeStep({
      state: { type: "in-node", node: { id: "screen-a", type: "screen", props: { slug: "slug-a" } } },
      dataPath: ["loop-colors", "red"],
    });
    expect(buildTimingKey(step)).toBe("loop-colors/red/slug-a");
  });

  it("handles deeply nested path/loop combinations", () => {
    const step = makeStep({
      state: { type: "in-node", node: { id: "s", type: "screen", props: { slug: "q1" } } },
      dataPath: ["path-1", "loop-x", "item"],
    });
    expect(buildTimingKey(step)).toBe("path-1/loop-x/item/q1");
  });
});

describe("timing integration via traverse", () => {
  const threeScreenFlow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("s1", "screen-1"),
      makeScreen("s2", "screen-2"),
      makeScreen("s3", "screen-3"),
    ],
    edges: [
      seq("start", "s1"),
      seq("s1", "s2"),
      seq("s2", "s3"),
    ],
  };

  it("submittedAt is set in context when traversing off a screen", async () => {
    const before = new Date().toISOString();
    const step1 = await startExperiment(threeScreenFlow, "start"); // on s1
    const step2 = await traverseWithTiming(step1, {}); // s1 → s2, sets submittedAt for screen-1
    const after = new Date().toISOString();
    const entry = step2.context.timings?.["screen-1"];
    expect(entry?.submittedAt).toBeDefined();
    expect(entry!.submittedAt >= before).toBe(true);
    expect(entry!.submittedAt <= after).toBe(true);
  });

  it("accumulates submittedAt across 3 screens", async () => {
    let step = await startExperiment(threeScreenFlow, "start");
    step = await traverseWithTiming(step, {});
    step = await traverseWithTiming(step, {});
    step = await traverseWithTiming(step, {});
    expect(step.context.timings?.["screen-1"]?.submittedAt).toBeDefined();
    expect(step.context.timings?.["screen-2"]?.submittedAt).toBeDefined();
    expect(step.context.timings?.["screen-3"]?.submittedAt).toBeDefined();
  });
});
