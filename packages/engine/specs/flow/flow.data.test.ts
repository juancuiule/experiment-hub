import { describe, expect, it } from "vitest";
import { startExperiment, traverse } from "@experiment-hub/engine/flow";
import { ExperimentFlow } from "@experiment-hub/engine/types";
import { makeScreen, seq } from "../test-helpers";

function makeData(
  id: string,
  data: Record<string, unknown>,
): ExperimentFlow["nodes"][0] {
  return { id, type: "data" as const, props: { name: id, data } };
}

function pathContains(
  from: string,
  to: string,
  order: number,
): ExperimentFlow["edges"][0] {
  return { type: "path-contains", from, to, order };
}

describe("data node — stores data in context", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeData("config", { items: ["a", "b", "c"], threshold: 5 }),
      makeScreen("s1", "end"),
    ],
    edges: [seq("start", "config"), seq("config", "s1")],
    screens: [{ slug: "end", components: [] }],
  };

  it("auto-traverses and stores data under context.data[nodeId]", async () => {
    const step = await startExperiment(flow, "start");
    expect(step.context.data?.["config"]).toEqual({
      items: ["a", "b", "c"],
      threshold: 5,
    });
    expect((step.state as any).node.id).toBe("s1");
  });
});

describe("data node — downstream $$ references resolve correctly", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeData("catalog", { pool: ["x", "y", "z"] }),
      {
        id: "loop-items",
        type: "loop",
        props: { type: "dynamic", dataKey: "$$catalog.pool" },
      },
      makeScreen("screen-item", "item"),
      makeScreen("screen-end", "end"),
    ],
    edges: [
      seq("start", "catalog"),
      seq("catalog", "loop-items"),
      { type: "loop-template", from: "loop-items", to: "screen-item" },
      seq("loop-items", "screen-end"),
    ],
    screens: [
      { slug: "item", components: [] },
      { slug: "end", components: [] },
    ],
  };

  it("a dynamic loop reads values defined in the data node", async () => {
    const step = await startExperiment(flow, "start");
    expect(step.state.type).toBe("in-loop");
    expect(step.context.loops?.["loop-items"]?.order).toEqual(["x", "y", "z"]);
  });

  it("iterates through all items and exits", async () => {
    let step = await startExperiment(flow, "start");
    let iterations = 0;
    while (step.state.type === "in-loop") {
      iterations++;
      step = await traverse(step, {});
    }
    expect(iterations).toBe(3);
    expect((step.state as any).node.id).toBe("screen-end");
  });
});

describe("data node — nested object values accessible downstream", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeData("cfg", {
        labels: { low: "Low", high: "High" },
        cutoff: 10,
      }),
      makeScreen("s1", "end"),
    ],
    edges: [seq("start", "cfg"), seq("cfg", "s1")],
    screens: [{ slug: "end", components: [] }],
  };

  it("stores nested object values intact", async () => {
    const step = await startExperiment(flow, "start");
    expect(step.context.data?.["cfg"]?.labels).toEqual({
      low: "Low",
      high: "High",
    });
    expect(step.context.data?.["cfg"]?.cutoff).toBe(10);
  });
});

describe("data node — empty data dict", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeData("empty-node", {}),
      makeScreen("s1", "end"),
    ],
    edges: [seq("start", "empty-node"), seq("empty-node", "s1")],
    screens: [{ slug: "end", components: [] }],
  };

  it("stores an empty object and advances normally", async () => {
    const step = await startExperiment(flow, "start");
    expect(step.context.data?.["empty-node"]).toEqual({});
    expect((step.state as any).node.id).toBe("s1");
  });
});

describe("data node — inside a path (nested dataPath)", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      { id: "path-q", type: "path", props: { name: "Questions" } },
      makeData("refs", { options: ["opt1", "opt2"] }),
      makeScreen("s1", "q"),
      makeScreen("s2", "end"),
    ],
    edges: [
      seq("start", "path-q"),
      pathContains("path-q", "refs", 0),
      pathContains("path-q", "s1", 1),
      seq("path-q", "s2"),
    ],
    screens: [
      { slug: "q", components: [] },
      { slug: "end", components: [] },
    ],
  };

  it("stores data scoped under path-id.data-id", async () => {
    let step = await startExperiment(flow, "start");
    // refs (data node) was auto-traversed; path advanced to s1 during enterStep
    expect(step.state.type).toBe("in-path");
    expect((step.state as any).innerState?.node?.id).toBe("s1");
    expect(step.context.data?.["path-q"]?.["refs"]).toEqual({
      options: ["opt1", "opt2"],
    });
    // submit s1 → path exits → s2
    step = await traverse(step, {});
    expect((step.state as any).node.id).toBe("s2");
  });
});
