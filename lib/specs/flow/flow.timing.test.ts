import { describe, expect, it } from "vitest";
import { buildTimingKey, recordEnteredAt, startExperiment, traverseWithTiming } from "@/lib/flow";
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
    const submittedAt = step2.context.timings?.["screen-1"]?.submittedAt;
    expect(submittedAt).toBeDefined();
    expect(submittedAt! >= before).toBe(true);
    expect(submittedAt! <= after).toBe(true);
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

describe("enteredAt tracking", () => {
  const twoScreenFlow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("s1", "screen-1"),
      makeScreen("s2", "screen-2"),
    ],
    edges: [seq("start", "s1"), seq("s1", "s2")],
  };

  it("recordEnteredAt sets enteredAt when on a screen node", () => {
    const before = new Date().toISOString();
    const step: FlowStep = {
      state: { type: "in-node", node: { id: "s1", type: "screen", props: { slug: "screen-1" } } },
      experiment: twoScreenFlow,
      context: {},
      dataPath: [],
    };
    const updated = recordEnteredAt(step);
    const after = new Date().toISOString();
    const enteredAt = updated.context.timings?.["screen-1"]?.enteredAt;
    expect(enteredAt).toBeDefined();
    expect(enteredAt! >= before).toBe(true);
    expect(enteredAt! <= after).toBe(true);
  });

  it("recordEnteredAt is a no-op for non-screen nodes", () => {
    const step: FlowStep = {
      state: { type: "end" },
      experiment: twoScreenFlow,
      context: {},
    };
    const updated = recordEnteredAt(step);
    expect(updated).toBe(step);
  });

  it("back navigation updates enteredAt for the re-visited screen", () => {
    const step: FlowStep = {
      state: { type: "in-node", node: { id: "s1", type: "screen", props: { slug: "screen-1" } } },
      experiment: twoScreenFlow,
      context: {
        timings: {
          "screen-1": { enteredAt: "2020-01-01T00:00:00.000Z", submittedAt: "2020-01-01T00:00:01.000Z" },
        },
      },
      dataPath: [],
    };
    const updated = recordEnteredAt(step);
    expect(updated.context.timings!["screen-1"]!.enteredAt).not.toBe("2020-01-01T00:00:00.000Z");
  });
});

describe("full-flow timing integration", () => {
  it("3-screen sequence: context.timings has 3 entries with valid ISO timestamps", async () => {
    const flow3: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        makeScreen("s1", "screen-1"),
        makeScreen("s2", "screen-2"),
        makeScreen("s3", "screen-3"),
      ],
      edges: [seq("start", "s1"), seq("s1", "s2"), seq("s2", "s3")],
    };

    let step = recordEnteredAt(await startExperiment(flow3, "start"));
    step = recordEnteredAt(await traverseWithTiming(step, {}));
    step = recordEnteredAt(await traverseWithTiming(step, {}));
    step = recordEnteredAt(await traverseWithTiming(step, {}));

    const timings = step.context.timings ?? {};
    expect(Object.keys(timings)).toHaveLength(3);
    for (const entry of Object.values(timings)) {
      expect(entry.enteredAt).toBeDefined();
      expect(entry.submittedAt).toBeDefined();
      expect(new Date(entry.submittedAt!).toISOString()).toBe(entry.submittedAt);
    }
  });

  it("submittedAt >= enteredAt for all entries including the last screen", async () => {
    const flow3: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        makeScreen("s1", "screen-1"),
        makeScreen("s2", "screen-2"),
        makeScreen("s3", "screen-3"),
      ],
      edges: [seq("start", "s1"), seq("s1", "s2"), seq("s2", "s3")],
    };

    let step = recordEnteredAt(await startExperiment(flow3, "start"));
    step = recordEnteredAt(await traverseWithTiming(step, {}));
    step = recordEnteredAt(await traverseWithTiming(step, {}));
    step = recordEnteredAt(await traverseWithTiming(step, {}));

    for (const entry of Object.values(step.context.timings ?? {})) {
      expect(entry.enteredAt).toBeDefined();
      expect(entry.submittedAt).toBeDefined();
      expect(entry.submittedAt! >= entry.enteredAt!).toBe(true);
    }
  });

  it("loop with 3 iterations: timing entries recorded for each iteration", async () => {
    const loopFlow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        {
          id: "loop-colors",
          type: "loop",
          props: { type: "static", values: ["red", "blue", "green"] },
        },
        makeScreen("s-eval", "item-eval"),
      ],
      edges: [
        seq("start", "loop-colors"),
        { type: "loop-template", from: "loop-colors", to: "s-eval" },
      ],
    };

    let step = recordEnteredAt(await startExperiment(loopFlow, "start"));
    // Loop iteration 1
    step = recordEnteredAt(await traverseWithTiming(step, { rating: 1 }));
    // Loop iteration 2
    step = recordEnteredAt(await traverseWithTiming(step, { rating: 2 }));
    // Loop iteration 3
    step = recordEnteredAt(await traverseWithTiming(step, { rating: 3 }));

    const keys = Object.keys(step.context.timings ?? {});
    expect(keys).toHaveLength(3);
    expect(keys).toContain("loop-colors/red/item-eval");
    expect(keys).toContain("loop-colors/blue/item-eval");
    expect(keys).toContain("loop-colors/green/item-eval");
  });

  it("path screens get disambiguated timing keys", async () => {
    const pathFlow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        { id: "path-a", type: "path", props: { name: "A" } },
        makeScreen("sq1", "q1"),
        makeScreen("sq2", "q2"),
      ],
      edges: [
        seq("start", "path-a"),
        { type: "path-contains", from: "path-a", to: "sq1", order: 0 },
        { type: "path-contains", from: "path-a", to: "sq2", order: 1 },
      ],
    };

    let step = recordEnteredAt(await startExperiment(pathFlow, "start"));
    step = recordEnteredAt(await traverseWithTiming(step, {}));
    step = recordEnteredAt(await traverseWithTiming(step, {}));

    const keys = Object.keys(step.context.timings ?? {});
    expect(keys).toContain("path-a/q1");
    expect(keys).toContain("path-a/q2");
  });
});
