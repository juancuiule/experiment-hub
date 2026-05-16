import { describe, expect, it } from "vitest";
import { startExperiment, traverse } from "@/lib/flow";
import { ExperimentFlow } from "@/lib/types";
import { makeScreen, seq } from "../test-helpers";

describe("branch", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("screen-age", "age-screen"),
      {
        id: "branch-age",
        type: "branch",
        props: {
          name: "Age branch",
          branches: [
            {
              id: "minor",
              name: "Minor",
              config: {
                type: "simple",
                operator: "lt",
                value: 18,
                dataKey: "$$age-screen.age",
              },
            },
            {
              id: "adult",
              name: "Adult",
              config: {
                type: "simple",
                operator: "gte",
                value: 18,
                dataKey: "$$age-screen.age",
              },
            },
          ],
        },
      },
      makeScreen("screen-minor", "minor-screen"),
      makeScreen("screen-adult", "adult-screen"),
      makeScreen("screen-default", "default-screen"),
    ],
    edges: [
      seq("start", "screen-age"),
      seq("screen-age", "branch-age"),
      {
        type: "branch-condition",
        from: "branch-age.minor",
        to: "screen-minor",
      },
      {
        type: "branch-condition",
        from: "branch-age.adult",
        to: "screen-adult",
      },
      { type: "branch-default", from: "branch-age", to: "screen-default" },
    ],
  };

  it("follows the matching branch-condition edge", async () => {
    const step1 = await startExperiment(flow, "start");
    const step2 = await traverse(step1, { age: 15 }); // store + advance → branch → screen-minor
    expect((step2.state as any).node.id).toBe("screen-minor");
    expect(step2.context.branches?.["branch-age"]).toBe("minor");
  });

  it("follows a different branch based on data", async () => {
    const step1 = await startExperiment(flow, "start");
    const step2 = await traverse(step1, { age: 30 });
    expect((step2.state as any).node.id).toBe("screen-adult");
    expect(step2.context.branches?.["branch-age"]).toBe("adult");
  });

  it("falls back to branch-default when no condition matches", async () => {
    const step1 = await startExperiment(flow, "start");
    const step2 = await traverse(step1, { age: "not-a-number" });
    expect((step2.state as any).node.id).toBe("screen-default");
    expect(step2.context.branches?.["branch-age"]).toBe("default");
  });

  it("falls back to branch-default when data is missing entirely", async () => {
    const step1 = await startExperiment(flow, "start");
    const step2 = await traverse(step1, {});
    expect((step2.state as any).node.id).toBe("screen-default");
  });
});
