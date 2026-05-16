import { describe, expect, it } from "vitest";
import { buildTimingKey } from "@/lib/flow";
import { FlowStep } from "@/lib/types";

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
