import { afterEach, describe, expect, it, vi } from "vitest";
import { startExperiment, traverse } from "@/lib/flow";
import { ExperimentFlow } from "@/lib/types";
import { makeScreen, seq } from "../test-helpers";

// Design:
//   start-google / start-facebook
//   → checkpoint("experiment-init")
//   → screen("welcome")
//   → screen("profile")
//   → branch(age < 18 → screen("minor") | else → screen("adult"))
//   → checkpoint("pre-experiment")
//   → fork([control:1, treatment:1])
//       control   → path("control-path",   [screen("ctrl-q1"), screen("ctrl-q2")])
//       treatment → path("treatment-path", [screen("tmt-q1"),  screen("tmt-q2")])
//   → loop(static: ["red","blue","green"], template: screen("item-eval"))
//   → checkpoint("experiment-done")
//   → screen("debrief")

const complexFlow: ExperimentFlow = {
  nodes: [
    {
      id: "start-google",
      type: "start",
      props: { name: "Google", param: { key: "source", value: "google" } },
    },
    {
      id: "start-facebook",
      type: "start",
      props: { name: "Facebook", param: { key: "source", value: "facebook" } },
    },
    { id: "cp-init", type: "checkpoint", props: { name: "experiment-init" } },
    makeScreen("screen-welcome", "welcome"),
    makeScreen("screen-profile", "profile"),
    {
      id: "branch-age",
      type: "branch",
      props: {
        name: "Age gate",
        branches: [
          {
            id: "minor",
            name: "Minor",
            config: {
              type: "simple",
              operator: "lt",
              value: 18,
              dataKey: "$$profile.age",
            },
          },
          {
            id: "adult",
            name: "Adult",
            config: {
              type: "simple",
              operator: "gte",
              value: 18,
              dataKey: "$$profile.age",
            },
          },
        ],
      },
    },
    makeScreen("screen-minor", "minor"),
    makeScreen("screen-adult", "adult"),
    { id: "cp-pre", type: "checkpoint", props: { name: "pre-experiment" } },
    {
      id: "fork-group",
      type: "fork",
      props: {
        name: "Group assignment",
        forks: [
          { id: "control", name: "Control", weight: 1 },
          { id: "treatment", name: "Treatment", weight: 1 },
        ],
      },
    },
    { id: "path-control", type: "path", props: { name: "Control path" } },
    makeScreen("screen-ctrl-q1", "ctrl-q1"),
    makeScreen("screen-ctrl-q2", "ctrl-q2"),
    { id: "path-treatment", type: "path", props: { name: "Treatment path" } },
    makeScreen("screen-tmt-q1", "tmt-q1"),
    makeScreen("screen-tmt-q2", "tmt-q2"),
    {
      id: "loop-colors",
      type: "loop",
      props: { type: "static", values: ["red", "blue", "green"] },
    },
    makeScreen("screen-item-eval", "item-eval"),
    { id: "cp-done", type: "checkpoint", props: { name: "experiment-done" } },
    makeScreen("screen-debrief", "debrief"),
  ],
  edges: [
    // Both entry points converge at the first checkpoint
    seq("start-google", "cp-init"),
    seq("start-facebook", "cp-init"),
    seq("cp-init", "screen-welcome"),
    seq("screen-welcome", "screen-profile"),
    seq("screen-profile", "branch-age"),
    { type: "branch-condition", from: "branch-age.minor", to: "screen-minor" },
    { type: "branch-condition", from: "branch-age.adult", to: "screen-adult" },
    { type: "branch-default", from: "branch-age", to: "screen-adult" },
    seq("screen-minor", "cp-pre"),
    seq("screen-adult", "cp-pre"),
    seq("cp-pre", "fork-group"),
    { type: "fork-edge", from: "fork-group.control", to: "path-control" },
    { type: "fork-edge", from: "fork-group.treatment", to: "path-treatment" },
    {
      type: "path-contains",
      from: "path-control",
      to: "screen-ctrl-q1",
      order: 0,
    },
    {
      type: "path-contains",
      from: "path-control",
      to: "screen-ctrl-q2",
      order: 1,
    },
    {
      type: "path-contains",
      from: "path-treatment",
      to: "screen-tmt-q1",
      order: 0,
    },
    {
      type: "path-contains",
      from: "path-treatment",
      to: "screen-tmt-q2",
      order: 1,
    },
    // Both paths converge at the loop
    seq("path-control", "loop-colors"),
    seq("path-treatment", "loop-colors"),
    { type: "loop-template", from: "loop-colors", to: "screen-item-eval" },
    seq("loop-colors", "cp-done"),
    seq("cp-done", "screen-debrief"),
  ],
};

/** Drive the complex flow end-to-end for a given start node and age, with fork pinned. */
async function runComplexFlow(
  startNodeId: string,
  age: number,
  forkChoice: "control" | "treatment",
) {
  // Pin Math.random so fork selection is deterministic:
  //   total weight = 2, control is first (weight 1)
  //   rand = 0   → control wins   (0*2=0, 0-1=-1 ≤ 0)
  //   rand = 0.6 → treatment wins (0.6*2=1.2, 1.2-1=0.2 > 0; 0.2-1 ≤ 0)
  vi.spyOn(Math, "random").mockReturnValue(forkChoice === "control" ? 0 : 0.6);

  let step = await startExperiment(complexFlow, startNodeId);
  // After start → cp-init → welcome (all auto)
  expect((step.state as any).node.id).toBe("screen-welcome");

  step = await traverse(step, { viewed: true }); // welcome → profile
  step = await traverse(step, { age }); // profile → branch → age screen

  const ageBranch = age < 18 ? "minor" : "adult";
  expect(step.context.branches?.["branch-age"]).toBe(ageBranch);

  step = await traverse(step, { consented: true }); // age screen → cp-pre → fork → path

  // Now inside the chosen path
  expect(step.state.type).toBe("in-path");
  const expectedPathId =
    forkChoice === "control" ? "path-control" : "path-treatment";
  expect((step.state as any).node.id).toBe(expectedPathId);

  step = await traverse(step, { q1: "answer-1" }); // q1 → q2
  step = await traverse(step, { q2: "answer-2" }); // q2 → exit path → loop (color 0)

  expect(step.state.type).toBe("in-loop");
  expect(step.context.loopData?.["loop-colors"]?.value).toBe("red");

  step = await traverse(step, { rating: 1 }); // red → blue
  step = await traverse(step, { rating: 2 }); // blue → green
  step = await traverse(step, { rating: 3 }); // green → exit loop → cp-done → debrief

  expect((step.state as any).node.id).toBe("screen-debrief");
  return step;
}

describe("complex experiment (all node types)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("completes full flow: google → minor → control path → loop → debrief", async () => {
    const step = await runComplexFlow("start-google", 15, "control");
    expect(step.context.start?.group).toBe("source=google");
    expect(step.context.branches?.["branch-age"]).toBe("minor");
    expect(step.context.forks?.["fork-group"]).toBe("control");
    expect(step.context.paths?.["path-control"]?.order).toEqual([
      "screen-ctrl-q1",
      "screen-ctrl-q2",
    ]);
  });

  it("completes full flow: facebook → adult → treatment path → loop → debrief", async () => {
    const step = await runComplexFlow("start-facebook", 30, "treatment");
    expect(step.context.start?.group).toBe("source=facebook");
    expect(step.context.branches?.["branch-age"]).toBe("adult");
    expect(step.context.forks?.["fork-group"]).toBe("treatment");
    expect(step.context.paths?.["path-treatment"]?.order).toEqual([
      "screen-tmt-q1",
      "screen-tmt-q2",
    ]);
  });

  it("records all three checkpoints in context", async () => {
    const step = await runComplexFlow("start-google", 25, "control");
    expect(step.context.checkpoints?.["experiment-init"]).toBeDefined();
    expect(step.context.checkpoints?.["pre-experiment"]).toBeDefined();
    expect(step.context.checkpoints?.["experiment-done"]).toBeDefined();
  });

  it("accumulates screen data across all node types", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // control
    let step = await startExperiment(complexFlow, "start-google");
    step = await traverse(step, { viewed: true });
    step = await traverse(step, { age: 25 });
    step = await traverse(step, { consented: true });
    step = await traverse(step, { q1: "alpha" });
    step = await traverse(step, { q2: "beta" });
    step = await traverse(step, { rating: 5 });
    step = await traverse(step, { rating: 4 });
    step = await traverse(step, { rating: 3 });
    expect(step.context.data?.["profile"]).toEqual({ age: 25 });
    expect(step.context.data?.["path-control"]?.["ctrl-q1"]).toEqual({
      q1: "alpha",
    });
    expect(step.context.data?.["path-control"]?.["ctrl-q2"]).toEqual({
      q2: "beta",
    });
  });

  it("loop iterates through all 3 colors in the correct order", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // control
    let step = await startExperiment(complexFlow, "start-google");
    step = await traverse(step, { viewed: true });
    step = await traverse(step, { age: 25 });
    step = await traverse(step, { consented: true });
    step = await traverse(step, { q1: "a" });
    step = await traverse(step, { q2: "b" });
    const colors: string[] = [];
    while (step.state.type === "in-loop") {
      colors.push(step.context.loopData!["loop-colors"]!.value);
      step = await traverse(step, { rated: true });
    }
    expect(colors).toEqual(["red", "blue", "green"]);
  });
});

describe("error cases", () => {
  it("throws when start node has no sequential edge out", async () => {
    const flow: ExperimentFlow = {
      nodes: [{ id: "start", type: "start" }],
      edges: [],
    };
    await expect(startExperiment(flow, "start")).rejects.toThrow(
      "Start node must have a next node",
    );
  });

  it("throws when path node has no path-contains children", async () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        { id: "path-empty", type: "path", props: { name: "Empty" } },
      ],
      edges: [seq("start", "path-empty")],
    };
    await expect(startExperiment(flow, "start")).rejects.toThrow(
      "Path node must have child nodes",
    );
  });

  it("throws when loop node has no loop-template edge", async () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        {
          id: "loop-bad",
          type: "loop",
          props: { type: "static", values: ["x"] },
        },
      ],
      edges: [seq("start", "loop-bad")],
    };
    await expect(startExperiment(flow, "start")).rejects.toThrow(
      "Loop node must have a template node",
    );
  });

  it("throws when branch has no matching condition and no default edge", async () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        makeScreen("s-age", "age"),
        {
          id: "branch-age",
          type: "branch",
          props: {
            name: "Age branch",
            branches: [
              {
                id: "adult",
                name: "Adult",
                config: {
                  type: "simple",
                  operator: "gte",
                  value: 18,
                  dataKey: "$$age.age",
                },
              },
            ],
          },
        },
        makeScreen("s-adult", "adult"),
      ],
      edges: [
        seq("start", "s-age"),
        seq("s-age", "branch-age"),
        { type: "branch-condition", from: "branch-age.adult", to: "s-adult" },
        // intentionally no branch-default edge
      ],
    };
    const step = await startExperiment(flow, "start");
    await expect(traverse(step, { age: 5 })).rejects.toThrow(
      "Branch node must have a next node for the winning branch",
    );
  });

  it("throws when fork node has no fork-edge for the selected fork", async () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        {
          id: "fork-bad",
          type: "fork",
          props: {
            name: "Bad fork",
            forks: [{ id: "x", name: "X", weight: 1 }],
          },
        },
      ],
      edges: [seq("start", "fork-bad")],
    };
    await expect(startExperiment(flow, "start")).rejects.toThrow();
  });
});
