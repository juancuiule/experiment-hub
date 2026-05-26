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

describe("compute node — sample formula (static inline pool)", () => {
  const pool = ["img1", "img2", "img3", "img4", "img5"];
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeCompute("pick", [
        { outputKey: "selected", formula: { type: "sample", input: pool, n: 3 } },
      ]),
      makeScreen("s1", "end"),
    ],
    edges: [seq("start", "pick"), seq("pick", "s1")],
    screens: [{ slug: "end", components: [] }],
  };

  it("returns exactly n items", async () => {
    const step = await startExperiment(flow, "start");
    expect(step.context.data?.["pick"]?.["selected"]).toHaveLength(3);
  });

  it("returns only items from the pool", async () => {
    const step = await startExperiment(flow, "start");
    const selected: string[] = step.context.data?.["pick"]?.["selected"];
    expect(selected.every((v) => pool.includes(v))).toBe(true);
  });

  it("returns unique items (no duplicates)", async () => {
    const step = await startExperiment(flow, "start");
    const selected: string[] = step.context.data?.["pick"]?.["selected"];
    expect(new Set(selected).size).toBe(selected.length);
  });

  it("returns full shuffled pool when n >= pool size", async () => {
    const bigNFlow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        makeCompute("pick", [
          { outputKey: "selected", formula: { type: "sample", input: pool, n: 10 } },
        ]),
        makeScreen("s1", "end"),
      ],
      edges: [seq("start", "pick"), seq("pick", "s1")],
      screens: [{ slug: "end", components: [] }],
    };
    const step = await startExperiment(bigNFlow, "start");
    const selected: string[] = step.context.data?.["pick"]?.["selected"];
    expect(selected).toHaveLength(pool.length);
    expect(selected.sort()).toEqual([...pool].sort());
  });
});

describe("compute node — sample formula (dynamic $$ pool)", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("setup", "setup"),
      makeCompute("pick", [
        { outputKey: "selected", formula: { type: "sample", input: "$$setup.images", n: 2 } },
      ]),
      makeScreen("s1", "end"),
    ],
    edges: [seq("start", "setup"), seq("setup", "pick"), seq("pick", "s1")],
    screens: [{ slug: "setup", components: [] }, { slug: "end", components: [] }],
  };

  it("reads pool from context via $$ reference", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { images: ["a", "b", "c", "d"] });
    const selected: string[] = step.context.data?.["pick"]?.["selected"];
    expect(selected).toHaveLength(2);
    expect(selected.every((v) => ["a", "b", "c", "d"].includes(v))).toBe(true);
  });

  it("returns [] when $$ reference does not resolve to an array", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, {}); // no images field
    expect(step.context.data?.["pick"]?.["selected"]).toEqual([]);
  });
});

describe("compute node — sample formula feeding a dynamic loop", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeCompute("pick", [
        {
          outputKey: "selected",
          formula: {
            type: "sample",
            input: ["img1", "img2", "img3", "img4", "img5"],
            n: 3,
          },
        },
      ]),
      {
        id: "loop-images",
        type: "loop",
        props: { type: "dynamic", dataKey: "$$pick.selected" },
      },
      makeScreen("screen-image", "image-screen"),
      makeScreen("screen-end", "end"),
    ],
    edges: [
      seq("start", "pick"),
      seq("pick", "loop-images"),
      { type: "loop-template", from: "loop-images", to: "screen-image" },
      seq("loop-images", "screen-end"),
    ],
    screens: [
      { slug: "image-screen", components: [] },
      { slug: "end", components: [] },
    ],
  };

  it("loops over the sampled items", async () => {
    const step = await startExperiment(flow, "start");
    expect(step.state.type).toBe("in-loop");
    expect(step.context.loops?.["loop-images"]?.order).toHaveLength(3);
  });

  it("iterates through all sampled items and exits to end", async () => {
    let step = await startExperiment(flow, "start");
    let iterations = 0;
    while (step.state.type === "in-loop") {
      iterations++;
      step = await traverse(step, { rated: true });
    }
    expect(iterations).toBe(3);
    expect((step.state as any).node.id).toBe("screen-end");
  });
});

describe("compute node — sample formula (object pool)", () => {
  const pool = [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ];

  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeCompute("pick", [
        { outputKey: "items", formula: { type: "sample", input: pool, n: 2 } },
      ]),
      makeScreen("s1", "end"),
    ],
    edges: [seq("start", "pick"), seq("pick", "s1")],
    screens: [{ slug: "end", components: [] }],
  };

  it("returns exactly n object items", async () => {
    const step = await startExperiment(flow, "start");
    expect(step.context.data?.["pick"]?.["items"]).toHaveLength(2);
  });

  it("returns only items from the pool", async () => {
    const step = await startExperiment(flow, "start");
    const selected: typeof pool = step.context.data?.["pick"]?.["items"];
    expect(selected.every((v) => pool.some((p) => p.id === v.id))).toBe(true);
  });

  it("returns unique items (no duplicates)", async () => {
    const step = await startExperiment(flow, "start");
    const selected: typeof pool = step.context.data?.["pick"]?.["items"];
    const ids = selected.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("compute node — count-correct formula", () => {
  const item1 = { id: "1", correctAnswer: "yes" };
  const item2 = { id: "2", correctAnswer: "no" };
  const item3 = { id: "3", correctAnswer: "maybe" };
  const allItems = [item1, item2, item3];

  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeCompute("pick", [
        { outputKey: "items", formula: { type: "sample", input: allItems, n: 3 } },
      ]),
      {
        id: "loop",
        type: "loop",
        props: { type: "dynamic", dataKey: "$$pick.items" },
      },
      makeScreen("trial", "trial"),
      makeCompute("score", [
        {
          outputKey: "total",
          formula: {
            type: "count-correct",
            itemsKey: "$$pick.items",
            loopId: "loop",
            screenSlug: "trial",
            answerKey: "answer",
            correctKey: "correctAnswer",
          },
        },
      ]),
      makeScreen("end", "end"),
    ],
    edges: [
      seq("start", "pick"),
      seq("pick", "loop"),
      { type: "loop-template", from: "loop", to: "trial" },
      seq("loop", "score"),
      seq("score", "end"),
    ],
    screens: [
      { slug: "trial", components: [] },
      { slug: "end", components: [] },
    ],
  };

  async function runLoop(
    getAnswer: (item: (typeof allItems)[0]) => string,
  ): Promise<number> {
    let step = await startExperiment(flow, "start");
    while (step.state.type === "in-loop") {
      const currentItem = (step.context.loopData as any)?.["loop"]?.value;
      step = await traverse(step, { answer: getAnswer(currentItem) });
    }
    return step.context.data?.["score"]?.["total"] as number;
  }

  it("returns 3 when all answers are correct", async () => {
    const total = await runLoop((item) => item.correctAnswer);
    expect(total).toBe(3);
  });

  it("returns 0 when all answers are wrong", async () => {
    const total = await runLoop(() => "wrong");
    expect(total).toBe(0);
  });

  it("returns 1 when only the first answer is correct", async () => {
    let iteration = 0;
    const total = await runLoop((item) => {
      iteration++;
      return iteration === 1 ? item.correctAnswer : "wrong";
    });
    expect(total).toBe(1);
  });
});
