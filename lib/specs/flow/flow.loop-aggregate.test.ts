import { describe, expect, it } from "vitest";
import { startExperiment, traverse } from "@/lib/flow";
import { ExperimentFlow } from "@/lib/types";
import { makeScreen, seq } from "../test-helpers";

function makeCompute(
  id: string,
  computations: any[],
): ExperimentFlow["nodes"][0] {
  return { id, type: "compute" as const, props: { name: id, computations } };
}

// ---------------------------------------------------------------------------
// count — scoring against an item property (the count-correct replacement)
// Dynamic loop over object items; the predicate compares the iteration's
// collected answer (@loop.trial.answer) against the item's own correctAnswer
// (@loop.value.correctAnswer).
// ---------------------------------------------------------------------------
describe("loop-aggregate — count (scoring, dynamic loop, object items)", () => {
  const items = [
    { id: "1", correctAnswer: "yes" },
    { id: "2", correctAnswer: "no" },
    { id: "3", correctAnswer: "maybe" },
  ];

  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeCompute("pick", [
        { outputKey: "items", formula: { type: "sample", input: items, n: 3 } },
      ]),
      { id: "loop", type: "loop", props: { type: "dynamic", dataKey: "$$pick.items" } },
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
      seq("start", "pick"),
      seq("pick", "loop"),
      { type: "loop-template", from: "loop", to: "trial" },
      seq("loop", "score"),
      seq("score", "end"),
    ],
    screens: [{ slug: "trial", components: [] }, { slug: "end", components: [] }],
  };

  async function runLoop(
    getAnswer: (item: (typeof items)[0]) => string,
  ): Promise<number> {
    let step = await startExperiment(flow, "start");
    while (step.state.type === "in-loop") {
      const currentItem = (step.context.loopData as any)?.["loop"]?.value;
      step = await traverse(step, { answer: getAnswer(currentItem) });
    }
    return step.context.data?.["score"]?.["total"] as number;
  }

  it("counts 3 when every answer matches the item's correctAnswer", async () => {
    expect(await runLoop((item) => item.correctAnswer)).toBe(3);
  });

  it("counts 0 when no answer matches", async () => {
    expect(await runLoop(() => "wrong")).toBe(0);
  });

  it("counts 1 when only the first answer matches", async () => {
    let i = 0;
    expect(
      await runLoop((item) => (++i === 1 ? item.correctAnswer : "wrong")),
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// count — itemKey'd loop: iteration keys are item properties, not 1-based
// indices. loop-aggregate must read context.loops[loopId].order, so this just
// works without any itemKey on the formula.
// ---------------------------------------------------------------------------
describe("loop-aggregate — count (itemKey'd loop)", () => {
  const items = [
    { id: "cat", correctAnswer: "meow" },
    { id: "dog", correctAnswer: "woof" },
    { id: "cow", correctAnswer: "moo" },
  ];

  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeCompute("pick", [
        { outputKey: "items", formula: { type: "sample", input: items, n: 3 } },
      ]),
      {
        id: "loop",
        type: "loop",
        props: { type: "dynamic", dataKey: "$$pick.items", itemKey: "id" },
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
      seq("start", "pick"),
      seq("pick", "loop"),
      { type: "loop-template", from: "loop", to: "trial" },
      seq("loop", "score"),
      seq("score", "end"),
    ],
    screens: [{ slug: "trial", components: [] }, { slug: "end", components: [] }],
  };

  async function runLoop(
    getAnswer: (item: (typeof items)[0]) => string,
  ): Promise<number> {
    let step = await startExperiment(flow, "start");
    while (step.state.type === "in-loop") {
      const currentItem = (step.context.loopData as any)?.["loop"]?.value;
      step = await traverse(step, { answer: getAnswer(currentItem) });
    }
    return step.context.data?.["score"]?.["total"] as number;
  }

  it("counts correctly when iterations are keyed by an item property", async () => {
    expect(await runLoop((item) => item.correctAnswer)).toBe(3);
  });

  it("counts 1 when only one answer matches", async () => {
    expect(
      await runLoop((item) => (item.id === "dog" ? item.correctAnswer : "x")),
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// count — loose equality: a string answer "3" matches a numeric correctAnswer
// 3 (evaluateCondition's eq is ==). This is the type-coercion fix that strict
// === count-correct lacked.
// ---------------------------------------------------------------------------
describe("loop-aggregate — count (loose equality across types)", () => {
  const items = [
    { id: "1", correctAnswer: 3 },
    { id: "2", correctAnswer: 5 },
  ];

  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeCompute("pick", [
        { outputKey: "items", formula: { type: "sample", input: items, n: 2 } },
      ]),
      { id: "loop", type: "loop", props: { type: "dynamic", dataKey: "$$pick.items" } },
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
      seq("start", "pick"),
      seq("pick", "loop"),
      { type: "loop-template", from: "loop", to: "trial" },
      seq("loop", "score"),
      seq("score", "end"),
    ],
    screens: [{ slug: "trial", components: [] }, { slug: "end", components: [] }],
  };

  it("counts string answers that loosely equal numeric correct values", async () => {
    let step = await startExperiment(flow, "start");
    while (step.state.type === "in-loop") {
      const item = (step.context.loopData as any)?.["loop"]?.value;
      // Submit the correct value as a STRING (as a radio component would).
      step = await traverse(step, { answer: String(item.correctAnswer) });
    }
    expect(step.context.data?.["score"]?.["total"]).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// count — no where: counts every iteration. Static loop over plain strings.
// ---------------------------------------------------------------------------
describe("loop-aggregate — count (no predicate, static string loop)", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      { id: "loop", type: "loop", props: { type: "static", values: ["a", "b", "c", "d"] } },
      makeScreen("trial", "trial"),
      makeCompute("score", [
        {
          outputKey: "n",
          formula: { type: "loop-aggregate", loopId: "loop", op: "count" },
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

  it("counts every iteration when no predicate is given", async () => {
    let step = await startExperiment(flow, "start");
    while (step.state.type === "in-loop") step = await traverse(step, { v: 1 });
    expect(step.context.data?.["score"]?.["n"]).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// count — predicate over the collected field only (static string loop).
// ---------------------------------------------------------------------------
describe("loop-aggregate — count (predicate on collected field, static loop)", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      { id: "loop", type: "loop", props: { type: "static", values: ["red", "green", "blue"] } },
      makeScreen("trial", "trial"),
      makeCompute("score", [
        {
          outputKey: "yeses",
          formula: {
            type: "loop-aggregate",
            loopId: "loop",
            op: "count",
            where: { type: "simple", operator: "eq", dataKey: "@loop.trial.choice", value: "yes" },
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

  it("counts iterations whose collected field satisfies the predicate", async () => {
    let step = await startExperiment(flow, "start");
    const choices = ["yes", "no", "yes"];
    let i = 0;
    while (step.state.type === "in-loop") {
      step = await traverse(step, { choice: choices[i++] });
    }
    expect(step.context.data?.["score"]?.["yeses"]).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// sum / mean / min / max over a collected numeric field (dynamic object loop).
// ---------------------------------------------------------------------------
describe("loop-aggregate — sum/mean/min/max over a collected field", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

  function flowWith(op: string, outputKey: string): ExperimentFlow {
    return {
      nodes: [
        { id: "start", type: "start" },
        makeCompute("pick", [
          { outputKey: "items", formula: { type: "sample", input: items, n: 3 } },
        ]),
        { id: "loop", type: "loop", props: { type: "dynamic", dataKey: "$$pick.items" } },
        makeScreen("trial", "trial"),
        makeCompute("agg", [
          {
            outputKey,
            formula: { type: "loop-aggregate", loopId: "loop", op, field: "@loop.trial.rating" },
          },
        ]),
        makeScreen("end", "end"),
      ],
      edges: [
        seq("start", "pick"),
        seq("pick", "loop"),
        { type: "loop-template", from: "loop", to: "trial" },
        seq("loop", "agg"),
        seq("agg", "end"),
      ],
      screens: [{ slug: "trial", components: [] }, { slug: "end", components: [] }],
    };
  }

  async function runWith(op: string, key: string, ratings: number[]): Promise<number> {
    let step = await startExperiment(flowWith(op, key), "start");
    let i = 0;
    while (step.state.type === "in-loop") {
      step = await traverse(step, { rating: ratings[i++] });
    }
    return step.context.data?.["agg"]?.[key] as number;
  }

  it("sums the collected field across iterations", async () => {
    expect(await runWith("sum", "total", [2, 4, 6])).toBe(12);
  });

  it("averages the collected field across iterations", async () => {
    expect(await runWith("mean", "avg", [2, 4, 6])).toBe(4);
  });

  it("takes the minimum collected value", async () => {
    expect(await runWith("min", "lo", [7, 3, 5])).toBe(3);
  });

  it("takes the maximum collected value", async () => {
    expect(await runWith("max", "hi", [7, 3, 5])).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// sum over a static plain-string loop with a per-iteration filter.
// ---------------------------------------------------------------------------
describe("loop-aggregate — sum with predicate (static string loop)", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      { id: "loop", type: "loop", props: { type: "static", values: ["x", "y", "z"] } },
      makeScreen("trial", "trial"),
      makeCompute("agg", [
        {
          outputKey: "sumHigh",
          formula: {
            type: "loop-aggregate",
            loopId: "loop",
            op: "sum",
            field: "@loop.trial.score",
            where: { type: "simple", operator: "gte", dataKey: "@loop.trial.score", value: 3 },
          },
        },
      ]),
      makeScreen("end", "end"),
    ],
    edges: [
      seq("start", "loop"),
      { type: "loop-template", from: "loop", to: "trial" },
      seq("loop", "agg"),
      seq("agg", "end"),
    ],
    screens: [{ slug: "trial", components: [] }, { slug: "end", components: [] }],
  };

  it("sums only the iterations passing the predicate", async () => {
    let step = await startExperiment(flow, "start");
    const scores = [1, 4, 5]; // only 4 and 5 are >= 3
    let i = 0;
    while (step.state.type === "in-loop") {
      step = await traverse(step, { score: scores[i++] });
    }
    expect(step.context.data?.["agg"]?.["sumHigh"]).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// Loop nested inside a path: the loop's iteration data lands under the path
// (context.data[pathId][loopId]...), so the compute — also a path child — must
// resolve answers through its dataPath, not the absolute root.
// ---------------------------------------------------------------------------
describe("loop-aggregate — loop and compute nested inside a path", () => {
  const items = [
    { id: "1", correctAnswer: "yes" },
    { id: "2", correctAnswer: "yes" },
  ];

  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      { id: "p", type: "path", props: { name: "P" } },
      makeScreen("intro", "intro"),
      {
        id: "loop",
        type: "loop",
        props: { type: "static", values: items, itemKey: "id" },
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
      seq("start", "p"),
      { type: "path-contains", from: "p", to: "intro", order: 0 },
      { type: "path-contains", from: "p", to: "loop", order: 1 },
      { type: "path-contains", from: "p", to: "score", order: 2 },
      { type: "loop-template", from: "loop", to: "trial" },
      seq("p", "end"),
    ],
    screens: [
      { slug: "intro", components: [] },
      { slug: "trial", components: [] },
      { slug: "end", components: [] },
    ],
  };

  it("scores against path-nested iteration data", async () => {
    let step = await startExperiment(flow, "start");
    let guard = 0;
    while ((step.state as any).node?.id !== "end" && guard++ < 20) {
      step = await traverse(step, { answer: "yes" });
    }
    // Output is path-scoped at data[p][score]; both answers match → 2.
    expect(step.context.data?.["p"]?.["score"]?.["total"]).toBe(2);
  });
});
