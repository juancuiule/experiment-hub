import { describe, expect, it } from "vitest";
import { startExperiment, traverse } from "@/lib/flow";
import { ExperimentFlow } from "@/lib/types";
import { makeScreen, seq } from "../test-helpers";

function makeCompute(id: string, computations: any[]): ExperimentFlow["nodes"][0] {
  return { id, type: "compute" as const, props: { name: id, computations } };
}

function pathContains(from: string, to: string, order: number): ExperimentFlow["edges"][0] {
  return { type: "path-contains", from, to, order };
}

describe("compute node — sum formula", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("s1", "q"),
      makeCompute("score", [
        { outputKey: "total", formula: { type: "sum", inputs: ["$$q.a", "$$q.b"] } },
      ]),
      makeScreen("s2", "end"),
    ],
    edges: [seq("start", "s1"), seq("s1", "score"), seq("score", "s2")],
    screens: [
      { slug: "q", components: [] },
      { slug: "end", components: [] },
    ],
  };

  it("auto-traverses the compute node and stores sum under data[computeNodeId]", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { a: 3, b: 7 }); // s1 → compute → s2
    expect(step.context.data?.["score"]).toEqual({ total: 10 });
    expect((step.state as any).node.id).toBe("s2");
  });
});

describe("compute node — mean formula", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("s1", "q"),
      makeCompute("avg", [
        { outputKey: "mean", formula: { type: "mean", inputs: ["$$q.a", "$$q.b", "$$q.c"] } },
      ]),
      makeScreen("s2", "end"),
    ],
    edges: [seq("start", "s1"), seq("s1", "avg"), seq("avg", "s2")],
    screens: [{ slug: "q", components: [] }, { slug: "end", components: [] }],
  };

  it("stores the arithmetic mean", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { a: 2, b: 4, c: 6 });
    expect(step.context.data?.["avg"]?.mean).toBe(4);
  });
});

describe("compute node — min / max formulas", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("s1", "q"),
      makeCompute("extremes", [
        { outputKey: "lo", formula: { type: "min", inputs: ["$$q.a", "$$q.b", "$$q.c"] } },
        { outputKey: "hi", formula: { type: "max", inputs: ["$$q.a", "$$q.b", "$$q.c"] } },
      ]),
      makeScreen("s2", "end"),
    ],
    edges: [seq("start", "s1"), seq("s1", "extremes"), seq("extremes", "s2")],
    screens: [{ slug: "q", components: [] }, { slug: "end", components: [] }],
  };

  it("stores min and max", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { a: 1, b: 9, c: 5 });
    expect(step.context.data?.["extremes"]?.lo).toBe(1);
    expect(step.context.data?.["extremes"]?.hi).toBe(9);
  });
});

describe("compute node — count formula (no condition)", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("s1", "q"),
      makeCompute("cnt", [
        { outputKey: "n", formula: { type: "count", inputs: ["$$q.a", "$$q.b", "$$q.c"] } },
      ]),
      makeScreen("s2", "end"),
    ],
    edges: [seq("start", "s1"), seq("s1", "cnt"), seq("cnt", "s2")],
    screens: [{ slug: "q", components: [] }, { slug: "end", components: [] }],
  };

  it("counts non-null/non-empty values", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { a: 1, b: null, c: 5 });
    expect(step.context.data?.["cnt"]?.n).toBe(2);
  });
});

describe("compute node — count formula (with where)", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("s1", "q"),
      makeCompute("cnt", [
        {
          outputKey: "highCount",
          formula: {
            type: "count",
            inputs: ["$$q.a", "$$q.b", "$$q.c"],
            where: { type: "simple", operator: "gte", dataKey: "@current" as any, value: 3 },
          },
        },
      ]),
      makeScreen("s2", "end"),
    ],
    edges: [seq("start", "s1"), seq("s1", "cnt"), seq("cnt", "s2")],
    screens: [{ slug: "q", components: [] }, { slug: "end", components: [] }],
  };

  it("counts values satisfying the condition", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { a: 1, b: 4, c: 5 });
    expect(step.context.data?.["cnt"]?.highCount).toBe(2);
  });
});

describe("compute node — conditional formula", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("s1", "q"),
      makeCompute("classify", [
        {
          outputKey: "severity",
          formula: {
            type: "conditional",
            condition: { type: "simple", operator: "gte", dataKey: "$$q.score", value: 10 },
            then: "high",
            else: "low",
          },
        },
      ]),
      makeScreen("s2", "end"),
    ],
    edges: [seq("start", "s1"), seq("s1", "classify"), seq("classify", "s2")],
    screens: [{ slug: "q", components: [] }, { slug: "end", components: [] }],
  };

  it("stores 'high' when condition passes", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { score: 15 });
    expect(step.context.data?.["classify"]?.severity).toBe("high");
  });

  it("stores 'low' when condition fails", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { score: 5 });
    expect(step.context.data?.["classify"]?.severity).toBe("low");
  });
});

describe("compute node — lookup formula", () => {
  const table = [
    { when: 0,  then: "none" },
    { when: 5,  then: "mild" },
    { when: 10, then: "moderate" },
    { when: 15, then: "severe" },
  ];

  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("s1", "q"),
      makeCompute("score", [
        { outputKey: "level", formula: { type: "lookup", input: "$$q.total", table, default: "unknown" } },
      ]),
      makeScreen("s2", "end"),
    ],
    edges: [seq("start", "s1"), seq("s1", "score"), seq("score", "s2")],
    screens: [{ slug: "q", components: [] }, { slug: "end", components: [] }],
  };

  it("returns the matching floor entry", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { total: 12 });
    expect(step.context.data?.["score"]?.level).toBe("moderate");
  });

  it("returns default when no entry matches", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { total: -1 });
    expect(step.context.data?.["score"]?.level).toBe("unknown");
  });
});

describe("compute node — $-shorthand within-node references", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("s1", "q"),
      makeCompute("score", [
        { outputKey: "total", formula: { type: "sum", inputs: ["$$q.a", "$$q.b"] } },
        {
          outputKey: "level",
          formula: {
            type: "conditional",
            condition: { type: "simple", operator: "gte", dataKey: "$total" as any, value: 10 },
            then: "high",
            else: "low",
          },
        },
      ]),
      makeScreen("s2", "end"),
    ],
    edges: [seq("start", "s1"), seq("s1", "score"), seq("score", "s2")],
    screens: [{ slug: "q", components: [] }, { slug: "end", components: [] }],
  };

  it("later computations can reference earlier outputs via $", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { a: 6, b: 7 }); // total=13 → high
    expect(step.context.data?.["score"]?.total).toBe(13);
    expect(step.context.data?.["score"]?.level).toBe("high");
  });
});

describe("compute node — inside a path", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      { id: "path-q", type: "path", props: { name: "Questions" } },
      makeScreen("s1", "q"),
      makeCompute("score", [
        { outputKey: "total", formula: { type: "sum", inputs: ["$$path-q.q.a", "$$path-q.q.b"] } },
      ]),
      makeScreen("s2", "end"),
    ],
    edges: [
      seq("start", "path-q"),
      pathContains("path-q", "s1", 0),
      pathContains("path-q", "score", 1),
      seq("path-q", "s2"),
    ],
    screens: [{ slug: "q", components: [] }, { slug: "end", components: [] }],
  };

  it("stores compute output scoped under path-id.compute-id", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { a: 3, b: 4 }); // s1 done → score (auto) → path exits → s2
    expect(step.context.data?.["path-q"]?.["score"]).toEqual({ total: 7 });
    expect((step.state as any).node.id).toBe("s2");
  });
});

describe("compute node — end of path, no outgoing sequential edge", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      { id: "path-q", type: "path", props: { name: "Questions" } },
      makeScreen("s1", "q"),
      makeCompute("score", [
        { outputKey: "total", formula: { type: "sum", inputs: ["$$path-q.q.a"] } },
      ]),
      makeScreen("s2", "end"),
    ],
    edges: [
      seq("start", "path-q"),
      pathContains("path-q", "s1", 0),
      pathContains("path-q", "score", 1),
      seq("path-q", "s2"),
      // no seq edge from "score" — path handles continuation
    ],
    screens: [{ slug: "q", components: [] }, { slug: "end", components: [] }],
  };

  it("path exits normally when compute is the last child", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { a: 5 }); // s1 → score (auto, last path child) → path exits → s2
    expect((step.state as any).node.id).toBe("s2");
    expect(step.context.data?.["path-q"]?.["score"]).toEqual({ total: 5 });
  });
});
